import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import type { TimetableSlot } from '@/lib/timetable-engine';

interface Props {
  grids: Record<string, TimetableSlot[][]>;
  teacherGrids: Record<string, { teacherName: string; lessonCount: number }>;
  periodsPerDay: number;
  days: string[];
  breakSlots: number;
}

export function TimetableAnalytics({ grids, teacherGrids, periodsPerDay, days, breakSlots }: Props) {
  const classes = Object.keys(grids);
  if (classes.length === 0) return null;
  const teachingPerWeek = (periodsPerDay - breakSlots) * days.length;

  let allocatedTotal = 0;
  let freeTotal = 0;
  let possibleTotal = 0;
  const classUtil: Array<{ key: string; pct: number; allocated: number; possible: number }> = [];

  for (const key of classes) {
    const grid = grids[key];
    let allocated = 0;
    grid.forEach(row => row.forEach(cell => {
      if (cell?.learningAreaName && !cell?.isBreak && !cell?.isLocked) allocated++;
    }));
    const possible = teachingPerWeek;
    possibleTotal += possible;
    allocatedTotal += allocated;
    freeTotal += Math.max(0, possible - allocated);
    classUtil.push({ key, allocated, possible, pct: possible ? Math.round((allocated/possible)*100) : 0 });
  }

  const teachers = Object.values(teacherGrids).sort((a,b)=>b.lessonCount-a.lessonCount);
  const maxLoad = Math.max(1, ...teachers.map(t => t.lessonCount));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Analytics</CardTitle>
        <CardDescription className="text-xs">Workload, utilization and balance.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Stat label="Periods allocated" value={allocatedTotal} />
          <Stat label="Free slots" value={freeTotal} />
          <Stat label="Classes" value={classes.length} />
          <Stat label="Avg utilization" value={`${possibleTotal ? Math.round((allocatedTotal/possibleTotal)*100) : 0}%`} />
        </div>

        {teachers.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-muted-foreground">Teacher workload</div>
            <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
              {teachers.slice(0, 12).map(t => (
                <div key={t.teacherName} className="flex items-center gap-2 text-xs">
                  <div className="w-32 truncate">{t.teacherName}</div>
                  <Progress value={Math.round((t.lessonCount/maxLoad)*100)} className="h-2 flex-1" />
                  <div className="w-12 text-right tabular-nums">{t.lessonCount}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {classUtil.length > 1 && (
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-muted-foreground">Class utilization</div>
            <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
              {classUtil.map(c => (
                <div key={c.key} className="flex items-center gap-2 text-xs">
                  <div className="w-32 truncate">{c.key.replace('|',' · ')}</div>
                  <Progress value={c.pct} className="h-2 flex-1" />
                  <div className="w-12 text-right tabular-nums">{c.pct}%</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border bg-card p-2.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold leading-none mt-1">{value}</div>
    </div>
  );
}
