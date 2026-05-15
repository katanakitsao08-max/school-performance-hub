import { useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolGrades } from '@/hooks/use-school-grades';
import { Save } from 'lucide-react';
import { getCbcBand, getOfficialLessonsPerWeek, type CbcBand } from '@/data/cbc-subjects';

type BandKey = 'lower-primary' | 'upper-primary' | 'junior-secondary' | 'pre-primary';

const BAND_OPTIONS: { value: BandKey; label: string; total: string }[] = [
  { value: 'pre-primary', label: 'Pre-Primary (PP1–PP2)', total: '' },
  { value: 'lower-primary', label: 'Lower Primary (Grade 1–3)', total: 'Total: 31 + 1 PIP' },
  { value: 'upper-primary', label: 'Upper Primary (Grade 4–6)', total: 'Total: 35 + 1 PIP' },
  { value: 'junior-secondary', label: 'Junior School (Grade 7–9)', total: 'Total: 40 + 1 PIP' },
];

// canonical key for grouping subjects across grades in the same band
const canonKey = (s: string) =>
  (s || '')
    .toUpperCase()
    .replace(/\bACTIVITIES\b/g, '')
    .replace(/\bAND\b/g, '&')
    .replace(/[^A-Z&]+/g, ' ')
    .trim();

export default function LessonAllocationsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { schoolId } = useAuth();
  const allGrades = useSchoolGrades();
  const [band, setBand] = useState<BandKey>('junior-secondary');
  const [edits, setEdits] = useState<Record<string, number>>({});

  const gradesInBand = useMemo(
    () => allGrades.filter(g => getCbcBand(g) === (band as CbcBand)),
    [allGrades, band],
  );

  const { data: areas = [] } = useQuery({
    queryKey: ['la-band', schoolId, gradesInBand.join(',')],
    queryFn: async () => {
      if (!gradesInBand.length) return [];
      const { data, error } = await supabase
        .from('learning_areas')
        .select('id, name, grade')
        .eq('school_id', schoolId!)
        .in('grade', gradesInBand)
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!schoolId && gradesInBand.length > 0,
  });

  const { data: existing = [] } = useQuery({
    queryKey: ['gsl-band', schoolId, gradesInBand.join(',')],
    queryFn: async () => {
      if (!gradesInBand.length) return [];
      const { data, error } = await supabase
        .from('grade_subject_lessons')
        .select('*')
        .eq('school_id', schoolId!)
        .in('grade', gradesInBand);
      if (error) throw error;
      return data || [];
    },
    enabled: !!schoolId && gradesInBand.length > 0,
  });

  // Group learning areas by canonical name
  const groups = useMemo(() => {
    const map = new Map<string, { key: string; displayName: string; areaIds: string[] }>();
    areas.forEach((a: any) => {
      const k = canonKey(a.name);
      if (!k) return;
      if (!map.has(k)) map.set(k, { key: k, displayName: a.name, areaIds: [] });
      map.get(k)!.areaIds.push(a.id);
    });
    return Array.from(map.values()).sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [areas]);

  const savedLookup = useMemo(() => {
    const m: Record<string, number> = {};
    existing.forEach((r: any) => { m[r.learning_area_id] = r.lessons_per_week; });
    return m;
  }, [existing]);

  // Default value for a group: configured value (most common across its areas) or KICD official, else 5
  const defaultFor = (g: { displayName: string; areaIds: string[] }) => {
    const configured = g.areaIds.map(id => savedLookup[id]).filter(v => v != null) as number[];
    if (configured.length) return configured[0];
    const sampleGrade = gradesInBand[0];
    const official = sampleGrade ? getOfficialLessonsPerWeek(sampleGrade, g.displayName) : null;
    return official ?? 5;
  };

  const valueFor = (g: { key: string; displayName: string; areaIds: string[] }) =>
    edits[g.key] ?? defaultFor(g);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const rows: any[] = [];
      for (const g of groups) {
        const v = Math.max(0, Math.min(40, Number(valueFor(g)) || 0));

        // Map: grade -> learning_area_id present for this group
        const gradesCovered = new Map<string, string>();
        g.areaIds.forEach(id => {
          const a = areas.find((x: any) => x.id === id);
          if (a) gradesCovered.set(a.grade, a.id);
        });

        // For every grade in the band, ensure a learning_area exists, then queue upsert
        for (const grade of gradesInBand) {
          let laId = gradesCovered.get(grade);
          if (!laId) {
            // Create learning area for this grade using the group's display name
            const { data: created, error: cErr } = await supabase
              .from('learning_areas')
              .insert({ school_id: schoolId, grade, name: g.displayName, is_active: true })
              .select('id')
              .single();
            if (cErr) throw cErr;
            laId = created!.id;
          }
          rows.push({
            school_id: schoolId,
            grade,
            learning_area_id: laId,
            lessons_per_week: v,
          });
        }
      }
      if (!rows.length) return;
      const { error } = await supabase
        .from('grade_subject_lessons')
        .upsert(rows, { onConflict: 'school_id,grade,learning_area_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Saved', description: `Allocations applied to ${gradesInBand.length} grade(s) in this band.` });
      setEdits({});
      qc.invalidateQueries({ queryKey: ['gsl-band', schoolId, gradesInBand.join(',')] });
    },
    onError: (e: any) => toast({ title: 'Save failed', description: e.message, variant: 'destructive' }),
  });

  const currentBand = BAND_OPTIONS.find(b => b.value === band);

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Weekly Lesson Allocations</h1>
          <p className="text-sm text-muted-foreground">
            Configure lessons per week per subject by school band. Values apply to all grades in the selected band.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Select Band</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <Label className="text-xs">Band</Label>
                <Select value={band} onValueChange={(v) => { setBand(v as BandKey); setEdits({}); }}>
                  <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BAND_OPTIONS.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !groups.length}>
                <Save className="h-4 w-4 mr-2" />
                {saveMutation.isPending ? 'Saving...' : 'Save All'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Grades in this band: {gradesInBand.length ? gradesInBand.map(g => `Grade ${g}`).join(', ') : 'None'}
              {currentBand?.total ? ` • ${currentBand.total}` : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            {groups.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active learning areas for this band. Add subjects in Learning Areas first.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead className="w-48">Lessons / Week</TableHead>
                    <TableHead className="w-40">KICD Default</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.map(g => {
                    const sampleGrade = gradesInBand[0];
                    const official = sampleGrade ? getOfficialLessonsPerWeek(sampleGrade, g.displayName) : null;
                    return (
                      <TableRow key={g.key}>
                        <TableCell className="font-medium">{g.displayName}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            max={40}
                            value={valueFor(g)}
                            onChange={(e) => setEdits(prev => ({ ...prev, [g.key]: Number(e.target.value) }))}
                            className="w-24"
                          />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {official != null ? `${official} lessons` : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
