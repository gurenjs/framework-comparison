| arm | pass | turns (med) | API calls (med) | context at start | context per call (med) | input tokens (med) | cache write (med) | output (med) | cost (med) | cost (total) | cells that wrote tests | reference reads / cell | node_modules reads / cell | PostToolUse blocks |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Guren before | 15/15 | 20 | 12 | 37.0k | 60.5k | 726k | 48k | 8.8k | $0.411 | $6.80 | 4/15 | 0.0 | 1.9 | 32 |
| Guren v2 | 15/15 | 21 | 12 | 36.1k | 50.4k | 637k | 38k | 9.0k | $0.377 | $5.87 | 2/15 | 0.9 | 2.1 | 30 |
| Guren v3 | 15/15 | 22 | 13 | 34.5k | 48.5k | 631k | 37k | 9.1k | $0.358 | $5.88 | 2/15 | 1.0 | 2.1 | 32 |
| Guren v4 | 15/15 | 28 | 17 | 22.5k | 52.3k | 890k | 39k | 9.7k | $0.430 | $6.14 | 1/15 | 1.1 | 2.1 | 28 |
| Void | 15/15 | 19 | 12 | 29.9k | 39.3k | 467k | 23k | 6.9k | $0.254 | $3.85 | 0/15 | 0.0 | 4.5 | 0 |

Per ticket (median cost, turns in run order):

| ticket | Guren before | Guren v2 | Guren v3 | Guren v4 | Void |
|---|---|---|---|---|---|
| post-tags | $0.44 (20, 29, 20) | $0.38 (19, 20, 17) | $0.34 (20, 22, 20) | $0.43 (25, 36, 28) | $0.22 (15, 10, 13) |
| comments-moderation | $0.44 (29, 27, 26) | $0.43 (40, 29, 27) | $0.36 (27, 24, 21) | $0.46 (37, 37, 38) | $0.30 (24, 24, 19) |
| post-revisions | $0.29 (19, 15, 20) | $0.25 (18, 21, 18) | $0.24 (23, 19, 21) | $0.23 (21, 20, 23) | $0.21 (20, 24, 15) |
| json-api-tokens | $0.79 (41, 44, 29) | $0.52 (33, 35, 25) | $0.78 (41, 35, 30) | $0.63 (46, 40, 41) | $0.27 (17, 23, 15) |
| scheduled-publish | $0.28 (10, 9, 13) | $0.28 (26, 12, 15) | $0.32 (19, 35, 9) | $0.27 (12, 17, 13) | $0.25 (24, 14, 19) |
