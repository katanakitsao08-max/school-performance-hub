import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, TrendingUp, TrendingDown, Minus, AlertTriangle, BookOpen, Lightbulb, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface AIAnalysis {
  overallAssessment: string;
  predictions: { studentName: string; currentAvg: number; predictedTrend: string; confidence: string; reason: string }[];
  strugglingLearners: { studentName: string; grade: string; weakSubjects: string[]; interventions: string[] }[];
  subjectInsights: { subject: string; status: string; recommendation: string }[];
  actionItems: string[];
}

export function AIInsightsPanel() {
  const { user, schoolId } = useAuth();
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [loading, setLoading] = useState(false);

  const { data: studentData } = useQuery({
    queryKey: ['ai-student-data', schoolId],
    queryFn: async () => {
      const { data: learners } = await supabase
        .from('learners')
        .select('id, full_name, grade, stream, gender')
        .eq('is_active', true);

      const { data: scores } = await supabase
        .from('scores')
        .select('learner_id, learning_area_id, score, term, year, assessment_type');

      const { data: learningAreas } = await supabase
        .from('learning_areas')
        .select('id, name');

      const laMap = Object.fromEntries((learningAreas || []).map(la => [la.id, la.name]));

      return (learners || []).map(l => {
        const studentScores = (scores || []).filter(s => s.learner_id === l.id);
        const subjectScores: Record<string, number[]> = {};
        for (const s of studentScores) {
          const name = laMap[s.learning_area_id] || 'Unknown';
          if (!subjectScores[name]) subjectScores[name] = [];
          subjectScores[name].push(Number(s.score));
        }
        const avgPerSubject = Object.fromEntries(
          Object.entries(subjectScores).map(([k, v]) => [k, Math.round(v.reduce((a, b) => a + b, 0) / v.length)])
        );
        const overallAvg = studentScores.length > 0
          ? Math.round(studentScores.reduce((a, s) => a + Number(s.score), 0) / studentScores.length)
          : null;
        return { name: l.full_name, grade: l.grade, stream: l.stream, gender: l.gender, overallAvg, subjects: avgPerSubject };
      });
    },
    enabled: !!user,
  });

  const runAnalysis = async () => {
    if (!studentData || studentData.length === 0) {
      toast({ title: 'No data', description: 'No student scores available for analysis.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-analysis', {
        body: { studentData: studentData.filter(s => s.overallAvg !== null), schoolName: 'Your School' },
      });
      if (error) throw error;
      setAnalysis(data);
    } catch (e: any) {
      toast({ title: 'Analysis failed', description: e.message || 'Could not run AI analysis', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const trendIcon = (trend: string) => {
    if (trend === 'improving') return <TrendingUp className="h-4 w-4 text-success" />;
    if (trend === 'declining') return <TrendingDown className="h-4 w-4 text-destructive" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const statusColor = (status: string) => {
    if (status === 'strong') return 'bg-success/10 text-success border-success/20';
    if (status === 'weak') return 'bg-destructive/10 text-destructive border-destructive/20';
    return 'bg-warning/10 text-warning border-warning/20';
  };

  return (
    <Card className="shadow-card border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-display font-bold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            AI Insights
          </CardTitle>
          <Button size="sm" onClick={runAnalysis} disabled={loading} className="h-8 text-xs">
            {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
            {loading ? 'Analyzing...' : analysis ? 'Refresh' : 'Run Analysis'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!analysis && !loading && (
          <p className="text-xs text-muted-foreground text-center py-4">
            Tap "Run Analysis" to get AI-powered insights on student performance, predictions, and intervention recommendations.
          </p>
        )}

        {loading && (
          <div className="flex flex-col items-center gap-2 py-6">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">Analyzing student data...</p>
          </div>
        )}

        {analysis && !loading && (
          <div className="space-y-4">
            {/* Overall Assessment */}
            <div className="p-3 rounded-xl bg-muted/50 border border-border">
              <p className="text-xs text-foreground leading-relaxed">{analysis.overallAssessment}</p>
            </div>

            {/* Predictions */}
            {analysis.predictions.length > 0 && (
              <div>
                <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Performance Predictions</h5>
                <div className="space-y-1.5">
                  {analysis.predictions.slice(0, 5).map((p, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border/50">
                      {trendIcon(p.predictedTrend)}
                      <span className="text-xs font-medium flex-1 truncate">{p.studentName}</span>
                      <span className="text-xs text-muted-foreground">{p.currentAvg}%</span>
                      <Badge variant="outline" className="text-[10px] h-5">
                        {p.confidence}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Struggling Learners */}
            {analysis.strugglingLearners.length > 0 && (
              <div>
                <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-destructive" /> Needs Intervention
                </h5>
                <div className="space-y-2">
                  {analysis.strugglingLearners.slice(0, 3).map((s, i) => (
                    <div key={i} className="p-2.5 rounded-lg bg-destructive/[0.03] border border-destructive/10">
                      <p className="text-xs font-semibold">{s.studentName} <span className="text-muted-foreground font-normal">· Grade {s.grade}</span></p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Weak in: {s.weakSubjects.join(', ')}</p>
                      <div className="mt-1.5 space-y-0.5">
                        {s.interventions.slice(0, 2).map((int, j) => (
                          <p key={j} className="text-[10px] text-foreground flex items-start gap-1">
                            <Lightbulb className="h-3 w-3 text-warning flex-shrink-0 mt-0.5" />
                            {int}
                          </p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Subject Insights */}
            {analysis.subjectInsights.length > 0 && (
              <div>
                <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                  <BookOpen className="h-3 w-3" /> Subject Analysis
                </h5>
                <div className="flex flex-wrap gap-1.5">
                  {analysis.subjectInsights.map((s, i) => (
                    <Badge key={i} variant="outline" className={cn("text-[10px]", statusColor(s.status))}>
                      {s.subject}: {s.status}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Action Items */}
            {analysis.actionItems.length > 0 && (
              <div>
                <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Action Items</h5>
                <div className="space-y-1">
                  {analysis.actionItems.slice(0, 4).map((item, i) => (
                    <p key={i} className="text-xs text-foreground flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 text-[10px] font-bold">{i + 1}</span>
                      {item}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
