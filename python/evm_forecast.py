"""Earned value forecast for Aldercrest's ALX-7 program, FY2025. Turns the
monthly planned value, earned value and actual cost into performance indexes
and three estimate at completion methods.
"""
import pandas as pd

from common import BRAND_TEXT, brand_title, read_case, save_chart, write_project
import matplotlib.pyplot as plt

case = read_case("aldercrest-aerospace")
evm = next(a for a in case["analyses"] if a["id"] == "evm")
chart = next(c for c in evm["charts"] if c["title"].startswith("Cumulative"))
months = chart["labels"]
series = {s["name"]: pd.Series(s["values"], index=months, dtype=float) for s in chart["series"]}

monthly = pd.DataFrame({"PV": series["Planned value"], "EV": series["Earned value"], "AC": series["Actual cost"]})
monthly["CPI"] = monthly["EV"] / monthly["AC"]
monthly["SPI"] = monthly["EV"] / monthly["PV"]

dec = monthly.iloc[-1]
# The case is built so December CPI rounds to 0.93 and SPI to 0.91; catch a data mismatch early.
assert round(dec["CPI"], 2) == 0.93 and round(dec["SPI"], 2) == 0.91, "December CPI/SPI do not match the case"

metrics_table = next(t for t in evm["tables"] if t["title"].startswith("Earned value metrics"))
bac = next(r["values"][0] for r in metrics_table["rows"] if r["label"].startswith("Budget at completion"))

eac_cpi = bac / dec["CPI"]
eac_simple = dec["AC"] + (bac - dec["EV"])
eac_blended = dec["AC"] + (bac - dec["EV"]) / (dec["CPI"] * dec["SPI"])
tcpi_to_bac = (bac - dec["EV"]) / (bac - dec["AC"])
# TCPI to the BAC / CPI estimate is always exactly CPI by construction (a short algebraic
# identity), so it adds nothing beyond CPI already on this table; only TCPI to BAC is reported.

eac_table = {
    "title": "Estimate at completion, December 2025", "columns": ["Method", "EAC", "VAC"],
    "rows": [
        {"label": "BAC / CPI", "values": [round(eac_cpi, 0), round(bac - eac_cpi, 0)], "style": "line", "format": "money"},
        {"label": "AC + (BAC − EV)", "values": [round(eac_simple, 0), round(bac - eac_simple, 0)], "style": "line", "format": "money"},
        {"label": "AC + (BAC − EV) / (CPI x SPI)", "values": [round(eac_blended, 0), round(bac - eac_blended, 0)],
         "style": "line", "format": "money"},
    ],
    "note": "VAC is BAC minus EAC; a negative VAC is a projected overrun against the 48,000 budget at completion.",
}

index_table = {
    "title": "Performance indexes and to complete index, December 2025", "columns": ["Metric", "Value"],
    "rows": [
        {"label": "Cost performance index (CPI)", "values": [round(float(dec["CPI"]), 4)], "style": "line", "format": "index"},
        {"label": "Schedule performance index (SPI)", "values": [round(float(dec["SPI"]), 4)], "style": "line", "format": "index"},
        {"label": "To complete performance index, to BAC", "values": [round(tcpi_to_bac, 4)], "style": "line", "format": "index"},
    ],
    "note": "A TCPI above 1.0 means the remaining work has to run more efficiently than the program has run so far.",
}

cpi_spi_chart = {
    "type": "line", "title": "Cumulative CPI and SPI by month", "labels": months,
    "series": [{"name": "CPI", "values": [round(float(v), 4) for v in monthly["CPI"]]},
               {"name": "SPI", "values": [round(float(v), 4) for v in monthly["SPI"]]}],
    "format": "index", "reference": {"name": "On plan", "value": 1.0},
}

fig, ax = plt.subplots(figsize=(6, 4))
ax.plot(months, monthly["CPI"], marker="o", label="CPI")
ax.plot(months, monthly["SPI"], marker="o", label="SPI")
ax.axhline(1.0, color=BRAND_TEXT, linestyle=":", linewidth=1)
ax.set_ylabel("Index")
brand_title(ax, "CPI and SPI by month, ALX-7 FY2025")
ax.legend()
image_file = save_chart(fig, "evm_cpi_spi")
plt.close(fig)

# Build the trend claim from the series instead of typing it in: check whether CPI falls
# every month, and find the month SPI actually bottoms out, rather than assuming both trend down.
cpi_falls_every_month = all(b < a for a, b in zip(monthly["CPI"], monthly["CPI"].iloc[1:]))
spi_low_month = monthly["SPI"].idxmin()
spi_low = float(monthly["SPI"].min())
if cpi_falls_every_month:
    trend_note = (f"CPI falls every month through December to {dec['CPI']:.2f}, while SPI bottoms in "
                  f"{spi_low_month} at {spi_low:.3f} before recovering to {dec['SPI']:.3f} by December.")
else:
    trend_note = (f"SPI bottoms in {spi_low_month} at {spi_low:.3f} before recovering to {dec['SPI']:.3f} "
                  "by December.")

notes = [
    f"CPI ends the year at {dec['CPI']:.2f} and SPI at {dec['SPI']:.2f}, so ALX-7 is both over cost and behind "
    f"schedule against its cumulative plan.",
    f"The three EAC methods range from {eac_simple:,.0f} to {eac_blended:,.0f} against a budget at completion "
    f"of {bac:,.0f}, all pointing to an overrun.",
    f"To complete performance index to BAC is {tcpi_to_bac:.2f}, above 1.0, meaning the remaining work needs to "
    f"run more efficiently than the program has run so far just to hit the original budget.",
    trend_note,
]

write_project(
    id_="evm-forecast", title="Earned value forecast, ALX-7 program",
    question="Given the cost and schedule performance on ALX-7 through December 2025, where does the program end up?",
    summary="Computes cumulative CPI and SPI by month for Aldercrest's ALX-7 program and three estimate at "
            "completion methods from the December figures.",
    script_path=__file__, tables=[eac_table, index_table], charts=[cpi_spi_chart],
    images=[{"file": image_file, "alt": "Line chart of CPI and SPI by month",
             "caption": "Cost and schedule performance index by month, FY2025"}],
    notes=notes,
)

if __name__ == "__main__":
    print("evm_forecast: wrote site/python/out/evm-forecast.json")
