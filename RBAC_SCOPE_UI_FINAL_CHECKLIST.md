# RBAC + Scope Lock + UI Consistency Final Checklist

## A) RBAC (Server-first)
- [x] Admin-only sensitive pages use `platform-admin-auth` middleware.
  - `app/pages/admin/register-codes.vue`
  - `app/pages/admin/device-keys.vue`
- [x] Admin key endpoints require admin access (`assertAdminAccess`).
  - `/api/admin/device-keys/*`
  - `/api/admin/device-registration-codes/*`
- [x] Portal promotion APIs enforce permission + tenant scope (`assertPermission` + `resolvePortalScopeContext`).
  - `/api/app/promotions*`

## B) Scope Lock (No cross-scope leakage)
- [x] `/api/app/promotions` now rejects out-of-scope filter ids with `403`.
  - Guard added for `merchantAccountId` and `branchId` query.
  - File: `server/api/app/promotions.get.ts`
- [x] Scoped role behavior remains locked by backend even if UI params are tampered.
- [x] Revenue usage API uses resolved scope and ignores invalid custom ids outside allowed lists.

## C) UI Consistency (Nuxt UI + contrast + patterns)
- [x] Admin security pages aligned to admin portal middleware.
- [x] Register-code cleanup uses modal + toast pattern (no browser confirm).
- [x] Form/select contrast uses dark/light readable classes consistent with `UI_RULES.md`.

## D) Reseller Model Fit (Tenant = Reseller)
- [x] Platform manages global security primitives (device keys + global issue policy).
- [x] Tenant/portal operations are scoped by tenant + merchant + branch restrictions.
- [x] Scope-enforcement is backend authoritative (UI is only convenience).

## E) Manual Smoke Checklist (Role-based)
- [ ] Platform ADMIN:
  - [ ] Open `/admin/register-codes` and `/admin/device-keys` successfully.
  - [ ] Issue codes in selected tenant/merchant/branch scope.
  - [ ] Create/revoke/delete device key works.
- [ ] Platform USER (non-admin platform role):
  - [ ] Cannot access `/admin/register-codes` and `/admin/device-keys`.
- [ ] Tenant OWNER/MANAGER/STAFF:
  - [ ] Cannot access admin register/device-key pages.
  - [ ] `/app/promotion` cannot query merchant/branch outside assigned scope (403 if forced).

## F) Next hardening backlog (optional, not blocker for this package)
- [ ] Add centralized permission key for device-key management (e.g. `platform.device_key.manage`) and switch from role-check to permission-check.
- [ ] Add audit trail rows for register-code cleanup and device-key lifecycle actions.
- [ ] Add e2e RBAC smoke script for ADMIN/OWNER/MANAGER personas.
