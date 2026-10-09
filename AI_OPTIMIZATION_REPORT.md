# AI Optimization Report

## 1. Tools and prompting

OpenAI Codex was used to extract the assessment, scaffold the Express/React application, draft the relational schema, style the evaluator workflow, and generate the initial integration tests. The human architectural direction was to keep a modular monolith, treat the API/database as the security boundary, and optimize the five-minute audit path.

## 2. Flawed or broken AI code caught

1. The first UI draft tried to reach the sewing command by composing `../sewing-start` into an order URL. That was an invalid resource model and could not match the server route. It was replaced by an explicit `POST /api/sewing/:id/start` client call.
2. A naive approval design could have accepted traffic-light values or a verifier ID from the browser. Those values are attacker-controlled. The delivered implementation recomputes eligibility from persisted item counts inside a transaction and derives verifier identity from the signed server session.
3. A typical generated queue endpoint accepts a requested status filter. That would let a sewing user ask for pending batches. The delivered query has a fixed status predicate and exposes no widening parameter.
4. The initial generated interface used a permanent sidebar, decorative workflow copy, and persona-style login cards. It looked polished in isolation but wasted horizontal space, repeated context, and made the system feel like a mock-up rather than a factory tool. Human review replaced it with a conventional credential form, a compact top bar, task-focused labels, a restrained icon system, and a wider responsive workspace.

## 3. Human refactoring and hardening

Validation is layered: Zod rejects malformed payloads, relational checks reject invalid stored values, transactions make decisions atomic, and database triggers make audit rows append-only. Expected counts are created from server-owned recipe components. Approval re-reads every expected item and refuses missing, uncounted, or red rows. Error codes distinguish authentication (401), authorization (403), invalid domain transitions (409), and hard-stop violations (422).

The UI was organized around each role's actual job instead of exposing a generic CRUD console. High-contrast controls, visible focus rings, inline hard-stop messaging, responsive layouts, and unambiguous state badges address the stated UAT risk. Decorative subtitles and fictional workstation details were removed where they did not help an operator complete a task.

## 4. Defensive architecture

Commands encode legal state transitions instead of exposing a generic `status` update endpoint. The supervisor can create but never verify; the verifier can verify but never create; the sewing supervisor sees only released work. The approval and audit insert occur in one PostgreSQL transaction. Audit identity, time, wastage, and component variance are server-derived. PostgreSQL trigger functions prevent later update or deletion of verification logs.

The intentionally narrow state machine is easier to prove correct than a client-managed global status object. Re-cutting creates a linked replacement batch through `parent_order_id` while retaining the rejected record, preserving traceability rather than allowing mutable rollback.
