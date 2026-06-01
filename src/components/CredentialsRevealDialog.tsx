import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, Check, KeyRound } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  loginEmail: string;
  username: string;
  password: string;
  fullName?: string;
}

/** One-time credential reveal shown after creating a school admin / user.
 *  Lets the creator copy the exact synthetic email + password to share. */
export default function CredentialsRevealDialog({ open, onClose, loginEmail, username, password, fullName }: Props) {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (key: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const block = `Login URL: ${window.location.origin}/login\nUsername: ${username}\nPassword: ${password}`;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" /> Account Created
          </DialogTitle>
          <DialogDescription>
            Share these credentials securely with {fullName || 'the user'}. This password is shown <strong>once</strong> — save it now.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Username (what they type on the login page)" value={username} onCopy={() => copy('u', username)} copied={copied === 'u'} />
          <Field label="Password" value={password} mono onCopy={() => copy('p', password)} copied={copied === 'p'} />
          <Field label="Internal login email" value={loginEmail} mono onCopy={() => copy('e', loginEmail)} copied={copied === 'e'} />
          <Button variant="outline" className="w-full" onClick={() => copy('all', block)}>
            {copied === 'all' ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
            Copy all (paste in WhatsApp/SMS)
          </Button>
          <p className="text-xs text-muted-foreground">
            Tip: the user types <strong>{username}</strong> in the username field and <strong>{password}</strong> in the password field — no need for the email.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, mono, onCopy, copied }: { label: string; value: string; mono?: boolean; onCopy: () => void; copied: boolean }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-2 mt-1">
        <Input readOnly value={value} className={mono ? 'font-mono text-sm' : 'text-sm'} />
        <Button variant="outline" size="icon" onClick={onCopy}>
          {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
