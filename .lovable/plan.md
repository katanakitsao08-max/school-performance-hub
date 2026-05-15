## Reporting & Analytics Overhaul — Phased Plan

This is a large request spanning 12 feature areas. To ship safely without breaking existing reports/marks-entry, I'll deliver in 4 phases. Confirm scope/order before I start.

---

### Phase 1 — Core calculation change + Subject Teacher Mapping (foundation)

This phase MUST come first because everything else depends on it.

**1. Switch mean to points-based aggregate (item 7 + 8)**
- New helper `computeLearnerMeanPoints()` that converts each subject score → performance level (EE1…BE2) → points (8…1), then averages points.
- Overall level shown beside total = `getMeanGradeLabel(avgPoints)`.
- Affected files: `src/lib/cbc-utils.ts`, `src/lib/analysis-utils.ts`, `src/lib/cbc-analysis-utils.ts`, `src/pages/ReportsPage.tsx`, `src/pages/PerformanceTrackingPage.tsx`, `src/lib/report-card-pdf.ts`, ranking logic in Reports/Analytics.
- Lower-primary (KPSEA, 4-level) keeps EE/ME/AE/BE; KJSEA grades 7–9 use 8-level. Both contribute points to the same averaging.

**2. Subject Teacher Mapping (item 6)**
- Already partially exists via `teacher_assignments` (teacher_id, grade, stream, learning_area_id). I'll add a small admin UI to view "one teacher per subject per grade+stream" and a helper `getSubjectTeacherName(grade, stream, subjectId)` used by all new reports.

---

### Phase 2 — Three new consolidated reports (items 1, 2, 3) + PDF/Excel/CSV (items 4, 9)

**A. Best Performed Subject (all grades, one sheet)**
Columns: Grade · Stream · Best Subject · Mean Score · Level · Teacher.
New page section under Reports → "Consolidated Reports" tab.

**B. Best Stream Overall**
Columns: Grade · Stream · Mean Points · Overall Level · Position. Sortable.

**C. School Assessment Analysis**
Per grade+stream block: Subject · Mean Score · Level · Teacher, plus Total Points and Overall Level row. Matches the sample layout you described.

**Exports for all three:**
- PDF (landscape, jsPDF + autoTable, school logo, page numbers, generated date)
- Excel (xlsx via SheetJS — already in project)
- CSV
- Print-friendly view

Filters: Term · Year · Assessment · Grade(s) · Stream(s) · Subject · Teacher.

---

### Phase 3 — Teacher Performance Dashboard (item 5) + RBAC (item 11)

- New route `/teacher-dashboard` (visible only to role=teacher).
- Scoped strictly to `teacher_assignments` + `class_teachers` rows for the signed-in teacher (RLS already enforces this; UI just respects it).
- Sections: Assigned classes/subjects · Performance trend chart · Subject mean · Top 5 / Bottom 5 learners · Assessment history (Opener → Mid → End).
- Admin & Parent flows untouched (already correctly scoped).

---

### Phase 4 — Visuals & polish (items 10, 12)

- Recharts panels: subject trends, grade comparison, stream comparison, teacher performance, top/weak subjects.
- Capture chart as image (`html2canvas`) and embed in PDF exports.
- Alternating row colors, responsive tables, projector-friendly print CSS.

---

### Technical notes

- No DB schema change required — `teacher_assignments`, `scores`, `learning_areas`, `streams` already cover it.
- Mean-points logic is the only behavioral change to existing reports; I'll keep the old % "Mean Score" column visible alongside the new "Mean Points / Level" so nothing looks like it regressed.
- Merge-pair logic (RE+Env+Creative for G1–3, SS+RE & Sci+Agri for G4+) is preserved in all new reports.

---

### Question before I start

This is ~8–12 hours of work. Want me to:
- **(a)** Ship Phase 1 first (the mean-calculation change is the highest-impact and unblocks everything), then continue, **or**
- **(b)** Do all 4 phases in one go (longer single delivery, higher risk of one piece blocking review)?

Default if you don't reply: **(a)** — Phase 1 now, then Phases 2 → 3 → 4 in follow-ups.
