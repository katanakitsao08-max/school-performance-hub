import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2, Users, BookX, Wand2, ExternalLink, ArrowUpRight } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

interface Props {
  conflicts: string[];
  unfilled: string[];
  teacherLessonCounts: Record<string, { name: string; count: number }>;
  maxRecommended?: number;
  onAutoFix?: () => void;
}

// Parse conflict "Teacher {name} double-booked at {day} P{p}"
function parseConflict(s: string): { teacher?: string } {
  const m = /Teacher\s+(.+?)\s+double-booked/i.exec(s);
  return { teacher: m?.[1]?.trim() };
}
// Parse unfilled "{grade}|{stream} — {subject}: ..."
function parseUnfilled(s: string): { grade?: string; stream?: string; subject?: string } {
  const m = /^(.+?)\|(.+?)\s+—\s+(.+?):/i.exec(s);
  if (!m) return {};
  return { grade: m[1].trim(), stream: m[2].trim(), subject: m[3].trim() };
}

function conflictLink(s: string): string {
  const { teacher } = parseConflict(s);
  const q = teacher ? `?q=${encodeURIComponent(teacher)}` : '';
  return `/teacher-assignments${q}`;
}
function unfilledLink(s: string): string {
  const { grade, stream, subject } = parseUnfilled(s);
  const params = new URLSearchParams();
  if (grade) params.set('grade', grade);
  if (stream) params.set('stream', stream);
  if (subject) params.set('subject', subject);
  const qs = params.toString();
  return `/class-subjects-teachers${qs ? '?' + qs : ''}`;
}

export function CollisionDashboard({
  conflicts, unfilled, teacherLessonCounts, maxRecommended = 30, onAutoFix,
}: Props) {
  const [showAll, setShowAll] = useState(false);
  const overloaded = Object.values(teacherLessonCounts).filter(t => t.count > maxRecommended);
  const totalIssues = conflicts.length + unfilled.length + overloaded.length;
  const tone = totalIssues === 0 ? 'success' : totalIssues < 5 ? 'warn' : 'bad';

  const visibleConflicts = showAll ? conflicts : conflicts.slice(0, 3);
  const visibleUnfilled = showAll ? unfilled : unfilled.slice(0, 3);
  const visibleOverloaded = showAll ? overloaded : overloaded.slice(0, 3);

  return (
    <Card className={
      tone === 'success' ? 'border-emerald-500/40' :
      tone === 'warn' ? 'border-amber-500/40' : 'border-destructive/40'
    }>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              {tone === 'success' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
              Collision Detection
            </CardTitle>
            <CardDescription className="text-xs">
              {tone === 'success'
                ? 'Conflict-free schedule generated.'
                : `${totalIssues} issue${totalIssues !== 1 ? 's' : ''} — tap any issue to jump in and fix it.`}
            </CardDescription>
          </div>
          {onAutoFix && totalIssues > 0 && (
            <Button size="sm" variant="outline" onClick={onAutoFix}><Wand2 className="h-3.5 w-3.5 mr-1" /> Auto Fix</Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <Stat icon={Users} label="Teacher clashes" value={conflicts.length} tone={conflicts.length ? 'bad' : 'ok'} />
          <Stat icon={BookX} label="Unallocated lessons" value={unfilled.length} tone={unfilled.length ? 'warn' : 'ok'} />
          <Stat icon={Users} label="Overloaded teachers" value={overloaded.length} tone={overloaded.length ? 'warn' : 'ok'} />
        </div>

        {totalIssues > 0 && (
          <div className="border rounded-lg p-2 bg-muted/30 text-xs space-y-1">
            {visibleConflicts.map((c, i) => (
              <IssueRow key={`c${i}`} tone="bad" label={c}
                to={conflictLink(c)}
                action="Open Teacher Assignments" />
            ))}
            {visibleUnfilled.map((u, i) => (
              <IssueRow key={`u${i}`} tone="warn" label={u}
                to={unfilledLink(u)}
                action="Open Class Subjects" />
            ))}
            {visibleOverloaded.map(t => (
              <IssueRow key={t.name} tone="warn"
                label={`${t.name}: ${t.count} lessons/wk (over ${maxRecommended})`}
                to={`/teacher-assignments?q=${encodeURIComponent(t.name)}`}
                action="Rebalance" />
            ))}
            {totalIssues > 9 && (
              <Button size="sm" variant="link" className="h-auto p-0 mt-1 text-xs"
                onClick={() => setShowAll(v => !v)}>
                {showAll ? 'Show less' : `Show all ${totalIssues} issues`}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function IssueRow({ label, to, action, tone }: { label: string; to: string; action: string; tone: 'bad' | 'warn' }) {
  const textCls = tone === 'bad' ? 'text-destructive' : 'text-amber-700 dark:text-amber-400';
  return (
    <Link
      to={to}
      className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-background border border-transparent hover:border-border transition"
    >
      <span className={`flex-1 truncate ${textCls}`}>• {label}</span>
      <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-primary">
        {action} <ArrowUpRight className="h-3 w-3" />
      </span>
    </Link>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number; tone: 'ok' | 'warn' | 'bad' }) {
  const cls =
    tone === 'ok' ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300' :
    tone === 'warn' ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-300' :
                      'bg-destructive/10 border-destructive/30 text-destructive';
  return (
    <div className={`rounded-lg border p-2.5 ${cls}`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide opacity-80">
        <Icon className="h-3 w-3" />{label}
      </div>
      <div className="text-2xl font-bold leading-none mt-1">{value}</div>
    </div>
  );
}
