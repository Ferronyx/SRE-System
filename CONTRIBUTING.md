# Contributing

Thank you for contributing to SRE! Please follow these guidelines to keep the codebase consistent.

## Project structure

```
SRE/
├── SRE-BE/   # Node.js backend (port 8080)
└── SRE-FE/   # React + Vite frontend (port 5173)
```

## Getting started

1. Clone the repository
2. Install all dependencies:

```bash
# Root (concurrently)
npm install

# Backend
npm install --prefix SRE-BE

# Frontend
npm install --prefix SRE-FE
```

3. Start both apps:

```bash
npm run start
```

## Branching

- `main` — stable, production-ready code
- `feature/<name>` — new features
- `fix/<name>` — bug fixes

Always branch off `main` and open a pull request to merge back.

## Pull requests

- Keep PRs focused — one feature or fix per PR
- Write a clear title and description explaining what and why
- Make sure both backend and frontend start without errors before submitting

## Backend (SRE-BE)

- Entry point: `main/index.js`
- Runs on port `8080`
- Uses `nodemon` for hot reload in development
- Database migrations: `npm run migrate --prefix SRE-BE`

## Frontend (SRE-FE)

- Built with React, Vite, and TypeScript
- Run `npm run lint --prefix SRE-FE` before submitting a PR
- Run `npm run build --prefix SRE-FE` to verify the production build passes

## Environment variables

Copy `.env.example` to `.env` in each subdirectory and fill in the required values. Never commit `.env` files.
