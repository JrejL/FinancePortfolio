"""Ratio analysis across four operating companies: Aldercrest, Lumenpath, Saltbrush
and Sunfield. Palomar Vista is a government fund with no shareholders or cost of
goods sold, so it is left out; its budget work runs in variance_flags.py.
"""
import pandas as pd
from common import brand_title, read_statement, save_chart, write_project
import matplotlib.pyplot as plt

YEARS = ["FY2023", "FY2024", "FY2025"]

# Per company: the statement labels that hold each figure, since the five case
# studies do not share one chart of accounts. Lumenpath has no inventory and
# its balance sheet does not split current from noncurrent liabilities.
COMPANIES = {
    "Aldercrest Aerospace": dict(slug="aldercrest-aerospace", revenue="Total revenue", cogs=["Cost of sales"],
        gross_profit="Gross profit", operating_income="Operating income", net_income="Net income",
        receivables="Accounts receivable", inventory="Inventory", payables="Accounts payable",
        current_liabilities="Total current liabilities"),
    "Lumenpath Software": dict(slug="lumenpath-software", revenue="Total revenue",
        cogs=["Cost of subscription", "Cost of services"], gross_profit="Gross profit",
        operating_income="Operating income (loss)", net_income="Net income (loss)",
        receivables="Accounts receivable", inventory=None, payables="Accounts payable",
        current_liabilities="Total liabilities"),
    "Saltbrush Beverage": dict(slug="saltbrush-beverage", revenue="Revenue", gross_profit="Gross profit",
        cogs=["Cost of sales at standard", "Manufacturing variances"], operating_income="Operating income",
        net_income="Net income", receivables="Accounts receivable", inventory="Inventory",
        payables="Accounts payable", current_liabilities="Total current liabilities"),
    "Sunfield Kitchen": dict(slug="sunfield-kitchen", revenue="Restaurant sales", cogs=["Food and packaging"],
        gross_profit=None, operating_income="Operating income", net_income="Net income",
        receivables="Receivables", inventory="Inventory", payables="Accounts payable",
        current_liabilities="Total current liabilities"),
}
rows = []
for company, cfg in COMPANIES.items():
    inc, bal = read_statement(cfg["slug"], "income_statement"), read_statement(cfg["slug"], "balance_sheet")
    revenue, cogs = inc.loc[cfg["revenue"]], inc.loc[cfg["cogs"]].sum()
    gross_profit = inc.loc[cfg["gross_profit"]] if cfg["gross_profit"] else revenue - cogs
    inventory = bal.loc[cfg["inventory"]] if cfg["inventory"] else None
    for year in YEARS:
        dio = 365 * inventory[year] / cogs[year] if inventory is not None else None
        rows.append({
            "company": company, "year": year,
            "gross_margin": gross_profit[year] / revenue[year],
            "operating_margin": inc.loc[cfg["operating_income"]][year] / revenue[year],
            "ebitda_margin": inc.loc["EBITDA" if "EBITDA" in inc.index else "Adjusted EBITDA"][year] / revenue[year],
            "net_margin": inc.loc[cfg["net_income"]][year] / revenue[year],
            "current_ratio": bal.loc["Total current assets"][year] / bal.loc[cfg["current_liabilities"]][year],
            "liabilities_to_equity": bal.loc["Total liabilities"][year] / bal.loc["Total equity"][year],
            "roe": inc.loc[cfg["net_income"]][year] / bal.loc["Total equity"][year],
            "roa": inc.loc[cfg["net_income"]][year] / bal.loc["Total assets"][year],
            "dso": 365 * bal.loc[cfg["receivables"]][year] / revenue[year],
            "dio": dio,
            "dpo": 365 * bal.loc[cfg["payables"]][year] / cogs[year],
        })
ratios = pd.DataFrame(rows).set_index(["company", "year"])
fy25 = ratios.xs("FY2025", level="year")
# Table 1: every ratio for FY2025, one row per company.
fmt_cols = ["gross_margin", "ebitda_margin", "net_margin", "current_ratio", "liabilities_to_equity", "roe", "roa", "dso", "dio", "dpo"]
col_labels = ["Gross margin", "EBITDA margin", "Net margin", "Current ratio", "Liabilities to equity", "Return on equity", "Return on assets", "DSO", "DIO", "DPO"]
formats = ["pct", "pct", "pct", "multiple", "multiple", "pct", "pct", "days", "days", "days"]
comparison_table = {
    "title": "FY2025 ratio comparison", "columns": ["Company"] + col_labels,
    "rows": [{"label": c, "values": [None if pd.isna(v) else round(float(v), 4) for v in fy25.loc[c, fmt_cols]],
              "style": "line", "formats": formats} for c in fy25.index],
    "note": "Lumenpath's current ratio uses total liabilities as the denominator (no current/noncurrent split) "
            "and has no inventory, so DIO does not apply to it. Sunfield's gross margin subtracts food and "
            "packaging cost only, since restaurant statements do not report a separate gross profit line.",
}
# Table 2: gross, EBITDA and net margin trend by company.
trend_metrics = [("gross_margin", "Gross margin"), ("ebitda_margin", "EBITDA margin"), ("net_margin", "Net margin")]
trend_rows = []
for company in COMPANIES:
    trend_rows.append({"label": company, "values": None, "style": "section", "indent": 0})
    for metric, label in trend_metrics:
        values = [round(float(ratios.loc[(company, y), metric]), 4) for y in YEARS]
        trend_rows.append({"label": label, "values": values, "style": "pct", "indent": 1, "format": "pct"})
trend_table = {"title": "Margin trend, FY2023 to FY2025", "columns": ["Metric"] + YEARS, "rows": trend_rows}
# Chart: grouped bars of FY2025 gross, operating and net margin by company.
margin_metrics = [("gross_margin", "Gross margin"), ("operating_margin", "Operating margin"), ("net_margin", "Net margin")]
margin_chart = {
    "type": "bar", "title": "FY2025 margins by company", "labels": list(fy25.index),
    "series": [{"name": label, "values": [round(float(v), 4) for v in fy25[metric]]} for metric, label in margin_metrics],
    "format": "pct", "reference": None,
}
fig, ax = plt.subplots(figsize=(6, 4.6))
width, x = 0.25, range(len(fy25.index))
for i, (metric, label) in enumerate(margin_metrics):
    ax.bar([p + i * width for p in x], fy25[metric] * 100, width, label=label)
ax.set_xticks([p + width for p in x])
ax.set_xticklabels(fy25.index, rotation=15, ha="right")
ax.set_ylabel("Margin (%)")
brand_title(ax, "FY2025 margins by company")
ax.legend(loc="upper center", bbox_to_anchor=(0.5, 1.18), ncol=3, frameon=False)
image_file = save_chart(fig, "ratio_margins")
plt.close(fig)
# Claims below are read off the DataFrame (idxmax/idxmin), so the company named always matches the number quoted.
top_lte, top_gross = fy25["liabilities_to_equity"].idxmax(), fy25["gross_margin"].idxmax()
fastest_dso, dio_by_company = fy25["dso"].idxmin(), fy25["dio"].dropna()
slowest_dio = dio_by_company.idxmax()
notes = [
    f"{top_lte} carries the highest liabilities to equity of the four at "
    f"{fy25.loc[top_lte, 'liabilities_to_equity']:.2f}x.",
    f"{top_gross} posts the strongest gross margin at {fy25.loc[top_gross, 'gross_margin']:.1%}.",
    f"{fastest_dso} collects fastest on receivables (DSO {fy25.loc[fastest_dso, 'dso']:.1f} days) since "
    f"restaurant sales are mostly cash and card, settled in days not weeks.",
    f"{slowest_dio} turns inventory slowest of the {len(dio_by_company)} companies with inventory, at "
    f"{dio_by_company[slowest_dio]:.1f} days.",
]
write_project(
    id_="ratio-analysis", title="Ratio analysis across four companies", script_path=__file__,
    question="How do profitability, liquidity and leverage compare across Aldercrest, Lumenpath, Saltbrush and Sunfield in FY2025?",
    summary="Computes profitability, liquidity, leverage and working capital ratios for four case study "
            "companies from their statement data and compares FY2025 side by side.",
    tables=[comparison_table, trend_table], charts=[margin_chart], notes=notes,
    images=[{"file": image_file, "alt": "Grouped bar chart of FY2025 margins by company",
             "caption": "Gross, operating and net margin by company, FY2025"}])
if __name__ == "__main__":
    print("ratio_analyzer: wrote site/python/out/ratio-analysis.json")
