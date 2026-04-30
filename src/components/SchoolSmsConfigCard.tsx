import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, Save, Eye, EyeOff } from 'lucide-react';

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

export default function SchoolSmsConfigCard() {
  const { schoolId } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    provider: 'olympus_teleserve',
    endpoint: '',
    api_key: '',
    sender_id: '',
    headers_json: '{}',
    body_template: JSON.stringify(DEFAULT_BODY_TEMPLATE, null, 2),
    is_active: true,
  });

  const { data: cfg } = useQuery({
    queryKey: ['school-sms-config', schoolId],
    queryFn: async () => {
      if (!schoolId) return null;
      const { data } = await supabase.from('school_sms_config' as any).select('*').eq('school_id', schoolId).maybeSingle();
      return data;
    },
    enabled: !!schoolId,
  });

  const { data: credits } = useQuery({
    queryKey: ['school-sms-credits', schoolId],
    queryFn: async () => {
      if (!schoolId) return null;
      const { data } = await supabase.from('school_sms_credits' as any).select('*').eq('school_id', schoolId).maybeSingle();
      return data as any;
    },
    enabled: !!schoolId,
  });

  useEffect(() => {
    if (cfg) {
      const c: any = cfg;
      setForm({
        provider: c.provider || 'olympus_teleserve',
        endpoint: c.endpoint || '',
        api_key: c.api_key || '',
        sender_id: c.sender_id || '',
        headers_json: JSON.stringify(c.headers_json || {}, null, 2),
        body_template: JSON.stringify(c.body_template || DEFAULT_BODY_TEMPLATE, null, 2),
        is_active: c.is_active ?? true,
      });
    }
  }, [cfg]);

  const maskedKey = form.api_key
    ? '••••' + form.api_key.slice(-4)
    : '';

  const save = async () => {
    if (!schoolId) return;
    setSaving(true);
    try {
      let headers_json: any = {};
      let body_template: any = {};
      try { headers_json = JSON.parse(form.headers_json || '{}'); } catch { throw new Error('Headers must be valid JSON'); }
      try { body_template = JSON.parse(form.body_template || '{}'); } catch { throw new Error('Body template must be valid JSON'); }

      const payload = {
        school_id: schoolId,
        provider: form.provider,
        endpoint: form.endpoint.trim(),
        api_key: form.api_key,
        sender_id: form.sender_id.trim().slice(0, 11),
        headers_json,
        body_template,
        is_active: form.is_active,
      };
      const { error } = await supabase.from('school_sms_config' as any).upsert(payload, { onConflict: 'school_id' });
      if (error) throw error;
      toast({ title: 'SMS settings saved' });
      qc.invalidateQueries({ queryKey: ['school-sms-config', schoolId] });
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
          <MessageSquare className="h-5 w-5 text-primary" /> School SMS Provider
        </CardTitle>
        <CardDescription>Connect your school's SMS API (e.g. Olympus Teleserve). Falls back to platform default if disabled.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline">Balance: {credits?.balance ?? 0}</Badge>
          <Badge variant="outline">Used: {credits?.used ?? 0}</Badge>
          {credits && credits.balance <= (credits.low_threshold || 50) && (
            <Badge variant="destructive">Low balance</Badge>
          )}
          {credits && !credits.enabled && <Badge variant="destructive">SMS disabled by Super Admin</Badge>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>Provider</Label>
            <Input value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))} placeholder="olympus_teleserve" />
          </div>
          <div>
            <Label>Sender ID (max 11 chars)</Label>
            <Input value={form.sender_id} maxLength={11} onChange={e => setForm(f => ({ ...f, sender_id: e.target.value }))} placeholder="STMARYS" />
          </div>
          <div className="md:col-span-2">
            <Label>API Endpoint (HTTPS)</Label>
            <Input value={form.endpoint} onChange={e => setForm(f => ({ ...f, endpoint: e.target.value }))} placeholder="https://api.olympusteleserve.co.ke/api/services/sendsms/" />
          </div>
          <div className="md:col-span-2">
            <Label>API Key</Label>
            <div className="flex gap-2">
              <Input
                type={showKey ? 'text' : 'password'}
                value={showKey ? form.api_key : (form.api_key ? maskedKey : '')}
                onChange={e => setForm(f => ({ ...f, api_key: e.target.value }))}
                placeholder="Paste your provider API key"
              />
              <Button type="button" variant="outline" size="icon" onClick={() => setShowKey(s => !s)}>
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Stored encrypted at rest. Never exposed to the browser when sending.</p>
          </div>
          <div className="md:col-span-2">
            <Label>Custom Headers (JSON)</Label>
            <Textarea rows={3} value={form.headers_json} onChange={e => setForm(f => ({ ...f, headers_json: e.target.value }))} className="font-mono text-xs" />
          </div>
          <div className="md:col-span-2">
            <Label>Request Body Template (JSON)</Label>
            <Textarea rows={8} value={form.body_template} onChange={e => setForm(f => ({ ...f, body_template: e.target.value }))} className="font-mono text-xs" />
            <p className="text-xs text-muted-foreground mt-1">
              Use placeholders: <code>{'{{phone}}'}</code>, <code>{'{{message}}'}</code>, <code>{'{{sender_id}}'}</code>, <code>{'{{api_key}}'}</code>. Set <code>body_type</code> to <code>"form"</code> for form-encoded.
            </p>
          </div>
          <div className="flex items-center gap-2 md:col-span-2">
            <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
            <Label className="!m-0">Use this configuration (uncheck to fall back to platform default)</Label>
          </div>
        </div>

        <Button onClick={save} disabled={saving} className="w-full">
          <Save className="h-4 w-4 mr-2" /> {saving ? 'Saving…' : 'Save SMS Configuration'}
        </Button>
      </CardContent>
    </Card>
  );
}
