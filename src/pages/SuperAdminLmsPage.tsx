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
import { Plus, Trash2, ArrowLeft, BookOpen, Pencil, GripVertical, ClipboardList, Award, FileCheck2 } from "lucide-react";
import { Course, Module, Lesson, Quiz, QuizQuestion, Assignment, LiveSession, slugify } from "@/features/lms/api";
import { SortableList, persistOrder } from "@/features/lms/Sortable";

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
        <Tabs defaultValue="courses">
          <TabsList>
            <TabsTrigger value="courses">Courses</TabsTrigger>
            <TabsTrigger value="badges">Badges</TabsTrigger>
          </TabsList>
          <TabsContent value="courses"><CoursesPanel /></TabsContent>
          <TabsContent value="badges"><BadgesPanel /></TabsContent>
        </Tabs>
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
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="structure">Curriculum</TabsTrigger>
          <TabsTrigger value="quizzes">Quizzes</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="submissions">Grading</TabsTrigger>
          <TabsTrigger value="live">Live</TabsTrigger>
        </TabsList>
        <TabsContent value="structure"><ModulesPanel courseId={course.id} /></TabsContent>
        <TabsContent value="quizzes"><QuizzesPanel courseId={course.id} /></TabsContent>
        <TabsContent value="assignments"><AssignmentsPanel courseId={course.id} /></TabsContent>
        <TabsContent value="submissions"><SubmissionsPanel courseId={course.id} /></TabsContent>
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

  const onReorder = async (next: Module[]) => {
    qc.setQueryData(["lms-admin-modules", courseId], next);
    await persistOrder("lms_modules", next.map(m => m.id));
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end"><Button size="sm" onClick={() => setMDraft({ title: "" })}><Plus className="h-4 w-4 mr-1" /> Add module</Button></div>
      <SortableList<Module>
        items={modules}
        onReorder={onReorder}
        render={(m, handle) => (
          <Card className="mb-3">
            <CardHeader className="pb-1">
              <div className="flex items-center gap-2">
                {handle}
                <CardTitle className="text-sm flex-1">{m.title}</CardTitle>
                <Button size="sm" variant="ghost" onClick={() => setMDraft(m)}><Pencil className="h-3 w-3" /></Button>
                <Button size="sm" variant="ghost" onClick={() => delM(m.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <LessonsList moduleId={m.id} />
            </CardContent>
          </Card>
        )}
      />
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

  const onReorder = async (next: Lesson[]) => {
    qc.setQueryData(["lms-admin-lessons", moduleId], next);
    await persistOrder("lms_lessons", next.map(l => l.id));
  };

  return (
    <div className="space-y-1">
      <SortableList<Lesson>
        items={lessons}
        onReorder={onReorder}
        render={(l, handle) => (
          <div className="flex items-center gap-2 p-2 border rounded mb-1">
            {handle}
            <Badge variant="outline" className="text-[10px]">{l.kind}</Badge>
            <span className="flex-1 text-sm">{l.title}</span>
            {l.is_free && <Badge className="text-[9px]">free</Badge>}
            <Button size="sm" variant="ghost" onClick={() => setDraft(l)}><Pencil className="h-3 w-3" /></Button>
            <Button size="sm" variant="ghost" onClick={() => del(l.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
          </div>
        )}
      />
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

/* ----------------------------- Submissions / Grading ----------------------------- */
function SubmissionsPanel({ courseId }: { courseId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: assignments = [] } = useQuery({
    queryKey: ["lms-admin-assignments-grade", courseId],
    queryFn: async () => {
      const { data } = await (supabase as any).from("lms_assignments").select("id, title, max_marks").eq("course_id", courseId);
      return (data || []) as Array<{ id: string; title: string; max_marks: number }>;
    },
  });
  const assignmentIds = assignments.map(a => a.id);
  const { data: subs = [] } = useQuery({
    queryKey: ["lms-admin-subs", courseId, assignmentIds.join(",")],
    queryFn: async () => {
      if (!assignmentIds.length) return [];
      const { data } = await (supabase as any).from("lms_assignment_submissions")
        .select("*").in("assignment_id", assignmentIds).order("submitted_at", { ascending: false });
      return data || [];
    },
    enabled: assignmentIds.length > 0,
  });

  const [grading, setGrading] = useState<any | null>(null);
  const [score, setScore] = useState<string>("");
  const [feedback, setFeedback] = useState("");

  const openGrade = (s: any) => {
    setGrading(s); setScore(s.score?.toString() ?? ""); setFeedback(s.feedback ?? "");
  };
  const saveGrade = async () => {
    if (!grading) return;
    const { error } = await (supabase as any).from("lms_assignment_submissions").update({
      score: score === "" ? null : Number(score),
      feedback,
      graded_at: new Date().toISOString(),
    }).eq("id", grading.id);
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Graded" });
    setGrading(null);
    qc.invalidateQueries({ queryKey: ["lms-admin-subs", courseId] });
  };

  const aMap = new Map(assignments.map(a => [a.id, a]));
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">All submissions for this course. Click <em>Grade</em> to score &amp; leave feedback.</p>
      {subs.length === 0 && <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">No submissions yet.</CardContent></Card>}
      {subs.map((s: any) => {
        const a = aMap.get(s.assignment_id);
        return (
          <Card key={s.id}><CardContent className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <FileCheck2 className="h-4 w-4 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{a?.title || "Assignment"}</p>
                <p className="text-[11px] text-muted-foreground">
                  Learner {s.learner_ref?.slice(0, 8)} · {s.submitted_at ? new Date(s.submitted_at).toLocaleString() : "—"}
                </p>
              </div>
              {s.score != null
                ? <Badge className="bg-green-600">{s.score} / {a?.max_marks ?? 100}</Badge>
                : <Badge variant="outline">Pending</Badge>}
              <Button size="sm" variant="outline" onClick={() => openGrade(s)}>{s.score != null ? "Edit" : "Grade"}</Button>
            </div>
            {s.text_answer && <div className="text-xs bg-muted/40 rounded p-2 whitespace-pre-wrap">{s.text_answer}</div>}
            {s.file_url && <a href={s.file_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">Attached file</a>}
            {s.feedback && <p className="text-xs"><span className="font-semibold">Feedback:</span> {s.feedback}</p>}
          </CardContent></Card>
        );
      })}

      <Dialog open={!!grading} onOpenChange={o => !o && setGrading(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Grade submission</DialogTitle></DialogHeader>
          {grading && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{aMap.get(grading.assignment_id)?.title}</p>
              {grading.text_answer && <div className="text-xs bg-muted/40 rounded p-2 whitespace-pre-wrap max-h-40 overflow-y-auto">{grading.text_answer}</div>}
              <div>
                <Label>Score (out of {aMap.get(grading.assignment_id)?.max_marks ?? 100})</Label>
                <Input type="number" value={score} onChange={e => setScore(e.target.value)} />
              </div>
              <div>
                <Label>Feedback</Label>
                <Textarea rows={3} value={feedback} onChange={e => setFeedback(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setGrading(null)}>Cancel</Button><Button onClick={saveGrade}>Save grade</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ----------------------------- Badges (global) ----------------------------- */
type BadgeRow = { id: string; code: string; name: string; description: string | null; icon: string | null; rule_json: any };

function BadgesPanel() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: badges = [] } = useQuery({
    queryKey: ["lms-admin-badges"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("lms_badges").select("*").order("code");
      return (data || []) as BadgeRow[];
    },
  });
  const [draft, setDraft] = useState<Partial<BadgeRow> & { ruleType?: string; ruleCount?: number; ruleCourseId?: string } | null>(null);

  const openNew = () => setDraft({ code: "", name: "", icon: "🏅", description: "", ruleType: "lessons_completed", ruleCount: 5 });
  const openEdit = (b: BadgeRow) => {
    const r = b.rule_json || {};
    setDraft({ ...b, ruleType: r.type || "lessons_completed", ruleCount: r.count || 1, ruleCourseId: r.course_id || "" });
  };
  const save = async () => {
    if (!draft?.code || !draft.name) { toast({ title: "Code and name required", variant: "destructive" }); return; }
    const rule_json: any = { type: draft.ruleType };
    if (["lessons_completed", "quizzes_passed", "streak_days"].includes(draft.ruleType || "")) rule_json.count = Number(draft.ruleCount || 1);
    if (draft.ruleType === "course_completed" && draft.ruleCourseId) rule_json.course_id = draft.ruleCourseId;
    const row = {
      code: draft.code, name: draft.name, description: draft.description || null, icon: draft.icon || "🏅", rule_json,
    };
    if (draft.id) await (supabase as any).from("lms_badges").update(row).eq("id", draft.id);
    else await (supabase as any).from("lms_badges").insert(row);
    setDraft(null); qc.invalidateQueries({ queryKey: ["lms-admin-badges"] });
    toast({ title: "Saved" });
  };
  const del = async (id: string) => {
    if (!confirm("Delete badge?")) return;
    await (supabase as any).from("lms_badges").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["lms-admin-badges"] });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold">Badges ({badges.length})</h2>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> New badge</Button>
      </div>
      <p className="text-xs text-muted-foreground">Awarded automatically when a learner completes a lesson or passes a quiz.</p>
      <div className="grid sm:grid-cols-2 gap-2">
        {badges.map(b => (
          <Card key={b.id}><CardContent className="p-3 flex items-center gap-2">
            <span className="text-2xl">{b.icon || "🏅"}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{b.name} <span className="text-[10px] text-muted-foreground">({b.code})</span></p>
              <p className="text-[11px] text-muted-foreground truncate">{b.rule_json?.type} · {b.rule_json?.count || b.rule_json?.course_id || "—"}</p>
              {b.description && <p className="text-[11px] text-muted-foreground line-clamp-1">{b.description}</p>}
            </div>
            <Button size="sm" variant="ghost" onClick={() => openEdit(b)}><Pencil className="h-3 w-3" /></Button>
            <Button size="sm" variant="ghost" onClick={() => del(b.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
          </CardContent></Card>
        ))}
        {badges.length === 0 && <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">No badges yet.</CardContent></Card>}
      </div>

      <Dialog open={!!draft} onOpenChange={o => !o && setDraft(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{draft?.id ? "Edit badge" : "New badge"}</DialogTitle></DialogHeader>
          {draft && (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <div><Label>Icon</Label><Input value={draft.icon || ""} onChange={e => setDraft({ ...draft, icon: e.target.value })} placeholder="🏅" /></div>
                <div className="col-span-2"><Label>Code</Label><Input value={draft.code || ""} onChange={e => setDraft({ ...draft, code: e.target.value })} placeholder="unique-code" /></div>
              </div>
              <div><Label>Name</Label><Input value={draft.name || ""} onChange={e => setDraft({ ...draft, name: e.target.value })} /></div>
              <div><Label>Description</Label><Textarea rows={2} value={draft.description || ""} onChange={e => setDraft({ ...draft, description: e.target.value })} /></div>
              <div>
                <Label>Award rule</Label>
                <Select value={draft.ruleType} onValueChange={v => setDraft({ ...draft, ruleType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lessons_completed">After N lessons completed</SelectItem>
                    <SelectItem value="quizzes_passed">After N quizzes passed</SelectItem>
                    <SelectItem value="perfect_quiz">When any quiz is 100%</SelectItem>
                    <SelectItem value="course_completed">When a course certificate is issued</SelectItem>
                    <SelectItem value="streak_days">N-day learning streak</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {["lessons_completed", "quizzes_passed", "streak_days"].includes(draft.ruleType || "") && (
                <div><Label>Count</Label><Input type="number" value={draft.ruleCount ?? 1} onChange={e => setDraft({ ...draft, ruleCount: Number(e.target.value) })} /></div>
              )}
              {draft.ruleType === "course_completed" && (
                <div><Label>Specific course ID (optional)</Label><Input value={draft.ruleCourseId || ""} onChange={e => setDraft({ ...draft, ruleCourseId: e.target.value })} placeholder="any course if blank" /></div>
              )}
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

