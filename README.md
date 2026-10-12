# AgilePulse

A local dashboard for Octopus Agile customers. It pulls your half-hourly smart meter readings and Agile unit rates from the Octopus Energy API, stores them in a SQLite file, and shows what you paid compared with a flat-rate (SVT) tariff.

Without API credentials it uses generated mock data, so you can try the whole UI first.

## Quick start

Needs Node.js 22 or newer.

```bash
npm install          # also runs `prisma generate`
cp .env.example .env # optional; skip it to use mock data
npm run setup        # creates dev.db and runs the first sync
npm run dev          # http://localhost:3000
```

## Connecting your Octopus account

1. In the Octopus dashboard, open **Personal details → API access**. That page shows your API key, electricity MPAN and meter serial number.
2. Put them in `.env` as `OCTOPUS_API_KEY`, `OCTOPUS_MPAN` and `OCTOPUS_METER_SERIAL`.
3. Set `OCTOPUS_TARIFF_CODE` to your Agile tariff code. The last letter is your region, for example `-C` for London.
4. Set `SVT_RATE_PENCE` and `STANDING_CHARGE_PENCE` to the flat tariff you want to compare against.
5. Click **Sync from Octopus** in the app, or run `npm run sync`.

Sync uses live data only when all three credentials are set. Otherwise it uses mock data, and the header shows a **Mock data** badge.

Your API key stays in `.env` on the server side. It is never stored in the database and never sent to the browser.

## What sync does

- Fetches the last 30 days of consumption, plus Agile rates up to the end of tomorrow. Octopus publishes tomorrow's rates at around 4pm.
- Uses HTTP Basic auth (API key as the username, empty password) and follows pagination.
- Retries 429 and 5xx responses and network errors with exponential backoff, and honours `Retry-After`.
- Replaces the synced window in the database inside one transaction, so running it again is safe.
- Rebuilds the `CachedCalculation` table (one row per UK day). The KPI cards read from this table.

## Calculations (`lib/analytics.ts`)

| Metric | Formula |
| --- | --- |
| Agile cost | Σ(kWhₜ × Agile rateₜ) + standing charge × days |
| SVT cost | Σ(kWhₜ × SVT rate) + standing charge × days |
| Net savings | SVT cost − Agile cost (£ and %) |
| Average unit price | (Agile cost − standing charges) ÷ kWh |
| Cheap share | kWh used when the rate was under 10p ÷ total kWh |
| Plunge yield | kWh used when the rate was under 5p (including negative prices), and Σ kWh × (SVT − rate) for those slots |

Notes:

- Days follow UK time (Europe/London), so days around the BST changes are counted correctly.
- Any half-hour that has a reading but no rate is left out of the costs instead of being priced at 0p.
- Run `npm run check` to test these calculations.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run setup` | `prisma db push`, then a first sync |
| `npm run sync` | Sync from the command line (live or mock) |
| `npm run check` | Assertions for the analytics engine |
| `npm run db:push` | Apply `prisma/schema.prisma` to the database |

## Project layout

```
app/page.tsx           dashboard (server component: queries + analytics)
app/actions.ts         syncAction server action
components/            KPI cards, usage chart, price forecast, toolbar, sync button
lib/octopus.ts         Octopus REST client and mock data generators
lib/sync.ts            syncOctopusData: fetch, store, rebuild daily cache
lib/analytics.ts       pure cost, savings and cheapest-window calculations
lib/db.ts              Prisma client (libSQL adapter)
prisma/schema.prisma   AccountConfig, ConsumptionRecord, TariffRate, CachedCalculation
```

## Moving to Postgres

All database access goes through Prisma. To switch:

1. Change `provider` in `prisma/schema.prisma` to `postgresql`.
2. In `lib/db.ts`, replace `PrismaLibSql` with `PrismaPg` from `@prisma/adapter-pg`.
3. Point `DATABASE_URL` at your Postgres database.

## Deployment caveat

The app has no login. `syncAction` can be triggered by anyone who can reach the server, and it calls the Octopus API with your key. Run it locally, or add authentication before you expose it.
