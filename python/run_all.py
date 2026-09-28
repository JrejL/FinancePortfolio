"""Runs the four analysis scripts and combines their output into
site/data/python.json, the file the website reads."""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PYTHON_DIR = ROOT / "site" / "python"
OUT = PYTHON_DIR / "out"

SCRIPTS = ["ratio_analyzer.py", "variance_flags.py", "cash_simulation.py", "evm_forecast.py"]
ORDER = ["ratio-analysis", "variance-flags", "cash-simulation", "evm-forecast"]

for script in SCRIPTS:
    print(f"running {script}")
    subprocess.run([sys.executable, script], cwd=PYTHON_DIR, check=True)

projects = [json.loads((OUT / f"{pid}.json").read_text()) for pid in ORDER]
data_path = ROOT / "site" / "data" / "python.json"
data_path.write_text(json.dumps({"projects": projects}, indent=2))
print(f"run_all: wrote {data_path.relative_to(ROOT)} with {len(projects)} projects")
