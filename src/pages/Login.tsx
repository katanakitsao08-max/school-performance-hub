import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Eye, EyeOff, Shield, GraduationCap, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import performTrackLogo from '@/assets/performtrack-logo.png';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: settings } = useQuery({
    queryKey: ['school-settings-login'],
    queryFn: async () => {
      const { data } = await supabase.from('school_settings').select('key, value');
      const map: Record<string, string> = {};
      data?.forEach(s => { map[s.key] = s.value; });
      return map;
    },
  });

  const schoolName = settings?.school_name || 'CBC Smart School';
  const schoolMotto = settings?.school_motto || 'Excellence in Competency Based Education';

  const resolveEmail = (input: string) => {
    if (input.includes('@')) return input;
    return `${input.toLowerCase().replace(/\s+/g, '')}@school.local`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(resolveEmail(username), password);
      // Role-based redirect will be handled by SmartRedirect at "/"
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
    <div className="min-h-screen flex">
      <Helmet>
        <title>Sign in to PerformTrack — CBC School Portal</title>
        <meta name="description" content="Sign in to PerformTrack to manage CBC marks entry, KPSEA/KJSEA reports, attendance, fees and parent communication for your school." />
        <link rel="canonical" href="https://performtrack.co.ke/login" />
        <meta property="og:title" content="Sign in to PerformTrack" />
        <meta property="og:description" content="Secure sign-in for school administrators, teachers and parents using PerformTrack." />
        <meta property="og:url" content="https://performtrack.co.ke/login" />
      </Helmet>
      {/* Left panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 gradient-primary relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20 text-primary-foreground">
          <div className="flex items-center gap-4 mb-8">
            <img src={performTrackLogo} alt="PerformTrack logo" className="w-16 h-16 rounded-2xl object-contain bg-white/20 backdrop-blur p-1" />
          </div>
          <h1 className="text-4xl xl:text-5xl font-display font-extrabold leading-tight mb-4">
            {schoolName} — PerformTrack Portal
          </h1>
          <p className="text-lg text-white/80 mb-8 max-w-md">{schoolMotto}</p>
          <div className="space-y-4 text-white/70 text-sm">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                <Shield className="h-4 w-4" />
              </div>
              <span>CBC Performance Management System</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel - Login form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-sm">
          {/* Mobile branding */}
          <div className="lg:hidden text-center mb-8">
            <img src={performTrackLogo} alt="PerformTrack logo" className="mx-auto w-14 h-14 rounded-2xl object-contain mb-4" />
            <h2 className="text-2xl font-display font-bold text-foreground">{schoolName}</h2>
            <p className="text-sm text-muted-foreground mt-1">{schoolMotto}</p>
          </div>

          <Card className="border-0 shadow-card-hover bg-card">
            <CardContent className="pt-8 pb-8 px-8">
              <div className="mb-6 text-center">
                <h2 className="text-3xl font-display font-extrabold tracking-tight text-foreground">PerformTrack</h2>
                <p className="text-sm text-muted-foreground mt-2">Sign in to your account</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-sm font-medium">Username or Email</Label>
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. jdoe or admin@school.com"
                    className="h-11"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="h-11 pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full h-11 gradient-primary text-primary-foreground font-semibold" disabled={loading}>
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                      Signing in...
                    </span>
                  ) : 'Sign In'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Independent Learner signup CTA */}
          <Link
            to="/learn/signup"
            className="mt-4 block rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors p-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground">New learner? Join the CBC Learning Portal</p>
                <p className="text-xs text-muted-foreground">Free signup · KPSEA & KJSEA lessons, quizzes and AI tutor.</p>
              </div>
              <ArrowRight className="h-4 w-4 text-primary shrink-0" />
            </div>
          </Link>

          {/* Teacher self-registration CTA */}
          <Link
            to="/teacher/signup"
            className="mt-3 block rounded-xl border border-primary/20 bg-background hover:bg-muted/40 transition-colors p-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-secondary text-secondary-foreground flex items-center justify-center shrink-0">
                <Shield className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground">Are you a teacher? Register your class</p>
                <p className="text-xs text-muted-foreground">Start managing learners even before your school joins.</p>
              </div>
              <ArrowRight className="h-4 w-4 text-primary shrink-0" />
            </div>
          </Link>

          <p className="text-center text-xs text-muted-foreground mt-4">
            Already an independent learner? <Link to="/learn/login" className="text-primary font-medium hover:underline">Learner sign in</Link>
          </p>
          <p className="text-center text-xs text-muted-foreground mt-2">
            CBC Smart School System &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}
