# Contributing

This list gets better when founders help each other. PRs welcome.

## Adding a directory

Edit `lib/directories.ts` and add an entry to `rawSaasDirectories` or `rawLaunchSites`:

```ts
{ num: <next number>, name: "Directory Name", url: "https://example.com", da: 45 },
```

### Name conventions

- If the site is **paid**, add `(paid)` or the price in parentheses: `"Startup Stash (paid - $297)"`
- If there's a useful note (wait time, badge required, referral), put it in parens: `"PitchWall (free with 30 day wait)"`
- The text in parentheses becomes a tooltip — keep it under 60 chars

### Fields

| Field | Required | Notes |
|-------|----------|-------|
| `num` | Yes | Next integer in sequence |
| `name` | Yes | Site name, with optional `(note)` |
| `url` | Yes | Direct submission/listing URL if available, else homepage |
| `da` | Yes | Domain Authority from Moz. Use `null` if unknown |

DR is currently set equal to DA. `type` and `dofollow` are inferred automatically — if you know better, you can update `lib/directories.ts` after the `transform()` call for specific entries.

## Updating DA/DR data

DA/DR figures decay. If you spot an outdated number, update it in `lib/directories.ts` and note the source in your PR description.

## What not to add

- Paid-only directories with no SEO value
- Sites with DA < 5 unless they have exceptional traffic
- Affiliate/spam directories
