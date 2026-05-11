# UI Rules

## Core
- Use Nuxt UI first (`UCard`, `UTable`, `UInput`, `USelect`, `UModal`, `UButton`, `UBadge`, `UAvatar`, `UDropdownMenu`,).
- Reuse shared form-control tokens from `app/constants/ui-controls.ts` for admin/portal create/edit/filter forms.
- Standard modal width for management create/edit forms: `sm:max-w-4xl` (except small confirm/delete dialogs).
- Keep normal text at `text-sm` or larger.
- Exception: `text-xs` is allowed only for 2-line value rendering inside a single column/cell where line 2 is secondary metadata.
  - Valid examples: `date` on line 1 + `time` on line 2, `name` on line 1 + `code` on line 2.
  - Do not use `text-xs` for primary labels, buttons, filter labels, or main content paragraphs.
- Don't use UTooltip,
- Prefer shared components for repeated UX (search, status, date-time display).
- Use one header/filter pattern per section:
  - left: title + subtitle/scope
  - right: filters/actions
- Keep filter control height consistent (`h-10`) for selects/inputs in the same row.
- Required form fields must be visibly marked with `*` in labels (use red tone, e.g. `text-rose-500`) consistently across create/edit dialogs.
- In any single form row (e.g., Tenant / Merchant / Branch), controls must use equal-width columns and each control must be `w-full` with consistent height (`h-10`).
- Date inputs in admin/portal forms must use `UCalendar` (with `UPopover` when inline calendar is not suitable), not native date/datetime browser controls.

## Tabs Pattern (Mandatory)
- Active tab must always be visually obvious:
  - Active state needs clear contrast from inactive state (background + text/icon color).
  - Do not allow active/inactive tabs to look similar.
- Tab label and tab content must stay in sync at all times:
  - If active tab is `Core`, only Core content is shown.
  - If active tab is `MQTT`, only MQTT content is shown.
- Default tab and default content must be the same on first render (no mismatch flash).
- When using `UTabs`, bind with one single source of truth (`v-model`) and render content from that same state.
- Never ship tab UIs without a quick manual check:
  - switch each tab once and confirm the visible section matches the selected tab.

## Contrast
- `UInput`, `USelect`, `UTextarea` in dark mode should keep:
  - `dark:bg-slate-800`
  - `dark:text-slate-100`
- Do not allow low-contrast placeholders.
- Button text should be clearly readable (especially primary actions).
- Primary action buttons must keep readable foreground in both themes (`text-white` when needed).
- Dropdown option text must remain readable (no light text on light option panels).

## Modal Pattern (Mandatory)
- Always use `UModal` for confirm/create/edit dialogs.
- Modal content surface must set explicit readable background + border/ring in both themes:
  - `bg-white dark:bg-slate-900`
  - `ring-1 ring-slate-200 dark:ring-slate-700`
- Modal title/body text must keep high contrast:
  - title: `text-slate-900 dark:text-white`
  - description/body: `text-slate-600 dark:text-slate-300` (or stronger)
- Destructive confirmation dialogs must use destructive semantic actions:
  - confirm button color: `error`
  - confirm text must be readable (`text-white` when needed)
  - cancel button should be neutral (`neutral` / `soft`)
- If action is performed inside nested modal, error alert must be shown in that active modal layer.

## Search Pattern
- Place search icon inside input box.
- Keep one visual pattern across admin/portal.
- Avoid extra standalone Search button unless required by workflow.

## Table Pattern
- Use `UTable` by default.
- Header should use dark slate style with white text.
- Keep row density compact and consistent.
- Sticky header tables should use one scroll container only.
- If plain `<table>` is used for a technical reason, match the same header/spacing/status semantics as `UTable`.
- Action column header should be center-aligned when icon-only actions are used.

## Status Pattern
- Status must use color semantics:
  - Positive: green
  - Warning: amber
  - Negative: red/rose
  - Neutral/informational: slate/blue
- Same status token must map to the same color across pages.

## Scope UX (Mandatory)
- Every management page must show current scope context (tenant/merchant/branch) when applicable.
- Any destructive or cross-scope action must show explicit confirmation with impact text.

## Review Checklist (Mandatory)
- For every UI PR, follow `docs/UI_PR_CHECKLIST.md` before merge.
