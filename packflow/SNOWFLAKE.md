# Snowflake analytics

Snowflake stores PackFlow events only. Supabase remains the operational database for packages, stops, van locations, and delivery status. The browser never receives Snowflake credentials. There are no `VITE_` Snowflake variables.

If these server variables are missing, scans, plans, the locator, and deliveries keep working. `POST /api/events` skips quietly, and Route Analytics shows that Snowflake is not configured.

## What you configure

Create these in your own Snowflake account, then put the values in the host environment (Vercel project settings, or a gitignored `.env` used only by `vercel dev`). Do not commit them, and do not paste the private key into chat.

| Variable | What it is |
| --- | --- |
| `SNOWFLAKE_ACCOUNT` | Account identifier from the Snowflake URL, without `https://` and without `.snowflakecomputing.com` |
| `SNOWFLAKE_USER` | Key-pair user that can insert and select events |
| `SNOWFLAKE_PRIVATE_KEY` | PKCS#8 PEM private key for that user. Newlines may be written as `\n` |
| `SNOWFLAKE_PRIVATE_KEY_PASSPHRASE` | Optional. Leave unset if the key has no passphrase |
| `SNOWFLAKE_WAREHOUSE` | Warehouse the SQL API uses |
| `SNOWFLAKE_DATABASE` | Database that contains the events table |
| `SNOWFLAKE_SCHEMA` | Schema that contains `PACKFLOW_EVENTS` |
| `SNOWFLAKE_ROLE` | Role granted usage on that warehouse, database, and schema |

`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` stay as they are. They are unrelated to Snowflake.

## 1. Account

Sign in to Snowflake as a user who can create a warehouse, database, role, and user (ACCOUNTADMIN is enough for a prototype).

Copy the account identifier from the browser URL:

`https://<account_identifier>.snowflakecomputing.com`

Example shape, not a real account: `xy12345.ca-central-1.aws`. That string is `SNOWFLAKE_ACCOUNT`. Keep the region in this value. The SQL API host uses the full identifier; the JWT drops the region after the first dot automatically (`XY12345`). An org-account name with no dot, such as `myorg-myaccount`, is left whole and uppercased.

## 2. Warehouse, database, schema, role, and user

Paste the whole file `snowflake/setup.sql` into a worksheet and run it. The first statement is `USE ROLE ACCOUNTADMIN`. Do not run only the `CREATE USER` and `GRANT ROLE` lines.

`CREATE USER ... DEFAULT_ROLE = PACKFLOW_ANALYTICS_ROLE` does not check that the role exists and does not grant it. A later `GRANT ROLE` then fails if the role was never created, or if the worksheet role is not ACCOUNTADMIN. Belonging to ACCOUNTADMIN is not the same as the worksheet's current role. `TYPE = SERVICE` is valid for this user; Snowflake still expects `GRANT ROLE ... TO USER` for a service user.

The script creates these objects. Unquoted names are stored in uppercase, which is what the app sends:

| Object | Name |
| --- | --- |
| Warehouse | `PACKFLOW_WH` |
| Database | `PACKFLOW_ANALYTICS` |
| Schema | `PACKFLOW_ANALYTICS.PUBLIC` |
| Role | `PACKFLOW_ANALYTICS_ROLE` |
| Service user | `PACKFLOW_ANALYTICS_USER` |
| Event table | `PACKFLOW_ANALYTICS.PUBLIC.PACKFLOW_EVENTS` |

`SHOW GRANTS TO USER PACKFLOW_ANALYTICS_USER` at the end should list `PACKFLOW_ANALYTICS_ROLE`. The `RSA_PUBLIC_KEY` line in that file stays commented until you generate your own key.

Then set:

- `SNOWFLAKE_WAREHOUSE=PACKFLOW_WH`
- `SNOWFLAKE_DATABASE=PACKFLOW_ANALYTICS`
- `SNOWFLAKE_SCHEMA=PUBLIC`
- `SNOWFLAKE_ROLE=PACKFLOW_ANALYTICS_ROLE`
- `SNOWFLAKE_USER=PACKFLOW_ANALYTICS_USER`

## 3. Key pair

Generate the key on your machine. The private key stays in the server environment. Snowflake stores only the public key.

```bash
openssl genrsa 2048 | openssl pkcs8 -topk8 -inform PEM -out rsa_key.p8 -nocrypt
openssl rsa -in rsa_key.p8 -pubout -out rsa_key.pub
```

`rsa_key.p8` and `rsa_key.pub` are gitignored. Do not commit them.

Open `rsa_key.pub`, copy only the base64 body (no `BEGIN`/`END` lines, no line breaks), and assign it in Snowflake while the worksheet role is ACCOUNTADMIN. Replace the placeholder with your public key body. Do not paste the private key into Snowflake or into chat.

```sql
use role accountadmin;
alter user packflow_analytics_user set rsa_public_key = '<paste_public_key_body_here>';
```

Put the full contents of `rsa_key.p8`, including the BEGIN and END lines, into `SNOWFLAKE_PRIVATE_KEY`. In a Vercel env var, replace real newlines with `\n`. Leave `SNOWFLAKE_PRIVATE_KEY_PASSPHRASE` empty when the key was created with `-nocrypt`.

## 4. Events table

`snowflake/setup.sql` already creates `PACKFLOW_ANALYTICS.PUBLIC.PACKFLOW_EVENTS` and grants `SELECT` and `INSERT` to `PACKFLOW_ANALYTICS_ROLE`. `snowflake/schema.sql` is the same table statement if you need to run it alone. Columns are `event_id`, `event_type`, `tracking_number`, `stop_number`, `zone`, `shelf`, `slot`, `payload`, and `event_timestamp`.

## 5. Host environment

In the Vercel project whose root is `packflow`, add the eight `SNOWFLAKE_*` variables above. Do not prefix them with `VITE_`. Redeploy so the serverless functions can see them.

Supabase browser keys stay in `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.

## How to test

1. Deploy, or run `vercel dev` inside `packflow` so `/api` is served. `npm run dev` alone does not run the serverless functions; events are skipped and Route Analytics says the API is unavailable. The rest of the app still works.
2. Open **Route Analytics**. With the variables set and the table created, the page shows zeros until something happens. Those zeros are the query result, not sample data.
3. Scan a package, generate a loading plan, open **Package Locator** on a package, and mark one delivered.
4. Refresh Route Analytics. Event counts, delivery progress, and the recent list should change.
5. In Snowflake, confirm the rows:

```sql
select event_type, tracking_number, zone, shelf, slot, event_timestamp
from packflow_analytics.public.packflow_events
order by event_timestamp desc
limit 40;
```

`POST /api/events` accepts `{ "events": [ { "event_type": "package_scanned", "tracking_number": "PF000000000001" } ] }`. Allowed types are `package_scanned`, `loading_plan_generated`, `package_assigned`, `package_retrieved`, and `package_delivered`.
