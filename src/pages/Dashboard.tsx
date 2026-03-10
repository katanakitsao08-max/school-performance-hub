import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GraduationCap, BookOpen, ClipboardList, Users, TrendingUp, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export default function Dashboard() {
  const { user, profile, role } = useAuth();

  const assignedGrades = profile?.assigned_grades || [];
  const assignedStreams = profile?.assigned_streams || [];
  const assignedSubjects = profile?.assigned_learning_areas || [];

  const { data: learnerCount } = useQuery({
    queryKey: ['learner-count', role, assignedGrades],
    queryFn: async () => {
      let q = supabase.from('learners').select('*', { count: 'exact', head: true }).eq('is_active', true);
      if (role === 'teacher' && assignedGrades.length > 0) {
        q = q.in('grade', assignedGrades);
      }
      const { count } = await q;
      return count || 0;
    },
    enabled: !!user,
  });

  const { data: subjectCount } = useQuery({
    queryKey: ['subject-count', role, assignedGrades],
    queryFn: async () => {
      let q = supabase.from('learning_areas').select('*', { count: 'exact', head: true });
      if (role === 'teacher' && assignedGrades.length > 0) {
        q = q.in('grade', assignedGrades);
      }
      const { count } = await q;
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

  const { data: streamCount } = useQuery({
    queryKey: ['stream-count'],
    queryFn: async () => {
      const { count } = await supabase.from('streams').select('*', { count: 'exact', head: true });
      return count || 0;
    },
    enabled: !!user,
  });

  const stats = [
    { 
      title: 'Active Learners', 
      value: learnerCount ?? 0, 
      icon: GraduationCap, 
      gradient: 'from-primary to-primary/80',
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
    },
    { 
      title: 'Learning Areas', 
      value: subjectCount ?? 0, 
      icon: BookOpen, 
      gradient: 'from-info to-info/80',
      iconBg: 'bg-info/10',
      iconColor: 'text-info',
    },
    { 
      title: 'Scores Entered', 
      value: scoreCount ?? 0, 
      icon: ClipboardList, 
      gradient: 'from-warning to-warning/80',
      iconBg: 'bg-warning/10',
      iconColor: 'text-warning',
    },
    { 
      title: 'Streams', 
      value: streamCount ?? 0, 
      icon: Users, 
      gradient: 'from-accent to-accent/80',
      iconBg: 'bg-accent/10',
      iconColor: 'text-accent',
    },
  ];

  const currentDate = new Date().toLocaleDateString('en-KE', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">
              Welcome back, {profile?.full_name?.split(' ')[0]} 👋
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Here's what's happening in your school today</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>{currentDate}</span>
          </div>
        </div>

        {/* Teacher assignments */}
        {role === 'teacher' && (
          <Card className="border-primary/20 bg-primary/[0.02]">
            <CardContent className="py-4 px-5">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <TrendingUp className="h-4 w-4 text-primary" />
                </div>
                <div className="space-y-2 flex-1">
                  <h3 className="text-sm font-semibold text-foreground">Your Assignments</h3>
                  <div className="flex flex-wrap gap-3">
                    <div>
                      <span className="text-xs text-muted-foreground block mb-1">Grades</span>
                      <div className="flex flex-wrap gap-1">
                        {assignedGrades.length > 0 ? assignedGrades.map(g => (
                          <Badge key={g} variant="secondary" className="text-xs">Grade {g}</Badge>
                        )) : <span className="text-xs text-muted-foreground italic">None</span>}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block mb-1">Streams</span>
                      <div className="flex flex-wrap gap-1">
                        {assignedStreams.length > 0 ? assignedStreams.map(s => (
                          <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                        )) : <span className="text-xs text-muted-foreground italic">None</span>}
                      </div>
                    </div>
                    {assignedSubjects.length > 0 && (
                      <div>
                        <span className="text-xs text-muted-foreground block mb-1">Subjects</span>
                        <div className="flex flex-wrap gap-1">
                          {assignedSubjects.map(s => (
                            <Badge key={s} className="text-xs bg-info/10 text-info border-info/20">{s}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card key={stat.title} className="group hover:shadow-card-hover transition-shadow duration-200">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                <div className={`w-9 h-9 rounded-lg ${stat.iconBg} flex items-center justify-center`}>
                  <stat.icon className={`h-4 w-4 ${stat.iconColor}`} />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl sm:text-3xl font-display font-bold text-foreground">{stat.value.toLocaleString()}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions for Admin */}
        {role === 'admin' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-display font-semibold">Quick Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <GraduationCap className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">Learner Management</p>
                    <p className="text-xs text-muted-foreground">Admissions, promotions & records</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <ClipboardList className="h-5 w-5 text-info" />
                  <div>
                    <p className="font-medium text-foreground">Assessment Entry</p>
                    <p className="text-xs text-muted-foreground">CBC marks & grading</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <TrendingUp className="h-5 w-5 text-success" />
                  <div>
                    <p className="font-medium text-foreground">Reports & Analytics</p>
                    <p className="text-xs text-muted-foreground">Performance insights</p>
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
