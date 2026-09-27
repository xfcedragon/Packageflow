# PackFlow

Driver loading and package-locator app for a delivery van route.

The app lives in [`packflow/`](packflow/). Live demo: **[https://packflow-eta.vercel.app](https://packflow-eta.vercel.app)**

## What it does

- **Scan / load** packages into a session (or tap **Load Demo Packages**)
- **Generate a loading plan** — zone, shelf, and slot for each box
- **Dashboard** — next stop, remaining vs delivered, route progress
- **Package Locator** — find a package by tracking number or address
- Optional **Supabase** backend and **Snowflake** route analytics

## Quick start

```bash
cd packflow
npm install
npm run dev
```

Open the URL Vite prints (default [http://127.0.0.1:5173](http://127.0.0.1:5173)).

No backend is required for the local Fredericton demo. See [`packflow/README.md`](packflow/README.md) for features, stack, env vars, and optional Supabase / Snowflake setup.
