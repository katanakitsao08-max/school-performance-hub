import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { BottomNav } from "@/components/BottomNav";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import { NotificationBell } from "@/components/NotificationBell";
import { OfflineStatusBar } from "@/components/OfflineStatusBar";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";
import { ShieldAlert, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile, role, isSchoolFrozen, signOut } = useAuth();
  const isMobile = useIsMobile();

  if (isSchoolFrozen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <ShieldAlert className="h-8 w-8 text-destructive" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-display font-bold text-foreground">School Account Disabled</h1>
            <p className="text-muted-foreground">
              Your school's subscription has been deactivated by the platform administrator.
              All system access has been temporarily suspended.
            </p>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
            <p>Please contact the platform administrator or your school management to restore access.</p>
          </div>
          <Button variant="outline" onClick={signOut} className="gap-2">
            <LogOut className="h-4 w-4" /> Sign Out
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        {!isMobile && <AppSidebar />}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b bg-card/80 backdrop-blur-sm px-4 no-print sticky top-0 z-30">
            <div className="flex items-center gap-3">
              {!isMobile && <SidebarTrigger className="mr-1" />}
              <div>
                <h2 className="text-sm font-display font-bold text-foreground">
                  {isMobile ? 'CBC Smart School' : (profile?.full_name || 'Dashboard')}
                </h2>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isMobile && (
                <Badge variant="outline" className="capitalize text-xs font-medium">
                  {role}
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
