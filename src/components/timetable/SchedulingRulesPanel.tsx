import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings2 } from 'lucide-react';
import type { SchedulingRules } from '@/lib/timetable-templates';

interface Props {
  rules: SchedulingRules;
  onChange: (rules: SchedulingRules) => void;
}

const TOGGLES: { key: keyof SchedulingRules; label: string; hint: string }[] = [
  { key: 'reserveGames',                  label: 'Reserve Games periods',           hint: 'Lock last 2 slots as GAMES.' },
  { key: 'allowDoubleLessons',            label: 'Allow double lessons',            hint: 'Permit back-to-back same subject.' },
  { key: 'preventSameSubjectConsecutive', label: 'Prevent same subject consecutively', hint: 'Disable doubles entirely.' },
  { key: 'spreadPracticals',              label: 'Spread practical subjects',        hint: 'Avoid clustering Science/Art etc.' },
  { key: 'lockAssemblies',                label: 'Lock assemblies',                  hint: 'Reserve Monday P1 for assembly.' },
  { key: 'respectTeacherAvailability',    label: 'Respect teacher availability',     hint: 'Skip teacher unavailable slots.' },
];

export function SchedulingRulesPanel({ rules, onChange }: Props) {
  const set = <K extends keyof SchedulingRules>(k: K, v: SchedulingRules[K]) =>
    onChange({ ...rules, [k]: v });
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Settings2 className="h-4 w-4" /> Scheduling rules</CardTitle>
        <CardDescription className="text-xs">Apply during generation. Toggle what fits your school.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid sm:grid-cols-2 gap-2">
          {TOGGLES.map(t => {
            const checked = !!rules[t.key];
            return (
              <label key={t.key} className={`flex items-start gap-2 rounded-lg border p-2.5 cursor-pointer transition ${checked ? 'border-primary bg-primary/5' : 'hover:bg-accent/40'}`}>
                <input type="checkbox" className="h-4 w-4 mt-0.5 accent-primary"
                  checked={checked}
                  onChange={e => set(t.key, e.target.checked as never)} />
                <div className="min-w-0">
                  <div className="text-sm font-medium">{t.label}</div>
                  <div className="text-[11px] text-muted-foreground">{t.hint}</div>
                </div>
              </label>
            );
          })}
        </div>
        <div className="flex items-center gap-3 pt-2 border-t mt-2">
          <Label className="text-xs whitespace-nowrap">Limit teacher load / day</Label>
          <Input type="number" min={0} max={12} className="h-9 w-24"
            value={rules.limitTeacherLoadPerDay}
            onChange={e => set('limitTeacherLoadPerDay', Math.max(0, Number(e.target.value) || 0))} />
          <span className="text-[11px] text-muted-foreground">0 = no cap</span>
        </div>
      </CardContent>
    </Card>
  );
}
