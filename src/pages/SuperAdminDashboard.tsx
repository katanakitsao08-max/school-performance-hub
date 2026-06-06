import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Building2, Users, GraduationCap, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import RevenueSubscriptionSection from '@/components/superadmin/RevenueSubscriptionSection';
import SchoolFeatureTogglesSection from '@/components/superadmin/SchoolFeatureTogglesSection';
import LearningPathSubscriptionsSection from '@/components/superadmin/LearningPathSubscriptionsSection';
import SuperAdminSmsSection from '@/components/superadmin/SuperAdminSmsSection';
import SubscriptionRemindersSection from '@/components/superadmin/SubscriptionRemindersSection';
import SuperAdminSmsRemindersSection from '@/components/superadmin/SuperAdminSmsRemindersSection';

export default function SuperAdminDashboard() {
  const { user } = useAuth();

  const { data: schools = [] } = useQuery({
    queryKey: ['all-schools'],
    queryFn: async () => {
      const { data, error } = await supabase.from('schools').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: totalTeachers = 0 } = useQuery({
    queryKey: ['total-teachers'],
    queryFn: async () => {
      const { count } = await supabase.from('user_roles').select('*', { count: 'exact', head: true }).in('role', ['teacher', 'admin', 'headteacher']);
      return count || 0;
    },
    enabled: !!user,
  });

  const { data: totalLearners = 0 } = useQuery({
    queryKey: ['total-learners'],
    queryFn: async () => {
      const { count } = await supabase.from('learners').select('*', { count: 'exact', head: true }).eq('is_active', true);
      return count || 0;
    },
    enabled: !!user,
  });

  const activeSchools = schools.filter(s => s.subscription_status === 'active').length;
  const trialSchools = schools.filter(s => s.subscription_status === 'trial').length;
  const expiredSchools = schools.filter(s => s.subscription_status === 'expired').length;

  const stats = [
    { title: 'Total Schools', value: schools.length, icon: Building2, iconBg: 'bg-primary/10', iconColor: 'text-primary' },
    { title: 'Total Staff', value: totalTeachers, icon: Users, iconBg: 'bg-info/10', iconColor: 'text-info' },
    { title: 'Total Learners', value: totalLearners, icon: GraduationCap, iconBg: 'bg-warning/10', iconColor: 'text-warning' },
    { title: 'Active Subscriptions', value: activeSchools, icon: CheckCircle2, iconBg: 'bg-success/10', iconColor: 'text-success' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Super Admin Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Overview of all schools on the platform</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card key={stat.title} className="group hover:shadow-card-hover transition-shadow">
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-success/30">
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-success" />
              <div>
                <p className="text-2xl font-bold">{activeSchools}</p>
                <p className="text-xs text-muted-foreground">Active Schools</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-warning/30">
            <CardContent className="p-4 flex items-center gap-3">
              <Clock className="h-8 w-8 text-warning" />
              <div>
                <p className="text-2xl font-bold">{trialSchools}</p>
                <p className="text-xs text-muted-foreground">Trial Schools</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-destructive/30">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <div>
                <p className="text-2xl font-bold">{expiredSchools}</p>
                <p className="text-xs text-muted-foreground">Expired Schools</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Schools */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-display font-semibold">Recent Schools</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {schools.slice(0, 5).map(school => (
                <div key={school.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium text-foreground text-sm">{school.school_name}</p>
                      <p className="text-xs text-muted-foreground">{school.school_code} • {school.county}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    school.subscription_status === 'active' ? 'bg-success/10 text-success' :
                    school.subscription_status === 'trial' ? 'bg-warning/10 text-warning' :
                    'bg-destructive/10 text-destructive'
                  }`}>
                    {school.subscription_status}
                  </span>
                </div>
              ))}
              {schools.length === 0 && (
                <p className="text-center text-muted-foreground py-4">No schools registered yet</p>
              )}
            </div>
          </CardContent>
        </Card>
        {/* New: Revenue & Subscriptions (additive, non-destructive) */}
        <RevenueSubscriptionSection schools={schools} />

        {/* New: Per-school feature toggles (additive) */}
        <SchoolFeatureTogglesSection schools={schools} />

        {/* Learning Path subscriptions (manual M-Pesa approval) */}
        <LearningPathSubscriptionsSection />

        {/* New: SMS management (additive) */}
        <SuperAdminSmsSection schools={schools} />

        {/* New: WhatsApp Subscription Reminders (click-to-send) */}
        <SubscriptionRemindersSection schools={schools} />
      </div>
    </DashboardLayout>
  );
}
