import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, ArrowLeft } from 'lucide-react';

const COUNTIES = ['Nairobi','Mombasa','Kisumu','Nakuru','Uasin Gishu','Kiambu','Machakos','Kajiado','Meru','Murang\'a','Kakamega','Bungoma','Other'];

export default function RegisterSchool() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    school_name: '', school_type: 'primary', county: '',
    admin_full_name: '', admin_phone: '', admin_email: '',
    learners_count: 0, selected_plan_id: '', terms_accepted: false,
  });

  useEffect(() => { document.title = 'Register Your School | PerformTrack'; }, []);

  const { data: plans = [] } = useQuery({
    queryKey: ['public-plans'],
    queryFn: async () => {
      const { data } = await supabase.from('subscription_plans').select('id,name,price_monthly,price_term,price_annual,description').eq('is_active', true).order('sort_order');
      return data || [];
    },
  });

  const selectedPlan: any = plans.find((p: any) => p.id === form.selected_plan_id);
  const isPerLearner = selectedPlan && Number(selectedPlan.price_monthly || 0) === 0 && (Number(selectedPlan.price_term || 0) > 0 || Number(selectedPlan.price_annual || 0) > 0);
  const termCost = isPerLearner ? Number(selectedPlan.price_term || 0) * (form.learners_count || 0) : 0;
  const annualCost = isPerLearner ? Number(selectedPlan.price_annual || 0) * (form.learners_count || 0) : 0;

  const onChange = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.terms_accepted) { toast.error('Please accept the terms to continue'); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke('school-signup-submit', { body: form });
      if (error) throw error;
      setSubmitted(true);
    } catch (err: any) {
      toast.error(err?.message || 'Submission failed');
    } finally { setSubmitting(false); }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 to-background">
        <Card className="max-w-md w-full">
          <CardContent className="pt-10 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <h1 className="text-2xl font-display font-bold">Application Received</h1>
            <p className="text-muted-foreground">Thank you! Our team will review your registration and email your login credentials within 24 hours.</p>
            <Button asChild className="w-full"><Link to="/">Back to Home</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Home
        </Link>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-display">Register Your School</CardTitle>
            <p className="text-sm text-muted-foreground">Get your school onto PerformTrack. Approval typically takes under 24 hours.</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label>School Name *</Label>
                  <Input required value={form.school_name} onChange={e => onChange('school_name', e.target.value)} />
                </div>
                <div>
                  <Label>School Type *</Label>
                  <Select value={form.school_type} onValueChange={v => onChange('school_type', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="primary">Primary</SelectItem>
                      <SelectItem value="junior_secondary">Junior Secondary</SelectItem>
                      <SelectItem value="combined">Combined (Primary + JSS)</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>County *</Label>
                  <Select value={form.county} onValueChange={v => onChange('county', v)}>
                    <SelectTrigger><SelectValue placeholder="Select county" /></SelectTrigger>
                    <SelectContent>{COUNTIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2 border-t pt-3 mt-2">
                  <p className="text-sm font-semibold text-foreground mb-1">School Administrator</p>
                </div>
                <div>
                  <Label>Full Name *</Label>
                  <Input required value={form.admin_full_name} onChange={e => onChange('admin_full_name', e.target.value)} />
                </div>
                <div>
                  <Label>Phone *</Label>
                  <Input required type="tel" placeholder="07XXXXXXXX" value={form.admin_phone} onChange={e => onChange('admin_phone', e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <Label>Email *</Label>
                  <Input required type="email" value={form.admin_email} onChange={e => onChange('admin_email', e.target.value)} />
                </div>
                <div>
                  <Label>Number of Learners</Label>
                  <Input type="number" min={0} value={form.learners_count} onChange={e => onChange('learners_count', Number(e.target.value))} />
                </div>
                <div>
                  <Label>Subscription Plan</Label>
                  <Select value={form.selected_plan_id} onValueChange={v => onChange('selected_plan_id', v)}>
                    <SelectTrigger><SelectValue placeholder="Choose a plan" /></SelectTrigger>
                    <SelectContent>
                      {plans.map((p: any) => {
                        const perL = Number(p.price_monthly||0)===0 && (Number(p.price_term||0)>0 || Number(p.price_annual||0)>0);
                        const label = perL
                          ? `${p.name} — KES ${Number(p.price_term).toLocaleString()}/learner/term`
                          : (p.price_monthly ? `${p.name} — KES ${Number(p.price_monthly).toLocaleString()}/mo` : p.name);
                        return <SelectItem key={p.id} value={p.id}>{label}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedPlan && (
                <div className="rounded-lg border bg-primary/5 p-3 text-sm space-y-1">
                  <div className="font-semibold">{selectedPlan.name}</div>
                  {selectedPlan.description && <div className="text-muted-foreground text-xs">{selectedPlan.description}</div>}
                  {isPerLearner && (
                    <div className="pt-1">
                      Estimated cost for <strong>{form.learners_count || 0}</strong> learners:
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                        <span>Per term: <strong>KES {termCost.toLocaleString()}</strong></span>
                        <span>Per year: <strong>KES {annualCost.toLocaleString()}</strong></span>
                      </div>
                    </div>
                  )}
                  <div className="pt-2 text-xs">
                    After approval, pay via <strong>M-Pesa Send Money</strong> to <strong>0701594268</strong> (PerformTrack).
                  </div>
                </div>
              )}
              <div className="flex items-start gap-2 pt-2">
                <Checkbox id="terms" checked={form.terms_accepted} onCheckedChange={v => onChange('terms_accepted', !!v)} />
                <Label htmlFor="terms" className="text-sm font-normal leading-snug">
                  I confirm the information above is accurate and accept the PerformTrack Terms of Service and Privacy Policy.
                </Label>
              </div>
              <Button type="submit" className="w-full" disabled={submitting || !form.terms_accepted}>
                {submitting ? 'Submitting…' : 'Submit Registration'}
              </Button>
              <p className="text-xs text-muted-foreground text-center">Already have an account? <Link to="/login" className="text-primary hover:underline">Sign in</Link></p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
