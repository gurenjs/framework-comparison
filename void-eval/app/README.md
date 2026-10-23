# void-blog

The benchmark app for the Void arm of the agent evaluation: the same blog as
`agents-on-guren-app` at 0fd1654 (posts with excerpts, authors, pagination,
search, profile, dashboard), written for Void 1.1.11 by the benchmark
maintainers. Scaffolded with `npx void@1.1.11 init` (Vite+, React, D1,
no deployment target); the AGENTS.md and `.claude/skills/` links are what
`void init` installs.

```sh
pnpm install
pnpm dev         # vp dev
pnpm typecheck   # void prepare && tsc --noEmit
```
