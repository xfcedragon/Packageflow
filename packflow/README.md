# PackFlow

Driver prototype for placing packages in a delivery van and finding the next one by zone, shelf, and slot.

The app runs entirely in the browser with local React state. There are no accounts or external services.

## Run

```bash
npm install
npm run dev
```

Open the URL Vite prints.

- `/` — driver dashboard
- `/loading-plan` — generate zone, shelf, and slot assignments
- `/locator` — search a tracking number or address
