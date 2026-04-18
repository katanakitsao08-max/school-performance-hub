import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, BookOpen, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { findActiveCurriculumDesign, type DbCurriculumDesign } from "@/lib/curriculum-db";

interface Lookup { grade: string; subject: string; term: number; }

export default function CurriculumLibraryPage() {
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState<Lookup[]>([]);
  const [grade, setGrade] = useState("");
  const [subject, setSubject] = useState("");
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState("");
  const [design, setDesign] = useState<DbCurriculumDesign | null>(null);
  const [loadingDesign, setLoadingDesign] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("curriculum_designs")
        .select("grade, subject, term")
        .eq("status", "active");
      setAvailable((data ?? []) as Lookup[]);
      setLoading(false);
    })();
  }, []);

  const grades = useMemo(() => Array.from(new Set(available.map((a) => a.grade))).sort(), [available]);
  const subjects = useMemo(
    () => Array.from(new Set(available.filter((a) => !grade || a.grade === grade).map((a) => a.subject))).sort(),
    [available, grade],
  );
  const terms = useMemo(
    () => Array.from(new Set(available
      .filter((a) => (!grade || a.grade === grade) && (!subject || a.subject === subject))
      .map((a) => a.term))).sort(),
    [available, grade, subject],
  );

  useEffect(() => {
    if (!grade || !subject || !term) { setDesign(null); return; }
    setLoadingDesign(true);
    findActiveCurriculumDesign(grade, subject, term).then((d) => {
      setDesign(d);
      setLoadingDesign(false);
    });
  }, [grade, subject, term]);

  const filteredStrands = useMemo(() => {
    if (!design) return [];
    if (!search.trim()) return design.strands;
    const q = search.toLowerCase();
    return design.strands
      .map((s) => ({
        ...s,
        subStrands: s.subStrands.filter(
          (ss) =>
            ss.name.toLowerCase().includes(q) ||
            ss.slos.some((x) => x.toLowerCase().includes(q)) ||
            ss.activities.some((x) => x.toLowerCase().includes(q)),
        ),
      }))
      .filter((s) => s.name.toLowerCase().includes(q) || s.subStrands.length > 0);
  }, [design, search]);

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in pb-20">
        <div>
          <h1 className="text-2xl font-bold font-display flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" /> Curriculum Library
          </h1>
          <p className="text-sm text-muted-foreground">Browse the official KICD CBC designs currently active for your school.</p>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />Loading…
          </div>
        ) : available.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
            No active curriculum has been published yet. Please check back soon.
          </CardContent></Card>
        ) : (
          <>
            <Card>
              <CardContent className="p-4 grid md:grid-cols-4 gap-3">
                <Select value={grade} onValueChange={(v) => { setGrade(v); setSubject(""); setTerm(""); }}>
                  <SelectTrigger><SelectValue placeholder="Grade" /></SelectTrigger>
                  <SelectContent>{grades.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={subject} onValueChange={(v) => { setSubject(v); setTerm(""); }} disabled={!grade}>
                  <SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
                  <SelectContent>{subjects.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={term} onValueChange={setTerm} disabled={!subject}>
                  <SelectTrigger><SelectValue placeholder="Term" /></SelectTrigger>
                  <SelectContent>{terms.map((t) => <SelectItem key={t} value={String(t)}>Term {t}</SelectItem>)}</SelectContent>
                </Select>
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-8" placeholder="Search strands / SLOs…" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
              </CardContent>
            </Card>

            {loadingDesign ? (
              <div className="p-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
            ) : design ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    {design.grade} · {design.subject} · Term {design.term}
                    <Badge variant="outline">v{design.version}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {filteredStrands.length === 0 && (
                    <p className="text-sm text-muted-foreground">No matches for "{search}"</p>
                  )}
                  {filteredStrands.map((s) => (
                    <div key={s.id} className="border-l-4 border-primary pl-3">
                      <h3 className="font-semibold text-sm">{s.name}</h3>
                      <div className="space-y-2 mt-1">
                        {s.subStrands.map((ss) => (
                          <div key={ss.id} className="bg-muted/40 rounded-md p-2 text-xs">
                            <div className="font-medium">
                              {ss.name} <span className="text-muted-foreground">· {ss.lessonAllocation} lesson{ss.lessonAllocation > 1 ? "s" : ""}</span>
                            </div>
                            {ss.slos.length > 0 && (
                              <div className="mt-1">
                                <div className="text-muted-foreground">Specific Learning Outcomes:</div>
                                <ul className="list-disc ml-5">
                                  {ss.slos.map((x, i) => <li key={i}>{x}</li>)}
                                </ul>
                              </div>
                            )}
                            {ss.activities.length > 0 && (
                              <div className="mt-1">
                                <div className="text-muted-foreground">Suggested Activities:</div>
                                <ul className="list-disc ml-5">
                                  {ss.activities.map((x, i) => <li key={i}>{x}</li>)}
                                </ul>
                              </div>
                            )}
                            {ss.assessmentMethods.length > 0 && (
                              <div className="mt-1">
                                <div className="text-muted-foreground">Assessment:</div>
                                <div>{ss.assessmentMethods.join(", ")}</div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : (
              <Card><CardContent className="p-6 text-sm text-muted-foreground text-center">Select grade, subject and term.</CardContent></Card>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
