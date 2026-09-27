# PackFlow on Supabase

The browser talks to Supabase with `@supabase/supabase-js` and the publishable key. There is no service-role key in the app.

When `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are set, PackFlow loads packages from Supabase. Otherwise it stays on the local Fredericton demo. A sidebar control switches between Supabase and Local demo when the env vars are present. `VITE_SUPABASE_ANON_KEY` is accepted as an older name for the publishable key.

Package rows use a UUID `id`. The stable lookup key is `tracking_number` (`PF` plus 12 digits). Local demo rows keep ids like `pkg-01`.

## Dashboard steps

1. Create a Supabase project.
2. Open **SQL Editor**. Paste `supabase/schema.sql` and run it. That creates `packages`, `delivery_stops`, and `delivery_events`, enables row level security, and adds demo policies so the publishable key can read and update packages and stops, and can read and insert delivery events.
3. Paste `supabase/seed.sql` and run it. That inserts the 30 Fredericton packages and 20 stops. Running it again does not duplicate `tracking_number` or `stop_number`.
4. Open **Project Settings → API**. Copy the project URL and the publishable (anon) key into a gitignored `.env` file. Do not copy the service role secret.

```bash
# packflow/.env  (not committed)
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

5. Restart `npm run dev`. The sidebar should show **Supabase**. The dashboard lists the seeded packages.
6. Scan a label, generate the loading plan, and mark a package delivered. Zone, shelf, and slot are saved with the existing loading algorithm. Delivered status writes a row in `delivery_events`.

## Deploy

Set the same two `VITE_` variables in the host before the production build. Vite bakes them into the browser bundle. They are the public project URL and publishable key, not a service-role secret.

Leave both variables empty to ship the on-device demo with no database.
