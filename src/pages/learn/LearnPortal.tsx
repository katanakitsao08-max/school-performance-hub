import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, LogOut, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/**
 * Placeholder portal shell. Phase 2 (UI redesign per uploaded inspiration)
 * will replace the inner content with subject cards, Continue Learning,
 * XP/streaks, AI tutor, etc.
 */
export default function LearnPortal() {
  const navigate = useNavigate();
  const { user, role, loading, signOut } = useAuth();
  const [learnerName, setLearnerName] = useState("");
  const [grade, setGrade] = useState("");
  const [code, setCode] = useState("");
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate("/learn/login", { replace: true }); return; }
    if (role !== "independent_learner") { navigate("/", { replace: true }); return; }
    (async () => {
      await supabase.rpc("expire_old_independent_subscriptions");
      const [{ data: l }, { data: s }] = await Promise.all([
        supabase.from("independent_learners").select("full_name, grade, learner_code").eq("user_id", user.id).maybeSingle(),
        supabase.from("independent_subscriptions").select("status, expires_at").eq("user_id", user.id).order("submitted_at", { ascending: false }).limit(1),
      ]);
      if (l) { setLearnerName(l.full_name); setGrade(l.grade); setCode(l.learner_code); }
      const top = s?.[0];
      const active = !!(top && top.status === "active" && (!top.expires_at || new Date(top.expires_at) > new Date()));
      if (!active) {
        navigate(top?.status === "pending" ? "/learn/pending" : "/learn/subscribe", { replace: true });
        return;
      }
      setExpiresAt(top!.expires_at);
    })();
  }, [loading, user, role, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-primary" /> Learning Portal
            </h1>
            <p className="text-sm text-muted-foreground">
              Hi {learnerName} · {grade} · <span className="font-mono">{code}</span>
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => signOut().then(() => navigate("/learn/login"))}>
            <LogOut className="w-4 h-4 mr-2" /> Sign out
          </Button>
        </div>

        <Card className="border-primary/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Subscription Active</CardTitle>
              <Badge variant="default">Active</Badge>
            </div>
            <CardDescription>
              {expiresAt ? `Valid until ${new Date(expiresAt).toLocaleDateString()}` : "Active"}
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <BookOpen className="w-12 h-12 mx-auto text-primary/40" />
            <h2 className="text-lg font-semibold">Your CBC learning experience is being prepared</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Subject cards, AI tutor, learning streaks and interactive lessons will appear here in the next update.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
