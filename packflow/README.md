# PackFlow

Driver prototype for placing packages in a delivery van and finding the next one by zone, shelf, and slot.

Without Supabase env vars, the Fredericton route runs entirely in the browser. With `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, the same screens read and update Supabase. See [SUPABASE.md](SUPABASE.md).

Snowflake is an optional analytics layer for scan, plan, retrieve, and delivery events. It does not replace Supabase. See [SNOWFLAKE.md](SNOWFLAKE.md).

## Run

```bash
npm install
npm run dev
```

Open the URL Vite prints.

- `/` — driver dashboard
- `/scan` — scan packages into a load session
- `/loading-plan` — generate zone, shelf, and slot assignments
- `/locator` — search a tracking number or address
- `/labels` — CODE128 package labels
- `/analytics` — route analytics from Snowflake events
