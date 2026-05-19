import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, XCircle, PauseCircle, PlayCircle, Loader2 } from "lucide-react";

type Sub = {
  id: string;
  learner_id: string;
  user_id: string;
  status: string;
  amount: number;
  weeks: number;
  mpesa_code: string | null;
  mpesa_phone: string | null;
  submitted_at: string;
  activated_at: string | null;
  expires_at: string | null;
  rejection_reason: string | null;
  notes: string | null;
  learner?: {
    learner_code: string;
    full_name: string;
    parent_name: string;
    parent_phone: string;
    grade: string;
    county: string;
  };
};

export default function IndependentLearnersAdmin() {
  const navigate = useNavigate();
  const { role, loading } = useAuth();
  const [subs, setSubs] = useState<Sub[]>([]);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState<Sub | null>(null);
  const [rejReason, setRejReason] = useState("");
  const [extending, setExtending] = useState<Sub | null>(null);
  const [extWeeks, setExtWeeks] = useState("1");

  useEffect(() => {
    if (!loading && role !== "super_admin") navigate("/", { replace: true });
  }, [loading, role, navigate]);

  const load = async () => {
    setBusy(true);
    try {
      await supabase.rpc("expire_old_independent_subscriptions");
      const { data: subRows } = await supabase
        .from("independent_subscriptions")
        .select("*")
        .order("submitted_at", { ascending: false })
        .limit(500);
      const ids = Array.from(new Set((subRows || []).map(s => s.learner_id)));
      let learnersMap = new Map<string, any>();
      if (ids.length) {
        const { data: learners } = await supabase
          .from("independent_learners")
          .select("id, learner_code, full_name, parent_name, parent_phone, grade, county")
          .in("id", ids);
        learnersMap = new Map((learners || []).map(l => [l.id, l]));
      }
      setSubs((subRows || []).map(s => ({ ...s, learner: learnersMap.get(s.learner_id) })) as Sub[]);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { if (role === "super_admin") load(); }, [role]);

  const approve = async (s: Sub) => {
    const now = new Date();
    const exp = new Date(now.getTime() + s.weeks * 7 * 24 * 3600 * 1000);
    const { error } = await supabase
      .from("independent_subscriptions")
      .update({ status: "active", activated_at: now.toISOString(), expires_at: exp.toISOString(), rejection_reason: null })
      .eq("id", s.id);
    if (error) toast.error(error.message); else { toast.success("Approved"); load(); }
  };

  const reject = async () => {
    if (!rejecting) return;
    const { error } = await supabase
      .from("independent_subscriptions")
      .update({ status: "rejected", rejection_reason: rejReason || "Payment could not be verified" })
      .eq("id", rejecting.id);
    if (error) toast.error(error.message);
    else { toast.success("Rejected"); setRejecting(null); setRejReason(""); load(); }
  };

  const suspend = async (s: Sub) => {
    const { error } = await supabase.from("independent_subscriptions").update({ status: "suspended" }).eq("id", s.id);
    if (error) toast.error(error.message); else { toast.success("Suspended"); load(); }
  };

  const reactivate = async (s: Sub) => {
    const { error } = await supabase.from("independent_subscriptions").update({ status: "active" }).eq("id", s.id);
    if (error) toast.error(error.message); else { toast.success("Reactivated"); load(); }
  };

  const extend = async () => {
    if (!extending) return;
    const w = Math.max(1, parseInt(extWeeks, 10) || 1);
    const base = extending.expires_at && new Date(extending.expires_at) > new Date()
      ? new Date(extending.expires_at)
      : new Date();
    const next = new Date(base.getTime() + w * 7 * 24 * 3600 * 1000);
    const { error } = await supabase
      .from("independent_subscriptions")
      .update({ status: "active", expires_at: next.toISOString(), activated_at: extending.activated_at || new Date().toISOString() })
      .eq("id", extending.id);
    if (error) toast.error(error.message);
    else { toast.success(`Extended by ${w} week${w>1?"s":""}`); setExtending(null); setExtWeeks("1"); load(); }
  };

  const pending = subs.filter(s => s.status === "pending");
  const active = subs.filter(s => s.status === "active");
  const others = subs.filter(s => !["pending","active"].includes(s.status));

  const renderTable = (rows: Sub[], allowActions: "pending" | "active" | "other") => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Learner</TableHead>
          <TableHead>Phone</TableHead>
          <TableHead>Grade</TableHead>
          <TableHead>M-Pesa</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Submitted</TableHead>
          <TableHead>Expires</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 && (
          <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No records</TableCell></TableRow>
        )}
        {rows.map(s => (
          <TableRow key={s.id}>
            <TableCell>
              <div className="font-medium">{s.learner?.full_name || "—"}</div>
              <div className="text-xs text-muted-foreground font-mono">{s.learner?.learner_code}</div>
            </TableCell>
            <TableCell className="text-sm">{s.learner?.parent_phone}</TableCell>
            <TableCell className="text-sm">{s.learner?.grade}</TableCell>
            <TableCell className="font-mono text-xs">{s.mpesa_code || "—"}</TableCell>
            <TableCell>KES {s.amount} · {s.weeks}w</TableCell>
            <TableCell><Badge variant="outline" className="capitalize">{s.status}</Badge></TableCell>
            <TableCell className="text-xs">{new Date(s.submitted_at).toLocaleString()}</TableCell>
            <TableCell className="text-xs">{s.expires_at ? new Date(s.expires_at).toLocaleDateString() : "—"}</TableCell>
            <TableCell className="text-right space-x-1">
              {allowActions === "pending" && (
                <>
                  <Button size="sm" onClick={() => approve(s)}><CheckCircle2 className="w-4 h-4 mr-1" />Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => setRejecting(s)}><XCircle className="w-4 h-4 mr-1" />Reject</Button>
                </>
              )}
              {allowActions === "active" && (
                <>
                  <Button size="sm" variant="outline" onClick={() => { setExtending(s); setExtWeeks("1"); }}>Extend</Button>
                  <Button size="sm" variant="outline" onClick={() => suspend(s)}><PauseCircle className="w-4 h-4 mr-1" />Suspend</Button>
                </>
              )}
              {allowActions === "other" && s.status === "suspended" && (
                <Button size="sm" onClick={() => reactivate(s)}><PlayCircle className="w-4 h-4 mr-1" />Reactivate</Button>
              )}
              {allowActions === "other" && s.status === "expired" && (
                <Button size="sm" variant="outline" onClick={() => { setExtending(s); setExtWeeks("1"); }}>Renew</Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/super-admin")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <h1 className="text-2xl font-bold">Independent Learners</h1>
          {busy && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </div>

        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
            <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
            <TabsTrigger value="other">Rejected / Expired / Suspended ({others.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="pending">
            <Card><CardContent className="p-0 overflow-x-auto">{renderTable(pending, "pending")}</CardContent></Card>
          </TabsContent>
          <TabsContent value="active">
            <Card><CardContent className="p-0 overflow-x-auto">{renderTable(active, "active")}</CardContent></Card>
          </TabsContent>
          <TabsContent value="other">
            <Card><CardContent className="p-0 overflow-x-auto">{renderTable(others, "other")}</CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject payment</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Reason (shown to learner)</Label>
            <Input value={rejReason} onChange={e => setRejReason(e.target.value)} placeholder="e.g. M-Pesa code not found" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>Cancel</Button>
            <Button variant="destructive" onClick={reject}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!extending} onOpenChange={(o) => !o && setExtending(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Extend / Renew access</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Number of weeks to add</Label>
            <Input type="number" min={1} value={extWeeks} onChange={e => setExtWeeks(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtending(null)}>Cancel</Button>
            <Button onClick={extend}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
