import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Smartphone, LogOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const PAY_TO = "0701594268";

export default function IndependentSubscribe() {
  const navigate = useNavigate();
  const { user, role, loading, signOut } = useAuth();
  const [learnerId, setLearnerId] = useState<string | null>(null);
  const [latestStatus, setLatestStatus] = useState<string | null>(null);
  const [hasActive, setHasActive] = useState(false);
  const [weeks, setWeeks] = useState("1");
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate("/learn/login", { replace: true }); return; }
    if (role && role !== "independent_learner") { navigate("/", { replace: true }); return; }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, role]);

  const load = async () => {
    if (!user) return;
    await supabase.rpc("expire_old_independent_subscriptions");
    const [{ data: learner }, { data: subs }] = await Promise.all([
      supabase.from("independent_learners").select("id, parent_phone").eq("user_id", user.id).maybeSingle(),
      supabase.from("independent_subscriptions").select("status, expires_at").eq("user_id", user.id).order("submitted_at", { ascending: false }).limit(1),
    ]);
    if (learner) {
      setLearnerId(learner.id);
      setPhone(learner.parent_phone || "");
    }
    const top = subs?.[0];
    setLatestStatus(top?.status ?? null);
    setHasActive(!!(top && top.status === "active" && (!top.expires_at || new Date(top.expires_at) > new Date())));
    if (top && top.status === "active") {
      navigate("/learn", { replace: true });
    } else if (top && top.status === "pending") {
      navigate("/learn/pending", { replace: true });
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!learnerId || !user) return;
    if (!code.trim()) { toast.error("Enter the M-Pesa confirmation code."); return; }
    setBusy(true);
    try {
      const w = Math.max(1, parseInt(weeks, 10) || 1);
      const { error } = await supabase.from("independent_subscriptions").insert({
        learner_id: learnerId,
        user_id: user.id,
        status: "pending",
        amount: w * 10,
        weeks: w,
        paid_to: PAY_TO,
        mpesa_code: code.trim().toUpperCase(),
        mpesa_phone: phone,
      });
      if (error) throw error;
      toast.success("Payment submitted. A super admin will approve shortly.");
      navigate("/learn/pending", { replace: true });
    } catch (e: any) {
      toast.error(e?.message || "Could not submit payment");
    } finally {
      setBusy(false);
    }
  };

  const w = Math.max(1, parseInt(weeks, 10) || 1);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg shadow-xl border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle>Activate Learning Access</CardTitle>
                <CardDescription>KES 10 per week — M-Pesa to {PAY_TO}</CardDescription>
              </div>
            </div>
            {latestStatus && <Badge variant="outline" className="capitalize">{latestStatus}</Badge>}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-1">
            <p><strong>1.</strong> Open M-Pesa → Lipa na M-Pesa → Send Money</p>
            <p><strong>2.</strong> Send <strong>KES {w * 10}</strong> to <strong>{PAY_TO}</strong></p>
            <p><strong>3.</strong> Paste the confirmation code below</p>
          </div>

          <form onSubmit={submit} className="space-y-3">
            <div>
              <Label>Number of weeks</Label>
              <Select value={weeks} onValueChange={setWeeks}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1,2,3,4,8,12].map(n => <SelectItem key={n} value={String(n)}>{n} week{n>1?"s":""} — KES {n*10}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>M-Pesa confirmation code</Label>
              <Input value={code} onChange={e => setCode(e.target.value)} placeholder="e.g. SHX1A2B3C4" required />
            </div>
            <div>
              <Label>Phone used for payment</Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="07XXXXXXXX" />
            </div>
            <Button type="submit" className="w-full" disabled={busy || !learnerId}>
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Submit for approval
            </Button>
          </form>

          <Button variant="ghost" size="sm" className="w-full" onClick={() => signOut().then(() => navigate("/learn/login"))}>
            <LogOut className="w-4 h-4 mr-2" /> Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
