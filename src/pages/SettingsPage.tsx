import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Save, School, Phone, MapPin, Mail } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

const SETTING_KEYS = [
  { key: 'school_name', label: 'School Name', icon: School, placeholder: 'e.g. TAKAYE SCHOOL' },
  { key: 'school_motto', label: 'School Motto', icon: School, placeholder: 'e.g. Education is the key to success' },
  { key: 'school_address', label: 'School Address', icon: MapPin, placeholder: 'e.g. P.O. Box 123, Nairobi' },
  { key: 'school_phone', label: 'Phone Number', icon: Phone, placeholder: 'e.g. +254 700 000 000' },
  { key: 'school_email', label: 'Email Address', icon: Mail, placeholder: 'e.g. info@takayeschool.com' },
];

export default function SettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { schoolId } = useAuth();
  const [form, setForm] = useState<Record<string, string>>({});

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ['school-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('school_settings').select('*');
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    const mapped: Record<string, string> = {};
    SETTING_KEYS.forEach(({ key }) => {
      const found = settings.find(s => s.key === key);
      mapped[key] = found?.value || '';
    });
    setForm(mapped);
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      for (const { key } of SETTING_KEYS) {
        const value = form[key] || '';
        const existing = settings.find(s => s.key === key);
        if (existing) {
          await supabase.from('school_settings').update({ value }).eq('id', existing.id);
        } else if (value) {
          await supabase.from('school_settings').insert({ key, value, school_id: schoolId });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-settings'] });
      queryClient.invalidateQueries({ queryKey: ['school-name'] });
      toast({ title: 'Settings saved successfully' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in max-w-2xl">
        <div>
          <h1 className="text-2xl font-display font-bold">School Settings</h1>
          <p className="text-muted-foreground">Manage your school details that appear on reports and documents</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">School Information</CardTitle>
            <CardDescription>These details will appear on report cards and PDF exports</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-5">
              {SETTING_KEYS.map(({ key, label, icon: Icon, placeholder }) => (
                <div key={key} className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {label}
                  </Label>
                  {key === 'school_address' ? (
                    <Textarea
                      value={form[key] || ''}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      placeholder={placeholder}
                      rows={2}
                    />
                  ) : (
                    <Input
                      value={form[key] || ''}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      placeholder={placeholder}
                    />
                  )}
                </div>
              ))}
              <Button type="submit" disabled={saveMutation.isPending} className="w-full">
                <Save className="mr-2 h-4 w-4" />
                {saveMutation.isPending ? 'Saving...' : 'Save Settings'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
