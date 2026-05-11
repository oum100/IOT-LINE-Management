# UI PR Checklist

Use this checklist before merging any UI changes.

## 1) Contrast
- Inputs/selects/textareas readable in both light and dark mode.
- Placeholder is readable (not washed out).
- Dropdown options are readable when menu opens.
- Primary buttons have readable text (`text-white` when needed).

## 2) Typography
- Primary UI text is `text-sm` or larger.
- `text-xs` only for line-2 metadata in two-line cells (date/time, name/code).
- No `text-[10px]` or `text-[11px]` in admin/portal management UIs.

## 3) Form Controls
- Reuse shared control tokens from `app/constants/ui-controls.ts`.
- In one row, controls have equal height (`h-10`) and width strategy.
- Required fields show `*` consistently.

## 4) Modal Quality
- Modal keeps readable surface (`bg/ring`) in both themes.
- Error is shown inside the active modal layer (not hidden in parent layer).
- Long modal content scrolls correctly.

## 5) Scope & Table
- Scope context (tenant/merchant/branch) is visible where required.
- Table headers keep strong contrast and remain readable while sticky/scrolling.

