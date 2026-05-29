import { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Save, School, Phone, MapPin, Mail, Upload, ImageIcon, Trash2, MessageCircle, MessageSquareText, Plus, X, RotateCcw } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { DEFAULT_PRINCIPAL_COMMENT_BANDS, type PrincipalCommentBand } from '@/lib/principal-comments';


const SETTING_KEYS = [
  { key: 'school_name', label: 'School Name', icon: School, placeholder: 'e.g. TAKAYE SCHOOL' },
  { key: 'school_motto', label: 'School Motto', icon: School, placeholder: 'e.g. Education is the key to success' },
  { key: 'school_address', label: 'School Address', icon: MapPin, placeholder: 'e.g. P.O. Box 123, Nairobi' },
  { key: 'school_phone', label: 'Phone Number', icon: Phone, placeholder: 'e.g. +254 700 000 000' },
  { key: 'school_email', label: 'Email Address', icon: Mail, placeholder: 'e.g. info@takayeschool.com' },
  { key: 'closing_date', label: 'Closing Date', icon: School, placeholder: 'e.g. 28th March 2026' },
  { key: 'opening_date', label: 'Opening Date', icon: School, placeholder: 'e.g. 5th May 2026' },
];

export default function SettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { schoolId, role, user } = useAuth();
  const [form, setForm] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [waNumber, setWaNumber] = useState('');
  const [savingWa, setSavingWa] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load current admin's saved WhatsApp number
  useEffect(() => {
    if (!user?.id) return;
    supabase.from('profiles').select('whatsapp_number').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => setWaNumber((data as any)?.whatsapp_number || ''));
  }, [user?.id]);

  const saveWaNumber = async () => {
    if (!user?.id) return;
    setSavingWa(true);
    const trimmed = waNumber.trim();
    const { error } = await supabase.from('profiles')
      .update({ whatsapp_number: trimmed || null } as any)
      .eq('user_id', user.id);
    setSavingWa(false);
    if (error) { toast({ title: 'Save failed', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'WhatsApp number saved' });
  };

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ['school-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('school_settings').select('*');
      if (error) throw error;
      return data || [];
    },
  });

  const schoolLogoUrl = settings.find(s => s.key === 'school_logo_url')?.value || '';

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

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !schoolId) return;

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${schoolId}/logo.${ext}`;

      // Remove old logo
      await supabase.storage.from('school-logos').remove([path]);

      const { error: uploadError } = await supabase.storage
        .from('school-logos')
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('school-logos').getPublicUrl(path);
      const logoUrl = urlData.publicUrl + '?t=' + Date.now();

      // Save URL to school_settings
      const existing = settings.find(s => s.key === 'school_logo_url');
      if (existing) {
        await supabase.from('school_settings').update({ value: logoUrl }).eq('id', existing.id);
      } else {
        await supabase.from('school_settings').insert({ key: 'school_logo_url', value: logoUrl, school_id: schoolId });
      }

      queryClient.invalidateQueries({ queryKey: ['school-settings'] });
      toast({ title: 'School logo uploaded successfully' });
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveLogo = async () => {
    if (!schoolId) return;
    setUploading(true);
    try {
      const existing = settings.find(s => s.key === 'school_logo_url');
      if (existing) {
        await supabase.from('school_settings').update({ value: '' }).eq('id', existing.id);
      }
      // Remove from storage
      const { data: files } = await supabase.storage.from('school-logos').list(schoolId);
      if (files?.length) {
        await supabase.storage.from('school-logos').remove(files.map(f => `${schoolId}/${f.name}`));
      }
      queryClient.invalidateQueries({ queryKey: ['school-settings'] });
      toast({ title: 'Logo removed' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const canUploadLogo = role === 'admin' || role === 'super_admin';
  const canEditBands = role === 'admin' || role === 'super_admin';

  // -------- Principal Comment Bands (rule-based, editable) --------
  const { data: bandsRaw } = useQuery({
    queryKey: ['principal-comment-bands', schoolId],
    queryFn: async () => {
      if (!schoolId) return [];
      const { data } = await supabase
        .from('principal_comment_bands' as any)
        .select('id, min_score, max_score, comment, sort_order')
        .eq('school_id', schoolId)
        .order('sort_order', { ascending: true });
      return (data || []) as any[];
    },
    enabled: !!schoolId && canEditBands,
  });

  const [bands, setBands] = useState<PrincipalCommentBand[]>(DEFAULT_PRINCIPAL_COMMENT_BANDS);
  const [savingBands, setSavingBands] = useState(false);

  useEffect(() => {
    if (bandsRaw && bandsRaw.length > 0) {
      setBands(bandsRaw.map(r => ({
        id: r.id,
        min_score: Number(r.min_score),
        max_score: Number(r.max_score),
        comment: r.comment || '',
        sort_order: r.sort_order ?? 0,
      })));
    } else if (bandsRaw && bandsRaw.length === 0) {
      setBands(DEFAULT_PRINCIPAL_COMMENT_BANDS);
    }
  }, [bandsRaw]);

  const updateBand = (idx: number, patch: Partial<PrincipalCommentBand>) =>
    setBands(prev => prev.map((b, i) => i === idx ? { ...b, ...patch } : b));
  const addBand = () =>
    setBands(prev => [...prev, { min_score: 0, max_score: 0, comment: '', sort_order: prev.length + 1 }]);
  const removeBand = (idx: number) =>
    setBands(prev => prev.filter((_, i) => i !== idx));
  const resetBands = () => setBands(DEFAULT_PRINCIPAL_COMMENT_BANDS);

  const saveBands = async () => {
    if (!schoolId) return;
    // Basic validation
    for (const b of bands) {
      if (b.min_score < 0 || b.max_score > 100 || b.min_score > b.max_score) {
        toast({ title: 'Invalid band', description: 'Each band must have 0 ≤ min ≤ max ≤ 100.', variant: 'destructive' });
        return;
      }
      if (!b.comment.trim()) {
        toast({ title: 'Missing comment', description: 'Every band needs a comment.', variant: 'destructive' });
        return;
      }
    }
    setSavingBands(true);
    try {
      // Replace all bands for this school
      await supabase.from('principal_comment_bands' as any).delete().eq('school_id', schoolId);
      const rows = bands.map((b, i) => ({
        school_id: schoolId,
        min_score: b.min_score,
        max_score: b.max_score,
        comment: b.comment.trim(),
        sort_order: i + 1,
      }));
      const { error } = await supabase.from('principal_comment_bands' as any).insert(rows as any);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['principal-comment-bands', schoolId] });
      toast({ title: 'Principal comment bands saved' });
    } catch (err: any) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    } finally {
      setSavingBands(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in max-w-2xl">
        <div>
          <h1 className="text-2xl font-display font-bold">School Settings</h1>
          <p className="text-muted-foreground">Manage your school details that appear on reports and documents</p>
        </div>

        {/* My Personal WhatsApp Number — used for click-to-send wa.me links */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              My WhatsApp Number
            </CardTitle>
            <CardDescription>
              When you click <strong>"Send via my WhatsApp"</strong> on report sending, messages open in your personal WhatsApp app — so parents see <em>your</em> number as the sender. Save your number here so it's pre-filled.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                Your personal WhatsApp number
              </Label>
              <Input
                value={waNumber}
                onChange={e => setWaNumber(e.target.value)}
                placeholder="e.g. +254 712 345 678"
                inputMode="tel"
              />
              <p className="text-xs text-muted-foreground">
                Include country code. WhatsApp must be installed on the device you'll send from.
              </p>
            </div>
            <Button onClick={saveWaNumber} disabled={savingWa} variant="outline">
              <Save className="mr-2 h-4 w-4" />
              {savingWa ? 'Saving…' : 'Save number'}
            </Button>
          </CardContent>
        </Card>

        {/* School Logo Card */}
        {canUploadLogo && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">School Logo</CardTitle>
              <CardDescription>Upload your school logo to appear on reports and documents</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 rounded-xl border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-muted/30">
                  {schoolLogoUrl ? (
                    <img src={schoolLogoUrl} alt="Current school logo used on reports and documents" className="w-full h-full object-contain p-1" />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                  )}
                </div>
                <div className="space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {uploading ? 'Uploading...' : 'Upload Logo'}
                  </Button>
                  {schoolLogoUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveLogo}
                      disabled={uploading}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remove
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground">PNG, JPG or WebP. Max 2MB.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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

        {/* Principal Comment Bands — rule-based, editable */}
        {canEditBands && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquareText className="h-5 w-5 text-primary" />
                Report Comments — Principal's Comment Bands
              </CardTitle>
              <CardDescription>
                Comments are auto-applied on report cards based on each learner's mean score (%).
                You can edit, add, or remove bands. Ranges are inclusive (e.g. 80–100).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {bands.map((b, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-start rounded-lg border border-border p-3 bg-muted/20">
                    <div className="col-span-3 sm:col-span-2 space-y-1">
                      <Label className="text-xs">Min %</Label>
                      <Input
                        type="number" min={0} max={100} inputMode="numeric"
                        value={b.min_score}
                        onChange={e => updateBand(idx, { min_score: Number(e.target.value) })}
                      />
                    </div>
                    <div className="col-span-3 sm:col-span-2 space-y-1">
                      <Label className="text-xs">Max %</Label>
                      <Input
                        type="number" min={0} max={100} inputMode="numeric"
                        value={b.max_score}
                        onChange={e => updateBand(idx, { max_score: Number(e.target.value) })}
                      />
                    </div>
                    <div className="col-span-5 sm:col-span-7 space-y-1">
                      <Label className="text-xs">Comment</Label>
                      <Textarea
                        rows={2}
                        value={b.comment}
                        onChange={e => updateBand(idx, { comment: e.target.value })}
                        placeholder="e.g. Excellent performance. Keep up the good work."
                      />
                    </div>
                    <div className="col-span-1 flex items-end justify-end pt-5">
                      <Button
                        variant="ghost" size="icon"
                        onClick={() => removeBand(idx)}
                        className="text-destructive hover:text-destructive"
                        aria-label="Remove band"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={addBand}>
                  <Plus className="mr-2 h-4 w-4" /> Add band
                </Button>
                <Button variant="ghost" size="sm" onClick={resetBands}>
                  <RotateCcw className="mr-2 h-4 w-4" /> Reset to defaults
                </Button>
                <Button onClick={saveBands} disabled={savingBands} className="ml-auto">
                  <Save className="mr-2 h-4 w-4" />
                  {savingBands ? 'Saving…' : 'Save comment bands'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Tip: cover 0–100 with no gaps so every learner gets a comment. If a mean falls outside
                all bands, the lowest band is used.
              </p>
            </CardContent>
          </Card>
        )}

      </div>
    </DashboardLayout>
  );
}
