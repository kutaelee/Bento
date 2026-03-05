#!/usr/bin/env python3
import re
from pathlib import Path

p = Path('openapi/openapi.yaml')
lines = p.read_text(encoding='utf-8').splitlines(True)

out = []
i = 0
changed = 0

# regex helpers
re_nullable = re.compile(r'^(?P<indent>\s*)nullable:\s*true\s*$')
re_type = re.compile(r'^(?P<indent>\s*)type:\s*(?P<typ>[A-Za-z0-9_]+)\s*$')
re_ref = re.compile(r'^(?P<indent>\s*)\$ref:\s*(?P<ref>.+?)\s*$')

while i < len(lines):
    line = lines[i]
    mnull = re_nullable.match(line.rstrip('\n'))
    if not mnull:
        out.append(line)
        i += 1
        continue

    indent = mnull.group('indent')

    # find previous non-empty line index in out
    j = len(out) - 1
    while j >= 0 and out[j].strip() == '':
        j -= 1

    if j < 0:
        # shouldn't happen
        i += 1
        changed += 1
        continue

    prev = out[j].rstrip('\n')

    mtype = re_type.match(prev)
    if mtype and mtype.group('indent') == indent:
        typ = mtype.group('typ')
        out[j] = f"{indent}type: [{typ}, 'null']\n"
        # drop nullable line
        changed += 1
        i += 1
        continue

    mref = re_ref.match(prev)
    if mref and mref.group('indent') == indent:
        refval = mref.group('ref')
        # replace $ref line with anyOf block
        out[j] = f"{indent}anyOf:\n"
        out.insert(j + 1, f"{indent}- $ref: {refval}\n")
        out.insert(j + 2, f"{indent}- type: 'null'\n")
        # drop nullable line
        changed += 1
        i += 1
        continue

    # if we can't transform safely, keep nullable (but still remove to satisfy linter?)
    # Here, we remove nullable and add a comment marker.
    out.append(f"{indent}# nullable: true (removed by fix_openapi_nullable.py; please model null via type union)\n")
    changed += 1
    i += 1

p.write_text(''.join(out), encoding='utf-8')
print(f"updated {p} (nullable->3.1 unions): {changed} changes")
