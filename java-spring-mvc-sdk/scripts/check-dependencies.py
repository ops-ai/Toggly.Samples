#!/usr/bin/env python3
"""Verify the resolved dependency graph and bytes, including test dependencies.

Maven pins versions in the POM but has no native lock file. This inventory makes
transitive drift reviewable. Run --write only after deliberately reviewing a
package update; ordinary CI may only compare. Build-plugin versions live in pom.xml.
"""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

root = Path(__file__).resolve().parent.parent
classpath = root / "target" / "locked-classpath.txt"
subprocess.run(["mvn", "-B", "-q", "dependency:build-classpath", "-Dmdep.includeScope=test",
                f"-Dmdep.outputFile={classpath}"], cwd=root, check=True)
resolved = {}
for entry in classpath.read_text().strip().split(os.pathsep):
    jar = Path(entry)
    # Maven layout yields artifact/version/file without recording machine-specific absolute paths.
    relative = str(jar).split("/repository/", 1)
    if len(relative) != 2:
        raise SystemExit(f"Expected standard Maven repository layout for {jar.name}")
    resolved[relative[1]] = hashlib.sha256(jar.read_bytes()).hexdigest()
lock = root / "dependencies.lock.json"
if sys.argv[1:] == ["--write"]:
    lock.write_text(json.dumps(dict(sorted(resolved.items())), indent=2) + "\n")
elif sys.argv[1:]:
    raise SystemExit("Usage: check-dependencies.py [--write]")
elif json.loads(lock.read_text()) != resolved:
    raise SystemExit("Dependency graph/bytes changed. Review the update before regenerating dependencies.lock.json.")
print(f"Verified {len(resolved)} dependency artifacts")
