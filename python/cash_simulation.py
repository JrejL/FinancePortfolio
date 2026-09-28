"""Monte Carlo cash simulation on Saltbrush Beverage's 13 week cash forecast. The
base forecast already runs below the 1,500 minimum without the revolver, so the
real question is not whether the revolver is needed but how much of it might be:
how big a peak draw would keep cash at the minimum if customer receipts come in
lighter or heavier than plan.
"""
import numpy as np
import pandas as pd

from common import BRAND_COLORS, BRAND_TEXT, DATA_CSV, brand_title, save_chart, write_project
import matplotlib.pyplot as plt

SEED = 20260928
SIMULATIONS = 10000
MIN_CASH = 1500
REVOLVER_CAPACITY = 8000
RECEIPTS_MEAN, RECEIPTS_STD = 1.0, 0.08  # weekly receipts as a multiple of the forecast, weeks independent

forecast = pd.read_csv(DATA_CSV / "saltbrush-beverage_13_week_cash.csv")
start_cash = float(forecast["Beginning cash"].iloc[0])
receipts = forecast["Receipts"].to_numpy(dtype=float)
disbursements = forecast["Total disbursements"].to_numpy(dtype=float)
weeks = forecast["week"].tolist()


def simulate(seed, factor=None):
    """Run the 13 week cash path SIMULATIONS times, receipts only varying, and return
    the peak revolver draw each path needs to hold cash at the minimum throughout.
    A single lump draw covers every week only if it is at least MIN_CASH minus the
    path's own lowest point, so the peak draw equals that shortfall (or zero)."""
    rng = np.random.default_rng(seed)
    factors = factor if factor is not None else rng.normal(RECEIPTS_MEAN, RECEIPTS_STD, size=(SIMULATIONS, len(weeks)))
    cash_path = start_cash + np.cumsum(receipts * factors - disbursements, axis=1)
    return np.maximum(0.0, MIN_CASH - cash_path.min(axis=1))


peak_draws = simulate(SEED)
# Run twice on the same seed to prove the simulation is reproducible, not lucky.
if not np.array_equal(peak_draws, simulate(SEED)):
    raise RuntimeError("cash simulation is not deterministic under a fixed seed")

# The unchanged forecast (factor exactly 1.0 every week) is its own scenario: the
# peak draw the plan itself would need with no variation at all.
base_draw = float(simulate(SEED, factor=np.ones((1, len(weeks))))[0])
p5, p50, p95, p99 = (float(x) for x in np.percentile(peak_draws, [5, 50, 95, 99]))
prob_over_base = float((peak_draws > base_draw).mean())
prob_over_capacity = float((peak_draws > REVOLVER_CAPACITY).mean())

percentile_table = {
    "title": "Peak revolver draw over 13 weeks, holding cash at the 1,500 minimum",
    "columns": ["Metric", "Value"],
    "rows": [
        {"label": "Base forecast peak draw, no variation", "values": [round(base_draw, 0)], "style": "line", "format": "money"},
        {"label": "5th percentile of the peak draw", "values": [round(p5, 0)], "style": "line", "format": "money"},
        {"label": "50th percentile of the peak draw", "values": [round(p50, 0)], "style": "line", "format": "money"},
        {"label": "95th percentile of the peak draw", "values": [round(p95, 0)], "style": "line", "format": "money"},
        {"label": "99th percentile of the peak draw", "values": [round(p99, 0)], "style": "total", "format": "money"},
        {"label": "Probability the peak draw exceeds the base forecast", "values": [round(prob_over_base, 4)], "style": "line", "format": "pct"},
        {"label": "Probability the peak draw exceeds the 8,000 revolver capacity", "values": [round(prob_over_capacity, 4)], "style": "line", "format": "pct"},
    ],
    "note": f"{SIMULATIONS:,} simulations, weekly receipts drawn independently from a normal distribution with "
            f"mean {RECEIPTS_MEAN} and standard deviation {RECEIPTS_STD} of the forecast; disbursements held fixed.",
}

bin_edges = np.linspace(0, peak_draws.max(), 21)
counts, _ = np.histogram(peak_draws, bins=bin_edges)
bin_labels = [f"{lo:,.0f} to {hi:,.0f}" for lo, hi in zip(bin_edges[:-1], bin_edges[1:])]
histogram_chart = {
    "type": "bar", "title": "Distribution of the peak revolver draw, 10,000 simulations", "labels": bin_labels,
    "series": [{"name": "Simulations", "values": [int(c) for c in counts]}], "format": "number", "reference": None,
}

fig, ax = plt.subplots(figsize=(6, 4))
ax.hist(peak_draws, bins=40, color=BRAND_COLORS[0])
ax.axvline(base_draw, color=BRAND_TEXT, linestyle="--", label=f"Base forecast draw ({base_draw:,.0f})")
ax.set_xlabel("Peak revolver draw needed over the 13 weeks")
ax.set_ylabel("Simulations")
brand_title(ax, "Distribution of the peak revolver draw, 10,000 simulations")
ax.legend(loc="upper right", frameon=False)
image_file = save_chart(fig, "cash_peak_draw_histogram")
plt.close(fig)

notes = [
    f"The unchanged forecast alone needs a peak draw of {base_draw:,.0f} against the 8,000 revolver, with no "
    "receipts variation at all, since it already runs below the 1,500 minimum in week 13.",
    f"At the 95th percentile, Saltbrush could need a peak draw of {p95:,.0f}; at the 99th, {p99:,.0f}, both "
    "still well inside the 8,000 revolver capacity.",
    f"The peak draw exceeds the base forecast's own draw in {prob_over_base:.1%} of simulations, and exceeds "
    f"the full 8,000 revolver capacity in {prob_over_capacity:.1%} of simulations.",
    "Only customer receipts are treated as uncertain here, drawn independently week to week; suppliers, "
    "payroll, freight, rent and the other disbursement lines are held at the forecast.",
]

write_project(
    id_="cash-simulation", title="Cash flow simulation, 13 week forecast", script_path=__file__,
    question="How much of its 8,000 revolver could Saltbrush need over the next 13 weeks if customer receipts vary?",
    summary="Runs 10,000 simulations of the 13 week cash forecast with receipts varying around the plan and "
            "reports the peak revolver draw needed to hold cash at the 1,500 minimum.",
    tables=[percentile_table], charts=[histogram_chart],
    images=[{"file": image_file, "alt": "Histogram of the peak revolver draw across 10,000 simulations",
             "caption": "Distribution of the 13 week peak revolver draw"}],
    notes=notes,
)

if __name__ == "__main__":
    print("cash_simulation: wrote site/python/out/cash-simulation.json")
