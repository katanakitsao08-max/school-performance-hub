import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, GraduationCap, BookOpen, ClipboardList } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export default function Dashboard() {
  const { profile, role } = useAuth();

  const { data: learnerCount } = useQuery({
    queryKey: ['learner-count'],
    queryFn: async () => {
      const { count } = await supabase.from('learners').select('*', { count: 'exact', head: true }).eq('is_active', true);
      return count || 0;
    },
  });

  const { data: subjectCount } = useQuery({
    queryKey: ['subject-count'],
    queryFn: async () => {
      const { count } = await supabase.from('learning_areas').select('*', { count: 'exact', head: true });
      return count || 0;
    },
  });

  const { data: scoreCount } = useQuery({
    queryKey: ['score-count'],
    queryFn: async () => {
      const { count } = await supabase.from('scores').select('*', { count: 'exact', head: true });
      return count || 0;
    },
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
