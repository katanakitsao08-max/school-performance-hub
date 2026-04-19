// Client-side helpers for the WhatsApp module.
export type TemplateCategory = 'utility' | 'marketing' | 'authentication';
export type TemplateStatus = 'draft' | 'pending' | 'approved' | 'rejected';

export interface WhatsAppTemplate {
  id: string;
  school_id: string;
  name: string;
  category: TemplateCategory;
  language: string;
  header_text: string | null;
  body_text: string;
  footer_text: string | null;
  buttons: any[];
  required_vars: string[];
  status: TemplateStatus;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

/** Render template with sample variables — used for preview only. */
export function previewTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}

/** Extract all {{var}} keys from a template body. */
export function extractVariableKeys(body: string): string[] {
  const set = new Set<string>();
  const rx = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(body))) set.add(m[1]);
  return Array.from(set);
}

export function statusColor(status: TemplateStatus): string {
  switch (status) {
    case 'approved': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    case 'pending':  return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    case 'rejected': return 'bg-destructive/10 text-destructive';
    default:         return 'bg-muted text-muted-foreground';
  }
}

export function normalizeKePhone(raw: string): string | null {
  if (!raw) return null;
  let p = raw.trim().replace(/[\s\-()]/g, '');
  if (p.startsWith('07') || p.startsWith('01')) p = '+254' + p.slice(1);
  else if (p.startsWith('254')) p = '+' + p;
  else if (!p.startsWith('+')) return null;
  if (!/^\+\d{10,15}$/.test(p)) return null;
  return p;
}
