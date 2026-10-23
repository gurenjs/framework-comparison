"""Shared readers for the cell event streams (summarize.py, analyze.py)."""
import json
import re

# One definition of "ran a typecheck / tests / Guren's verification CLI".
TYPECHECK = re.compile(r'\btsc\b|\btypecheck\b|\bvoid prepare\b|\btsgo\b')
TESTS = re.compile(r'\bbun test\b|\bvitest\b|\bvp test\b')
GATE = re.compile(r'\bguren (check|gate|audit|doctor)\b')


def events(path):
    """The stream's JSON events; lines that are not JSON are skipped."""
    for line in open(path):
        try:
            yield json.loads(line)
        except json.JSONDecodeError:
            continue


def tool_uses(e):
    if e.get('type') != 'assistant':
        return []
    return [c for c in (e.get('message') or {}).get('content') or [] if isinstance(c, dict) and c.get('type') == 'tool_use']


def total_input(usage):
    """Input tokens of a model call or a session: uncached + cache write + cache read."""
    return usage.get('input_tokens', 0) + usage.get('cache_creation_input_tokens', 0) + usage.get('cache_read_input_tokens', 0)
