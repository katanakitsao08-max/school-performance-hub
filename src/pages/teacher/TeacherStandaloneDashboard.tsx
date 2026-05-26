import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Plus, LogOut, GraduationCap, Users } from "lucide-react";

export default function TeacherStandaloneDashboard() {
  const { user, signOut } = useAuth();
  const [klass, setKlass] = useState<any>(null);
  const [learners, setLearners] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", admission_number: "", gender: "Male", parent_name: "", parent_phone: "" });

  const load = async () => {
    if (!user) return;
    const { data: c } = await supabase.from("teacher_classes").select("*").eq("teacher_user_id", user.id).maybeSingle();
    setKlass(c);
    if (c) {
      const { data: ls } = await supabase.from("teacher_learners").select("*").eq("class_id", c.id).order("full_name");
      setLearners(ls || []);
    }
  };
  useEffect(() => { load(); }, [user]);

  const addLearner = async () => {
    if (!klass || !user) return;
    if (!form.full_name || !form.admission_number) { toast({ title: "Name and admission number required", variant: "destructive" }); return; }
    const { error } = await supabase.from("teacher_learners").insert({
      class_id: klass.id, teacher_user_id: user.id, ...form,
    });
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Learner added" });
    setForm({ full_name: "", admission_number: "", gender: "Male", parent_name: "", parent_phone: "" });
    setOpen(false); load();
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-primary" />
            <div>
              <div className="font-semibold">PerformTrack — Teacher</div>
              <div className="text-xs text-muted-foreground">{klass ? `${klass.class_name} ${klass.stream}` : "No class yet"}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!klass?.linked_school_id && <Badge variant="secondary">Pending School Onboarding</Badge>}
            <Button size="sm" variant="ghost" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4 space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <Card><CardHeader className="pb-2"><CardDescription>Learners</CardDescription><CardTitle className="text-3xl">{learners.length}</CardTitle></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardDescription>Class</CardDescription><CardTitle className="text-xl">{klass?.class_name || "—"}</CardTitle></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardDescription>Stream</CardDescription><CardTitle className="text-xl">{klass?.stream || "—"}</CardTitle></CardHeader></Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2"><Users className="h-5 w-5" /><CardTitle>Learners</CardTitle></div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Learner</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Learner</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Full Name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
                  <div><Label>Admission Number</Label><Input value={form.admission_number} onChange={(e) => setForm({ ...form, admission_number: e.target.value })} /></div>
                  <div><Label>Gender</Label>
                    <select className="w-full h-10 border rounded-md px-3 bg-background" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                      <option>Male</option><option>Female</option>
                    </select>
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
              <p className="text-sm text-muted-foreground text-center py-8">No learners yet. Click "Add Learner" to begin.</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Adm No</TableHead><TableHead>Name</TableHead><TableHead>Gender</TableHead><TableHead>Parent</TableHead></TableRow></TableHeader>
                <TableBody>
                  {learners.map((l, i) => (
                    <TableRow key={l.id}>
                      <TableCell>{i + 1}</TableCell><TableCell>{l.admission_number}</TableCell>
                      <TableCell>{l.full_name}</TableCell><TableCell>{l.gender}</TableCell>
                      <TableCell>{l.parent_name} {l.parent_phone && `(${l.parent_phone})`}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Coming next</CardTitle>
            <CardDescription>Attendance, CBC marks entry, and report generation will be unlocked here.</CardDescription>
          </CardHeader>
        </Card>
      </main>
    </div>
  );
}
