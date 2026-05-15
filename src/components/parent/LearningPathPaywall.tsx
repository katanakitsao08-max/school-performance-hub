import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Lock, Smartphone, CheckCircle2, Clock, XCircle, Loader2, Sparkles, Copy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useLearningPathAccess, type LpEntitlement } from '@/hooks/use-learning-path-access';
import { format } from 'date-fns';

const PAY_NUMBER = '0701594268';
const PRICE_PER_WEEK = 50;

interface Props {
  child: { id: string; full_name: string; school_id?: string | null };
}

export default function LearningPathPaywall({ child }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { latestEntitlement, history, refetch } = useLearningPathAccess(child.id);

  const [weeks, setWeeks] = useState(1);
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState(PAY_NUMBER);
  const [submitting, setSubmitting] = useState(false);

  const total = weeks * PRICE_PER_WEEK;

  const submit = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 8) {
      toast({ title: 'Invalid code', description: 'Enter the full M-Pesa confirmation code.', variant: 'destructive' });
      return;
    }
    if (!user || !child.school_id) return;
    setSubmitting(true);
    const { error } = await supabase.from('learning_path_entitlements').insert({
      learner_id: child.id,
      school_id: child.school_id,
      parent_user_id: user.id,
      mpesa_code: trimmed,
      mpesa_phone: phone.trim(),
      amount: total,
      weeks,
      paid_to: PAY_NUMBER,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: 'Could not submit', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Payment submitted', description: 'Awaiting confirmation. You will be notified once approved.' });
    setCode('');
    refetch();
  };

  const copyNumber = () => {
    navigator.clipboard.writeText(PAY_NUMBER);
    toast({ title: 'Number copied' });
  };

  const StatusPill = ({ s }: { s: LpEntitlement['status'] }) => {
    const map: Record<string, { c: string; icon: any; label: string }> = {
      pending: { c: 'bg-amber-500/15 text-amber-700 border-amber-500/30', icon: Clock, label: 'Pending review' },
      active: { c: 'bg-primary/15 text-primary border-primary/30', icon: CheckCircle2, label: 'Active' },
      rejected: { c: 'bg-destructive/15 text-destructive border-destructive/30', icon: XCircle, label: 'Rejected' },
      expired: { c: 'bg-muted text-muted-foreground border-border', icon: Clock, label: 'Expired' },
    };
    const v = map[s] || map.pending;
    const Icon = v.icon;
    return <Badge variant="outline" className={v.c}><Icon className="h-3 w-3 mr-1" />{v.label}</Badge>;
  };

  return (
    <div className="space-y-4">
      <Card className="shadow-card border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
        <CardHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center">
              <Lock className="h-5 w-5 text-primary" />
            </div>
            <Badge className="bg-primary/15 text-primary border-primary/30" variant="outline">
              <Sparkles className="h-3 w-3 mr-1" /> Premium
            </Badge>
          </div>
          <CardTitle className="text-lg">Unlock {child.full_name.split(' ')[0]}'s Learning Path</CardTitle>
          <CardDescription className="text-sm">
            CBC-aligned adaptive lessons, IQ assessment, fun exercises and rewards with
            Mr Kitsao the Teacher — only <span className="font-semibold text-foreground">KES {PRICE_PER_WEEK}/week</span> per child.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Pay instructions */}
          <div className="rounded-lg border bg-card p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Smartphone className="h-4 w-4 text-primary" /> Step 1 — Pay via M-Pesa
            </div>
            <ol className="text-xs text-muted-foreground space-y-1 pl-1 list-decimal list-inside">
              <li>Go to <span className="font-medium text-foreground">M-Pesa → Send Money</span></li>
              <li>Enter number <button onClick={copyNumber} className="font-mono font-semibold text-primary inline-flex items-center gap-1 hover:underline">{PAY_NUMBER} <Copy className="h-3 w-3" /></button></li>
              <li>Enter amount <span className="font-semibold text-foreground">KES {total}</span> ({weeks} week{weeks > 1 ? 's' : ''})</li>
              <li>Enter your M-Pesa PIN and confirm</li>
              <li>Copy the confirmation code (e.g. <span className="font-mono">SLE7XYZ123</span>)</li>
            </ol>
          </div>

          {/* Submit form */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4 text-primary" /> Step 2 — Submit payment
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Weeks</Label>
                <Input type="number" min={1} max={52} value={weeks}
                  onChange={(e) => setWeeks(Math.max(1, Math.min(52, parseInt(e.target.value) || 1)))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Total (KES)</Label>
                <Input value={total} readOnly className="bg-muted/50 font-semibold" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Your M-Pesa phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XXXXXXXX" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">M-Pesa confirmation code</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. SLE7XYZ123" className="font-mono uppercase" maxLength={20} />
            </div>
            <Button onClick={submit} disabled={submitting || !code.trim()} className="w-full">
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Submit for activation
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">
              Activation usually within a few hours. You'll be notified once approved.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* History */}
      {history.length > 0 && (
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Payment history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {history.slice(0, 5).map(e => (
              <div key={e.id} className="flex items-center justify-between text-xs border rounded-md p-2">
                <div>
                  <div className="font-mono font-semibold">{e.mpesa_code || '—'}</div>
                  <div className="text-muted-foreground">
                    KES {e.amount} • {e.weeks}w • {format(new Date(e.submitted_at), 'dd MMM, HH:mm')}
                  </div>
                  {e.rejection_reason && (
                    <div className="text-destructive mt-0.5">Reason: {e.rejection_reason}</div>
                  )}
                  {e.status === 'active' && e.expires_at && (
                    <div className="text-primary mt-0.5">Expires {format(new Date(e.expires_at), 'dd MMM yyyy')}</div>
                  )}
                </div>
                <StatusPill s={e.status} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
