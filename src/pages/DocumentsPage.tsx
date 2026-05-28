import { useEffect, useMemo, useRef, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { exportLetterPDF, type Letterhead } from "@/lib/letter-pdf";
import { Download, Save, Loader2, FileText, Bold, Italic, List, ListOrdered, Heading2, AlignLeft, AlignCenter, AlignRight, Upload } from "lucide-react";

const TONES = ["Formal", "Official", "Friendly", "Strict", "Appreciative"];
const RECIPIENTS = [
  "Students", "Parents", "Teachers", "BOM/PTA", "Staff",
  "Ministry of Education", "TSC Office", "County Government", "NGO", "Sponsor",
  "Supplier/Contractor", "Bank", "Other School", "Community Leader", "Other",
];
const MERGE_FIELDS = ["student_name", "parent_name", "class", "balance", "school_name", "date"];

type DocRow = {
  id: string; title: string; recipient_type: string; recipient_name: string | null;
  tone: string; language: string; prompt: string | null; content: string; created_at: string;
};
type TemplateRow = {
  id: string; title: string; category: string; content: string; is_global: boolean; school_id: string | null;
};

export default function DocumentsPage() {
  const { schoolId, user } = useAuth();
  const [tab, setTab] = useState("new");
  const [letterhead, setLetterhead] = useState<Letterhead>({});
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [search, setSearch] = useState("");

  // editor state
  const editorRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState("");
  const [tone, setTone] = useState("Formal");
  const [language, setLanguage] = useState("en");
  const [recipientType, setRecipientType] = useState("Parents");
  const [recipientName, setRecipientName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [content, setContent] = useState("");

  const loadLetterhead = async () => {
    if (!schoolId) return;
    const { data } = await supabase.from("school_settings").select("key,value").eq("school_id", schoolId);
    const map: Record<string, string> = {};
    (data || []).forEach((r: any) => { map[r.key] = r.value; });
    setLetterhead({
      schoolName: map["school_name"] || "",
      motto: map["school_motto"] || "",
      address: map["school_address"] || "",
      phone: map["school_phone"] || "",
      email: map["school_email"] || "",
      website: map["school_website"] || "",
      logoUrl: map["school_logo_url"] || "",
      signatureUrl: map["principal_signature_url"] || "",
      stampUrl: map["school_stamp_url"] || "",
    });
  };

  const loadDocs = async () => {
    const { data } = await supabase.from("documents").select("*").order("created_at", { ascending: false }).limit(200);
    setDocs((data as DocRow[]) || []);
  };
  const loadTemplates = async () => {
    const { data } = await supabase.from("document_templates").select("*").order("created_at", { ascending: false });
    setTemplates((data as TemplateRow[]) || []);
  };

  useEffect(() => { loadLetterhead(); loadDocs(); loadTemplates(); }, [schoolId]);

  const setEditorHTML = (html: string) => {
    setContent(html);
    if (editorRef.current) editorRef.current.innerHTML = html;
  };

  const generate = async () => {
    if (!prompt.trim()) { toast({ title: "Enter a prompt first", variant: "destructive" }); return; }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-letter", {
        body: {
          prompt, tone, language, recipientType, recipientName,
          schoolContext: { name: letterhead.schoolName, motto: letterhead.motto, address: letterhead.address },
        },
      });
      if (error) throw error;
      const html = (data as any)?.html || "";
      setEditorHTML(html);
      if (!title) setTitle(prompt.slice(0, 60));
      toast({ title: "Letter generated" });
    } catch (e: any) {
      toast({ title: "Generation failed", description: e?.message || String(e), variant: "destructive" });
    } finally { setGenerating(false); }
  };

  const exec = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    if (editorRef.current) setContent(editorRef.current.innerHTML);
  };

  const insertMerge = (field: string) => exec("insertText", `{{${field}}}`);

  const applyMergeFields = (html: string) => html
    .split("{{school_name}}").join(letterhead.schoolName || "")
    .split("{{date}}").join(new Date().toLocaleDateString());

  const handleDownload = async () => {
    if (!content.trim()) { toast({ title: "Nothing to export", variant: "destructive" }); return; }
    await exportLetterPDF(applyMergeFields(content), letterhead, { title: title || "Letter" });
  };

  const handleSave = async () => {
    if (!schoolId || !user) return;
    if (!title.trim() || !content.trim()) { toast({ title: "Title and content required", variant: "destructive" }); return; }
    setSaving(true);
    const { error } = await supabase.from("documents").insert({
      school_id: schoolId, title, recipient_type: recipientType, recipient_name: recipientName,
      tone, language, prompt, content, created_by: user.id,
    });
    setSaving(false);
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Saved to history" });
    loadDocs();
  };

  const saveAsTemplate = async () => {
    if (!schoolId || !user) return;
    if (!title.trim() || !content.trim()) { toast({ title: "Title and content required", variant: "destructive" }); return; }
    const { error } = await supabase.from("document_templates").insert({
      school_id: schoolId, title, category: recipientType, content, is_global: false, created_by: user.id,
    });
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Template saved" });
    loadTemplates();
  };

  const uploadBranding = async (file: File, kind: "principal_signature_url" | "school_stamp_url") => {
    if (!schoolId) return;
    const ext = file.name.split(".").pop() || "png";
    const path = `${schoolId}/${kind === "principal_signature_url" ? "signature" : "stamp"}.${ext}`;
    const { error: upErr } = await supabase.storage.from("school-branding").upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) { toast({ title: "Upload failed", description: upErr.message, variant: "destructive" }); return; }
    const { data: signed } = await supabase.storage.from("school-branding").createSignedUrl(path, 60 * 60 * 24 * 365);
    const url = signed?.signedUrl || "";
    const { data: existing } = await supabase.from("school_settings").select("id").eq("school_id", schoolId).eq("key", kind).maybeSingle();
    if (existing?.id) await supabase.from("school_settings").update({ value: url }).eq("id", existing.id);
    else await supabase.from("school_settings").insert({ school_id: schoolId, key: kind, value: url });
    toast({ title: "Branding updated" });
    loadLetterhead();
  };

  const filteredDocs = useMemo(() => {
    const q = search.toLowerCase();
    return docs.filter(d =>
      !q || d.title.toLowerCase().includes(q) || (d.recipient_name || "").toLowerCase().includes(q) || d.recipient_type.toLowerCase().includes(q)
    );
  }, [docs, search]);

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Smart Document & Communication Center</h1>
            <p className="text-sm text-muted-foreground">Generate, edit and export professional branded letters.</p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="new">New Letter</TabsTrigger>
            <TabsTrigger value="templates">Templates ({templates.length})</TabsTrigger>
            <TabsTrigger value="history">History ({docs.length})</TabsTrigger>
            <TabsTrigger value="branding">Branding</TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="space-y-4">
            <div className="grid lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Compose</CardTitle>
                  <CardDescription>Describe the letter — AI will draft it for you.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label>Title</Label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Sponsorship Request to Safaricom" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Recipient Type</Label>
                      <Select value={recipientType} onValueChange={setRecipientType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{RECIPIENTS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Recipient Name</Label>
                      <Input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="e.g. Safaricom CSR Manager" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Tone</Label>
                      <Select value={tone} onValueChange={setTone}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{TONES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Language</Label>
                      <Select value={language} onValueChange={setLanguage}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="sw">Kiswahili</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Prompt</Label>
                    <Textarea rows={4} value={prompt} onChange={(e) => setPrompt(e.target.value)}
                      placeholder="e.g. Write a sponsorship request to Safaricom for ICT lab equipment for 60 learners" />
                  </div>
                  <Button onClick={generate} disabled={generating} className="w-full">
                    {generating ? <Loader2 className="animate-spin" /> : <Sparkles />} Generate Letter
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Editor & Preview</CardTitle>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={handleSave} disabled={saving}><Save className="h-4 w-4" /> Save</Button>
                      <Button size="sm" variant="outline" onClick={saveAsTemplate}>Save as Template</Button>
                      <Button size="sm" onClick={handleDownload}><Download className="h-4 w-4" /> PDF</Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex flex-wrap gap-1 border rounded-md p-1 bg-muted/30">
                    <Button size="icon" variant="ghost" onClick={() => exec("bold")}><Bold className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => exec("italic")}><Italic className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => exec("formatBlock", "<h2>")}><Heading2 className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => exec("insertUnorderedList")}><List className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => exec("insertOrderedList")}><ListOrdered className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => exec("justifyLeft")}><AlignLeft className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => exec("justifyCenter")}><AlignCenter className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => exec("justifyRight")}><AlignRight className="h-4 w-4" /></Button>
                    <Select onValueChange={insertMerge}>
                      <SelectTrigger className="h-8 w-[140px]"><SelectValue placeholder="Insert field" /></SelectTrigger>
                      <SelectContent>{MERGE_FIELDS.map(f => <SelectItem key={f} value={f}>{`{{${f}}}`}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="border rounded-md p-4 bg-background min-h-[400px]">
                    <LetterheadPreview lh={letterhead} />
                    <div
                      ref={editorRef}
                      contentEditable
                      suppressContentEditableWarning
                      onInput={(e) => setContent((e.target as HTMLDivElement).innerHTML)}
                      className="prose prose-sm max-w-none mt-3 outline-none min-h-[260px] [&_h2]:text-lg [&_h3]:text-base [&_p]:my-2"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="templates" className="space-y-3">
            {templates.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">No templates yet. Save a letter as a template to reuse it.</CardContent></Card>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {templates.map(t => (
                  <Card key={t.id} className="cursor-pointer hover:shadow-md transition" onClick={() => {
                    setTitle(t.title); setRecipientType(t.category); setEditorHTML(t.content); setTab("new");
                  }}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">{t.title}</CardTitle>
                        {t.is_global && <Badge variant="secondary">Global</Badge>}
                      </div>
                      <CardDescription>{t.category}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xs text-muted-foreground line-clamp-3" dangerouslySetInnerHTML={{ __html: t.content }} />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-3">
            <Input placeholder="Search by title, recipient…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="space-y-2">
              {filteredDocs.length === 0 ? (
                <Card><CardContent className="py-12 text-center text-muted-foreground">No documents yet.</CardContent></Card>
              ) : filteredDocs.map(d => (
                <Card key={d.id}>
                  <CardContent className="py-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{d.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {d.recipient_type}{d.recipient_name ? ` • ${d.recipient_name}` : ""} • {new Date(d.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => {
                        setTitle(d.title); setRecipientType(d.recipient_type); setRecipientName(d.recipient_name || "");
                        setTone(d.tone); setLanguage(d.language); setPrompt(d.prompt || ""); setEditorHTML(d.content); setTab("new");
                      }}>Open</Button>
                      <Button size="sm" onClick={() => exportLetterPDF(applyMergeFields(d.content), letterhead, { title: d.title })}>
                        <Download className="h-4 w-4" /> PDF
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="branding" className="space-y-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Digital Branding</CardTitle>
                <CardDescription>Upload principal signature and school stamp. Used on generated PDFs.</CardDescription>
              </CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-4">
                <BrandingUpload label="Principal Signature" url={letterhead.signatureUrl}
                  onUpload={(f) => uploadBranding(f, "principal_signature_url")} />
                <BrandingUpload label="School Stamp" url={letterhead.stampUrl}
                  onUpload={(f) => uploadBranding(f, "school_stamp_url")} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

function LetterheadPreview({ lh }: { lh: Letterhead }) {
  return (
    <div className="border-b pb-3 mb-2 text-center">
      {lh.logoUrl && <img src={lh.logoUrl} alt="School logo" className="h-12 mx-auto mb-1 object-contain" />}
      <div className="font-bold text-primary text-lg">{lh.schoolName || "Your School"}</div>
      {lh.motto && <div className="italic text-xs text-muted-foreground">"{lh.motto}"</div>}
      <div className="text-[10px] text-muted-foreground">
        {[lh.address, lh.phone, lh.email, lh.website].filter(Boolean).join(" • ")}
      </div>
    </div>
  );
}

function BrandingUpload({ label, url, onUpload }: { label: string; url?: string; onUpload: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="border rounded-md p-3 flex items-center gap-3">
        {url ? <img src={url} alt={label} className="h-16 object-contain" /> :
          <div className="h-16 w-24 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">None</div>}
        <div className="flex-1">
          <input ref={ref} type="file" accept="image/*" hidden
            onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
          <Button size="sm" variant="outline" onClick={() => ref.current?.click()}>
            <Upload className="h-4 w-4" /> Upload
          </Button>
        </div>
      </div>
    </div>
  );
}
