# RBAC Checklist

## 1) Core Enforcement
- [ ] Every API must enforce `auth + role + scope` before data access.
- [ ] Every query must apply scope constraints (`tenantId`, `merchantAccountId`, `branchId`) from resolved context.
- [ ] UI-level visibility is convenience only; backend must enforce all permissions.
- [ ] Every mutation writes audit log: `actorId`, `role`, `scope`, `action`, `target`, `before`, `after`, `timestamp`.
- [ ] Cross-scope actions must show explicit impact confirmation in UI.

## 2) Scope Visibility Baseline
- [ ] Platform role: can view all tenants/merchants/branches.
- [ ] Portal role: can view only assigned tenant/merchant/branch scope.
- [ ] Merchant role: can view only own merchant/branch scope.
- [ ] Every workspace page shows current scope bar.

## 3) Permission Keys (Recommended)
- `platform.tenant.manage`
- `platform.merchant.manage`
- `platform.branch.manage`
- `platform.asset.manage`
- `platform.promotion.manage`
- `portal.asset.manage`
- `portal.product.manage`
- `portal.promotion.manage`
- `portal.order.view`
- `portal.payment.view`
- `merchant.asset.operate`
- `merchant.promotion.manage`
- `merchant.order.manage`

## 4) Page Mapping

### A) `/admin/assets`
Purpose: platform/operator asset lifecycle management across scope.

#### View
- [ ] Requires: `platform.asset.manage` (or equivalent admin access).
- [ ] Filters visible: Tenant, Merchant, Branch, Asset Type, Search.
- [ ] API list uses scope-safe where clause for all filters.

#### Actions
- [ ] `Create Asset` requires `platform.asset.manage`.
- [ ] `Edit Asset` requires `platform.asset.manage`.
- [ ] `Delete Asset` requires `platform.asset.manage` and guard checks.
- [ ] `Register Code` requires `platform.asset.manage`.

#### API Endpoints to enforce
- [ ] `GET /api/admin/assets`
- [ ] `GET /api/admin/assets/summary`
- [ ] `POST /api/admin/assets`
- [ ] `PATCH /api/admin/assets/:id`
- [ ] `DELETE /api/admin/assets/:id`
- [ ] `POST /api/admin/device-registration-codes*`

---

### B) `/app/asset`
Purpose: portal/merchant branch-level operation (bind, replace, promotion on bound products).

#### View
- [ ] Requires: `portal.asset.manage` (or merchant operation permission).
- [ ] Scope resolution must lock tenant and allowed merchants/branches.
- [ ] Asset list pagination and selected asset details must remain scoped.

#### Actions
- [ ] `Bind Product` requires `portal.asset.manage`.
- [ ] `Unbind/Rebind Product` requires `portal.asset.manage` + usage constraints.
- [ ] `Replace Device` requires `portal.asset.manage` and SPARE precondition for new device.
- [ ] `Replace Machine` requires `portal.asset.manage` and SPARE precondition for new machine.
- [ ] Replaced old device/machine status should become `REPLACED`.
- [ ] `Set Promotion/Pause/Resume/Delete` requires `portal.promotion.manage` or `portal.asset.manage` by policy.
- [ ] `Show Static ThaiQR` requires scoped read permission and biller resolution in scope.

#### API Endpoints to enforce
- [ ] `GET /api/app/tenant`
- [ ] `POST /api/app/assets/:id/products`
- [ ] `DELETE /api/app/assets/:id/products/:productId`
- [ ] `POST /api/app/assets/:id/replace-device`
- [ ] `POST /api/app/assets/:id/replace-machine`
- [ ] `POST /api/app/assets/:id/offers`
- [ ] `POST /api/app/assets/:id/offers/:offerId/disable`
- [ ] `POST /api/app/assets/:id/offers/:offerId/resume`
- [ ] `GET /api/app/assets/:id/products/:productId/static-qr`

---

### C) `/admin/promotion`
Purpose: global/platform promotion governance and scoped rollout.

#### View
- [ ] Requires: `platform.promotion.manage`.
- [ ] Filters visible: Tenant, Merchant, Branch, Type, Product search.
- [ ] Tabs visible: Current, Upcoming, History.

#### Actions
- [ ] `Set Promotion` requires `platform.promotion.manage`.
- [ ] `Pause/Resume` requires `platform.promotion.manage`.
- [ ] `Delete` requires `platform.promotion.manage`.
- [ ] Branch-scope bulk action requires explicit confirmation.

#### API Endpoints to enforce
- [ ] `GET /api/admin/promotions`
- [ ] `POST /api/admin/promotions`
- [ ] `POST /api/admin/promotions/:offerId/pause`
- [ ] `POST /api/admin/promotions/:offerId/resume`
- [ ] `DELETE /api/admin/promotions/:offerId`

---

### D) `/app/promotion`
Purpose: scoped promotion operations for portal/merchant users.

#### View
- [ ] Requires: `portal.promotion.manage` (or merchant equivalent).
- [ ] Filters visible by role scope:
  - Portal: Merchant, Branch, Type
  - Merchant: Branch, Type
- [ ] Tabs visible: Current, Upcoming, History.

#### Actions
- [ ] `Set Promotion` allowed only in resolved scope.
- [ ] `Pause/Resume` allowed only in resolved scope.
- [ ] `Delete Upcoming/Current` allowed by policy and scope.
- [ ] Product list actions and offer list actions must not bypass scope.

#### API Endpoints to enforce
- [ ] `GET /api/app/promotions`
- [ ] `POST /api/app/promotions`
- [ ] `POST /api/app/promotions/:offerId/pause`
- [ ] `POST /api/app/promotions/:offerId/resume`
- [ ] `DELETE /api/app/promotions/:offerId`

## 5) UI Validation Checklist (Per Page)
- [ ] No unauthorized action button is visible.
- [ ] Disabled action has clear tooltip/label explaining why.
- [ ] Status colors follow UI rules (`ACTIVE` green, warning amber, disabled/error rose).
- [ ] Input/select contrast is readable in both light/dark mode.
- [ ] Scope labels are visible near table/card headers.

## 6) API Validation Checklist (Per Endpoint)
- [ ] Parse and validate query/body with schema.
- [ ] Resolve scope context once and reuse.
- [ ] Reject out-of-scope target IDs with 403/404 (no data leakage).
- [ ] Enforce state-machine constraints (e.g., SPARE only for replace source/target policy).
- [ ] Log audit event on successful mutation.

## 7) Rollout Plan
- [ ] Step 1: standardize permission keys in one place.
- [ ] Step 2: map each page action to one permission key.
- [ ] Step 3: enforce in backend endpoints first.
- [ ] Step 4: align UI visibility and disabled states.
- [ ] Step 5: verify with role-by-role smoke checklist (Platform, Portal, Merchant).
