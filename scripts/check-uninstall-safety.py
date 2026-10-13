#!/usr/bin/env python3
"""Conservative static guard: dev uninstall.sh must never delete database or app files."""
from pathlib import Path
import re
src = (Path(__file__).resolve().parents[1] / "uninstall.sh").read_text()
required = ("occ app:disable", "Application files and configuration were preserved")
for needle in required:
    if needle not in src:
        raise SystemExit(f"FAIL: uninstall contract changed: missing {needle}")
for pattern in (r"\bDROP\s+TABLE\b", r"\bTRUNCATE\s+TABLE\b", r"\bDELETE\s+FROM\b", r"\bapp:remove\b", r"\brm\s+-[a-zA-Z]*r[a-zA-Z]*f\b"):
    if re.search(pattern, src, re.IGNORECASE):
        raise SystemExit(f"FAIL: forbidden destructive operation: {pattern}")
print("PASS: dev uninstaller disables Core and contains no explicit DB or application deletion")
print("NOTE: This does not verify App Store uninstall behavior or any Nextcloud internal cleanup hooks")
