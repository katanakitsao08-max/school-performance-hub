import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, GraduationCap } from "lucide-react";

function normalizePhone(raw: string): string {
  const d = String(raw || "").replace(/\D/g, "");
  if (d.startsWith("254")) return d;
  if (d.startsWith("0") && d.length === 10) return "254" + d.slice(1);
  if (d.length === 9) return "254" + d;
  return d;
}

export default function IndependentLogin() {
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user && role === "independent_learner") navigate("/learn", { replace: true });
  }, [loading, user, role, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const email = `${normalizePhone(phone)}@learner.local`;
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate("/learn", { replace: true });
    } catch (e: any) {
      toast.error(e?.message || "Invalid phone or password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl border-primary/20">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <GraduationCap className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Learning Portal</CardTitle>
          <CardDescription>Independent learner login</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <Label>Phone number</Label>
              <Input type="tel" placeholder="07XXXXXXXX" value={phone} onChange={e => setPhone(e.target.value)} required />
            </div>
            <div>
              <Label>Password</Label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Log in
            </Button>
            <p className="text-center text-sm text-muted-foreground pt-2">
              New here? <Link to="/learn/signup" className="text-primary font-medium">Register as Independent Learner</Link>
            </p>
            <p className="text-center text-xs text-muted-foreground">
              School learner? <Link to="/login" className="underline">Use the school login</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
