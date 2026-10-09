# Architecture Decisions

## System shape

ApparelFlow Gatekeeper is a modular monolith. The challenge describes one tightly coupled transactional boundary: count components, decide a batch, write its audit record, and release it to sewing. Keeping those operations in one process and one relational transaction is safer than splitting them across services and introducing distributed consistency problems.

## Enforcement layers

The same production rule is protected at multiple independent layers:

1. The React workspace prevents obviously invalid actions and explains shortages immediately.
2. Request schemas reject malformed numbers and incomplete component sets.
3. Role middleware enforces separation of duties from the authenticated server identity.
4. Domain policies define component classification and legal approval conditions independently of HTTP.
5. PostgreSQL constraints and trigger functions reject illegal state transitions, incomplete approvals, post-decision count changes, and audit mutation.

The duplication is intentional defense in depth. UI checks improve usability; domain checks produce useful API errors; database rules protect invariants if another command path is added later.

## State ownership

`cutting_orders.status` is not accepted from client payloads. It changes only through named commands:

- create order -> `CUTTING_IN_PROGRESS`
- submit cutting order -> `PENDING_VERIFICATION`
- approve verification -> `VERIFIED`
- reject verification -> `REJECTED`
- start sewing -> `SEWING`

The database permits only those transitions. `SEWING` is terminal. A rejected order remains immutable; re-cutting creates a new pending batch linked through `parent_order_id`.

## Audit model

The approval or rejection transaction writes exactly one verification decision per order. The log snapshots component names, expected quantities, actual quantities, variances, and traffic-light outcomes so later recipe changes cannot rewrite history. Update and delete triggers make this record append-only.

## Query boundaries

Sewing queue visibility is encoded as a fixed SQL predicate. It is not derived from URL filters or client state. Composite indexes support state-oriented operational screens and component validation without changing the public API.

## Deliberate limitations

- Neon PostgreSQL provides durable shared state across Vercel function instances; pooled connections are bounded in the application adapter.
- Demo role switching is intentionally visible for assessment. A production identity provider would issue roles administratively.
- Re-cut lineage, shift/plant tenancy, rate limiting, CSRF tokens, and observability are the next architectural increments. They should not be improvised into the current flow without corresponding domain requirements.
