import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  BarChart3, MessageSquare, FileText, Shield, ArrowRight, Phone, Mail,
  CheckCircle2, GraduationCap, Users, Sparkles, ClipboardList, BookOpenCheck,
  LineChart, Lock, Globe, Menu, X, MessageCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const SITE_URL = 'https://performtrack.co.ke/';
const OG_IMAGE = 'https://storage.googleapis.com/gpt-engineer-file-uploads/MOT7WAFDL2gOZBx4pFodyXMiRLz2/social-images/social-1776523937737-apple-touch-icon.webp';
const SEO_TITLE = 'PerformTrack — Run Your School Smarter | CBC School Management';
const SEO_DESC = 'PerformTrack helps Kenyan CBC schools track learner performance, send SMS to parents, generate KPSEA/KJSEA reports instantly, and manage operations in one secure platform.';

const PHONE = '0701594268';
const PHONE_INTL = '254701594268';
const EMAIL = 'performtrackteam@gmail.com';

function useCountUp(target: number, duration = 1600) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let started = false;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || started) return;
      started = true;
      const start = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - start) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        setVal(Math.round(target * eased));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [target, duration]);
  return { ref, val };
}

function Counter({ to, suffix = '+', label }: { to: number; suffix?: string; label: string }) {
  const { ref, val } = useCountUp(to);
  return (
    <div className="text-center">
      <div className="text-4xl md:text-5xl font-display font-bold text-primary tabular-nums">
        <span ref={ref}>{val.toLocaleString()}</span>{suffix}
      </div>
      <div className="mt-2 text-sm uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function ScrollLink({ to, children, onClick }: { to: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <a
      href={`#${to}`}
      onClick={(e) => {
        e.preventDefault();
        document.getElementById(to)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        onClick?.();
      }}
      className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
    >
      {children}
    </a>
  );
}

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <Helmet>
        <title>{SEO_TITLE}</title>
        <meta name="description" content={SEO_DESC} />
        <link rel="canonical" href={SITE_URL} />
        <meta name="robots" content="index,follow" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="PerformTrack" />
        <meta property="og:url" content={SITE_URL} />
        <meta property="og:title" content={SEO_TITLE} />
        <meta property="og:description" content={SEO_DESC} />
        <meta property="og:image" content={OG_IMAGE} />
        <meta property="og:image:alt" content="PerformTrack — CBC school management platform" />
        <meta property="og:locale" content="en_KE" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={SEO_TITLE} />
        <meta name="twitter:description" content={SEO_DESC} />
        <meta name="twitter:image" content={OG_IMAGE} />
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'PerformTrack',
          applicationCategory: 'EducationalApplication',
          operatingSystem: 'Web',
          url: SITE_URL,
          description: SEO_DESC,
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'KES' },
        })}</script>
      </Helmet>
      {/* NAV */}
      <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? 'bg-background/85 backdrop-blur-lg border-b border-border shadow-sm' : 'bg-transparent'}`}>
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-display font-bold text-lg">
            <span className="grid place-items-center h-9 w-9 rounded-xl bg-primary text-primary-foreground shadow-md">
              <GraduationCap className="h-5 w-5" />
            </span>
            <span>PerformTrack</span>
          </Link>
          <nav className="hidden md:flex items-center gap-7">
            <ScrollLink to="why">Why us</ScrollLink>
            <ScrollLink to="features">Features</ScrollLink>
            <ScrollLink to="how">How it works</ScrollLink>
            <ScrollLink to="proof">Schools</ScrollLink>
            <ScrollLink to="contact">Contact</ScrollLink>
          </nav>
          <div className="hidden md:flex items-center gap-2">
            <Button asChild variant="ghost" size="sm"><Link to="/login">Sign in</Link></Button>
            <Button asChild variant="outline" size="sm"><a href={`tel:${PHONE}`}>Book Demo</a></Button>
            <Button asChild size="sm" className="shadow-md"><Link to="/register-school">Start Free</Link></Button>
          </div>
          <div className="md:hidden flex items-center gap-2">
            <Button asChild variant="outline" size="sm"><Link to="/login">Sign in</Link></Button>
            <button
              className="p-2 rounded-md hover:bg-muted"
              onClick={() => setMenuOpen(m => !m)}
              aria-label="Toggle menu"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>

        </div>
        {menuOpen && (
          <div className="md:hidden border-t border-border bg-background/95 backdrop-blur">
            <div className="container mx-auto px-4 py-4 flex flex-col gap-3">
              {['why', 'features', 'how', 'proof', 'contact'].map(s => (
                <ScrollLink key={s} to={s} onClick={() => setMenuOpen(false)}>
                  {s === 'why' ? 'Why us' : s === 'how' ? 'How it works' : s.charAt(0).toUpperCase() + s.slice(1)}
                </ScrollLink>
              ))}
              <Button asChild variant="outline" size="sm" className="mt-2"><Link to="/login" onClick={() => setMenuOpen(false)}>Sign in</Link></Button>
              <Button asChild size="sm"><Link to="/register-school" onClick={() => setMenuOpen(false)}>Start Free</Link></Button>
            </div>
          </div>
        )}
      </header>

      {/* HERO */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden">
        <div aria-hidden className="absolute inset-0 -z-10">
          <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute top-20 -right-20 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.08),transparent_60%)]" />
        </div>
        <div className="container mx-auto px-4 grid lg:grid-cols-2 gap-12 items-center">
          <div className="animate-fade-in">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium text-primary mb-6">
              <Sparkles className="h-3.5 w-3.5" /> Built for CBC schools in Kenya
            </div>
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold leading-[1.05] tracking-tight">
              Run Your School{' '}
              <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">Smarter.</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl">
              Track learner performance, send SMS to parents, generate reports instantly, and manage school operations — all in one platform.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="shadow-lg shadow-primary/20">
                <Link to="/register-school">Start Free <ArrowRight className="ml-1 h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href={`tel:${PHONE}`}>Book Demo</a>
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-5 text-sm text-muted-foreground">
              <a href={`tel:${PHONE}`} className="inline-flex items-center gap-2 hover:text-foreground transition-colors">
                <Phone className="h-4 w-4 text-primary" /> {PHONE}
              </a>
              <a href={`mailto:${EMAIL}`} className="inline-flex items-center gap-2 hover:text-foreground transition-colors">
                <Mail className="h-4 w-4 text-primary" /> {EMAIL}
              </a>
            </div>
          </div>

          {/* Animated dashboard preview */}
          <div className="relative animate-scale-in">
            <div className="absolute -inset-6 bg-gradient-to-br from-primary/30 via-primary/10 to-transparent rounded-3xl blur-2xl" />
            <div className="relative rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
              <div className="flex items-center gap-1.5 border-b border-border px-4 py-3 bg-muted/40">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
                <span className="ml-3 text-xs text-muted-foreground">performtrack.co.ke</span>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { i: BarChart3, k: 'Mean Score', v: '74.2%' },
                    { i: Users, k: 'Learners', v: '1,284' },
                    { i: MessageSquare, k: 'SMS sent', v: '3,910' },
                  ].map((c, idx) => (
                    <div key={idx} className="rounded-lg border border-border p-3 bg-background">
                      <c.i className="h-4 w-4 text-primary mb-1" />
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{c.k}</div>
                      <div className="font-display font-bold text-sm">{c.v}</div>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg border border-border p-4 bg-background">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs font-semibold">Performance trend</div>
                    <div className="text-[10px] text-muted-foreground">Term 2 · 2026</div>
                  </div>
                  <div className="flex items-end gap-2 h-24">
                    {[55, 62, 58, 71, 68, 79, 74, 82].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t bg-gradient-to-t from-primary/40 to-primary animate-fade-in"
                        style={{ height: `${h}%`, animationDelay: `${i * 80}ms` }}
                      />
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border border-border p-3 bg-background flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 grid place-items-center">
                    <MessageSquare className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">Report ready — Grade 6 East</div>
                    <div className="text-[10px] text-muted-foreground">Delivered to 42 parents · just now</div>
                  </div>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                </div>
              </div>
            </div>
            {/* Floating badges */}
            <div className="hidden sm:flex absolute -left-4 top-10 items-center gap-2 rounded-full bg-card border border-border shadow-lg px-3 py-2 text-xs font-medium animate-fade-in">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Faster Reporting
            </div>
            <div className="hidden sm:flex absolute -right-4 top-1/2 items-center gap-2 rounded-full bg-card border border-border shadow-lg px-3 py-2 text-xs font-medium animate-fade-in" style={{ animationDelay: '120ms' }}>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Parent Communication
            </div>
            <div className="hidden sm:flex absolute -left-2 -bottom-4 items-center gap-2 rounded-full bg-card border border-border shadow-lg px-3 py-2 text-xs font-medium animate-fade-in" style={{ animationDelay: '240ms' }}>
              <Shield className="h-4 w-4 text-primary" /> Secure Records
            </div>
          </div>
        </div>
      </section>

      {/* VALUE BAR */}
      <section className="border-y border-border bg-muted/30 py-10">
        <div className="container mx-auto px-4">
          <div className="text-center text-xs uppercase tracking-[0.2em] text-muted-foreground mb-6">
            Trusted School Platform
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { i: BarChart3, t: 'Performance Tracking' },
              { i: MessageSquare, t: 'Parent SMS' },
              { i: FileText, t: 'Smart Reports' },
              { i: Shield, t: 'Secure Data' },
            ].map((c, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover-scale">
                <c.i className="h-5 w-5 text-primary shrink-0" />
                <span className="text-sm font-medium">{c.t}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY */}
      <section id="why" className="py-20 md:py-28">
        <div className="container mx-auto px-4 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-primary font-semibold mb-3">Why PerformTrack</div>
            <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight">
              Stop using spreadsheets and disconnected tools.
            </h2>
            <p className="mt-4 text-muted-foreground text-lg">
              One platform for everything you do every term — designed around how Kenyan CBC schools actually work.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { i: ClipboardList, t: 'Save reporting time', d: 'Generate term reports in minutes, not days.' },
              { i: MessageSquare, t: 'Improve parent comms', d: 'SMS attendance, fees and results automatically.' },
              { i: LineChart, t: 'Monitor progress', d: 'See top, at-risk and most-improved learners in real time.' },
              { i: BookOpenCheck, t: 'Make better decisions', d: 'KPSEA and KJSEA-ready analytics across grades.' },
            ].map((c, i) => (
              <div key={i} className="group rounded-xl border border-border p-5 bg-card hover:border-primary/40 hover:shadow-lg transition-all">
                <div className="h-10 w-10 rounded-lg bg-primary/10 grid place-items-center mb-3 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <c.i className="h-5 w-5 text-primary group-hover:text-primary-foreground" />
                </div>
                <div className="font-display font-semibold">{c.t}</div>
                <div className="text-sm text-muted-foreground mt-1">{c.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SEE IN ACTION — device mockups */}
      <section id="screenshots" className="py-20 md:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="text-xs uppercase tracking-[0.2em] text-primary font-semibold mb-3">Product tour</div>
            <h2 className="font-display text-3xl md:text-4xl font-bold">See PerformTrack in Action</h2>
            <p className="mt-3 text-muted-foreground">A quick look at the screens your team will use every day.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { t: 'Dashboard', d: 'At-a-glance school KPIs, trends and alerts.', accent: 'from-primary/25', body: (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-1.5">
                    {['74%', '1.2k', '98%'].map((v, i) => (
                      <div key={i} className="rounded bg-background/80 border border-border p-1.5 text-center">
                        <div className="text-[8px] text-muted-foreground">KPI</div>
                        <div className="text-[10px] font-bold">{v}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-end gap-1 h-10">
                    {[40,55,48,68,72,80].map((h,i) => <div key={i} className="flex-1 rounded-t bg-primary/70" style={{height:`${h}%`}}/>)}
                  </div>
                </div>
              )},
              { t: 'Results Entry', d: 'Spreadsheet-style scoring with auto-grade.', accent: 'from-blue-400/25', body: (
                <div className="space-y-1">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="flex items-center gap-1.5">
                      <div className="h-2 w-12 bg-muted-foreground/30 rounded" />
                      <div className="h-4 flex-1 bg-background/80 border border-border rounded" />
                      <div className="h-4 w-6 bg-primary/30 rounded" />
                    </div>
                  ))}
                </div>
              )},
              { t: 'Report Cards', d: 'KNEC-style PDFs ready to print or send.', accent: 'from-amber-400/25', body: (
                <div className="space-y-1.5">
                  <div className="h-2 w-3/4 bg-primary/50 rounded" />
                  <div className="h-1.5 w-1/2 bg-muted-foreground/30 rounded" />
                  <div className="grid grid-cols-4 gap-1 mt-2">
                    {Array.from({length:8}).map((_,i) => <div key={i} className="h-3 bg-background/80 border border-border rounded" />)}
                  </div>
                </div>
              )},
              { t: 'SMS Module', d: 'Bulk send results and alerts to parents.', accent: 'from-emerald-400/25', body: (
                <div className="space-y-1.5">
                  {[1,2,3].map(i => (
                    <div key={i} className="flex items-center gap-1.5 rounded bg-background/80 border border-border p-1.5">
                      <MessageSquare className="h-3 w-3 text-primary" />
                      <div className="h-1.5 flex-1 bg-muted-foreground/30 rounded" />
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    </div>
                  ))}
                </div>
              )},
              { t: 'Analytics', d: 'Top, bottom and most-improved learners.', accent: 'from-purple-400/25', body: (
                <div className="space-y-2">
                  <div className="flex items-end gap-1 h-12">
                    {[30,55,42,68,80,72,90].map((h,i) => <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-primary/40 to-primary" style={{height:`${h}%`}}/>)}
                  </div>
                  <div className="h-1.5 w-2/3 bg-muted-foreground/30 rounded" />
                </div>
              )},
              { t: 'Parent Portal', d: 'Secure links — no app install needed.', accent: 'from-pink-400/25', body: (
                <div className="space-y-1.5">
                  <div className="h-6 rounded bg-background/80 border border-border flex items-center px-1.5">
                    <Lock className="h-3 w-3 text-primary mr-1" />
                    <div className="h-1.5 flex-1 bg-muted-foreground/30 rounded" />
                  </div>
                  <div className="h-2 w-full bg-muted-foreground/20 rounded" />
                  <div className="h-2 w-3/4 bg-muted-foreground/20 rounded" />
                </div>
              )},
            ].map((s, i) => (
              <div key={i} className="group rounded-2xl border border-border bg-card overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
                {/* Browser-style device mockup */}
                <div className={`relative bg-gradient-to-br ${s.accent} to-transparent p-4`}>
                  <div className="rounded-lg border border-border bg-background shadow-md overflow-hidden">
                    <div className="flex items-center gap-1 border-b border-border px-2 py-1.5 bg-muted/40">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-400/70" />
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400/70" />
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/70" />
                    </div>
                    <div className="p-3 min-h-[110px]">{s.body}</div>
                  </div>
                </div>
                <div className="p-5">
                  <div className="font-display font-semibold text-lg">{s.t}</div>
                  <div className="text-sm text-muted-foreground mt-1">{s.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRODUCT SHOWCASE */}
      <section className="py-20 md:py-24 bg-gradient-to-b from-muted/30 to-background border-y border-border">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="text-xs uppercase tracking-[0.2em] text-primary font-semibold mb-3">Product</div>
            <h2 className="font-display text-3xl md:text-4xl font-bold">Everything you need, beautifully connected.</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { t: 'Results', d: 'Per-strand and per-subject performance.', accent: 'from-primary/30' },
              { t: 'SMS', d: 'Bulk send, schedule, low-credit alerts.', accent: 'from-blue-400/30' },
              { t: 'Analytics', d: 'Trends, top/bottom, drop alerts.', accent: 'from-amber-400/30' },
              { t: 'Reports', d: 'KNEC-style PDFs ready to share.', accent: 'from-purple-400/30' },
            ].map((c, i) => (
              <div key={i} className="rounded-2xl border border-border overflow-hidden bg-card group">
                <div className={`h-28 bg-gradient-to-br ${c.accent} to-transparent relative`}>
                  <div className="absolute inset-x-3 bottom-3 h-16 rounded-md bg-background/80 backdrop-blur border border-border p-2">
                    <div className="h-2 w-1/2 bg-primary/40 rounded mb-1.5" />
                    <div className="h-2 w-3/4 bg-muted-foreground/30 rounded mb-1.5" />
                    <div className="h-2 w-2/3 bg-muted-foreground/20 rounded" />
                  </div>
                </div>
                <div className="p-4">
                  <div className="font-display font-semibold">{c.t}</div>
                  <div className="text-sm text-muted-foreground mt-1">{c.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="text-xs uppercase tracking-[0.2em] text-primary font-semibold mb-3">Features</div>
            <h2 className="font-display text-3xl md:text-4xl font-bold">Built for real school workflows.</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { i: BarChart3, t: 'Performance Management', d: 'Opener, mid-term & end-term scoring with auto-grading.' },
              { i: MessageSquare, t: 'SMS Communication', d: 'Per-school sender ID, credits and templates.' },
              { i: FileText, t: 'Report Generation', d: 'Individual cards, whole-school and combined reports.' },
              { i: Users, t: 'Teacher Access Control', d: 'Strict role scoping by assignment and class.' },
              { i: GraduationCap, t: 'Parent Updates', d: 'Attendance, fees and results delivered instantly.' },
              { i: Lock, t: 'Audit Logs', d: '21-day auto-lock with admin override and full audit trail.' },
            ].map((c, i) => (
              <div key={i} className="rounded-xl border border-border p-6 bg-card hover:shadow-lg hover:-translate-y-0.5 transition-all">
                <c.i className="h-6 w-6 text-primary mb-3" />
                <div className="font-display font-semibold">{c.t}</div>
                <div className="text-sm text-muted-foreground mt-1">{c.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="py-20 md:py-24 bg-muted/30 border-y border-border">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="text-xs uppercase tracking-[0.2em] text-primary font-semibold mb-3">How it works</div>
            <h2 className="font-display text-3xl md:text-4xl font-bold">From signup to first report — fast.</h2>
          </div>
          <div className="grid md:grid-cols-4 gap-4">
            {[
              { n: '1', t: 'Register School', d: 'Free, takes under 2 minutes.' },
              { n: '2', t: 'Add Learners', d: 'Bulk import from Excel or CSV.' },
              { n: '3', t: 'Enter Performance', d: 'Spreadsheet-style marks entry.' },
              { n: '4', t: 'Generate Reports', d: 'One click PDFs + parent SMS.' },
            ].map((s, i) => (
              <div key={i} className="relative rounded-xl bg-card border border-border p-6">
                <div className="absolute -top-4 left-6 h-9 w-9 rounded-full bg-primary text-primary-foreground grid place-items-center font-display font-bold shadow-md">
                  {s.n}
                </div>
                <div className="pt-3 font-display font-semibold">{s.t}</div>
                <div className="text-sm text-muted-foreground mt-1">{s.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section id="proof" className="py-20 md:py-24">
        <div className="container mx-auto px-4">
          <div className="rounded-3xl border border-border bg-gradient-to-br from-primary/5 via-card to-card p-8 md:p-14">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <Counter to={120} label="Schools" />
              <Counter to={42000} label="Learners" />
              <Counter to={15000} label="Reports" />
              <Counter to={185000} label="SMS Sent" />
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section id="contact" className="py-20 md:py-28 relative overflow-hidden">
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.12),transparent_70%)]" />
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight">
            Ready to Modernize Your School?
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Join schools across Kenya using PerformTrack to run smoother, faster and smarter.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="shadow-lg shadow-primary/20">
              <Link to="/register-school">Get Started <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href={`tel:${PHONE}`}>Talk to Us</a>
            </Button>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <a href={`tel:${PHONE}`} className="inline-flex items-center gap-2 hover:text-foreground">
              <Phone className="h-4 w-4 text-primary" /> {PHONE}
            </a>
            <a href={`mailto:${EMAIL}`} className="inline-flex items-center gap-2 hover:text-foreground">
              <Mail className="h-4 w-4 text-primary" /> {EMAIL}
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border bg-muted/40">
        <div className="container mx-auto px-4 py-12 grid md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 font-display font-bold text-lg">
              <span className="grid place-items-center h-9 w-9 rounded-xl bg-primary text-primary-foreground">
                <GraduationCap className="h-5 w-5" />
              </span>
              PerformTrack
            </div>
            <p className="mt-3 text-sm text-muted-foreground max-w-sm">
              CBC-ready school management platform — performance, parents and operations in one place.
            </p>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Contact</div>
            <ul className="space-y-2 text-sm">
              <li><a className="inline-flex items-center gap-2 hover:text-primary" href={`tel:${PHONE}`}><Phone className="h-4 w-4" />{PHONE}</a></li>
              <li><a className="inline-flex items-center gap-2 hover:text-primary" href={`mailto:${EMAIL}`}><Mail className="h-4 w-4" />{EMAIL}</a></li>
              <li><a className="inline-flex items-center gap-2 hover:text-primary" href="https://performtrack.co.ke" target="_blank" rel="noreferrer"><Globe className="h-4 w-4" />performtrack.co.ke</a></li>
            </ul>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Product</div>
            <ul className="space-y-2 text-sm">
              <li><ScrollLink to="features">Features</ScrollLink></li>
              <li><ScrollLink to="how">How it works</ScrollLink></li>
              <li><Link className="text-muted-foreground hover:text-foreground" to="/login">Sign in</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border py-5 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} PerformTrack. All rights reserved.
        </div>
      </footer>

      {/* Floating action buttons */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-3">
        <a
          href={`https://wa.me/${PHONE_INTL}?text=${encodeURIComponent('Hi PerformTrack, I would like a demo for my school.')}`}
          target="_blank" rel="noreferrer"
          aria-label="Chat on WhatsApp"
          className="h-14 w-14 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-2xl shadow-emerald-500/40 grid place-items-center transition-transform hover:scale-110 animate-fade-in"
        >
          <MessageCircle className="h-7 w-7" />
          <span className="sr-only">WhatsApp</span>
        </a>
        <a
          href={`tel:${PHONE}`}
          aria-label="Call PerformTrack"
          className="md:hidden h-14 w-14 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-2xl shadow-primary/40 grid place-items-center transition-transform hover:scale-110 animate-fade-in"
        >
          <Phone className="h-6 w-6" />
          <span className="sr-only">Call</span>
        </a>
      </div>
    </div>
  );
}
