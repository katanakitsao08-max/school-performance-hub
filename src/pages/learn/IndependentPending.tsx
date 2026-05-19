import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Clock, RefreshCw, LogOut, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function IndependentPending() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [status, setStatus] = useState<string>("pending");
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);

  const refresh = async () => {
    if (!user) return;
    await supabase.rpc("expire_old_independent_subscriptions");
    const { data } = await supabase
      .from("independent_subscriptions")
      .select("status, submitted_at, rejection_reason, expires_at")
      .eq("user_id", user.id)
      .order("submitted_at", { ascending: false })
      .limit(1);
    const top = data?.[0];
    if (top) {
      setStatus(top.status);
      setSubmittedAt(top.submitted_at);
      setReason(top.rejection_reason);
      if (top.status === "active") navigate("/learn", { replace: true });
    }
  };

  useEffect(() => {
    if (!user) { navigate("/learn/login", { replace: true }); return; }
    refresh();
    const id = setInterval(refresh, 15_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl border-primary/20">
        <CardHeader className="text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mb-3">
            {status === "rejected" ? (
              <Clock className="w-7 h-7 text-destructive" />
            ) : status === "active" ? (
              <CheckCircle2 className="w-7 h-7 text-primary" />
            ) : (
              <Clock className="w-7 h-7 text-amber-600" />
            )}
          </div>
          <CardTitle>
            {status === "rejected" ? "Payment rejected" : status === "active" ? "Approved!" : "Awaiting approval"}
          </CardTitle>
          <CardDescription>
            {status === "rejected"
              ? reason || "Your payment could not be verified. Please submit again."
              : "We've received your M-Pesa payment. A super admin will activate access shortly."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-center">
          <Badge variant="outline" className="capitalize">{status}</Badge>
          {submittedAt && (
            <p className="text-xs text-muted-foreground">Submitted {new Date(submittedAt).toLocaleString()}</p>
          )}
          <Button variant="outline" className="w-full" onClick={refresh}>
            <RefreshCw className="w-4 h-4 mr-2" /> Check status
          </Button>
          {status === "rejected" && (
            <Button className="w-full" onClick={() => navigate("/learn/subscribe")}>
              Submit new payment
            </Button>
          )}
          <Button variant="ghost" size="sm" className="w-full" onClick={() => signOut().then(() => navigate("/learn/login"))}>
            <LogOut className="w-4 h-4 mr-2" /> Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
