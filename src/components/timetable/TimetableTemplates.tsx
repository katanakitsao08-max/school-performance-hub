import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LayoutTemplate, Check } from 'lucide-react';
import { TIMETABLE_TEMPLATES, type TimetableTemplate } from '@/lib/timetable-templates';

interface Props {
  active?: string | null;
  onApply: (t: TimetableTemplate) => void;
}

export function TimetableTemplates({ active, onApply }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><LayoutTemplate className="h-4 w-4" /> Templates</CardTitle>
        <CardDescription className="text-xs">One click applies start time, durations, breaks & rules.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid sm:grid-cols-3 gap-2">
          {TIMETABLE_TEMPLATES.map(t => {
            const isActive = active === t.id;
            return (
              <button key={t.id} type="button" onClick={() => onApply(t)}
                className={`text-left rounded-lg border p-3 transition active:scale-[0.98] ${
                  isActive ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'hover:bg-accent/40'
                }`}>
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-sm">{t.name}</div>
                  {isActive && <Check className="h-4 w-4 text-primary" />}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">{t.description}</div>
                <div className="flex gap-1 mt-2 flex-wrap">
                  <Badge variant="outline" className="text-[10px]">{t.startTime}</Badge>
                  <Badge variant="outline" className="text-[10px]">{t.lessonDurationMin}min</Badge>
                  <Badge variant="outline" className="text-[10px]">{t.periodsPerDay} slots</Badge>
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
