#!/usr/bin/env python3
"""Why the Stop hook blocked in each cell of one arm: `python3 harness/stop-blocks.py <results dir> <arm> [--cells]`.

Prints the blocks by reason, then the audit findings the blocks carried, counted
once per cell (a warning repeated on a second stop counts once). --cells also
prints each cell's findings.
"""
import collections, glob, json, re, sys
d, arm = sys.argv[1:3]
show_cells = '--cells' in sys.argv[3:]
reasons = collections.Counter(); findings = collections.Counter(); cells = 0
FORCE = re.compile(r'^- (\w+\.\w+) force write:')
POLICY = re.compile(r'^- (?:[A-Z]+ \S+: )?(\w+\.\w+) \(.*neither the middleware chain')
for f in sorted(glob.glob(f'{d}/*/{arm}-claude-*.stream.jsonl')):
    cells += 1
    seen = set()
    for line in open(f):
        e = json.loads(line)
        if e.get('subtype') == 'hook_response' and e.get('hook_event') == 'Stop' and e.get('exit_code') == 2:
            out = e.get('output') or ''
            kinds = [k for k, needle in (('store force write (old app)', 'PostController.store force write'), ('missing authorization', 'neither the middleware chain'), ('gate failure', 'guren gate:')) if needle in out]
            if out.count(' force write:') > out.count('PostController.store force write'):
                kinds.append('force write (other)')
            reasons[' + '.join(kinds) or 'other'] += 1
            for l in out.splitlines():
                if m := FORCE.match(l):
                    seen.add('force write: ' + m.group(1))
                elif m := POLICY.match(l):
                    seen.add('missing authorization: ' + m.group(1))
    findings.update(seen)
    if show_cells:
        print(f"  {f.split('/')[-2]}/{f.split('/')[-1][:-len('.stream.jsonl')]}: {sorted(seen) or '-'}")
print(f'{arm}: {cells} cells, Stop blocks by reason: {dict(reasons)}')
print('findings carried (cells):', dict(findings.most_common()))
