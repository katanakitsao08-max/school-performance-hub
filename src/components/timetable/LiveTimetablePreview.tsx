import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Eye } from 'lucide-react';
import type { BreakSlot } from '@/lib/timetable-templates';

interface Props {
  days: string[];
  periodsPerDay: number;
  breaks: BreakSlot[];
  periodTimes: Array<{ start: string; end: string }>;
  gamesEnabled: boolean;
}

export function LiveTimetablePreview({ days, periodsPerDay, breaks, periodTimes, gamesEnabled }: Props) {
  const breakBySlot = new Map(breaks.map(b => [b.slot, b]));
  const labelFor = (slot: number) => {
    const br = breakBySlot.get(slot);
    if (br) return { label: br.label, type: br.type as string };
    const teaching = slot - breaks.filter(b => b.slot < slot).length;
    const isGames = gamesEnabled && periodsPerDay >= 11 && (slot === periodsPerDay - 1 || slot === periodsPerDay);
    return { label: isGames ? `P${teaching} · GAMES` : `P${teaching}`, type: isGames ? 'games' : 'teaching' };
  };
  const cellClass = (t: string) =>
    t === 'lunch'   ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200' :
    t === 'long'    ? 'bg-orange-100 text-orange-900 dark:bg-orange-950/40 dark:text-orange-200' :
    t === 'short'   ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200' :
    t === 'games'   ? 'bg-blue-100 text-blue-900 dark:bg-blue-950/40 dark:text-blue-200' :
                      'bg-card';

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Eye className="h-4 w-4" /> Live preview</CardTitle>
        <CardDescription className="text-xs">Auto-updates as you change settings. Subjects appear after generation.</CardDescription>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-[11px] border-collapse min-w-[520px]">
          <thead>
            <tr className="bg-muted">
              <th className="border p-1.5 text-left sticky left-0 bg-muted z-10" rowSpan={2}>Day</th>
              {Array.from({ length: periodsPerDay }, (_, i) => {
                const info = labelFor(i + 1);
                return <th key={i} className={`border px-1 py-1 ${cellClass(info.type)}`}>{info.label}</th>;
              })}
            </tr>
            <tr className="bg-muted/60">
              {Array.from({ length: periodsPerDay }, (_, i) => {
                const t = periodTimes[i];
                return <th key={i} className="border px-1 py-0.5 text-[9px] font-normal text-muted-foreground">{t?.start && t?.end ? `${t.start}–${t.end}` : ''}</th>;
              })}
            </tr>
          </thead>
          <tbody>
            {days.map(d => (
              <tr key={d}>
                <td className="border p-1.5 font-semibold bg-muted/40 sticky left-0 z-10">{d}</td>
                {Array.from({ length: periodsPerDay }, (_, i) => {
                  const info = labelFor(i + 1);
                  return (
                    <td key={i} className={`border p-1 text-center ${cellClass(info.type)} ${info.type === 'teaching' ? 'text-muted-foreground' : 'font-semibold text-[10px]'}`}>
                      {info.type === 'teaching' ? '—' : info.label.split('·')[1]?.trim() || info.label}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
