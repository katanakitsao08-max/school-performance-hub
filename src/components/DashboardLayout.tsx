import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { BottomNav } from "@/components/BottomNav";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import { NotificationBell } from "@/components/NotificationBell";
import { OfflineStatusBar } from "@/components/OfflineStatusBar";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile, role } = useAuth();
  const isMobile = useIsMobile();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        {/* Desktop sidebar only */}
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
        {/* Mobile bottom nav & FAB */}
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
