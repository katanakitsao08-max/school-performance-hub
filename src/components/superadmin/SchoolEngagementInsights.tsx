import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Activity, Building2, BarChart3 } from 'lucide-react';
import { fetchAllPaged } from '@/lib/fetch-all';

const ACTION_LABEL: Record<string, string> = {
  login: 'Logins',
  marks_entered: 'Marks Entry',
  report_generated: 'Reports',
  sms_sent: 'SMS',
  whatsapp_sent: 'WhatsApp',
  learner_created: 'Learners',
  assessment_created: 'Assessments',
  attendance_marked: 'Attendance',
  fee_recorded: 'Fees',
  logout: 'Logouts',
};

function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d; }

interface Props {
  schools: any[];
}

export default function SchoolEngagementInsights({ schools }: Props) {
  const { data: activity = [] } = useQuery({
    queryKey: ['ssa-engagement-30d'],
    queryFn: async () => fetchAllPaged<any>(() =>
      supabase.from('user_activity_log').select('school_id, action, created_at, user_id')
        .gte('created_at', daysAgo(30).toISOString())
        .order('created_at', { ascending: false })
    ),
    refetchInterval: 60000,
  });

  const { activeSchools, topPages } = useMemo(() => {
    const sevenDaysAgo = daysAgo(7).getTime();
    const schoolMap = new Map<string, { logins: number; events: number; users: Set<string>; last: number }>();
    const pageMap: Record<string, number> = {};

    activity.forEach((a: any) => {
      const ts = new Date(a.created_at).getTime();
      // page/action usage (30d)
      pageMap[a.action] = (pageMap[a.action] || 0) + 1;
      // active schools (7d)
      if (a.school_id && ts >= sevenDaysAgo) {
        const row = schoolMap.get(a.school_id) || { logins: 0, events: 0, users: new Set<string>(), last: 0 };
        row.events += 1;
        if (a.action === 'login') row.logins += 1;
        if (a.user_id) row.users.add(a.user_id);
        if (ts > row.last) row.last = ts;
        schoolMap.set(a.school_id, row);
      }
    });

    const activeSchools = Array.from(schoolMap.entries()).map(([id, v]) => {
      const s = schools.find(x => x.id === id);
      return {
        id,
        name: s?.school_name || 'Unknown school',
        county: s?.county || '—',
        logins: v.logins,
        events: v.events,
        users: v.users.size,
        last: v.last,
      };
    }).sort((a, b) => b.events - a.events).slice(0, 10);

    const topPages = Object.entries(pageMap)
      .map(([action, count]) => ({ action, label: ACTION_LABEL[action] || action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return { activeSchools, topPages };
  }, [activity, schools]);

  const maxPage = topPages[0]?.count || 1;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-display font-semibold flex items-center gap-2">
            <Building2 className="h-4 w-4 text-success" /> Active Schools
            <Badge variant="outline" className="ml-auto text-xs">Last 7 days</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeSchools.length === 0 ? (
            <p className="text-xs text-center text-muted-foreground py-6">No school activity in the last 7 days.</p>
          ) : (
            <div className="space-y-2">
              {activeSchools.map(s => (
                <div key={s.id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-muted/50">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{s.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {s.county} • {s.users} user{s.users === 1 ? '' : 's'} • last active {new Date(s.last).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs shrink-0">
                    <span className="text-muted-foreground">{s.logins} login{s.logins === 1 ? '' : 's'}</span>
                    <Badge className="bg-success/15 text-success border-success/30" variant="outline">{s.events} actions</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-display font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" /> Most Used Pages
            <Badge variant="outline" className="ml-auto text-xs">Last 30 days</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topPages.length === 0 ? (
            <p className="text-xs text-center text-muted-foreground py-6">No usage data yet.</p>
          ) : (
            <div className="space-y-2.5">
              {topPages.map(p => {
                const pct = Math.round((p.count / maxPage) * 100);
                return (
                  <div key={p.action} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground flex items-center gap-1.5">
                        <Activity className="h-3 w-3 text-primary" />{p.label}
                      </span>
                      <span className="text-muted-foreground">{p.count.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground mt-3">
            Insights are collected for product improvement. No personal content is stored.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
