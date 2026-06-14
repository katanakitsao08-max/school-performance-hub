import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { BottomNav } from "@/components/BottomNav";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import { NotificationBell } from "@/components/NotificationBell";
import { OfflineStatusBar } from "@/components/OfflineStatusBar";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";
import { ShieldAlert, LogOut, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation, useNavigate } from "react-router-dom";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile, role, isSchoolFrozen, schoolStatus, signOut } = useAuth();
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();

  // Allow access to billing page even when frozen so admins can renew
  const isOnBilling = location.pathname.startsWith('/billing');

  if (isSchoolFrozen && !isOnBilling) {
    const isAdmin = role === 'admin' || role === 'headteacher';
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <ShieldAlert className="h-8 w-8 text-destructive" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-display font-bold text-foreground">
              {schoolStatus === 'disabled' ? 'School Account Disabled' : schoolStatus === 'suspended' ? 'School Account Suspended' : 'Subscription Expired'}
            </h1>
            <p className="text-muted-foreground">
              {schoolStatus === 'expired'
                ? 'Your subscription has lapsed. Renew now to keep using PerformTrack.'
                : 'Marks entry, reports and SMS are disabled until the subscription is renewed.'}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {isAdmin && (
              <Button onClick={() => navigate('/billing')} className="gap-2">
                <CreditCard className="h-4 w-4" /> Renew Subscription
              </Button>
            )}
            <Button variant="outline" onClick={signOut} className="gap-2">
              <LogOut className="h-4 w-4" /> Sign Out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border/60 bg-card/70 backdrop-blur-xl px-4 no-print sticky top-0 z-30 supports-[backdrop-filter]:bg-card/60">
            <div className="flex items-center gap-4 min-w-0">
              <div className="flex flex-col items-center justify-center shrink-0 -my-1">
                <SidebarTrigger
                  aria-label="Open menu"
                  className="hover:bg-accent/50 rounded-lg h-9 w-9 md:h-8 md:w-8"
                />
                <span className="mt-1 text-[10px] md:text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground leading-none">
                  Menu
                </span>
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-display font-bold text-foreground truncate tracking-tight">
                  {isMobile ? 'PerformTrack' : (profile?.full_name || 'Dashboard')}
                </h2>
                {!isMobile && (
                  <p className="text-[10px] text-muted-foreground/70 uppercase tracking-[0.14em] leading-tight">
                    Performance OS
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isMobile && role && (
                <Badge variant="outline" className="capitalize text-[10px] font-semibold border-primary/20 bg-primary/5 text-primary tracking-wide">
                  {role.replace('_', ' ')}
                </Badge>
              )}
              <NotificationBell />
            </div>
          </header>
          <OfflineStatusBar />
          <main className="flex-1 p-4 md:p-6 overflow-auto pb-24 md:pb-6">
            {children}
          </main>
        </div>
        {isMobile && (
          <>
            <FloatingActionButton />
            <BottomNav />
          </>
        )}
      </div>
    </SidebarProvider>
  );
}
