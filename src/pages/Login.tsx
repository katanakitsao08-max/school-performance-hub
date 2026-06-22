import { useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Helmet } from 'react-helmet-async';
import { Greeting } from '@/components/auth/Greeting';
import { AuthForm } from '@/components/auth/AuthForm';
import { GraduationCap } from 'lucide-react';
import performTrackLogo from '@/assets/performtrack-logo.png';

const APP_VERSION = 'v1.0.0';

export default function Login() {
  const { user, loading } = useAuth();

  useEffect(() => {
    document.documentElement.style.setProperty('--app-bg', 'hsl(var(--primary))');
    return () => document.documentElement.style.removeProperty('--app-bg');
  }, []);

  if (!loading && user) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen flex flex-col bg-primary">
      <Helmet>
        <title>Sign in — PerformTrack</title>
        <meta name="description" content="Sign in to PerformTrack — CBC marks, reports, attendance, fees, and parent communication." />
        <meta name="theme-color" content="#1a7a3a" />
        <link rel="canonical" href="https://performtrack.co.ke/login" />
      </Helmet>

      {/* Green branded header */}
      <header className="relative px-6 pt-10 pb-12 sm:pt-14 sm:pb-16 overflow-hidden">
        <div className="absolute -top-20 -right-16 w-64 h-64 rounded-full bg-white/10 blur-3xl" aria-hidden />
        <div className="absolute -bottom-24 -left-10 w-72 h-72 rounded-full bg-white/5 blur-3xl" aria-hidden />
        <div className="relative max-w-md mx-auto w-full">
          <Greeting />
        </div>
      </header>

      {/* White rounded card */}
      <main className="flex-1 bg-background rounded-t-[2rem] -mt-6 px-6 pt-8 pb-6 shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.15)] animate-fade-in">
        <div className="max-w-md mx-auto w-full">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-20 h-20 rounded-2xl bg-primary/5 ring-1 ring-primary/10 flex items-center justify-center mb-3 animate-scale-in">
              <img src={performTrackLogo} alt="PerformTrack logo" className="w-14 h-14 object-contain" />
            </div>
            <h2 className="text-xl font-display font-bold text-foreground">PerformTrack</h2>
            <p className="text-xs text-muted-foreground mt-1">Sign in to continue</p>
          </div>

          <Card className="border-0 shadow-none bg-transparent">
            <AuthForm />
          </Card>

          <Link
            to="/learn/signup"
            className="mt-6 flex items-center gap-3 rounded-xl border border-primary/15 bg-primary/5 hover:bg-primary/10 transition-colors p-3"
          >
            <div className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0">
              <GraduationCap className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-xs text-foreground">New learner? Join the CBC Portal</p>
              <p className="text-[11px] text-muted-foreground">Free signup · KPSEA & KJSEA lessons.</p>
            </div>
          </Link>

          <p className="text-center text-[11px] text-muted-foreground mt-6">
            PerformTrack {APP_VERSION} · &copy; {new Date().getFullYear()}
          </p>
        </div>
      </main>
    </div>
  );
}
