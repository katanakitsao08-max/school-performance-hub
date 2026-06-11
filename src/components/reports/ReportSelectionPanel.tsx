import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Check, Users, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  TERMS, ASSESSMENT_TYPES, ASSESSMENT_TYPE_LABELS, type AssessmentType,
} from '@/lib/cbc-utils';

export type ViewMode = 'class' | 'individual' | 'school';

interface Props {
  availableGrades: string[];
  dbStreams: string[]; // already filtered to selected grade(s) by parent
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
  selectedGrades: string[];
  setSelectedGrades: (g: string[]) => void;
  selectedStreams: string[];
  setSelectedStreams: (s: string[] | ((p: string[]) => string[])) => void;
  selectedTerm: number;
  setSelectedTerm: (t: number) => void;
  selectedAssessment: AssessmentType | 'merged';
  setSelectedAssessment: (a: AssessmentType | 'merged') => void;
  selectedGenderFilter: 'all' | 'Male' | 'Female';
  setSelectedGenderFilter: (g: 'all' | 'Male' | 'Female') => void;
  mergeCombinedSubjects: boolean;
  setMergeCombinedSubjects: (v: boolean) => void;
  mergedReportsOn: boolean;
  schoolName: string;
  showCombineToggle: boolean;
  learnerCount: number;
  isAdminOrHead: boolean;
}

const QUICK_FILTERS: Record<string, string[]> = {
  'Lower Primary': ['PP1', 'PP2', '1', '2', '3'],
  'Upper Primary': ['4', '5', '6'],
  'Junior School': ['7', '8', '9'],
};

export function ReportSelectionPanel(props: Props) {
  const {
    availableGrades, dbStreams, viewMode, setViewMode,
    selectedGrades, setSelectedGrades, selectedStreams, setSelectedStreams,
    selectedTerm, setSelectedTerm, selectedAssessment, setSelectedAssessment,
    selectedGenderFilter, setSelectedGenderFilter,
    mergeCombinedSubjects, setMergeCombinedSubjects, mergedReportsOn,
    schoolName, showCombineToggle, learnerCount, isAdminOrHead,
  } = props;

  const { schoolId } = useAuth();
  const isSchoolWide = viewMode === 'school';

  // Live learner counts per (grade, stream) for selected grades
  const { data: learnerRows = [] } = useQuery({
    queryKey: ['report-panel-learners', schoolId, selectedGrades.join(',')],
    queryFn: async () => {
      if (!schoolId || selectedGrades.length === 0) return [] as { grade: string; stream: string }[];
      const { data } = await supabase.from('learners')
        .select('grade, stream').eq('school_id', schoolId).eq('is_active', true)
        .in('grade', selectedGrades);
      return (data || []) as { grade: string; stream: string }[];
    },
    enabled: !!schoolId && selectedGrades.length > 0,
    staleTime: 30_000,
  });

  const streamCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const l of learnerRows) m[l.stream] = (m[l.stream] || 0) + 1;
    return m;
  }, [learnerRows]);

  const toggleGrade = (g: string) => {
    if (selectedGrades.includes(g)) {
      const next = selectedGrades.filter(x => x !== g);
      setSelectedGrades(next.length ? next : [g]);
    } else {
      setSelectedGrades([...selectedGrades, g]);
    }
  };

  const toggleStream = (s: string) => {
    setSelectedStreams(prev => {
      if (prev.includes(s)) {
        const next = prev.filter(x => x !== s);
        return next;
      }
      return [...prev, s];
    });
  };

  const allStreamsSelected = dbStreams.length > 0 && dbStreams.every(s => selectedStreams.includes(s));
  const toggleAllStreams = () => {
    if (allStreamsSelected) setSelectedStreams([]);
    else setSelectedStreams(dbStreams);
  };

  const applyQuickFilter = (key: string) => {
    if (key === 'Whole School') {
      setSelectedGrades(availableGrades);
      setSelectedStreams([]);
      setViewMode('school');
      return;
    }
    if (key === 'Current Grade') {
      // no-op: keep current grade selection
      return;
    }
    if (key === 'Custom') {
      return;
    }
    const group = QUICK_FILTERS[key] || [];
    const filtered = availableGrades.filter(g => group.includes(g));
    if (filtered.length) {
      setSelectedGrades(filtered);
      setSelectedStreams([]);
      setViewMode('class');
    }
  };

  const totalLearners = isSchoolWide
    ? '—'
    : (selectedStreams.length
        ? selectedStreams.reduce((s, st) => s + (streamCounts[st] || 0), 0)
        : learnerRows.length);

  return (
    <div className="space-y-4 no-print">
      {/* 1. Report Type */}
      <Card className="shadow-sm">
        <CardContent className="p-4 space-y-2">
          <Label className="text-xs font-semibold uppercase text-muted-foreground">Report Type</Label>
          <Select
            value={viewMode}
            onValueChange={(v) => {
              const next = v as ViewMode;
              setViewMode(next);
              if (next === 'school') setSelectedGrades(availableGrades);
            }}
          >
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="class">Class / Stream Report</SelectItem>
              <SelectItem value="individual">Individual Learner Report</SelectItem>
              {isAdminOrHead && <SelectItem value="school">Whole School Report</SelectItem>}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* 2. Grade chips */}
      {!isSchoolWide && (
        <Card className="shadow-sm">
          <CardContent className="p-4 space-y-3">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">Grade</Label>
            <div className="flex flex-wrap gap-2">
              {availableGrades.map(g => {
                const active = selectedGrades.includes(g);
                return (
                  <button
                    key={g}
                    type="button"
                    role="checkbox"
                    aria-checked={active}
                    onClick={() => toggleGrade(g)}
                    className={cn(
                      'min-w-[56px] h-11 px-4 rounded-full text-sm font-semibold border-2 transition-all',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      active
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm scale-105'
                        : 'bg-background border-border hover:border-primary/40',
                    )}
                  >
                    {active && <Check className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />}
                    G{g}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 3. Classes / Streams */}
      {!isSchoolWide && (
        <Card className="shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Classes / Streams</Label>
              {dbStreams.length > 0 && (
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox checked={allStreamsSelected} onCheckedChange={toggleAllStreams} />
                  <span>Select All</span>
                </label>
              )}
            </div>

            {dbStreams.length === 0 ? (
              <p className="text-xs text-muted-foreground">Select a grade to load its classes.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {dbStreams.map(s => {
                  const active = selectedStreams.includes(s);
                  const count = streamCounts[s] || 0;
                  return (
                    <button
                      key={s}
                      type="button"
                      role="checkbox"
                      aria-checked={active}
                      onClick={() => toggleStream(s)}
                      className={cn(
                        'rounded-xl border-2 p-3 text-left transition-all min-h-[72px]',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        active
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border bg-background hover:border-primary/40',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm truncate">{s}</span>
                        {active && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
                      </div>
                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                        <Users className="h-3 w-3" /> {count} learner{count === 1 ? '' : 's'}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 4-7. Term / Assessment / Combine / Gender — grid */}
      <Card className="shadow-sm">
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">Term</Label>
            <Select value={String(selectedTerm)} onValueChange={v => setSelectedTerm(Number(v))}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>{TERMS.map(t => <SelectItem key={t} value={String(t)}>Term {t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">Assessment</Label>
            <Select value={selectedAssessment} onValueChange={v => setSelectedAssessment(v as AssessmentType | 'merged')}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ASSESSMENT_TYPES.map(at => <SelectItem key={at} value={at}>{ASSESSMENT_TYPE_LABELS[at]}</SelectItem>)}
                {mergedReportsOn && <SelectItem value="merged">Combined (Opener + Mid + End)</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">Gender</Label>
            <Select value={selectedGenderFilter} onValueChange={v => setSelectedGenderFilter(v as any)}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="Male">Male</SelectItem>
                <SelectItem value="Female">Female</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {showCombineToggle && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Combine Related Subjects</Label>
              <div className="flex items-center justify-between h-11 px-3 rounded-md border bg-background">
                <span className="text-sm text-muted-foreground">
                  {mergeCombinedSubjects ? 'Combined' : 'Separate'}
                </span>
                <Switch checked={mergeCombinedSubjects} onCheckedChange={setMergeCombinedSubjects} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 8. Live Selection Summary */}
      <Card className="shadow-sm border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="h-4 w-4 text-primary" />
            <Label className="text-xs font-semibold uppercase text-muted-foreground">Selection Summary</Label>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div><span className="text-muted-foreground">School:</span> <span className="font-medium">{schoolName}</span></div>
            <div><span className="text-muted-foreground">Type:</span> <span className="font-medium capitalize">{viewMode}</span></div>
            <div><span className="text-muted-foreground">Grade(s):</span> <span className="font-medium">{isSchoolWide ? 'All' : (selectedGrades.map(g => `G${g}`).join(', ') || '—')}</span></div>
            <div><span className="text-muted-foreground">Streams:</span> <span className="font-medium">{isSchoolWide ? 'All' : (selectedStreams.join(', ') || 'All in grade')}</span></div>
            <div><span className="text-muted-foreground">Term:</span> <span className="font-medium">Term {selectedTerm}</span></div>
            <div><span className="text-muted-foreground">Assessment:</span> <span className="font-medium">{selectedAssessment === 'merged' ? 'Combined' : ASSESSMENT_TYPE_LABELS[selectedAssessment as AssessmentType]}</span></div>
            <div><span className="text-muted-foreground">Gender:</span> <span className="font-medium">{selectedGenderFilter === 'all' ? 'All' : selectedGenderFilter}</span></div>
            <div><span className="text-muted-foreground">Learners:</span> <Badge variant="secondary">{totalLearners}</Badge></div>
          </div>
        </CardContent>
      </Card>

      {/* 9. Quick Filters */}
      {isAdminOrHead && (
        <Card className="shadow-sm">
          <CardContent className="p-4 space-y-2">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">Quick Filters</Label>
            <div className="flex flex-wrap gap-2">
              {['Current Grade', 'Whole School', 'Lower Primary', 'Upper Primary', 'Junior School', 'Custom'].map(k => (
                <button
                  key={k}
                  type="button"
                  onClick={() => applyQuickFilter(k)}
                  className="h-9 px-3 rounded-full text-xs font-medium border bg-background hover:bg-primary/5 hover:border-primary/40 transition-colors"
                >
                  {k}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
