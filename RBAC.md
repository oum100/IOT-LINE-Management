# RBAC Matrix (Phase 1 Baseline)

## Roles

- `ADMIN`: Platform Admin
- `USER`: Platform Read-only User
- `OWNER`: Tenant (Portal) Admin
- `MANAGER`: Tenant (Portal) Manager
- `STAFF`: Tenant (Portal) Operator

## Scope Rules

- `ADMIN`, `USER`:
  - Access: `/platform/*`, `/admin/*`
  - Data scope: cross-tenant (platform-wide)
- `OWNER`, `MANAGER`, `STAFF`:
  - Access: `/app/*`
  - Data scope: own tenant only

## Permissions

### Platform

- `platform.dashboard.read`
- `platform.expense.read`
- `platform.master.manage` (tenant/merchant/branch/asset master data)
- `platform.user.manage`

### Portal

- `portal.dashboard.read`
- `portal.revenue.read`
- `portal.expense.read`
- `portal.expense.manage`
- `portal.governance.read`
- `portal.user.manage`
- `portal.settings.manage`
- `portal.merchant.read`
- `portal.merchant.manage`
- `portal.branch.read`
- `portal.branch.manage`
- `portal.asset.manage`
- `portal.order.manage`
- `portal.refund.manage`

## Role x Permission Matrix

| Permission | ADMIN | USER | OWNER | MANAGER | STAFF |
|---|---|---|---|---|---|
| `platform.dashboard.read` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `platform.expense.read` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `platform.master.manage` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `platform.user.manage` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `portal.dashboard.read` | ✅ | ❌ | ✅ | ✅ | ✅ |
| `portal.revenue.read` | ✅ | ❌ | ✅ | ✅ | ✅ |
| `portal.expense.read` | ✅ | ❌ | ✅ | ✅ | ✅ |
| `portal.expense.manage` | ✅ | ❌ | ✅ | ❌ | ❌ |
| `portal.governance.read` | ✅ | ❌ | ✅ | ✅ | ✅ |
| `portal.user.manage` | ✅ | ❌ | ✅ | ❌ | ❌ |
| `portal.settings.manage` | ✅ | ❌ | ✅ | ❌ | ❌ |
| `portal.merchant.read` | ✅ | ❌ | ✅ | ✅ | ✅ |
| `portal.merchant.manage` | ✅ | ❌ | ✅ | ❌ | ❌ |
| `portal.branch.read` | ✅ | ❌ | ✅ | ✅ | ✅ |
| `portal.branch.manage` | ✅ | ❌ | ✅ | ❌ | ❌ |
| `portal.asset.manage` | ✅ | ❌ | ✅ | ✅ | ✅ |
| `portal.order.manage` | ✅ | ❌ | ✅ | ✅ | ✅ |
| `portal.refund.manage` | ✅ | ❌ | ✅ | ✅ | ✅ |

## Scope Assignment Model

- Main model: `UserScopeAssignment`
- Purpose: assign a portal user to specific merchant/branch scope without creating extra roles.

### Fields

- `userId`
- `tenantId`
- `scopeType`: `MERCHANT` or `BRANCH`
- `merchantAccountId` (optional)
- `branchId` (optional)
- `active`

### Usage

- `OWNER`: usually tenant-wide (can work without scoped rows)
- `MANAGER`: assign one/many merchant and/or branch rows
- `STAFF`: assign branch rows for operational access

### Enforcement Rule

- API must apply both:
  1. permission check by role
  2. scope filter by `UserScopeAssignment` for `MANAGER` / `STAFF`

## Guardrails

- `OWNER/MANAGER/STAFF` must never access platform routes (`/platform/*`, `/admin/*`).
- `USER` (platform read-only) must not perform create/update/delete.
- `MANAGER` and `STAFF` must not manage users or critical settings.
- Portal-side delete/update actions must always validate tenant ownership at API layer.

## Notes for Implementation

- UI layer:
  - Hide menu/actions by permission.
- API layer:
  - Enforce permission check at every endpoint.
- Priority:
  1. API enforcement first
  2. UI visibility second
