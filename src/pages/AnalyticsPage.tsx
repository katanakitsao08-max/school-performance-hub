import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TERMS, getGradeForLevel, getGradeColor, isKJSEAGradeLevel, type AnyGrade } from '@/lib/cbc-utils';
import { useSchoolGrades } from '@/hooks/use-school-grades';
import { useSchoolStreams } from '@/hooks/use-school-streams';
import { useAuth } from '@/contexts/AuthContext';
import { fetchAllPaged } from '@/lib/fetch-all';
import { computeGradeAnalysis } from '@/lib/cbc-analysis-utils';
import { GradeAnalysisTable } from '@/components/GradeAnalysisTable';
import { GradeAnalysisInsights } from '@/components/GradeAnalysisInsights';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';
import { TrendingUp, TrendingDown, Users, Award, AlertTriangle, BarChart3 } from 'lucide-react';

const PIE_COLORS = [
  'hsl(142,64%,40%)', 'hsl(142,50%,55%)',
  'hsl(210,80%,52%)', 'hsl(210,60%,65%)',
  'hsl(38,92%,50%)', 'hsl(38,75%,60%)',
  'hsl(0,84%,60%)', 'hsl(0,65%,70%)',
];

const LINE_COLORS = ['hsl(142,64%,40%)', 'hsl(210,80%,52%)', 'hsl(38,92%,50%)'];

export default function AnalyticsPage() {
  const { schoolId } = useAuth();
  const dynamicGrades = useSchoolGrades();
  const dynamicStreams = useSchoolStreams();
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedStream, setSelectedStream] = useState('all');
  const [selectedTerm, setSelectedTerm] = useState(String(TERMS[TERMS.length - 1]));
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedSubject, setSelectedSubject] = useState('all');

  const termNum = Number(selectedTerm);
  const isKJSEA = isKJSEAGradeLevel(selectedGrade);

  // ── Data queries (paged to bypass Supabase 1000-row cap) ──
  const { data: learners = [] } = useQuery({
    queryKey: ['analytics-learners', selectedGrade, selectedStream, schoolId],
    queryFn: async () => {
      const rows = await fetchAllPaged<any>(() => {
        let q = supabase.from('learners').select('*').eq('grade', selectedGrade).eq('is_active', true);
        if (selectedStream !== 'all') q = q.eq('stream', selectedStream);
        return q;
      });
      return rows;
    },
    enabled: !!selectedGrade && !!schoolId,
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['analytics-subjects', selectedGrade, schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('learning_areas').select('*').eq('grade', selectedGrade).eq('is_active', true).order('name');
      return data || [];
    },
    enabled: !!selectedGrade && !!schoolId,
  });

  // Chunk learner ids to avoid URL-length limits and page each chunk through fetchAllPaged.
  const fetchScoresForTerm = async (ids: string[], term: number | null) => {
    if (!ids.length) return [];
    const CHUNK = 200;
    const all: any[] = [];
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      const rows = await fetchAllPaged<any>(() => {
        let q = supabase.from('scores').select('*')
          .in('learner_id', chunk).eq('year', selectedYear);
        if (term !== null) q = q.eq('term', term);
        return q;
      });
      all.push(...rows);
    }
    return all;
  };

  const { data: scores = [] } = useQuery({
    queryKey: ['analytics-scores', selectedGrade, selectedStream, termNum, selectedYear, schoolId, learners.length],
    queryFn: async () => fetchScoresForTerm(learners.map(l => l.id), termNum),
    enabled: learners.length > 0,
  });

  // Trend data – all terms for the year
  const { data: allTermScores = [] } = useQuery({
    queryKey: ['analytics-trend', selectedGrade, selectedStream, selectedYear, schoolId, learners.length],
    queryFn: async () => fetchScoresForTerm(learners.map(l => l.id), null),
    enabled: learners.length > 0,
  });

  // ── Computed analytics ──

  // 1. Subject mean scores
  const subjectMeanData = useMemo(() => {
    const filtered = selectedSubject === 'all' ? subjects : subjects.filter(s => s.id === selectedSubject);
    return filtered.map(sub => {
      const subScores = scores.filter(s => s.learning_area_id === sub.id);
      const mean = subScores.length > 0 ? subScores.reduce((s, sc) => s + sc.score, 0) / subScores.length : 0;
      return { name: sub.name, mean: Number(mean.toFixed(1)), maxScore: sub.max_score, id: sub.id };
    }).sort((a, b) => b.mean - a.mean);
  }, [subjects, scores, selectedSubject]);

  // 2. Grade distribution
  const gradeDistribution = useMemo(() => {
    const dist: Record<string, number> = {};
    const levels = isKJSEA
      ? ['EE1', 'EE2', 'ME1', 'ME2', 'AE1', 'AE2', 'BE1', 'BE2']
      : ['EE', 'ME', 'AE', 'BE'];
    levels.forEach(l => { dist[l] = 0; });

    learners.forEach(l => {
      const ls = scores.filter(s => s.learner_id === l.id);
      if (!ls.length) return;
      const total = ls.reduce((s, sc) => s + sc.score, 0);
      const totalMax = ls.reduce((s, sc) => {
        const sub = subjects.find(sb => sb.id === sc.learning_area_id);
        return s + (sub?.max_score || 100);
      }, 0);
      const grade = getGradeForLevel(total, totalMax, selectedGrade);
      dist[grade] = (dist[grade] || 0) + 1;
    });
    return Object.entries(dist).map(([name, value]) => ({ name, value }));
  }, [learners, scores, subjects, selectedGrade, isKJSEA]);

  // 3. Gender performance
  const genderAnalysis = useMemo(() => {
    const genders = ['Male', 'Female'];
    return genders.map(g => {
      const gLearners = learners.filter(l => l.gender === g);
      let totalScore = 0, totalMax = 0, count = 0;
      gLearners.forEach(l => {
        const ls = scores.filter(s => s.learner_id === l.id);
        ls.forEach(sc => {
          const sub = subjects.find(sb => sb.id === sc.learning_area_id);
          totalScore += sc.score;
          totalMax += (sub?.max_score || 100);
          count++;
        });
      });
      const mean = count > 0 ? Number((totalScore / count * 100 / (totalMax / count)).toFixed(1)) : 0;
      return { gender: g, count: gLearners.length, entries: count, meanPct: mean };
    });
  }, [learners, scores, subjects]);

  // Gender per subject
  const genderBySubject = useMemo(() => {
    return subjects.map(sub => {
      const mScores = scores.filter(s => s.learning_area_id === sub.id && learners.find(l => l.id === s.learner_id && l.gender === 'Male'));
      const fScores = scores.filter(s => s.learning_area_id === sub.id && learners.find(l => l.id === s.learner_id && l.gender === 'Female'));
      const mMean = mScores.length > 0 ? Number((mScores.reduce((s, sc) => s + sc.score, 0) / mScores.length).toFixed(1)) : 0;
      const fMean = fScores.length > 0 ? Number((fScores.reduce((s, sc) => s + sc.score, 0) / fScores.length).toFixed(1)) : 0;
      return { name: sub.name, Male: mMean, Female: fMean };
    });
  }, [subjects, scores, learners]);

  // 4. Top / Bottom students
  const rankedLearners = useMemo(() => {
    return learners.map(l => {
      const ls = scores.filter(s => s.learner_id === l.id);
      const total = ls.reduce((s, sc) => s + sc.score, 0);
      const totalMax = ls.reduce((s, sc) => {
        const sub = subjects.find(sb => sb.id === sc.learning_area_id);
        return s + (sub?.max_score || 100);
      }, 0);
      const pct = totalMax > 0 ? Number((total / totalMax * 100).toFixed(1)) : 0;
      const grade: AnyGrade | '-' = ls.length > 0 ? getGradeForLevel(total, totalMax, selectedGrade) : '-';
      return { ...l, total, totalMax, pct, grade, subjectCount: ls.length };
    }).filter(l => l.subjectCount > 0).sort((a, b) => b.pct - a.pct);
  }, [learners, scores, subjects, selectedGrade]);

  const top10 = rankedLearners.slice(0, 10);
  const bottom10 = [...rankedLearners].reverse().slice(0, 10);

  // 5. Term trends
  const trendData = useMemo(() => {
    return TERMS.map(t => {
      const termScores = allTermScores.filter(s => s.term === t);
      const subjectMeans: Record<string, number> = {};
      subjects.forEach(sub => {
        const ss = termScores.filter(s => s.learning_area_id === sub.id);
        subjectMeans[sub.name] = ss.length > 0 ? Number((ss.reduce((a, sc) => a + sc.score, 0) / ss.length).toFixed(1)) : 0;
      });
      const overall = termScores.length > 0 ? Number((termScores.reduce((a, sc) => a + sc.score, 0) / termScores.length).toFixed(1)) : 0;
      return { term: `Term ${t}`, overall, ...subjectMeans };
    });
  }, [allTermScores, subjects]);

  // Summary stats
  const overallMean = rankedLearners.length > 0
    ? Number((rankedLearners.reduce((s, l) => s + l.pct, 0) / rankedLearners.length).toFixed(1))
    : 0;
  const totalScored = rankedLearners.length;
  const bestSubject = subjectMeanData.length > 0 ? subjectMeanData[0] : null;
  const weakestSubject = subjectMeanData.length > 0 ? subjectMeanData[subjectMeanData.length - 1] : null;

  return (
    <DashboardLayout>
      <div className="space-y-5 animate-fade-in">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Analytics Dashboard</h1>
          <p className="text-muted-foreground text-sm">Comprehensive school performance insights</p>
        </div>

        {/* ── Filters ── */}
        <div className="flex gap-3 flex-wrap">
          <Select value={selectedGrade} onValueChange={v => { setSelectedGrade(v); setSelectedSubject('all'); }}>
            <SelectTrigger className="w-[110px]"><SelectValue placeholder="Grade" /></SelectTrigger>
            <SelectContent>{dynamicGrades.map(g => <SelectItem key={g} value={g}>Grade {g}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={selectedStream} onValueChange={setSelectedStream}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Streams</SelectItem>
              {dynamicStreams.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selectedTerm} onValueChange={setSelectedTerm}>
            <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
            <SelectContent>{TERMS.map(t => <SelectItem key={t} value={String(t)}>Term {t}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={selectedSubject} onValueChange={setSelectedSubject}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subjects</SelectItem>
              {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {!selectedGrade && (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Select a grade to view analytics</CardContent></Card>
        )}

        {selectedGrade && (
          <>
            {/* ── Summary Cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="h-4 w-4 text-primary" />
                    <span className="text-xs text-muted-foreground">Total Scored</span>
                  </div>
                  <p className="text-2xl font-bold">{totalScored}<span className="text-sm text-muted-foreground font-normal">/{learners.length}</span></p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <BarChart3 className="h-4 w-4 text-info" />
                    <span className="text-xs text-muted-foreground">Mean %</span>
                  </div>
                  <p className="text-2xl font-bold">{overallMean}%</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="h-4 w-4 text-success" />
                    <span className="text-xs text-muted-foreground">Best Subject</span>
                  </div>
                  <p className="text-sm font-bold truncate">{bestSubject?.name || '-'}</p>
                  <p className="text-xs text-muted-foreground">{bestSubject?.mean || 0} avg</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingDown className="h-4 w-4 text-destructive" />
                    <span className="text-xs text-muted-foreground">Weakest Subject</span>
                  </div>
                  <p className="text-sm font-bold truncate">{weakestSubject?.name || '-'}</p>
                  <p className="text-xs text-muted-foreground">{weakestSubject?.mean || 0} avg</p>
                </CardContent>
              </Card>
            </div>

            {/* ── Tabbed sections ── */}
            <Tabs defaultValue="subjects" className="space-y-4">
              <TabsList className="flex-wrap h-auto">
                <TabsTrigger value="subjects">Subjects</TabsTrigger>
                <TabsTrigger value="distribution">Distribution</TabsTrigger>
                <TabsTrigger value="gender">Gender</TabsTrigger>
                <TabsTrigger value="students">Students</TabsTrigger>
                <TabsTrigger value="trends">Trends</TabsTrigger>
              </TabsList>

              {/* ── Subject Mean Scores ── */}
              <TabsContent value="subjects">
                <Card>
                  <CardHeader><CardTitle className="text-base">Subject Mean Scores</CardTitle></CardHeader>
                  <CardContent>
                    {subjectMeanData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={subjectMeanData} layout="vertical" margin={{ left: 80 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={75} />
                          <Tooltip formatter={(v: number, _n: string, p: any) => [`${v} / ${p.payload.maxScore}`, 'Mean']} />
                          <Bar dataKey="mean" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">No scores found</p>
                    )}
                    {/* Table */}
                    {subjectMeanData.length > 0 && (
                      <Table className="mt-4">
                        <TableHeader>
                          <TableRow>
                            <TableHead>#</TableHead>
                            <TableHead>Subject</TableHead>
                            <TableHead className="text-center">Mean</TableHead>
                            <TableHead className="text-center">Max</TableHead>
                            <TableHead className="text-center">%</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {subjectMeanData.map((s, i) => (
                            <TableRow key={s.id}>
                              <TableCell>{i + 1}</TableCell>
                              <TableCell className="font-medium">{s.name}</TableCell>
                              <TableCell className="text-center">{s.mean}</TableCell>
                              <TableCell className="text-center">{s.maxScore}</TableCell>
                              <TableCell className="text-center font-semibold">{(s.mean / s.maxScore * 100).toFixed(1)}%</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── Grade Distribution ── */}
              <TabsContent value="distribution">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader><CardTitle className="text-base">Grade Distribution</CardTitle></CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie data={gradeDistribution.filter(d => d.value > 0)} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                            {gradeDistribution.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle className="text-base">Distribution Table</CardTitle></CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Grade</TableHead>
                            <TableHead className="text-center">Count</TableHead>
                            <TableHead className="text-center">%</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {gradeDistribution.map(d => (
                            <TableRow key={d.name}>
                              <TableCell>
                                <Badge variant="outline" className={getGradeColor(d.name as AnyGrade)}>{d.name}</Badge>
                              </TableCell>
                              <TableCell className="text-center font-bold">{d.value}</TableCell>
                              <TableCell className="text-center">
                                {totalScored > 0 ? (d.value / totalScored * 100).toFixed(1) : 0}%
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* ── Gender Analysis ── */}
              <TabsContent value="gender">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {genderAnalysis.map(g => (
                      <Card key={g.gender}>
                        <CardContent className="pt-4 flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${g.gender === 'Male' ? 'bg-info/15 text-info' : 'bg-pink-100 text-pink-600'}`}>
                            {g.gender === 'Male' ? '♂' : '♀'}
                          </div>
                          <div>
                            <p className="font-bold text-lg">{g.gender}</p>
                            <p className="text-xs text-muted-foreground">{g.count} learners • Mean: {g.meanPct}%</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  <Card>
                    <CardHeader><CardTitle className="text-base">Gender Performance by Subject</CardTitle></CardHeader>
                    <CardContent>
                      {genderBySubject.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={genderBySubject}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="Male" fill="hsl(210,80%,52%)" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="Female" fill="hsl(330,65%,55%)" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <p className="text-center text-muted-foreground py-8">No data</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* ── Top / Bottom Students ── */}
              <TabsContent value="students">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Award className="h-4 w-4 text-success" /> Top 10 Students
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>#</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead className="text-center">%</TableHead>
                            <TableHead className="text-center">Grade</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {top10.map((l, i) => (
                            <TableRow key={l.id}>
                              <TableCell className="font-bold">{i + 1}</TableCell>
                              <TableCell className="font-medium text-sm">{l.full_name}</TableCell>
                              <TableCell className="text-center font-semibold">{l.pct}%</TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline" className={l.grade !== '-' ? getGradeColor(l.grade as AnyGrade) : ''}>{l.grade}</Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                          {top10.length === 0 && (
                            <TableRow><TableCell colSpan={4} className="text-center py-4 text-muted-foreground">No data</TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-destructive" /> Bottom 10 Students
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>#</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead className="text-center">%</TableHead>
                            <TableHead className="text-center">Grade</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {bottom10.map((l, i) => (
                            <TableRow key={l.id}>
                              <TableCell className="font-bold">{i + 1}</TableCell>
                              <TableCell className="font-medium text-sm">{l.full_name}</TableCell>
                              <TableCell className="text-center font-semibold text-destructive">{l.pct}%</TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline" className={l.grade !== '-' ? getGradeColor(l.grade as AnyGrade) : ''}>{l.grade}</Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                          {bottom10.length === 0 && (
                            <TableRow><TableCell colSpan={4} className="text-center py-4 text-muted-foreground">No data</TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* ── Trends ── */}
              <TabsContent value="trends">
                <Card>
                  <CardHeader><CardTitle className="text-base">Performance Trends ({selectedYear})</CardTitle></CardHeader>
                  <CardContent>
                    {trendData.some(t => t.overall > 0) ? (
                      <ResponsiveContainer width="100%" height={350}>
                        <LineChart data={trendData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="term" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="overall" name="Overall Mean" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 5 }} />
                          {subjects.slice(0, 3).map((sub, i) => (
                            <Line key={sub.id} type="monotone" dataKey={sub.name} stroke={LINE_COLORS[i]} strokeWidth={1.5} strokeDasharray="5 5" dot={{ r: 3 }} />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">No trend data available</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
