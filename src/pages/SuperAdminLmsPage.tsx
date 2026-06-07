import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, ArrowLeft, BookOpen, Pencil, GripVertical, ClipboardList } from "lucide-react";
import { Course, Module, Lesson, Quiz, QuizQuestion, Assignment, LiveSession, slugify } from "@/features/lms/api";

export default function SuperAdminLmsPage() {
  const navigate = useNavigate();
  const { role, loading } = useAuth();
  if (loading) return null;
  if (role !== "super_admin") { navigate("/"); return null; }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-card border-b">
        <div className="container mx-auto px-4 py-3 flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /></Button>
          <BookOpen className="h-5 w-5 text-primary" />
          <div>
            <h1 className="font-display font-bold">LMS Catalog Manager</h1>
            <p className="text-[11px] text-muted-foreground">Courses, modules, lessons, quizzes, assignments & live sessions</p>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-4 max-w-6xl">
        <CoursesPanel />
      </main>
    </div>
  );
}

/* ----------------------------- Courses panel ----------------------------- */
function CoursesPanel() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [active, setActive] = useState<Course | null>(null);
  const { data: courses = [] } = useQuery({
    queryKey: ["lms-admin-courses"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("lms_courses").select("*").order("sort_order");
      return (data || []) as Course[];
    },
  });

  const [draft, setDraft] = useState<Partial<Course> | null>(null);
  const save = async () => {
    if (!draft?.title) return;
    const row = {
      ...draft,
      slug: draft.slug || slugify(draft.title!),
      pass_percent: draft.pass_percent ?? 60,
      level: draft.level || "ALL",
      sort_order: draft.sort_order ?? courses.length,
      is_published: draft.is_published ?? false,
    } as any;
    if (draft.id) await (supabase as any).from("lms_courses").update(row).eq("id", draft.id);
    else await (supabase as any).from("lms_courses").insert(row);
    toast({ title: "Saved" });
    setDraft(null);
    qc.invalidateQueries({ queryKey: ["lms-admin-courses"] });
  };
  const del = async (id: string) => {
    if (!confirm("Delete this course and ALL its modules/lessons?")) return;
    await (supabase as any).from("lms_courses").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["lms-admin-courses"] });
    if (active?.id === id) setActive(null);
  };

  if (active) return <CourseEditor course={active} onBack={() => setActive(null)} />;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold">Courses ({courses.length})</h2>
        <Button onClick={() => setDraft({ title: "", level: "ALL", pass_percent: 60 })}><Plus className="h-4 w-4 mr-1" /> New course</Button>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        {courses.map(c => (
          <Card key={c.id}>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{c.title}</p>
                  <p className="text-[11px] text-muted-foreground">{c.grade || "—"} · {c.level} · /{c.slug}</p>
                </div>
                <Badge variant={c.is_published ? "default" : "outline"} className="text-[10px]">{c.is_published ? "Live" : "Draft"}</Badge>
              </div>
              {c.summary && <p className="text-xs text-muted-foreground line-clamp-2">{c.summary}</p>}
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => setActive(c)}>Manage</Button>
                <Button size="sm" variant="ghost" onClick={() => setDraft(c)}><Pencil className="h-3 w-3" /></Button>
                <Button size="sm" variant="ghost" onClick={() => del(c.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {courses.length === 0 && <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No courses. Create one to get started.</CardContent></Card>}
      </div>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{draft?.id ? "Edit course" : "New course"}</DialogTitle></DialogHeader>
          {draft && (
            <div className="space-y-2">
              <div><Label>Title</Label><Input value={draft.title || ""} onChange={e => setDraft({ ...draft, title: e.target.value })} /></div>
              <div><Label>Slug (URL)</Label><Input value={draft.slug || ""} onChange={e => setDraft({ ...draft, slug: e.target.value })} placeholder="auto from title" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Grade</Label><Input value={draft.grade || ""} onChange={e => setDraft({ ...draft, grade: e.target.value })} placeholder="e.g. Grade 5" /></div>
                <div>
                  <Label>Level</Label>
                  <Select value={draft.level || "ALL"} onValueChange={v => setDraft({ ...draft, level: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All</SelectItem>
                      <SelectItem value="KPSEA">KPSEA</SelectItem>
                      <SelectItem value="KJSEA">KJSEA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Subject slug</Label><Input value={draft.subject_slug || ""} onChange={e => setDraft({ ...draft, subject_slug: e.target.value })} placeholder="mathematics, english, …" /></div>
              <div><Label>Summary</Label><Textarea value={draft.summary || ""} onChange={e => setDraft({ ...draft, summary: e.target.value })} rows={2} /></div>
              <div><Label>Cover URL</Label><Input value={draft.cover_url || ""} onChange={e => setDraft({ ...draft, cover_url: e.target.value })} /></div>
              <div><Label>Instructor name</Label><Input value={draft.instructor_name || ""} onChange={e => setDraft({ ...draft, instructor_name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Pass %</Label><Input type="number" value={draft.pass_percent ?? 60} onChange={e => setDraft({ ...draft, pass_percent: Number(e.target.value) })} /></div>
                <div className="flex items-end gap-2"><Switch checked={!!draft.is_published} onCheckedChange={v => setDraft({ ...draft, is_published: v })} /><Label>Published</Label></div>
              </div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ----------------------------- Course editor ----------------------------- */
function CourseEditor({ course, onBack }: { course: Course; onBack: () => void }) {
  return (
    <div className="space-y-3">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" /> All courses</Button>
      <Card><CardContent className="p-3">
        <h2 className="font-display font-bold">{course.title}</h2>
        <p className="text-xs text-muted-foreground">{course.grade || "—"} · {course.level} · {course.is_published ? "Published" : "Draft"}</p>
      </CardContent></Card>
      <Tabs defaultValue="structure">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="structure">Modules & Lessons</TabsTrigger>
          <TabsTrigger value="quizzes">Quizzes</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="live">Live</TabsTrigger>
        </TabsList>
        <TabsContent value="structure"><ModulesPanel courseId={course.id} /></TabsContent>
        <TabsContent value="quizzes"><QuizzesPanel courseId={course.id} /></TabsContent>
        <TabsContent value="assignments"><AssignmentsPanel courseId={course.id} /></TabsContent>
        <TabsContent value="live"><LivePanel courseId={course.id} /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ----------------------------- Modules + Lessons ----------------------------- */
function ModulesPanel({ courseId }: { courseId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: modules = [] } = useQuery({
    queryKey: ["lms-admin-modules", courseId],
    queryFn: async () => {
      const { data } = await (supabase as any).from("lms_modules").select("*").eq("course_id", courseId).order("sort_order");
      return (data || []) as Module[];
    },
  });
  const [mDraft, setMDraft] = useState<Partial<Module> | null>(null);
  const saveM = async () => {
    if (!mDraft?.title) return;
    const row = { ...mDraft, course_id: courseId, sort_order: mDraft.sort_order ?? modules.length, is_published: mDraft.is_published ?? true };
    if (mDraft.id) await (supabase as any).from("lms_modules").update(row).eq("id", mDraft.id);
    else await (supabase as any).from("lms_modules").insert(row);
    setMDraft(null); qc.invalidateQueries({ queryKey: ["lms-admin-modules", courseId] });
    toast({ title: "Saved" });
  };
  const delM = async (id: string) => {
    if (!confirm("Delete module and its lessons?")) return;
    await (supabase as any).from("lms_modules").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["lms-admin-modules", courseId] });
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end"><Button size="sm" onClick={() => setMDraft({ title: "" })}><Plus className="h-4 w-4 mr-1" /> Add module</Button></div>
      {modules.map(m => (
        <Card key={m.id}>
          <CardHeader className="pb-1">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">{m.title}</CardTitle>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setMDraft(m)}><Pencil className="h-3 w-3" /></Button>
                <Button size="sm" variant="ghost" onClick={() => delM(m.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <LessonsList moduleId={m.id} />
          </CardContent>
        </Card>
      ))}
      {modules.length === 0 && <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">No modules yet.</CardContent></Card>}

      <Dialog open={!!mDraft} onOpenChange={o => !o && setMDraft(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{mDraft?.id ? "Edit module" : "New module"}</DialogTitle></DialogHeader>
          {mDraft && (
            <div className="space-y-2">
              <div><Label>Title</Label><Input value={mDraft.title || ""} onChange={e => setMDraft({ ...mDraft, title: e.target.value })} /></div>
              <div><Label>Summary</Label><Textarea value={mDraft.summary || ""} onChange={e => setMDraft({ ...mDraft, summary: e.target.value })} rows={2} /></div>
              <div><Label>Order</Label><Input type="number" value={mDraft.sort_order ?? modules.length} onChange={e => setMDraft({ ...mDraft, sort_order: Number(e.target.value) })} /></div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setMDraft(null)}>Cancel</Button><Button onClick={saveM}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LessonsList({ moduleId }: { moduleId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: lessons = [] } = useQuery({
    queryKey: ["lms-admin-lessons", moduleId],
    queryFn: async () => {
      const { data } = await (supabase as any).from("lms_lessons").select("*").eq("module_id", moduleId).order("sort_order");
      return (data || []) as Lesson[];
    },
  });
  const [draft, setDraft] = useState<Partial<Lesson> | null>(null);
  const save = async () => {
    if (!draft?.title) return;
    const row = {
      ...draft, module_id: moduleId,
      sort_order: draft.sort_order ?? lessons.length,
      is_published: draft.is_published ?? true,
      is_free: draft.is_free ?? false,
      duration_min: draft.duration_min ?? 0,
      kind: draft.kind || "video",
    };
    if (draft.id) await (supabase as any).from("lms_lessons").update(row).eq("id", draft.id);
    else await (supabase as any).from("lms_lessons").insert(row);
    setDraft(null); qc.invalidateQueries({ queryKey: ["lms-admin-lessons", moduleId] });
    toast({ title: "Saved" });
  };
  const del = async (id: string) => {
    if (!confirm("Delete lesson?")) return;
    await (supabase as any).from("lms_lessons").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["lms-admin-lessons", moduleId] });
  };

  return (
    <div className="space-y-1">
      {lessons.map(l => (
        <div key={l.id} className="flex items-center gap-2 p-2 border rounded">
          <GripVertical className="h-3 w-3 text-muted-foreground" />
          <Badge variant="outline" className="text-[10px]">{l.kind}</Badge>
          <span className="flex-1 text-sm">{l.title}</span>
          {l.is_free && <Badge className="text-[9px]">free</Badge>}
          <Button size="sm" variant="ghost" onClick={() => setDraft(l)}><Pencil className="h-3 w-3" /></Button>
          <Button size="sm" variant="ghost" onClick={() => del(l.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={() => setDraft({ title: "", kind: "video" })}><Plus className="h-3 w-3 mr-1" /> Add lesson</Button>

      <Dialog open={!!draft} onOpenChange={o => !o && setDraft(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{draft?.id ? "Edit lesson" : "New lesson"}</DialogTitle></DialogHeader>
          {draft && (
            <div className="space-y-2">
              <div><Label>Title</Label><Input value={draft.title || ""} onChange={e => setDraft({ ...draft, title: e.target.value })} /></div>
              <div>
                <Label>Type</Label>
                <Select value={draft.kind || "video"} onValueChange={v => setDraft({ ...draft, kind: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="video">Video</SelectItem>
                    <SelectItem value="notes">Notes</SelectItem>
                    <SelectItem value="reading">Reading</SelectItem>
                    <SelectItem value="live">Live</SelectItem>
                    <SelectItem value="quiz">Quiz only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Video URL (YouTube/Vimeo)</Label><Input value={draft.video_url || ""} onChange={e => setDraft({ ...draft, video_url: e.target.value })} /></div>
              <div><Label>Notes (markdown / plain text)</Label><Textarea value={draft.notes_md || ""} onChange={e => setDraft({ ...draft, notes_md: e.target.value })} rows={6} /></div>
              <div><Label>Attachment URL</Label><Input value={draft.attachment_url || ""} onChange={e => setDraft({ ...draft, attachment_url: e.target.value })} /></div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label>Minutes</Label><Input type="number" value={draft.duration_min ?? 0} onChange={e => setDraft({ ...draft, duration_min: Number(e.target.value) })} /></div>
                <div><Label>Order</Label><Input type="number" value={draft.sort_order ?? lessons.length} onChange={e => setDraft({ ...draft, sort_order: Number(e.target.value) })} /></div>
                <div className="flex items-end gap-2"><Switch checked={!!draft.is_free} onCheckedChange={v => setDraft({ ...draft, is_free: v })} /><Label>Free</Label></div>
              </div>
              <div className="flex items-center gap-2"><Switch checked={draft.is_published ?? true} onCheckedChange={v => setDraft({ ...draft, is_published: v })} /><Label>Published</Label></div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ----------------------------- Quizzes ----------------------------- */
function QuizzesPanel({ courseId }: { courseId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: quizzes = [] } = useQuery({
    queryKey: ["lms-admin-quizzes", courseId],
    queryFn: async () => {
      const { data } = await (supabase as any).from("lms_quizzes").select("*, lms_lessons(title)").eq("course_id", courseId).order("sort_order");
      return data || [];
    },
  });
  const { data: lessons = [] } = useQuery({
    queryKey: ["lms-admin-lessons-for-quiz", courseId],
    queryFn: async () => {
      const { data: mods } = await (supabase as any).from("lms_modules").select("id").eq("course_id", courseId);
      const ids = (mods || []).map((m: any) => m.id);
      if (!ids.length) return [];
      const { data } = await (supabase as any).from("lms_lessons").select("id, title").in("module_id", ids);
      return data || [];
    },
  });
  const [draft, setDraft] = useState<Partial<Quiz> | null>(null);
  const [openQuiz, setOpenQuiz] = useState<Quiz | null>(null);
  const save = async () => {
    if (!draft?.title) return;
    const row = { ...draft, course_id: courseId, pass_percent: draft.pass_percent ?? 60, sort_order: draft.sort_order ?? quizzes.length };
    if (draft.id) await (supabase as any).from("lms_quizzes").update(row).eq("id", draft.id);
    else await (supabase as any).from("lms_quizzes").insert(row);
    setDraft(null); qc.invalidateQueries({ queryKey: ["lms-admin-quizzes", courseId] });
    toast({ title: "Saved" });
  };
  const del = async (id: string) => {
    if (!confirm("Delete quiz and questions?")) return;
    await (supabase as any).from("lms_quizzes").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["lms-admin-quizzes", courseId] });
  };

  if (openQuiz) return <QuestionsPanel quiz={openQuiz} onBack={() => setOpenQuiz(null)} />;
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><Button size="sm" onClick={() => setDraft({ title: "", pass_percent: 60 })}><Plus className="h-4 w-4 mr-1" /> Add quiz</Button></div>
      {quizzes.map((q: any) => (
        <Card key={q.id}><CardContent className="p-3 flex items-center gap-2">
          <div className="flex-1">
            <p className="font-medium text-sm">{q.title}</p>
            <p className="text-[11px] text-muted-foreground">{q.lms_lessons?.title || "Course-level"} · pass {q.pass_percent}%</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setOpenQuiz(q)}>Questions</Button>
          <Button size="sm" variant="ghost" onClick={() => setDraft(q)}><Pencil className="h-3 w-3" /></Button>
          <Button size="sm" variant="ghost" onClick={() => del(q.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
        </CardContent></Card>
      ))}

      <Dialog open={!!draft} onOpenChange={o => !o && setDraft(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{draft?.id ? "Edit quiz" : "New quiz"}</DialogTitle></DialogHeader>
          {draft && (
            <div className="space-y-2">
              <div><Label>Title</Label><Input value={draft.title || ""} onChange={e => setDraft({ ...draft, title: e.target.value })} /></div>
              <div>
                <Label>Attach to lesson (optional)</Label>
                <Select value={draft.lesson_id || "none"} onValueChange={v => setDraft({ ...draft, lesson_id: v === "none" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Course-level (no lesson)</SelectItem>
                    {lessons.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Pass %</Label><Input type="number" value={draft.pass_percent ?? 60} onChange={e => setDraft({ ...draft, pass_percent: Number(e.target.value) })} /></div>
                <div><Label>Time limit (min)</Label><Input type="number" value={draft.time_limit_min ?? ""} onChange={e => setDraft({ ...draft, time_limit_min: e.target.value ? Number(e.target.value) : null })} /></div>
              </div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function QuestionsPanel({ quiz, onBack }: { quiz: Quiz; onBack: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: qs = [] } = useQuery({
    queryKey: ["lms-quiz-q", quiz.id],
    queryFn: async () => {
      const { data } = await (supabase as any).from("lms_quiz_questions").select("*").eq("quiz_id", quiz.id).order("sort_order");
      return (data || []) as QuizQuestion[];
    },
  });
  const [draft, setDraft] = useState<Partial<QuizQuestion> | null>(null);
  const openNew = () => setDraft({
    prompt: "", question_type: "mcq",
    options: [{ id: "a", text: "" }, { id: "b", text: "" }, { id: "c", text: "" }, { id: "d", text: "" }],
    correct_answers: [], marks: 1, sort_order: qs.length,
  });
  const save = async () => {
    if (!draft?.prompt) return;
    const row = { ...draft, quiz_id: quiz.id };
    if (draft.id) await (supabase as any).from("lms_quiz_questions").update(row).eq("id", draft.id);
    else await (supabase as any).from("lms_quiz_questions").insert(row);
    setDraft(null); qc.invalidateQueries({ queryKey: ["lms-quiz-q", quiz.id] });
    toast({ title: "Saved" });
  };
  const del = async (id: string) => {
    if (!confirm("Delete question?")) return;
    await (supabase as any).from("lms_quiz_questions").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["lms-quiz-q", quiz.id] });
  };

  return (
    <div className="space-y-3">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" /> Back to quizzes</Button>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{quiz.title} · {qs.length} questions</h3>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Add question</Button>
      </div>
      {qs.map((q, i) => (
        <Card key={q.id}><CardContent className="p-3">
          <div className="flex items-start gap-2">
            <span className="text-xs text-muted-foreground">{i + 1}.</span>
            <div className="flex-1">
              <p className="text-sm font-medium">{q.prompt}</p>
              <p className="text-[10px] text-muted-foreground">{q.question_type} · {q.marks}m · correct: {q.correct_answers.join(", ")}</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setDraft(q)}><Pencil className="h-3 w-3" /></Button>
            <Button size="sm" variant="ghost" onClick={() => del(q.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
          </div>
        </CardContent></Card>
      ))}

      <Dialog open={!!draft} onOpenChange={o => !o && setDraft(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{draft?.id ? "Edit question" : "New question"}</DialogTitle></DialogHeader>
          {draft && (
            <div className="space-y-2">
              <div><Label>Prompt</Label><Textarea rows={2} value={draft.prompt || ""} onChange={e => setDraft({ ...draft, prompt: e.target.value })} /></div>
              <div>
                <Label>Type</Label>
                <Select value={draft.question_type || "mcq"} onValueChange={v => setDraft({ ...draft, question_type: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mcq">Single choice</SelectItem>
                    <SelectItem value="multi_select">Multi select</SelectItem>
                    <SelectItem value="true_false">True / False</SelectItem>
                    <SelectItem value="short_answer">Short answer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {draft.question_type !== "short_answer" && (
                <div className="space-y-1">
                  <Label>Options (tick correct)</Label>
                  {(draft.options || []).map((opt, idx) => (
                    <div key={opt.id} className="flex items-center gap-2">
                      <input type="checkbox" checked={(draft.correct_answers || []).includes(opt.id)}
                        onChange={e => {
                          const set = new Set(draft.correct_answers || []);
                          e.target.checked ? set.add(opt.id) : set.delete(opt.id);
                          setDraft({ ...draft, correct_answers: Array.from(set) });
                        }} />
                      <Input value={opt.text} onChange={e => {
                        const opts = [...(draft.options || [])];
                        opts[idx] = { ...opt, text: e.target.value };
                        setDraft({ ...draft, options: opts });
                      }} />
                    </div>
                  ))}
                  <Button size="sm" variant="outline" onClick={() => {
                    const opts = [...(draft.options || [])];
                    const id = String.fromCharCode(97 + opts.length);
                    opts.push({ id, text: "" });
                    setDraft({ ...draft, options: opts });
                  }}>Add option</Button>
                </div>
              )}
              {draft.question_type === "short_answer" && (
                <div><Label>Correct answer(s) — comma separated, case insensitive</Label>
                  <Input value={(draft.correct_answers || []).join(", ")} onChange={e => setDraft({ ...draft, correct_answers: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Marks</Label><Input type="number" value={draft.marks ?? 1} onChange={e => setDraft({ ...draft, marks: Number(e.target.value) })} /></div>
                <div><Label>Order</Label><Input type="number" value={draft.sort_order ?? qs.length} onChange={e => setDraft({ ...draft, sort_order: Number(e.target.value) })} /></div>
              </div>
              <div><Label>Explanation</Label><Textarea rows={2} value={draft.explanation || ""} onChange={e => setDraft({ ...draft, explanation: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ----------------------------- Assignments ----------------------------- */
function AssignmentsPanel({ courseId }: { courseId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: items = [] } = useQuery({
    queryKey: ["lms-admin-assignments", courseId],
    queryFn: async () => {
      const { data } = await (supabase as any).from("lms_assignments").select("*").eq("course_id", courseId).order("due_at", { nullsFirst: false });
      return (data || []) as Assignment[];
    },
  });
  const [draft, setDraft] = useState<Partial<Assignment> | null>(null);
  const save = async () => {
    if (!draft?.title) return;
    const row = { ...draft, course_id: courseId, max_marks: draft.max_marks ?? 100, allow_late: draft.allow_late ?? true };
    if (draft.id) await (supabase as any).from("lms_assignments").update(row).eq("id", draft.id);
    else await (supabase as any).from("lms_assignments").insert(row);
    setDraft(null); qc.invalidateQueries({ queryKey: ["lms-admin-assignments", courseId] });
    toast({ title: "Saved" });
  };
  const del = async (id: string) => {
    if (!confirm("Delete assignment?")) return;
    await (supabase as any).from("lms_assignments").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["lms-admin-assignments", courseId] });
  };
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><Button size="sm" onClick={() => setDraft({ title: "", max_marks: 100, allow_late: true })}><Plus className="h-4 w-4 mr-1" /> Add assignment</Button></div>
      {items.map(a => (
        <Card key={a.id}><CardContent className="p-3 flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" />
          <div className="flex-1">
            <p className="font-medium text-sm">{a.title}</p>
            <p className="text-[11px] text-muted-foreground">{a.due_at ? "Due " + new Date(a.due_at).toLocaleString() : "No due date"} · {a.max_marks}m</p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setDraft(a)}><Pencil className="h-3 w-3" /></Button>
          <Button size="sm" variant="ghost" onClick={() => del(a.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
        </CardContent></Card>
      ))}

      <Dialog open={!!draft} onOpenChange={o => !o && setDraft(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{draft?.id ? "Edit assignment" : "New assignment"}</DialogTitle></DialogHeader>
          {draft && (
            <div className="space-y-2">
              <div><Label>Title</Label><Input value={draft.title || ""} onChange={e => setDraft({ ...draft, title: e.target.value })} /></div>
              <div><Label>Instructions</Label><Textarea rows={5} value={draft.instructions_md || ""} onChange={e => setDraft({ ...draft, instructions_md: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Due (ISO)</Label><Input type="datetime-local" value={draft.due_at ? new Date(draft.due_at).toISOString().slice(0, 16) : ""} onChange={e => setDraft({ ...draft, due_at: e.target.value ? new Date(e.target.value).toISOString() : null })} /></div>
                <div><Label>Max marks</Label><Input type="number" value={draft.max_marks ?? 100} onChange={e => setDraft({ ...draft, max_marks: Number(e.target.value) })} /></div>
              </div>
              <div><Label>Attachment URL</Label><Input value={draft.attachment_url || ""} onChange={e => setDraft({ ...draft, attachment_url: e.target.value })} /></div>
              <div className="flex items-center gap-2"><Switch checked={draft.allow_late ?? true} onCheckedChange={v => setDraft({ ...draft, allow_late: v })} /><Label>Allow late</Label></div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ----------------------------- Live ----------------------------- */
function LivePanel({ courseId }: { courseId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: items = [] } = useQuery({
    queryKey: ["lms-admin-live", courseId],
    queryFn: async () => {
      const { data } = await (supabase as any).from("lms_live_sessions").select("*").eq("course_id", courseId).order("starts_at");
      return (data || []) as LiveSession[];
    },
  });
  const [draft, setDraft] = useState<Partial<LiveSession> | null>(null);
  const save = async () => {
    if (!draft?.title || !draft.starts_at) return;
    const row = { ...draft, course_id: courseId, duration_min: draft.duration_min ?? 60 };
    if (draft.id) await (supabase as any).from("lms_live_sessions").update(row).eq("id", draft.id);
    else await (supabase as any).from("lms_live_sessions").insert(row);
    setDraft(null); qc.invalidateQueries({ queryKey: ["lms-admin-live", courseId] });
    toast({ title: "Saved" });
  };
  const del = async (id: string) => {
    if (!confirm("Delete session?")) return;
    await (supabase as any).from("lms_live_sessions").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["lms-admin-live", courseId] });
  };
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><Button size="sm" onClick={() => setDraft({ title: "", duration_min: 60 })}><Plus className="h-4 w-4 mr-1" /> Schedule live</Button></div>
      {items.map(s => (
        <Card key={s.id}><CardContent className="p-3 flex items-center gap-2">
          <div className="flex-1">
            <p className="font-medium text-sm">{s.title}</p>
            <p className="text-[11px] text-muted-foreground">{new Date(s.starts_at).toLocaleString()} · {s.duration_min}m</p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setDraft(s)}><Pencil className="h-3 w-3" /></Button>
          <Button size="sm" variant="ghost" onClick={() => del(s.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
        </CardContent></Card>
      ))}
      <Dialog open={!!draft} onOpenChange={o => !o && setDraft(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{draft?.id ? "Edit session" : "New live session"}</DialogTitle></DialogHeader>
          {draft && (
            <div className="space-y-2">
              <div><Label>Title</Label><Input value={draft.title || ""} onChange={e => setDraft({ ...draft, title: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Starts at</Label><Input type="datetime-local" value={draft.starts_at ? new Date(draft.starts_at).toISOString().slice(0, 16) : ""} onChange={e => setDraft({ ...draft, starts_at: e.target.value ? new Date(e.target.value).toISOString() : undefined })} /></div>
                <div><Label>Duration (min)</Label><Input type="number" value={draft.duration_min ?? 60} onChange={e => setDraft({ ...draft, duration_min: Number(e.target.value) })} /></div>
              </div>
              <div><Label>Meeting URL (Zoom / Meet)</Label><Input value={draft.meeting_url || ""} onChange={e => setDraft({ ...draft, meeting_url: e.target.value })} /></div>
              <div><Label>Host name</Label><Input value={draft.host_name || ""} onChange={e => setDraft({ ...draft, host_name: e.target.value })} /></div>
              <div><Label>Recording URL (after)</Label><Input value={draft.recording_url || ""} onChange={e => setDraft({ ...draft, recording_url: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


