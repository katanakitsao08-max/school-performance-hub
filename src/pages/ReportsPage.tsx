import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { computeAnalysis } from '@/lib/analysis-utils';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Printer, FileDown, User, School, Archive, Loader2, Sparkles, MessageCircle } from 'lucide-react';
import { WhatsAppSendDialog, type WhatsAppRecipient } from '@/components/WhatsAppSendDialog';
import { toast } from 'sonner';
import { TERMS, ASSESSMENT_TYPES, ASSESSMENT_TYPE_LABELS, type AssessmentType, getGrade, getGradeForLevel, getGradeColor, getGradeLabel, getGradePoints, generateTeacherComment, isKJSEAGradeLevel, type AnyGrade } from '@/lib/cbc-utils';
import { useSchoolGrades } from '@/hooks/use-school-grades';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolFeatureToggles } from '@/hooks/use-school-feature-toggles';
import { buildSubjectColumns, sortSubjectsByOrder } from '@/lib/subject-order';
import { getGradeLevel } from '@/lib/grade-levels';
import { generatePremiumReportCard, type ReportCardData } from '@/lib/report-card-pdf';
import { fetchAllPaged } from '@/lib/fetch-all';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';

export default function ReportsPage() {
  const { user, role, profile, schoolId } = useAuth();
  const { isOn: isFeatureOn } = useSchoolFeatureToggles();
  const mergedReportsOn = isFeatureOn('feature_merged_reports');
  const dynamicGrades = useSchoolGrades();
  const teacherGrades = profile?.assigned_grades?.length ? profile.assigned_grades : dynamicGrades;
  const availableGrades = role === 'teacher' ? teacherGrades : dynamicGrades;
  const [selectedGrades, setSelectedGrades] = useState<string[]>([availableGrades[0] || '1']);
  const [selectedStreams, setSelectedStreams] = useState<string[]>([]);
  const [selectedTerm, setSelectedTerm] = useState(1);
  const [selectedAssessment, setSelectedAssessment] = useState<AssessmentType | 'merged'>('end_term');
  const isMerged = selectedAssessment === 'merged';
  // For downstream calls expecting an AssessmentType, fall back to end_term when merged
  const effectiveAssessment: AssessmentType = isMerged ? 'end_term' : selectedAssessment;
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedGenderFilter, setSelectedGenderFilter] = useState<'all' | 'Male' | 'Female'>('all');
  const [viewMode, setViewMode] = useState<'class' | 'individual' | 'school'>('class');
  const [selectedLearner, setSelectedLearner] = useState<string | null>(null);
  const [mergeCombinedSubjects, setMergeCombinedSubjects] = useState(false);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [principalComments, setPrincipalComments] = useState<Record<string, string>>({});
  const [batchExporting, setBatchExporting] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [generatingPrincipalRemark, setGeneratingPrincipalRemark] = useState<string | null>(null);
  const [batchGeneratingRemarks, setBatchGeneratingRemarks] = useState(false);
  const [waOpen, setWaOpen] = useState(false);
  const [waRecipients, setWaRecipients] = useState<WhatsAppRecipient[]>([]);
  const [waTitle, setWaTitle] = useState<string>('Send Reports via WhatsApp');
  const reportRef = useRef<HTMLDivElement>(null);

  // For headteacher/admin: school-wide report
  const isSchoolWide = viewMode === 'school';
  const selectedGrade = selectedGrades[0] || '1';
  const selectedStream = selectedStreams[0] || '';
  const streamLabel = selectedStreams.length === 1 ? selectedStreams[0] : selectedStreams.join('+');

  const { data: dbStreamsRaw = [] } = useQuery({
    queryKey: ['streams-with-level', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('streams').select('name, level').eq('school_id', schoolId!).order('name');
      return (data || []) as { name: string; level: string }[];
    },
    enabled: !!schoolId,
  });

  // When not school-wide: filter streams to only those matching the selected grade's level.
  const dbStreams = useMemo(() => {
    if (isSchoolWide) return dbStreamsRaw.map(s => s.name);
    if (!selectedGrade) return [] as string[];
    const lvl = getGradeLevel(selectedGrade);
    return dbStreamsRaw.filter(s => (s.level || 'primary') === lvl).map(s => s.name);
  }, [dbStreamsRaw, isSchoolWide, selectedGrade]);

  // Drop any selected streams that are no longer valid for the current grade level.
  useEffect(() => {
    if (isSchoolWide) return;
    const valid = new Set(dbStreams);
    setSelectedStreams(prev => {
      const filtered = prev.filter(s => valid.has(s));
      return filtered.length === prev.length ? prev : filtered;
    });
  }, [dbStreams, isSchoolWide]);

  const { data: schoolSettings = {} } = useQuery({
    queryKey: ['school-settings-map', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('school_settings').select('*').eq('school_id', schoolId!);
      const map: Record<string, string> = {};
      (data || []).forEach(s => { map[s.key] = s.value; });
      return map;
    },
    enabled: !!schoolId,
  });

  // Fallback: fetch school name from schools table if not in settings
  const { data: schoolRecord } = useQuery({
    queryKey: ['school-record', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('schools').select('school_name').eq('id', schoolId!).maybeSingle();
      return data;
    },
    enabled: !!schoolId,
  });

  const schoolName = schoolSettings['school_name'] || schoolRecord?.school_name || 'SCHOOL';
  const schoolMotto = schoolSettings['school_motto'] || '';
  const schoolAddress = schoolSettings['school_address'] || '';
  const schoolLogoUrl = schoolSettings['school_logo_url'] || '';
  // Always inject the resolved school name so downstream PDFs use the
  // super-admin-registered name even when school_settings.school_name is empty.
  const schoolSettingsWithName = { ...schoolSettings, school_name: schoolName } as Record<string, string>;

  // For combined/school reports, fetch learners for multiple grades
  const { data: learners = [] } = useQuery({
    queryKey: ['learners-report', selectedGrades, selectedStreams, isSchoolWide],
    queryFn: async () => {
      let query = supabase.from('learners').select('*').eq('is_active', true).eq('school_id', schoolId!).order('full_name');
      if (isSchoolWide) {
        // All grades
      } else if (selectedGrades.length === 1) {
        query = query.eq('grade', selectedGrades[0]);
        if (selectedStreams.length === 1) {
          query = query.eq('stream', selectedStreams[0]);
        } else if (selectedStreams.length > 1) {
          query = query.in('stream', selectedStreams);
        }
      } else {
        query = query.in('grade', selectedGrades);
        if (selectedStreams.length === 1) {
          query = query.eq('stream', selectedStreams[0]);
        } else if (selectedStreams.length > 1) {
          query = query.in('stream', selectedStreams);
        }
      }
      const data = await fetchAllPaged(() => query);
      return data;
    },
    enabled: !!user && !!schoolId,
  });

  // Fetch subjects for all selected grades
  const { data: subjects = [] } = useQuery({
    queryKey: ['learning-areas-report', selectedGrades, isSchoolWide],
    queryFn: async () => {
      let query = supabase.from('learning_areas').select('*').eq('school_id', schoolId!).eq('is_active', true).order('name');
      if (!isSchoolWide && selectedGrades.length === 1) {
        query = query.eq('grade', selectedGrades[0]);
      } else if (!isSchoolWide) {
        query = query.in('grade', selectedGrades);
      }
      const { data } = await query;
      return data || [];
    },
    enabled: !!user && !!schoolId,
  });

  const { data: scoresQueryResult = { merged: [], byAssessment: {} as Record<string, Record<string, { opener?: number; mid_term?: number; end_term?: number }>> } } = useQuery({
    queryKey: ['scores-report', selectedGrades, selectedStreams, selectedTerm, selectedAssessment, selectedYear, isSchoolWide],
    queryFn: async () => {
      const ids = learners.map(l => l.id);
      if (!ids.length) return { merged: [] as any[], byAssessment: {} as Record<string, Record<string, any>> };
      const CHUNK = 200;
      const all: any[] = [];
      for (let i = 0; i < ids.length; i += CHUNK) {
        const slice = ids.slice(i, i + CHUNK);
        let q = supabase.from('scores').select('*')
          .in('learner_id', slice)
          .eq('term', selectedTerm).eq('year', selectedYear);
        if (isMerged) {
          q = q.in('assessment_type', ['opener', 'mid_term', 'end_term']);
        } else {
          q = q.eq('assessment_type', effectiveAssessment);
        }
        const rows = await fetchAllPaged(() => q);
        all.push(...rows);
      }
      if (!isMerged) return { merged: all, byAssessment: {} };
      // Build per-assessment breakdown: byAssessment[learnerId][learningAreaId] = { opener, mid_term, end_term }
      const byAssessment: Record<string, Record<string, { opener?: number; mid_term?: number; end_term?: number }>> = {};
      for (const r of all) {
        const lid = r.learner_id; const aid = r.learning_area_id;
        if (!byAssessment[lid]) byAssessment[lid] = {};
        if (!byAssessment[lid][aid]) byAssessment[lid][aid] = {};
        const at = r.assessment_type as 'opener' | 'mid_term' | 'end_term';
        if (at === 'opener' || at === 'mid_term' || at === 'end_term') {
          byAssessment[lid][aid][at] = Number(r.score) || 0;
        }
      }
      // Merge: average opener+mid+end per (learner, learning_area)
      const map = new Map<string, { sum: number; count: number; row: any }>();
      for (const r of all) {
        const k = `${r.learner_id}::${r.learning_area_id}`;
        const cur = map.get(k);
        if (cur) { cur.sum += Number(r.score) || 0; cur.count += 1; }
        else map.set(k, { sum: Number(r.score) || 0, count: 1, row: r });
      }
      const merged: any[] = [];
      map.forEach(({ sum, count, row }) => {
        merged.push({ ...row, score: count ? sum / count : 0, assessment_type: 'end_term' });
      });
      return { merged, byAssessment };
    },
    enabled: learners.length > 0 && !!user,
  });
  const allScores = scoresQueryResult.merged;
  const scoresByAssessment = scoresQueryResult.byAssessment;

  // Fetch teacher assignments for initials on reports
  const { data: teacherAssignmentsForReport = [] } = useQuery({
    queryKey: ['teacher-assignments-report', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('teacher_assignments').select('learning_area_id, teacher_id, grade, stream').eq('school_id', schoolId!);
      return data || [];
    },
    enabled: !!schoolId,
  });

  const { data: allProfiles = [] } = useQuery({
    queryKey: ['profiles-for-initials', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name').eq('school_id', schoolId!);
      return data || [];
    },
    enabled: !!schoolId,
  });

  const getTeacherInitials = (subjectId: string, grade: string, stream: string) => {
    const assignment = teacherAssignmentsForReport.find(
      a => a.learning_area_id === subjectId && a.grade === grade && a.stream === stream
    );
    if (!assignment) return '';
    const profile = allProfiles.find(p => p.user_id === assignment.teacher_id);
    if (!profile) return '';
    return profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const getTeacherName = (subjectId: string, grade: string, stream: string) => {
    const assignment = teacherAssignmentsForReport.find(
      a => a.learning_area_id === subjectId && a.grade === grade && a.stream === stream
    );
    if (!assignment) return '';
    const profile = allProfiles.find(p => p.user_id === assignment.teacher_id);
    return profile?.full_name || '';
  };

  // Term history for trend graph
  const { data: termHistoryScores = [] } = useQuery({
    queryKey: ['term-history-scores', selectedYear, schoolId],
    queryFn: async () => {
      const data = await fetchAllPaged(() => supabase
        .from('scores')
        .select('learner_id, score, term, year, assessment_type, learning_area_id')
        .eq('year', selectedYear)
        .eq('assessment_type', 'end_term')
        .eq('school_id', schoolId!));
      return data;
    },
    enabled: !!schoolId,
  });

  // Fetch strands and strand scores for report cards
  const { data: reportStrands = [] } = useQuery({
    queryKey: ['report-strands', schoolId],
    queryFn: async () => {
      const data = await fetchAllPaged(() =>
        supabase.from('strands').select('*').eq('school_id', schoolId!).order('sort_order'));
      return data;
    },
    enabled: !!schoolId,
  });

  const { data: reportStrandScores = [] } = useQuery({
    queryKey: ['report-strand-scores', selectedTerm, selectedYear, selectedAssessment, schoolId],
    queryFn: async () => {
      const learnerIds = learners.map(l => l.id);
      if (!learnerIds.length) return [];
      const CHUNK = 200;
      const all: any[] = [];
      for (let i = 0; i < learnerIds.length; i += CHUNK) {
        const slice = learnerIds.slice(i, i + CHUNK);
        let q = supabase.from('strand_scores').select('*')
          .in('learner_id', slice)
          .eq('term', selectedTerm).eq('year', selectedYear);
        if (isMerged) {
          q = q.in('assessment_type', ['opener', 'mid_term', 'end_term']);
        } else {
          q = q.eq('assessment_type', effectiveAssessment);
        }
        const rows = await fetchAllPaged(() => q);
        all.push(...rows);
      }
      if (!isMerged) return all;
      const map = new Map<string, { sum: number; count: number; row: any }>();
      for (const r of all) {
        const k = `${r.learner_id}::${r.strand_id}`;
        const cur = map.get(k);
        if (cur) { cur.sum += Number(r.score) || 0; cur.count += 1; }
        else map.set(k, { sum: Number(r.score) || 0, count: 1, row: r });
      }
      const merged: any[] = [];
      map.forEach(({ sum, count, row }) => {
        merged.push({ ...row, score: count ? sum / count : 0, assessment_type: 'end_term' });
      });
      return merged;
    },
    enabled: learners.length > 0 && !!schoolId,
  });
  // For class/individual view, get subjects for the single selected grade
  const gradeSubjects = useMemo(() => {
    if (isSchoolWide || selectedGrades.length > 1) return subjects;
    return subjects.filter(s => s.grade === selectedGrade);
  }, [subjects, selectedGrade, isSchoolWide, selectedGrades]);

  const reportData = useMemo(() => {
    const relevantSubjects = isSchoolWide ? subjects : gradeSubjects;
    
    // Filter by gender if set
    const filteredLearners = selectedGenderFilter === 'all' ? learners : learners.filter(l => (l as any).gender === selectedGenderFilter);
    
    const mapped = filteredLearners.map(l => {
      const raw = relevantSubjects.filter(s => s.grade === l.grade);
      const learnerGradeSubjects = sortSubjectsByOrder(raw as any[], l.grade);
      const learnerScores = allScores.filter(s => s.learner_id === l.id);
      const subjectData = learnerGradeSubjects.map(sub => {
        const sc = learnerScores.find(s => s.learning_area_id === sub.id);
        return {
          id: sub.id, name: sub.name, maxScore: sub.max_score,
          score: sc?.score || 0,
          grade: sc ? getGradeForLevel(sc.score, sub.max_score, l.grade) : '-' as any,
          comment: sc?.teacher_comment || '',
          teacherInitials: getTeacherInitials(sub.id, l.grade, l.stream),
        };
      });
      const total = subjectData.reduce((s, d) => s + d.score, 0);
      const maxTotal = learnerGradeSubjects.reduce((s, sub) => s + sub.max_score, 0);
      const mean = learnerGradeSubjects.length > 0 ? total / learnerGradeSubjects.length : 0;
      const avgMax = learnerGradeSubjects.length > 0 ? maxTotal / learnerGradeSubjects.length : 100;
      // Include learner if they have at least ONE non-zero score.
      // Excludes only learners with all-zero (or no) scores entered.
      const hasAnyScore = learnerScores.some(s => Number(s.score) > 0);
      return {
        ...l, subjectData, total, mean,
        overallGrade: learnerGradeSubjects.length > 0 ? getGradeForLevel(mean, avgMax, l.grade) : '-',
        hasAnyScore,
      };
    })
    // Exclude learners with no scores
    .filter(l => l.hasAnyScore)
    .sort((a, b) => b.total - a.total).map((l, i, arr) => {
      let rank = i + 1;
      if (i > 0 && arr[i - 1].total === l.total) rank = arr.findIndex(x => x.total === l.total) + 1;
      return { ...l, rank };
    });
    return mapped;
  }, [learners, allScores, subjects, gradeSubjects, isSchoolWide, selectedGenderFilter]);

  const subjectMeans = useMemo(() => {
    return gradeSubjects.map(sub => {
      const scores = allScores.filter(s => s.learning_area_id === sub.id);
      const avg = scores.length > 0 ? scores.reduce((s, sc) => s + sc.score, 0) / scores.length : 0;
      return { name: sub.name, mean: avg };
    });
  }, [gradeSubjects, allScores]);

  const classAvgPerSubject = useMemo(() => {
    const map: Record<string, number> = {};
    gradeSubjects.forEach(sub => {
      const scores = allScores.filter(s => s.learning_area_id === sub.id);
      map[sub.name] = scores.length > 0 ? scores.reduce((s, sc) => s + sc.score, 0) / scores.length : 0;
    });
    return map;
  }, [gradeSubjects, allScores]);

  // Grade distribution for report cards
  const gradeDistribution = useMemo(() => {
    const isK = isKJSEAGradeLevel(selectedGrade);
    const levels = isK ? ['EE1', 'EE2', 'ME1', 'ME2', 'AE1', 'AE2', 'BE1', 'BE2'] : ['EE', 'ME', 'AE', 'BE'];
    const dist: Record<string, number> = {};
    levels.forEach(l => { dist[l] = 0; });
    reportData.forEach(l => {
      if (l.overallGrade && l.overallGrade !== '-') {
        dist[l.overallGrade] = (dist[l.overallGrade] || 0) + 1;
      }
    });
    return levels.map(g => ({ grade: g, count: dist[g] || 0 }));
  }, [reportData, selectedGrade]);

  // Stream ranking: rank within same stream
  const streamRankings = useMemo(() => {
    const map: Record<string, number> = {};
    const streamGroups: Record<string, typeof reportData> = {};
    reportData.forEach(l => {
      const key = `${l.grade}-${l.stream}`;
      if (!streamGroups[key]) streamGroups[key] = [];
      streamGroups[key].push(l);
    });
    Object.values(streamGroups).forEach(group => {
      group.sort((a, b) => b.total - a.total).forEach((l, i, arr) => {
        let rank = i + 1;
        if (i > 0 && arr[i - 1].total === l.total) rank = arr.findIndex(x => x.total === l.total) + 1;
        map[l.id] = rank;
      });
    });
    return map;
  }, [reportData]);

  const streamCounts = useMemo(() => {
    const map: Record<string, number> = {};
    reportData.forEach(l => {
      const key = `${l.grade}-${l.stream}`;
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [reportData]);

  // Build term history for a given learner
  const getTermHistory = (learnerId: string) => {
    const terms: { term: string; mean: number }[] = [];
    for (let t = 1; t <= 3; t++) {
      const termScores = termHistoryScores.filter(s => s.learner_id === learnerId && s.term === t);
      if (termScores.length === 0) continue;
      const total = termScores.reduce((s, sc) => s + sc.score, 0);
      // Find max scores for these subjects
      let maxTotal = 0;
      termScores.forEach(sc => {
        const sub = subjects.find(s => s.id === sc.learning_area_id);
        maxTotal += sub?.max_score || 100;
      });
      const pct = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
      terms.push({ term: `T${t} ${selectedYear}`, mean: pct });
    }
    return terms;
  };

  const classMean = reportData.length > 0 ? reportData.reduce((s, l) => s + l.mean, 0) / reportData.length : 0;
  const highest = reportData.length > 0 ? Math.max(...reportData.map(l => l.total)) : 0;
  const lowest = reportData.length > 0 ? Math.min(...reportData.map(l => l.total)) : 0;

  const generateComment = (learner: any) => {
    const comment = generateTeacherComment(
      learner.full_name, learner.mean,
      gradeSubjects.length > 0 ? gradeSubjects.reduce((s, sub) => s + sub.max_score, 0) / gradeSubjects.length : 100,
      learner.subjectData.map((s: any) => ({ name: s.name, score: s.score, maxScore: s.maxScore }))
    );
    setComments(prev => ({ ...prev, [learner.id]: comment }));
  };

  const generatePrincipalRemark = async (learner: any) => {
    if (generatingPrincipalRemark) return;
    setGeneratingPrincipalRemark(learner.id);
    try {
      const maxTotal = learner.subjectData.reduce((s: number, d: any) => s + d.maxScore, 0);
      const meanPct = maxTotal > 0 ? (learner.total / maxTotal) * 100 : learner.mean;

      const { data, error } = await supabase.functions.invoke('generate-principal-remark', {
        body: {
          studentName: learner.full_name,
          grade: learner.grade,
          stream: learner.stream,
          mean: meanPct,
          overallGrade: learner.overallGrade,
          totalSubjects: learner.subjectData.length,
          rank: learner.rank,
          totalStudents: reportData.length,
          subjectData: learner.subjectData.map((s: any) => ({
            name: s.name, score: s.score, maxScore: s.maxScore,
          })),
          schoolName,
        },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setPrincipalComments(prev => ({ ...prev, [learner.id]: data.remark }));
      toast.success('Principal remark generated');
    } catch (err: any) {
      console.error('Failed to generate principal remark:', err);
      toast.error('Failed to generate remark. Please try again.');
    } finally {
      setGeneratingPrincipalRemark(null);
    }
  };

  const batchGeneratePrincipalRemarks = async () => {
    if (reportData.length === 0 || batchGeneratingRemarks) return;
    setBatchGeneratingRemarks(true);
    try {
      // Process in chunks of 20 to avoid token limits
      const chunkSize = 20;
      const allResults: { id: string; remark: string }[] = [];

      for (let i = 0; i < reportData.length; i += chunkSize) {
        const chunk = reportData.slice(i, i + chunkSize);
        const students = chunk.map(ld => {
          const maxTotal = ld.subjectData.reduce((s: number, d: any) => s + d.maxScore, 0);
          const meanPct = maxTotal > 0 ? (ld.total / maxTotal) * 100 : ld.mean;
          return {
            id: ld.id,
            studentName: ld.full_name,
            grade: ld.grade,
            stream: ld.stream,
            mean: meanPct,
            overallGrade: ld.overallGrade,
            rank: ld.rank,
            totalStudents: reportData.length,
            subjectData: ld.subjectData.map((s: any) => ({
              name: s.name, score: s.score, maxScore: s.maxScore,
            })),
          };
        });

        const { data, error } = await supabase.functions.invoke('batch-principal-remarks', {
          body: { students, schoolName },
        });

        if (error) throw error;
        if (data?.error) {
          toast.error(data.error);
          break;
        }

        allResults.push(...(data.results || []));
      }

      const newComments: Record<string, string> = { ...principalComments };
      allResults.forEach(r => { newComments[r.id] = r.remark; });
      setPrincipalComments(newComments);
      toast.success(`Generated ${allResults.length} principal remarks`);
    } catch (err: any) {
      console.error('Batch principal remarks failed:', err);
      toast.error('Failed to generate batch remarks. Please try again.');
    } finally {
      setBatchGeneratingRemarks(false);
    }
  };

  const handlePrint = () => window.print();

  const toggleGradeSelection = (grade: string) => {
    setSelectedGrades(prev => {
      if (prev.includes(grade)) {
        const next = prev.filter(g => g !== grade);
        return next.length > 0 ? next : prev;
      }
      return [...prev, grade];
    });
  };

  const loadImageAsBase64 = (url: string): Promise<string | null> => {
    return new Promise((resolve) => {
      if (!url) { resolve(null); return; }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  };

  const addPdfHeader = async (doc: jsPDF, y: number) => {
    const cx = doc.internal.pageSize.getWidth() / 2;
    const logoBase64 = await loadImageAsBase64(schoolLogoUrl);
    
    if (logoBase64) {
      const logoSize = 18;
      doc.addImage(logoBase64, 'PNG', cx - logoSize / 2, y - 4, logoSize, logoSize);
      y += logoSize + 2;
    }
    
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(schoolName.toUpperCase(), cx, y, { align: 'center' });
    if (schoolMotto) { y += 7; doc.setFontSize(10); doc.setFont('helvetica', 'italic'); doc.text(schoolMotto, cx, y, { align: 'center' }); }
    if (schoolAddress) { y += 5; doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.text(schoolAddress, cx, y, { align: 'center' }); }
    y += 3;
    doc.setDrawColor(0); doc.setLineWidth(0.5);
    doc.line(14, y, doc.internal.pageSize.getWidth() - 14, y);
    return y + 5;
  };

  const exportClassPDF = async () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    let y = 12;
    y = await addPdfHeader(doc, y);
    const cx = doc.internal.pageSize.getWidth() / 2;
    const title = isSchoolWide
      ? 'WHOLE SCHOOL REPORT'
      : selectedGrades.length > 1
        ? `COMBINED REPORT — Grades ${selectedGrades.join(', ')} ${streamLabel}`
        : `CLASS REPORT — Grade ${selectedGrade} ${streamLabel}`;
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text(title, cx, y, { align: 'center' });
    y += 6;
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`Term ${selectedTerm}, ${selectedYear}`, cx, y, { align: 'center' });

    const showGradeCol = isSchoolWide || selectedGrades.length > 1;
    const displaySubjects = isSchoolWide ? [] : gradeSubjects;
    
    // When showing combined view, expand each subject into Opener/Mid/End/Avg sub-columns
    const subjHeaders: string[] = [];
    displaySubjects.forEach(s => {
      if (isMerged) {
        subjHeaders.push(`${s.name} Op`, `${s.name} Mid`, `${s.name} End`, `${s.name} Avg`);
      } else {
        subjHeaders.push(s.name);
      }
    });
    const headers = ['#', 'Name', ...(showGradeCol ? ['Grade'] : []),
      ...subjHeaders, 'Total', 'Mean', 'Grade', 'Rank'];

    const fmtN = (n?: number) => (n === undefined || n === null || isNaN(n) ? '-' : Number(n).toFixed(0));

    const body = reportData.map(l => {
      const subjCells: any[] = [];
      l.subjectData.forEach((s: any) => {
        if (isMerged) {
          const br = scoresByAssessment[l.id]?.[s.id] || {};
          subjCells.push(fmtN(br.opener), fmtN(br.mid_term), fmtN(br.end_term), `${s.score} (${s.grade})`);
        } else {
          subjCells.push(`${s.score} (${s.grade})`);
        }
      });
      return [
        l.rank, l.full_name, ...(showGradeCol ? [`${l.grade}${l.stream}`] : []),
        ...subjCells,
        l.total, l.mean.toFixed(1), l.overallGrade, l.rank,
      ];
    });

    // Footer row: Subject Mean per subject + class mean + class grade
    const foot: any[] = [];
    if (!isSchoolWide && selectedGrades.length === 1 && displaySubjects.length > 0) {
      const maxTotalSubj = displaySubjects.reduce((s, sub) => s + sub.max_score, 0);
      const avgMaxSubj = displaySubjects.length ? maxTotalSubj / displaySubjects.length : 100;
      const meanTotalRow = reportData.length
        ? reportData.reduce((s, l) => s + l.total, 0) / reportData.length
        : 0;
      const gradeForClass = displaySubjects.length && reportData.length
        ? getGradeForLevel(classMean, avgMaxSubj, reportData[0].grade)
        : '-';
      const meanCells: any[] = [];
      displaySubjects.forEach(sub => {
        const sm = subjectMeans.find(m => m.name === sub.name);
        if (isMerged) {
          // blank Op/Mid/End columns; show overall mean only in Avg column
          meanCells.push('', '', '', sm ? sm.mean.toFixed(1) : '-');
        } else {
          meanCells.push(sm ? sm.mean.toFixed(1) : '-');
        }
      });
      foot.push([
        { content: 'SUBJECT MEAN', colSpan: showGradeCol ? 3 : 2, styles: { halign: 'right', fontStyle: 'bold' } },
        ...meanCells,
        reportData.length ? meanTotalRow.toFixed(1) : '-',
        classMean.toFixed(1),
        String(gradeForClass),
        '—',
      ]);
    }

    autoTable(doc, {
      head: [headers],
      body,
      foot: foot.length ? foot : undefined,
      startY: y + 4,
      styles: { fontSize: isMerged ? 7 : 10, cellPadding: isMerged ? 1.2 : 2 },
      headStyles: { fontSize: isMerged ? 7 : 10, fontStyle: 'bold' },
      footStyles: { fillColor: [230, 230, 230], textColor: 20, fontStyle: 'bold', fontSize: isMerged ? 7 : 10 },
    });

    // --- Analysis Pages (appended, existing pages untouched) ---
    const analysis = computeAnalysis(reportData, isSchoolWide ? [] : gradeSubjects, allScores);
    if (analysis.subjectAnalyses.length > 0) {
      doc.addPage('landscape');
      let ay = 12;
      ay = await addPdfHeader(doc, ay);
      doc.setFontSize(14); doc.setFont('helvetica', 'bold');
      doc.text('PERFORMANCE ANALYSIS', cx, ay, { align: 'center' });
      ay += 8;

      // Subject means table
      doc.setFontSize(11); doc.setFont('helvetica', 'bold');
      doc.text('Subject Mean Scores', 14, ay); ay += 2;
      autoTable(doc, {
        head: [['Subject', 'Mean Score', 'Max Score', 'Grade']],
        body: analysis.subjectAnalyses.map(s => [s.name, s.mean, s.maxScore, s.grade]),
        startY: ay, styles: { fontSize: 11, cellPadding: 2.5 },
        headStyles: { fillColor: [41, 128, 185] },
      });
      ay = (doc as any).lastAutoTable.finalY + 8;

      doc.setFontSize(10); doc.setFont('helvetica', 'normal');
      doc.text(`Class Mean: ${analysis.classMean}`, 14, ay); ay += 6;
      if (analysis.bestSubject) { doc.text(`Best Performing Subject: ${analysis.bestSubject.name} (${analysis.bestSubject.mean})`, 14, ay); ay += 6; }
      if (analysis.leastSubject) { doc.text(`Least Performing Subject: ${analysis.leastSubject.name} (${analysis.leastSubject.mean})`, 14, ay); ay += 6; }
      ay += 4;

      // Top 5 overall
      doc.setFontSize(11); doc.setFont('helvetica', 'bold');
      doc.text('Top 5 Learners (Overall)', 14, ay); ay += 2;
      autoTable(doc, {
        head: [['Rank', 'Name', 'Total', 'Mean', 'Grade']],
        body: analysis.top5Overall.map(l => [l.rank, l.name, l.total, l.mean, l.grade]),
        startY: ay, styles: { fontSize: 11, cellPadding: 2.5 },
        headStyles: { fillColor: [39, 174, 96] },
      });

      // Top 5 per subject page
      doc.addPage('landscape');
      let ty = 12;
      ty = await addPdfHeader(doc, ty);
      doc.setFontSize(14); doc.setFont('helvetica', 'bold');
      doc.text('TOP 5 LEARNERS PER SUBJECT', cx, ty, { align: 'center' });
      ty += 8;

      analysis.subjectAnalyses.forEach(sub => {
        if (ty > doc.internal.pageSize.getHeight() - 40) {
          doc.addPage('landscape');
          ty = 15;
        }
        doc.setFontSize(10); doc.setFont('helvetica', 'bold');
        doc.text(sub.name, 14, ty); ty += 2;
        autoTable(doc, {
          head: [['#', 'Name', 'Score', 'Grade']],
          body: sub.top5.map((l, i) => [i + 1, l.name, l.score, l.grade]),
          startY: ty, styles: { fontSize: 11, cellPadding: 2.5 }, margin: { left: 14 },
        });
        ty = (doc as any).lastAutoTable.finalY + 6;
      });
    }

    doc.save(`Report_${isSchoolWide ? 'School' : `G${selectedGrades.join('-')}`}_T${selectedTerm}_${selectedYear}.pdf`);
  };

  const exportIndividualPDF = async (learnerData?: any) => {
    const ld = learnerData || selectedLearnerData;
    if (!ld) return;

    const logoBase64 = await loadImageAsBase64(schoolLogoUrl);
    const maxTotal = ld.subjectData.reduce((s: number, d: any) => s + d.maxScore, 0);
    const totalPoints = ld.subjectData.reduce((s: number, d: any) => {
      if (d.grade === '-') return s;
      return s + getGradePoints(d.grade);
    }, 0);

    const streamKey = `${ld.grade}-${ld.stream}`;

    const cardData: ReportCardData = {
      learner: {
        id: ld.id,
        full_name: ld.full_name,
        admission_number: ld.admission_number,
        grade: ld.grade,
        stream: ld.stream,
        gender: ld.gender || '-',
      },
      subjectData: ld.subjectData.map((s: any) => {
        const subjectStrands = reportStrands.filter(st => st.learning_area_id === s.id);
        const strandData = subjectStrands.map(st => {
          const ss = reportStrandScores.find(
            (sc: any) => sc.strand_id === st.id && sc.learner_id === ld.id
          );
          return {
            strandName: st.name,
            score: ss?.score || 0,
            maxScore: ss?.max_score || 100,
            competencyLevel: ss?.competency_level || '-',
            teacherComment: ss?.teacher_comment || '',
          };
        }).filter(st => st.score > 0);
        return {
          ...s,
          teacherName: getTeacherName(s.id, ld.grade, ld.stream),
          strands: strandData.length > 0 ? strandData : undefined,
          assessmentScores: isMerged ? scoresByAssessment[ld.id]?.[s.id] : undefined,
        };
      }),
      showAssessmentBreakdown: isMerged,
      total: ld.total,
      maxTotal,
      mean: maxTotal > 0 ? (ld.total / maxTotal) * 100 : 0,
      overallGrade: ld.overallGrade,
      rank: ld.rank,
      streamRank: streamRankings[ld.id] || ld.rank,
      totalInClass: reportData.length,
      totalInStream: streamCounts[streamKey] || reportData.length,
      totalPoints,
      selectedTerm,
      selectedYear,
      assessmentLabel: isMerged ? 'Combined (Opener + Mid-Term + End-Term)' : ASSESSMENT_TYPE_LABELS[selectedAssessment],
      classTeacherComment: comments[ld.id] || '',
      principalComment: principalComments[ld.id] || '',
      schoolSettings: schoolSettingsWithName,
      logoBase64,
      classAvgPerSubject,
      termHistory: getTermHistory(ld.id),
      gradeDistribution,
      appUrl: window.location.origin,
    };

    const doc = await generatePremiumReportCard(cardData);
    doc.save(`Report_${ld.full_name.replace(/\s+/g, '_')}_G${ld.grade}_T${selectedTerm}_${selectedYear}.pdf`);
  };

  const exportBatchPDF = useCallback(async () => {
    if (reportData.length === 0 || batchExporting) return;
    setBatchExporting(true);
    setBatchProgress({ current: 0, total: reportData.length });

    const zip = new JSZip();
    const logoBase64 = await loadImageAsBase64(schoolLogoUrl);

    for (let idx = 0; idx < reportData.length; idx++) {
      const ld = reportData[idx];
      setBatchProgress({ current: idx + 1, total: reportData.length });

      const maxTotal = ld.subjectData.reduce((s: number, d: any) => s + d.maxScore, 0);
      const totalPoints = ld.subjectData.reduce((s: number, d: any) => {
        if (d.grade === '-') return s;
        return s + getGradePoints(d.grade);
      }, 0);
      const streamKey = `${ld.grade}-${ld.stream}`;

      const cardData: ReportCardData = {
        learner: {
          id: ld.id, full_name: ld.full_name, admission_number: ld.admission_number,
          grade: ld.grade, stream: ld.stream, gender: ld.gender || '-',
        },
        subjectData: ld.subjectData.map((s: any) => {
          const subjectStrands = reportStrands.filter(st => st.learning_area_id === s.id);
          const strandData = subjectStrands.map(st => {
            const ss = reportStrandScores.find((sc: any) => sc.strand_id === st.id && sc.learner_id === ld.id);
            return { strandName: st.name, score: ss?.score || 0, maxScore: ss?.max_score || 100, competencyLevel: ss?.competency_level || '-', teacherComment: ss?.teacher_comment || '' };
          }).filter(st => st.score > 0);
          return { ...s, teacherName: getTeacherName(s.id, ld.grade, ld.stream), strands: strandData.length > 0 ? strandData : undefined, assessmentScores: isMerged ? scoresByAssessment[ld.id]?.[s.id] : undefined };
        }),
        showAssessmentBreakdown: isMerged,
        total: ld.total, maxTotal,
        mean: maxTotal > 0 ? (ld.total / maxTotal) * 100 : 0,
        overallGrade: ld.overallGrade,
        rank: ld.rank,
        streamRank: streamRankings[ld.id] || ld.rank,
        totalInClass: reportData.length,
        totalInStream: streamCounts[streamKey] || reportData.length,
        totalPoints, selectedTerm, selectedYear,
        assessmentLabel: isMerged ? 'Combined (Opener + Mid-Term + End-Term)' : ASSESSMENT_TYPE_LABELS[selectedAssessment],
        classTeacherComment: comments[ld.id] || '',
        principalComment: principalComments[ld.id] || '',
        schoolSettings: schoolSettingsWithName,
        logoBase64, classAvgPerSubject,
        termHistory: getTermHistory(ld.id),
        gradeDistribution,
        appUrl: window.location.origin,
      };

      const doc = await generatePremiumReportCard(cardData);
      const pdfBlob = doc.output('arraybuffer');
      zip.file(`${ld.full_name.replace(/\s+/g, '_')}_G${ld.grade}_T${selectedTerm}_${selectedYear}.pdf`, pdfBlob);

      // Yield to UI so progress updates render
      await new Promise(r => setTimeout(r, 0));
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ReportCards_G${selectedGrades.join('-')}_T${selectedTerm}_${selectedYear}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    setBatchExporting(false);
  }, [reportData, schoolLogoUrl, schoolSettings, selectedTerm, selectedYear, selectedAssessment, comments, principalComments, classAvgPerSubject, streamRankings, streamCounts, selectedGrades, batchExporting]);


  const exportExcel = () => {
    const showGradeCol = isSchoolWide || selectedGrades.length > 1;
    const displaySubjects = isSchoolWide ? [] : gradeSubjects;
    const headers = ['Rank', 'Name', ...(showGradeCol ? ['Class'] : []), ...displaySubjects.map(s => s.name), 'Total', 'Mean', 'Grade'];
    const data = reportData.map(l => [
      l.rank, l.full_name, ...(showGradeCol ? [`${l.grade}${l.stream}`] : []),
      ...l.subjectData.map((s: any) => s.score),
      l.total, Number(l.mean.toFixed(1)), l.overallGrade,
    ]);
    const titleRow = [`${schoolName.toUpperCase()} — REPORT — TERM ${selectedTerm} ${selectedYear}`];
    const ws = XLSX.utils.aoa_to_sheet([titleRow, [], headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');

    // --- Analysis Sheet (new, does not touch 'Report' sheet) ---
    const analysis = computeAnalysis(reportData, isSchoolWide ? [] : gradeSubjects, allScores);
    if (analysis.subjectAnalyses.length > 0) {
      const aRows: any[][] = [
        ['PERFORMANCE ANALYSIS'],
        [],
        ['Subject Mean Scores'],
        ['Subject', 'Mean Score', 'Max Score', 'Grade'],
        ...analysis.subjectAnalyses.map(s => [s.name, s.mean, s.maxScore, s.grade]),
        [],
        ['Class Mean', analysis.classMean],
        ['Best Subject', analysis.bestSubject?.name || '-', analysis.bestSubject?.mean || '-'],
        ['Least Subject', analysis.leastSubject?.name || '-', analysis.leastSubject?.mean || '-'],
        [],
        ['Top 5 Learners (Overall)'],
        ['Rank', 'Name', 'Total', 'Mean', 'Grade'],
        ...analysis.top5Overall.map(l => [l.rank, l.name, l.total, l.mean, l.grade]),
      ];
      const aws = XLSX.utils.aoa_to_sheet(aRows);
      XLSX.utils.book_append_sheet(wb, aws, 'Analysis');

      // Top Learners per subject sheet
      const tRows: any[][] = [['TOP 5 LEARNERS PER SUBJECT'], []];
      analysis.subjectAnalyses.forEach(sub => {
        tRows.push([sub.name]);
        tRows.push(['#', 'Name', 'Score', 'Grade']);
        sub.top5.forEach((l, i) => tRows.push([i + 1, l.name, l.score, l.grade]));
        tRows.push([]);
      });
      const tws = XLSX.utils.aoa_to_sheet(tRows);
      XLSX.utils.book_append_sheet(wb, tws, 'Top Learners');
    }

    XLSX.writeFile(wb, `Report_${isSchoolWide ? 'School' : `G${selectedGrades.join('-')}`}_T${selectedTerm}_${selectedYear}.xlsx`);
  };

  const selectedLearnerData = selectedLearner ? reportData.find(l => l.id === selectedLearner) : null;

  const viewModeOptions = [
    { value: 'class', label: 'Class Report' },
    { value: 'individual', label: 'Individual Report' },
  ];
  if (role === 'admin' || role === 'headteacher') {
    viewModeOptions.push({ value: 'school', label: 'Whole School Report' });
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-4 no-print">
          <div>
            <h1 className="text-2xl font-display font-bold">Reports</h1>
            <p className="text-muted-foreground">Class, individual & school-wide performance reports</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={handlePrint}><Printer className="mr-2 h-4 w-4" /> Print</Button>
            {viewMode !== 'individual' ? (
              <>
                <Button variant="outline" onClick={exportClassPDF}><FileDown className="mr-2 h-4 w-4" /> PDF</Button>
                <Button variant="outline" onClick={exportExcel}><FileDown className="mr-2 h-4 w-4" /> Excel</Button>
                <Button variant="default" onClick={exportBatchPDF} disabled={batchExporting || reportData.length === 0}>
                  {batchExporting ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {batchProgress.current}/{batchProgress.total}</>
                  ) : (
                    <><Archive className="mr-2 h-4 w-4" /> Batch Report Cards (ZIP)</>
                  )}
                </Button>
                <Button
                  variant="secondary"
                  disabled={reportData.length === 0}
                  onClick={() => {
                    setWaRecipients(reportData.map((l: any) => ({
                      learner_id: l.id, full_name: l.full_name, grade: l.grade,
                      recipient: (l as any).parent_phone || '',
                    })));
                    setWaTitle(`Send ${reportData.length} report${reportData.length === 1 ? '' : 's'} via WhatsApp`);
                    setWaOpen(true);
                  }}
                >
                  <MessageCircle className="mr-2 h-4 w-4" /> Send via WhatsApp
                </Button>
                <Button variant="secondary" onClick={batchGeneratePrincipalRemarks} disabled={batchGeneratingRemarks || reportData.length === 0}>
                  {batchGeneratingRemarks ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating Remarks...</>
                  ) : (
                    <><Sparkles className="mr-2 h-4 w-4" /> AI Principal Remarks</>
                  )}
                </Button>
              </>
            ) : selectedLearnerData && (
              <>
                <Button variant="outline" onClick={() => exportIndividualPDF()}>
                  <User className="mr-2 h-4 w-4" /> Download Report Card
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setWaRecipients([{
                      learner_id: selectedLearnerData.id,
                      full_name: selectedLearnerData.full_name,
                      grade: selectedLearnerData.grade,
                      recipient: (selectedLearnerData as any).parent_phone || '',
                    }]);
                    setWaTitle(`Send ${selectedLearnerData.full_name}'s report via WhatsApp`);
                    setWaOpen(true);
                  }}
                >
                  <MessageCircle className="mr-2 h-4 w-4" /> Send via WhatsApp
                </Button>
              </>
            )}
          </div>
        </div>
        <WhatsAppSendDialog
          open={waOpen}
          onOpenChange={setWaOpen}
          recipients={waRecipients}
          term={selectedTerm}
          year={selectedYear}
          assessmentType={effectiveAssessment}
          schoolName={schoolName}
          title={waTitle}
        />


        <div className="flex gap-4 flex-wrap no-print items-end">
          <div className="space-y-1">
            <Label className="text-xs">Report Type</Label>
            <Select value={viewMode} onValueChange={v => { setViewMode(v as any); if (v === 'school') setSelectedGrades(availableGrades); }}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {viewModeOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {!isSchoolWide && (
            <>
              {(role === 'admin' || role === 'headteacher') && viewMode === 'class' ? (
                <div className="space-y-1">
                  <Label className="text-xs">Grades (select multiple to combine)</Label>
                  <div className="flex flex-wrap gap-2 p-2 border rounded-md bg-background min-w-[200px]">
                    {availableGrades.map(g => (
                      <label key={g} className="flex items-center gap-1.5 text-sm">
                        <Checkbox
                          checked={selectedGrades.includes(g)}
                          onCheckedChange={() => toggleGradeSelection(g)}
                        />
                        G{g}
                      </label>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <Label className="text-xs">Grade</Label>
                  <Select value={selectedGrade} onValueChange={v => setSelectedGrades([v])}>
                    <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{availableGrades.map(g => <SelectItem key={g} value={g}>Grade {g}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs">Stream(s)</Label>
                {(role === 'admin' || role === 'headteacher') ? (
                  <div className="flex flex-wrap gap-2 p-2 border rounded-md bg-background min-w-[160px]">
                    {dbStreams.map(s => (
                      <label key={s} className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <Checkbox
                          checked={selectedStreams.includes(s)}
                          onCheckedChange={() => {
                            setSelectedStreams(prev => {
                              if (prev.includes(s)) {
                                const next = prev.filter(x => x !== s);
                                return next.length > 0 ? next : prev;
                              }
                              return [...prev, s];
                            });
                          }}
                        />
                        {s}
                      </label>
                    ))}
                  </div>
                ) : (
                  <Select value={selectedStream} onValueChange={v => setSelectedStreams([v])}>
                    <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{dbStreams.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </div>
            </>
          )}

          <div className="space-y-1">
            <Label className="text-xs">Term</Label>
            <Select value={String(selectedTerm)} onValueChange={v => setSelectedTerm(Number(v))}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>{TERMS.map(t => <SelectItem key={t} value={String(t)}>Term {t}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Assessment</Label>
            <Select value={selectedAssessment} onValueChange={v => setSelectedAssessment(v as AssessmentType | 'merged')}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ASSESSMENT_TYPES.map(at => <SelectItem key={at} value={at}>{ASSESSMENT_TYPE_LABELS[at]}</SelectItem>)}
                {mergedReportsOn && <SelectItem value="merged">Combined (Opener + Mid + End)</SelectItem>}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Gender</Label>
            <Select value={selectedGenderFilter} onValueChange={v => setSelectedGenderFilter(v as any)}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="Male">Male</SelectItem>
                <SelectItem value="Female">Female</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {viewMode === 'individual' && (
            <div className="space-y-1">
              <Label className="text-xs">Learner</Label>
              <Select value={selectedLearner || ''} onValueChange={setSelectedLearner}>
                <SelectTrigger className="w-[200px]"><SelectValue placeholder="Select learner" /></SelectTrigger>
                <SelectContent>{learners.map(l => <SelectItem key={l.id} value={l.id}>{l.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div ref={reportRef}>
          {viewMode === 'individual' ? (
            selectedLearnerData ? (
              <Card>
                <CardHeader className="text-center">
                  <p className="text-lg font-bold uppercase">{schoolName}</p>
                  {schoolMotto && <p className="text-sm italic text-muted-foreground">{schoolMotto}</p>}
                  {schoolAddress && <p className="text-xs text-muted-foreground">{schoolAddress}</p>}
                  <CardTitle className="font-display">Report Card — {selectedLearnerData.full_name}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Grade {selectedLearnerData.grade}{selectedLearnerData.stream} • Term {selectedTerm}, {selectedYear} •
                    Adm No: {selectedLearnerData.admission_number}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Subject</TableHead>
                        <TableHead className="text-center">Score</TableHead>
                        <TableHead className="text-center">Max</TableHead>
                        <TableHead className="text-center">Grade</TableHead>
                        <TableHead>Remark</TableHead>
                        <TableHead className="text-center">Teacher</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedLearnerData.subjectData.map((s: any) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">{s.name}</TableCell>
                          <TableCell className="text-center">{s.score}</TableCell>
                          <TableCell className="text-center">{s.maxScore}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className={s.grade !== '-' ? getGradeColor(s.grade) : ''}>{s.grade}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {s.grade !== '-' ? getGradeLabel(s.grade) : '-'}
                          </TableCell>
                          <TableCell className="text-center text-xs font-semibold text-muted-foreground">{s.teacherInitials || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 bg-muted rounded-lg">
                    <div><span className="text-sm text-muted-foreground">Total:</span><p className="text-xl font-bold">{selectedLearnerData.total}</p></div>
                    <div><span className="text-sm text-muted-foreground">Mean:</span><p className="text-xl font-bold">{selectedLearnerData.mean.toFixed(1)}</p></div>
                    <div>
                      <span className="text-sm text-muted-foreground">Overall Grade:</span>
                      <p className="text-xl font-bold">
                        {selectedLearnerData.overallGrade}
                        {selectedLearnerData.overallGrade !== '-' && (
                          <span className="text-sm font-normal ml-1 text-muted-foreground">
                            ({getGradeLabel(selectedLearnerData.overallGrade as any)})
                          </span>
                        )}
                      </p>
                    </div>
                    <div><span className="text-sm text-muted-foreground">Position:</span><p className="text-xl font-bold">{selectedLearnerData.rank} / {reportData.length}</p></div>
                    <div><span className="text-sm text-muted-foreground">Stream Position:</span><p className="text-xl font-bold">{streamRankings[selectedLearnerData.id] || '-'} / {streamCounts[`${selectedLearnerData.grade}-${selectedLearnerData.stream}`] || '-'}</p></div>
                  </div>
                  <div className="space-y-2 no-print">
                    <div className="flex items-center justify-between">
                      <Label>Class Teacher's Comment</Label>
                      <Button variant="outline" size="sm" onClick={() => generateComment(selectedLearnerData)}>
                        Auto-Generate
                      </Button>
                    </div>
                    <Textarea
                      value={comments[selectedLearnerData.id] || ''}
                      onChange={e => setComments(prev => ({ ...prev, [selectedLearnerData.id]: e.target.value }))}
                      placeholder="Enter class teacher's comment..."
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2 no-print">
                    <div className="flex items-center justify-between">
                      <Label>Principal's Comment</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generatePrincipalRemark(selectedLearnerData)}
                        disabled={generatingPrincipalRemark === selectedLearnerData.id}
                      >
                        {generatingPrincipalRemark === selectedLearnerData.id ? (
                          <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Generating...</>
                        ) : (
                          <><Sparkles className="h-3 w-3 mr-1" /> AI Generate</>
                        )}
                      </Button>
                    </div>
                    <Textarea
                      value={principalComments[selectedLearnerData.id] || ''}
                      onChange={e => setPrincipalComments(prev => ({ ...prev, [selectedLearnerData.id]: e.target.value }))}
                      placeholder="Enter principal's comment or click AI Generate..."
                      rows={2}
                    />
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card><CardContent className="py-12 text-center text-muted-foreground">Select a learner to view their report card</CardContent></Card>
            )
          ) : (
            <Card>
              <CardHeader className="text-center">
                <p className="text-lg font-bold uppercase">{schoolName}</p>
                {schoolMotto && <p className="text-sm italic text-muted-foreground">{schoolMotto}</p>}
                {schoolAddress && <p className="text-xs text-muted-foreground">{schoolAddress}</p>}
                <CardTitle className="font-display">
                  {isSchoolWide
                    ? `Whole School Report — Term ${selectedTerm}, ${selectedYear}`
                    : selectedGrades.length > 1
                      ? `Combined Report — Grades ${selectedGrades.join(', ')} ${streamLabel} — Term ${selectedTerm}, ${selectedYear}`
                      : `Grade ${selectedGrade} ${streamLabel} — Term ${selectedTerm}, ${selectedYear}`}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Name</TableHead>
                      {(isSchoolWide || selectedGrades.length > 1) && <TableHead>Class</TableHead>}
                      {!isSchoolWide && selectedGrades.length === 1 && gradeSubjects.map(s => (
                        <TableHead key={s.id} className="text-center">{s.name}</TableHead>
                      ))}
                      <TableHead className="text-center">Total</TableHead>
                      <TableHead className="text-center">Mean</TableHead>
                      <TableHead className="text-center">Grade</TableHead>
                      <TableHead className="text-center">Rank</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.map(l => (
                      <TableRow key={l.id}>
                        <TableCell>{l.rank}</TableCell>
                        <TableCell className="font-medium">{l.full_name}</TableCell>
                        {(isSchoolWide || selectedGrades.length > 1) && <TableCell>{l.grade}{l.stream}</TableCell>}
                        {!isSchoolWide && selectedGrades.length === 1 && l.subjectData.map((s: any) => (
                          <TableCell key={s.id} className="text-center">
                            <div>
                              <span className={s.grade !== '-' ? getGradeColor(s.grade) : ''}>{s.score}</span>
                              {s.grade !== '-' && (
                                <span className={`block text-xs ${getGradeColor(s.grade)}`}>{s.grade}</span>
                              )}
                            </div>
                          </TableCell>
                        ))}
                        <TableCell className="text-center font-bold">{l.total}</TableCell>
                        <TableCell className="text-center">{l.mean.toFixed(1)}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={l.overallGrade !== '-' ? getGradeColor(l.overallGrade as any) : ''}>
                            {l.overallGrade}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center font-bold">{l.rank}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  {!isSchoolWide && selectedGrades.length === 1 && subjectMeans.length > 0 && (
                    <tfoot className="bg-muted/40 font-semibold border-t-2">
                      <TableRow>
                        <TableCell colSpan={(isSchoolWide || selectedGrades.length > 1) ? 3 : 2} className="text-right uppercase text-xs tracking-wide">
                          Subject Mean
                        </TableCell>
                        {gradeSubjects.map(sub => {
                          const sm = subjectMeans.find(m => m.name === sub.name);
                          return (
                            <TableCell key={sub.id} className="text-center">
                              {sm ? sm.mean.toFixed(1) : '-'}
                            </TableCell>
                          );
                        })}
                        {(() => {
                          const totalSum = reportData.reduce((a, l) => a + l.total, 0);
                          const meanTotal = reportData.length ? totalSum / reportData.length : 0;
                          const maxTotal = gradeSubjects.reduce((s, sub) => s + sub.max_score, 0);
                          const avgMax = gradeSubjects.length ? maxTotal / gradeSubjects.length : 100;
                          const gradeForClass = gradeSubjects.length && reportData.length
                            ? getGradeForLevel(classMean, avgMax, reportData[0].grade)
                            : '-';
                          return (
                            <>
                              <TableCell className="text-center">{reportData.length ? meanTotal.toFixed(1) : '-'}</TableCell>
                              <TableCell className="text-center">{classMean.toFixed(1)}</TableCell>
                              <TableCell className="text-center">{gradeForClass}</TableCell>
                              <TableCell className="text-center">—</TableCell>
                            </>
                          );
                        })()}
                      </TableRow>
                    </tfoot>
                  )}
                </Table>
                <div className="p-4 border-t grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Class Mean:</span> <strong>{classMean.toFixed(1)}</strong></div>
                  <div><span className="text-muted-foreground">Highest Total:</span> <strong>{highest}</strong></div>
                  <div><span className="text-muted-foreground">Lowest Total:</span> <strong>{lowest}</strong></div>
                  <div><span className="text-muted-foreground">Total Learners:</span> <strong>{reportData.length}</strong></div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
