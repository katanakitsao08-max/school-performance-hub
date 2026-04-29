import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import {
  SCHOOL_FEATURE_KEYS,
  FEATURE_LABELS,
  useSchoolFeatureToggles,
  type SchoolFeatureKey,
} from '@/hooks/use-school-feature-toggles';
import { ToggleRight } from 'lucide-react';

interface Props {
  schools: Array<{ id: string; school_name: string }>;
}

export default function SchoolFeatureTogglesSection({ schools }: Props) {
  const [schoolId, setSchoolId] = useState<string>(schools[0]?.id || '');
  const { toast } = useToast();
  const qc = useQueryClient();
  const { toggles, refetch, isLoading } = useSchoolFeatureToggles(schoolId);

  const setToggle = async (key: SchoolFeatureKey, value: boolean) => {
    if (!schoolId) return;
    // Upsert by (school_id, key)
    const { data: existing } = await supabase
      .from('school_settings')
      .select('id')
      .eq('school_id', schoolId)
      .eq('key', key)
      .maybeSingle();
    let error: any = null;
    if (existing?.id) {
      ({ error } = await supabase
        .from('school_settings')
        .update({ value: value ? 'true' : 'false' })
        .eq('id', existing.id));
    } else {
      ({ error } = await supabase
        .from('school_settings')
        .insert({ school_id: schoolId, key, value: value ? 'true' : 'false' }));
    }
    if (error) {
      toast({ title: 'Failed to update', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: `${FEATURE_LABELS[key]} ${value ? 'enabled' : 'disabled'}` });
    await refetch();
    qc.invalidateQueries({ queryKey: ['school-feature-toggles'] });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-display font-semibold flex items-center gap-2">
          <ToggleRight className="h-4 w-4 text-primary" />
          Per-School Feature Toggles
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 max-w-md">
          <Label className="text-xs">Select School</Label>
          <Select value={schoolId} onValueChange={setSchoolId}>
            <SelectTrigger><SelectValue placeholder="Choose a school" /></SelectTrigger>
            <SelectContent>
              {schools.map(s => <SelectItem key={s.id} value={s.id}>{s.school_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {SCHOOL_FEATURE_KEYS.map(key => {
            const on = toggles?.[key] ?? true;
            return (
              <div key={key} className="flex items-center justify-between rounded-lg border p-3">
                <div className="pr-3">
                  <p className="text-sm font-medium">{FEATURE_LABELS[key]}</p>
                  <p className="text-xs text-muted-foreground">{on ? 'Enabled' : 'Disabled'} for this school</p>
                </div>
                <Switch
                  checked={on}
                  disabled={isLoading || !schoolId}
                  onCheckedChange={(v) => setToggle(key, !!v)}
                />
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          New features default to enabled. Disabling here hides the feature for users of the selected school without affecting any data.
        </p>
      </CardContent>
    </Card>
  );
}
