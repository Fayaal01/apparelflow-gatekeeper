# ApparelFlow ERP - Cutting Gatekeeper

A production-minded implementation of the cutting verification checkpoint described in the practical challenge. It is deliberately a modular monolith: a single deployable unit with a clear HTTP/domain/data separation. For this scope, microservices would add operational failure modes without creating useful bounded contexts.

## Run locally

```bash
npm install
Copy-Item .env.example .env
npm run dev
```

Open `http://localhost:5173`. Build and run the production server with `npm run build && npm start`. Run the security-contract tests with `npm test`.

See [EVALUATION_GUIDE.md](./EVALUATION_GUIDE.md) for copy-paste API checks and database inspection queries matching the evaluator's audit.
See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for the architectural decisions, enforcement layers, and deliberate production tradeoffs.

## Demo credentials

All accounts use `Demo123!`.

| Role | Email |
| --- | --- |
| Cutting Supervisor | supervisor@apparelflow.demo |
| Cutting Verifier | verifier@apparelflow.demo |
| Sewing Supervisor | sewing@apparelflow.demo |

## Architecture and security

- React renders role-specific operational workspaces but is not a security boundary.
- Express authenticates signed, HTTP-only cookie sessions and applies role middleware to every protected command/query.
- Neon PostgreSQL supplies durable relational storage, transactions, JSONB audit snapshots, and database trigger functions that enforce legal transitions and immutable audit history.
- The approval transaction re-reads all persisted component counts and rejects missing/red counts with HTTP 422. It ignores client claims about role, verifier identity, status, expected counts, or wastage.
- Sewing queries contain a fixed database predicate for `VERIFIED`/`SEWING`; URL parameters cannot widen the result set.
- Verification decisions record component-level variances, verifier identity from the server session, timestamp, and backend-computed wastage.

## State machine

`CUTTING_IN_PROGRESS -> PENDING_VERIFICATION -> VERIFIED -> SEWING`

`PENDING_VERIFICATION -> REJECTED`

Only the cutting supervisor creates and submits cutting batches. Only the cutting verifier counts, approves, or rejects. Only the sewing supervisor starts a verified batch. A re-cut creates a new order linked through `parent_order_id`; the rejected batch remains unchanged and auditable.

## Relational model

`recipes` own `recipe_components` and `cutting_orders`; each order owns a fixed expected-count snapshot in `verification_items`. Re-cut orders reference their rejected parent. `verification_logs` reference both order and verifier and are protected against update/delete by database triggers. The executable SQL schema is in `server/database/schema.sql`.

## Vercel deployment

The root `index.js` exports the Express application for Vercel, Vite builds the React client into `public/`, and `vercel.json` pins the function near the Neon database. Create or attach a Neon database, then configure `DATABASE_URL`, `JWT_SECRET`, and `NODE_ENV=production` in Vercel before deploying. The application initializes the idempotent schema and demo seed data on startup.

For the complete GitHub-login and Vercel-import workflow, see [GITHUB_VERCEL_DEPLOYMENT.md](./GITHUB_VERCEL_DEPLOYMENT.md).

## Decisions beyond the minimum

- Whole-number/non-negative validation is duplicated at the API schema and database layers.
- Order numbers are non-sequential random identifiers, avoiding easy enumeration in screenshots and logs.
- Sewing users receive 404, rather than an authorization clue, when requesting an unverified order by ID.
- Audit records snapshot variances as JSON so later recipe edits cannot rewrite production history.
