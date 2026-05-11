# Data Rules

## Naming / Identity
- Keep business-facing names readable for users.
- Keep internal IDs stable and opaque.
- Device UID rule: derived from MAC (reverse, without `:`) when required by current flow.

## Referential Integrity
- Protect deletes when linked records exist.
- Prefer soft-disable/lock when history must be preserved.
- For unbind flows, return linked entities to valid standby status.

## Product / Asset
- Asset is the operational anchor.
- Platform domain model: `Asset` is the primary entity, with `Machine` and `Device` as child components.
- Asset identity policy (canonical): use `Asset.code` as the business identity and uniqueness key.
- `Asset.code` must be unique across the whole platform (global unique), not only per branch.
- UI/API flows must not require `assetUuid` from operators. `assetUuid` is legacy/internal compatibility data only.
- Product and machine/device bindings must remain auditable.
- Avoid mutating product fields when completed orders depend on them.

## Seed / Bootstrap
- Seed data should be deterministic enough for UI verification.
- Keep platform bootstrap path predictable and explicit.
