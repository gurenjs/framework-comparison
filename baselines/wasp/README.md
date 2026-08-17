# Baseline: `wasp/`

Pristine output of the generator, before any of the spec was implemented. The
`Handwritten LOC` metric is the added-line diff of `wasp/` against this tree.

## Exact invocation

```bash
npx @wasp.sh/wasp-cli@0.25.0 new wasp -t minimal
```

Run under Node 24.18.0; `@wasp.sh/wasp-cli@0.25.0` declares `engines.node
>= 24.14.1`. The CLI is invoked through `npx` rather than installed globally so
that the app's `package.json` stays exactly as `wasp new` wrote it — Wasp is not
one of its dependencies either way (see the note on the Direct dependencies
metric in [MEASUREMENT.md](../../MEASUREMENT.md)).

## Why the `minimal` template

`wasp new` offers `basic`, `minimal` and `saas`. SPEC.md requires a minimal,
unstyled UI with no CSS framework, and `basic` ships Tailwind CSS, so the
smallest template that satisfies the spec is `minimal`. This choice was
registered in SPEC.md before the implementation existed.

## What is not here

`node_modules/` and `.wasp/` (the compiler's output directory) are omitted, as
the starter's own `.gitignore` omits them.
