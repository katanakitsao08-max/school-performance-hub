import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";

import ParentChildSelector from "@/components/parent/ParentChildSelector";
import ParentPerformanceTab from "@/components/parent/ParentPerformanceTab";
import ParentAttendanceTab from "@/components/parent/ParentAttendanceTab";
import ParentFeesTab from "@/components/parent/ParentFeesTab";
import ParentReportsTab from "@/components/parent/ParentReportsTab";
import ParentLearningPathTab from "@/components/parent/ParentLearningPathTab";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function ParentDashboard() {
  const { user, profile } = useAuth();
  const [searchParams] = useSearchParams();

  const validTabs = ["performance", "learning", "attendance", "fees", "reports"];

  const tabFromUrl = searchParams.get("tab");

  const initialTab = validTabs.includes(tabFromUrl || "") ? tabFromUrl! : "performance";

  const [activeTab, setActiveTab] = useState(initialTab);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

  useEffect(() => {
    const currentTab = searchParams.get("tab");

    if (currentTab && validTabs.includes(currentTab)) {
      setActiveTab(currentTab);
    }
  }, [searchParams]);

  const { data: children = [], isLoading } = useQuery({
    queryKey: ["parent-children", user?.id],
    enabled: !!user,

    queryFn: async () => {
      if (!user?.id) return [];

      const { data: links, error: linksError } = await supabase
        .from("parent_learners")
        .select("learner_id, relationship")
        .eq("parent_user_id", user.id);

      if (linksError) {
        console.error("Links Error:", linksError);
        return [];
      }

      if (!links || links.length === 0) {
        return [];
      }

      const learnerIds = links.map((link) => link.learner_id).filter(Boolean);

      if (learnerIds.length === 0) {
        return [];
      }

      const { data: learners, error: learnersError } = await supabase.from("learners").select("*").in("id", learnerIds);

      if (learnersError) {
        console.error("Learners Error:", learnersError);
        return [];
      }

      return (learners || []).map((learner) => ({
        ...learner,
        relationship: links.find((lk) => lk.learner_id === learner.id)?.relationship || "parent",
      }));
    },
  });

  // Auto-select first child safely
  useEffect(() => {
    if (!selectedChildId && children.length > 0) {
      setSelectedChildId(children[0].id);
    }
  }, [children, selectedChildId]);

  const activeChild = children.find((c) => c.id === selectedChildId) || null;

  return (
    <DashboardLayout>
      <div className="space-y-4 animate-fade-in">
        <div>
          <h1 className="text-xl font-display font-bold text-foreground">
            Welcome, {profile?.full_name?.split(" ")[0] || "Parent"} 👋
          </h1>

          <p className="text-sm text-muted-foreground mt-0.5">Track your children's progress</p>
        </div>

        {isLoading ? (
          <Card className="shadow-card">
            <CardContent className="py-10 text-center">
              <p className="text-sm text-muted-foreground">Loading learners...</p>
            </CardContent>
          </Card>
        ) : children.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="py-10 text-center">
              <User className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />

              <p className="text-sm text-muted-foreground">No children linked to your account yet.</p>

              <p className="text-xs text-muted-foreground mt-1">Please contact the school admin to link your child.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <ParentChildSelector
              children={children}
              activeChildId={activeChild?.id || ""}
              onSelect={setSelectedChildId}
            />

            {activeChild && (
              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList className="w-full grid grid-cols-5">
                  <TabsTrigger value="performance" className="text-xs">
                    Performance
                  </TabsTrigger>

                  <TabsTrigger value="learning" className="text-xs">
                    Learning
                  </TabsTrigger>

                  <TabsTrigger value="attendance" className="text-xs">
                    Attendance
                  </TabsTrigger>

                  <TabsTrigger value="fees" className="text-xs">
                    Fees
                  </TabsTrigger>

                  <TabsTrigger value="reports" className="text-xs">
                    Reports
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="performance">
                  <ParentPerformanceTab child={activeChild} />
                </TabsContent>

                <TabsContent value="learning">
                  <div className="space-y-4">
                    {activeChild ? (
                      <ParentLearningPathTab child={activeChild} />
                    ) : (
                      <Card>
                        <CardContent className="py-6 text-center text-sm text-muted-foreground">
                          No learner selected
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="attendance">
                  <ParentAttendanceTab child={activeChild} />
                </TabsContent>

                <TabsContent value="fees">
                  <ParentFeesTab child={activeChild} />
                </TabsContent>

                <TabsContent value="reports">
                  <ParentReportsTab child={activeChild} />
                </TabsContent>
              </Tabs>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
