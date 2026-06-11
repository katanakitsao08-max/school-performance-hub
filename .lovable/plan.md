# Reports Module — UI/UX Redesign Plan

## Already shipped this turn
- **Fee receipt** now merges `fee_structures` with `fee_records`: every charged component appears with its amount, the payment received, and the per-component term balance — even if it has not been paid against yet. Overall outstanding balance and term balance remain at the bottom of the PDF.
- **Parent fee reminder** in Parent Communication already auto-fills each learner's outstanding balance via the `{balance}` token (per-learner SMS), pulled live from `fee_records`. No change needed.

## Reports redesign — scope
Rebuild only the **selection/configuration panel** of `src/pages/ReportsPage.tsx`. The data hooks, generation logic, PDF/Excel exports, batch flows, WhatsApp send — all untouched. Same state variables (`selectedGrades`, `selectedStreams`, `selectedTerm`, `selectedAssessment`, `selectedGenderFilter`, `mergeCombinedSubjects`, `viewMode`) just rendered through a new mobile-first UI.

### New component: `src/components/reports/ReportSelectionPanel.tsx`
Receives current state + setters as props. Sections in order:

1. **Report Type** — modern card-style `Select` mapping to existing `viewMode` (class / individual / school) plus virtual options (subject / gender / assessment) that toggle existing filters.
2. **Grade Selection** — chip grid (`flex-wrap gap-2`), multi-select, PerformTrack-green when selected, instant update. Driven by `useSchoolGrades()`.
3. **Classes / Streams** (label renamed) — card grid. Each card: grade-stream label + live learner count from a single `learners` count query keyed by selected grades. Selected = green border + check + light green bg. "Select All" checkbox top-right. Streams dynamically filtered to selected grades via existing `streams` table.
4. **Term** — modern `Select`.
5. **Assessment** — modern `Select` (Opener / Mid-term / End-term / Merged).
6. **Combine Related Subjects** — `Switch` replacing existing checkbox; bound to `mergeCombinedSubjects`.
7. **Gender** — `Select` (All / Male / Female).
8. **Live Selection Summary** — sticky card showing grade(s), streams, term, assessment, gender, total learners (computed from cached learner counts).
9. **Quick Filters** — chip row: Current Grade, Whole School, Lower Primary (PP1–G3), Upper Primary (G4–G6), Junior School (G7–G9), Custom. Each updates `selectedGrades` + `selectedStreams` via existing setters.
10. **Generate Report** — full-width green button, sticky on mobile (`sticky bottom-0`), validates, then calls the existing generation entrypoint.

### Performance
- Single batched `learners` query: `select('grade, stream', { count: 'exact', head: false })` filtered by selected grades, then grouped client-side for stream cards and totals. Cached via React Query keyed on `[schoolId, selectedGrades]`.
- Stream cards rendered only after grade selection (lazy).
- No duplicate fetches — share queries with the existing page through React Query keys.

### Mobile / a11y
- All controls min 44 px tap target, `role` + `aria-pressed` on chips/cards, keyboard navigable (`tabIndex`, Enter/Space toggles).
- Layout: single column on mobile, 2-col summary on tablet+, sticky generate button on mobile.

### Visual tokens
Uses existing PerformTrack tokens (`bg-primary`, `border-primary`, `text-primary-foreground`). No hardcoded colors. Soft shadows via `shadow-card`, rounded-xl cards, `transition-colors` for chips.

### Analytics
Log each generation through existing `logActivity({ action: 'report_generated', metadata: { type, grades, streams, term, assessment, gender, learnerCount, durationMs } })`.

## Files touched
- **New**: `src/components/reports/ReportSelectionPanel.tsx`
- **Edited**: `src/pages/ReportsPage.tsx` — replace the current top selection block (~lines 600–900 visual JSX only) with `<ReportSelectionPanel ... />`. All hooks, queries, generation functions, render results table, PDF exports left intact.

## Database / logic guarantees
No migrations. No table or column renames. No changes to `learners`, `streams`, `scores`, `learning_areas`, report generation, batch ZIP export, WhatsApp send, or PDF templates. Existing reports continue to generate identically.

## Out of scope (will not change)
- Report generation algorithms, ranking, qualification rules.
- PDF templates and styling.
- WhatsApp/SMS flows beyond linking the already-working `{balance}` token.
- KPSEA/KJSEA grading logic.
