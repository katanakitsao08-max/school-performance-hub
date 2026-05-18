import { LayoutDashboard, GraduationCap, ClipboardList, FileText, MoreHorizontal, BarChart3, Wallet, Sparkles } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const defaultTabs = [
  { label: "Home", icon: LayoutDashboard, to: "/dashboard" },
  { label: "Classes", icon: GraduationCap, to: "/learners" },
  { label: "Marks", icon: ClipboardList, to: "/marks-entry" },
  { label: "Reports", icon: FileText, to: "/reports" },
  { label: "Analytics", icon: BarChart3, to: "/analytics" },
  { label: "Menu", icon: MoreHorizontal, to: "/more" },
];

const parentTabs = [
  { label: "Home", icon: LayoutDashboard, to: "/parent" },
  { label: "Learning", icon: Sparkles, to: "/parent?tab=learning" },
  { label: "Fees", icon: Wallet, to: "/parent?tab=fees" },
  { label: "Reports", icon: FileText, to: "/parent?tab=reports" },
  { label: "Menu", icon: MoreHorizontal, to: "/more" },
];

export function BottomNav() {
  const { role } = useAuth();
  const tabs = role === 'parent' ? parentTabs : defaultTabs;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border md:hidden no-print safe-bottom">
      <div className="flex items-center justify-around h-16 px-1">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === "/dashboard" || tab.to === "/parent"}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all min-w-[56px]",
                isActive ? "text-primary" : "text-muted-foreground"
              )
            }
          >
            {({ isActive }) => (
              <>
                <div className={cn(
                  "flex items-center justify-center w-10 h-7 rounded-full transition-all",
                  isActive && "bg-primary/10"
                )}>
                  <tab.icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span className="text-[10px] font-medium leading-tight">{tab.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
