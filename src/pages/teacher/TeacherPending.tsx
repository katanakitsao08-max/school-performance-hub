import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Clock, CheckCircle2, XCircle } from "lucide-react";
import { Navigate } from "react-router-dom";

export default function TeacherPending() {
  const { user, signOut } = useAuth();
  const [reg, setReg] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from("teacher_registrations").select("*").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => { setReg(data); setLoading(false); });
  }, [user]);

  if (loading) return <div className="min-h-screen grid place-items-center">Loading…</div>;
  if (reg?.approval_status === "approved") return <Navigate to="/teacher" replace />;

  const status = reg?.approval_status || "pending";
  const map: Record<string, { icon: any; color: string; label: string }> = {
    pending: { icon: Clock, color: "bg-amber-500", label: "Pending Approval" },
    approved: { icon: CheckCircle2, color: "bg-green-600", label: "Approved" },
    rejected: { icon: XCircle, color: "bg-red-600", label: "Rejected" },
    suspended: { icon: XCircle, color: "bg-gray-600", label: "Suspended" },
  };
  const Icon = map[status].icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-background grid place-items-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className={`mx-auto h-14 w-14 rounded-full ${map[status].color} grid place-items-center mb-2`}>
            <Icon className="h-7 w-7 text-white" />
          </div>
          <CardTitle>{map[status].label}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-center">
          <p className="text-muted-foreground">
            Your account is awaiting approval from PerformTrack Administration.
          </p>
          <div className="rounded-lg border p-4 text-left text-sm space-y-1">
            <div><span className="text-muted-foreground">Name:</span> {reg?.full_name}</div>
            <div><span className="text-muted-foreground">School:</span> {reg?.school_name_raw}</div>
            <div><span className="text-muted-foreground">Class:</span> {reg?.class_name} {reg?.stream}</div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Status:</span> <Badge>{status}</Badge>
            </div>
            {reg?.rejection_reason && (
              <div className="text-red-600 pt-2">Reason: {reg.rejection_reason}</div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Support: support@performtrack.co.ke</p>
          <Button variant="outline" onClick={signOut} className="w-full">Sign out</Button>
        </CardContent>
      </Card>
    </div>
  );
}
