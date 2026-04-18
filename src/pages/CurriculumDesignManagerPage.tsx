import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Upload, FileText, Trash2, CheckCircle2, Eye, Plus, X, RefreshCw, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type Status = "draft" | "review" | "approved" | "active" | "archived";
interface DesignRow {
  id: string;
  grade: string;
  subject: string;
  term: number;
  version: number;
  status: Status;
  source: "manual" | "ai_pdf";
  title: string | null;
  created_at: string;
}

interface ExtractedSubStrand {
  name: string;
  lesson_allocation?: number;
  slos?: string[];
  activities?: string[];
  assessment_methods?: string[];
  inquiry_questions?: string[];
  resources?: string[];
  competencies?: string[];
  values?: string[];
  pcis?: string[];
}
interface ExtractedDesign {
  grade: string;
  subject: string;
  term: number;
  title?: string;
  strands: { name: string; sub_strands: ExtractedSubStrand[] }[];
}

const STATUS_COLORS: Record<Status, string> = {
  draft: "bg-muted text-muted-foreground",
  review: "bg-amber-500/15 text-amber-600",
  approved: "bg-blue-500/15 text-blue-600",
  active: "bg-primary/15 text-primary",
  archived: "bg-muted text-muted-foreground line-through",
};

export default function CurriculumDesignManagerPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<DesignRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterGrade, setFilterGrade] = useState("all");
  const [filterStatus, setFilterStatus] = useState<"all" | Status>("all");

  // AI extraction state
  const [pdfText, setPdfText] = useState("");
  const [hintGrade, setHintGrade] = useState("");
  const [hintSubject, setHintSubject] = useState("");
  const [hintTerm, setHintTerm] = useState<string>("");
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedDesign | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);

  // Manual entry state
  const [manual, setManual] = useState<ExtractedDesign>({
    grade: "", subject: "", term: 1, title: "", strands: [],
  });
  const [savingManual, setSavingManual] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("curriculum_designs")
      .select("id, grade, subject, term, version, status, source, title, created_at")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data ?? []) as DesignRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => rows.filter((r) =>
    (filterGrade === "all" || r.grade === filterGrade) &&
    (filterStatus === "all" || r.status === filterStatus)
  ), [rows, filterGrade, filterStatus]);

  const grades = useMemo(() => Array.from(new Set(rows.map((r) => r.grade))).sort(), [rows]);

  // ---- AI PDF extraction ----
  const handleExtract = async () => {
    if (pdfText.trim().length < 50) {
      toast.error("Paste at least 50 chars of curriculum text from the PDF.");
      return;
    }
    setExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke("extract-curriculum-pdf", {
        body: {
          pdfText,
          hintGrade: hintGrade || undefined,
          hintSubject: hintSubject || undefined,
          hintTerm: hintTerm ? parseInt(hintTerm, 10) : undefined,
        },
      });
      if (error) throw error;
      if (!data?.design) throw new Error("AI did not return a design");
      setExtracted(data.design as ExtractedDesign);
      toast.success("Curriculum extracted — review then save as draft.");
    } catch (e: any) {
      toast.error(e?.message ?? "Extraction failed");
    } finally {
      setExtracting(false);
    }
  };

  const persistDesign = async (design: ExtractedDesign, source: "ai_pdf" | "manual") => {
    if (!user) throw new Error("Not signed in");
    const { grade, subject, term, title, strands } = design;
    if (!grade || !subject || !term || !strands?.length) {
      throw new Error("Missing grade, subject, term or strands");
    }
    // Determine next version
    const { data: existing } = await supabase
      .from("curriculum_designs")
      .select("version")
      .eq("grade", grade).ilike("subject", subject).eq("term", term)
      .order("version", { ascending: false }).limit(1);
    const nextVersion = (existing?.[0]?.version ?? 0) + 1;

    const { data: insertedDesign, error: insErr } = await supabase
      .from("curriculum_designs")
      .insert({
        grade, subject, term, version: nextVersion,
        status: "draft", source,
        title: title || `${subject} — ${grade} Term ${term} v${nextVersion}`,
        created_by: user.id,
      })
      .select("id").single();
    if (insErr || !insertedDesign) throw insErr ?? new Error("Insert failed");

    for (let si = 0; si < strands.length; si++) {
      const s = strands[si];
      const { data: strandRow, error: sErr } = await supabase
        .from("curriculum_strands")
        .insert({ design_id: insertedDesign.id, name: s.name, sort_order: si })
        .select("id").single();
      if (sErr || !strandRow) throw sErr ?? new Error("Strand insert failed");

      const subRows = (s.sub_strands ?? []).map((ss, ix) => ({
        strand_id: strandRow.id,
        name: ss.name,
        sort_order: ix,
        lesson_allocation: ss.lesson_allocation ?? 1,
        slos: ss.slos ?? [],
        activities: ss.activities ?? [],
        assessment_methods: ss.assessment_methods ?? [],
        inquiry_questions: ss.inquiry_questions ?? [],
        resources: ss.resources ?? [],
        competencies: ss.competencies ?? [],
        values: ss.values ?? [],
        pcis: ss.pcis ?? [],
      }));
      if (subRows.length) {
        const { error: ssErr } = await supabase.from("curriculum_sub_strands").insert(subRows);
        if (ssErr) throw ssErr;
      }
    }
    return insertedDesign.id;
  };

  const handleSaveDraft = async () => {
    if (!extracted) return;
    setSavingDraft(true);
    try {
      await persistDesign(extracted, "ai_pdf");
      toast.success("Draft saved. Move to Approved → Active when ready.");
      setExtracted(null);
      setPdfText("");
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed");
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSaveManual = async () => {
    if (!manual.grade || !manual.subject || !manual.term || manual.strands.length === 0) {
      toast.error("Fill grade, subject, term and add at least one strand.");
      return;
    }
    setSavingManual(true);
    try {
      await persistDesign(manual, "manual");
      toast.success("Manual curriculum saved as draft.");
      setManual({ grade: "", subject: "", term: 1, title: "", strands: [] });
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed");
    } finally {
      setSavingManual(false);
    }
  };

  const updateStatus = async (id: string, status: Status) => {
    const patch: any = { status };
    if (status === "approved" || status === "active") {
      patch.approved_by = user?.id;
      patch.approved_at = new Date().toISOString();
    }
    const { error } = await supabase.from("curriculum_designs").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(`Set to ${status}`); load(); }
  };

  const deleteDesign = async (id: string) => {
    if (!confirm("Delete this curriculum version permanently?")) return;
    const { error } = await supabase.from("curriculum_designs").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); load(); }
  };

  // ---- Manual builder helpers ----
  const addStrand = () => setManual((m) => ({ ...m, strands: [...m.strands, { name: "", sub_strands: [] }] }));
  const addSubStrand = (si: number) => setManual((m) => {
    const next = structuredClone(m);
    next.strands[si].sub_strands.push({ name: "", lesson_allocation: 1, slos: [], activities: [], assessment_methods: [] });
    return next;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in pb-20">
        <div>
          <h1 className="text-2xl font-bold font-display">Curriculum Design Manager</h1>
          <p className="text-sm text-muted-foreground">Superadmin-only. Upload, version, and approve KICD CBC curriculum designs.</p>
        </div>

        <Tabs defaultValue="library">
          <TabsList>
            <TabsTrigger value="library">Library</TabsTrigger>
            <TabsTrigger value="ai"><Sparkles className="h-4 w-4 mr-1" />AI from PDF</TabsTrigger>
            <TabsTrigger value="manual">Manual entry</TabsTrigger>
          </TabsList>

          {/* ---------------- LIBRARY ---------------- */}
          <TabsContent value="library" className="space-y-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <Label className="text-xs">Grade</Label>
                <Select value={filterGrade} onValueChange={setFilterGrade}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All grades</SelectItem>
                    {grades.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="sm" onClick={load}>
                <RefreshCw className="h-4 w-4 mr-1" />Refresh
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />Loading…
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">No curriculum designs yet.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Grade</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Term</TableHead>
                        <TableHead>Version</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>{r.grade}</TableCell>
                          <TableCell>{r.subject}</TableCell>
                          <TableCell>T{r.term}</TableCell>
                          <TableCell>v{r.version}</TableCell>
                          <TableCell><Badge className={STATUS_COLORS[r.status]}>{r.status}</Badge></TableCell>
                          <TableCell className="text-xs">{r.source === "ai_pdf" ? "AI · PDF" : "Manual"}</TableCell>
                          <TableCell className="text-right space-x-1">
                            {r.status === "draft" && (
                              <Button size="sm" variant="outline" onClick={() => updateStatus(r.id, "review")}>To Review</Button>
                            )}
                            {r.status === "review" && (
                              <Button size="sm" variant="outline" onClick={() => updateStatus(r.id, "approved")}>Approve</Button>
                            )}
                            {(r.status === "approved" || r.status === "archived") && (
                              <Button size="sm" onClick={() => updateStatus(r.id, "active")}>
                                <CheckCircle2 className="h-3 w-3 mr-1" />Set Active
                              </Button>
                            )}
                            {r.status === "active" && (
                              <Button size="sm" variant="outline" onClick={() => updateStatus(r.id, "archived")}>Archive</Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => deleteDesign(r.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ---------------- AI PDF ---------------- */}
          <TabsContent value="ai" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Auto-seed from KICD PDF</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Open the KICD curriculum PDF, copy ALL the text (Ctrl+A → Ctrl+C inside Acrobat / Preview)
                  and paste it below. The AI will identify Grade, Subject, Term, Strands, Sub-strands, SLOs and activities.
                  After review, save it as a Draft and approve when correct.
                </p>
                <div className="grid md:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Grade hint (optional)</Label>
                    <Input value={hintGrade} onChange={(e) => setHintGrade(e.target.value)} placeholder="e.g. Grade 3" />
                  </div>
                  <div>
                    <Label className="text-xs">Subject hint (optional)</Label>
                    <Input value={hintSubject} onChange={(e) => setHintSubject(e.target.value)} placeholder="e.g. Mathematics" />
                  </div>
                  <div>
                    <Label className="text-xs">Term hint (optional)</Label>
                    <Select value={hintTerm} onValueChange={setHintTerm}>
                      <SelectTrigger><SelectValue placeholder="Auto-detect" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Term 1</SelectItem>
                        <SelectItem value="2">Term 2</SelectItem>
                        <SelectItem value="3">Term 3</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">PDF text</Label>
                  <Textarea
                    rows={10}
                    value={pdfText}
                    onChange={(e) => setPdfText(e.target.value)}
                    placeholder="Paste full extracted PDF text here…"
                  />
                </div>
                <Button onClick={handleExtract} disabled={extracting}>
                  {extracting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  Extract with AI
                </Button>
              </CardContent>
            </Card>

            {extracted && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Eye className="h-4 w-4" /> Review extracted design
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm">
                    <strong>{extracted.grade}</strong> · {extracted.subject} · Term {extracted.term}
                    {extracted.title ? <span className="text-muted-foreground"> — {extracted.title}</span> : null}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {extracted.strands.length} strand(s),{" "}
                    {extracted.strands.reduce((n, s) => n + (s.sub_strands?.length ?? 0), 0)} sub-strand(s)
                  </div>
                  <div className="max-h-80 overflow-auto border rounded-md p-3 space-y-2 text-xs">
                    {extracted.strands.map((s, i) => (
                      <div key={i}>
                        <div className="font-semibold">▸ {s.name}</div>
                        <ul className="ml-4 list-disc">
                          {s.sub_strands?.map((ss, j) => (
                            <li key={j}>
                              {ss.name} <span className="text-muted-foreground">({ss.lesson_allocation ?? 1} lesson{(ss.lesson_allocation ?? 1) > 1 ? "s" : ""}, {ss.slos?.length ?? 0} SLOs)</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSaveDraft} disabled={savingDraft}>
                      {savingDraft ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
                      Save as Draft (new version)
                    </Button>
                    <Button variant="ghost" onClick={() => setExtracted(null)}>
                      <X className="h-4 w-4 mr-1" />Discard
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ---------------- MANUAL ---------------- */}
          <TabsContent value="manual" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Manual curriculum entry</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid md:grid-cols-4 gap-3">
                  <Input placeholder="Grade (e.g. Grade 3)" value={manual.grade}
                    onChange={(e) => setManual({ ...manual, grade: e.target.value })} />
                  <Input placeholder="Subject" value={manual.subject}
                    onChange={(e) => setManual({ ...manual, subject: e.target.value })} />
                  <Select value={String(manual.term)} onValueChange={(v) => setManual({ ...manual, term: parseInt(v, 10) })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Term 1</SelectItem>
                      <SelectItem value="2">Term 2</SelectItem>
                      <SelectItem value="3">Term 3</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input placeholder="Title (optional)" value={manual.title ?? ""}
                    onChange={(e) => setManual({ ...manual, title: e.target.value })} />
                </div>

                {manual.strands.map((s, si) => (
                  <Card key={si} className="bg-muted/30">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex gap-2 items-center">
                        <Input placeholder={`Strand ${si + 1} name`} value={s.name}
                          onChange={(e) => {
                            const next = structuredClone(manual);
                            next.strands[si].name = e.target.value;
                            setManual(next);
                          }} />
                        <Button size="sm" variant="ghost" onClick={() => {
                          const next = structuredClone(manual);
                          next.strands.splice(si, 1);
                          setManual(next);
                        }}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                      {s.sub_strands.map((ss, ssi) => (
                        <div key={ssi} className="ml-4 grid md:grid-cols-2 gap-2 border-l-2 border-primary/30 pl-3">
                          <Input placeholder={`Sub-strand ${ssi + 1}`} value={ss.name}
                            onChange={(e) => {
                              const next = structuredClone(manual);
                              next.strands[si].sub_strands[ssi].name = e.target.value;
                              setManual(next);
                            }} />
                          <Input type="number" min={1} placeholder="Lessons" value={ss.lesson_allocation ?? 1}
                            onChange={(e) => {
                              const next = structuredClone(manual);
                              next.strands[si].sub_strands[ssi].lesson_allocation = parseInt(e.target.value || "1", 10);
                              setManual(next);
                            }} />
                          <Textarea className="md:col-span-2" rows={2}
                            placeholder="Specific Learning Outcomes (one per line)"
                            value={(ss.slos ?? []).join("\n")}
                            onChange={(e) => {
                              const next = structuredClone(manual);
                              next.strands[si].sub_strands[ssi].slos = e.target.value.split("\n").map((x) => x.trim()).filter(Boolean);
                              setManual(next);
                            }} />
                          <Textarea rows={2} placeholder="Suggested activities (one per line)"
                            value={(ss.activities ?? []).join("\n")}
                            onChange={(e) => {
                              const next = structuredClone(manual);
                              next.strands[si].sub_strands[ssi].activities = e.target.value.split("\n").map((x) => x.trim()).filter(Boolean);
                              setManual(next);
                            }} />
                          <Textarea rows={2} placeholder="Assessment methods (one per line)"
                            value={(ss.assessment_methods ?? []).join("\n")}
                            onChange={(e) => {
                              const next = structuredClone(manual);
                              next.strands[si].sub_strands[ssi].assessment_methods = e.target.value.split("\n").map((x) => x.trim()).filter(Boolean);
                              setManual(next);
                            }} />
                        </div>
                      ))}
                      <Button size="sm" variant="outline" onClick={() => addSubStrand(si)}>
                        <Plus className="h-4 w-4 mr-1" />Add sub-strand
                      </Button>
                    </CardContent>
                  </Card>
                ))}

                <Button variant="outline" onClick={addStrand}>
                  <Plus className="h-4 w-4 mr-1" />Add strand
                </Button>

                <div>
                  <Button onClick={handleSaveManual} disabled={savingManual}>
                    {savingManual ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
                    Save as Draft
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
