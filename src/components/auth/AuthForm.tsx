import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, User, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const resolveEmail = (input: string) => {
  const trimmed = (input || '').trim();
  if (trimmed.includes('@')) return trimmed.toLowerCase();
  return `${trimmed.toLowerCase().replace(/\s+/g, '')}@school.local`;
};

export function AuthForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    try {
      const msg = sessionStorage.getItem('pt_access_denied');
      if (msg) {
        sessionStorage.removeItem('pt_access_denied');
        toast({ title: 'Access denied', description: msg, variant: 'destructive' });
      }
    } catch {}
  }, [toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(resolveEmail(username), (password || '').trim());
      navigate('/');
    } catch (error: any) {
      toast({
        title: 'Login Failed',
        description: error.message || 'Invalid credentials',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="username" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Username / Phone Number
        </Label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. jdoe or 0712345678"
            className="h-12 pl-10 rounded-xl bg-muted/40 border-muted"
            autoComplete="username"
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Password
        </Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="h-12 pl-10 pr-10 rounded-xl bg-muted/40 border-muted"
            autoComplete="current-password"
            required
          />
          <button
            type="button"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-semibold shadow-lg shadow-primary/20 hover-scale"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
            Signing in...
          </span>
        ) : (
          'Sign In'
        )}
      </Button>

    </form>
  );
}
