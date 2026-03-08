import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GraduationCap, BookOpen, ClipboardList } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export default function Dashboard() {
  const { user, profile, role } = useAuth();

  const assignedGrades = profile?.assigned_grades || [];
  const assignedStreams = profile?.assigned_streams || [];

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

  const stats = [
    { title: 'Active Learners', value: learnerCount ?? 0, icon: GraduationCap, color: 'text-primary' },
    { title: 'Learning Areas', value: subjectCount ?? 0, icon: BookOpen, color: 'text-info' },
    { title: 'Scores Entered', value: scoreCount ?? 0, icon: ClipboardList, color: 'text-warning' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-display font-bold">Welcome, {profile?.full_name}</h1>
          <p className="text-muted-foreground capitalize">{role} Dashboard</p>
        </div>

        {role === 'teacher' && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Your Assignments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-sm text-muted-foreground">Grades:</span>
                {assignedGrades.length > 0 ? assignedGrades.map(g => (
                  <Badge key={g} variant="secondary">Grade {g}</Badge>
                )) : <span className="text-sm text-muted-foreground italic">None assigned</span>}
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-sm text-muted-foreground">Streams:</span>
                {assignedStreams.length > 0 ? assignedStreams.map(s => (
                  <Badge key={s} variant="outline">{s}</Badge>
                )) : <span className="text-sm text-muted-foreground italic">None assigned</span>}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {stats.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-display font-bold">{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
