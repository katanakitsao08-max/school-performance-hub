import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2, Users, BookX, Wand2 } from 'lucide-react';
import { useState } from 'react';

interface Props {
  conflicts: string[];
  unfilled: string[];
  teacherLessonCounts: Record<string, { name: string; count: number }>;
  maxRecommended?: number;
  onAutoFix?: () => void;
}

export function CollisionDashboard({ conflicts, unfilled, teacherLessonCounts, maxRecommended = 30, onAutoFix }: Props) {
  const [showAll, setShowAll] = useState(false);
  const overloaded = Object.values(teacherLessonCounts).filter(t => t.count > maxRecommended);
  const totalIssues = conflicts.length + unfilled.length + overloaded.length;
  const tone = totalIssues === 0 ? 'success' : totalIssues < 5 ? 'warn' : 'bad';

  return (
    <Card className={
      tone === 'success' ? 'border-emerald-500/40' :
      tone === 'warn'    ? 'border-amber-500/40' : 'border-destructive/40'
    }>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              {tone === 'success' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
              Collision Detection
            </CardTitle>
            <CardDescription className="text-xs">
              {tone === 'success' ? 'Conflict-free schedule generated.' : `${totalIssues} issue${totalIssues!==1?'s':''} to review.`}
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

        {(conflicts.length > 0 || unfilled.length > 0 || overloaded.length > 0) && (
          <div className="border rounded-lg p-2.5 bg-muted/30 text-xs">
            <ul className="space-y-0.5 list-disc pl-4">
              {(showAll ? conflicts : conflicts.slice(0, 3)).map((c, i) => <li key={`c${i}`} className="text-destructive">{c}</li>)}
              {(showAll ? unfilled : unfilled.slice(0, 3)).map((u, i) => <li key={`u${i}`} className="text-amber-700 dark:text-amber-400">{u}</li>)}
              {overloaded.slice(0, showAll ? overloaded.length : 3).map(t => (
                <li key={t.name} className="text-amber-700 dark:text-amber-400">
                  {t.name}: {t.count} lessons/wk (over {maxRecommended})
                </li>
              ))}
            </ul>
            {(conflicts.length + unfilled.length + overloaded.length) > 9 && (
              <Button size="sm" variant="link" className="h-auto p-0 mt-1.5 text-xs"
                onClick={() => setShowAll(v => !v)}>
                {showAll ? 'Show less' : `Show all ${conflicts.length + unfilled.length + overloaded.length} issues`}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number; tone: 'ok'|'warn'|'bad' }) {
  const cls =
    tone === 'ok'   ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300' :
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
