import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, BookOpen, Lightbulb, Loader2, GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface Props {
  child: { id: string; full_name: string; grade: string; stream: string; gender: string };
}

const bandColor = (avg: number | null) => {
  if (avg == null) return 'bg-muted text-muted-foreground border-muted';
  if (avg >= 75) return 'bg-success/10 text-success border-success/20';
  if (avg >= 50) return 'bg-info/10 text-info border-info/20';
  if (avg >= 30) return 'bg-warning/10 text-warning border-warning/20';
  return 'bg-destructive/10 text-destructive border-destructive/20';
};

const bandLabel = (avg: number | null) => {
  if (avg == null) return 'No marks yet';
  if (avg >= 75) return 'Exceeding';
  if (avg >= 50) return 'Meeting';
  if (avg >= 30) return 'Approaching';
  return 'Below';
};

// Tiny markdown renderer (headings + bullets + bold)
function MD({ text }: { text: string }) {
  const html = useMemo(() => {
    const esc = (s: string) => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
    const lines = esc(text).split('\n');
    let out = '', inList = false;
    const flush = () => { if (inList) { out += '</ul>'; inList = false; } };
    for (const raw of lines) {
      const ln = raw.trimEnd();
      if (/^##\s+/.test(ln)) { flush(); out += `<h3 class="font-display font-bold text-base mt-4 mb-1 text-primary">${ln.replace(/^##\s+/, '')}</h3>`; }
      else if (/^#\s+/.test(ln)) { flush(); out += `<h2 class="font-display font-bold text-lg mt-4 mb-1">${ln.replace(/^#\s+/, '')}</h2>`; }
      else if (/^\s*[-*]\s+/.test(ln)) { if (!inList) { out += '<ul class="list-disc pl-5 space-y-1 text-sm">'; inList = true; } out += `<li>${ln.replace(/^\s*[-*]\s+/, '')}</li>`; }
      else if (/^\s*\d+\.\s+/.test(ln)) { flush(); out += `<p class="text-sm my-1"><strong>${ln.match(/^\s*\d+\./)?.[0]}</strong> ${ln.replace(/^\s*\d+\.\s+/, '')}</p>`; }
      else if (ln.trim() === '') { flush(); out += '<div class="h-2"></div>'; }
      else { flush(); out += `<p class="text-sm leading-relaxed my-1">${ln.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')}</p>`; }
    }
    flush();
    return out;
  }, [text]);
  return <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function ParentLearningPathTab({ child }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [activeSubject, setActiveSubject] = useState<{ id: string; name: string; avg: number | null } | null>(null);
  const [mode, setMode] = useState<'interventions' | 'tutor'>('interventions');
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const { data: areas = [] } = useQuery({
    queryKey: ['parent-lp-areas', child.grade, child.id],
    queryFn: async () => {
      // Use any learning_areas the child has scores for OR areas defined for the grade
      const { data: la } = await supabase
        .from('learning_areas')
        .select('id, name, grade')
        .eq('grade', child.grade)
        .eq('is_active', true);
      return la || [];
    },
  });

  const { data: scores = [] } = useQuery({
    queryKey: ['parent-lp-scores', child.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('scores')
        .select('learning_area_id, score')
        .eq('learner_id', child.id);
      return data || [];
    },
  });

  const subjectStats = useMemo(() => {
    const map = new Map<string, number[]>();
    scores.forEach(s => {
      const k = (s as any).learning_area_id as string;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(Number((s as any).score));
    });
    return areas.map(a => {
      const list = map.get(a.id) || [];
      const avg = list.length ? Math.round(list.reduce((x, y) => x + y, 0) / list.length) : null;
      return { id: a.id, name: a.name, avg };
    }).sort((a, b) => (a.avg ?? 999) - (b.avg ?? 999));
  }, [areas, scores]);

  const openSubject = async (
    subject: { id: string; name: string; avg: number | null },
    initialMode: 'interventions' | 'tutor',
  ) => {
    setActiveSubject(subject);
    setMode(initialMode);
    setOpen(true);
    setContent('');
    await runGuide(subject, initialMode);
  };

  const runGuide = async (
    subject: { id: string; name: string; avg: number | null },
    m: 'interventions' | 'tutor',
  ) => {
    setLoading(true);
    setContent('');
    try {
      const { data, error } = await supabase.functions.invoke('parent-learning-guide', {
        body: {
          learnerName: child.full_name,
          grade: child.grade,
          subject: subject.name,
          averageScore: subject.avg,
          mode: m,
        },
      });
      if (error) throw error;
      setContent((data as any)?.content || 'No content returned.');
    } catch (e: any) {
      toast({ title: 'Could not generate guide', description: e.message, variant: 'destructive' });
      setContent('');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = async (m: 'interventions' | 'tutor') => {
    setMode(m);
    if (activeSubject) await runGuide(activeSubject, m);
  };

  return (
    <div className="space-y-4">
      <Card className="shadow-card border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" /> Learning Path for {child.full_name.split(' ')[0]}
          </CardTitle>
          <CardDescription className="text-xs">
            Tap a subject to see suggested interventions or open Tutor Mode for a step-by-step teaching guide.
          </CardDescription>
        </CardHeader>
      </Card>

      {subjectStats.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          No learning areas found for Grade {child.grade} yet.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {subjectStats.map(s => (
            <Card key={s.id} className="shadow-card hover:shadow-md transition-shadow">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{s.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.avg != null ? `Average: ${s.avg}%` : 'No marks recorded yet'}
                    </div>
                  </div>
                  <Badge className={cn('text-[10px] shrink-0', bandColor(s.avg))}>{bandLabel(s.avg)}</Badge>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1"
                    onClick={() => openSubject(s, 'interventions')}>
                    <Lightbulb className="h-3.5 w-3.5 mr-1" /> Interventions
                  </Button>
                  <Button size="sm" className="flex-1"
                    onClick={() => openSubject(s, 'tutor')}>
                    <BookOpen className="h-3.5 w-3.5 mr-1" /> Tutor Mode
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              {activeSubject?.name}
            </DialogTitle>
            <DialogDescription>
              Personalised for {child.full_name} — Grade {child.grade}
              {activeSubject?.avg != null && ` · Current average ${activeSubject.avg}%`}
            </DialogDescription>
          </DialogHeader>

          <Tabs value={mode} onValueChange={v => switchMode(v as any)}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="interventions"><Lightbulb className="h-3.5 w-3.5 mr-1" /> Interventions</TabsTrigger>
              <TabsTrigger value="tutor"><BookOpen className="h-3.5 w-3.5 mr-1" /> Tutor Mode</TabsTrigger>
            </TabsList>

            <TabsContent value={mode} className="mt-3">
              <ScrollArea className="h-[55vh] pr-3">
                {loading ? (
                  <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" /> Preparing your guide…
                  </div>
                ) : content ? <MD text={content} /> : (
                  <p className="text-sm text-muted-foreground py-10 text-center">No content.</p>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>

          {!loading && activeSubject && (
            <div className="flex justify-end pt-2">
              <Button size="sm" variant="outline" onClick={() => runGuide(activeSubject, mode)}>
                <Sparkles className="h-3.5 w-3.5 mr-1" /> Regenerate
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
