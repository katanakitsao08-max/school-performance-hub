import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Coffee, Sandwich, Sparkles, Plus, Minus } from 'lucide-react';
import type { BreakSlot, BreakType } from '@/lib/timetable-templates';

const TYPE_META: Record<BreakType, { label: string; color: string; icon: typeof Coffee }> = {
  short: { label: 'SHORT BREAK', color: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-200', icon: Coffee },
  long:  { label: 'LONG BREAK',  color: 'bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-950/40 dark:text-orange-200', icon: Sparkles },
  lunch: { label: 'LUNCH',       color: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-200', icon: Sandwich },
};

interface Props {
  periodsPerDay: number;
  breaks: BreakSlot[];
  onChange: (breaks: BreakSlot[]) => void;
  onPeriodsChange: (n: number) => void;
}

/** Visual builder — tap a slot to toggle break / cycle through break types. */
export function VisualBreakBuilder({ periodsPerDay, breaks, onChange, onPeriodsChange }: Props) {
  const breakBySlot = new Map(breaks.map(b => [b.slot, b]));

  const cycleSlot = (slot: number) => {
    const existing = breakBySlot.get(slot);
    if (!existing) {
      const next: BreakSlot = { slot, type: 'short', label: TYPE_META.short.label };
      onChange([...breaks, next].sort((a,b)=>a.slot-b.slot));
      return;
    }
    if (existing.type === 'short') {
      onChange(breaks.map(b => b.slot === slot ? { ...b, type: 'long', label: TYPE_META.long.label } : b));
    } else if (existing.type === 'long') {
      onChange(breaks.map(b => b.slot === slot ? { ...b, type: 'lunch', label: TYPE_META.lunch.label } : b));
    } else {
      onChange(breaks.filter(b => b.slot !== slot));
    }
  };

  // Group slots visually into rows of 4 for a timeline feel.
  const rows: number[][] = [];
  for (let i = 0; i < periodsPerDay; i += 4) {
    rows.push(Array.from({ length: Math.min(4, periodsPerDay - i) }, (_, j) => i + j + 1));
  }

  const teachingCount = periodsPerDay - breaks.length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base">Day timeline</CardTitle>
            <CardDescription className="text-xs">Tap a slot to mark a break · tap again to cycle Short → Long → Lunch → off</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="icon" className="h-8 w-8"
              onClick={() => onPeriodsChange(Math.max(4, periodsPerDay - 1))} aria-label="Fewer slots">
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <Badge variant="secondary" className="font-mono">{periodsPerDay} slots</Badge>
            <Button type="button" variant="outline" size="icon" className="h-8 w-8"
              onClick={() => onPeriodsChange(Math.min(14, periodsPerDay + 1))} aria-label="More slots">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          {rows.map((row, ri) => (
            <div key={ri} className="flex gap-1.5 flex-wrap">
              {row.map(slot => {
                const br = breakBySlot.get(slot);
                if (br) {
                  const meta = TYPE_META[br.type];
                  const Icon = meta.icon;
                  return (
                    <button key={slot} type="button" onClick={() => cycleSlot(slot)}
                      className={`flex-1 min-w-[88px] rounded-lg border-2 px-2 py-2.5 text-left transition active:scale-95 ${meta.color}`}>
                      <div className="flex items-center gap-1.5">
                        <Icon className="h-3.5 w-3.5" />
                        <span className="text-[10px] font-bold tracking-wide">{meta.label}</span>
                      </div>
                      <div className="text-[10px] opacity-70 mt-0.5">Slot {slot}</div>
                    </button>
                  );
                }
                // Teaching period
                const teachingIndex = slot - breaks.filter(b => b.slot < slot).length;
                return (
                  <button key={slot} type="button" onClick={() => cycleSlot(slot)}
                    className="flex-1 min-w-[88px] rounded-lg border-2 border-dashed border-border bg-card hover:bg-accent/40 hover:border-primary/40 px-2 py-2.5 text-left transition active:scale-95">
                    <div className="text-sm font-bold text-primary">P{teachingIndex}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">Slot {slot}</div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground pt-1">
          <Badge variant="outline" className="font-mono">{teachingCount} teaching</Badge>
          <Badge variant="outline" className="font-mono">{breaks.filter(b=>b.type==='short').length} short</Badge>
          <Badge variant="outline" className="font-mono">{breaks.filter(b=>b.type==='long').length} long</Badge>
          <Badge variant="outline" className="font-mono">{breaks.filter(b=>b.type==='lunch').length} lunch</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
