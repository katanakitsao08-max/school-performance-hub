import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Activity, Users, Wifi, Globe, ShieldCheck, ShieldAlert, Clock, TrendingUp,
  GraduationCap, Building2, UserCog, BookOpen, MessageSquare, FileText, RefreshCcw,
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

type Session = {
  id: string; user_id: string; school_id: string | null; role: string | null;
  login_time: string; logout_time: string | null; last_activity: string;
  device: string | null; browser: string | null; ip_address: string | null;
};

const ROLE_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  super_admin: { label: 'SuperAdmin', icon: ShieldCheck, color: 'text-purple-600' },
  admin: { label: 'School Admin', icon: Building2, color: 'text-primary' },
  headteacher: { label: 'Headteacher', icon: UserCog, color: 'text-indigo-600' },
  teacher: { label: 'Teacher', icon: BookOpen, color: 'text-emerald-600' },
  parent: { label: 'Parent', icon: Users, color: 'text-amber-600' },
  independent_learner: { label: 'Learner', icon: GraduationCap, color: 'text-sky-600' },
};

const fiveMinAgo = () => new Date(Date.now() - 5 * 60_000).toISOString();
const dayAgo = () => new Date(Date.now() - 24 * 3600_000).toISOString();
const weekAgo = () => new Date(Date.now() - 7 * 86400_000).toISOString();

export default function LiveMonitoringSection() {
  const qc = useQueryClient();
  const [now, setNow] = useState<Date>(new Date());

  // Live sessions (active within last 5 min)
  const { data: liveSessions = [], refetch: refetchSessions } = useQuery<Session[]>({
    queryKey: ['live-sessions'],
    queryFn: async () => {
      const { data } = await supabase.from('user_sessions')
        .select('*')
        .gte('last_activity', fiveMinAgo())
        .is('logout_time', null)
        .order('last_activity', { ascending: false });
      return (data as Session[]) || [];
    },
    refetchInterval: 30_000,
  });

  // Schools index for names
  const { data: schools = [] } = useQuery({
    queryKey: ['live-schools'],
    queryFn: async () => (await supabase.from('schools').select('id, school_name')).data || [],
  });
  const schoolName = (id: string | null) =>
    (schools.find(s => s.id === id)?.school_name) ?? 'Unknown';

  // Login events 24h
  const { data: loginEvents24 = [] } = useQuery({
    queryKey: ['login-events-24h'],
    queryFn: async () => {
      const { data } = await supabase.from('login_events')
        .select('*').gte('created_at', dayAgo())
        .order('created_at', { ascending: false });
      return data || [];
    },
    refetchInterval: 60_000,
  });

  // Sessions for weekly trend (just count rows)
  const { data: weekSessions = [] } = useQuery({
    queryKey: ['week-sessions'],
    queryFn: async () => {
      const { data } = await supabase.from('user_sessions')
        .select('login_time, last_activity, logout_time, user_id')
        .gte('login_time', weekAgo());
      return data || [];
    },
    refetchInterval: 120_000,
  });

  // Activity feed (last 50)
  const { data: feed = [] } = useQuery({
    queryKey: ['live-activity-feed'],
    queryFn: async () => {
      const { data } = await supabase.from('user_activity_log')
        .select('id, action, created_at, school_id, role, metadata')
        .order('created_at', { ascending: false }).limit(50);
      return data || [];
    },
    refetchInterval: 30_000,
  });

  // Realtime updates
  useEffect(() => {
    const ch = supabase.channel('live-monitor')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_sessions' }, () => {
        qc.invalidateQueries({ queryKey: ['live-sessions'] });
        qc.invalidateQueries({ queryKey: ['week-sessions'] });
        setNow(new Date());
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_activity_log' }, () => {
        qc.invalidateQueries({ queryKey: ['live-activity-feed'] });
        setNow(new Date());
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'login_events' }, () => {
        qc.invalidateQueries({ queryKey: ['login-events-24h'] });
        setNow(new Date());
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  // Derived: role breakdown
  const byRole = useMemo(() => {
    const seen = new Map<string, string>(); // user_id -> role
    liveSessions.forEach(s => { if (!seen.has(s.user_id)) seen.set(s.user_id, s.role || 'unknown'); });
    const counts: Record<string, number> = {};
    seen.forEach(r => { counts[r] = (counts[r] || 0) + 1; });
    return counts;
  }, [liveSessions]);

  const onlineUsers = useMemo(() => new Set(liveSessions.map(s => s.user_id)).size, [liveSessions]);

  // School-wise active users
  const bySchool = useMemo(() => {
    const m = new Map<string, Set<string>>();
    liveSessions.forEach(s => {
      const k = s.school_id || '_';
      if (!m.has(k)) m.set(k, new Set());
      m.get(k)!.add(s.user_id);
    });
    return Array.from(m.entries())
      .map(([id, users]) => ({ id, name: id === '_' ? 'Platform / No school' : schoolName(id), count: users.size }))
      .sort((a, b) => b.count - a.count).slice(0, 10);
  }, [liveSessions, schools]);

  // Login analytics
  const loginStats = useMemo(() => {
    const success = loginEvents24.filter((e: any) => e.success).length;
    const failed = loginEvents24.filter((e: any) => !e.success).length;
    const byHour = Array.from({ length: 24 }, (_, h) => ({ hour: `${h}:00`, logins: 0 }));
    loginEvents24.forEach((e: any) => {
      if (!e.success) return;
      const h = new Date(e.created_at).getHours();
      byHour[h].logins += 1;
    });
    const peak = byHour.reduce((p, c) => c.logins > p.logins ? c : p, { hour: '-', logins: 0 });
    return { success, failed, byHour, peak };
  }, [loginEvents24]);

  // Average session duration & daily active users
  const sessionStats = useMemo(() => {
    const closed = weekSessions.filter((s: any) => s.logout_time);
    const avgMs = closed.length
      ? closed.reduce((sum: number, s: any) =>
          sum + (new Date(s.logout_time).getTime() - new Date(s.login_time).getTime()), 0) / closed.length
      : 0;
    const avgMin = Math.round(avgMs / 60000);

    const dauByDay: Record<string, Set<string>> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      dauByDay[d.toISOString().slice(0, 10)] = new Set();
    }
    weekSessions.forEach((s: any) => {
      const k = (s.last_activity || s.login_time).slice(0, 10);
      if (dauByDay[k]) dauByDay[k].add(s.user_id);
    });
    const dauSeries = Object.entries(dauByDay).map(([d, u]) => ({
      day: d.slice(5), users: u.size,
    }));
    return { avgMin, dauSeries, dauToday: dauSeries[dauSeries.length - 1]?.users || 0 };
  }, [weekSessions]);

  // Peak concurrent today (approximation: max distinct active users across 15-min buckets today)
  const peakConcurrent = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const buckets: Record<string, Set<string>> = {};
    weekSessions.forEach((s: any) => {
      const ts = s.last_activity || s.login_time;
      if (!ts.startsWith(today)) return;
      const d = new Date(ts);
      const m = Math.floor(d.getMinutes() / 15) * 15;
      const k = `${d.getHours()}:${String(m).padStart(2, '0')}`;
      if (!buckets[k]) buckets[k] = new Set();
      buckets[k].add(s.user_id);
    });
    let peakK = '-'; let peakV = 0;
    Object.entries(buckets).forEach(([k, set]) => {
      if (set.size > peakV) { peakV = set.size; peakK = k; }
    });
    return { time: peakK, users: peakV };
  }, [weekSessions]);

  const activeSchools = useMemo(() => {
    const counts: Record<string, number> = {};
    loginEvents24.forEach((e: any) => {
      if (!e.school_id || !e.success) return;
      counts[e.school_id] = (counts[e.school_id] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([id, c]) => ({ name: schoolName(id), count: c }))
      .sort((a, b) => b.count - a.count).slice(0, 5);
  }, [loginEvents24, schools]);

  // Activity formatting
  const formatEvent = (e: any) => {
    const map: Record<string, string> = {
      login: 'logged in',
      logout: 'logged out',
      marks_entered: 'entered marks',
      report_generated: 'generated a report',
      sms_sent: 'sent SMS',
      whatsapp_sent: 'sent WhatsApp',
      learner_created: 'added a learner',
      assessment_created: 'created an assessment',
      attendance_marked: 'marked attendance',
      fee_recorded: 'recorded fees',
    };
    return map[e.action] || e.action;
  };

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-display font-bold flex items-center gap-2">
            <Wifi className="h-5 w-5 text-success" />
            Live Users & Activity
          </h2>
          <p className="text-xs text-muted-foreground">Real-time presence, login analytics & peak traffic</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5 border-success/30 bg-success/10 text-success">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            {now.toLocaleTimeString()}
          </Badge>
          <Button size="sm" variant="outline" onClick={() => { refetchSessions(); setNow(new Date()); }}>
            <RefreshCcw className="h-4 w-4 mr-1" />Refresh
          </Button>
        </div>
      </div>

      {/* ONLINE HERO + ROLE BREAKDOWN */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="md:col-span-1 border-success/40 bg-gradient-to-br from-success/5 to-transparent">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-block w-2 h-2 rounded-full bg-success animate-pulse" />
              Users Online Now
            </div>
            <div className="text-4xl font-bold mt-2">{onlineUsers}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {liveSessions.length} active session{liveSessions.length === 1 ? '' : 's'} · last 5 min
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-2">By role</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(ROLE_LABELS).map(([key, meta]) => {
                const Icon = meta.icon;
                return (
                  <div key={key} className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
                    <Icon className={`h-4 w-4 ${meta.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] text-muted-foreground truncate">{meta.label}</div>
                      <div className="text-lg font-bold leading-tight">{byRole[key] || 0}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SYSTEM HEALTH + LOGIN STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 text-success" />Logins Today</div>
          <div className="text-2xl font-bold mt-1">{loginStats.success}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldAlert className="h-4 w-4 text-destructive" />Failed Attempts</div>
          <div className="text-2xl font-bold mt-1">{loginStats.failed}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Clock className="h-4 w-4 text-primary" />Peak Login Hour</div>
          <div className="text-2xl font-bold mt-1">{loginStats.peak.hour}</div>
          <div className="text-[11px] text-muted-foreground">{loginStats.peak.logins} logins</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><TrendingUp className="h-4 w-4 text-emerald-600" />Avg Session</div>
          <div className="text-2xl font-bold mt-1">{sessionStats.avgMin}m</div>
          <div className="text-[11px] text-muted-foreground">Last 7 days</div>
        </CardContent></Card>
      </div>

      {/* CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Users by Hour (today)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={loginStats.byHour}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="hour" interval={2} tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="logins" fill="hsl(142 64% 28%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Daily Active Users (7d)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={sessionStats.dauSeries}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="users" stroke="hsl(142 64% 28%)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* TRAFFIC + SCHOOL-WISE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" />Traffic Insights</CardTitle>
            <CardDescription className="text-xs">Highest concurrent users today</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{peakConcurrent.users}</div>
            <div className="text-xs text-muted-foreground">users at {peakConcurrent.time}</div>
            <div className="mt-2 text-xs">
              Today: <span className="font-semibold">{sessionStats.dauToday}</span> active users
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4" />School-wise Active Users</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {bySchool.length === 0 && <p className="text-xs text-muted-foreground">No active schools right now.</p>}
            {bySchool.map(s => (
              <div key={s.id} className="flex items-center justify-between text-sm">
                <span className="truncate flex-1 mr-2">{s.name}</span>
                <Badge variant="secondary">{s.count}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* MOST ACTIVE SCHOOLS TODAY */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Most Active Schools (24h logins)</CardTitle></CardHeader>
        <CardContent>
          {activeSchools.length === 0 ? (
            <p className="text-xs text-muted-foreground">No login activity in the last 24 hours.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {activeSchools.map((s, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <span className="text-sm truncate">{s.name}</span>
                  <Badge>{s.count} logins</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* LIVE ACTIVITY FEED */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4" />Live Activity Feed</CardTitle>
          <CardDescription className="text-xs">Logins, marks, reports, communications</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-80 overflow-y-auto divide-y">
            {feed.length === 0 && <p className="text-xs text-muted-foreground py-2">No recent activity.</p>}
            {feed.map((e: any) => {
              const Icon =
                e.action === 'login' || e.action === 'logout' ? ShieldCheck :
                e.action === 'sms_sent' || e.action === 'whatsapp_sent' ? MessageSquare :
                e.action === 'report_generated' ? FileText :
                e.action === 'marks_entered' || e.action === 'assessment_created' ? BookOpen :
                Activity;
              return (
                <div key={e.id} className="flex items-start gap-2 py-2">
                  <Icon className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">
                      <span className="font-medium capitalize">{e.role || 'User'}</span>{' '}
                      {formatEvent(e)}
                      {e.school_id && <span className="text-muted-foreground"> · {schoolName(e.school_id)}</span>}
                    </div>
                  </div>
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    {new Date(e.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* SESSIONS TABLE */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Globe className="h-4 w-4" />Active Sessions</CardTitle>
          <CardDescription className="text-xs">Last activity, device, browser, IP</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-muted-foreground">
              <tr><th className="p-1.5">Role</th><th>School</th><th>Device</th><th>Browser</th><th>IP</th><th>Last seen</th></tr>
            </thead>
            <tbody>
              {liveSessions.slice(0, 50).map(s => (
                <tr key={s.id} className="border-t">
                  <td className="p-1.5 capitalize">{s.role || '—'}</td>
                  <td className="truncate max-w-[160px]">{schoolName(s.school_id)}</td>
                  <td className="capitalize">{s.device || '—'}</td>
                  <td>{s.browser || '—'}</td>
                  <td>{s.ip_address || '—'}</td>
                  <td>{new Date(s.last_activity).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                </tr>
              ))}
              {liveSessions.length === 0 && (
                <tr><td colSpan={6} className="text-center text-muted-foreground py-3">No active sessions.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
