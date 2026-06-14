import { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { format } from 'date-fns';

export default function ScoreAuditPage() {
  const { role, schoolId } = useAuth();
  const [q, setQ] = useState('');

  if (role && !['admin', 'headteacher', 'super_admin'].includes(role)) {
    return <Navigate to="/" replace />;
  }

  const { data = [], isLoading } = useQuery({
    queryKey: ['score-audit', schoolId],
    queryFn: async () => {
      const query = supabase
        .from('score_audit_log')
        .select('*, learner:learners(full_name, admission_number), area:learning_areas(name)')
        .order('created_at', { ascending: false })
        .limit(500);
      if (schoolId && role !== 'super_admin') query.eq('school_id', schoolId);
      const { data } = await query;
      return data ?? [];
    },
  });

  const filtered = (data as any[]).filter(r => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      r.learner?.full_name?.toLowerCase().includes(s) ||
      r.area?.name?.toLowerCase().includes(s) ||
      r.reason?.toLowerCase().includes(s)
    );
  });

  return (
    <DashboardLayout>
      <div className="space-y-4 animate-fade-in">
        <div>
          <h1 className="text-2xl font-display font-bold">Performance Audit Log</h1>
          <p className="text-muted-foreground">Every admin override is recorded here.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent changes ({filtered.length})</CardTitle>
            <Input placeholder="Search learner, subject or reason" value={q} onChange={e => setQ(e.target.value)} className="max-w-sm" />
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Learner</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Previous</TableHead>
                    <TableHead>New</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>}
                  {!isLoading && filtered.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No audit entries yet.</TableCell></TableRow>
                  )}
                  {filtered.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-xs">{format(new Date(r.created_at), 'd MMM yyyy HH:mm')}</TableCell>
                      <TableCell>{r.learner?.full_name ?? '—'}</TableCell>
                      <TableCell>{r.area?.name ?? '—'}</TableCell>
                      <TableCell><Badge variant="outline">{r.action}</Badge></TableCell>
                      <TableCell className="text-xs"><pre className="font-mono">{JSON.stringify(r.previous_value)}</pre></TableCell>
                      <TableCell className="text-xs"><pre className="font-mono">{JSON.stringify(r.new_value)}</pre></TableCell>
                      <TableCell className="max-w-[260px] text-xs">{r.reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
