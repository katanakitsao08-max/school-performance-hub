import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Globe, Save, Eye, EyeOff } from 'lucide-react';

const DEFAULT_BODY = { type: 'plain' };

/** Single global SMS provider. Only Super Admin manages it. All schools share it. */
export default function GlobalSmsConfigCard() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    provider: 'olympus_teleserve',
    endpoint: 'https://sms.ots.co.ke/api/v3/sms/send',
    api_key: '',
    sender_id: 'PERFORMTRK',
    partner_id: '',
    body_template: JSON.stringify(DEFAULT_BODY, null, 2),
    is_active: true,
  });

  const { data: cfg } = useQuery({
    queryKey: ['global-sms-config'],
    queryFn: async () => {
      const { data } = await supabase.from('global_sms_config' as any).select('*').maybeSingle();
      return data as any;
    },
  });

  useEffect(() => {
    if (cfg) {
      setForm({
        provider: cfg.provider || 'olympus_teleserve',
        endpoint: cfg.endpoint || 'https://sms.ots.co.ke/api/v3/sms/send',
        api_key: cfg.api_key || '',
        sender_id: cfg.sender_id || 'PERFORMTRK',
        partner_id: cfg.partner_id || '',
        body_template: JSON.stringify(cfg.body_template || DEFAULT_BODY, null, 2),
        is_active: cfg.is_active ?? true,
      });
    }
  }, [cfg]);

  const maskedKey = form.api_key ? '••••' + form.api_key.slice(-4) : '';

  const save = async () => {
    setSaving(true);
    try {
      let body_template: any = DEFAULT_BODY;
      try { body_template = JSON.parse(form.body_template || '{}'); } catch { throw new Error('Body template must be valid JSON'); }
      const payload: any = {
        singleton: true,
        provider: form.provider,
        endpoint: form.endpoint.trim(),
        api_key: form.api_key,
        sender_id: form.sender_id.trim().slice(0, 11),
        partner_id: form.partner_id || null,
        body_template,
        headers_json: {},
        is_active: form.is_active,
      };
      if (cfg?.id) {
        const { error } = await supabase.from('global_sms_config' as any).update(payload).eq('id', cfg.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('global_sms_config' as any).insert(payload);
        if (error) throw error;
      }
      toast({ title: 'Global SMS settings saved' });
      qc.invalidateQueries({ queryKey: ['global-sms-config'] });
    } catch (e: any) {
      toast({ title: 'Save failed', description: e?.message || String(e), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe className="h-5 w-5 text-primary" /> Global SMS Provider
        </CardTitle>
        <CardDescription>
          One provider for the entire platform. All schools send through this credential and are billed against their allocated credits.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>Provider</Label>
            <Input value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))} />
          </div>
          <div>
            <Label>Sender ID (max 11 chars)</Label>
            <Input value={form.sender_id} maxLength={11} onChange={e => setForm(f => ({ ...f, sender_id: e.target.value }))} />
          </div>
          <div className="md:col-span-2">
            <Label>API Endpoint (HTTPS)</Label>
            <Input value={form.endpoint} onChange={e => setForm(f => ({ ...f, endpoint: e.target.value }))} />
          </div>
          <div className="md:col-span-2">
            <Label>API Token (Bearer)</Label>
            <div className="flex gap-2">
              <Input
                type={showKey ? 'text' : 'password'}
                value={showKey ? form.api_key : (form.api_key ? maskedKey : '')}
                onChange={e => setForm(f => ({ ...f, api_key: e.target.value }))}
                placeholder="Paste provider token"
              />
              <Button type="button" variant="outline" size="icon" onClick={() => setShowKey(s => !s)}>
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Used only on the server. Never sent to browsers.</p>
          </div>
          <div>
            <Label>Partner ID (optional)</Label>
            <Input value={form.partner_id} onChange={e => setForm(f => ({ ...f, partner_id: e.target.value }))} />
          </div>
          <div className="md:col-span-2">
            <Label>Body Template (JSON, advanced)</Label>
            <Textarea rows={4} className="font-mono text-xs" value={form.body_template} onChange={e => setForm(f => ({ ...f, body_template: e.target.value }))} />
          </div>
          <div className="flex items-center gap-2 md:col-span-2">
            <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
            <Label className="!m-0">Active — schools may send SMS</Label>
          </div>
        </div>
        <Button onClick={save} disabled={saving} className="w-full">
          <Save className="h-4 w-4 mr-2" /> {saving ? 'Saving…' : 'Save Global SMS Configuration'}
        </Button>
      </CardContent>
    </Card>
  );
}
