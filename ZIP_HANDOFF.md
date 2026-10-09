# ZIP Handoff Checklist

This project is intended to be delivered as source code in a ZIP, without claiming a public deployment or GitHub repository.

## Evaluator setup

Requirements: Node.js 22.5 or newer.

Create a free Neon PostgreSQL database and copy its pooled connection string into `DATABASE_URL` in `.env`.

```powershell
npm install
Copy-Item .env.example .env
npm test
npm run build
npm start
```

Open `http://localhost:3000`. PostgreSQL tables, constraints, trigger functions, and demo records are initialized idempotently on startup.

## Demonstration order

1. Sign in as Cutting Supervisor and create a Casual Blouse batch.
2. Switch to Cutting Verifier and enter one shortage. Confirm approval is disabled, then reject it with a reason.
3. Switch to Cutting Supervisor, open the rejected order, and create its linked re-cut batch.
4. Switch to Cutting Verifier, enter complete counts, and approve the batch.
5. Switch to Sewing Supervisor, inspect verifier attribution and wastage, then start sewing.
6. Refresh the browser to demonstrate persistence.
7. Run the direct API and SQL checks in `EVALUATION_GUIDE.md`.

## Included evidence

- Executable relational schema: `server/database/schema.sql`
- Architecture decisions: `docs/ARCHITECTURE.md`
- AI review: `AI_OPTIMIZATION_REPORT.md`
- API and SQL evaluation queries: `EVALUATION_GUIDE.md`
- Automated tests: `tests/gatekeeper.test.js`

## Deployment files

- Vercel Express entry: `index.js`
- Vercel project configuration: `vercel.json`
- Neon/PostgreSQL environment template: `.env.example`
