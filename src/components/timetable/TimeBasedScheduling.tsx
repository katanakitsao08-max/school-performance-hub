import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Clock } from 'lucide-react';

interface Props {
  startTime: string;
  lessonDurationMin: number;
  shortBreakMin: number;
  longBreakMin: number;
  lunchMin: number;
  onChange: (patch: Partial<{
    startTime: string;
    lessonDurationMin: number;
    shortBreakMin: number;
    longBreakMin: number;
    lunchMin: number;
  }>) => void;
}

export function TimeBasedScheduling(p: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" /> Time-based scheduling</CardTitle>
        <CardDescription className="text-xs">Period times auto-calculate from these durations.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div>
          <Label className="text-xs">School start</Label>
          <Input type="time" value={p.startTime} onChange={e => p.onChange({ startTime: e.target.value })} className="h-9" />
        </div>
        <div>
          <Label className="text-xs">Lesson (min)</Label>
          <Input type="number" min={20} max={90} value={p.lessonDurationMin}
            onChange={e => p.onChange({ lessonDurationMin: Math.max(10, Number(e.target.value) || 35) })} className="h-9" />
        </div>
        <div>
          <Label className="text-xs">Short break</Label>
          <Input type="number" min={5} max={60} value={p.shortBreakMin}
            onChange={e => p.onChange({ shortBreakMin: Math.max(0, Number(e.target.value) || 20) })} className="h-9" />
        </div>
        <div>
          <Label className="text-xs">Long break</Label>
          <Input type="number" min={5} max={90} value={p.longBreakMin}
            onChange={e => p.onChange({ longBreakMin: Math.max(0, Number(e.target.value) || 20) })} className="h-9" />
        </div>
        <div>
          <Label className="text-xs">Lunch (min)</Label>
          <Input type="number" min={10} max={120} value={p.lunchMin}
            onChange={e => p.onChange({ lunchMin: Math.max(0, Number(e.target.value) || 40) })} className="h-9" />
        </div>
      </CardContent>
    </Card>
  );
}
