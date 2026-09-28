"""Shared plumbing for the four analysis scripts: paths, the house chart
style, chart saving and the output writer. Not part of the code shown on the
website; only the four analysis scripts are displayed there.
"""
import json
import logging
import re
import zipfile
from datetime import datetime, timezone
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

# Poppins and Lora are the house web fonts; matplotlib falls back to Arial or
# Georgia when they are not installed as system fonts. Quiet, not an error.
logging.getLogger("matplotlib.font_manager").setLevel(logging.ERROR)

ROOT = Path(__file__).resolve().parents[2]
DATA_CSV = ROOT / "site" / "public" / "python" / "data"
DATA_JSON = ROOT / "site" / "data"
OUT = ROOT / "site" / "python" / "out"

# House chart style: series colors in order, text and gridline colors, and
# the house fonts (body serif for labels, display sans for titles).
BRAND_COLORS = ["#d97757", "#6a9bcc", "#788c5d"]
BRAND_TEXT = "#141413"
BRAND_GRID = "#e8e6dc"
BRAND_BG = "#faf9f5"
BRAND_BODY_FONT = ["Lora", "Georgia", "serif"]
BRAND_TITLE_FONT = ["Poppins", "Arial", "sans-serif"]

plt.rcParams.update({
    "font.family": "serif", "font.serif": BRAND_BODY_FONT,
    "text.color": BRAND_TEXT, "axes.labelcolor": BRAND_TEXT, "axes.edgecolor": BRAND_TEXT,
    "xtick.color": BRAND_TEXT, "ytick.color": BRAND_TEXT,
    "axes.facecolor": BRAND_BG, "figure.facecolor": BRAND_BG, "savefig.facecolor": BRAND_BG,
    "grid.color": BRAND_GRID, "grid.linewidth": 0.6, "axes.grid": True,
    "axes.spines.top": False, "axes.spines.right": False,
    "axes.prop_cycle": plt.cycler(color=BRAND_COLORS),
})


def brand_title(ax, text):
    """Set a chart title in the house title font."""
    ax.set_title(text, fontfamily=BRAND_TITLE_FONT, color=BRAND_TEXT)


def read_statement(slug, statement):
    """Load one statement CSV, indexed by line item, for one company."""
    import pandas as pd
    df = pd.read_csv(DATA_CSV / f"{slug}_{statement}.csv")
    return df.set_index("line_item")


def read_case(slug):
    """Load one company's case data file (site/data/<slug>.json)."""
    with open(DATA_JSON / f"{slug}.json") as f:
        return json.load(f)


def save_chart(fig, name, dpi=110):
    """Save a matplotlib figure as SVG in the out folder and return its file name."""
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f"{name}.svg"
    fig.savefig(path, format="svg", bbox_inches="tight", dpi=dpi)
    return path.name


_MODIFIED_RE = re.compile(rb'(<dcterms:modified xsi:type="dcterms:W3CDTF">)[^<]*(</dcterms:modified>)')


def stabilize_xlsx(path):
    """Fix an openpyxl workbook's document properties and every zip entry's
    timestamp so the same data produces the same bytes on every rerun.
    openpyxl restamps "modified" to the current time on every save, ignoring
    a value set beforehand, so this reopens, fixes it, and rewrites the zip.
    """
    from openpyxl import load_workbook
    fixed = datetime(2026, 1, 1, tzinfo=timezone.utc)
    book = load_workbook(path)
    book.properties.created = book.properties.modified = fixed
    book.save(path)
    fixed_iso = fixed.strftime("%Y-%m-%dT%H:%M:%SZ").encode()
    with zipfile.ZipFile(path) as src:
        entries = [(i.filename, i.compress_type, src.read(i.filename)) for i in src.infolist()]
    entries = [(name, ct, _MODIFIED_RE.sub(rb"\g<1>" + fixed_iso + rb"\g<2>", data) if name == "docProps/core.xml" else data)
               for name, ct, data in entries]
    with zipfile.ZipFile(path, "w") as dst:
        for name, compress_type, data in entries:
            info = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
            info.compress_type = compress_type
            dst.writestr(info, data)


def write_project(id_, title, question, summary, script_path, tables,
                   images, notes, files=None, charts=None, units="thousands"):
    """Assemble one project entry and write it to site/python/out/<id>.json.
    units defaults to thousands, matching the case files; pass the real
    units when a project's dollar figures are on a different scale.
    """
    code = Path(script_path).read_text()
    project = {
        "id": id_,
        "title": title,
        "question": question,
        "summary": summary,
        "script": Path(script_path).name,
        "code": code,
        "units": units,
        "tables": tables,
        "charts": charts or [],
        "images": images,
        "notes": notes,
        "files": files or [],
    }
    OUT.mkdir(parents=True, exist_ok=True)
    with open(OUT / f"{id_}.json", "w") as f:
        json.dump(project, f, indent=2)
    return project
