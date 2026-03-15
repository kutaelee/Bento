# Backend Performance Diff

- Before: `C:\codex\Bento\artifacts\perf\backend-before.json`
- After: `C:\codex\Bento\artifacts\perf\backend-after-container-fix.json`
- Total saved across benchmarked authenticated GETs: **9.49s** (95.67%)

| Endpoint | Before total | After total | Saved | Before avg | After avg | Improvement |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `/me` | 2.1s | 0.21s | 1.89s | 209.9ms | 20.77ms | 90.1% |
| `/me/preferences` | 1.9s | 0.01s | 1.89s | 189.56ms | 0.89ms | 99.53% |
| `/admin/volumes` | 3.98s | 0.21s | 3.77s | 397.52ms | 20.56ms | 94.83% |
| `/jobs` | 1.95s | 0.01s | 1.94s | 194.55ms | 0.68ms | 99.65% |

