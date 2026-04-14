import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';

interface Props {
  child: { id: string; full_name: string };
}

export default function ParentAttendanceTab({ child }: Props) {
  const { data: attendance = [] } = useQuery({
    queryKey: ['parent-attendance', child.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('attendance')
        .select('*')
        .eq('learner_id', child.id)
        .order('date', { ascending: false })
        .limit(200);
      return data || [];
    },
  });

  const stats = useMemo(() => {
    const total = attendance.length;
    const present = attendance.filter(a => a.status === 'present').length;
    const absent = attendance.filter(a => a.status === 'absent').length;
    const late = attendance.filter(a => a.status === 'late').length;
    const pct = total > 0 ? Math.round((present / total) * 100) : 0;
    return { total, present, absent, late, pct };
  }, [attendance]);

  // Group by month
  const monthGroups = useMemo(() => {
    const groups: Record<string, typeof attendance> = {};
    attendance.forEach(a => {
      const key = a.date.substring(0, 7); // YYYY-MM
      if (!groups[key]) groups[key] = [];
      groups[key].push(a);
    });
    return Object.entries(groups).slice(0, 3); // last 3 months
  }, [attendance]);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Rate', value: `${stats.pct}%`, color: stats.pct >= 80 ? 'text-success' : 'text-warning' },
          { label: 'Present', value: stats.present, color: 'text-success' },
          { label: 'Absent', value: stats.absent, color: 'text-destructive' },
          { label: 'Late', value: stats.late, color: 'text-warning' },
        ].map(s => (
          <Card key={s.label} className="shadow-card">
            <CardContent className="p-3 text-center">
              <p className={cn("text-lg font-display font-bold", s.color)}>{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Monthly heatmap */}
      {monthGroups.map(([month, records]) => (
        <Card key={month} className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display font-bold flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-accent" />
              {new Date(month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {records.map(a => (
                <div
                  key={a.id}
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold",
                    a.status === 'present' ? 'bg-success/10 text-success' :
                    a.status === 'absent' ? 'bg-destructive/10 text-destructive' :
                    'bg-warning/10 text-warning'
                  )}
                  title={`${a.date}: ${a.status}`}
                >
                  {new Date(a.date).getDate()}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground px-1">
        <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded bg-success/30" /> Present</span>
        <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded bg-destructive/30" /> Absent</span>
        <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded bg-warning/30" /> Late</span>
      </div>
    </div>
  );
}
