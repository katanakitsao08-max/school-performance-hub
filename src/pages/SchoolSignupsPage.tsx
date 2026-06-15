import { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import CredentialsRevealDialog from '@/components/CredentialsRevealDialog';

export default function SchoolSignupsPage() {
  const qc = useQueryClient();
  const [reviewing, setReviewing] = useState<any | null>(null);
  const [reason, setReason] = useState('');
  const [creds, setCreds] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: signups = [] } = useQuery({
    queryKey: ['school-signups'],
    queryFn: async () => {
      const { data } = await supabase.from('school_signups').select('*').order('created_at', { ascending: false });
      return data || [];
    },
  });

  async function decide(action: 'approve' | 'reject') {
    if (!reviewing) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('school-signup-decide', {
        body: { signup_id: reviewing.id, action, reason },
      });
      if (error) throw error;
      if (action === 'approve' && data?.credentials) {
        setCreds(data.credentials);
        if (data?.sms?.ok) toast.success('Approved — sign-in SMS sent to admin');
        else toast.warning(`Approved, but SMS not sent${data?.sms?.error ? `: ${data.sms.error}` : ''}`);
      } else {
        toast.success(action === 'approve' ? 'School approved' : 'Application rejected');
      }
      setReviewing(null); setReason('');
      qc.invalidateQueries({ queryKey: ['school-signups'] });
      qc.invalidateQueries({ queryKey: ['all-schools'] });
    } catch (e: any) { toast.error(e?.message || 'Failed'); }
    finally { setBusy(false); }
  }

  const pending = signups.filter((s: any) => s.status === 'pending');

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">School Sign-ups</h1>
          <p className="text-muted-foreground text-sm">Approve or reject new school registrations.</p>
        </div>

        <Card><CardContent className="pt-6 overflow-x-auto">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold">Pending {pending.length > 0 && <Badge className="ml-2">{pending.length}</Badge>}</h2>
          </div>
          <Table>
            <TableHeader><TableRow>
              <TableHead>School</TableHead><TableHead>Admin</TableHead><TableHead>Phone</TableHead>
              <TableHead>Email</TableHead><TableHead>Learners</TableHead><TableHead>Submitted</TableHead><TableHead className="text-right">Action</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {signups.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="font-medium">{s.school_name}</div>
                    <div className="text-xs text-muted-foreground">{s.county} • {s.school_type}</div>
                  </TableCell>
                  <TableCell>{s.admin_full_name}</TableCell>
                  <TableCell>{s.admin_phone}</TableCell>
                  <TableCell className="text-xs">{s.admin_email}</TableCell>
                  <TableCell>{s.learners_count}</TableCell>
                  <TableCell className="text-xs">{new Date(s.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    {s.status === 'pending' ? (
                      <Button size="sm" variant="outline" onClick={() => setReviewing(s)}>Review</Button>
                    ) : (
                      <Badge variant={s.status === 'approved' ? 'default' : 'destructive'}>{s.status}</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!signups.length && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">No registrations yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent></Card>
      </div>

      <Dialog open={!!reviewing} onOpenChange={(o) => !o && (setReviewing(null), setReason(''))}>
        <DialogContent>
          <DialogHeader><DialogTitle>Review {reviewing?.school_name}</DialogTitle></DialogHeader>
          {reviewing && (
            <div className="space-y-2 text-sm">
              <div><span className="text-muted-foreground">Type:</span> {reviewing.school_type}</div>
              <div><span className="text-muted-foreground">County:</span> {reviewing.county}</div>
              <div><span className="text-muted-foreground">Admin:</span> {reviewing.admin_full_name}</div>
              <div><span className="text-muted-foreground">Phone:</span> {reviewing.admin_phone}</div>
              <div><span className="text-muted-foreground">Email:</span> {reviewing.admin_email}</div>
              <div><span className="text-muted-foreground">Learners:</span> {reviewing.learners_count}</div>
              <div className="pt-2">
                <label className="text-xs text-muted-foreground">Rejection reason (optional)</label>
                <Textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} />
              </div>
              <p className="text-xs text-muted-foreground">Approval auto-creates the school + admin account and shows the credentials once.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="destructive" disabled={busy} onClick={() => decide('reject')}>Reject</Button>
            <Button disabled={busy} onClick={() => decide('approve')}>Approve & Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {creds && (
        <CredentialsRevealDialog
          open={!!creds}
          onClose={() => setCreds(null)}
          loginEmail={creds.loginEmail}
          username={creds.username}
          password={creds.password}
          fullName={creds.fullName}
        />
      )}
    </DashboardLayout>
  );
}
