import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolGrades } from '@/hooks/use-school-grades';
import { TERMS, ASSESSMENT_TYPES, ASSESSMENT_TYPE_LABELS, getGradeForLevel, getGradeColor } from '@/lib/cbc-utils';
import { TrendingUp, TrendingDown, Minus, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadClassPerformancePdf, downloadIndividualPerformancePdf } from '@/lib/performance-tracking-pdf';

export default function PerformanceTrackingPage() {
  const { user, schoolId } = useAuth();
  const dynamicGrades = useSchoolGrades();
  const currentYear = new Date().getFullYear();

  const [selectedGrade, setSelectedGrade] = useState(dynamicGrades[0] || '1');
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedLearnerId, setSelectedLearnerId] = useState<string | null>(null);
  const [trackingMode, setTrackingMode] = useState<'individual' | 'class' | 'grade'>('class');

  const { data: schoolName } = useQuery({
    queryKey: ['school-name', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('schools').select('school_name').eq('id', schoolId!).single();
      return data?.school_name || '';
    },
    enabled: !!schoolId,
  });

  const { data: dbStreams = [] } = useQuery({
    queryKey: ['streams', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('streams').select('name').eq('school_id', schoolId!).order('name');
      return (data || []).map((s: any) => s.name as string);
    },
    enabled: !!schoolId,
  });

  const [selectedStream, setSelectedStream] = useState('');
  useMemo(() => { if (dbStreams.length > 0 && !selectedStream) setSelectedStream(dbStreams[0]); }, [dbStreams]);

  const { data: learners = [] } = useQuery({
    queryKey: ['tracking-learners', selectedGrade, selectedStream],
    queryFn: async () => {
      const { data } = await supabase.from('learners').select('*')
        .eq('grade', selectedGrade).eq('stream', selectedStream)
        .eq('is_active', true).eq('school_id', schoolId!)
        .order('full_name');
      return data || [];
    },
    enabled: !!schoolId && !!selectedStream,
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['tracking-subjects', selectedGrade, schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('learning_areas').select('*')
        .eq('grade', selectedGrade).eq('is_active', true).eq('school_id', schoolId!)
        .order('name');
      return data || [];
    },
    enabled: !!schoolId,
  });

  // Fetch ALL scores for the year (all terms, all assessment types)
  const { data: allScores = [] } = useQuery({
    queryKey: ['tracking-scores', selectedGrade, selectedStream, selectedYear],
    queryFn: async () => {
      const ids = learners.map(l => l.id);
      if (!ids.length) return [];
      const { data } = await supabase.from('scores').select('*')
        .in('learner_id', ids).eq('year', selectedYear);
      return data || [];
    },
    enabled: learners.length > 0,
  });

  // Build performance matrix: for each term+assessment, compute mean per learner
  const performanceData = useMemo(() => {
    if (!learners.length || !subjects.length) return [];

    const raw = learners.map(l => {
      const learnerScores = allScores.filter(s => s.learner_id === l.id);
      const termData: Record<string, Record<string, { mean: number; total: number; count: number }>> = {};

      let grandTotal = 0;
      let grandCount = 0;

      TERMS.forEach(term => {
        ASSESSMENT_TYPES.forEach(at => {
          const scores = learnerScores.filter(s => s.term === term && (s.assessment_type || 'end_term') === at);
          const total = scores.reduce((sum, s) => sum + s.score, 0);
          const count = scores.length;
          const mean = count > 0 ? total / count : 0;
          if (!termData[`T${term}`]) termData[`T${term}`] = {};
          termData[`T${term}`][at] = { mean, total, count };
          grandTotal += total;
          grandCount += count;
        });
      });

      const average = grandCount > 0 ? grandTotal / grandCount : 0;
      return { ...l, termData, grandTotal, average, rank: 0, hasAnyScore: grandCount > 0 };
    }).filter(l => l.hasAnyScore); // Exclude learners with no marks entered in any subject

    // Sort by average descending to assign ranks
    const sorted = [...raw].sort((a, b) => b.average - a.average);
    sorted.forEach((l, i) => { l.rank = i + 1; });
    // Map ranks back
    const rankMap: Record<string, number> = {};
    sorted.forEach(l => { rankMap[l.id] = l.rank; });
    raw.forEach(l => { l.rank = rankMap[l.id]; });

    return raw;
  }, [learners, allScores, subjects]);

  const selectedLearner = selectedLearnerId ? performanceData.find(l => l.id === selectedLearnerId) : null;

  // Class averages per term+assessment
  const classAverages = useMemo(() => {
    const avgs: Record<string, Record<string, number>> = {};
    TERMS.forEach(term => {
      avgs[`T${term}`] = {};
      ASSESSMENT_TYPES.forEach(at => {
        const means = performanceData.map(l => l.termData[`T${term}`]?.[at]?.mean || 0).filter(m => m > 0);
        avgs[`T${term}`][at] = means.length > 0 ? means.reduce((a, b) => a + b, 0) / means.length : 0;
      });
    });
    return avgs;
  }, [performanceData]);

  const getTrend = (current: number, previous: number) => {
    if (!previous || !current) return null;
    const diff = current - previous;
    if (diff > 2) return <TrendingUp className="h-4 w-4 text-emerald-500 inline" />;
    if (diff < -2) return <TrendingDown className="h-4 w-4 text-red-500 inline" />;
    return <Minus className="h-4 w-4 text-muted-foreground inline" />;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-display font-bold">Performance Tracking</h1>
          <p className="text-muted-foreground text-sm">Track learner performance across assessments and terms</p>
        </div>

        <div className="flex gap-4 flex-wrap items-end">
          <div className="space-y-1">
            <Label className="text-xs">Mode</Label>
            <Select value={trackingMode} onValueChange={v => setTrackingMode(v as any)}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="class">Class</SelectItem>
                <SelectItem value="individual">Individual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Grade</Label>
            <Select value={selectedGrade} onValueChange={setSelectedGrade}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>{dynamicGrades.map(g => <SelectItem key={g} value={g}>Grade {g}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Stream</Label>
            <Select value={selectedStream} onValueChange={setSelectedStream}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>{dbStreams.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Year</Label>
            <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
              <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {trackingMode === 'individual' && (
            <div className="space-y-1">
              <Label className="text-xs">Learner</Label>
              <Select value={selectedLearnerId || ''} onValueChange={setSelectedLearnerId}>
                <SelectTrigger className="w-[200px]"><SelectValue placeholder="Select learner" /></SelectTrigger>
                <SelectContent>{learners.map(l => <SelectItem key={l.id} value={l.id}>{l.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
        </div>

        {trackingMode === 'class' && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Class Performance Across Assessments — Grade {selectedGrade} {selectedStream}, {selectedYear}</CardTitle>
              <Button size="sm" variant="outline" onClick={() => downloadClassPerformancePdf(performanceData, classAverages, selectedGrade, selectedStream, selectedYear, schoolName)}>
                <Download className="h-4 w-4 mr-1" /> PDF
              </Button>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="min-w-[50px]">#</TableHead>
                    <TableHead className="min-w-[150px]">Learner</TableHead>
                    {TERMS.map(term =>
                      ASSESSMENT_TYPES.map(at => (
                        <TableHead key={`T${term}-${at}`} className="text-center min-w-[70px] text-xs">
                          T{term} {ASSESSMENT_TYPE_LABELS[at]}
                        </TableHead>
                      ))
                    )}
                    <TableHead className="text-center min-w-[60px] font-bold">Total</TableHead>
                    <TableHead className="text-center min-w-[60px] font-bold">Avg</TableHead>
                    <TableHead className="text-center min-w-[50px] font-bold">Rank</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {performanceData.map((l, idx) => (
                    <TableRow key={l.id}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell className="font-medium">{l.full_name}</TableCell>
                      {TERMS.map(term => {
                        let prevMean = 0;
                        return ASSESSMENT_TYPES.map(at => {
                          const d = l.termData[`T${term}`]?.[at];
                          const mean = d?.mean || 0;
                          const trend = getTrend(mean, prevMean);
                          prevMean = mean || prevMean;
                          return (
                            <TableCell key={`T${term}-${at}`} className="text-center text-sm">
                              {mean > 0 ? (
                                <span className="flex items-center justify-center gap-1">
                                  {mean.toFixed(1)} {trend}
                                </span>
                              ) : '-'}
                            </TableCell>
                          );
                        });
                      })}
                      <TableCell className="text-center font-semibold">{l.grandTotal > 0 ? l.grandTotal.toFixed(1) : '-'}</TableCell>
                      <TableCell className="text-center font-semibold">{l.average > 0 ? l.average.toFixed(1) : '-'}</TableCell>
                      <TableCell className="text-center font-bold">{l.average > 0 ? l.rank : '-'}</TableCell>
                    </TableRow>
                  ))}
                  {/* Class average row */}
                  <TableRow className="bg-muted/30 font-bold border-t-2">
                    <TableCell></TableCell>
                    <TableCell>CLASS AVERAGE</TableCell>
                    {TERMS.map(term =>
                      ASSESSMENT_TYPES.map(at => (
                        <TableCell key={`avg-T${term}-${at}`} className="text-center">
                          {classAverages[`T${term}`]?.[at] > 0 ? classAverages[`T${term}`][at].toFixed(1) : '-'}
                        </TableCell>
                      ))
                    )}
                    <TableCell className="text-center">-</TableCell>
                    <TableCell className="text-center">-</TableCell>
                    <TableCell className="text-center">-</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {trackingMode === 'individual' && selectedLearner && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">{selectedLearner.full_name} — Performance Tracking {selectedYear}</CardTitle>
              <Button size="sm" variant="outline" onClick={() => downloadIndividualPerformancePdf(selectedLearner.full_name, subjects, allScores, selectedLearner.id, selectedGrade, selectedYear, schoolName)}>
                <Download className="h-4 w-4 mr-1" /> PDF
              </Button>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="min-w-[150px]">Subject</TableHead>
                    {TERMS.map(term =>
                      ASSESSMENT_TYPES.map(at => (
                        <TableHead key={`T${term}-${at}`} className="text-center min-w-[70px] text-xs">
                          T{term} {ASSESSMENT_TYPE_LABELS[at]}
                        </TableHead>
                      ))
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subjects.map(sub => (
                    <TableRow key={sub.id}>
                      <TableCell className="font-medium">{sub.name}</TableCell>
                      {TERMS.map(term => {
                        let prevScore = 0;
                        return ASSESSMENT_TYPES.map(at => {
                          const sc = allScores.find(s =>
                            s.learner_id === selectedLearner.id &&
                            s.learning_area_id === sub.id &&
                            s.term === term &&
                            (s.assessment_type || 'end_term') === at
                          );
                          const score = sc?.score || 0;
                          const grade = score > 0 ? getGradeForLevel(score, sub.max_score, selectedGrade) : null;
                          const trend = getTrend(score, prevScore);
                          prevScore = score || prevScore;
                          return (
                            <TableCell key={`${sub.id}-T${term}-${at}`} className="text-center">
                              {score > 0 ? (
                                <div className="flex flex-col items-center">
                                  <span>{score} {trend}</span>
                                  {grade && <Badge variant="outline" className={`text-[10px] ${getGradeColor(grade)}`}>{grade}</Badge>}
                                </div>
                              ) : '-'}
                            </TableCell>
                          );
                        });
                      })}
                    </TableRow>
                  ))}
                  {/* Totals row */}
                  <TableRow className="bg-muted/30 font-bold border-t-2">
                    <TableCell>TOTAL</TableCell>
                    {TERMS.map(term =>
                      ASSESSMENT_TYPES.map(at => {
                        const total = subjects.reduce((sum, sub) => {
                          const sc = allScores.find((s: any) =>
                            s.learner_id === selectedLearner.id &&
                            s.learning_area_id === sub.id &&
                            s.term === term &&
                            (s.assessment_type || 'end_term') === at
                          );
                          return sum + (sc?.score || 0);
                        }, 0);
                        return (
                          <TableCell key={`total-T${term}-${at}`} className="text-center font-bold">
                            {total > 0 ? total : '-'}
                          </TableCell>
                        );
                      })
                    )}
                  </TableRow>
                  {/* Average row */}
                  <TableRow className="bg-muted/30 font-bold">
                    <TableCell>AVERAGE</TableCell>
                    {TERMS.map(term =>
                      ASSESSMENT_TYPES.map(at => {
                        let total = 0, count = 0;
                        subjects.forEach(sub => {
                          const sc = allScores.find((s: any) =>
                            s.learner_id === selectedLearner.id &&
                            s.learning_area_id === sub.id &&
                            s.term === term &&
                            (s.assessment_type || 'end_term') === at
                          );
                          if (sc?.score) { total += sc.score; count++; }
                        });
                        const avg = count > 0 ? total / count : 0;
                        return (
                          <TableCell key={`avg-T${term}-${at}`} className="text-center font-bold">
                            {avg > 0 ? avg.toFixed(1) : '-'}
                          </TableCell>
                        );
                      })
                    )}
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {trackingMode === 'individual' && !selectedLearner && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Select a learner to view their performance tracking
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
