import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Plus, LogOut, GraduationCap, Users, ClipboardList, FileText, CalendarCheck, BookOpen, Download, Loader2, FileEdit, Library, Calendar as CalendarIcon, Activity } from "lucide-react";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import JSZip from "jszip";

type Klass = { id: string; class_name: string; stream: string; linked_school_id: string | null };
type Learner = { id: string; full_name: string; admission_number: string; gender: string; parent_name: string | null; parent_phone: string | null };
type Subject = { id: string; name: string; max_score: number; sort_order: number };
type Score = { id: string; learner_id: string; subject_id: string; term: number; year: number; exam_type: string; score: number; max_score: number };
type Attend = { id: string; learner_id: string; date: string; status: string };

const EXAM_TYPES = [
  { value: "opener", label: "Opener" },
  { value: "mid_term", label: "Mid Term" },
  { value: "end_term", label: "End Term" },
];

function gradeBand(pct: number, isJunior: boolean) {
  if (isJunior) {
    if (pct >= 90) return { letter: "EE1", remark: "Exceeding Expectation" };
    if (pct >= 75) return { letter: "EE2", remark: "Exceeding Expectation" };
    if (pct >= 60) return { letter: "ME1", remark: "Meeting Expectation" };
    if (pct >= 50) return { letter: "ME2", remark: "Meeting Expectation" };
    if (pct >= 40) return { letter: "AE1", remark: "Approaching Expectation" };
    if (pct >= 30) return { letter: "AE2", remark: "Approaching Expectation" };
    if (pct >= 20) return { letter: "BE1", remark: "Below Expectation" };
    return { letter: "BE2", remark: "Below Expectation" };
  }
  if (pct >= 76) return { letter: "EE", remark: "Exceeding Expectation" };
  if (pct >= 51) return { letter: "ME", remark: "Meeting Expectation" };
  if (pct >= 26) return { letter: "AE", remark: "Approaching Expectation" };
  return { letter: "BE", remark: "Below Expectation" };
}

export default function TeacherStandaloneDashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [klass, setKlass] = useState<Klass | null>(null);
  const [learners, setLearners] = useState<Learner[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [attendance, setAttendance] = useState<Attend[]>([]);
  const [openLearner, setOpenLearner] = useState(false);
  const [openSubject, setOpenSubject] = useState(false);
  const [form, setForm] = useState({ full_name: "", admission_number: "", gender: "Male", parent_name: "", parent_phone: "" });
  const [subjForm, setSubjForm] = useState({ name: "", max_score: 100 });

  // Marks entry filters
  const year = new Date().getFullYear();
  const [term, setTerm] = useState<number>(1);
  const [examType, setExamType] = useState("end_term");

  // Attendance date
  const [attDate, setAttDate] = useState<string>(new Date().toISOString().slice(0, 10));

  // Report busy
  const [busyReport, setBusyReport] = useState<string | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);

  const isJunior = useMemo(() => {
    const m = klass?.class_name?.match(/(\d+)/);
    const n = m ? parseInt(m[1], 10) : 0;
    return n >= 7;
  }, [klass]);

  const load = async () => {
    if (!user) return;
    const { data: c } = await supabase.from("teacher_classes").select("*").eq("teacher_user_id", user.id).maybeSingle();
    setKlass(c as Klass | null);
    if (!c) return;
    const [ls, ss, sc, at] = await Promise.all([
      supabase.from("teacher_learners").select("*").eq("class_id", c.id).eq("is_active", true).order("full_name"),
      supabase.from("teacher_subjects").select("*").eq("class_id", c.id).eq("is_active", true).order("sort_order").order("name"),
      supabase.from("teacher_scores").select("*").eq("class_id", c.id),
      supabase.from("teacher_attendance").select("*").eq("class_id", c.id),
    ]);
    setLearners((ls.data || []) as Learner[]);
    setSubjects((ss.data || []) as Subject[]);
    setScores((sc.data || []) as Score[]);
    setAttendance((at.data || []) as Attend[]);
  };
  useEffect(() => { load(); }, [user]);

  const addLearner = async () => {
    if (!klass || !user) return;
    if (!form.full_name || !form.admission_number) { toast({ title: "Name and admission number required", variant: "destructive" }); return; }
    const { error } = await supabase.from("teacher_learners").insert({ class_id: klass.id, teacher_user_id: user.id, ...form });
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Learner added" });
    setForm({ full_name: "", admission_number: "", gender: "Male", parent_name: "", parent_phone: "" });
    setOpenLearner(false); load();
  };

  const addSubject = async () => {
    if (!klass || !user) return;
    if (!subjForm.name) { toast({ title: "Subject name required", variant: "destructive" }); return; }
    const { error } = await supabase.from("teacher_subjects").insert({
      class_id: klass.id, teacher_user_id: user.id, name: subjForm.name, max_score: subjForm.max_score, sort_order: subjects.length,
    });
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Subject added" });
    setSubjForm({ name: "", max_score: 100 });
    setOpenSubject(false); load();
  };

  // Scores grid
  const scoreFor = (learnerId: string, subjectId: string) =>
    scores.find(s => s.learner_id === learnerId && s.subject_id === subjectId && s.term === term && s.year === year && s.exam_type === examType);

  const saveScore = async (learner: Learner, subject: Subject, raw: string) => {
    if (!user || !klass) return;
    const val = raw.trim() === "" ? null : Math.max(0, Math.min(subject.max_score, Number(raw)));
    const existing = scoreFor(learner.id, subject.id);
    if (val === null) {
      if (existing) {
        await supabase.from("teacher_scores").delete().eq("id", existing.id);
        setScores(scores.filter(s => s.id !== existing.id));
      }
      return;
    }
    if (existing) {
      const { error } = await supabase.from("teacher_scores").update({ score: val, max_score: subject.max_score }).eq("id", existing.id);
      if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
      setScores(scores.map(s => s.id === existing.id ? { ...s, score: val } : s));
    } else {
      const { data, error } = await supabase.from("teacher_scores").insert({
        class_id: klass.id, learner_id: learner.id, subject_id: subject.id, teacher_user_id: user.id,
        term, year, exam_type: examType, score: val, max_score: subject.max_score,
      }).select().single();
      if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
      setScores([...scores, data as Score]);
    }
  };

  // Attendance
  const attFor = (learnerId: string) => attendance.find(a => a.learner_id === learnerId && a.date === attDate);
  const setAtt = async (learner: Learner, status: string) => {
    if (!user || !klass) return;
    const existing = attFor(learner.id);
    if (existing) {
      await supabase.from("teacher_attendance").update({ status }).eq("id", existing.id);
      setAttendance(attendance.map(a => a.id === existing.id ? { ...a, status } : a));
    } else {
      const { data } = await supabase.from("teacher_attendance").insert({
        class_id: klass.id, learner_id: learner.id, teacher_user_id: user.id, date: attDate, status,
      }).select().single();
      if (data) setAttendance([...attendance, data as Attend]);
    }
  };

  const bulkMarkPresent = async () => {
    if (!user || !klass) return;
    const missing = learners.filter(l => !attFor(l.id));
    if (missing.length === 0) { toast({ title: "All already marked" }); return; }
    const rows = missing.map(l => ({ class_id: klass.id, learner_id: l.id, teacher_user_id: user.id, date: attDate, status: "present" }));
    const { data } = await supabase.from("teacher_attendance").insert(rows).select();
    if (data) setAttendance([...attendance, ...(data as Attend[])]);
    toast({ title: `Marked ${missing.length} present` });
  };

  // PDF report
  const buildReport = (learner: Learner): jsPDF => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    doc.setFontSize(16); doc.setFont("helvetica", "bold");
    doc.text("PerformTrack Report Card", W / 2, 50, { align: "center" });
    doc.setFontSize(10); doc.setFont("helvetica", "normal");
    doc.text(`Class: ${klass?.class_name} ${klass?.stream}`, 40, 80);
    doc.text(`Term ${term}, ${year} — ${EXAM_TYPES.find(e => e.value === examType)?.label}`, 40, 96);
    doc.text(`Name: ${learner.full_name}`, 40, 116);
    doc.text(`Adm No: ${learner.admission_number}`, 40, 132);
    doc.text(`Gender: ${learner.gender}`, 300, 132);

    const rows = subjects.map(sub => {
      const s = scores.find(x => x.learner_id === learner.id && x.subject_id === sub.id && x.term === term && x.year === year && x.exam_type === examType);
      if (!s) return [sub.name, "—", sub.max_score, "—", "Not assessed"];
      const pct = (Number(s.score) / sub.max_score) * 100;
      const g = gradeBand(pct, isJunior);
      return [sub.name, Number(s.score).toFixed(0), sub.max_score, g.letter, g.remark];
    });

    autoTable(doc, {
      startY: 160,
      head: [["Subject", "Score", "Out of", "Grade", "Remark"]],
      body: rows,
      theme: "grid",
      headStyles: { fillColor: [36, 116, 60] },
      styles: { fontSize: 10 },
    });

    // Summary
    const assessed = subjects.map(sub => scores.find(x => x.learner_id === learner.id && x.subject_id === sub.id && x.term === term && x.year === year && x.exam_type === examType)).filter(Boolean) as Score[];
    if (assessed.length) {
      const totalPct = assessed.reduce((acc, s) => acc + (Number(s.score) / s.max_score) * 100, 0) / assessed.length;
      const g = gradeBand(totalPct, isJunior);
      const y = (doc as any).lastAutoTable.finalY + 20;
      doc.setFont("helvetica", "bold");
      doc.text(`Mean Score: ${totalPct.toFixed(1)}%   Grade: ${g.letter} (${g.remark})`, 40, y);
    }

    // Attendance summary
    const att = attendance.filter(a => a.learner_id === learner.id);
    if (att.length) {
      const present = att.filter(a => a.status === "present").length;
      const yy = (doc as any).lastAutoTable.finalY + 40;
      doc.setFont("helvetica", "normal");
      doc.text(`Attendance: ${present}/${att.length} days present (${((present / att.length) * 100).toFixed(0)}%)`, 40, yy);
    }

    doc.setFontSize(9); doc.setTextColor(120);
    doc.text("Generated by PerformTrack — Teacher Portal", W / 2, doc.internal.pageSize.getHeight() - 30, { align: "center" });
    return doc;
  };

  const downloadOne = async (learner: Learner) => {
    if (subjects.length === 0) { toast({ title: "Add subjects first", variant: "destructive" }); return; }
    setBusyReport(learner.id);
    try {
      const doc = buildReport(learner);
      doc.save(`${learner.admission_number}-${learner.full_name.replace(/\s+/g, "_")}.pdf`);
    } finally { setBusyReport(null); }
  };

  const downloadBatch = async () => {
    if (subjects.length === 0) { toast({ title: "Add subjects first", variant: "destructive" }); return; }
    if (learners.length === 0) return;
    setBatchBusy(true);
    try {
      const zip = new JSZip();
      for (const l of learners) {
        const doc = buildReport(l);
        const blob = doc.output("blob");
        zip.file(`${l.admission_number}-${l.full_name.replace(/\s+/g, "_")}.pdf`, blob);
      }
      const out = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(out);
      const a = document.createElement("a");
      a.href = url; a.download = `${klass?.class_name}-${klass?.stream}-T${term}-${examType}.zip`;
      a.click(); URL.revokeObjectURL(url);
      toast({ title: `Generated ${learners.length} report cards` });
    } finally { setBatchBusy(false); }
  };

  const stats = useMemo(() => {
    const todays = attendance.filter(a => a.date === attDate);
    const present = todays.filter(a => a.status === "present").length;
    return { todays: todays.length, present };
  }, [attendance, attDate]);

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <GraduationCap className="h-6 w-6 text-primary shrink-0" />
            <div className="min-w-0">
              <div className="font-semibold truncate">PerformTrack — Teacher</div>
              <div className="text-xs text-muted-foreground truncate">{klass ? `${klass.class_name} ${klass.stream}` : "No class yet"}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {klass && !klass.linked_school_id && <Badge variant="secondary" className="hidden sm:inline-flex">Pending School Onboarding</Badge>}
            <Button size="sm" variant="ghost" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4 space-y-4 pb-24">
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <Card><CardHeader className="pb-2"><CardDescription>Learners</CardDescription><CardTitle className="text-2xl">{learners.length}</CardTitle></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardDescription>Subjects</CardDescription><CardTitle className="text-2xl">{subjects.length}</CardTitle></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardDescription>Today Present</CardDescription><CardTitle className="text-2xl">{stats.present}/{learners.length}</CardTitle></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardDescription>Grade</CardDescription><CardTitle className="text-xl">{klass?.class_name || "—"}</CardTitle></CardHeader></Card>
        </div>

        <Tabs defaultValue="roster">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="roster"><Users className="h-4 w-4 mr-1 hidden sm:inline" />Roster</TabsTrigger>
            <TabsTrigger value="attendance"><CalendarCheck className="h-4 w-4 mr-1 hidden sm:inline" />Attendance</TabsTrigger>
            <TabsTrigger value="subjects"><BookOpen className="h-4 w-4 mr-1 hidden sm:inline" />Subjects</TabsTrigger>
            <TabsTrigger value="marks"><ClipboardList className="h-4 w-4 mr-1 hidden sm:inline" />Marks</TabsTrigger>
            <TabsTrigger value="reports"><FileText className="h-4 w-4 mr-1 hidden sm:inline" />Reports</TabsTrigger>
          </TabsList>

          {/* ROSTER */}
          <TabsContent value="roster">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Learners</CardTitle>
                <Dialog open={openLearner} onOpenChange={setOpenLearner}>
                  <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Add Learner</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div><Label>Full Name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
                      <div><Label>Admission Number</Label><Input value={form.admission_number} onChange={(e) => setForm({ ...form, admission_number: e.target.value })} /></div>
                      <div><Label>Gender</Label>
                        <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem></SelectContent>
                        </Select>
                      </div>
                      <div><Label>Parent Name</Label><Input value={form.parent_name} onChange={(e) => setForm({ ...form, parent_name: e.target.value })} /></div>
                      <div><Label>Parent Phone</Label><Input value={form.parent_phone} onChange={(e) => setForm({ ...form, parent_phone: e.target.value })} /></div>
                      <Button onClick={addLearner} className="w-full">Save</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {learners.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No learners yet. Click "Add" to begin.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Adm</TableHead><TableHead>Name</TableHead><TableHead>Gender</TableHead><TableHead>Parent</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {learners.map((l, i) => (
                          <TableRow key={l.id}>
                            <TableCell>{i + 1}</TableCell>
                            <TableCell>{l.admission_number}</TableCell>
                            <TableCell className="font-medium">{l.full_name}</TableCell>
                            <TableCell>{l.gender}</TableCell>
                            <TableCell className="text-xs">{l.parent_name} {l.parent_phone && `(${l.parent_phone})`}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ATTENDANCE */}
          <TabsContent value="attendance">
            <Card>
              <CardHeader>
                <CardTitle>Daily Attendance</CardTitle>
                <CardDescription>Tap status next to each learner. Bulk-mark to set all present.</CardDescription>
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <Input type="date" value={attDate} onChange={(e) => setAttDate(e.target.value)} className="w-auto" />
                  <Button size="sm" variant="outline" onClick={bulkMarkPresent}>Mark all present</Button>
                </div>
              </CardHeader>
              <CardContent>
                {learners.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Add learners first.</p> : (
                  <div className="space-y-2">
                    {learners.map(l => {
                      const a = attFor(l.id);
                      return (
                        <div key={l.id} className="flex items-center justify-between gap-2 border rounded-lg p-2">
                          <div className="min-w-0">
                            <div className="font-medium truncate">{l.full_name}</div>
                            <div className="text-xs text-muted-foreground">{l.admission_number}</div>
                          </div>
                          <div className="flex gap-1">
                            {["present", "absent", "late"].map(s => (
                              <Button key={s} size="sm" variant={a?.status === s ? "default" : "outline"} onClick={() => setAtt(l, s)} className="capitalize text-xs h-8">{s}</Button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* SUBJECTS */}
          <TabsContent value="subjects">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Subjects</CardTitle>
                <Dialog open={openSubject} onOpenChange={setOpenSubject}>
                  <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Add Subject</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div><Label>Name</Label><Input value={subjForm.name} onChange={(e) => setSubjForm({ ...subjForm, name: e.target.value })} placeholder="e.g. Mathematics" /></div>
                      <div><Label>Max Score</Label><Input type="number" value={subjForm.max_score} onChange={(e) => setSubjForm({ ...subjForm, max_score: parseInt(e.target.value || "100", 10) })} /></div>
                      <Button onClick={addSubject} className="w-full">Save</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {subjects.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No subjects yet.</p> : (
                  <div className="space-y-2">
                    {subjects.map(s => (
                      <div key={s.id} className="flex items-center justify-between border rounded p-2">
                        <span className="font-medium">{s.name}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">Out of {s.max_score}</Badge>
                          <Button size="sm" variant="ghost" onClick={async () => {
                            await supabase.from("teacher_subjects").update({ is_active: false }).eq("id", s.id);
                            load();
                          }}>Remove</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* MARKS */}
          <TabsContent value="marks">
            <Card>
              <CardHeader>
                <CardTitle>Marks Entry</CardTitle>
                <CardDescription>Tap a cell, type the score, and it autosaves. Leave blank to clear.</CardDescription>
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <Select value={String(term)} onValueChange={(v) => setTerm(parseInt(v, 10))}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>{[1, 2, 3].map(t => <SelectItem key={t} value={String(t)}>Term {t}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={examType} onValueChange={setExamType}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>{EXAM_TYPES.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <Badge variant="outline">{year}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {learners.length === 0 || subjects.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">{learners.length === 0 ? "Add learners" : "Add subjects"} first.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="sticky left-0 bg-background min-w-[140px]">Learner</TableHead>
                          {subjects.map(s => <TableHead key={s.id} className="text-center min-w-[80px]">{s.name}<div className="text-[10px] text-muted-foreground">/{s.max_score}</div></TableHead>)}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {learners.map(l => (
                          <TableRow key={l.id}>
                            <TableCell className="sticky left-0 bg-background font-medium text-xs">
                              <div className="truncate max-w-[140px]">{l.full_name}</div>
                              <div className="text-[10px] text-muted-foreground">{l.admission_number}</div>
                            </TableCell>
                            {subjects.map(sub => {
                              const sc = scoreFor(l.id, sub.id);
                              return (
                                <TableCell key={sub.id} className="p-1">
                                  <Input
                                    type="number"
                                    defaultValue={sc?.score ?? ""}
                                    min={0}
                                    max={sub.max_score}
                                    onBlur={(e) => saveScore(l, sub, e.target.value)}
                                    className="w-16 h-8 text-center"
                                  />
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* REPORTS */}
          <TabsContent value="reports">
            <Card>
              <CardHeader>
                <CardTitle>Report Cards</CardTitle>
                <CardDescription>Generate per-learner or batch PDFs for the selected term and exam.</CardDescription>
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <Select value={String(term)} onValueChange={(v) => setTerm(parseInt(v, 10))}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>{[1, 2, 3].map(t => <SelectItem key={t} value={String(t)}>Term {t}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={examType} onValueChange={setExamType}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>{EXAM_TYPES.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button size="sm" onClick={downloadBatch} disabled={batchBusy || learners.length === 0}>
                    {batchBusy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
                    Batch ZIP
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {learners.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Add learners first.</p> : (
                  <div className="space-y-2">
                    {learners.map(l => (
                      <div key={l.id} className="flex items-center justify-between border rounded p-2">
                        <div>
                          <div className="font-medium text-sm">{l.full_name}</div>
                          <div className="text-xs text-muted-foreground">{l.admission_number}</div>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => downloadOne(l)} disabled={busyReport === l.id}>
                          {busyReport === l.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {klass && !klass.linked_school_id && (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-base">When your school joins PerformTrack</CardTitle>
              <CardDescription>Your learners, marks, and attendance will migrate into the school account automatically. Keep entering data — nothing is lost.</CardDescription>
            </CardHeader>
          </Card>
        )}
      </main>
    </div>
  );
}
