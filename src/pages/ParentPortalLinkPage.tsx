import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, GraduationCap } from 'lucide-react';
import { getGradeForLevel, getGradePoints } from '@/lib/cbc-utils';
import performTrackLogo from '@/assets/performtrack-logo.png';

const FN_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/view-portal-link`;

export default function ParentPortalLinkPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!token) { setError('Invalid link'); setLoading(false); return; }
    (async () => {
      try {
        const res = await fetch(`${FN_URL}?token=${encodeURIComponent(token)}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Link expired or invalid');
        setData(json);
      } catch (e: any) {
        setError(e?.message || 'Could not load results');
      } finally { setLoading(false); }
    })();
  }, [token]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-6 text-center space-y-3">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
          <h2 className="font-display font-bold text-xl">Link expired or invalid</h2>
          <p className="text-sm text-muted-foreground">{error}. Please contact the school for a new link.</p>
        </CardContent>
      </Card>
    </div>
  );

  const { learner, school, results = [], total, average, term, year } = data;
  const overallGrade = results.length > 0 && average != null
    ? getGradeForLevel(average, results[0].max || 100, learner.grade)
    : null;
  const points = overallGrade ? getGradePoints(overallGrade) : 0;
  const gradeDisplay: string = overallGrade ?? '-';

  return (
    <div className="min-h-screen bg-gradient-to-br from-muted/20 to-background py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="text-center space-y-2">
          <img src={performTrackLogo} alt="PerformTrack" className="h-12 mx-auto" />
          <h1 className="font-display font-bold text-2xl">{school?.school_name || 'School'}</h1>
          {school?.county && <p className="text-sm text-muted-foreground">{school.county} County</p>}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              {learner.name}
            </CardTitle>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline">Grade {learner.grade} {learner.stream}</Badge>
              {learner.admission_number && <Badge variant="outline">Adm: {learner.admission_number}</Badge>}
              {learner.assessment_number && <Badge variant="outline">Assess #: {learner.assessment_number}</Badge>}
              <Badge variant="secondary">Term {term}, {year}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Subject</th>
                    <th className="text-center py-2">Score</th>
                    <th className="text-center py-2">Out of</th>
                    <th className="text-center py-2">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r: any, i: number) => {
                    const g = getGradeForLevel(r.score, r.max, learner.grade);
                    return (
                      <tr key={i} className="border-b last:border-b-0">
                        <td className="py-2">{r.subject}</td>
                        <td className="text-center font-medium">{r.score}</td>
                        <td className="text-center text-muted-foreground">{r.max}</td>
                        <td className="text-center"><Badge variant="outline">{g}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2 border-t">
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Total</div>
                <div className="font-display font-bold text-lg">{total}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Average</div>
                <div className="font-display font-bold text-lg">{Number(average || 0).toFixed(2)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Grade</div>
                <div className="font-display font-bold text-lg">{gradeDisplay} <span className="text-xs text-muted-foreground">({points}pts)</span></div>
              </div>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">Powered by PerformTrack · This is a secure private link.</p>
      </div>
    </div>
  );
}
