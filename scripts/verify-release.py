#!/usr/bin/env python3
"""Fail-closed validation for canonical Nextcloud release artifacts."""
from pathlib import Path
from zipfile import ZipFile
import sys
import xml.etree.ElementTree as ET

RUNTIME_ROOTS = {"appinfo", "css", "js", "lib", "LICENSE"}
DENY_PARTS = {".git", ".github", "node_modules", "tests", "test", "docs", "build", "scripts", "vendor", "__pycache__", ".env", ".npmrc"}
DENY_ENDINGS = (".map", ".pem", ".key", ".p12", ".pfx", ".env", ".log", ".ts", ".tsx")

def verify(path: Path, root: str, runtime: bool) -> None:
    with ZipFile(path) as z:
        bad = z.testzip()
        if bad:
            raise ValueError(f"Damaged ZIP member: {bad}")
        members = [i for i in z.infolist() if not i.is_dir()]
        names = [i.filename for i in members]
        if not members or len(names) != len(set(names)):
            raise ValueError("Empty ZIP or duplicate paths")
        for item in members:
            name = item.filename
            parts = Path(name).parts
            if not parts or parts[0] != root or any(x in ("", ".", "..") for x in parts):
                raise ValueError(f"Invalid archive path: {name}")
            if item.external_attr >> 16 & 0o170000 == 0o120000:
                raise ValueError(f"Symbolic link forbidden: {name}")
            if runtime:
                if len(parts) < 2 or parts[1] not in RUNTIME_ROOTS:
                    raise ValueError(f"Non-runtime content: {name}")
                if any(x in DENY_PARTS or x.startswith(".env") for x in parts[1:]) or name.endswith(DENY_ENDINGS):
                    raise ValueError(f"Forbidden runtime content: {name}")
        info_name = root + "/appinfo/info.xml" if runtime else root + "/src/appinfo/info.xml"
        if info_name not in names:
            raise ValueError("Missing appinfo/info.xml")
        info = ET.fromstring(z.read(info_name))
        if info.findtext("id") != app_id or info.findtext("version") != version:
            raise ValueError("App ID/version mismatch")
        nc = info.find("dependencies/nextcloud")
        if nc is None or nc.get("min-version") != "35" or nc.get("max-version") != "35":
            raise ValueError("Unsupported or undeclared Nextcloud compatibility")
        if not runtime:
            docnames = {n[len(root)+1:] for n in names if n.startswith(root + "/docs/")}
            wanted = {f"docs/{lang}/{topic}.md" for lang in ("cz", "en") for topic in ('README', 'INSTALLATION', 'DEVELOPMENT', 'API', 'TROUBLESHOOTING', 'CORE_REFERENCE', 'SERVICES', 'BACKGROUND_JOBS', 'CONCURRENCY')}
            if docnames != wanted:
                raise ValueError(f"Public docs mismatch: missing={sorted(wanted-docnames)}, extras={sorted(docnames-wanted)}")
            for topic in ('README', 'INSTALLATION', 'DEVELOPMENT', 'API', 'TROUBLESHOOTING', 'CORE_REFERENCE', 'SERVICES', 'BACKGROUND_JOBS', 'CONCURRENCY'):
                for lang, other in (("cz", "en"), ("en", "cz")):
                    data = z.read(f"{root}/docs/{lang}/{topic}.md").decode("utf-8")
                    if f"../{other}/{topic}.md" not in data:
                        raise ValueError(f"Missing translation link: docs/{lang}/{topic}.md")
            forbidden = ("/volume1/", "publisher-tests", "PRVNI_INSTALACE_APPSTORE", "FIRST_APPSTORE_INSTALL", "NAS_NC35", "QUALIFICATION_NC35", "UPDATE_CHECK_CZ", "INSTALL_OUTPUT_CZ_EN")
            for doc in docnames:
                data = z.read(f"{root}/{doc}").decode("utf-8")
                if any(fragment.casefold() in data.casefold() for fragment in forbidden):
                    raise ValueError(f"Internal operational information in public doc: {doc}")
        if runtime and not any(n.startswith(root + "/lib/") for n in names):
            raise ValueError("Missing PHP runtime")
        print(f"PASS: {path.name}, {len(members)} files")

if __name__ == "__main__":
    if len(sys.argv) != 5:
        raise SystemExit("Usage: verify-release.py RUNTIME_ZIP SOURCE_ZIP APP_ID VERSION")
    runtime_zip, source_zip, app_id, version = sys.argv[1:]
    verify(Path(runtime_zip), app_id, True)
    verify(Path(source_zip), f"hc-shared-app-core-{version}", False)
