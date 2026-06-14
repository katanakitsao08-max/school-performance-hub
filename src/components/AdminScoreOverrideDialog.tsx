import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  table: 'scores' | 'strand_scores';
  scoreId: string;
  learnerName?: string;
  subjectName?: string;
  currentScore: number | string | null;
  currentComment?: string | null;
  onSaved?: () => void;
};

export function AdminScoreOverrideDialog({
  open, onOpenChange, table, scoreId, learnerName, subjectName,
  currentScore, currentComment, onSaved,
}: Props) {
  const [reason, setReason] = useState('');
  const [score, setScore] = useState<string>(String(currentScore ?? ''));
  const [comment, setComment] = useState<string>(currentComment ?? '');
  const [relock, setRelock] = useState(true);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!reason.trim() || reason.trim().length < 5) {
      toast.error('Please enter a reason (min 5 characters).');
      return;
    }
    const num = Number(score);
    if (Number.isNaN(num)) { toast.error('Score must be a number'); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('score-admin-override', {
        body: {
          table, score_id: scoreId,
          new_value: { score: num, teacher_comment: comment || null },
          reason: reason.trim(),
          relock,
        },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error ?? error?.message);
      toast.success(relock ? 'Saved & re-locked' : 'Saved (unlocked)');
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to save');
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Admin Override — Unlock & Edit</DialogTitle>
          <DialogDescription>
            {learnerName ? `${learnerName} · ` : ''}{subjectName ?? ''}
            <br />Every change is recorded in the audit log.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Reason for change *</Label>
            <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Marking error confirmed by teacher" />
          </div>
          <div>
            <Label>New Score</Label>
            <Input type="number" value={score} onChange={e => setScore(e.target.value)} />
          </div>
          <div>
            <Label>Teacher comment</Label>
            <Input value={comment} onChange={e => setComment(e.target.value)} />
          </div>
          <div className="flex items-center justify-between rounded border p-3">
            <div>
              <div className="text-sm font-medium">Re-lock after save</div>
              <div className="text-xs text-muted-foreground">Recommended. Off keeps it editable for teachers.</div>
            </div>
            <Switch checked={relock} onCheckedChange={setRelock} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
