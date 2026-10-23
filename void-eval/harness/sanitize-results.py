#!/usr/bin/env python3
"""Strip machine- and session-specific data from saved results before publishing.

Usage: python3 harness/sanitize-results.py <file>...   (rewrites in place; idempotent)

- *.result.json keeps the fields the analysis reads (turns, durations, stop reason,
  cost, token usage, the final message) and drops session ids, request timings and
  permission-denial payloads (only their count stays).
- *.meta.json drops the session's skill and slash-command lists and memory paths,
  and makes the overlay path repo-relative.
- Every text file has local absolute paths replaced: the cell worktrees become
  $WT_ROOT/, this checkout becomes a repo-relative path, a sibling checkout ../<name>.
"""
import json, re, sys

PATHS = [
    (re.compile(r'(?:/private)?/tmp/ve-worktrees/'), '$WT_ROOT/'),
    (re.compile(r'(?:/private)?/tmp/suite-validate[\w-]*/'), '$LOGDIR/'),
    (re.compile(r'/Users/[^/\s"\']+/Development/framework-comparison[\w-]*/'), ''),
    (re.compile(r'/Users/[^/\s"\']+/Development/([\w.-]+)'), r'../\1'),
    (re.compile(r'~/Development/framework-comparison[\w-]*/'), ''),
    (re.compile(r'~/Development/([\w.-]+)'), r'../\1'),
    (re.compile(r'/private/tmp/claude-\d+/[^\s"\']*'), '$TMPDIR/…'),
    (re.compile(r'/(?:private/)?var/folders/[^\s"\']*'), '$TMPDIR/…'),
    (re.compile(r'/Users/[^/\s"\']+'), '$HOME'),
]
RESULT_KEEP = ('type', 'subtype', 'is_error', 'num_turns', 'duration_ms', 'duration_api_ms', 'stop_reason',
               'terminal_reason', 'total_cost_usd', 'usage', 'modelUsage', 'result')
USAGE_KEEP = ('input_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens', 'output_tokens',
              'output_tokens_details', 'cache_creation', 'service_tier')
MODEL_USAGE_KEEP = ('inputTokens', 'outputTokens', 'cacheReadInputTokens', 'cacheCreationInputTokens', 'costUSD')
META_DROP = ('skills', 'slash_commands', 'memory_paths')


def mask(text):
    for pat, rep in PATHS:
        text = pat.sub(rep, text)
    return text


def sanitize(path):
    src = open(path, encoding='utf-8', errors='surrogateescape').read()
    out = src
    if path.endswith('.result.json') and src.strip():
        r = json.loads(src)
        clean = {k: r[k] for k in RESULT_KEEP if k in r}
        if isinstance(clean.get('usage'), dict):
            clean['usage'] = {k: v for k, v in clean['usage'].items() if k in USAGE_KEEP}
        if isinstance(clean.get('modelUsage'), dict):
            clean['modelUsage'] = {m: {k: v for k, v in u.items() if k in MODEL_USAGE_KEEP} for m, u in clean['modelUsage'].items()}
        if 'permission_denials' in r:
            clean['permission_denials_count'] = len(r['permission_denials'] or [])
        out = json.dumps(clean, ensure_ascii=False) + '\n'
    elif path.endswith('.meta.json') and src.strip():
        m = json.loads(src)
        for k in META_DROP:
            m.pop(k, None)
        out = json.dumps(m) + '\n'
    out = mask(out)
    if out != src:
        open(path, 'w', encoding='utf-8', errors='surrogateescape').write(out)
        return True
    return False


if __name__ == '__main__':
    changed = sum(sanitize(p) for p in sys.argv[1:])
    print(f'{changed} of {len(sys.argv) - 1} files changed')
