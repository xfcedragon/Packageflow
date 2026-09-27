# PackFlow

PackFlow helps a loader place packages in a delivery van, then helps the driver find the next package by **zone · shelf · slot**.

Live demo: **[https://packflow-eta.vercel.app](https://packflow-eta.vercel.app)**

Without backend env vars, a 30-package Fredericton route runs entirely in the browser.

## Features

- **Scan Packages** — scan barcodes or **Load Demo Packages** (30 pending)
- **Loading Plan** — assign zone, shelf, and slot from stop order, weight, and fragile flags
- **Dashboard** — totals, remaining, delivered, next package
- **Package Locator** — search by tracking number or address; van map highlight
- **Package Labels** — CODE128 labels for the demo set
- **Route Analytics** — optional Snowflake event history
- **Phone-friendly** nav and layouts

## Demo flow

1. Open **Scan Packages** → **Load Demo Packages**
2. **Generate Loading Plan**
3. **Dashboard** shows Total 30, Remaining 30, Delivered 0
4. Mark packages delivered on Dashboard or Package Locator
5. **Load Demo Packages** again resets to 30 remaining / 0 delivered (does not delete Snowflake history)

## Stack

| Layer | Tech |
|-------|------|
| UI | React, TypeScript, Vite |
| Hosting | Vercel |
| Primary DB (optional) | Supabase |
| Analytics (optional) | Snowflake |

## Run locally

```bash
cd packflow
npm install
npm run dev
```

Open the URL Vite prints (default port **5173**).

```bash
npm run build
npm run preview
```

## Environment variables

Copy `.env.example` to `.env` as needed. **Names only — never commit secrets.**

### Browser (Vite)

| Name | Purpose |
|------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable (anon) key |
| `VITE_SUPABASE_ANON_KEY` | Older alias for the publishable key |
| `VITE_API_BASE_URL` | Optional API origin for `/api/*` calls |

Leave the Supabase `VITE_` vars empty to use the on-device mock demo.

### Server / Vercel API (optional)

| Name | Purpose |
|------|---------|
| `SUPABASE_URL` | Server-side Supabase URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server only — never `VITE_`) |
| `SNOWFLAKE_ACCOUNT` | Snowflake account |
| `SNOWFLAKE_USER` | Snowflake user |
| `SNOWFLAKE_PRIVATE_KEY` | Key-pair auth private key |
| `SNOWFLAKE_PRIVATE_KEY_PASSPHRASE` | Private key passphrase (if encrypted) |
| `SNOWFLAKE_WAREHOUSE` | Warehouse |
| `SNOWFLAKE_DATABASE` | Database |
| `SNOWFLAKE_SCHEMA` | Schema |
| `SNOWFLAKE_ROLE` | Role |

More detail: [SUPABASE.md](SUPABASE.md), [SNOWFLAKE.md](SNOWFLAKE.md).

## Screens

| Path | Screen |
|------|--------|
| `/` | Dashboard |
| `/scan` | Scan Packages |
| `/loading-plan` | Loading Plan |
| `/locator` | Package Locator |
| `/labels` | Package Labels |
| `/analytics` | Route Analytics |

## Deploy

Vercel project root should be `packflow/`. Set the same env vars in the Vercel project for production builds.
