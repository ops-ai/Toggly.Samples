"""Check direct pins agree with the hash lock and all installed locked versions."""
from importlib.metadata import version
from pathlib import Path
import re
import sys

root = Path(__file__).resolve().parents[1]
pattern = re.compile(r'^([A-Za-z0-9_.-]+)==([^\s;\\]+)', re.MULTILINE)
direct = dict(pattern.findall((root / 'requirements.in').read_text()))
locked = dict(pattern.findall((root / 'requirements.txt').read_text()))
normalize = lambda name: name.lower().replace('_', '-')
locked_normalized = {normalize(name): pin for name, pin in locked.items()}
for name, pin in direct.items():
    assert locked_normalized.get(normalize(name)) == pin, f'Direct pin mismatch: {name}'
for name, pin in locked.items():
    assert version(name) == pin, f'Installed version mismatch: {name}'
assert '.'.join(map(str, sys.version_info[:3])) == (root / '.python-version').read_text().strip()
print(f'LOCK_OK direct={len(direct)} installed={len(locked)} python={sys.version.split()[0]}')
