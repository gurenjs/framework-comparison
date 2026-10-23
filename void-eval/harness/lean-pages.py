#!/usr/bin/env python3
"""Make a Guren app's page layer as lean as the Void app's: strip styling and comments.

Usage: python3 harness/lean-pages.py <app dir>

Rewrites resources/js/**/*.ts(x) in place: drops every `className` attribute,
the constants that only fed one, and whole-line comments (`//`, `/* */`,
`{/* */}`). Pragmas (`@jsxImportSource`, `@vite-ignore`, `eslint-`/`oxlint-`
directives) and triple-slash references stay. Props, visible text and form
field names are untouched, so the suite (Inertia props and HTTP statuses)
reads the same app. Deterministic: lean(app + reference) - lean(app) gives the
lean reference patch.
"""
import os
import re
import sys

KEEP = re.compile(r'@jsxImportSource|@vite-ignore|eslint-|oxlint-|@ts-|^\s*///')
CLASS_ATTR = re.compile(r'\s+className=(?:"[^"]*"|\'[^\']*\'|\{`[^`]*`\}|\{[^{}]*\})')


def strip_comments(src):
    out, lines, i = [], src.split('\n'), 0
    while i < len(lines):
        line = lines[i]
        s = line.strip()
        if KEEP.search(line):
            out.append(line)
        elif s.startswith('//'):
            pass
        elif s.startswith('{/*') and s.endswith('*/}'):
            pass
        elif s.startswith('/*') or s.startswith('{/*'):
            j = i
            while j < len(lines) and '*/' not in lines[j]:
                j += 1
            block = '\n'.join(lines[i:j + 1])
            if KEEP.search(block):
                out.extend(lines[i:j + 1])
            i = j
        else:
            out.append(line)
        i += 1
    return '\n'.join(out)


def drop_unused_class_consts(src):
    for name in re.findall(r'^const (\w+) =\s*(?:\n\s*)?[\'"`]', src, re.M):
        if len(re.findall(r'\b%s\b' % re.escape(name), src)) == 1:
            src = re.sub(r'^const %s =\s*(?:\n\s*)?([\'"`]).*?\1\n' % re.escape(name), '', src, count=1, flags=re.M | re.S)
    return src


def lean(src):
    src = strip_comments(src)
    src = CLASS_ATTR.sub('', src)
    src = drop_unused_class_consts(src)
    src = re.sub(r'\n{3,}', '\n\n', src)
    return src.lstrip('\n')


def main(app):
    root = os.path.join(app, 'resources', 'js')
    for dirpath, _, files in os.walk(root):
        for f in files:
            if f.endswith(('.ts', '.tsx')) and not f.endswith('.d.ts'):
                p = os.path.join(dirpath, f)
                src = open(p).read()
                new = lean(src)
                if new != src:
                    open(p, 'w').write(new)


if __name__ == '__main__':
    main(sys.argv[1])
