# SRE

Monorepo containing the SRE frontend and backend.

| Folder   | Description          | Port |
|----------|----------------------|------|
| `SRE-BE` | Node.js/Express API  | 8080 |
| `SRE-FE` | React + Vite UI      | 5173 |

## Getting started

Install root dependencies (only needed once):

```bash
npm install
```

Then install each app's own dependencies if you haven't already:

```bash
npm install --prefix SRE-BE
npm install --prefix SRE-FE
```

## Running the app

```bash
npm run start
```

This starts both the backend and frontend in parallel. Logs are prefixed with `[BE]` and `[FE]` so you can tell them apart.

## Individual commands

| Command           | What it does          |
|-------------------|-----------------------|
| `npm run start:be` | Backend only          |
| `npm run start:fe` | Frontend only         |
