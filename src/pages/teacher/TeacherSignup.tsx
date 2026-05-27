import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { GraduationCap, Loader2 } from "lucide-react";

export default function TeacherSignup() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: "", phone: "", email: "", tsc_number: "",
    school_name: "", county: "", class_name: "", stream: "A",
    password: "", confirm: "",
  });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const phoneClean = form.phone.replace(/\s+/g, "");
    if (!/^\+?[0-9]{9,15}$/.test(phoneClean)) {
      toast({ title: "Invalid phone number", description: "Use 9–15 digits, optional +", variant: "destructive" });
      return;
    }
    if (form.password.length < 8) { toast({ title: "Password too short", description: "Use at least 8 characters", variant: "destructive" }); return; }
    if (form.password !== form.confirm) { toast({ title: "Passwords do not match", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("teacher-register", { body: form });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      // sign in immediately so they land on /teacher/pending
      const { error: signErr } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
      if (signErr) throw signErr;
      toast({ title: "Registration submitted", description: "Awaiting approval." });
      navigate("/teacher/pending", { replace: true });
    } catch (err: any) {
      toast({ title: "Registration failed", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 grid place-items-center mb-2">
            <GraduationCap className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Teacher Registration</CardTitle>
          <CardDescription>Register and manage your class — even before your school onboards PerformTrack.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2"><Label>Full Name *</Label><Input required value={form.full_name} onChange={set("full_name")} /></div>
            <div><Label>Phone Number *</Label><Input required value={form.phone} onChange={set("phone")} placeholder="07..." /></div>
            <div><Label>Email *</Label><Input required type="email" value={form.email} onChange={set("email")} /></div>
            <div><Label>TSC / National ID</Label><Input value={form.tsc_number} onChange={set("tsc_number")} /></div>
            <div><Label>County *</Label><Input required value={form.county} onChange={set("county")} /></div>
            <div className="md:col-span-2"><Label>School Name *</Label><Input required value={form.school_name} onChange={set("school_name")} /></div>
            <div><Label>Class / Grade *</Label><Input required value={form.class_name} onChange={set("class_name")} placeholder="e.g. Grade 4" /></div>
            <div><Label>Stream</Label><Input value={form.stream} onChange={set("stream")} placeholder="A" /></div>
            <div><Label>Password *</Label><Input required type="password" value={form.password} onChange={set("password")} /></div>
            <div><Label>Confirm Password *</Label><Input required type="password" value={form.confirm} onChange={set("confirm")} /></div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={loading} className="w-full">
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Create Account
              </Button>
            </div>
            <p className="md:col-span-2 text-center text-sm text-muted-foreground">
              Already have an account? <Link to="/login" className="text-primary underline">Sign in</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
