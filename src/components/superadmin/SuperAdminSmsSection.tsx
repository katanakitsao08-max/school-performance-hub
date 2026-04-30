import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, Save, Plus, Minus, Power } from 'lucide-react';

export default function SuperAdminSmsSection({ schools }: { schools: any[] }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedSchool, setSelectedSchool] = useState<string>('');
  const [topup, setTopup] = useState<number>(0);

  const DEFAULT_BODY_TEMPLATE = {
    method: 'POST',
    body_type: 'json',
    body: {
      apikey: '{{api_key}}',
      partnerID: '',
      message: '{{message}}',
      shortcode: '{{sender_id}}',
      mobile: '{{phone}}',
    },
  };

  const [schoolCfg, setSchoolCfg] = useState({
    provider: 'olympus_teleserve',
    endpoint: '',
    api_key: '',
    sender_id: '',
    headers_json: '{}',
    body_template: JSON.stringify(DEFAULT_BODY_TEMPLATE, null, 2),
    is_active: true,
  });
  const [savingSchool, setSavingSchool] = useState(false);

  const [global, setGlobal] = useState({
    provider: 'olympus_teleserve',
    endpoint: '',
    api_key: '',
    sender_id: 'PERFORMTRK',
    headers_json: '{}',
    body_template: '{}',
    is_active: true,
  });
  const [savingGlobal, setSavingGlobal] = useState(false);

  const { data: selectedSchoolCfg } = useQuery({
    queryKey: ['sa-school-sms-config', selectedSchool],
    queryFn: async () => {
      if (!selectedSchool) return null;
      const { data } = await supabase.from('school_sms_config' as any).select('*').eq('school_id', selectedSchool).maybeSingle();
      return data;
    },
    enabled: !!selectedSchool,
  });

  useEffect(() => {
    if (selectedSchoolCfg) {
      const c: any = selectedSchoolCfg;
      setSchoolCfg({
        provider: c.provider || 'olympus_teleserve',
        endpoint: c.endpoint || '',
        api_key: c.api_key || '',
        sender_id: c.sender_id || '',
        headers_json: JSON.stringify(c.headers_json || {}, null, 2),
        body_template: JSON.stringify(c.body_template || DEFAULT_BODY_TEMPLATE, null, 2),
        is_active: c.is_active ?? true,
      });
    } else if (selectedSchool) {
      setSchoolCfg({
        provider: 'olympus_teleserve',
        endpoint: '',
        api_key: '',
        sender_id: '',
        headers_json: '{}',
        body_template: JSON.stringify(DEFAULT_BODY_TEMPLATE, null, 2),
        is_active: true,
      });
    }
  }, [selectedSchoolCfg, selectedSchool]);

  const saveSchoolCfg = async () => {
    if (!selectedSchool) return;
    setSavingSchool(true);
    try {
      let headers_json: any = {}, body_template: any = {};
      try { headers_json = JSON.parse(schoolCfg.headers_json || '{}'); } catch { throw new Error('Headers JSON invalid'); }
      try { body_template = JSON.parse(schoolCfg.body_template || '{}'); } catch { throw new Error('Body template JSON invalid'); }
      const payload: any = {
        school_id: selectedSchool,
        provider: schoolCfg.provider,
        endpoint: schoolCfg.endpoint.trim(),
        api_key: schoolCfg.api_key,
        sender_id: schoolCfg.sender_id.trim().slice(0, 11),
        headers_json,
        body_template,
        is_active: schoolCfg.is_active,
      };
      const { error } = await supabase.from('school_sms_config' as any).upsert(payload, { onConflict: 'school_id' });
      if (error) throw error;
      toast({ title: 'School SMS provider saved' });
      qc.invalidateQueries({ queryKey: ['sa-school-sms-config', selectedSchool] });
    } catch (e: any) {
      toast({ title: 'Save failed', description: e?.message || String(e), variant: 'destructive' });
    } finally {
      setSavingSchool(false);
    }
  };


  const { data: globalCfg } = useQuery({
    queryKey: ['global-sms-config'],
    queryFn: async () => {
      const { data } = await supabase.from('global_sms_config' as any).select('*').eq('singleton', true).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (globalCfg) {
      const c: any = globalCfg;
      setGlobal({
        provider: c.provider || 'olympus_teleserve',
        endpoint: c.endpoint || '',
        api_key: c.api_key || '',
        sender_id: c.sender_id || 'PERFORMTRK',
        headers_json: JSON.stringify(c.headers_json || {}, null, 2),
        body_template: JSON.stringify(c.body_template || {}, null, 2),
        is_active: c.is_active ?? true,
      });
    }
  }, [globalCfg]);

  const { data: credits = [] } = useQuery({
    queryKey: ['all-sms-credits'],
    queryFn: async () => {
      const { data } = await supabase.from('school_sms_credits' as any).select('*');
      return (data as any[]) || [];
    },
  });

  const { data: recentLogs = [] } = useQuery({
    queryKey: ['sms-logs-recent'],
    queryFn: async () => {
      const { data } = await supabase.from('sms_logs' as any).select('*').order('sent_at', { ascending: false }).limit(50);
      return (data as any[]) || [];
    },
  });

  const saveGlobal = async () => {
    setSavingGlobal(true);
    try {
      let headers_json: any = {}, body_template: any = {};
      try { headers_json = JSON.parse(global.headers_json || '{}'); } catch { throw new Error('Headers JSON invalid'); }
      try { body_template = JSON.parse(global.body_template || '{}'); } catch { throw new Error('Body template JSON invalid'); }
      const payload: any = {
        singleton: true,
        provider: global.provider,
        endpoint: global.endpoint.trim(),
        api_key: global.api_key,
        sender_id: global.sender_id.trim().slice(0, 11),
        headers_json,
        body_template,
        is_active: global.is_active,
      };
      const { error } = await supabase.from('global_sms_config' as any).upsert(payload, { onConflict: 'singleton' });
      if (error) throw error;
      toast({ title: 'Global SMS configuration saved' });
      qc.invalidateQueries({ queryKey: ['global-sms-config'] });
    } catch (e: any) {
      toast({ title: 'Save failed', description: e?.message || String(e), variant: 'destructive' });
    } finally {
      setSavingGlobal(false);
    }
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><MessageSquare className="h-5 w-5 text-primary" /> SMS Credits & Per-School Control</CardTitle>
          <CardDescription>Allocate credits, enable/disable SMS, and monitor usage per school.</CardDescription>
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

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>School</TableHead>
                <TableHead className="text-center">Balance</TableHead>
                <TableHead className="text-center">Used</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schools.map(s => {
                const c = credits.find(x => x.school_id === s.id);
                const enabled = c?.enabled ?? true;
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.school_name}</TableCell>
                    <TableCell className="text-center">{c?.balance ?? 0}</TableCell>
                    <TableCell className="text-center">{c?.used ?? 0}</TableCell>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Per-School SMS Provider</CardTitle>
          <CardDescription>
            Configure the provider, endpoint, API key and Sender ID for the selected school. School admins cannot edit these.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!selectedSchool && (
            <p className="text-sm text-muted-foreground">Select a school above to configure its SMS provider.</p>
          )}
          {selectedSchool && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Provider</Label>
                  <Input value={schoolCfg.provider} onChange={e => setSchoolCfg(s => ({ ...s, provider: e.target.value }))} placeholder="olympus_teleserve" />
                </div>
                <div>
                  <Label>Sender ID (max 11 chars)</Label>
                  <Input value={schoolCfg.sender_id} maxLength={11} onChange={e => setSchoolCfg(s => ({ ...s, sender_id: e.target.value }))} placeholder="STMARYS" />
                </div>
                <div className="md:col-span-2">
                  <Label>Endpoint</Label>
                  <Input value={schoolCfg.endpoint} onChange={e => setSchoolCfg(s => ({ ...s, endpoint: e.target.value }))} placeholder="https://api.olympusteleserve.co.ke/api/services/sendsms/" />
                </div>
                <div className="md:col-span-2">
                  <Label>API Key</Label>
                  <Input type="password" value={schoolCfg.api_key} onChange={e => setSchoolCfg(s => ({ ...s, api_key: e.target.value }))} placeholder="Provider API key" />
                </div>
                <div className="md:col-span-2">
                  <Label>Headers JSON</Label>
                  <Textarea rows={3} className="font-mono text-xs" value={schoolCfg.headers_json} onChange={e => setSchoolCfg(s => ({ ...s, headers_json: e.target.value }))} />
                </div>
                <div className="md:col-span-2">
                  <Label>Body Template JSON</Label>
                  <Textarea rows={6} className="font-mono text-xs" value={schoolCfg.body_template} onChange={e => setSchoolCfg(s => ({ ...s, body_template: e.target.value }))} />
                  <p className="text-xs text-muted-foreground mt-1">
                    Placeholders: <code>{'{{phone}}'}</code>, <code>{'{{message}}'}</code>, <code>{'{{sender_id}}'}</code>, <code>{'{{api_key}}'}</code>.
                  </p>
                </div>
                <div className="flex items-center gap-2 md:col-span-2">
                  <Switch checked={schoolCfg.is_active} onCheckedChange={v => setSchoolCfg(s => ({ ...s, is_active: v }))} />
                  <Label className="!m-0">Active (uncheck to fall back to global config)</Label>
                </div>
              </div>
              <Button onClick={saveSchoolCfg} disabled={savingSchool} className="w-full">
                <Save className="h-4 w-4 mr-2" /> {savingSchool ? 'Saving…' : 'Save School SMS Provider'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>

          <CardTitle className="text-base">Global SMS Fallback</CardTitle>
          <CardDescription>Used when a school has no active SMS configuration.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Provider</Label>
              <Input value={global.provider} onChange={e => setGlobal(g => ({ ...g, provider: e.target.value }))} />
            </div>
            <div>
              <Label>Sender ID</Label>
              <Input value={global.sender_id} maxLength={11} onChange={e => setGlobal(g => ({ ...g, sender_id: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <Label>Endpoint</Label>
              <Input value={global.endpoint} onChange={e => setGlobal(g => ({ ...g, endpoint: e.target.value }))} placeholder="https://..." />
            </div>
            <div className="md:col-span-2">
              <Label>API Key</Label>
              <Input type="password" value={global.api_key} onChange={e => setGlobal(g => ({ ...g, api_key: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <Label>Headers JSON</Label>
              <Textarea rows={3} className="font-mono text-xs" value={global.headers_json} onChange={e => setGlobal(g => ({ ...g, headers_json: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <Label>Body Template JSON</Label>
              <Textarea rows={6} className="font-mono text-xs" value={global.body_template} onChange={e => setGlobal(g => ({ ...g, body_template: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2 md:col-span-2">
              <Switch checked={global.is_active} onCheckedChange={v => setGlobal(g => ({ ...g, is_active: v }))} />
              <Label className="!m-0">Active</Label>
            </div>
          </div>
          <Button onClick={saveGlobal} disabled={savingGlobal} className="w-full">
            <Save className="h-4 w-4 mr-2" /> {savingGlobal ? 'Saving…' : 'Save Global Config'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent SMS Logs</CardTitle>
          <CardDescription>Last 50 messages across all schools.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Sender</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentLogs.map(l => (
                <TableRow key={l.id}>
                  <TableCell className="text-xs">{new Date(l.sent_at).toLocaleString()}</TableCell>
                  <TableCell className="text-xs">{l.recipient}</TableCell>
                  <TableCell className="text-xs">{l.sender_id || '-'}</TableCell>
                  <TableCell className="text-xs">{l.provider || '-'}{l.used_global_fallback && ' (fallback)'}</TableCell>
                  <TableCell>
                    {l.status === 'sent' ? <Badge variant="outline" className="text-success">sent</Badge> : <Badge variant="destructive">{l.status}</Badge>}
                  </TableCell>
                </TableRow>
              ))}
              {recentLogs.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4">No SMS sent yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
