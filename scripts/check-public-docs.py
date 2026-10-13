#!/usr/bin/env python3
"""Validate translation parity and forbid owner-specific content in public docs."""
from pathlib import Path
from zipfile import ZipFile
import sys
root = Path(__file__).resolve().parents[1]
docs = root / "docs"
topics = {'API', 'INSTALLATION', 'DEVELOPMENT', 'README', 'TROUBLESHOOTING', 'BACKGROUND_JOBS', 'SERVICES', 'CONCURRENCY', 'CORE_REFERENCE'}
expected = {docs / lang / f"{t}.md" for lang in ("cz", "en") for t in topics}
actual = set(docs.rglob("*.md"))
if actual != expected:
    raise SystemExit(f"FAIL: unmatched public docs: missing={sorted(str(p) for p in expected-actual)}; extra={sorted(str(p) for p in actual-expected)}")
for topic in sorted(topics):
    for lang, opposite in (("cz", "en"), ("en", "cz")):
        file = docs / lang / f"{topic}.md"
        content = file.read_text(encoding="utf-8")
        if f"../{opposite}/{topic}.md" not in content:
            raise SystemExit(f"FAIL: missing translation link in {file}")
        for restricted in ("/volume1/", "publisher-tests", "NAS_NC35", "QUALIFICATION_NC35", "PRVNI_INSTALACE_APPSTORE", "FIRST_APPSTORE_INSTALL"):
            if restricted.casefold() in content.casefold():
                raise SystemExit(f"FAIL: owner-only instructions in {file}: {restricted}")
print("PASS: 18 public documents, language links and owner-only content screening")
