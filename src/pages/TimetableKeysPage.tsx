import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { generateActivationKey } from '@/lib/timetable-engine';
import { Key, Copy, Ban, RefreshCw, Trash2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface School { id: string; school_name: string; school_code: string; }
interface KeyRow {
  id: string; school_id: string; activation_key: string; activated_at: string | null;
  is_revoked: boolean; expires_at: string | null; created_at: string;
}

export default function TimetableKeysPage() {
  const { user } = useAuth();
  const [schools, setSchools] = useState<School[]>([]);
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [schoolId, setSchoolId] = useState<string>('');
  const [expiresInDays, setExpiresInDays] = useState<string>('365');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const [s, k] = await Promise.all([
      supabase.from('schools').select('id, school_name, school_code').order('school_name'),
      supabase.from('timetable_activation_keys').select('*').order('created_at', { ascending: false }),
    ]);
    setSchools((s.data as any) || []);
    setKeys((k.data as any) || []);
  };

  useEffect(() => { load(); }, []);

  const generate = async () => {
    if (!schoolId || !user) return toast({ title: 'Select a school first' });
    setLoading(true);
    const key = generateActivationKey();
    const expires = expiresInDays && Number(expiresInDays) > 0
      ? new Date(Date.now() + Number(expiresInDays) * 86400000).toISOString()
      : null;
    const { error } = await supabase.from('timetable_activation_keys').insert({
      school_id: schoolId,
      activation_key: key,
      generated_by: user.id,
      expires_at: expires,
    });
    setLoading(false);
    if (error) return toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    toast({ title: 'Activation key generated', description: key });
    load();
  };

  const revoke = async (id: string) => {
    const { error } = await supabase.from('timetable_activation_keys')
      .update({ is_revoked: true }).eq('id', id);
    if (error) return toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    toast({ title: 'Key revoked' });
    load();
  };

  const copy = (k: string) => {
    navigator.clipboard.writeText(k);
    toast({ title: 'Copied to clipboard' });
  };

  const status = (k: KeyRow) => {
    if (k.is_revoked) return <Badge variant="destructive">Revoked</Badge>;
    if (k.expires_at && new Date(k.expires_at) < new Date()) return <Badge variant="secondary">Expired</Badge>;
    if (k.activated_at) return <Badge className="bg-primary">Active</Badge>;
    return <Badge variant="outline">Pending</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Timetable Activation Keys</h1>
          <p className="text-muted-foreground">Generate per-school keys to unlock the Timetable Generator.</p>
        </div>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Key className="h-5 w-5" /> Generate New Key</CardTitle></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <Select value={schoolId} onValueChange={setSchoolId}>
              <SelectTrigger><SelectValue placeholder="Select school" /></SelectTrigger>
              <SelectContent>
                {schools.map(s => <SelectItem key={s.id} value={s.id}>{s.school_name} ({s.school_code})</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="number" value={expiresInDays} onChange={e => setExpiresInDays(e.target.value)} placeholder="Expires in days (optional)" />
            <Button onClick={generate} disabled={loading || !schoolId}>
              {loading ? 'Generating…' : 'Generate Key'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Issued Keys</CardTitle>
            <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>School</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Activated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map(k => {
                  const sch = schools.find(s => s.id === k.school_id);
                  return (
                    <TableRow key={k.id}>
                      <TableCell>{sch?.school_name || '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{k.activation_key}</TableCell>
                      <TableCell>{status(k)}</TableCell>
                      <TableCell className="text-xs">{k.expires_at ? new Date(k.expires_at).toLocaleDateString() : '—'}</TableCell>
                      <TableCell className="text-xs">{k.activated_at ? new Date(k.activated_at).toLocaleDateString() : '—'}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button size="sm" variant="ghost" onClick={() => copy(k.activation_key)}><Copy className="h-3 w-3" /></Button>
                        {!k.is_revoked && (
                          <Button size="sm" variant="ghost" onClick={() => revoke(k.id)}><Ban className="h-3 w-3 text-destructive" /></Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {keys.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No keys generated yet</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
