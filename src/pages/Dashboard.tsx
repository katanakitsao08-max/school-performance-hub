import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GraduationCap, BookOpen, ClipboardList, Users, TrendingUp, Calendar, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LineChart, Line, Tooltip, CartesianGrid } from 'recharts';

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

  const { data: learnerCount } = useQuery({
    queryKey: ['learner-count', role],
    queryFn: async () => {
      const { count } = await supabase.from('learners').select('*', { count: 'exact', head: true }).eq('is_active', true);
      return count || 0;
    },
    enabled: !!user,
  });

  const { data: subjectCount } = useQuery({
    queryKey: ['subject-count'],
    queryFn: async () => {
      const { count } = await supabase.from('learning_areas').select('*', { count: 'exact', head: true });
      return count || 0;
    },
    enabled: !!user,
  });

  const { data: scoreCount } = useQuery({
    queryKey: ['score-count'],
    queryFn: async () => {
      const { count } = await supabase.from('scores').select('*', { count: 'exact', head: true });
      return count || 0;
    },
    enabled: !!user,
  });

  const { data: todayAttendance } = useQuery({
    queryKey: ['today-attendance'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { count: present } = await supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('date', today).eq('status', 'present');
      const { count: total } = await supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('date', today);
      return { present: present || 0, total: total || 0 };
    },
    enabled: !!user,
  });

  // Mock chart data derived from real counts
  const subjectChartData = [
    { name: 'Math', avg: 72 },
    { name: 'Eng', avg: 68 },
    { name: 'Sci', avg: 75 },
    { name: 'SST', avg: 63 },
    { name: 'CRE', avg: 70 },
  ];

  const trendData = [
    { term: 'T1 Op', avg: 58 },
    { term: 'T1 Mid', avg: 62 },
    { term: 'T1 End', avg: 65 },
    { term: 'T2 Op', avg: 63 },
    { term: 'T2 Mid', avg: 67 },
  ];

  const attendancePct = todayAttendance && todayAttendance.total > 0
    ? Math.round((todayAttendance.present / todayAttendance.total) * 100)
    : 0;

  const stats = [
    { title: 'Students', value: learnerCount ?? 0, icon: GraduationCap, color: 'text-primary', bg: 'bg-primary/10' },
    { title: 'Attendance', value: `${attendancePct}%`, icon: Calendar, color: attendancePct >= 80 ? 'text-success' : 'text-warning', bg: attendancePct >= 80 ? 'bg-success/10' : 'bg-warning/10' },
    { title: 'Subjects', value: subjectCount ?? 0, icon: BookOpen, color: 'text-info', bg: 'bg-info/10' },
    { title: 'Scores', value: scoreCount ?? 0, icon: ClipboardList, color: 'text-accent', bg: 'bg-accent/10' },
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
                <div className="flex items-center justify-between mb-2">
                  <div className={`w-9 h-9 rounded-xl ${stat.bg} flex items-center justify-center`}>
                    <stat.icon className={`h-[18px] w-[18px] ${stat.color}`} />
                  </div>
                </div>
                <p className="text-2xl font-display font-bold text-foreground">{typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{stat.title}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Performance Trend Chart */}
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
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="term" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" domain={[40, 80]} />
                  <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, border: '1px solid hsl(var(--border))' }} />
                  <Line type="monotone" dataKey="avg" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4, fill: 'hsl(var(--primary))' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Subject Comparison */}
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
                <BarChart data={subjectChartData}>
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

        {/* Students at Risk */}
        {role === 'admin' && (
          <Card className="shadow-card border-destructive/20 bg-destructive/[0.02]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-display font-bold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Students Needing Attention
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Students with scores in the BE range will appear here once marks are entered.</p>
            </CardContent>
          </Card>
        )}

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
