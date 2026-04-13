import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GraduationCap, BookOpen, ClipboardList, TrendingUp, Calendar, AlertTriangle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LineChart, Line, Tooltip, CartesianGrid } from 'recharts';
import { useSmartDashboard } from '@/hooks/use-smart-dashboard';
import { AIInsightsPanel } from '@/components/AIInsightsPanel';
import { cn } from '@/lib/utils';

export default function Dashboard() {
  const { user, profile, role } = useAuth();
  const navigate = useNavigate();

  const { data: teacherAssignments = [] } = useQuery({
    queryKey: ['my-teacher-assignments-dash', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('teacher_assignments')
        .select('grade, stream, learning_area_id')
        .eq('teacher_id', user!.id);
      return data || [];
    },
    enabled: role === 'teacher' && !!user,
  });

  const { data: classTeacherAssignment } = useQuery({
    queryKey: ['my-class-teacher-dash', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('class_teachers')
        .select('grade, stream')
        .eq('teacher_id', user!.id)
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: role === 'teacher' && !!user,
  });

  useEffect(() => {
    if (role === 'teacher' && (teacherAssignments.length > 0 || classTeacherAssignment)) {
      navigate('/marks-entry', { replace: true });
    }
  }, [role, teacherAssignments, classTeacherAssignment, navigate]);

  const { data: insights, isLoading } = useSmartDashboard();

  const stats = [
    {
      title: 'Students',
      value: insights?.totalStudents ?? 0,
      icon: GraduationCap,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      title: 'Attendance',
      value: `${insights?.attendanceRate ?? 0}%`,
      icon: Calendar,
      color: (insights?.attendanceRate ?? 0) >= 80 ? 'text-success' : 'text-warning',
      bg: (insights?.attendanceRate ?? 0) >= 80 ? 'bg-success/10' : 'bg-warning/10',
    },
    {
      title: 'Subjects',
      value: insights?.totalSubjects ?? 0,
      icon: BookOpen,
      color: 'text-info',
      bg: 'bg-info/10',
    },
    {
      title: 'Scores',
      value: insights?.totalScores ?? 0,
      icon: ClipboardList,
      color: 'text-accent',
      bg: 'bg-accent/10',
    },
  ];

  const currentDate = new Date().toLocaleDateString('en-KE', {
    weekday: 'short', month: 'short', day: 'numeric'
  });

  return (
    <DashboardLayout>
      <div className="space-y-5 animate-fade-in">
        {/* Welcome */}
        <div>
          <h1 className="text-xl md:text-2xl font-display font-bold text-foreground">
            Hi, {profile?.full_name?.split(' ')[0]} 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{currentDate} · Here's your overview</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          {stats.map((stat) => (
            <Card key={stat.title} className="shadow-card border-border/50">
              <CardContent className="p-4">
                <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center mb-2", stat.bg)}>
                  <stat.icon className={cn("h-[18px] w-[18px]", stat.color)} />
                </div>
                <p className="text-2xl font-display font-bold text-foreground">
                  {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{stat.title}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Most Improved Students */}
        {insights && insights.mostImproved.length > 0 && (
          <Card className="shadow-card border-success/20 bg-success/[0.02]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-display font-bold flex items-center gap-2">
                <ArrowUpRight className="h-4 w-4 text-success" />
                Most Improved Students
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {insights.mostImproved.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border/50">
                    <span className="text-xs font-bold text-success w-5">{i + 1}</span>
                    <span className="text-xs font-medium flex-1 truncate">{s.name}</span>
                    <Badge variant="outline" className="text-[10px] h-5">Grade {s.grade}</Badge>
                    <span className="text-xs font-bold text-success">+{s.delta}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* At-Risk Students */}
        {insights && insights.atRisk.length > 0 && (
          <Card className="shadow-card border-destructive/20 bg-destructive/[0.02]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-display font-bold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Students at Risk
                <Badge variant="destructive" className="text-[10px] h-5 ml-auto">{insights.atRisk.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {insights.atRisk.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-destructive/10">
                    <ArrowDownRight className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
                    <span className="text-xs font-medium flex-1 truncate">{s.name}</span>
                    <span className="text-[10px] text-muted-foreground">G{s.grade} {s.stream}</span>
                    <span className="text-xs font-bold text-destructive">{s.avgScore}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Performance Trend */}
        {insights && insights.trendData.length > 1 && (
          <Card className="shadow-card border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-display font-bold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Performance Trend
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="h-[180px] -ml-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={insights.trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" domain={[0, 100]} />
                    <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, border: '1px solid hsl(var(--border))' }} />
                    <Line type="monotone" dataKey="avg" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4, fill: 'hsl(var(--primary))' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Subject Comparison */}
        {insights && insights.subjectAverages.length > 0 && (
          <Card className="shadow-card border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-display font-bold flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-info" />
                Subject Averages
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="h-[180px] -ml-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={insights.subjectAverages}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" domain={[0, 100]} />
                    <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, border: '1px solid hsl(var(--border))' }} />
                    <Bar dataKey="avg" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* AI Insights Panel */}
        {(role === 'admin' || role === 'headteacher') && <AIInsightsPanel />}

        {/* Teacher Assignments Card */}
        {role === 'teacher' && (
          <Card className="border-primary/20 bg-primary/[0.02] shadow-card">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="h-4 w-4 text-primary" />
                </div>
                <div className="space-y-2 flex-1">
                  <h3 className="text-sm font-bold font-display text-foreground">Your Assignments</h3>
                  <div className="flex flex-wrap gap-1">
                    {profile?.assigned_grades?.map(g => (
                      <Badge key={g} variant="secondary" className="text-xs">Grade {g}</Badge>
                    ))}
                    {profile?.assigned_streams?.map(s => (
                      <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
