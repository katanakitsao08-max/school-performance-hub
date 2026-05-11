import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Pencil, Eye, Check, X, Loader2, BookOpen, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { findActiveCurriculumDesign, type DbCurriculumDesign, type DbSubStrand } from '@/lib/curriculum-db';
import { getCbcSubjectsForGrade } from '@/data/cbc-subjects';
import jsPDF from 'jspdf';

const GRADES = ['PP1', 'PP2', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9'];
const TERMS = ['Term 1', 'Term 2', 'Term 3'];
const DIFFICULTIES = [
  { value: 'basic', label: 'Basic' },
  { value: 'standard', label: 'Standard' },
  { value: 'advanced', label: 'Advanced' },
] as const;

interface KeyVocab { term: string; meaning: string }
interface QA { question: string; answer: string }

interface LessonNotes {
  title: string;
  objectives: string[];
  keyVocabulary?: KeyVocab[];
  introduction: string;
  mainContent: string;
  workedExamples: string[];
  classActivities: string[];
  revisionSummary?: string[];
  assessmentQuestions: (string | QA)[];
  homeRevisionTasks?: string[];
  teacherTips: string[];
  competenciesDeveloped?: string[];
  resources?: string[];
}

type Status = 'idle' | 'generating' | 'preview' | 'editing' | 'approved';
type Scope = 'topic' | 'term' | 'year';

interface BulkSection { strand: string; subStrand: string; title: string; mainContent: string }

export function NotesGenerator({ schoolName }: { schoolName?: string }) {
  const [grade, setGrade] = useState('');
  const [subject, setSubject] = useState('');
  const [term, setTerm] = useState('Term 1');
  const [topic, setTopic] = useState('');
  const [subStrandId, setSubStrandId] = useState('');
  const [difficulty, setDifficulty] = useState<'basic' | 'standard' | 'advanced'>('standard');
  const [notes, setNotes] = useState<LessonNotes | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [groundedInKicd, setGroundedInKicd] = useState(false);
  const [scope, setScope] = useState<Scope>('topic');
  const [bulkSections, setBulkSections] = useState<BulkSection[] | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);

  const [design, setDesign] = useState<DbCurriculumDesign | null>(null);
  const [loadingDesign, setLoadingDesign] = useState(false);

  const subjects = useMemo(() => grade ? getCbcSubjectsForGrade(grade) : [], [grade]);

  // Load KICD design whenever grade/subject/term changes
  useEffect(() => {
    let alive = true;
    if (grade && subject && term) {
      setLoadingDesign(true);
      findActiveCurriculumDesign(grade, subject, term)
        .then(d => { if (alive) { setDesign(d); setSubStrandId(''); } })
        .finally(() => { if (alive) setLoadingDesign(false); });
    } else {
      setDesign(null); setSubStrandId('');
    }
    return () => { alive = false; };
  }, [grade, subject, term]);

  const allSubStrands = useMemo(() => {
    if (!design) return [] as { id: string; label: string; strand: string; ss: DbSubStrand }[];
    const out: { id: string; label: string; strand: string; ss: DbSubStrand }[] = [];
    for (const s of design.strands) {
      for (const ss of s.subStrands) out.push({ id: ss.id, label: ss.name, strand: s.name, ss });
    }
    return out;
  }, [design]);

  const selectedSub = allSubStrands.find(x => x.id === subStrandId);

  // Auto-fill topic when a sub-strand is picked
  useEffect(() => {
    if (selectedSub) setTopic(selectedSub.label);
  }, [selectedSub]);

  const generate = async () => {
    const finalTopic = topic.trim() || selectedSub?.label || '';
    if (!grade || !subject.trim() || !finalTopic) {
      toast.error('Please fill Grade, Subject and Topic (or pick a sub-strand)');
      return;
    }
    setStatus('generating');
    try {
      const kicd = selectedSub ? {
        designTitle: design?.title ?? null,
        strand: selectedSub.strand,
        subStrand: selectedSub.label,
        slos: selectedSub.ss.slos,
        activities: selectedSub.ss.activities,
        assessmentMethods: selectedSub.ss.assessmentMethods,
        inquiryQuestions: selectedSub.ss.inquiryQuestions,
        resources: selectedSub.ss.resources,
        competencies: selectedSub.ss.competencies,
        values: selectedSub.ss.values,
        pcis: selectedSub.ss.pcis,
      } : null;

      const { data, error } = await supabase.functions.invoke('generate-lesson-notes', {
        body: { grade, subject: subject.trim(), topic: finalTopic, difficulty, kicd },
      });
      if (error) throw error;
      if (!data?.notes) throw new Error('No notes returned');
      setNotes(data.notes);
      setGroundedInKicd(!!data.groundedInKicd);
      setStatus('preview');
      toast.success(data.groundedInKicd ? 'KICD-grounded notes generated' : 'Lesson notes generated');
    } catch (e: any) {
      setStatus('idle');
      toast.error(e?.message || 'Failed to generate notes');
    }
  };

  const discard = () => { setNotes(null); setStatus('idle'); };
  const approve = () => { setStatus('approved'); toast.success('Notes approved & ready to use'); };

  const downloadPdf = () => {
    if (!notes) return;
    const doc = new jsPDF();
    const margin = 15;
    let y = margin;
    const pageW = doc.internal.pageSize.getWidth();
    const maxW = pageW - margin * 2;

    const writeHeader = () => {
      doc.setFontSize(10); doc.setTextColor(100);
      doc.text(schoolName || 'PerformTrack', margin, 8);
      doc.setTextColor(0);
    };
    const ensureSpace = (h: number) => {
      if (y + h > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage(); y = margin; writeHeader();
      }
    };
    const writeTitle = (t: string, size = 14) => {
      ensureSpace(size + 4);
      doc.setFontSize(size); doc.setFont('helvetica', 'bold');
      doc.text(t, margin, y); y += size * 0.45 + 3;
      doc.setFont('helvetica', 'normal');
    };
    const writeText = (txt: string, size = 11) => {
      doc.setFontSize(size);
      const lines = doc.splitTextToSize(txt, maxW);
      lines.forEach((ln: string) => {
        ensureSpace(size * 0.5 + 1);
        doc.text(ln, margin, y); y += size * 0.5 + 1;
      });
      y += 2;
    };
    // Textbook-aware renderer: ALL-CAPS line → big bold heading; capitalised short line → mini heading; ✓/- → bullets.
    const writeRich = (txt: string) => {
      (txt || '').split(/\n/).forEach((rawLine) => {
        const line = rawLine.trimEnd();
        if (!line.trim()) { y += 3; return; }
        const trimmed = line.trim();
        const isAllCaps = /^[A-Z0-9 ,'’\-&/()]{3,}$/.test(trimmed) && /[A-Z]/.test(trimmed);
        const isTick = /^\s*✓\s+/.test(line);
        const isDash = /^\s*-\s+/.test(line);
        const isMiniHead = !isAllCaps && !isTick && !isDash &&
          /^[A-Z]/.test(trimmed) && trimmed.length < 70 && !/[.!?]$/.test(trimmed) && !trimmed.includes('—');
        if (isAllCaps) {
          y += 2;
          doc.setFontSize(13); doc.setFont('helvetica', 'bold');
          ensureSpace(8); doc.text(trimmed, margin, y); y += 7;
          doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
          return;
        }
        if (isMiniHead) {
          y += 1;
          doc.setFontSize(11.5); doc.setFont('helvetica', 'bold');
          ensureSpace(6); doc.text(trimmed, margin, y); y += 5.5;
          doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
          return;
        }
        if (isTick || isDash) {
          const bullet = isTick ? '•' : '–';
          const content = line.replace(/^\s*[✓\-]\s+/, '');
          doc.setFontSize(11);
          const wrapped = doc.splitTextToSize(content, maxW - 6);
          wrapped.forEach((ln: string, i: number) => {
            ensureSpace(6);
            if (i === 0) doc.text(bullet, margin + 2, y);
            doc.text(ln, margin + 7, y);
            y += 5.5;
          });
          return;
        }
        doc.setFontSize(11);
        const wrapped = doc.splitTextToSize(line, maxW);
        wrapped.forEach((ln: string) => { ensureSpace(6); doc.text(ln, margin, y); y += 5.5; });
      });
      y += 2;
    };
    const writeList = (items: string[]) => {
      doc.setFontSize(11);
      items.forEach((it, i) => {
        const lines = doc.splitTextToSize(`${i + 1}. ${it}`, maxW - 4);
        lines.forEach((ln: string) => { ensureSpace(6); doc.text(ln, margin + 2, y); y += 5.5; });
      });
      y += 2;
    };
    const writeQA = (items: (string | QA)[]) => {
      doc.setFontSize(11);
      items.forEach((it, i) => {
        const q = typeof it === 'string' ? it : it.question;
        const a = typeof it === 'string' ? '' : it.answer;
        doc.setFont('helvetica', 'bold');
        const ql = doc.splitTextToSize(`Q${i + 1}. ${q}`, maxW - 4);
        ql.forEach((ln: string) => { ensureSpace(6); doc.text(ln, margin + 2, y); y += 5.5; });
        if (a) {
          doc.setFont('helvetica', 'normal');
          const al = doc.splitTextToSize(`Ans: ${a}`, maxW - 6);
          al.forEach((ln: string) => { ensureSpace(6); doc.text(ln, margin + 4, y); y += 5; });
        }
        y += 1;
      });
      doc.setFont('helvetica', 'normal');
      y += 2;
    };
    const writeVocab = (items: KeyVocab[]) => {
      doc.setFontSize(11);
      items.forEach((it) => {
        const line = `• ${it.term} — ${it.meaning}`;
        const lines = doc.splitTextToSize(line, maxW - 4);
        lines.forEach((ln: string) => { ensureSpace(6); doc.text(ln, margin + 2, y); y += 5.5; });
      });
      y += 2;
    };

    writeHeader();
    writeTitle(notes.title, 16);
    writeText(`${grade} • ${subject} • ${difficulty.toUpperCase()}${groundedInKicd ? ' • KICD-grounded' : ''}`);

    writeTitle('Learning Objectives'); writeList(notes.objectives);
    if (notes.keyVocabulary?.length) { writeTitle('Key Vocabulary'); writeVocab(notes.keyVocabulary); }
    writeTitle('Introduction'); writeText(notes.introduction);
    writeTitle('Main Content'); writeRich(notes.mainContent);
    writeTitle('Worked Examples'); writeList(notes.workedExamples);
    writeTitle('Class Activities'); writeList(notes.classActivities);
    if (notes.revisionSummary?.length) { writeTitle('Revision Summary'); writeList(notes.revisionSummary); }
    writeTitle('Assessment Questions'); writeQA(notes.assessmentQuestions);
    if (notes.homeRevisionTasks?.length) { writeTitle('Home Revision Tasks'); writeList(notes.homeRevisionTasks); }
    writeTitle('Teacher Notes / Tips'); writeList(notes.teacherTips);
    if (notes.competenciesDeveloped?.length) { writeTitle('Competencies Developed'); writeList(notes.competenciesDeveloped); }
    if (notes.resources?.length) { writeTitle('Resources'); writeList(notes.resources); }

    doc.save(`${notes.title.replace(/[^a-z0-9]+/gi, '_')}.pdf`);
  };

  const updateField = <K extends keyof LessonNotes>(key: K, value: LessonNotes[K]) => {
    setNotes(prev => prev ? { ...prev, [key]: value } : prev);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 flex-wrap">
          <BookOpen className="h-5 w-5" />
          AI Lesson & Revision Notes
          <Badge variant="secondary" className="text-[10px]">CBC-aligned</Badge>
          {design && <Badge className="text-[10px] bg-primary"><ShieldCheck className="h-3 w-3 mr-1" />KICD design loaded</Badge>}
        </CardTitle>
        <CardDescription>
          Pick a Grade/Subject/Term to load the KICD design, then choose a sub-strand. The AI will build notes strictly from
          the loaded KICD scope — useful for teachers AND as revision notes for learners.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Inputs */}
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <Label>Class</Label>
            <Select value={grade} onValueChange={setGrade}>
              <SelectTrigger><SelectValue placeholder="Grade" /></SelectTrigger>
              <SelectContent>{GRADES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Subject</Label>
            <Select value={subject} onValueChange={setSubject} disabled={!grade}>
              <SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
              <SelectContent>{subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Term</Label>
            <Select value={term} onValueChange={setTerm} disabled={!subject}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TERMS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Difficulty</Label>
            <Select value={difficulty} onValueChange={v => setDifficulty(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DIFFICULTIES.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Sub-Strand (from loaded KICD design)</Label>
            <Select value={subStrandId} onValueChange={setSubStrandId} disabled={!design || allSubStrands.length === 0}>
              <SelectTrigger>
                <SelectValue placeholder={loadingDesign ? 'Loading design…' : design ? 'Pick sub-strand' : 'No KICD design loaded'} />
              </SelectTrigger>
              <SelectContent>
                {allSubStrands.map(({ id, label, strand }) => (
                  <SelectItem key={id} value={id}>{strand} → {label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!design && grade && subject && term && !loadingDesign && (
              <p className="text-[11px] text-muted-foreground mt-1">
                No KICD design uploaded for this combination. AI will fall back to the official CBC scope.
              </p>
            )}
          </div>
          <div>
            <Label>Topic / Sub-Strand title</Label>
            <Input value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Fractions" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={generate} disabled={status === 'generating'}>
            {status === 'generating'
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating…</>
              : <><Sparkles className="h-4 w-4 mr-2" /> Generate Notes</>}
          </Button>
          {notes && status !== 'editing' && (
            <Button variant="outline" onClick={() => setStatus('editing')}>
              <Pencil className="h-4 w-4 mr-2" /> Edit
            </Button>
          )}
          {notes && status === 'editing' && (
            <Button variant="outline" onClick={() => setStatus('preview')}>
              <Eye className="h-4 w-4 mr-2" /> Preview
            </Button>
          )}
          {notes && status !== 'approved' && (
            <Button variant="default" onClick={approve}>
              <Check className="h-4 w-4 mr-2" /> Approve & Publish
            </Button>
          )}
          {notes && status === 'approved' && (
            <Button variant="default" onClick={downloadPdf}>
              <Check className="h-4 w-4 mr-2" /> Download PDF
            </Button>
          )}
          {notes && (
            <Button variant="ghost" onClick={discard}>
              <X className="h-4 w-4 mr-2" /> Discard
            </Button>
          )}
        </div>

        {/* Output */}
        {notes && (
          <div className="border rounded-lg p-4 space-y-4 bg-card">
            <div className="flex items-center gap-2 flex-wrap">
              {status === 'approved' && (
                <Badge className="bg-primary"><Check className="h-3 w-3 mr-1" /> Approved</Badge>
              )}
              {groundedInKicd && (
                <Badge variant="outline"><ShieldCheck className="h-3 w-3 mr-1" /> Grounded in KICD design</Badge>
              )}
            </div>

            <Section title="Topic Title" editing={status === 'editing'}
              value={notes.title} onChange={v => updateField('title', v)} isText />

            <Section title="Learning Objectives" editing={status === 'editing'}
              listValue={notes.objectives} onListChange={v => updateField('objectives', v)} />

            {(notes.keyVocabulary?.length || status === 'editing') && (
              <VocabSection
                editing={status === 'editing'}
                value={notes.keyVocabulary || []}
                onChange={v => updateField('keyVocabulary', v)}
              />
            )}

            <Section title="Introduction" editing={status === 'editing'}
              value={notes.introduction} onChange={v => updateField('introduction', v)} />

            <Section title="Main Content" editing={status === 'editing'}
              value={notes.mainContent} onChange={v => updateField('mainContent', v)} />

            <Section title="Worked Examples" editing={status === 'editing'}
              listValue={notes.workedExamples} onListChange={v => updateField('workedExamples', v)} />

            <Section title="Class Activities" editing={status === 'editing'}
              listValue={notes.classActivities} onListChange={v => updateField('classActivities', v)} />

            {(notes.revisionSummary?.length || status === 'editing') && (
              <Section title="Revision Summary (for learners)" editing={status === 'editing'}
                listValue={notes.revisionSummary || []}
                onListChange={v => updateField('revisionSummary', v)} />
            )}

            <QASection
              editing={status === 'editing'}
              value={notes.assessmentQuestions}
              onChange={v => updateField('assessmentQuestions', v)}
            />

            {(notes.homeRevisionTasks?.length || status === 'editing') && (
              <Section title="Home Revision Tasks" editing={status === 'editing'}
                listValue={notes.homeRevisionTasks || []}
                onListChange={v => updateField('homeRevisionTasks', v)} />
            )}

            <Section title="Teacher Notes / Tips" editing={status === 'editing'}
              listValue={notes.teacherTips} onListChange={v => updateField('teacherTips', v)} />

            {(notes.competenciesDeveloped?.length || status === 'editing') && (
              <Section title="Competencies Developed" editing={status === 'editing'}
                listValue={notes.competenciesDeveloped || []}
                onListChange={v => updateField('competenciesDeveloped', v)} />
            )}

            {(notes.resources?.length || status === 'editing') && (
              <Section title="Resources" editing={status === 'editing'}
                listValue={notes.resources || []}
                onListChange={v => updateField('resources', v)} />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Section({ title, value, onChange, listValue, onListChange, editing, isText }: {
  title: string;
  value?: string;
  onChange?: (v: string) => void;
  listValue?: string[];
  onListChange?: (v: string[]) => void;
  editing: boolean;
  isText?: boolean;
}) {
  if (listValue && onListChange) {
    return (
      <div>
        <h3 className="font-semibold text-sm mb-2">{title}</h3>
        {editing ? (
          <Textarea
            value={listValue.join('\n')}
            onChange={e => onListChange(e.target.value.split('\n').filter(Boolean))}
            className="min-h-[100px] text-sm"
            placeholder="One item per line"
          />
        ) : (
          <ol className="list-decimal pl-5 text-sm space-y-1 text-muted-foreground">
            {listValue.map((item, i) => <li key={i}>{item}</li>)}
          </ol>
        )}
      </div>
    );
  }
  return (
    <div>
      <h3 className="font-semibold text-sm mb-2">{title}</h3>
      {editing ? (
        isText ? (
          <Input value={value || ''} onChange={e => onChange?.(e.target.value)} />
        ) : (
          <Textarea value={value || ''} onChange={e => onChange?.(e.target.value)} className="min-h-[100px] text-sm" />
        )
      ) : (
        <p className={isText ? "text-base font-medium" : "text-sm text-muted-foreground whitespace-pre-line"}>
          {value}
        </p>
      )}
    </div>
  );
}

function VocabSection({ editing, value, onChange }: {
  editing: boolean;
  value: KeyVocab[];
  onChange: (v: KeyVocab[]) => void;
}) {
  const text = value.map(v => `${v.term} :: ${v.meaning}`).join('\n');
  return (
    <div>
      <h3 className="font-semibold text-sm mb-2">Key Vocabulary</h3>
      {editing ? (
        <Textarea
          value={text}
          onChange={e => {
            const parsed = e.target.value.split('\n').map(line => {
              const [t, ...rest] = line.split('::');
              return { term: (t || '').trim(), meaning: rest.join('::').trim() };
            }).filter(x => x.term);
            onChange(parsed);
          }}
          className="min-h-[100px] text-sm"
          placeholder="One per line — format: term :: meaning"
        />
      ) : (
        <ul className="text-sm space-y-1 text-muted-foreground">
          {value.map((v, i) => (
            <li key={i}><span className="font-medium text-foreground">{v.term}</span> — {v.meaning}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function QASection({ editing, value, onChange }: {
  editing: boolean;
  value: (string | QA)[];
  onChange: (v: QA[]) => void;
}) {
  const normalized: QA[] = value.map(v => typeof v === 'string' ? { question: v, answer: '' } : v);
  const text = normalized.map(v => `${v.question} || ${v.answer}`).join('\n');
  return (
    <div>
      <h3 className="font-semibold text-sm mb-2">Assessment Questions</h3>
      {editing ? (
        <Textarea
          value={text}
          onChange={e => {
            const parsed = e.target.value.split('\n').map(line => {
              const [q, ...rest] = line.split('||');
              return { question: (q || '').trim(), answer: rest.join('||').trim() };
            }).filter(x => x.question);
            onChange(parsed);
          }}
          className="min-h-[140px] text-sm"
          placeholder="One per line — format: question || answer"
        />
      ) : (
        <ol className="list-decimal pl-5 text-sm space-y-2 text-muted-foreground">
          {normalized.map((qa, i) => (
            <li key={i}>
              <p className="font-medium text-foreground">{qa.question}</p>
              {qa.answer && <p className="text-xs mt-0.5">Ans: {qa.answer}</p>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
