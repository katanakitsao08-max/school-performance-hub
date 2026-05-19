import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";

const GRADES = ["PP1","PP2","Grade 1","Grade 2","Grade 3","Grade 4","Grade 5","Grade 6","Grade 7","Grade 8","Grade 9","Grade 10","Grade 11","Grade 12"];
const COUNTIES = ["Mombasa","Kwale","Kilifi","Tana River","Lamu","Taita Taveta","Garissa","Wajir","Mandera","Marsabit","Isiolo","Meru","Tharaka Nithi","Embu","Kitui","Machakos","Makueni","Nyandarua","Nyeri","Kirinyaga","Murang'a","Kiambu","Turkana","West Pokot","Samburu","Trans Nzoia","Uasin Gishu","Elgeyo Marakwet","Nandi","Baringo","Laikipia","Nakuru","Narok","Kajiado","Kericho","Bomet","Kakamega","Vihiga","Bungoma","Busia","Siaya","Kisumu","Homa Bay","Migori","Kisii","Nyamira","Nairobi"];

export default function IndependentSignup() {
  const navigate = useNavigate();
  const { user, role, loading: authLoading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    full_name: "", parent_name: "", parent_phone: "", grade: "", county: "", password: "",
  });

  useEffect(() => {
    if (!authLoading && user && role === "independent_learner") navigate("/learn", { replace: true });
  }, [authLoading, user, role, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.grade || !form.county) {
      toast.error("Please pick your grade and county.");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("independent-learner-signup", { body: form });
      if (error || !data?.success) {
        throw new Error((data as any)?.error || error?.message || "Signup failed");
      }
      const { error: loginErr } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: form.password,
      });
      if (loginErr) throw loginErr;
      toast.success(`Welcome! Your learner code is ${data.learner_code}`);
      navigate("/learn/subscribe", { replace: true });
    } catch (e: any) {
      toast.error(e?.message || "Could not create account");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl border-primary/20">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Sparkles className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Join the Learning Portal</CardTitle>
          <CardDescription>Independent learner — KES 10 per week, CBC-aligned content.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <Label>Learner name</Label>
              <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} required />
            </div>
            <div>
              <Label>Parent / guardian name</Label>
              <Input value={form.parent_name} onChange={e => setForm(f => ({ ...f, parent_name: e.target.value }))} required />
            </div>
            <div>
              <Label>Phone (used to log in)</Label>
              <Input type="tel" placeholder="07XXXXXXXX" value={form.parent_phone}
                onChange={e => setForm(f => ({ ...f, parent_phone: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Grade</Label>
                <Select value={form.grade} onValueChange={v => setForm(f => ({ ...f, grade: v }))}>
                  <SelectTrigger><SelectValue placeholder="Pick" /></SelectTrigger>
                  <SelectContent>{GRADES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>County</Label>
                <Select value={form.county} onValueChange={v => setForm(f => ({ ...f, county: v }))}>
                  <SelectTrigger><SelectValue placeholder="Pick" /></SelectTrigger>
                  <SelectContent className="max-h-64">{COUNTIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Password</Label>
              <Input type="password" minLength={6} value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create account
            </Button>
            <p className="text-center text-sm text-muted-foreground pt-2">
              Already registered? <Link to="/learn/login" className="text-primary font-medium">Log in</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
