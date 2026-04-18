import { useState, useMemo, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, BookOpen, Download, Printer, Pencil, RotateCcw, Lock, Unlock, ShieldCheck, Info, ChevronsUpDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getCbcSubjectsForGrade } from '@/data/cbc-subjects';
import { type SchemeRow, type LessonPlanData } from '@/lib/content-generation-templates';
import { generateCurriculumScheme, generateCurriculumLessonPlan, defaultWeeksForTerm, type CurriculumMode } from '@/lib/curriculum-engine';
import { findActiveCurriculumDesign, type DbCurriculumDesign, type DbSubStrand } from '@/lib/curriculum-db';
import { downloadSchemeOfWorkPdf, downloadLessonPlanPdf } from '@/lib/content-generation-pdf';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

// Hardcoded grade list (CBC scope) — independent of school config
const ALL_GRADES = ['PP1', 'PP2', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9'];
const ALL_TERMS = ['Term 1', 'Term 2', 'Term 3'];

export default function ContentGenerationPage() {
  const { profile } = useAuth();
  const [grade, setGrade] = useState('');
  const [subject, setSubject] = useState('');
  const [term, setTerm] = useState('');

  // Multi-select selection (sub-strand IDs from the loaded KICD design)
  const [selectedSubStrandIds, setSelectedSubStrandIds] = useState<string[]>([]);
  // Single sub-strand for lesson plan (must be one of the selected, or any from design)
  const [lessonSubStrandId, setLessonSubStrandId] = useState('');

  const [activeTab, setActiveTab] = useState('scheme');

  // Generated content state
  const [schemeRows, setSchemeRows] = useState<SchemeRow[] | null>(null);
  const [lessonPlan, setLessonPlan] = useState<LessonPlanData | null>(null);
  const [editingScheme, setEditingScheme] = useState(false);
  const [editingLesson, setEditingLesson] = useState(false);
  const [lessonDate, setLessonDate] = useState(new Date().toISOString().split('T')[0]);
  const [lessonDuration, setLessonDuration] = useState('40 minutes');
  const [schoolName, setSchoolName] = useState('');

  // --- Curriculum-Driven Engine state ---
  const [curriculumMode, setCurriculumMode] = useState<CurriculumMode>('lock');
  const [extraActivities, setExtraActivities] = useState('');
  const [extraResources, setExtraResources] = useState('');
  const [design, setDesign] = useState<DbCurriculumDesign | null>(null);
  const [loadingDesign, setLoadingDesign] = useState(false);

  // --- Term scheduling (teacher-customisable) ---
  const [totalWeeks, setTotalWeeks] = useState<number>(13);
  const [midTermWeek, setMidTermWeek] = useState<number>(7);

  // Reset weeks/mid-term when term changes (use KICD defaults)
  useEffect(() => {
    if (term) {
      const w = defaultWeeksForTerm(term);
      setTotalWeeks(w);
      setMidTermWeek(Math.max(1, Math.floor(w / 2)));
    }
  }, [term]);

  // Subjects come strictly from CBC official list for the selected grade
  const subjects = useMemo(() => grade ? getCbcSubjectsForGrade(grade) : [], [grade]);

  // Load the active KICD design whenever grade/subject/term changes
  useEffect(() => {
    let alive = true;
    if (grade && subject && term) {
      setLoadingDesign(true);
      findActiveCurriculumDesign(grade, subject, term)
        .then((d) => {
          if (!alive) return;
          setDesign(d);
          // Default-select every sub-strand when a design loads
          if (d) {
            const allIds = d.strands.flatMap((s) => s.subStrands.map((ss) => ss.id));
            setSelectedSubStrandIds(allIds);
          } else {
            setSelectedSubStrandIds([]);
          }
          setLessonSubStrandId('');
        })
        .finally(() => { if (alive) setLoadingDesign(false); });
    } else {
      setDesign(null);
      setSelectedSubStrandIds([]);
      setLessonSubStrandId('');
    }
    return () => { alive = false; };
  }, [grade, subject, term]);

  const kicdAvailable = !!design;

  // Flat list (with strand label) for the multi-select & lesson dropdown
  const allSubStrands = useMemo(() => {
    if (!design) return [] as { id: string; label: string; strand: string; ss: DbSubStrand }[];
    const out: { id: string; label: string; strand: string; ss: DbSubStrand }[] = [];
    for (const s of design.strands) {
      for (const ss of s.subStrands) {
        out.push({ id: ss.id, label: ss.name, strand: s.name, ss });
      }
    }
    return out;
  }, [design]);

  const resetBelow = (level: 'grade' | 'subject' | 'term') => {
    if (level === 'grade') { setSubject(''); setTerm(''); }
    if (level === 'subject') { setTerm(''); }
    setSchemeRows(null);
    setLessonPlan(null);
  };

  const toggleSubStrand = (id: string) => {
    setSelectedSubStrandIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };
  const selectAllSubStrands = () => setSelectedSubStrandIds(allSubStrands.map((x) => x.id));
  const clearSubStrands = () => setSelectedSubStrandIds([]);

  const handleGenerateScheme = async () => {
    if (!grade || !subject || !term) {
      toast.error('Please select Grade, Subject, and Term');
      return;
    }
    if (!kicdAvailable) {
      toast.error('No KICD curriculum design uploaded for this Grade/Subject/Term. Ask your administrator to upload one.');
      return;
    }
    if (selectedSubStrandIds.length === 0) {
      toast.error('Pick at least one sub-strand to schedule');
      return;
    }
    const flex = curriculumMode === 'flex' ? {
      extraActivities: extraActivities.split('\n').map(s => s.trim()).filter(Boolean),
      extraResources: extraResources.split(',').map(s => s.trim()).filter(Boolean),
    } : undefined;

    const result = await generateCurriculumScheme({
      grade, subject, term, mode: curriculumMode, flex,
      selectedSubStrandIds,
      totalWeeks,
      midTermWeek,
    });
    if (!result) {
      toast.error('Could not load the curriculum design');
      return;
    }
    setSchemeRows(result.rows);
    setEditingScheme(false);
    if (result.warnings.length > 0) {
      toast.warning(result.warnings[0]);
    } else {
      toast.success(`KICD curriculum loaded — ${result.scheduledLessons} lessons scheduled (${curriculumMode === 'lock' ? 'Lock' : 'Flex'} mode)`);
    }
  };

  const handleGenerateLesson = async () => {
    if (!grade || !subject || !term || !lessonSubStrandId) {
      toast.error('Select Grade, Subject, Term and a Sub-Strand');
      return;
    }
    if (!kicdAvailable) {
      toast.error('No KICD curriculum design uploaded for this combination.');
      return;
    }
    const plan = await generateCurriculumLessonPlan({
      grade, subject, term,
      subStrandId: lessonSubStrandId,
      school: schoolName || 'My School',
      teacher: profile?.full_name || 'Teacher',
      date: lessonDate,
      duration: lessonDuration,
    });
    if (!plan) {
      toast.error('Could not build lesson plan from the loaded design');
      return;
    }
    setLessonPlan(plan);
    setEditingLesson(false);
    toast.success('Lesson plan generated from KICD design');
  };

  const handleSchemeEdit = (idx: number, field: keyof SchemeRow, value: string) => {
    if (!schemeRows) return;
    const updated = [...schemeRows];
    (updated[idx] as any)[field] = value;
    setSchemeRows(updated);
  };

  const handleLessonEdit = (field: string, value: any) => {
    if (!lessonPlan) return;
    setLessonPlan({ ...lessonPlan, [field]: value });
  };

  const handleDownloadSchemePdf = () => {
    if (!schemeRows) return;
    downloadSchemeOfWorkPdf(schemeRows, grade, subject, term, schoolName || 'My School', profile?.full_name || 'Teacher');
  };

  const handleDownloadLessonPdf = () => {
    if (!lessonPlan) return;
    downloadLessonPlanPdf(lessonPlan);
  };

  const subStrandTriggerLabel = selectedSubStrandIds.length === 0
    ? 'Select sub-strands…'
    : selectedSubStrandIds.length === allSubStrands.length
      ? `All ${allSubStrands.length} sub-strands`
      : `${selectedSubStrandIds.length} sub-strand${selectedSubStrandIds.length === 1 ? '' : 's'} selected`;

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6 pb-24 md:pb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            Content Generation
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Generate KICD-aligned Schemes of Work and Lesson Plans</p>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Select Curriculum Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Grade</Label>
                <Select value={grade} onValueChange={(v) => { setGrade(v); resetBelow('grade'); }}>
                  <SelectTrigger><SelectValue placeholder="Select Grade" /></SelectTrigger>
                  <SelectContent>{ALL_GRADES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Subject</Label>
                <Select value={subject} onValueChange={(v) => { setSubject(v); resetBelow('subject'); }} disabled={!grade}>
                  <SelectTrigger><SelectValue placeholder="Select Subject" /></SelectTrigger>
                  <SelectContent>{subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Term</Label>
                <Select value={term} onValueChange={(v) => { setTerm(v); }} disabled={!subject}>
                  <SelectTrigger><SelectValue placeholder="Select Term" /></SelectTrigger>
                  <SelectContent>{ALL_TERMS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              {/* Multi-select sub-strands (driven by uploaded design) */}
              <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
                <Label className="text-sm font-medium">Sub-Strands (multi-select)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      disabled={!kicdAvailable || allSubStrands.length === 0}
                      className="w-full justify-between font-normal"
                    >
                      {subStrandTriggerLabel}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[min(420px,90vw)] p-0" align="start">
                    <div className="flex items-center justify-between border-b p-2 text-xs">
                      <span className="text-muted-foreground">{selectedSubStrandIds.length}/{allSubStrands.length} selected</span>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={selectAllSubStrands}>Select all</Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={clearSubStrands}>Clear</Button>
                      </div>
                    </div>
                    <ScrollArea className="max-h-[300px]">
                      <div className="p-1">
                        {allSubStrands.map(({ id, label, strand }) => (
                          <label
                            key={id}
                            className="flex items-start gap-2 rounded px-2 py-1.5 hover:bg-accent cursor-pointer"
                          >
                            <Checkbox
                              checked={selectedSubStrandIds.includes(id)}
                              onCheckedChange={() => toggleSubStrand(id)}
                              className="mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm leading-tight">{label}</p>
                              <p className="text-[11px] text-muted-foreground">{strand}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Single sub-strand picker for the LESSON PLAN tab */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Sub-Strand for Lesson Plan</Label>
                <Select value={lessonSubStrandId} onValueChange={setLessonSubStrandId} disabled={!kicdAvailable}>
                  <SelectTrigger><SelectValue placeholder="Pick sub-strand" /></SelectTrigger>
                  <SelectContent>
                    {allSubStrands.map(({ id, label, strand }) => (
                      <SelectItem key={id} value={id}>{strand} → {label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Additional fields for lesson plan */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">School Name</Label>
                <Input value={schoolName} onChange={e => setSchoolName(e.target.value)} placeholder="Enter school name" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Date</Label>
                <Input type="date" value={lessonDate} onChange={e => setLessonDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Lesson Duration</Label>
                <Select value={lessonDuration} onValueChange={setLessonDuration}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30 minutes">30 minutes</SelectItem>
                    <SelectItem value="35 minutes">35 minutes</SelectItem>
                    <SelectItem value="40 minutes">40 minutes</SelectItem>
                    <SelectItem value="45 minutes">45 minutes</SelectItem>
                    <SelectItem value="60 minutes">60 minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Curriculum-Driven Engine panel */}
        {grade && subject && term && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Curriculum-Driven Engine
                {loadingDesign ? (
                  <Badge variant="outline">Loading…</Badge>
                ) : kicdAvailable ? (
                  <Badge className="bg-primary">KICD design loaded</Badge>
                ) : (
                  <Badge variant="destructive">No KICD design</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {kicdAvailable ? (
                <>
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>100% KICD-aligned</AlertTitle>
                    <AlertDescription className="text-xs">
                      SLOs, strands, sub-strands, activities and lesson allocations are pulled
                      verbatim from the official curriculum design for {grade} — {subject} — {term}.
                    </AlertDescription>
                  </Alert>
                  <div className="flex items-center justify-between gap-3 rounded-md border p-3">
                    <div className="flex items-center gap-2">
                      {curriculumMode === 'lock'
                        ? <Lock className="h-4 w-4 text-primary" />
                        : <Unlock className="h-4 w-4 text-primary" />}
                      <div>
                        <p className="text-sm font-medium">
                          {curriculumMode === 'lock' ? 'Lock mode' : 'Smart Flex mode'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {curriculumMode === 'lock'
                            ? 'SLOs and structure are read-only — printed exactly as KICD specifies.'
                            : 'Append extra activities/resources only. SLOs and structure stay locked.'}
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={curriculumMode === 'flex'}
                      onCheckedChange={(v) => setCurriculumMode(v ? 'flex' : 'lock')}
                    />
                  </div>
                  {curriculumMode === 'flex' && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Extra activities (one per line)</Label>
                        <Textarea
                          rows={3}
                          placeholder={'e.g. Watch YouTube clip on…\nVisit nearby market for survey…'}
                          value={extraActivities}
                          onChange={e => setExtraActivities(e.target.value)}
                          className="text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Extra resources (comma-separated)</Label>
                        <Textarea
                          rows={3}
                          placeholder="e.g. Projector, weather chart, real flowers"
                          value={extraResources}
                          onChange={e => setExtraResources(e.target.value)}
                          className="text-xs"
                        />
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <Alert variant="destructive">
                  <Info className="h-4 w-4" />
                  <AlertTitle>No KICD curriculum uploaded</AlertTitle>
                  <AlertDescription className="text-xs">
                    There is no official KICD design loaded for <strong>{grade} — {subject} — {term}</strong>.
                    Schemes of Work and Lesson Plans can only be generated from an uploaded KICD design,
                    so SLOs are 100% authentic. Please ask your administrator to upload the curriculum
                    design PDF for this combination.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="scheme" className="flex items-center gap-1.5">
              <FileText className="h-4 w-4" /> Scheme of Work
            </TabsTrigger>
            <TabsTrigger value="lesson" className="flex items-center gap-1.5">
              <BookOpen className="h-4 w-4" /> Lesson Plan
            </TabsTrigger>
          </TabsList>

          {/* Scheme of Work */}
          <TabsContent value="scheme" className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleGenerateScheme}
                disabled={!grade || !subject || !term || !kicdAvailable || selectedSubStrandIds.length === 0}
              >
                <RotateCcw className="h-4 w-4 mr-1.5" /> Generate Scheme
              </Button>
              {schemeRows && (
                <>
                  <Button variant="outline" onClick={() => setEditingScheme(!editingScheme)}>
                    <Pencil className="h-4 w-4 mr-1.5" /> {editingScheme ? 'Done Editing' : 'Edit'}
                  </Button>
                  <Button variant="outline" onClick={handleDownloadSchemePdf}>
                    <Download className="h-4 w-4 mr-1.5" /> Download PDF
                  </Button>
                  <Button variant="outline" onClick={() => window.print()}>
                    <Printer className="h-4 w-4 mr-1.5" /> Print
                  </Button>
                </>
              )}
            </div>

            {schemeRows && (
              <Card className="print-area">
                <CardHeader className="text-center border-b pb-4">
                  <p className="text-lg font-bold">{schoolName || 'School Name'}</p>
                  <CardTitle className="text-base">SCHEME OF WORK — {grade} | {subject} | {term}</CardTitle>
                  <p className="text-sm text-muted-foreground">Teacher: {profile?.full_name || 'N/A'}</p>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-primary/10">
                          <TableHead className="font-bold text-foreground w-12">Wk</TableHead>
                          <TableHead className="font-bold text-foreground w-12">Lsn</TableHead>
                          <TableHead className="font-bold text-foreground">Strand</TableHead>
                          <TableHead className="font-bold text-foreground">Sub-Strand</TableHead>
                          <TableHead className="font-bold text-foreground min-w-[220px] whitespace-pre-line">Specific Learning Outcomes</TableHead>
                          <TableHead className="font-bold text-foreground min-w-[200px]">Learning Experiences</TableHead>
                          <TableHead className="font-bold text-foreground min-w-[160px]">Key Inquiry Question(s)</TableHead>
                          <TableHead className="font-bold text-foreground">Resources</TableHead>
                          <TableHead className="font-bold text-foreground min-w-[140px]">Assessment</TableHead>
                          <TableHead className="font-bold text-foreground w-24">Remarks</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {schemeRows.map((row, i) => (
                          <TableRow key={i} className={row.isBreak ? 'bg-amber-50 dark:bg-amber-950/30 font-semibold' : ''}>
                            <TableCell className="font-semibold text-center align-top">{row.week}</TableCell>
                            <TableCell className="font-semibold text-center align-top">{row.lesson}</TableCell>
                            {editingScheme && !row.isBreak ? (
                              <>
                                <TableCell><Input value={row.strand} onChange={e => handleSchemeEdit(i, 'strand', e.target.value)} className="text-sm" /></TableCell>
                                <TableCell><Input value={row.subStrand} onChange={e => handleSchemeEdit(i, 'subStrand', e.target.value)} className="text-sm" /></TableCell>
                                <TableCell><Textarea value={row.slo} onChange={e => handleSchemeEdit(i, 'slo', e.target.value)} className="text-sm min-h-[100px] whitespace-pre-line" /></TableCell>
                                <TableCell><Textarea value={row.experiences} onChange={e => handleSchemeEdit(i, 'experiences', e.target.value)} className="text-sm min-h-[60px]" /></TableCell>
                                <TableCell><Textarea value={row.inquiry} onChange={e => handleSchemeEdit(i, 'inquiry', e.target.value)} className="text-sm min-h-[60px]" /></TableCell>
                                <TableCell><Input value={row.resources} onChange={e => handleSchemeEdit(i, 'resources', e.target.value)} className="text-sm" /></TableCell>
                                <TableCell><Input value={row.assessment} onChange={e => handleSchemeEdit(i, 'assessment', e.target.value)} className="text-sm" /></TableCell>
                                <TableCell><Input value={row.remarks} onChange={e => handleSchemeEdit(i, 'remarks', e.target.value)} className="text-sm" /></TableCell>
                              </>
                            ) : (
                              <>
                                <TableCell className="text-sm align-top">{row.strand}</TableCell>
                                <TableCell className="text-sm align-top">{row.subStrand}</TableCell>
                                <TableCell className="text-sm align-top whitespace-pre-line">{row.slo}</TableCell>
                                <TableCell className="text-sm align-top">{row.experiences}</TableCell>
                                <TableCell className="text-sm align-top">{row.inquiry}</TableCell>
                                <TableCell className="text-sm align-top">{row.resources}</TableCell>
                                <TableCell className="text-sm align-top">{row.assessment}</TableCell>
                                <TableCell className="text-sm align-top">{row.remarks}</TableCell>
                              </>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {!schemeRows && (
              <Card className="p-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">
                  {kicdAvailable
                    ? 'Pick the sub-strands to schedule, then click "Generate Scheme".'
                    : 'Select Grade, Subject, and Term — a KICD design must be uploaded for that combination before a scheme can be generated.'}
                </p>
              </Card>
            )}
          </TabsContent>

          {/* Lesson Plan */}
          <TabsContent value="lesson" className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleGenerateLesson}
                disabled={!grade || !subject || !term || !kicdAvailable || !lessonSubStrandId}
              >
                <RotateCcw className="h-4 w-4 mr-1.5" /> Generate Lesson Plan
              </Button>
              {lessonPlan && (
                <>
                  <Button variant="outline" onClick={() => setEditingLesson(!editingLesson)}>
                    <Pencil className="h-4 w-4 mr-1.5" /> {editingLesson ? 'Done Editing' : 'Edit'}
                  </Button>
                  <Button variant="outline" onClick={handleDownloadLessonPdf}>
                    <Download className="h-4 w-4 mr-1.5" /> Download PDF
                  </Button>
                  <Button variant="outline" onClick={() => window.print()}>
                    <Printer className="h-4 w-4 mr-1.5" /> Print
                  </Button>
                </>
              )}
            </div>

            {lessonPlan && (
              <Card className="print-area">
                <CardContent className="p-4 sm:p-6 space-y-6">
                  <div className="text-center border-b pb-4">
                    <h2 className="text-lg font-bold">{lessonPlan.school}</h2>
                    <h3 className="text-base font-semibold mt-1">LESSON PLAN</h3>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm border rounded-lg p-4 bg-muted/30">
                    <div><span className="font-semibold">Teacher:</span> {editingLesson ? <Input value={lessonPlan.teacher} onChange={e => handleLessonEdit('teacher', e.target.value)} className="mt-1" /> : <span className="ml-1">{lessonPlan.teacher}</span>}</div>
                    <div><span className="font-semibold">Grade:</span><span className="ml-1">{lessonPlan.grade}</span></div>
                    <div><span className="font-semibold">Subject:</span><span className="ml-1">{lessonPlan.subject}</span></div>
                    <div><span className="font-semibold">Term:</span><span className="ml-1">{lessonPlan.term}</span></div>
                    <div><span className="font-semibold">Date:</span><span className="ml-1">{lessonPlan.date}</span></div>
                    <div><span className="font-semibold">Duration:</span><span className="ml-1">{lessonPlan.duration}</span></div>
                    <div className="col-span-2"><span className="font-semibold">Strand:</span><span className="ml-1">{lessonPlan.strand}</span></div>
                    <div className="col-span-2"><span className="font-semibold">Sub-Strand:</span><span className="ml-1">{lessonPlan.subStrand}</span></div>
                    <div className="col-span-2 sm:col-span-4 whitespace-pre-line"><span className="font-semibold">SLO:</span><span className="ml-1">{lessonPlan.slo}</span></div>
                  </div>

                  <LessonSection title="INTRODUCTION" editing={editingLesson}
                    content={lessonPlan.introduction}
                    onEdit={(v) => handleLessonEdit('introduction', v)} />

                  <LessonSection title="LESSON DEVELOPMENT" editing={editingLesson}
                    list={lessonPlan.development}
                    onEditList={(v) => handleLessonEdit('development', v)} />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <LessonSection title="LEARNER ACTIVITIES" editing={editingLesson}
                      list={lessonPlan.learnerActivities}
                      onEditList={(v) => handleLessonEdit('learnerActivities', v)} />
                    <LessonSection title="TEACHER ACTIVITIES" editing={editingLesson}
                      list={lessonPlan.teacherActivities}
                      onEditList={(v) => handleLessonEdit('teacherActivities', v)} />
                  </div>

                  <LessonSection title="RESOURCES" editing={editingLesson}
                    list={lessonPlan.resources}
                    onEditList={(v) => handleLessonEdit('resources', v)} />

                  <LessonSection title="ASSESSMENT" editing={editingLesson}
                    content={lessonPlan.assessment}
                    onEdit={(v) => handleLessonEdit('assessment', v)} />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <LessonSection title="CORE COMPETENCIES" editing={editingLesson}
                      list={lessonPlan.coreCompetencies}
                      onEditList={(v) => handleLessonEdit('coreCompetencies', v)} />
                    <LessonSection title="VALUES" editing={editingLesson}
                      list={lessonPlan.values}
                      onEditList={(v) => handleLessonEdit('values', v)} />
                  </div>

                  <LessonSection title="REFLECTION" editing={editingLesson}
                    content={lessonPlan.reflection}
                    onEdit={(v) => handleLessonEdit('reflection', v)} />
                </CardContent>
              </Card>
            )}

            {!lessonPlan && (
              <Card className="p-12 text-center">
                <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">
                  {kicdAvailable
                    ? 'Pick a sub-strand for the lesson, then click "Generate Lesson Plan".'
                    : 'A KICD curriculum design must be uploaded for this Grade/Subject/Term first.'}
                </p>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

function LessonSection({ title, editing, content, list, onEdit, onEditList }: {
  title: string;
  editing: boolean;
  content?: string;
  list?: string[];
  onEdit?: (v: string) => void;
  onEditList?: (v: string[]) => void;
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-bold text-primary border-b pb-1">{title}</h4>
      {content !== undefined && (
        editing && onEdit ? (
          <Textarea value={content} onChange={e => onEdit(e.target.value)} className="text-sm" />
        ) : (
          <p className="text-sm leading-relaxed whitespace-pre-line">{content}</p>
        )
      )}
      {list && (
        <ul className="list-disc list-inside space-y-1">
          {list.map((item, i) => (
            <li key={i} className="text-sm">
              {editing && onEditList ? (
                <Input value={item} onChange={e => {
                  const updated = [...list];
                  updated[i] = e.target.value;
                  onEditList(updated);
                }} className="inline-block w-[calc(100%-20px)] text-sm" />
              ) : item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
