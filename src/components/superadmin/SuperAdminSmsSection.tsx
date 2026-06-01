import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, Plus, Minus, Power } from 'lucide-react';
import GlobalSmsConfigCard from './GlobalSmsConfigCard';



export default function SuperAdminSmsSection({ schools }: { schools: any[] }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedSchool, setSelectedSchool] = useState<string>('');
  const [topup, setTopup] = useState<number>(0);

  const { data: credits = [] } = useQuery({
    queryKey: ['all-sms-credits'],
    queryFn: async () => {
      const { data } = await supabase.from('school_sms_credits' as any).select('*');
      return (data as any[]) || [];
    },
  });

  const { data: allLogs = [] } = useQuery({
    queryKey: ['sms-logs-all'],
    queryFn: async () => {
      const { data } = await supabase.from('sms_logs' as any)
        .select('school_id, status, sent_at')
        .order('sent_at', { ascending: false })
        .limit(5000);
      return (data as any[]) || [];
    },
  });

  const statsBySchool = (schoolId: string) => {
    const logs = allLogs.filter(l => l.school_id === schoolId);
    const sent = logs.filter(l => l.status === 'sent').length;
    const failed = logs.filter(l => l.status === 'failed').length;
    const last = logs[0]?.sent_at || null;
    return { sent, failed, total: logs.length, last };
  };

  const adjustCredits = async (delta: number) => {
    if (!selectedSchool || !delta) return;
    const existing = credits.find(c => c.school_id === selectedSchool);
    if (existing) {
      const newBal = Math.max(0, (existing.balance || 0) + delta);
      const { error } = await supabase.from('school_sms_credits' as any).update({ balance: newBal }).eq('school_id', selectedSchool);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    } else {
      const { error } = await supabase.from('school_sms_credits' as any).insert({ school_id: selectedSchool, balance: Math.max(0, delta), used: 0 });
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    }
    toast({ title: `Credits ${delta > 0 ? 'added' : 'removed'}` });
    qc.invalidateQueries({ queryKey: ['all-sms-credits'] });
    setTopup(0);
  };

  const toggleSchoolSms = async (schoolId: string, enabled: boolean) => {
    const existing = credits.find(c => c.school_id === schoolId);
    if (existing) {
      await supabase.from('school_sms_credits' as any).update({ enabled }).eq('school_id', schoolId);
    } else {
      await supabase.from('school_sms_credits' as any).insert({ school_id: schoolId, balance: 0, used: 0, enabled });
    }
    qc.invalidateQueries({ queryKey: ['all-sms-credits'] });
  };

  return (
    <div className="space-y-4">
      <GlobalSmsConfigCard />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><MessageSquare className="h-5 w-5 text-primary" /> SMS Credits & Per-School Activity</CardTitle>
          <CardDescription>Allocate credits, enable/disable SMS, and monitor sent counts per school.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>School</Label>
              <Select value={selectedSchool} onValueChange={setSelectedSchool}>
                <SelectTrigger><SelectValue placeholder="Select school" /></SelectTrigger>
                <SelectContent>
                  {schools.map(s => <SelectItem key={s.id} value={s.id}>{s.school_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Credits to add/remove</Label>
              <Input type="number" value={topup} onChange={e => setTopup(Number(e.target.value))} placeholder="e.g. 1000" />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={() => adjustCredits(topup)} disabled={!selectedSchool || !topup} className="flex-1">
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
              <Button variant="outline" onClick={() => adjustCredits(-Math.abs(topup))} disabled={!selectedSchool || !topup} className="flex-1">
                <Minus className="h-4 w-4 mr-1" /> Remove
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>School</TableHead>
                  <TableHead className="text-center">Balance</TableHead>
                  <TableHead className="text-center">SMS Sent</TableHead>
                  <TableHead className="text-center">Failed</TableHead>
                  <TableHead>Last Sent</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schools.map(s => {
                  const c = credits.find(x => x.school_id === s.id);
                  const enabled = c?.enabled ?? true;
                  const stats = statsBySchool(s.id);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.school_name}</TableCell>
                      <TableCell className="text-center">{c?.balance ?? 0}</TableCell>
                      <TableCell className="text-center">{stats.sent}</TableCell>
                      <TableCell className="text-center">{stats.failed}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {stats.last ? new Date(stats.last).toLocaleString() : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        {enabled ? <Badge variant="outline" className="text-success">Enabled</Badge> : <Badge variant="destructive">Disabled</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => toggleSchoolSms(s.id, !enabled)}>
                          <Power className="h-3 w-3 mr-1" /> {enabled ? 'Disable' : 'Enable'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
