import { useState, useRef, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileSpreadsheet, Download, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';

interface Subject { id: string; name: string; max_score: number }
interface Learner { id: string; full_name: string; admission_number: string }

interface ParsedRow {
  admission_number: string;
  full_name: string;
  raw_score: number | null;
  matched_learner_id?: string;
  status: 'ok' | 'no-learner' | 'invalid' | 'empty';
  error?: string;
}

export default function BulkScoresUploadDialog({
  schoolId,
  grade,
  stream,
  term,
  year,
  assessment,
  subjects,
  learners,
}: {
  schoolId: string;
  grade: string;
  stream: string;
  term: number;
  year: number;
  assessment: string;
  subjects: Subject[];
  learners: Learner[];
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [subjectId, setSubjectId] = useState(subjects[0]?.id || '');
  const [maxScore, setMaxScore] = useState<string>('100');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [uploading, setUploading] = useState(false);

  const subject = useMemo(() => subjects.find(s => s.id === subjectId), [subjects, subjectId]);

  const downloadTemplate = () => {
    if (!subject) return toast({ title: 'Select a subject first', variant: 'destructive' });
    const max = Number(maxScore) || subject.max_score || 100;
    const headerNote = `Template for ${subject.name} — Term ${term} ${year} (${assessment.replace('_', ' ')})`;
    const aoa: any[][] = [
      [headerNote],
      [`Enter raw scores out of ${max}. The system will convert to /100 automatically on upload.`],
      [],
      ['Admission No', 'Full Name', `Score (out of ${max})`],
      ...learners.map(l => [l.admission_number, l.full_name, '']),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 16 }, { wch: 32 }, { wch: 22 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, subject.name.slice(0, 28));
    const safe = subject.name.replace(/[^a-z0-9]+/gi, '_');
    XLSX.writeFile(wb, `Marks_Template_${safe}_Gr${grade}_${stream}_T${term}_${year}.xlsx`);
  };

  const handleFile = async (file: File) => {
    if (!subject) return toast({ title: 'Pick a subject before uploading', variant: 'destructive' });
    setFileName(file.name);
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const aoa = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });

    // Find header row: contains 'admission' & 'score' (case-insensitive)
    let headerIdx = -1;
    for (let i = 0; i < aoa.length; i++) {
      const r = (aoa[i] || []).map(c => String(c).toLowerCase());
      if (r.some(c => c.includes('admission')) && r.some(c => c.includes('score'))) {
        headerIdx = i; break;
      }
    }
    if (headerIdx === -1) return toast({ title: 'Invalid template', description: 'Could not find headers. Use the downloaded template.', variant: 'destructive' });

    const header = (aoa[headerIdx] || []).map(c => String(c).toLowerCase());
    const admCol = header.findIndex(c => c.includes('admission'));
    const nameCol = header.findIndex(c => c.includes('name'));
    const scoreCol = header.findIndex(c => c.includes('score'));
    const learnerByAdm = new Map(learners.map(l => [l.admission_number.trim().toLowerCase(), l]));

    const parsed: ParsedRow[] = [];
    for (let i = headerIdx + 1; i < aoa.length; i++) {
      const r = aoa[i] || [];
      const adm = String(r[admCol] ?? '').trim();
      const fname = String(r[nameCol] ?? '').trim();
      const rawScoreStr = String(r[scoreCol] ?? '').trim();
      if (!adm && !rawScoreStr) continue;
      const matched = learnerByAdm.get(adm.toLowerCase());
      if (!matched) {
        parsed.push({ admission_number: adm, full_name: fname, raw_score: null, status: 'no-learner', error: 'Not in this class' });
        continue;
      }
      if (rawScoreStr === '') {
        parsed.push({ admission_number: adm, full_name: matched.full_name, raw_score: null, matched_learner_id: matched.id, status: 'empty' });
        continue;
      }
      const num = Number(rawScoreStr);
      if (isNaN(num) || num < 0) {
        parsed.push({ admission_number: adm, full_name: matched.full_name, raw_score: null, matched_learner_id: matched.id, status: 'invalid', error: `Invalid: ${rawScoreStr}` });
        continue;
      }
      parsed.push({ admission_number: adm, full_name: matched.full_name, raw_score: num, matched_learner_id: matched.id, status: 'ok' });
    }
    setRows(parsed);
  };

  const upload = async () => {
    if (!subject) return;
    const max = Number(maxScore);
    if (!max || max <= 0) return toast({ title: 'Set a valid max score', variant: 'destructive' });
    const targetMax = subject.max_score || 100;

    const valid = rows.filter(r => r.status === 'ok' && r.matched_learner_id && r.raw_score !== null);
    if (valid.length === 0) return toast({ title: 'Nothing to upload', variant: 'destructive' });

    setUploading(true);
    try {
      const upserts = valid.map(r => {
        // Convert to /100, then scale into the subject's actual max_score (usually 100).
        const pct = (r.raw_score! / max) * 100;
        const finalScore = Math.round(((pct / 100) * targetMax) * 10) / 10;
        return {
          learner_id: r.matched_learner_id!,
          learning_area_id: subject.id,
          term, year, school_id: schoolId,
          assessment_type: assessment,
          score: Math.min(finalScore, targetMax),
        };
      });
      const { error } = await supabase.from('scores').upsert(upserts, {
        onConflict: 'learner_id,learning_area_id,term,year,assessment_type',
      });
      if (error) throw error;
      toast({ title: `Uploaded ${valid.length} scores`, description: `Converted from /${max} to /${targetMax}` });
      qc.invalidateQueries({ queryKey: ['scores'] });
      setOpen(false);
      setRows([]);
      setFileName('');
    } catch (e: any) {
      toast({ title: 'Upload failed', description: e.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const okCount = rows.filter(r => r.status === 'ok').length;
  const issueCount = rows.length - okCount;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5" disabled={subjects.length === 0 || learners.length === 0}>
          <FileSpreadsheet className="h-4 w-4" /> Bulk Upload
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Upload Scores</DialogTitle>
          <DialogDescription>
            Download the template for one of your subjects, fill in raw scores using your preferred max
            (e.g. /40, /50, /80), then upload — the system converts to /100 automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <Label className="text-xs">Subject</Label>
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger><SelectValue placeholder="Pick subject" /></SelectTrigger>
              <SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Max Score (your scale)</Label>
            <Input type="number" min={1} value={maxScore} onChange={e => setMaxScore(e.target.value)} placeholder="e.g. 40, 80, 100" />
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={downloadTemplate} className="w-full gap-1.5">
              <Download className="h-4 w-4" /> Download Template
            </Button>
          </div>
        </div>

        <div className="border-2 border-dashed rounded-lg p-4 text-center space-y-2">
          <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{fileName || 'Upload the filled-in .xlsx template'}</p>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Choose File</Button>
        </div>

        {rows.length > 0 && (
          <>
            <div className="flex gap-2 items-center text-xs">
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300" variant="outline">
                <CheckCircle2 className="h-3 w-3 mr-1" /> {okCount} ready
              </Badge>
              {issueCount > 0 && (
                <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                  <AlertCircle className="h-3 w-3 mr-1" /> {issueCount} issues
                </Badge>
              )}
              <span className="text-muted-foreground ml-auto">
                Converting from /{maxScore} → /{subject?.max_score || 100}
              </span>
            </div>
            <ScrollArea className="h-[280px] border rounded">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Adm No</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Raw /{maxScore}</TableHead>
                    <TableHead className="text-right">→ /{subject?.max_score || 100}</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => {
                    const max = Number(maxScore) || 100;
                    const tgt = subject?.max_score || 100;
                    const conv = r.raw_score !== null ? Math.round((r.raw_score / max) * tgt * 10) / 10 : '-';
                    return (
                      <TableRow key={i}>
                        <TableCell className="text-xs">{r.admission_number}</TableCell>
                        <TableCell className="text-xs">{r.full_name}</TableCell>
                        <TableCell className="text-right text-xs">{r.raw_score ?? '-'}</TableCell>
                        <TableCell className="text-right text-xs font-medium">{conv}</TableCell>
                        <TableCell className="text-xs">
                          {r.status === 'ok' && <Badge variant="outline" className="text-[10px] bg-emerald-50 border-emerald-300">OK</Badge>}
                          {r.status !== 'ok' && <span className="text-amber-700">{r.error || r.status}</span>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setRows([]); setFileName(''); }}>Clear</Button>
              <Button onClick={upload} disabled={uploading || okCount === 0}>
                {uploading ? 'Uploading…' : `Upload ${okCount} Score${okCount === 1 ? '' : 's'}`}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
