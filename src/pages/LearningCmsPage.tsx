// Admin CMS for the Continuous Learning Platform.
// - Super Admin manages globally (school_id = NULL).
// - School Admin / Headteacher manage content tagged to their own school.
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, Plus, ListChecks, FileText, Video, Library, ClipboardList } from "lucide-react";
import {
  SUBJECT_OPTIONS, GRADE_OPTIONS, ASSESSMENT_KIND_LABEL,
  type LearningTopic, type LearningVideo, type LearningNote, type LearningQuestion, type LearningAssessment,
  type LearningQuestionType, type AssessmentKind,
} from "@/lib/learning-cms";

export default function LearningCmsPage() {
  const { role, schoolId } = useAuth();
  const isSuper = role === "super_admin";
  const canManage = isSuper || role === "admin" || role === "headteacher";

  // Filters
  const [filterSubject, setFilterSubject] = useState<string>(SUBJECT_OPTIONS[0].slug);
  const [filterGrade, setFilterGrade] = useState<string>("Grade 5");

  const [topics, setTopics] = useState<LearningTopic[]>([]);
  const [activeTopic, setActiveTopic] = useState<LearningTopic | null>(null);

  const [videos, setVideos] = useState<LearningVideo[]>([]);
  const [notes, setNotes] = useState<LearningNote[]>([]);
  const [questions, setQuestions] = useState<LearningQuestion[]>([]);
  const [assessments, setAssessments] = useState<LearningAssessment[]>([]);

  const { toast } = useToast();

  const loadTopics = async () => {
    let q = supabase.from("learning_topics").select("*")
      .eq("subject_slug", filterSubject).eq("grade", filterGrade)
      .order("sort_order").order("title");
    const { data } = await q;
    const list = (data || []) as LearningTopic[];
    setTopics(list);
    setActiveTopic(prev => list.find(t => t.id === prev?.id) || list[0] || null);
  };
  useEffect(() => { loadTopics(); /* eslint-disable-next-line */ }, [filterSubject, filterGrade]);

  useEffect(() => {
    if (!activeTopic) { setVideos([]); setNotes([]); setQuestions([]); return; }
    (async () => {
      const [v, n, q] = await Promise.all([
        supabase.from("learning_videos").select("*").eq("topic_id", activeTopic.id).order("sort_order"),
        supabase.from("learning_notes").select("*").eq("topic_id", activeTopic.id).order("sort_order"),
        supabase.from("learning_questions").select("*").eq("topic_id", activeTopic.id).order("created_at"),
      ]);
      setVideos((v.data || []) as LearningVideo[]);
      setNotes((n.data || []) as LearningNote[]);
      setQuestions((q.data || []) as LearningQuestion[]);
    })();
  }, [activeTopic]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("learning_assessments").select("*")
        .eq("grade", filterGrade).order("created_at", { ascending: false });
      setAssessments((data || []) as LearningAssessment[]);
    })();
  }, [filterGrade]);

  if (!canManage) {
    return <DashboardLayout><div className="p-6">Only school admins and super admins can manage learning content.</div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold">Learning CMS</h1>
          <p className="text-sm text-muted-foreground">Manage CBC topics, animated videos, revision notes, question banks, and exam mocks.</p>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Subject</Label>
              <Select value={filterSubject} onValueChange={setFilterSubject}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SUBJECT_OPTIONS.map(s => <SelectItem key={s.slug} value={s.slug}>{s.icon} {s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Grade</Label>
              <Select value={filterGrade} onValueChange={setFilterGrade}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{GRADE_OPTIONS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Badge variant="outline" className="ml-auto">
                {isSuper ? "Global Content Editor" : "School Content Editor"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
          {/* Topics list */}
          <TopicsPanel
            topics={topics}
            activeTopic={activeTopic}
            onSelect={setActiveTopic}
            onChanged={loadTopics}
            isSuper={isSuper}
            schoolId={schoolId}
            subject={filterSubject}
            grade={filterGrade}
          />

          {/* Right side */}
          <div className="space-y-4">
            <Tabs defaultValue="videos">
              <TabsList>
                <TabsTrigger value="videos"><Video className="w-4 h-4 mr-1" />Videos</TabsTrigger>
                <TabsTrigger value="notes"><FileText className="w-4 h-4 mr-1" />Notes</TabsTrigger>
                <TabsTrigger value="questions"><ListChecks className="w-4 h-4 mr-1" />Questions</TabsTrigger>
                <TabsTrigger value="assessments"><ClipboardList className="w-4 h-4 mr-1" />Assessments</TabsTrigger>
              </TabsList>

              <TabsContent value="videos">
                <VideosPanel
                  topic={activeTopic} items={videos}
                  isSuper={isSuper} schoolId={schoolId}
                  onChanged={async () => activeTopic && setVideos((((await supabase.from("learning_videos").select("*").eq("topic_id", activeTopic.id).order("sort_order")).data) || []) as LearningVideo[])}
                />
              </TabsContent>
              <TabsContent value="notes">
                <NotesPanel
                  topic={activeTopic} items={notes}
                  isSuper={isSuper} schoolId={schoolId}
                  onChanged={async () => activeTopic && setNotes((((await supabase.from("learning_notes").select("*").eq("topic_id", activeTopic.id).order("sort_order")).data) || []) as LearningNote[])}
                />
              </TabsContent>
              <TabsContent value="questions">
                <QuestionsPanel
                  topic={activeTopic} items={questions}
                  isSuper={isSuper} schoolId={schoolId}
                  onChanged={async () => activeTopic && setQuestions((((await supabase.from("learning_questions").select("*").eq("topic_id", activeTopic.id).order("created_at")).data) || []) as LearningQuestion[])}
                />
              </TabsContent>
              <TabsContent value="assessments">
                <AssessmentsPanel
                  grade={filterGrade}
                  items={assessments}
                  topics={topics}
                  isSuper={isSuper} schoolId={schoolId}
                  onChanged={async () => setAssessments((((await supabase.from("learning_assessments").select("*").eq("grade", filterGrade).order("created_at", { ascending: false })).data) || []) as LearningAssessment[])}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

// ---------- Topics ----------

function TopicsPanel({ topics, activeTopic, onSelect, onChanged, isSuper, schoolId, subject, grade }: {
  topics: LearningTopic[]; activeTopic: LearningTopic | null;
  onSelect: (t: LearningTopic) => void; onChanged: () => void;
  isSuper: boolean; schoolId: string | null; subject: string; grade: string;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LearningTopic | null>(null);
  const [form, setForm] = useState({ title: "", strand: "", sub_strand: "", description: "" });

  const openNew = () => { setEditing(null); setForm({ title: "", strand: "", sub_strand: "", description: "" }); setOpen(true); };
  const openEdit = (t: LearningTopic) => { setEditing(t); setForm({ title: t.title, strand: t.strand || "", sub_strand: t.sub_strand || "", description: t.description || "" }); setOpen(true); };

  const save = async () => {
    if (!form.title.trim()) { toast({ title: "Title required", variant: "destructive" }); return; }
    const payload = {
      title: form.title.trim(),
      strand: form.strand.trim() || null,
      sub_strand: form.sub_strand.trim() || null,
      description: form.description.trim() || null,
      subject_slug: subject,
      grade,
      school_id: isSuper ? null : schoolId,
    };
    const { error } = editing
      ? await supabase.from("learning_topics").update(payload).eq("id", editing.id)
      : await supabase.from("learning_topics").insert(payload);
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    setOpen(false); onChanged();
  };
  const remove = async (t: LearningTopic) => {
    if (!confirm(`Delete topic "${t.title}"? This removes all videos/notes/questions under it.`)) return;
    const { error } = await supabase.from("learning_topics").delete().eq("id", t.id);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    else onChanged();
  };

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base">Topics</CardTitle>
        <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1" />New</Button>
      </CardHeader>
      <CardContent className="space-y-1.5 max-h-[60vh] overflow-y-auto">
        {topics.length === 0 && <p className="text-xs text-muted-foreground">No topics yet for this subject/grade.</p>}
        {topics.map(t => (
          <div key={t.id} className={`rounded-md border p-2 flex items-center gap-2 ${activeTopic?.id === t.id ? "border-primary bg-primary/5" : ""}`}>
            <button className="flex-1 text-left" onClick={() => onSelect(t)}>
              <p className="text-sm font-medium leading-tight">{t.title}</p>
              <p className="text-[11px] text-muted-foreground">{t.strand || "—"}{t.school_id ? " · school" : " · global"}</p>
            </button>
            <Button size="icon" variant="ghost" onClick={() => openEdit(t)}><Pencil className="w-3.5 h-3.5" /></Button>
            <Button size="icon" variant="ghost" onClick={() => remove(t)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
          </div>
        ))}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Topic" : "New Topic"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Title</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Strand</Label><Input value={form.strand} onChange={e => setForm(f => ({ ...f, strand: e.target.value }))} /></div>
              <div><Label>Sub-strand</Label><Input value={form.sub_strand} onChange={e => setForm(f => ({ ...f, sub_strand: e.target.value }))} /></div>
            </div>
            <div><Label>Description</Label><Textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button onClick={save}>{editing ? "Update" : "Create"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ---------- Videos ----------

function VideosPanel({ topic, items, isSuper, schoolId, onChanged }: {
  topic: LearningTopic | null; items: LearningVideo[];
  isSuper: boolean; schoolId: string | null; onChanged: () => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LearningVideo | null>(null);
  const [form, setForm] = useState({ title: "", description: "", video_url: "", duration_seconds: "" });

  if (!topic) return <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Select or create a topic to add videos.</CardContent></Card>;

  const openNew = () => { setEditing(null); setForm({ title: "", description: "", video_url: "", duration_seconds: "" }); setOpen(true); };
  const openEdit = (v: LearningVideo) => { setEditing(v); setForm({ title: v.title, description: v.description || "", video_url: v.video_url, duration_seconds: String(v.duration_seconds || "") }); setOpen(true); };

  const save = async () => {
    if (!form.title.trim() || !form.video_url.trim()) { toast({ title: "Title and URL required", variant: "destructive" }); return; }
    const payload = {
      topic_id: topic.id, school_id: isSuper ? null : schoolId,
      title: form.title.trim(), description: form.description.trim() || null,
      video_url: form.video_url.trim(),
      duration_seconds: form.duration_seconds ? parseInt(form.duration_seconds, 10) : null,
    };
    const { error } = editing
      ? await supabase.from("learning_videos").update(payload).eq("id", editing.id)
      : await supabase.from("learning_videos").insert(payload);
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    setOpen(false); onChanged();
  };
  const remove = async (v: LearningVideo) => {
    if (!confirm(`Delete video "${v.title}"?`)) return;
    await supabase.from("learning_videos").delete().eq("id", v.id);
    onChanged();
  };

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base">Videos for "{topic.title}"</CardTitle>
        <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1" />Add video</Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 && <p className="text-sm text-muted-foreground">No videos yet.</p>}
        {items.map(v => (
          <div key={v.id} className="rounded-md border p-3 flex items-start gap-3">
            <Video className="w-5 h-5 text-primary mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{v.title}</p>
              <p className="text-xs text-muted-foreground truncate">{v.video_url}</p>
              {v.description && <p className="text-xs mt-1">{v.description}</p>}
            </div>
            <Button size="icon" variant="ghost" onClick={() => openEdit(v)}><Pencil className="w-3.5 h-3.5" /></Button>
            <Button size="icon" variant="ghost" onClick={() => remove(v)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
          </div>
        ))}
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Video" : "Add Video"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Title</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div><Label>YouTube / Vimeo / MP4 URL</Label><Input value={form.video_url} onChange={e => setForm(f => ({ ...f, video_url: e.target.value }))} placeholder="https://www.youtube.com/watch?v=..." /></div>
            <div><Label>Duration (seconds, optional)</Label><Input value={form.duration_seconds} onChange={e => setForm(f => ({ ...f, duration_seconds: e.target.value }))} /></div>
            <div><Label>Description</Label><Textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button onClick={save}>{editing ? "Update" : "Create"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ---------- Notes ----------

function NotesPanel({ topic, items, isSuper, schoolId, onChanged }: {
  topic: LearningTopic | null; items: LearningNote[];
  isSuper: boolean; schoolId: string | null; onChanged: () => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LearningNote | null>(null);
  const [form, setForm] = useState({ title: "", content_md: "", attachment_url: "" });

  if (!topic) return <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Select or create a topic to add notes.</CardContent></Card>;

  const openNew = () => { setEditing(null); setForm({ title: "", content_md: "", attachment_url: "" }); setOpen(true); };
  const openEdit = (n: LearningNote) => { setEditing(n); setForm({ title: n.title, content_md: n.content_md, attachment_url: n.attachment_url || "" }); setOpen(true); };

  const save = async () => {
    if (!form.title.trim()) { toast({ title: "Title required", variant: "destructive" }); return; }
    const payload = {
      topic_id: topic.id, school_id: isSuper ? null : schoolId,
      title: form.title.trim(), content_md: form.content_md,
      attachment_url: form.attachment_url.trim() || null,
    };
    const { error } = editing
      ? await supabase.from("learning_notes").update(payload).eq("id", editing.id)
      : await supabase.from("learning_notes").insert(payload);
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    setOpen(false); onChanged();
  };
  const remove = async (n: LearningNote) => {
    if (!confirm(`Delete note "${n.title}"?`)) return;
    await supabase.from("learning_notes").delete().eq("id", n.id); onChanged();
  };

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base">Notes for "{topic.title}"</CardTitle>
        <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1" />Add note</Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 && <p className="text-sm text-muted-foreground">No notes yet.</p>}
        {items.map(n => (
          <div key={n.id} className="rounded-md border p-3 flex items-start gap-3">
            <FileText className="w-5 h-5 text-primary mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{n.title}</p>
              <p className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-wrap">{n.content_md.slice(0, 200)}</p>
            </div>
            <Button size="icon" variant="ghost" onClick={() => openEdit(n)}><Pencil className="w-3.5 h-3.5" /></Button>
            <Button size="icon" variant="ghost" onClick={() => remove(n)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
          </div>
        ))}
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? "Edit Note" : "Add Note"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Title</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div>
              <Label>Body (Markdown supported)</Label>
              <Textarea rows={12} value={form.content_md} onChange={e => setForm(f => ({ ...f, content_md: e.target.value }))}
                placeholder={`# Heading\n## Sub-heading\n- bullet point\n\nParagraph text...`}
              />
            </div>
            <div><Label>Attachment URL (optional)</Label><Input value={form.attachment_url} onChange={e => setForm(f => ({ ...f, attachment_url: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button onClick={save}>{editing ? "Update" : "Create"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ---------- Questions ----------

function emptyOption(label: string) { return { id: crypto.randomUUID(), text: label }; }

function QuestionsPanel({ topic, items, isSuper, schoolId, onChanged }: {
  topic: LearningTopic | null; items: LearningQuestion[];
  isSuper: boolean; schoolId: string | null; onChanged: () => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LearningQuestion | null>(null);
  const [form, setForm] = useState<{
    question_type: LearningQuestionType; prompt: string; explanation: string;
    options: Array<{ id: string; text: string }>; correct_ids: string[];
    short_answer: string; difficulty: number; marks: number;
  }>({
    question_type: "mcq", prompt: "", explanation: "",
    options: [emptyOption(""), emptyOption("")],
    correct_ids: [], short_answer: "", difficulty: 2, marks: 1,
  });

  if (!topic) return <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Select or create a topic to add questions.</CardContent></Card>;

  const openNew = () => {
    setEditing(null);
    setForm({ question_type: "mcq", prompt: "", explanation: "",
      options: [emptyOption(""), emptyOption("")], correct_ids: [], short_answer: "", difficulty: 2, marks: 1 });
    setOpen(true);
  };
  const openEdit = (q: LearningQuestion) => {
    setEditing(q);
    const opts = (q.options || []) as Array<{ id: string; text: string }>;
    setForm({
      question_type: q.question_type, prompt: q.prompt, explanation: q.explanation || "",
      options: opts.length ? opts : [emptyOption(""), emptyOption("")],
      correct_ids: q.question_type === "short_answer" ? [] : (q.correct_answers as string[]),
      short_answer: q.question_type === "short_answer" ? (q.correct_answers?.[0] || "") : "",
      difficulty: q.difficulty, marks: q.marks,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.prompt.trim()) { toast({ title: "Prompt required", variant: "destructive" }); return; }
    let options: any[] = [];
    let correct_answers: any[] = [];
    if (form.question_type === "short_answer") {
      if (!form.short_answer.trim()) { toast({ title: "Provide the correct answer", variant: "destructive" }); return; }
      correct_answers = [form.short_answer.trim()];
    } else if (form.question_type === "true_false") {
      options = [{ id: "true", text: "True" }, { id: "false", text: "False" }];
      if (form.correct_ids.length !== 1) { toast({ title: "Pick True or False", variant: "destructive" }); return; }
      correct_answers = form.correct_ids;
    } else {
      const cleaned = form.options.map(o => ({ ...o, text: o.text.trim() })).filter(o => o.text);
      if (cleaned.length < 2) { toast({ title: "At least 2 options required", variant: "destructive" }); return; }
      const correct = form.correct_ids.filter(id => cleaned.some(o => o.id === id));
      if (form.question_type === "mcq" && correct.length !== 1) { toast({ title: "Select exactly 1 correct option", variant: "destructive" }); return; }
      if (form.question_type === "multi_select" && correct.length < 1) { toast({ title: "Select at least 1 correct option", variant: "destructive" }); return; }
      options = cleaned;
      correct_answers = correct;
    }

    const payload = {
      topic_id: topic.id, school_id: isSuper ? null : schoolId,
      question_type: form.question_type,
      prompt: form.prompt.trim(),
      options, correct_answers,
      explanation: form.explanation.trim() || null,
      difficulty: form.difficulty, marks: form.marks,
    };
    const { error } = editing
      ? await supabase.from("learning_questions").update(payload).eq("id", editing.id)
      : await supabase.from("learning_questions").insert(payload);
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    setOpen(false); onChanged();
  };
  const remove = async (q: LearningQuestion) => {
    if (!confirm("Delete this question?")) return;
    await supabase.from("learning_questions").delete().eq("id", q.id); onChanged();
  };

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base">Questions for "{topic.title}"</CardTitle>
        <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1" />Add question</Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 && <p className="text-sm text-muted-foreground">No questions yet.</p>}
        {items.map(q => (
          <div key={q.id} className="rounded-md border p-3 flex items-start gap-3">
            <ListChecks className="w-5 h-5 text-primary mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{q.prompt}</p>
              <p className="text-[11px] text-muted-foreground">{q.question_type} · difficulty {q.difficulty} · {q.marks} mark{q.marks === 1 ? "" : "s"}</p>
            </div>
            <Button size="icon" variant="ghost" onClick={() => openEdit(q)}><Pencil className="w-3.5 h-3.5" /></Button>
            <Button size="icon" variant="ghost" onClick={() => remove(q)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
          </div>
        ))}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? "Edit Question" : "New Question"}</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            <div>
              <Label>Question type</Label>
              <Select value={form.question_type} onValueChange={(v: LearningQuestionType) => setForm(f => ({ ...f, question_type: v, correct_ids: [] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mcq">Multiple Choice (single answer)</SelectItem>
                  <SelectItem value="multi_select">Multiple Choice (multiple answers)</SelectItem>
                  <SelectItem value="true_false">True / False</SelectItem>
                  <SelectItem value="short_answer">Short Answer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Prompt</Label><Textarea rows={3} value={form.prompt} onChange={e => setForm(f => ({ ...f, prompt: e.target.value }))} /></div>

            {form.question_type === "short_answer" ? (
              <div><Label>Accepted answer (case-insensitive)</Label><Input value={form.short_answer} onChange={e => setForm(f => ({ ...f, short_answer: e.target.value }))} /></div>
            ) : form.question_type === "true_false" ? (
              <div className="flex gap-2">
                {["true","false"].map(id => (
                  <Button key={id} type="button"
                    variant={form.correct_ids[0] === id ? "default" : "outline"}
                    onClick={() => setForm(f => ({ ...f, correct_ids: [id] }))}>
                    {id === "true" ? "True" : "False"}
                  </Button>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Options (mark correct)</Label>
                {form.options.map((o, idx) => (
                  <div key={o.id} className="flex items-center gap-2">
                    <input
                      type={form.question_type === "mcq" ? "radio" : "checkbox"}
                      name="correct"
                      checked={form.correct_ids.includes(o.id)}
                      onChange={() => setForm(f => ({
                        ...f,
                        correct_ids: f.question_type === "mcq"
                          ? [o.id]
                          : f.correct_ids.includes(o.id) ? f.correct_ids.filter(x => x !== o.id) : [...f.correct_ids, o.id],
                      }))}
                    />
                    <Input value={o.text} onChange={e => setForm(f => ({
                      ...f, options: f.options.map(x => x.id === o.id ? { ...x, text: e.target.value } : x),
                    }))} placeholder={`Option ${idx + 1}`} />
                    <Button size="icon" variant="ghost" onClick={() => setForm(f => ({ ...f, options: f.options.filter(x => x.id !== o.id), correct_ids: f.correct_ids.filter(c => c !== o.id) }))}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
                <Button size="sm" variant="outline" onClick={() => setForm(f => ({ ...f, options: [...f.options, emptyOption("")] }))}>
                  <Plus className="w-3.5 h-3.5 mr-1" />Add option
                </Button>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div><Label>Difficulty (1-3)</Label><Input type="number" min={1} max={3} value={form.difficulty} onChange={e => setForm(f => ({ ...f, difficulty: parseInt(e.target.value) || 2 }))} /></div>
              <div><Label>Marks</Label><Input type="number" min={1} value={form.marks} onChange={e => setForm(f => ({ ...f, marks: parseInt(e.target.value) || 1 }))} /></div>
            </div>
            <div><Label>Explanation (shown after marking)</Label><Textarea rows={3} value={form.explanation} onChange={e => setForm(f => ({ ...f, explanation: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button onClick={save}>{editing ? "Update" : "Create"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ---------- Assessments ----------

function AssessmentsPanel({ grade, items, topics, isSuper, schoolId, onChanged }: {
  grade: string;
  items: LearningAssessment[];
  topics: LearningTopic[];
  isSuper: boolean; schoolId: string | null; onChanged: () => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LearningAssessment | null>(null);
  const [form, setForm] = useState({
    kind: "topic_quiz" as AssessmentKind,
    title: "", description: "",
    subject_slug: SUBJECT_OPTIONS[0].slug,
    duration_minutes: 20, pass_percent: 50,
    selectedTopicIds: [] as string[],
  });
  const [poolQuestions, setPoolQuestions] = useState<Array<{ id: string; topic_id: string; prompt: string }>>([]);
  const [chosenQuestionIds, setChosenQuestionIds] = useState<string[]>([]);

  // Load questions for the selected topics so the admin can hand-pick.
  useEffect(() => {
    if (!form.selectedTopicIds.length) { setPoolQuestions([]); return; }
    (async () => {
      const { data } = await supabase.from("learning_questions")
        .select("id, topic_id, prompt").in("topic_id", form.selectedTopicIds).eq("is_active", true);
      setPoolQuestions(data || []);
    })();
  }, [form.selectedTopicIds]);

  const openNew = () => {
    setEditing(null);
    setForm({
      kind: "topic_quiz", title: "", description: "",
      subject_slug: SUBJECT_OPTIONS[0].slug, duration_minutes: 20, pass_percent: 50,
      selectedTopicIds: [],
    });
    setChosenQuestionIds([]);
    setOpen(true);
  };
  const openEdit = (a: LearningAssessment) => {
    setEditing(a);
    setForm({
      kind: a.kind, title: a.title, description: a.description || "",
      subject_slug: a.subject_slug || SUBJECT_OPTIONS[0].slug,
      duration_minutes: a.duration_minutes, pass_percent: a.pass_percent,
      selectedTopicIds: topics.filter(t => a.subject_slug ? t.subject_slug === a.subject_slug : true).map(t => t.id),
    });
    setChosenQuestionIds(a.question_ids || []);
    setOpen(true);
  };
  const save = async () => {
    if (!form.title.trim()) { toast({ title: "Title required", variant: "destructive" }); return; }
    if (!chosenQuestionIds.length) { toast({ title: "Pick at least one question", variant: "destructive" }); return; }
    const payload = {
      kind: form.kind, title: form.title.trim(),
      description: form.description.trim() || null,
      subject_slug: form.kind === "kpsea_mock" || form.kind === "kjsea_mock" ? null : form.subject_slug,
      grade,
      duration_minutes: form.duration_minutes, pass_percent: form.pass_percent,
      question_ids: chosenQuestionIds,
      school_id: isSuper ? null : schoolId,
    };
    const { error } = editing
      ? await supabase.from("learning_assessments").update(payload).eq("id", editing.id)
      : await supabase.from("learning_assessments").insert(payload);
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    setOpen(false); onChanged();
  };
  const remove = async (a: LearningAssessment) => {
    if (!confirm(`Delete "${a.title}"?`)) return;
    await supabase.from("learning_assessments").delete().eq("id", a.id); onChanged();
  };

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base">Assessments for {grade}</CardTitle>
        <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1" />New assessment</Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 && <p className="text-sm text-muted-foreground">No assessments yet.</p>}
        {items.map(a => (
          <div key={a.id} className="rounded-md border p-3 flex items-start gap-3">
            <ClipboardList className="w-5 h-5 text-primary mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{a.title}</p>
              <p className="text-[11px] text-muted-foreground">
                {ASSESSMENT_KIND_LABEL[a.kind]} · {a.duration_minutes} min · pass {a.pass_percent}% · {(a.question_ids || []).length} q
                {a.subject_slug ? ` · ${a.subject_slug}` : ""}
              </p>
            </div>
            <Button size="icon" variant="ghost" onClick={() => openEdit(a)}><Pencil className="w-3.5 h-3.5" /></Button>
            <Button size="icon" variant="ghost" onClick={() => remove(a)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
          </div>
        ))}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>{editing ? "Edit Assessment" : "New Assessment"}</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Kind</Label>
                <Select value={form.kind} onValueChange={(v: AssessmentKind) => setForm(f => ({ ...f, kind: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ASSESSMENT_KIND_LABEL).map(([k, label]) =>
                      <SelectItem key={k} value={k}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Subject</Label>
                <Select value={form.subject_slug} onValueChange={v => setForm(f => ({ ...f, subject_slug: v, selectedTopicIds: [] }))}
                  disabled={form.kind === "kpsea_mock" || form.kind === "kjsea_mock"}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SUBJECT_OPTIONS.map(s => <SelectItem key={s.slug} value={s.slug}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Title</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div><Label>Description</Label><Textarea rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Duration (minutes)</Label><Input type="number" value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: parseInt(e.target.value) || 20 }))} /></div>
              <div><Label>Pass mark (%)</Label><Input type="number" value={form.pass_percent} onChange={e => setForm(f => ({ ...f, pass_percent: parseInt(e.target.value) || 50 }))} /></div>
            </div>

            <div>
              <Label>Pick topics to source questions from</Label>
              <div className="max-h-32 overflow-y-auto border rounded p-2 space-y-1">
                {topics
                  .filter(t => (form.kind === "kpsea_mock" || form.kind === "kjsea_mock") ? true : t.subject_slug === form.subject_slug)
                  .map(t => {
                    const checked = form.selectedTopicIds.includes(t.id);
                    return (
                      <label key={t.id} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={checked} onChange={() => setForm(f => ({
                          ...f, selectedTopicIds: checked ? f.selectedTopicIds.filter(id => id !== t.id) : [...f.selectedTopicIds, t.id],
                        }))} />
                        {t.title} <span className="text-muted-foreground text-xs">{t.subject_slug}</span>
                      </label>
                    );
                  })}
              </div>
            </div>

            <div>
              <Label>Pick questions ({chosenQuestionIds.length} selected)</Label>
              <div className="max-h-48 overflow-y-auto border rounded p-2 space-y-1">
                {poolQuestions.length === 0 && <p className="text-xs text-muted-foreground">Select topics above to load their questions.</p>}
                {poolQuestions.map(q => {
                  const checked = chosenQuestionIds.includes(q.id);
                  return (
                    <label key={q.id} className="flex items-start gap-2 text-sm">
                      <input type="checkbox" className="mt-1" checked={checked} onChange={() => setChosenQuestionIds(prev => checked ? prev.filter(x => x !== q.id) : [...prev, q.id])} />
                      <span>{q.prompt}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter><Button onClick={save}>{editing ? "Update" : "Create"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
