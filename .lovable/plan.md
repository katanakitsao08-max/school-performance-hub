# Smart Document & Communication Center

A new admin module to generate, edit, save, and export branded letters/documents using AI, with school letterhead, templates, and history. Fully additive — no changes to existing tables or workflows.

## Scope

- New route `/documents` (admin-only), added to sidebar under existing Communication group.
- Uses existing `school_settings` for letterhead (logo, motto, address, phone, email, signature, stamp). No edits to `schools` table.
- AI generation via Lovable AI Gateway (`google/gemini-2.5-flash`) through a new edge function.
- PDF export via existing `jspdf` + `jspdf-autotable` already in the project.

## Database (new tables only)

`documents`
- school_id, title, recipient_type, recipient_name, tone, language, prompt, content (HTML), created_by, created_at, updated_at

`document_templates`
- school_id (nullable for global), title, category, content (HTML), is_global, created_by, created_at

`school_branding` (extends letterhead — keys stored as rows in existing `school_settings`, no new table needed for that). Signature + stamp uploaded to new Storage bucket `school-branding` (private, school-scoped path).

RLS:
- `documents`: admin/HT view+manage within their school_id; super_admin full.
- `document_templates`: read = same school OR is_global=true; insert/update/delete = admin own school OR super_admin for global.
- Storage `school-branding`: admin upload/read own school folder; super_admin full.

GRANTs included for authenticated + service_role.

## Edge function

`generate-letter` (verify_jwt=false, validates JWT in code)
- Input: `{ prompt, tone, language, recipientType, recipientName, schoolContext }`
- Calls Lovable AI Gateway, returns HTML letter body.
- Handles 429/402 with clear errors.

## Frontend

New files:
- `src/pages/DocumentsPage.tsx` — tabs: New Letter | Templates | History.
- `src/components/documents/LetterEditor.tsx` — prompt box, tone/language/recipient selectors, AI generate button, contentEditable rich editor (bold/headings/lists/align), merge field inserter.
- `src/components/documents/LetterPreview.tsx` — A4 live preview with letterhead, body, signature/stamp footer.
- `src/components/documents/TemplatesPanel.tsx` — list, create, apply.
- `src/components/documents/HistoryPanel.tsx` — search/filter by date/recipient/type, view/regenerate/download.
- `src/components/documents/BrandingUploader.tsx` — upload signature + stamp to Storage, save URLs to `school_settings`.
- `src/lib/letter-pdf.ts` — jsPDF A4 export with letterhead + HTML body + signature/stamp.

Routing: add `/documents` to `App.tsx` (admin only) + sidebar entry in `AppSidebar.tsx`.

## Tone, recipients, languages

- Tones: Formal, Official, Friendly, Strict, Appreciative.
- Recipients: combobox with presets (Students, Parents, Teachers, BOM/PTA, Staff, MoE, TSC, County, NGO, Sponsor, Supplier, Bank, Other School, Community) + free text.
- Languages: English, Kiswahili (passed to AI prompt).

## Merge fields

`{{student_name}}, {{parent_name}}, {{class}}, {{balance}}, {{school_name}}, {{date}}` — replaced at PDF export time when context is available; otherwise left for manual fill.

## Out of scope (won't touch)

- Existing `schools` table, grading, reports, fees, SMS, WhatsApp, teacher-first, learner portal.

## Deliverable order

1. Migration (tables + RLS + GRANTs + storage bucket + policies).
2. Edge function `generate-letter`.
3. Frontend components + page + route + sidebar.
4. PDF exporter.
