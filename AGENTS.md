# AGENTS.md

## Project Context
- Stack: `Nuxt 4` + `Vue 3` + `TypeScript` + `Prisma` + `@nuxt/ui` + `Tailwind CSS`.
- This repo has both `platform` pages and `portal app` pages.
- Primary UX language for UI text is English unless explicitly requested otherwise.

## Core Working Rules
- Keep changes minimal and scoped to the user request.
- Do not run tests, lint, typecheck, or destructive git commands unless explicitly asked.
- Do not revert unrelated user changes.
- For UI/API features, update frontend and backend together in one change set when required.
- Any request using shared paging helper (`withPaging`) must keep `pageSize <= 200`.
- For dropdown loaders, lookup lists, and admin selectors, default to `pageSize: 200` unless a smaller value is clearly sufficient.
- Always use path aliases (`~~/`, `~/`) for cross-folder imports instead of deep relative paths.

## UI Standards (Important)
- Prefer Nuxt UI components over raw HTML controls when practical.
- For data grids/lists, prefer `UTable` over plain `<table>`.
- Keep table row density compact: target about `py-1.2` (`0.3rem`) for `th`/`td` when requested.
- Keep visual contrast readable in both light/dark mode.
- Keep header/filter layout consistent with existing page pattern (left title block, right filters) unless requested otherwise.
- Minimum font size for normal UI text is `text-sm`.
- Do not use classes smaller than `text-sm` (e.g., `text-xs`, `text-[11px]`, `text-[10px]`) unless explicitly requested for a very specific element.

## Contrast Rules (Mandatory)
- Inputs, selects, and textareas must always keep readable foreground/background contrast in both light and dark mode.
- Never use light text on light input backgrounds (or dark text on dark backgrounds).
- Placeholder text must remain readable and distinct from background.
- Disabled elements must still be readable (lower emphasis is allowed, unreadable is not).
- Table headers must have strong contrast with body rows and sticky headers must keep the same contrast while scrolling.
- If a contrast tradeoff appears, prioritize readability over decorative styling.
- For `UInput` in dark mode, default to `dark:bg-slate-800 dark:text-slate-100` so background and font never collapse into similar tones.
- Use these default form control styles in dialogs unless explicitly overridden:
  - `UInput` text class: `text-slate-900 placeholder:text-slate-500 dark:text-slate-100 dark:placeholder:text-slate-400`
  - `UInput` base ui: `bg-white ring-1 ring-slate-300 focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:ring-slate-500`
  - `select` class: `h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100`

## UTable Sticky Header Pattern (Known Good)
When sticky table header is required, use this exact pattern:
1. Use `UTable` with `sticky="header"`.
2. Put scroll on `UTable` root (`h-full overflow-auto`).
3. Set outer wrapper to `overflow-hidden` to avoid nested scroll containers.
4. Apply scoped class (e.g., `tenant-utable`, `asset-utable`) and style:
   - `thead { position: sticky; top: 0; z-index: 30; }`
   - header dark background + readable header text color.

## Styling Consistency Rules
- Workspace section titles (e.g., `Tenant Workspace`, `Asset Workspace`) should use the same accent style as dashboard eyebrow:
  - `text-blue-700 dark:text-blue-300`
  - uppercase, tracking around `0.2em`, semibold.
- Status colors are mandatory and should map consistently in all pages/tables/cards:
  - positive (`ACTIVE`, `VERIFIED`, `IN_USE`) => green
  - warning (`SUSPENDED`, `MAINTENANCE`, `SPARE`) => amber
  - negative (`DISABLED`, `INACTIVE`, `OFFLINE`) => rose
- Never render status as plain neutral text without color unless explicitly requested.

## Portal Navigation Rules
- Tenant top menu should remain concise:
  - `Dashboard`, `Revenue`, `Tenant`, `Assets`
- Do not add `Merchant`/`Branch` links back unless explicitly requested.

## Data Safety / CRUD Guardrails
- Respect existing non-delete constraints in UI and API (`canDelete` patterns).
- If an entity is linked/referenced, prefer disable/lock flow rather than delete.
- In edit dialogs, only expose fields user asked to edit.
- Order Code validation is mandatory on create/update and must be checked every time:
  - Uppercase letters only (`A-Z`)
  - Digits allowed (`0-9`)
  - Allowed symbols: `-`, `_`, `.`, `/`
  - Any lowercase or other special characters must be rejected or normalized before save.

## Starter Pack References
- UI conventions: `/Users/teerin/Documents/MyDev/Nuxt4/IOT-LINE-Merchant/UI_RULES.md`
- API conventions: `/Users/teerin/Documents/MyDev/Nuxt4/IOT-LINE-Merchant/API_RULES.md`
- Data conventions: `/Users/teerin/Documents/MyDev/Nuxt4/IOT-LINE-Merchant/DATA_RULES.md`
- RBAC matrix: `/Users/teerin/Documents/MyDev/Nuxt4/IOT-LINE-Merchant/RBAC.md`
- Guard script: `bun run guard:standards`

## Common Gotchas to Avoid
- Do not mix multiple scroll containers around the same table.
- Do not use white/light input background with light placeholder/text (contrast issue).
- Do not introduce inconsistent label casing/page title patterns across similar pages.
- Do not switch between plain table and UTable in the same module unless there is a technical reason.

## File Placement
- This file defines default agent behavior for the whole repository.
- Add nested `AGENTS.md` in subfolders only when local rules must override global defaults.
