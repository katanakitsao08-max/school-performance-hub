import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import ParentChildSelector from '@/components/parent/ParentChildSelector';
import ParentPerformanceTab from '@/components/parent/ParentPerformanceTab';
import ParentAttendanceTab from '@/components/parent/ParentAttendanceTab';
import ParentFeesTab from '@/components/parent/ParentFeesTab';
import ParentReportsTab from '@/components/parent/ParentReportsTab';

export default function ParentDashboard() {
  const { user, profile } = useAuth();
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab') || 'performance';
  const [activeTab, setActiveTab] = useState(tabFromUrl);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(searchParams.get('tab') || 'performance');
  }, [searchParams]);

  const { data: children = [] } = useQuery({
    queryKey: ['parent-children', user?.id],
    queryFn: async () => {
      const { data: links } = await supabase
        .from('parent_learners')
        .select('learner_id, relationship')
        .eq('parent_user_id', user!.id);
      if (!links || links.length === 0) return [];
      const ids = links.map(l => l.learner_id);
      const { data: learners } = await supabase
        .from('learners')
        .select('*')
        .in('id', ids);
      return (learners || []).map(l => ({
        ...l,
        relationship: links.find(lk => lk.learner_id === l.id)?.relationship || 'parent',
      }));
    },
    enabled: !!user,
  });

  // Auto-select first child
  const activeChildId = selectedChildId || children[0]?.id || null;
  const activeChild = children.find(c => c.id === activeChildId);

  return (
    <DashboardLayout>
      <div className="space-y-4 animate-fade-in">
        <div>
          <h1 className="text-xl font-display font-bold text-foreground">
            Welcome, {profile?.full_name?.split(' ')[0]} 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track your children's progress</p>
        </div>

        {children.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="py-10 text-center">
              <User className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No children linked to your account yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Please contact the school admin to link your child.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <ParentChildSelector
              children={children}
              activeChildId={activeChildId}
              onSelect={setSelectedChildId}
            />

            {activeChild && (
              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList className="w-full grid grid-cols-4">
                  <TabsTrigger value="performance" className="text-xs">Performance</TabsTrigger>
                  <TabsTrigger value="attendance" className="text-xs">Attendance</TabsTrigger>
                  <TabsTrigger value="fees" className="text-xs">Fees</TabsTrigger>
                  <TabsTrigger value="reports" className="text-xs">Reports</TabsTrigger>
                </TabsList>

                <TabsContent value="performance">
                  <ParentPerformanceTab child={activeChild} />
                </TabsContent>
                <TabsContent value="attendance">
                  <ParentAttendanceTab child={activeChild} />
                </TabsContent>
                <TabsContent value="fees">
                  <ParentFeesTab child={activeChild} />
                </TabsContent>
                <TabsContent value="reports">
                  <ParentReportsTab child={activeChild} />
                </TabsContent>
              </Tabs>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
