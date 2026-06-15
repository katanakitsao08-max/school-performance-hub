import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Activity, AlertTriangle, Building2, CheckCircle2, Download, FileSpreadsheet,
  GraduationCap, MessageSquare, RefreshCcw, Sparkles, TrendingDown, TrendingUp, Users
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fetchAllPaged } from '@/lib/fetch-all';

// ---------- helpers ----------
const COLORS = ['hsl(142 64% 28%)', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#ec4899'];

function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d; }
function startOfMonth() { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; }
function fmt(n: number) { return n.toLocaleString(); }
function pctDelta(curr: number, prev: number) {
  if (!prev) return curr ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}

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
};
const ACTION_PRETTY: Record<string, string> = {
  login: 'logged in',
  marks_entered: 'entered marks',
  report_generated: 'generated a report',
  sms_sent: 'sent SMS',
  whatsapp_sent: 'sent WhatsApp',
  learner_created: 'added a learner',
  assessment_created: 'created an assessment',
  attendance_marked: 'marked attendance',
  fee_recorded: 'recorded fees',
};

// School health score (0-100)
function healthScore(s: { logins: number; assessments: number; reports: number; sms: number }) {
  const cap = (v: number, max: number) => Math.min(100, (v / max) * 100);
  const login = cap(s.logins, 30) * 0.25;        // 30 logins/mo = full marks
  const assess = cap(s.assessments, 50) * 0.35;  // 50 assessments
  const reports = cap(s.reports, 30) * 0.25;     // 30 reports
  const comm = cap(s.sms, 100) * 0.15;           // 100 SMS
  return Math.round(login + assess + reports + comm);
}
function classify(score: number) {
  if (score >= 90) return { label: 'Highly Active', color: 'bg-success/15 text-success border-success/30' };
  if (score >= 70) return { label: 'Active', color: 'bg-primary/15 text-primary border-primary/30' };
  if (score >= 50) return { label: 'Needs Support', color: 'bg-warning/15 text-warning border-warning/30' };
  return { label: 'Inactive', color: 'bg-destructive/15 text-destructive border-destructive/30' };
}

// ---------- page ----------
export default function SuperAdminAnalyticsPage() {
  const [tab, setTab] = useState('overview');
  const queryClient = useQueryClient();
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Base data
  const { data: schools = [] } = useQuery({
    queryKey: ['ssa-schools'],
    queryFn: async () => {
      const { data } = await supabase.from('schools').select('*').order('school_name');
      return data || [];
    },
  });

  const { data: activity = [], refetch: refetchActivity } = useQuery({
    queryKey: ['ssa-activity-30d'],
    queryFn: async () => fetchAllPaged<any>(() => supabase.from('user_activity_log').select('*').gte('created_at', daysAgo(60).toISOString()).order('created_at', { ascending: false })),
    refetchInterval: 30000,
  });

  const { data: smsLogs = [] } = useQuery({
    queryKey: ['ssa-sms-90d'],
    queryFn: async () => fetchAllPaged<any>(() => supabase.from('sms_logs').select('*').gte('created_at', daysAgo(90).toISOString())),
  });

  const { data: scoresRecent = [] } = useQuery({
    queryKey: ['ssa-scores-60d'],
    queryFn: async () => fetchAllPaged<any>(() => supabase.from('scores').select('school_id, created_at').gte('created_at', daysAgo(60).toISOString())),
  });

  const { data: learnersAgg } = useQuery({
    queryKey: ['ssa-learners-count'],
    queryFn: async () => {
      const { count } = await supabase.from('learners').select('*', { count: 'exact', head: true }).eq('is_active', true);
      return count || 0;
    },
  });

  const { data: usersAgg } = useQuery({
    queryKey: ['ssa-users-count'],
    queryFn: async () => {
      const { count } = await supabase.from('user_roles').select('*', { count: 'exact', head: true });
      return count || 0;
    },
  });

  const { data: alerts = [], refetch: refetchAlerts } = useQuery({
    queryKey: ['ssa-alerts'],
    queryFn: async () => {
      const { data } = await supabase.from('platform_alerts').select('*').order('created_at', { ascending: false }).limit(200);
      return data || [];
    },
  });

  // Realtime live feed
  const [liveFeed, setLiveFeed] = useState<any[]>([]);
  useEffect(() => {
    setLiveFeed(activity.slice(0, 50));
  }, [activity]);
  useEffect(() => {
    const bump = () => setLastUpdate(new Date());
    const ch = supabase
      .channel('ssa-analytics-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_activity_log' }, (p) => {
        setLiveFeed((prev) => [p.new as any, ...prev].slice(0, 100));
        queryClient.invalidateQueries({ queryKey: ['ssa-activity-30d'] });
        bump();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scores' }, () => {
        queryClient.invalidateQueries({ queryKey: ['ssa-scores-60d'] });
        bump();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sms_logs' }, () => {
        queryClient.invalidateQueries({ queryKey: ['ssa-sms-90d'] });
        bump();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schools' }, () => {
        queryClient.invalidateQueries({ queryKey: ['ssa-schools'] });
        bump();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'platform_alerts' }, () => {
        queryClient.invalidateQueries({ queryKey: ['ssa-alerts'] });
        bump();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'learners' }, () => {
        queryClient.invalidateQueries({ queryKey: ['ssa-learners-count'] });
        bump();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_roles' }, () => {
        queryClient.invalidateQueries({ queryKey: ['ssa-users-count'] });
        bump();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [queryClient]);

  // ---------- derived overview metrics ----------
  const overview = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth();
    const prevMonthStart = new Date(monthStart); prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);

    const inWin = (d: string, from: Date, to: Date = now) => {
      const t = new Date(d).getTime();
      return t >= from.getTime() && t <= to.getTime();
    };

    const recentSchoolIds = new Set(activity.filter(a => a.school_id && inWin(a.created_at, daysAgo(30))).map(a => a.school_id));
    const dau = new Set(activity.filter(a => a.action === 'login' && inWin(a.created_at, daysAgo(1))).map(a => a.user_id)).size;
    const wau = new Set(activity.filter(a => a.action === 'login' && inWin(a.created_at, daysAgo(7))).map(a => a.user_id)).size;
    const mau = new Set(activity.filter(a => a.action === 'login' && inWin(a.created_at, daysAgo(30))).map(a => a.user_id)).size;

    const reportsThis = activity.filter(a => a.action === 'report_generated' && inWin(a.created_at, monthStart)).length;
    const reportsPrev = activity.filter(a => a.action === 'report_generated' && inWin(a.created_at, prevMonthStart, monthStart)).length;
    const assessThis = scoresRecent.filter(s => inWin(s.created_at, monthStart)).length;
    const assessPrev = scoresRecent.filter(s => inWin(s.created_at, prevMonthStart, monthStart)).length;
    const smsThis = smsLogs.filter(s => inWin(s.created_at, monthStart)).length;
    const smsPrev = smsLogs.filter(s => inWin(s.created_at, prevMonthStart, monthStart)).length;

    return {
      totalSchools: schools.length,
      activeSchools: recentSchoolIds.size,
      inactiveSchools: schools.length - recentSchoolIds.size,
      totalUsers: usersAgg || 0,
      dau, wau, mau,
      totalLearners: learnersAgg || 0,
      reportsThis, reportsPrev,
      assessThis, assessPrev,
      smsThis, smsPrev,
    };
  }, [activity, schools, smsLogs, scoresRecent, usersAgg, learnersAgg]);

  // ---------- school activity rows ----------
  const schoolRows = useMemo(() => {
    const monthStart = startOfMonth();
    const byId = new Map<string, any>();
    schools.forEach(s => byId.set(s.id, {
      ...s,
      logins: 0, assessments: 0, reports: 0, sms: 0, last: null as string | null, users: 0,
    }));
    activity.forEach(a => {
      const row = byId.get(a.school_id); if (!row) return;
      if (new Date(a.created_at) >= monthStart) {
        if (a.action === 'login') row.logins += 1;
        if (a.action === 'report_generated') row.reports += 1;
      }
      if (!row.last || new Date(a.created_at) > new Date(row.last)) row.last = a.created_at;
    });
    scoresRecent.forEach(s => {
      const row = byId.get(s.school_id); if (!row) return;
      if (new Date(s.created_at) >= monthStart) row.assessments += 1;
    });
    smsLogs.forEach(s => {
      const row = byId.get(s.school_id); if (!row) return;
      if (new Date(s.created_at) >= monthStart) row.sms += 1;
    });
    return Array.from(byId.values()).map(r => {
      const score = healthScore({ logins: r.logins, assessments: r.assessments, reports: r.reports, sms: r.sms });
      return { ...r, score, ...classify(score) };
    });
  }, [schools, activity, scoresRecent, smsLogs]);

  // ---------- filters ----------
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [countyFilter, setCountyFilter] = useState('all');
  const counties = useMemo(() => Array.from(new Set(schools.map(s => s.county).filter(Boolean))).sort(), [schools]);
  const filteredSchools = useMemo(() => schoolRows.filter(r =>
    (statusFilter === 'all' || r.label === statusFilter)
    && (countyFilter === 'all' || r.county === countyFilter)
    && (!search.trim() || r.school_name?.toLowerCase().includes(search.toLowerCase()))
  ).sort((a, b) => b.score - a.score), [schoolRows, search, statusFilter, countyFilter]);

  // ---------- feature usage ----------
  const featureUsage = useMemo(() => {
    const counts: Record<string, number> = {};
    activity.forEach(a => { counts[a.action] = (counts[a.action] || 0) + 1; });
    const arr = Object.entries(counts).map(([k, v]) => ({ feature: ACTION_LABEL[k] || k, count: v }));
    arr.sort((a, b) => b.count - a.count);
    return arr;
  }, [activity]);

  // ---------- communications ----------
  const commsStats = useMemo(() => {
    const total = smsLogs.length;
    const success = smsLogs.filter(s => ['sent','delivered','success'].includes(String(s.status||'').toLowerCase())).length;
    const failed = smsLogs.filter(s => ['failed','error'].includes(String(s.status||'').toLowerCase())).length;
    const cost = smsLogs.reduce((s, x) => s + (Number(x.cost) || 0), 0);
    const bySchool: Record<string, number> = {};
    smsLogs.forEach(s => { if (s.school_id) bySchool[s.school_id] = (bySchool[s.school_id] || 0) + 1; });
    const top = Object.entries(bySchool).map(([id, c]) => ({
      school: schools.find(s => s.id === id)?.school_name || 'Unknown', count: c
    })).sort((a, b) => b.count - a.count).slice(0, 10);

    const byMonth: Record<string, number> = {};
    smsLogs.forEach(s => {
      const d = new Date(s.created_at); const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      byMonth[k] = (byMonth[k] || 0) + 1;
    });
    const trend = Object.entries(byMonth).map(([month, count]) => ({ month, count })).sort((a,b) => a.month.localeCompare(b.month));
    return { total, success, failed, cost, top, trend, rate: total ? Math.round((success/total)*100) : 0 };
  }, [smsLogs, schools]);

  // ---------- adoption ----------
  const adoption = useMemo(() => {
    const monthStart = startOfMonth();
    const newThis = schools.filter(s => new Date(s.created_at) >= monthStart).length;
    const atRisk = schools.filter((s: any) => {
      if (!s.plan_expires_at) return false;
      const d = new Date(s.plan_expires_at); const diff = (d.getTime() - Date.now()) / 86400000;
      return diff > 0 && diff <= 14;
    }).length;
    const churned = schools.filter(s => s.subscription_status === 'expired').length;
    const active = schools.filter(s => s.subscription_status === 'active').length;
    return { newThis, atRisk, churned, active };
  }, [schools]);

  // ---------- AI insights (rule-based for now) ----------
  const insights = useMemo(() => {
    const out: string[] = [];
    const noReports = schoolRows.filter(r => r.reports === 0).length;
    if (noReports) out.push(`${noReports} school${noReports>1?'s':''} have not generated any reports this month.`);
    const delta = pctDelta(overview.smsThis, overview.smsPrev);
    if (Math.abs(delta) >= 10) out.push(`SMS usage ${delta>0?'increased':'decreased'} by ${Math.abs(delta)}% vs last month.`);
    const aDelta = pctDelta(overview.assessThis, overview.assessPrev);
    if (Math.abs(aDelta) >= 10) out.push(`Assessment entry ${aDelta>0?'rose':'fell'} by ${Math.abs(aDelta)}% this month.`);
    // top county
    const cMap: Record<string, number> = {};
    schoolRows.forEach(r => { if (r.county) cMap[r.county] = (cMap[r.county]||0) + r.score; });
    const top = Object.entries(cMap).sort((a,b) => b[1]-a[1])[0];
    if (top) out.push(`${top[0]} County schools show the highest engagement.`);
    const inactive = schoolRows.filter(r => r.label === 'Inactive').length;
    if (inactive) out.push(`${inactive} school${inactive>1?'s are':' is'} currently inactive and may need outreach.`);
    if (!out.length) out.push('All schools are tracking within healthy ranges this month.');
    return out;
  }, [schoolRows, overview]);

  // ---------- alert generation ----------
  const runAlertChecks = async () => {
    const toInsert: any[] = [];
    schoolRows.forEach(r => {
      const lastDays = r.last ? Math.round((Date.now() - new Date(r.last).getTime()) / 86400000) : 999;
      if (lastDays >= 14) toInsert.push({ school_id: r.id, kind: 'inactive_14d', severity: 'warning', message: `${r.school_name} inactive for ${lastDays} days` });
      if (r.assessments === 0) toInsert.push({ school_id: r.id, kind: 'no_assessments_term', severity: 'warning', message: `${r.school_name} has no assessments entered this month` });
      if (r.reports === 0) toInsert.push({ school_id: r.id, kind: 'no_reports_term', severity: 'info', message: `${r.school_name} has not generated reports this month` });
    });
    if (!toInsert.length) { toast.info('No new alerts to generate'); return; }
    const { error } = await supabase.from('platform_alerts').insert(toInsert);
    if (error) toast.error(error.message); else { toast.success(`Generated ${toInsert.length} alerts`); refetchAlerts(); }
  };

  const resolveAlert = async (id: string) => {
    await supabase.from('platform_alerts').update({ resolved_at: new Date().toISOString() }).eq('id', id);
    refetchAlerts();
  };

  // ---------- exports ----------
  const exportSchoolsXlsx = () => {
    const rows = filteredSchools.map(r => ({
      School: r.school_name, County: r.county, Type: r.school_type, Users: r.users,
      'Last Activity': r.last ? new Date(r.last).toLocaleString() : 'Never',
      Logins: r.logins, Assessments: r.assessments, Reports: r.reports, SMS: r.sms,
      'Score': r.score, Status: r.label,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Schools');
    XLSX.writeFile(wb, `school-activity-${new Date().toISOString().slice(0,10)}.xlsx`);
  };
  const exportSchoolsPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.text('PerformTrack — School Activity Report', 14, 14);
    autoTable(doc, {
      startY: 20,
      head: [['School','County','Last Activity','Logins','Assess.','Reports','SMS','Score','Status']],
      body: filteredSchools.map(r => [
        r.school_name, r.county || '-',
        r.last ? new Date(r.last).toLocaleDateString() : 'Never',
        r.logins, r.assessments, r.reports, r.sms, r.score, r.label,
      ]),
      styles: { fontSize: 8 },
    });
    doc.save(`school-activity-${new Date().toISOString().slice(0,10)}.pdf`);
  };

  // ---------- render ----------
  return (
    <DashboardLayout>
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold">Platform Analytics</h1>
            <p className="text-sm text-muted-foreground">360° view of school engagement, usage and health</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1.5 border-success/30 bg-success/10 text-success">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              Live · {lastUpdate.toLocaleTimeString()}
            </Badge>
            <Button size="sm" variant="outline" onClick={() => { refetchActivity(); setLastUpdate(new Date()); }}><RefreshCcw className="h-4 w-4 mr-1" />Refresh</Button>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="schools">Schools</TabsTrigger>
            <TabsTrigger value="features">Features</TabsTrigger>
            <TabsTrigger value="live">Live Feed</TabsTrigger>
            <TabsTrigger value="comms">Comms</TabsTrigger>
            <TabsTrigger value="adoption">Adoption</TabsTrigger>
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>

          {/* OVERVIEW */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { t: 'Total Schools', v: overview.totalSchools, i: Building2 },
                { t: 'Active (30d)', v: overview.activeSchools, i: CheckCircle2 },
                { t: 'Inactive', v: overview.inactiveSchools, i: AlertTriangle },
                { t: 'Total Users', v: overview.totalUsers, i: Users },
                { t: 'DAU', v: overview.dau, i: Activity },
                { t: 'WAU', v: overview.wau, i: Activity },
                { t: 'MAU', v: overview.mau, i: Activity },
                { t: 'Total Learners', v: overview.totalLearners, i: GraduationCap },
              ].map((s, i) => (
                <Card key={i}><CardContent className="p-4">
                  <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{s.t}</span><s.i className="h-4 w-4 text-primary" /></div>
                  <p className="text-2xl font-bold mt-1">{fmt(s.v)}</p>
                </CardContent></Card>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { t: 'Reports this month', v: overview.reportsThis, d: pctDelta(overview.reportsThis, overview.reportsPrev) },
                { t: 'Assessments this month', v: overview.assessThis, d: pctDelta(overview.assessThis, overview.assessPrev) },
                { t: 'SMS sent this month', v: overview.smsThis, d: pctDelta(overview.smsThis, overview.smsPrev) },
              ].map((s, i) => (
                <Card key={i}><CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{s.t}</p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <p className="text-2xl font-bold">{fmt(s.v)}</p>
                    <span className={`text-xs flex items-center ${s.d >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {s.d >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />} {Math.abs(s.d)}%
                    </span>
                  </div>
                </CardContent></Card>
              ))}
            </div>

            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">System Uptime</p>
              <p className="text-xs mt-1">Infrastructure metrics (uptime, API latency, DB performance) are not yet instrumented. Connect an APM provider to enable.</p>
            </CardContent></Card>
          </TabsContent>

          {/* SCHOOLS */}
          <TabsContent value="schools" className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Input placeholder="Search school…" value={search} onChange={e => setSearch(e.target.value)} className="h-9 max-w-xs text-xs" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-40 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="Highly Active">Highly Active</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Needs Support">Needs Support</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <Select value={countyFilter} onValueChange={setCountyFilter}>
                <SelectTrigger className="h-9 w-40 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All counties</SelectItem>
                  {counties.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex gap-2 ml-auto">
                <Button size="sm" variant="outline" onClick={exportSchoolsXlsx}><FileSpreadsheet className="h-4 w-4 mr-1" />Excel</Button>
                <Button size="sm" variant="outline" onClick={exportSchoolsPdf}><Download className="h-4 w-4 mr-1" />PDF</Button>
              </div>
            </div>
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>School</TableHead><TableHead>County</TableHead><TableHead>Last Activity</TableHead>
                  <TableHead className="text-right">Logins</TableHead><TableHead className="text-right">Assess.</TableHead>
                  <TableHead className="text-right">Reports</TableHead><TableHead className="text-right">SMS</TableHead>
                  <TableHead className="text-right">Score</TableHead><TableHead>Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filteredSchools.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs font-medium">{r.school_name}</TableCell>
                      <TableCell className="text-xs">{r.county || '-'}</TableCell>
                      <TableCell className="text-xs">{r.last ? new Date(r.last).toLocaleDateString() : <span className="text-muted-foreground">Never</span>}</TableCell>
                      <TableCell className="text-xs text-right">{r.logins}</TableCell>
                      <TableCell className="text-xs text-right">{r.assessments}</TableCell>
                      <TableCell className="text-xs text-right">{r.reports}</TableCell>
                      <TableCell className="text-xs text-right">{r.sms}</TableCell>
                      <TableCell className="text-xs text-right font-bold">{r.score}</TableCell>
                      <TableCell><Badge variant="outline" className={`text-xs ${r.color}`}>{r.label}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {!filteredSchools.length && <TableRow><TableCell colSpan={9} className="text-center text-xs text-muted-foreground py-6">No schools match.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>

          {/* FEATURES */}
          <TabsContent value="features" className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Usage by Module (60d)</CardTitle></CardHeader><CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={featureUsage}><XAxis dataKey="feature" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="count" fill="hsl(142 64% 28%)" /></BarChart>
                </ResponsiveContainer>
              </CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Share of Activity</CardTitle></CardHeader><CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart><Pie data={featureUsage} dataKey="count" nameKey="feature" outerRadius={90} label>{featureUsage.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart>
                </ResponsiveContainer>
              </CardContent></Card>
            </div>
            <Card><CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div><p className="text-muted-foreground">Most Used</p><p className="font-semibold">{featureUsage[0]?.feature || '-'}</p></div>
              <div><p className="text-muted-foreground">Least Used</p><p className="font-semibold">{featureUsage[featureUsage.length-1]?.feature || '-'}</p></div>
              <div><p className="text-muted-foreground">Total Actions</p><p className="font-semibold">{fmt(activity.length)}</p></div>
              <div><p className="text-muted-foreground">Adoption (any feature)</p><p className="font-semibold">{schools.length ? Math.round((schoolRows.filter(s => s.logins+s.assessments+s.reports+s.sms>0).length/schools.length)*100) : 0}%</p></div>
            </CardContent></Card>
          </TabsContent>

          {/* LIVE */}
          <TabsContent value="live" className="space-y-3">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><span className="inline-block w-2 h-2 rounded-full bg-success animate-pulse" /> Live Activity Feed</CardTitle></CardHeader><CardContent>
              <div className="space-y-2 max-h-[500px] overflow-auto">
                {liveFeed.map((e, i) => {
                  const sch = schools.find(s => s.id === e.school_id);
                  return (
                    <div key={e.id || i} className="flex items-start gap-2 p-2 rounded bg-muted/40 text-xs">
                      <Activity className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                      <div className="flex-1">
                        <p><span className="font-medium">{e.role || 'User'}</span> {ACTION_PRETTY[e.action] || e.action} {sch ? <>at <span className="font-medium">{sch.school_name}</span></> : null}</p>
                        <p className="text-muted-foreground">{new Date(e.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                  );
                })}
                {!liveFeed.length && <p className="text-xs text-center text-muted-foreground py-6">Waiting for activity…</p>}
              </div>
            </CardContent></Card>
          </TabsContent>

          {/* COMMS */}
          <TabsContent value="comms" className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total SMS (90d)</p><p className="text-2xl font-bold">{fmt(commsStats.total)}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Success Rate</p><p className="text-2xl font-bold">{commsStats.rate}%</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Failed</p><p className="text-2xl font-bold text-destructive">{fmt(commsStats.failed)}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Cost (KES)</p><p className="text-2xl font-bold">{fmt(Math.round(commsStats.cost))}</p></CardContent></Card>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Monthly Trend</CardTitle></CardHeader><CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={commsStats.trend}><XAxis dataKey="month" tick={{fontSize:10}} /><YAxis tick={{fontSize:10}} /><Tooltip /><Line type="monotone" dataKey="count" stroke="hsl(142 64% 28%)" /></LineChart>
                </ResponsiveContainer>
              </CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Top Schools by SMS</CardTitle></CardHeader><CardContent>
                <Table><TableBody>
                  {commsStats.top.map((t, i) => (
                    <TableRow key={i}><TableCell className="text-xs">{t.school}</TableCell><TableCell className="text-xs text-right">{fmt(t.count)}</TableCell></TableRow>
                  ))}
                  {!commsStats.top.length && <TableRow><TableCell className="text-xs text-center text-muted-foreground py-4">No SMS data</TableCell></TableRow>}
                </TableBody></Table>
              </CardContent></Card>
            </div>
          </TabsContent>

          {/* ADOPTION */}
          <TabsContent value="adoption" className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">New Schools (month)</p><p className="text-2xl font-bold">{adoption.newThis}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Active Subs</p><p className="text-2xl font-bold text-success">{adoption.active}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">At Risk (≤14d)</p><p className="text-2xl font-bold text-warning">{adoption.atRisk}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Churned/Expired</p><p className="text-2xl font-bold text-destructive">{adoption.churned}</p></CardContent></Card>
            </div>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">School Growth</CardTitle></CardHeader><CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={(() => {
                  const m: Record<string, number> = {};
                  schools.forEach(s => { const d = new Date(s.created_at); const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; m[k] = (m[k]||0)+1; });
                  return Object.entries(m).map(([month,count]) => ({month,count})).sort((a,b)=>a.month.localeCompare(b.month));
                })()}>
                  <XAxis dataKey="month" tick={{fontSize:10}} /><YAxis tick={{fontSize:10}} /><Tooltip /><Line type="monotone" dataKey="count" stroke="hsl(142 64% 28%)" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent></Card>
          </TabsContent>

          {/* ALERTS */}
          <TabsContent value="alerts" className="space-y-3">
            <div className="flex justify-end"><Button size="sm" onClick={runAlertChecks}><AlertTriangle className="h-4 w-4 mr-1" />Run checks now</Button></div>
            <Card><CardContent className="p-0"><Table>
              <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Kind</TableHead><TableHead>Message</TableHead><TableHead>Severity</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {alerts.filter((a: any) => !a.resolved_at).map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-xs">{new Date(a.created_at).toLocaleString()}</TableCell>
                    <TableCell className="text-xs">{a.kind}</TableCell>
                    <TableCell className="text-xs">{a.message}</TableCell>
                    <TableCell className="text-xs"><Badge variant="outline" className="capitalize">{a.severity}</Badge></TableCell>
                    <TableCell><Button size="sm" variant="ghost" onClick={() => resolveAlert(a.id)}>Resolve</Button></TableCell>
                  </TableRow>
                ))}
                {!alerts.filter((a:any)=>!a.resolved_at).length && <TableRow><TableCell colSpan={5} className="text-xs text-center text-muted-foreground py-6">No open alerts. Run checks to scan now.</TableCell></TableRow>}
              </TableBody>
            </Table></CardContent></Card>
          </TabsContent>

          {/* INSIGHTS */}
          <TabsContent value="insights" className="space-y-3">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />Automated Insights</CardTitle></CardHeader><CardContent>
              <ul className="space-y-2">
                {insights.map((s, i) => (
                  <li key={i} className="text-sm p-3 rounded-lg bg-primary/5 border border-primary/20">{s}</li>
                ))}
              </ul>
            </CardContent></Card>
          </TabsContent>

          {/* REPORTS */}
          <TabsContent value="reports" className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { name: 'School Activity Report', export: exportSchoolsXlsx, pdf: exportSchoolsPdf },
                { name: 'SMS Usage Report', export: () => {
                  const ws = XLSX.utils.json_to_sheet(smsLogs);
                  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'SMS');
                  XLSX.writeFile(wb, 'sms-usage.xlsx');
                }},
                { name: 'User Activity Report', export: () => {
                  const ws = XLSX.utils.json_to_sheet(activity);
                  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Activity');
                  XLSX.writeFile(wb, 'user-activity.xlsx');
                }},
                { name: 'Feature Usage Report', export: () => {
                  const ws = XLSX.utils.json_to_sheet(featureUsage);
                  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Features');
                  XLSX.writeFile(wb, 'feature-usage.xlsx');
                }},
              ].map((r, i) => (
                <Card key={i}><CardContent className="p-4 flex items-center justify-between">
                  <p className="text-sm font-medium">{r.name}</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={r.export}><FileSpreadsheet className="h-4 w-4 mr-1" />Excel</Button>
                    {r.pdf && <Button size="sm" variant="outline" onClick={r.pdf}><Download className="h-4 w-4 mr-1" />PDF</Button>}
                  </div>
                </CardContent></Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
