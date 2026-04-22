import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Pencil, Eye, Check, X, Loader2, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import jsPDF from 'jspdf';

const GRADES = ['PP1', 'PP2', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9'];
const DIFFICULTIES = [
  { value: 'basic', label: 'Basic' },
  { value: 'standard', label: 'Standard' },
  { value: 'advanced', label: 'Advanced' },
] as const;

interface LessonNotes {
  title: string;
  objectives: string[];
  introduction: string;
  mainContent: string;
  workedExamples: string[];
  classActivities: string[];
  assessmentQuestions: string[];
  teacherTips: string[];
}

type Status = 'idle' | 'generating' | 'preview' | 'editing' | 'approved';

export function NotesGenerator({ schoolName }: { schoolName?: string }) {
  const [grade, setGrade] = useState('');
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<'basic' | 'standard' | 'advanced'>('standard');
  const [notes, setNotes] = useState<LessonNotes | null>(null);
  const [status, setStatus] = useState<Status>('idle');

  const generate = async () => {
    if (!grade || !subject.trim() || !topic.trim()) {
      toast.error('Please fill Grade, Subject and Topic');
      return;
    }
    setStatus('generating');
    try {
      const { data, error } = await supabase.functions.invoke('generate-lesson-notes', {
        body: { grade, subject: subject.trim(), topic: topic.trim(), difficulty },
      });
      if (error) throw error;
      if (!data?.notes) throw new Error('No notes returned');
      setNotes(data.notes);
      setStatus('preview');
      toast.success('Lesson notes generated');
    } catch (e: any) {
      setStatus('idle');
      toast.error(e?.message || 'Failed to generate notes');
    }
  };

  const discard = () => {
    setNotes(null);
    setStatus('idle');
  };

  const approve = () => {
    setStatus('approved');
    toast.success('Notes approved & ready to use');
  };

  const downloadPdf = () => {
    if (!notes) return;
    const doc = new jsPDF();
    const margin = 15;
    let y = margin;
    const pageW = doc.internal.pageSize.getWidth();
    const maxW = pageW - margin * 2;

    const writeHeader = () => {
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(schoolName || 'PerformTrack', margin, 8);
      doc.setTextColor(0);
    };
    const ensureSpace = (h: number) => {
      if (y + h > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage();
        y = margin;
        writeHeader();
      }
    };
    const writeTitle = (t: string, size = 14) => {
      ensureSpace(size + 4);
      doc.setFontSize(size);
      doc.setFont('helvetica', 'bold');
      doc.text(t, margin, y);
      y += size * 0.45 + 3;
      doc.setFont('helvetica', 'normal');
    };
    const writeText = (txt: string, size = 11) => {
      doc.setFontSize(size);
      const lines = doc.splitTextToSize(txt, maxW);
      lines.forEach((ln: string) => {
        ensureSpace(size * 0.5 + 1);
        doc.text(ln, margin, y);
        y += size * 0.5 + 1;
      });
      y += 2;
    };
    const writeList = (items: string[]) => {
      doc.setFontSize(11);
      items.forEach((it, i) => {
        const lines = doc.splitTextToSize(`${i + 1}. ${it}`, maxW - 4);
        lines.forEach((ln: string) => {
          ensureSpace(6);
          doc.text(ln, margin + 2, y);
          y += 5.5;
        });
      });
      y += 2;
    };

    writeHeader();
    writeTitle(notes.title, 16);
    writeText(`${grade} • ${subject} • ${difficulty.toUpperCase()}`);
    writeTitle('Learning Objectives'); writeList(notes.objectives);
    writeTitle('Introduction'); writeText(notes.introduction);
    writeTitle('Main Content'); writeText(notes.mainContent);
    writeTitle('Worked Examples'); writeList(notes.workedExamples);
    writeTitle('Class Activities'); writeList(notes.classActivities);
    writeTitle('Assessment Questions'); writeList(notes.assessmentQuestions);
    writeTitle('Teacher Tips'); writeList(notes.teacherTips);

    doc.save(`${notes.title.replace(/[^a-z0-9]+/gi, '_')}.pdf`);
  };

  const updateField = <K extends keyof LessonNotes>(key: K, value: LessonNotes[K]) => {
    setNotes(prev => prev ? { ...prev, [key]: value } : prev);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          AI Lesson Notes Generator
          <Badge variant="secondary" className="text-[10px]">CBC-aligned</Badge>
        </CardTitle>
        <CardDescription>
          Generate structured lesson notes on demand. Always editable. Teacher approval required before use.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Inputs */}
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <Label>Class</Label>
            <Select value={grade} onValueChange={setGrade}>
              <SelectTrigger><SelectValue placeholder="Grade" /></SelectTrigger>
              <SelectContent>
                {GRADES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Subject</Label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Mathematics" />
          </div>
          <div>
            <Label>Topic</Label>
            <Input value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Fractions" />
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
            {status === 'approved' && (
              <Badge className="bg-primary"><Check className="h-3 w-3 mr-1" /> Approved</Badge>
            )}
            <Section
              title="Topic Title" editing={status === 'editing'}
              value={notes.title}
              onChange={v => updateField('title', v)}
              isText
            />
            <Section
              title="Learning Objectives" editing={status === 'editing'}
              listValue={notes.objectives}
              onListChange={v => updateField('objectives', v)}
            />
            <Section
              title="Introduction" editing={status === 'editing'}
              value={notes.introduction}
              onChange={v => updateField('introduction', v)}
            />
            <Section
              title="Main Content" editing={status === 'editing'}
              value={notes.mainContent}
              onChange={v => updateField('mainContent', v)}
            />
            <Section
              title="Worked Examples" editing={status === 'editing'}
              listValue={notes.workedExamples}
              onListChange={v => updateField('workedExamples', v)}
            />
            <Section
              title="Class Activities" editing={status === 'editing'}
              listValue={notes.classActivities}
              onListChange={v => updateField('classActivities', v)}
            />
            <Section
              title="Assessment Questions" editing={status === 'editing'}
              listValue={notes.assessmentQuestions}
              onListChange={v => updateField('assessmentQuestions', v)}
            />
            <Section
              title="Teacher Notes / Tips" editing={status === 'editing'}
              listValue={notes.teacherTips}
              onListChange={v => updateField('teacherTips', v)}
            />
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
