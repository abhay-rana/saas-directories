@AGENTS.md

# saas-directories — CLAUDE.md

Public community site at `marketing.abhayrana.com`. Next.js 16 SSG (`output: 'export'`), Tailwind, deployed on Vercel.

## Project purpose

A filterable, searchable list of 300+ SaaS directories and launch sites for indie hackers and SaaS founders. Visitors track their own submission progress via `localStorage` — no backend, no auth.

## File map

| What | File |
|------|------|
| All directory data | `lib/directories.ts` — single source of truth |
| TypeScript types | `lib/types.ts` |
| Interactive table + filters | `components/DirectoriesApp.tsx` |
| Light/dark toggle | `components/ThemeToggle.tsx` |
| Page layout + SEO meta | `app/layout.tsx` |
| Main page (hero, stats, table, how-to) | `app/page.tsx` |
| Global CSS + theme variables | `app/globals.css` |
| Contribution guide | `CONTRIBUTING.md` |

## Data model (`lib/directories.ts`)

Every entry is a `RawEntry`:
```ts
{ num: number, name: string, url: string, da: number | null }
```

- `da` = Moz DA. When only Ahrefs DR is known, use DR as the value.
- `dr` is derived as `dr = da` in the `transform()` function — do not set separately.
- `type` (free/freemium/paid) is inferred from parenthetical keywords in `name` — "expensive", "paid", "$" → paid. Override after `transform()` for specific entries if needed.
- `dofollow` defaults to `true` for all entries.
- Notes in parentheses e.g. `"Startup Stash (expensive backlink)"` are parsed out into a tooltip — keep notes under 60 chars.
- `id` is auto-generated as `${prefix}-${num}` — never set manually.

Two arrays: `rawSaasDirectories` (prefix `saas`, currently 311 entries) and `rawLaunchSites` (prefix `launch`, currently 66 entries).

## Adding entries

Append to the correct raw array in `lib/directories.ts`. Use the next `num` in sequence. Set `da: null` if unknown — community fills in via PR.

## Status (localStorage)

Stored as `dir-status-saas` and `dir-status-launch` in localStorage. Each is a `Record<string, SubmissionStatus>` keyed by entry ID. Status values: `todo | applied | listed | rejected`. UI is a color-coded `<select>` dropdown per row.

## Theme

CSS custom properties in `app/globals.css`. `:root` = light, `[data-theme="dark"]` = dark. Toggle persists to `localStorage("theme")`. All badge colors follow `--badge-{status}-bg` / `--badge-{status}-text` pattern.

## SEO rules

- `app/layout.tsx` owns all meta — title, description, OG, Twitter Card, canonical, robots.
- `app/page.tsx` has semantic `<h1>`, stats bar, and a "How to use" section — keep this content human and useful, not filler.
- Never add `noindex`. Canonical is `https://marketing.abhayrana.com`.

## Build & deploy

```bash
npm run dev       # local dev
npm run build     # SSG export to /out
```

Deployed on Vercel. Push to `main` → auto-deploy. Domain: `marketing.abhayrana.com`.

## What NOT to do

- Do not add a backend, database, or auth.
- Do not use `getServerSideProps` or API routes — this is fully static.
- Do not edit `num` values on existing entries — IDs depend on them.
- Do not reorder entries within a raw array — append only.
- Do not add the High DA Sites tab — only SaaS Directories and Launch Sites tabs exist.
