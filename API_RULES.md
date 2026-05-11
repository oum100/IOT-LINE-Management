# API Rules

## Query / Paging
- Central paging rule: `pageSize <= 200`.
- Default lookup pagination for selectors: `page=1&pageSize=200`.
- Use shared paging helper for list endpoints.

## Validation
- Validate payload with schema before business logic.
- Normalize and validate order code:
  - uppercase only
  - allow `[A-Z0-9\\-_.\\/]`
- Validate enum-like query fields (e.g. `status`, `period`, `mode`) and reject invalid values with `400`.
- For date range queries, validate `start <= end` and reject inverted ranges.

## Security
- Enforce permission at API layer first, UI second.
- Enforce tenant/scope check for every tenant-bound endpoint.
- Do not rely only on frontend filtering for data isolation.
- Deny by default:
  - if permission missing => `403`
  - if scope missing for non-platform role => `403`
  - if target is outside scope => `404` or `403` (must not leak cross-scope existence)
- Every tenant-bound API must resolve scope context once and apply it in every DB read/write query.
- Never call `/api/admin/*` from portal app pages unless endpoint is intentionally cross-scope and guarded for that role.
- For state transitions (`pause/resume/replace/delete`), enforce state machine guards and return `409` when transition is invalid.

## Traceability
- Keep operational traces for payment/provider events where needed.
- Do not log secrets in plain text.
- Mutation endpoints must emit audit records for critical actions:
  - actor id, role, scope
  - action + target id
  - before/after (when feasible)
  - timestamp

## Imports
- Prefer `~~/` or `~/` aliases for shared server utils and types.

## Endpoint Checklist (Mandatory)
- [ ] auth check
- [ ] permission check
- [ ] scope resolution
- [ ] input validation
- [ ] scope-applied DB query
- [ ] state guard (if mutation)
- [ ] audit log (if critical mutation)
