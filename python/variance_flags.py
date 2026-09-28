"""Budget versus actual variance flags for Sunfield Kitchen, Palomar Vista and Escentials.
Stacks each entity's real budget lines (subtotals dropped) into one table, recomputes
variance and materiality independently of the source files, and flags anything material.
"""
import csv
import pandas as pd
from common import DATA_CSV, OUT, read_case, stabilize_xlsx, write_project

# Sunfield and Escentials' bva tables (from the case JSON) tag each row's style: "line" for a
# real budget line, "subtotal"/"total" for a rollup. Palomar Vista's full detail (11 revenue
# lines, 7 departments, two transfers) only exists in its CSV, untagged, so its rollup rows
# are named explicitly. Sunfield and Palomar report in thousands, Escentials in whole dollars.
PALOMAR_DROP = {"Total revenues", "Total expenditures", "Net change in fund balance"}
PALOMAR_REVENUE = {"Property taxes", "Sales and use tax", "Utility users tax", "Transient occupancy tax",
                    "Franchise fees", "Licenses and permits", "Charges for services", "Fines and forfeitures",
                    "Investment earnings", "Intergovernmental", "Other revenue", "Transfers in"}
PALOMAR_EXPENSE_LINES = {"General government", "Police", "Fire", "Public works", "Parks and recreation",
                          "Community development", "Nondepartmental"}  # materiality base: budgeted expense only
MATERIALITY_RATE = 0.01  # 1% of an entity's total budgeted expense
DOLLAR_FLOOR_RATE = 0.0025  # 0.25% of budgeted expense: screens out small-dollar, high-percent misses on tiny lines

def load_palomar():
    with open(DATA_CSV / "palomar-vista_budget_vs_actual.csv", newline="") as f:
        rows = [r for r in csv.DictReader(f) if r["line_item"] not in PALOMAR_DROP]
    return pd.DataFrame({
        "entity": "Palomar Vista", "line": [r["line_item"] for r in rows],
        "budget": [float(r["Final"]) * 1000 for r in rows], "actual": [float(r["Actual"]) * 1000 for r in rows],
        "type": ["revenue" if r["line_item"] in PALOMAR_REVENUE else "cost" for r in rows],
        "expense_line": [r["line_item"] in PALOMAR_EXPENSE_LINES for r in rows],
    })

def load_json_lines(entity, slug, table_title, revenue_lines, scale):
    """Real budget lines (style == 'line') from a case data file's bva table."""
    table = next(t for a in read_case(slug)["analyses"] if a["id"] == "bva" for t in a["tables"] if t["title"] == table_title)
    cols = table["columns"]
    b_idx, a_idx = cols.index("Budget") - 1, cols.index("Actual") - 1
    rows = [r for r in table["rows"] if r.get("style") == "line"]
    lines = pd.DataFrame({
        "entity": entity, "line": [r["label"] for r in rows],
        "budget": [r["values"][b_idx] * scale for r in rows], "actual": [r["values"][a_idx] * scale for r in rows],
        "type": ["revenue" if r["label"] in revenue_lines else "cost" for r in rows],
    })
    lines["expense_line"] = lines["type"] == "cost"
    return lines

lines = pd.concat([
    load_palomar(),
    load_json_lines("Sunfield Kitchen", "sunfield-kitchen", "Full year budget versus actual", {"Restaurant sales"}, 1000),
    load_json_lines("Escentials", "escentials-llc", "By line, full year", set(), 1),
], ignore_index=True)
# Variance is actual minus budget. Status flips sign by type: for revenue, actual
# above budget is favorable; for cost, actual above budget (spent more) is unfavorable.
lines["variance"] = lines["actual"] - lines["budget"]
lines["variance_pct"] = lines["variance"] / lines["budget"].replace(0, pd.NA)
favorable = (lines["type"] == "revenue") & (lines["variance"] >= 0) | (lines["type"] == "cost") & (lines["variance"] <= 0)
lines["status"] = favorable.map({True: "Favorable", False: "Unfavorable"})
# Flag a line when it clears materiality on its own, or when it clears 5% and a dollar floor (screens a tiny line's big percent swing).
expense_budget = lines[lines["expense_line"]].groupby("entity")["budget"].sum()
materiality, dollar_floor = expense_budget * MATERIALITY_RATE, expense_budget * DOLLAR_FLOOR_RATE
lines["materiality"], lines["dollar_floor"] = lines["entity"].map(materiality), lines["entity"].map(dollar_floor)
lines["flagged"] = (lines["variance"].abs() > lines["materiality"]) | \
    ((lines["variance_pct"].abs() > 0.05) & (lines["variance"].abs() > lines["dollar_floor"]))
flagged = lines[lines["flagged"]].assign(abs_var=lines["variance"].abs()).sort_values("abs_var", ascending=False)
flagged_rows = [{
    "label": r.line, "values": [r.entity, round(r.budget, 2), round(r.actual, 2), round(r.variance, 2),
                                 round(float(r.variance_pct), 4) if pd.notna(r.variance_pct) else None, r.status],
    "style": "line", "formats": ["number", "money", "money", "money", "pct", "money"],
} for r in flagged.itertuples()]
mat_by, floor_by = (", ".join(f"{e} {v:,.0f}" for e, v in s.items()) for s in (materiality, dollar_floor))
flagged_table = {
    "title": "Flagged budget lines, FY2025", "rows": flagged_rows,
    "columns": ["Line", "Entity", "Budget", "Actual", "Variance", "Variance %", "Status"],
    "note": f"Sorted by absolute variance, largest first. Flag rule: over {MATERIALITY_RATE:.0%} of budgeted "
            f"expense ({mat_by}), or over 5% variance and over a {DOLLAR_FLOOR_RATE:.2%} dollar floor "
            f"({floor_by}), so a small line's big percent swing does not flag alone.",
}
counts = lines.groupby("entity").agg(total_lines=("line", "count"), flagged_lines=("flagged", "sum"))
counts_table = {
    "title": "Flag counts by entity", "columns": ["Entity", "Flagged lines", "Total lines"],
    "rows": [{"label": e, "values": [int(r.flagged_lines), int(r.total_lines)], "style": "line", "format": "number"}
             for e, r in counts.iterrows()],
}
variance_chart = {
    "type": "bar", "title": "Flagged lines by variance percent", "format": "pct", "reference": None,
    "labels": [f"{r.entity}: {r.line}" for r in flagged.itertuples()],
    "series": [{"name": "Variance %", "values": [round(float(r.variance_pct), 4) for r in flagged.itertuples()]}],
}
xlsx_path = OUT / "variance_flags.xlsx"
export_cols = ["entity", "line", "budget", "actual", "variance", "variance_pct", "status"]
OUT.mkdir(parents=True, exist_ok=True)
with pd.ExcelWriter(xlsx_path, engine="openpyxl") as writer:
    lines[export_cols].to_excel(writer, sheet_name="Summary", index=False)
    for entity in lines["entity"].unique():
        lines[lines["entity"] == entity][export_cols].to_excel(writer, sheet_name=entity[:31], index=False)
stabilize_xlsx(xlsx_path)  # fixes timestamps so the same data produces the same bytes on a rerun
# Named comparisons below come from the DataFrame (idxmax, a real comparison against the materiality threshold).
largest_entity = lines.groupby("entity")["variance"].apply(lambda s: s.abs().sum()).idxmax()
sunfield_sales = lines.query("entity == 'Sunfield Kitchen' and line == 'Restaurant sales'").iloc[0]
materiality_only = flagged[flagged["variance_pct"].abs() <= 0.05]
n_mat = len(materiality_only)
mat_line, mat_ent = (materiality_only.iloc[0]["line"], materiality_only.iloc[0]["entity"]) if n_mat else (None, None)
mat_note = f"{n_mat} {'line' if n_mat == 1 else 'lines'}, including {mat_line} at {mat_ent}, " \
    f"{'is' if n_mat == 1 else 'are'} flagged only because the dollar amount clears the entity's materiality " \
    "threshold, not the 5% rule." if n_mat else "Every flagged line here also clears the 5% variance rule on its own."
notes = [
    f"{int(counts['flagged_lines'].sum())} of {int(counts['total_lines'].sum())} budget lines across the three entities cross the flag rule.",
    f"Sunfield's restaurant sales come in {abs(sunfield_sales['variance_pct']):.1%} below budget, the main driver of its unfavorable restaurant level profit.",
    f"{largest_entity} shows the largest total dollar variance of the three entities.",
    mat_note,
]
write_project(
    id_="variance-flags", title="Budget versus actual variance flags", script_path=__file__, units="dollars",
    question="Which budget lines at Sunfield Kitchen, Palomar Vista and Escentials moved enough from budget to need a look?",
    summary="Stacks the three entities' real FY2025 budget lines (subtotals dropped), recomputes variance in "
            "dollars, and flags anything over the entity's materiality threshold, or over 5 percent and over a "
            "dollar floor.",
    tables=[flagged_table, counts_table], charts=[variance_chart], images=[], notes=notes,
    files=[{"label": "Variance flags workbook", "file": "variance_flags.xlsx", "bytes": xlsx_path.stat().st_size}])
if __name__ == "__main__":
    print("variance_flags: wrote site/python/out/variance-flags.json and variance_flags.xlsx")
