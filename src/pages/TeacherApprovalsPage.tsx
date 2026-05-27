import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export default function TeacherApprovalsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("pending");
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    let query = supabase.from("teacher_registrations").select("*").order("created_at", { ascending: false });
    if (filter !== "all") query = query.eq("approval_status", filter);
    const { data } = await query;
    setRows(data || []);
  };
  useEffect(() => { load(); }, [filter]);

  const act = async (id: string, action: "approve" | "reject" | "suspend") => {
    const reason = action === "reject" ? prompt("Reason (optional):") || undefined : undefined;
    setBusy(id);
    const { data, error } = await supabase.functions.invoke("teacher-approve", {
      body: { registration_id: id, action, reason },
    });
    setBusy(null);
    if (error || (data as any)?.error) {
      toast({ title: "Action failed", description: (data as any)?.error || error?.message, variant: "destructive" });
      return;
    }
    toast({ title: `Teacher ${action}d` });
    load();
  };

  const filtered = rows.filter(r =>
    !q || r.full_name?.toLowerCase().includes(q.toLowerCase())
       || r.school_name_raw?.toLowerCase().includes(q.toLowerCase())
       || r.email?.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Teacher Approvals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <Input placeholder="Search name, school or email…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
              <select className="h-10 border rounded-md px-3 bg-background" value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="suspended">Suspended</option>
                <option value="all">All</option>
              </select>
            </div>
            <div className="overflow-x-auto -mx-3 sm:mx-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Teacher</TableHead><TableHead>School</TableHead><TableHead>County</TableHead>
                <TableHead>Class</TableHead><TableHead>Phone</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{r.full_name}</div>
                      <div className="text-xs text-muted-foreground">{r.email}</div>
                    </TableCell>
                    <TableCell>{r.school_name_raw}</TableCell>
                    <TableCell>{r.county}</TableCell>
                    <TableCell>{r.class_name} {r.stream}</TableCell>
                    <TableCell>
                      {r.phone ? (
                        <a
                          href={`tel:${r.phone}`}
                          className="inline-flex items-center gap-1.5 text-primary hover:underline font-medium"
                          title={`Call ${r.full_name}`}
                        >
                          <Phone className="h-3.5 w-3.5" />
                          {r.phone}
                        </a>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                    <TableCell className="text-xs">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                    <TableCell><Badge variant={r.approval_status === "approved" ? "default" : "secondary"}>{r.approval_status}</Badge></TableCell>
                    <TableCell className="space-x-1">
                      {r.approval_status !== "approved" && <Button size="sm" disabled={busy === r.id} onClick={() => act(r.id, "approve")}>Approve</Button>}
                      {r.approval_status !== "rejected" && <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => act(r.id, "reject")}>Reject</Button>}
                      {r.approval_status !== "suspended" && <Button size="sm" variant="ghost" disabled={busy === r.id} onClick={() => act(r.id, "suspend")}>Suspend</Button>}
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No registrations.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
