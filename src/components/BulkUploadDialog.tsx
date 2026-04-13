import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import * as XLSX from 'xlsx';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ParsedRow {
  full_name: string;
  gender?: string;
  parent_name?: string;
  parent_phone?: string;
  marks: Record<string, number>;
}

export default function BulkUploadDialog({
  availableGrades,
  availableStreams,
}: {
  availableGrades: string[];
  availableStreams: string[];
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { schoolId } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [grade, setGrade] = useState(availableGrades[0] || '1');
  const [stream, setStream] = useState(availableStreams[0] || 'A');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [subjectColumns, setSubjectColumns] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState('');

  const { data: school } = useQuery({
    queryKey: ['school-info', schoolId],
    queryFn: async () => {
      if (!schoolId) return null;
      const { data } = await supabase.from('schools').select('school_name').eq('id', schoolId).maybeSingle();
      return data;
    },
    enabled: !!schoolId,
  });

  const { data: existingLearners = [] } = useQuery({
    queryKey: ['learners-count', schoolId],
    queryFn: async () => {
      if (!schoolId) return [];
      const { data } = await supabase.from('learners').select('admission_number').eq('school_id', schoolId);
      return data || [];
    },
    enabled: !!schoolId,
  });

  const generateAdmissionPrefix = () => {
    if (!school?.school_name) return 'STD';
    const words = school.school_name.trim().split(/\s+/);
    if (words.length === 1) return words[0].substring(0, 3).toUpperCase();
    return words.map(w => w[0]).join('').toUpperCase().substring(0, 4);
  };

  const getNextAdmNumber = (index: number) => {
    const prefix = generateAdmissionPrefix();
    const existingNums = existingLearners
      .map(l => {
        const match = l.admission_number.match(new RegExp(`^${prefix}-(\\d+)$`));
        return match ? parseInt(match[1]) : 0;
      })
      .filter(n => n > 0);
    const maxNum = existingNums.length > 0 ? Math.max(...existingNums) : 0;
    const nextNum = maxNum + 1 + index;
    return `${prefix}-${String(nextNum).padStart(4, '0')}`;
  };

  const knownNonSubjectCols = new Set([
    'no', '#', 'sn', 's/n', 'number', 'name', 'full_name', 'full name', 'student', 'student name',
    'learner', 'learner name', 'pupil', 'pupil name',
    'parent', 'parent name', 'parent_name', 'guardian', 'guardian name',
    'phone', 'parent phone', 'parent_phone', 'guardian phone', 'tel', 'telephone',
    'admission', 'adm', 'adm no', 'admission number', 'admission_number', 'adm_no',
    'grade', 'class', 'stream', 'total', 'mean', 'average', 'rank', 'position',
    'gender', 'sex',
  ]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (json.length === 0) {
          toast({ title: 'Empty file', variant: 'destructive' });
          return;
        }

        const headers = Object.keys(json[0]);
        const nameCol = headers.find(h =>
          ['full_name', 'full name', 'name', 'student name', 'student', 'learner name', 'learner', 'pupil name', 'pupil']
            .includes(h.toLowerCase().trim())
        );
        if (!nameCol) {
          toast({ title: 'Error', description: 'No "Name" or "Full Name" column found in the file.', variant: 'destructive' });
          return;
        }

        const parentCol = headers.find(h =>
          ['parent', 'parent name', 'parent_name', 'guardian', 'guardian name'].includes(h.toLowerCase().trim())
        );
        const phoneCol = headers.find(h =>
          ['phone', 'parent phone', 'parent_phone', 'guardian phone', 'tel', 'telephone'].includes(h.toLowerCase().trim())
        );
        const genderCol = headers.find(h =>
          ['gender', 'sex'].includes(h.toLowerCase().trim())
        );

        const subjects = headers.filter(h => !knownNonSubjectCols.has(h.toLowerCase().trim()));
        const subjectCols = subjects.filter(h => h !== nameCol && h !== parentCol && h !== phoneCol && h !== genderCol);
        setSubjectColumns(subjectCols);

        const parsed: ParsedRow[] = json
          .filter(row => row[nameCol]?.toString().trim())
          .map(row => {
            const marks: Record<string, number> = {};
            subjectCols.forEach(col => {
              const val = Number(row[col]);
              if (!isNaN(val) && val >= 0) marks[col] = val;
            });
            return {
              full_name: row[nameCol]?.toString().trim(),
              gender: genderCol ? (row[genderCol]?.toString().trim() || 'Male') : 'Male',
              parent_name: parentCol ? row[parentCol]?.toString().trim() : undefined,
              parent_phone: phoneCol ? row[phoneCol]?.toString().trim() : undefined,
              marks,
            };
          });

        setRows(parsed);
        toast({ title: `Parsed ${parsed.length} students with ${subjectCols.length} subjects` });
      } catch (err: any) {
        toast({ title: 'Parse error', description: err.message, variant: 'destructive' });
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleUpload = async () => {
    if (rows.length === 0 || !schoolId) return;
    setUploading(true);

    try {
      // 1. Insert learners
      const learnersToInsert = rows.map((r, i) => ({
        admission_number: getNextAdmNumber(i),
        full_name: r.full_name,
        grade,
        stream,
        gender: r.gender || 'Male',
        parent_name: r.parent_name || null,
        parent_phone: r.parent_phone || null,
        school_id: schoolId,
        academic_year: new Date().getFullYear(),
      }));

      const { data: inserted, error: lErr } = await supabase
        .from('learners')
        .insert(learnersToInsert)
        .select('id, full_name');
      if (lErr) throw lErr;

      // 2. Match subjects to learning_areas
      if (subjectColumns.length > 0 && inserted) {
        const { data: learningAreas } = await supabase
          .from('learning_areas')
          .select('id, name')
          .eq('grade', grade)
          .eq('school_id', schoolId)
          .eq('is_active', true);

        if (learningAreas && learningAreas.length > 0) {
          const subjectMap = new Map<string, string>();
          subjectColumns.forEach(col => {
            const match = learningAreas.find(la =>
              la.name.toLowerCase() === col.toLowerCase() ||
              la.name.toLowerCase().includes(col.toLowerCase()) ||
              col.toLowerCase().includes(la.name.toLowerCase())
            );
            if (match) subjectMap.set(col, match.id);
          });

          const scores: any[] = [];
          inserted.forEach(learner => {
            const row = rows.find(r => r.full_name === learner.full_name);
            if (!row) return;
            Object.entries(row.marks).forEach(([col, score]) => {
              const laId = subjectMap.get(col);
              if (laId) {
                scores.push({
                  learner_id: learner.id,
                  learning_area_id: laId,
                  score,
                  term: 1,
                  year: new Date().getFullYear(),
                  school_id: schoolId,
                  assessment_type: 'end_term',
                });
              }
            });
          });

          if (scores.length > 0) {
            const { error: sErr } = await supabase.from('scores').upsert(scores, {
              onConflict: 'learner_id,learning_area_id,term,year,assessment_type',
            });
            if (sErr) throw sErr;
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ['learners'] });
      queryClient.invalidateQueries({ queryKey: ['scores'] });
      queryClient.invalidateQueries({ queryKey: ['learners-count'] });
      toast({ title: `✅ ${inserted?.length || 0} learners uploaded successfully!` });
      setOpen(false);
      setRows([]);
      setSubjectColumns([]);
      setFileName('');
    } catch (err: any) {
      toast({ title: 'Upload error', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Full Name', 'Parent Name', 'Parent Phone', 'Mathematics', 'English', 'Kiswahili', 'Science', 'Social Studies'],
      ['John Doe', 'Jane Doe', '+254700000000', 85, 72, 68, 90, 78],
      ['Mary Smith', 'Bob Smith', '+254711111111', 92, 88, 75, 95, 82],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    XLSX.writeFile(wb, `scoresheet_template_grade_${grade}.xlsx`);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setRows([]); setSubjectColumns([]); setFileName(''); } }}>
      <DialogTrigger asChild>
        <Button variant="outline"><Upload className="mr-2 h-4 w-4" /> Bulk Upload</Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" /> Bulk Upload Students & Marks
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Config row */}
          <div className="flex gap-4 flex-wrap items-end">
            <div className="space-y-1">
              <Label className="text-xs">Grade</Label>
              <Select value={grade} onValueChange={setGrade}>
                <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                <SelectContent>{availableGrades.map(g => <SelectItem key={g} value={g}>Grade {g}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Stream</Label>
              <Select value={stream} onValueChange={setStream}>
                <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                <SelectContent>{availableStreams.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button variant="ghost" size="sm" onClick={downloadTemplate}>
              <FileSpreadsheet className="mr-1 h-4 w-4" /> Download Template
            </Button>
          </div>

          {/* Admission prefix info */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            Admission numbers will be auto-generated as <Badge variant="secondary">{generateAdmissionPrefix()}-XXXX</Badge>
          </div>

          {/* File input */}
          <div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
            <Button variant="outline" className="w-full border-dashed h-16" onClick={() => fileRef.current?.click()}>
              <Upload className="mr-2 h-5 w-5" />
              {fileName || 'Click to select Excel or CSV file'}
            </Button>
          </div>

          {/* Preview */}
          {rows.length > 0 && (
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">{rows.length} students • {subjectColumns.length} subjects detected</p>
                {subjectColumns.length === 0 && (
                  <span className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> No subject columns detected
                  </span>
                )}
              </div>
              <ScrollArea className="flex-1 border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="min-w-[50px]">#</TableHead>
                      <TableHead className="min-w-[100px]">Adm No</TableHead>
                      <TableHead className="min-w-[150px]">Name</TableHead>
                      {subjectColumns.map(s => <TableHead key={s} className="text-center min-w-[70px]">{s}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 50).map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell><Badge variant="outline" className="font-mono text-xs">{getNextAdmNumber(i)}</Badge></TableCell>
                        <TableCell className="font-medium">{r.full_name}</TableCell>
                        {subjectColumns.map(s => (
                          <TableCell key={s} className="text-center">{r.marks[s] ?? '-'}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
              {rows.length > 50 && <p className="text-xs text-muted-foreground mt-1">Showing first 50 of {rows.length}</p>}
            </div>
          )}

          {/* Upload button */}
          {rows.length > 0 && (
            <Button onClick={handleUpload} disabled={uploading} className="w-full">
              {uploading ? 'Uploading...' : `Upload ${rows.length} Students`}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
