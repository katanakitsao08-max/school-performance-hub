import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GraduationCap, BookOpen, CalendarCheck, TrendingUp, User } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getGrade } from '@/lib/cbc-utils';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { cn } from '@/lib/utils';

export default function ParentDashboard() {
  const { user, profile } = useAuth();

  // Fetch linked children
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

  const { data: allScores = [] } = useQuery({
    queryKey: ['parent-scores', children.map(c => c.id)],
    queryFn: async () => {
      const ids = children.map(c => c.id);
      const { data } = await supabase
        .from('scores')
        .select('*, learning_areas!scores_learning_area_id_fkey(name)')
        .in('learner_id', ids);
      return data || [];
    },
    enabled: children.length > 0,
  });

  const { data: allAttendance = [] } = useQuery({
    queryKey: ['parent-attendance', children.map(c => c.id)],
    queryFn: async () => {
      const ids = children.map(c => c.id);
      const { data } = await supabase
        .from('attendance')
        .select('*')
        .in('learner_id', ids)
        .order('date', { ascending: false })
        .limit(100);
      return data || [];
    },
    enabled: children.length > 0,
  });

  const gradeColor = (grade: string) => {
    if (grade.startsWith('EE')) return 'bg-success/10 text-success border-success/20';
    if (grade.startsWith('ME')) return 'bg-info/10 text-info border-info/20';
    if (grade.startsWith('AE')) return 'bg-warning/10 text-warning border-warning/20';
    return 'bg-destructive/10 text-destructive border-destructive/20';
  };

  return (
    <DashboardLayout>
      <div className="space-y-5 animate-fade-in">
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
          <Tabs defaultValue={children[0]?.id} className="space-y-4">
            {children.length > 1 && (
              <TabsList className="w-full">
                {children.map(child => (
                  <TabsTrigger key={child.id} value={child.id} className="flex-1 text-xs">
                    {child.full_name.split(' ')[0]}
                  </TabsTrigger>
                ))}
              </TabsList>
            )}

            {children.map(child => {
              const childScores = allScores.filter(s => s.learner_id === child.id);
              const childAttendance = allAttendance.filter(a => a.learner_id === child.id);
              const presentCount = childAttendance.filter(a => a.status === 'present').length;
              const attendancePct = childAttendance.length > 0 ? Math.round((presentCount / childAttendance.length) * 100) : 0;

              // Subject averages
              const subjectMap: Record<string, { name: string; scores: number[] }> = {};
              for (const s of childScores) {
                const name = (s as any).learning_areas?.name || 'Unknown';
                if (!subjectMap[name]) subjectMap[name] = { name, scores: [] };
                subjectMap[name].scores.push(Number(s.score));
              }
              const subjectAvgs = Object.values(subjectMap).map(s => ({
                name: s.name.length > 10 ? s.name.substring(0, 10) : s.name,
                avg: Math.round(s.scores.reduce((a, b) => a + b, 0) / s.scores.length),
              }));

              const overallAvg = childScores.length > 0
                ? Math.round(childScores.reduce((a, s) => a + Number(s.score), 0) / childScores.length)
                : 0;
              const overallGrade = getCBCGrade(overallAvg);

              return (
                <TabsContent key={child.id} value={child.id} className="space-y-4">
                  {/* Child Info */}
                  <Card className="shadow-card">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center">
                          <GraduationCap className="h-6 w-6 text-primary-foreground" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-display font-bold text-foreground">{child.full_name}</h3>
                          <p className="text-xs text-muted-foreground">Grade {child.grade} · {child.stream} · {child.gender}</p>
                        </div>
                        <Badge className={cn("text-xs", gradeColor(overallGrade))}>{overallGrade}</Badge>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Quick Stats */}
                  <div className="grid grid-cols-3 gap-3">
                    <Card className="shadow-card">
                      <CardContent className="p-3 text-center">
                        <p className="text-xl font-display font-bold text-foreground">{overallAvg}%</p>
                        <p className="text-[10px] text-muted-foreground">Average</p>
                      </CardContent>
                    </Card>
                    <Card className="shadow-card">
                      <CardContent className="p-3 text-center">
                        <p className={cn("text-xl font-display font-bold", attendancePct >= 80 ? "text-success" : "text-warning")}>{attendancePct}%</p>
                        <p className="text-[10px] text-muted-foreground">Attendance</p>
                      </CardContent>
                    </Card>
                    <Card className="shadow-card">
                      <CardContent className="p-3 text-center">
                        <p className="text-xl font-display font-bold text-foreground">{childScores.length}</p>
                        <p className="text-[10px] text-muted-foreground">Assessments</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Subject Performance */}
                  {subjectAvgs.length > 0 && (
                    <Card className="shadow-card">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-display font-bold flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-info" />
                          Subject Performance
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[200px] -ml-2">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={subjectAvgs}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis dataKey="name" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" domain={[0, 100]} />
                              <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                              <Bar dataKey="avg" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        {/* Subject list */}
                        <div className="mt-3 space-y-1.5">
                          {Object.values(subjectMap).map(s => {
                            const avg = Math.round(s.scores.reduce((a, b) => a + b, 0) / s.scores.length);
                            const grade = getCBCGrade(avg);
                            return (
                              <div key={s.name} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50">
                                <span className="text-xs font-medium">{s.name}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">{avg}%</span>
                                  <Badge variant="outline" className={cn("text-[10px] h-5", gradeColor(grade))}>{grade}</Badge>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Recent Attendance */}
                  {childAttendance.length > 0 && (
                    <Card className="shadow-card">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-display font-bold flex items-center gap-2">
                          <CalendarCheck className="h-4 w-4 text-accent" />
                          Recent Attendance
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-1.5">
                          {childAttendance.slice(0, 21).map(a => (
                            <div
                              key={a.id}
                              className={cn(
                                "w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold",
                                a.status === 'present' ? 'bg-success/10 text-success' :
                                a.status === 'absent' ? 'bg-destructive/10 text-destructive' :
                                'bg-warning/10 text-warning'
                              )}
                              title={`${a.date}: ${a.status}`}
                            >
                              {new Date(a.date).getDate()}
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-4 mt-3 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded bg-success/30" /> Present</span>
                          <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded bg-destructive/30" /> Absent</span>
                          <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded bg-warning/30" /> Late</span>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}
