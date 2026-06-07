# TODO / FIXME index

This file collects `TODO` and `FIXME` occurrences found across the codebase so you can track small tasks in one place.

Entries were collected by scanning the repository for `TODO` and `FIXME` comments. Keep this file updated manually or re-run the search commands below.

## Current items

- `index.html` (approx. line 14)
  - Comment: "TODO: Update og:title to match your application name"
  - Action: Update the `<meta property="og:title" ...>` value to your product/app name (for example: "PhysioOffice") and verify other Open Graph tags.

- `src/hooks/useSubscription.ts` (approx. line 55)
  - Comment: "TODO: implémenter checkout via PocketBase hook ou service externe"
  - Translation: "implement checkout via PocketBase hook or external service"
  - Action: Implement the checkout flow (PocketBase hook or external payment provider integration), or add a cloud function and call it from this hook.

## How to refresh this list locally

From the repository root run one of these to re-scan the workspace:

```bash
# grep (default on macOS)
grep -nR "TODO\|FIXME" -- .

# ripgrep (rg) — faster and ignores common files automatically
rg "TODO|FIXME"
```

If you want surrounding context, add `-C 2` to `grep`:

```bash
grep -nR -C 2 "TODO\|FIXME" -- .
```

## Conventions

- Prefer actionable TODOs: `TODO(<owner>|<area>): short description`.
- When a TODO is completed, remove the comment and delete or archive the entry here with a PR link.

---
Generated on 2026-06-07 by repository scan.
