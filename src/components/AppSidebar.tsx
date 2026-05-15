import {
  LayoutDashboard, Users, BookOpen, GraduationCap, ClipboardList,
  FileText, BarChart3, MessageSquare, MessageCircle, ArrowUpCircle, LogOut, Settings, Columns, ChevronRight, ChevronDown, CalendarCheck, Building2, UserCog, PieChart, Activity, Layers, Wallet, NotebookPen, CalendarClock, KeyRound, Library, BookMarked, Sparkles
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import performTrackLogo from "@/assets/performtrack-logo.png";

type NavItem = { title: string; url: string; icon: any };
type NavSection = { label: string; items: NavItem[] };

const superAdminSections: NavSection[] = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", url: "/super-admin", icon: LayoutDashboard }],
  },
  {
    label: "Management",
    items: [
      { title: "Manage Schools", url: "/manage-schools", icon: Building2 },
      { title: "Price Board", url: "/price-board", icon: Wallet },
    ],
  },
  {
    label: "Curriculum",
    items: [
      { title: "Curriculum Designs", url: "/curriculum-manager", icon: BookMarked },
      { title: "Timetable Keys", url: "/timetable-keys", icon: KeyRound },
    ],
  },
];

const adminSections: NavSection[] = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", url: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Academics",
    items: [
      { title: "Learning Areas", url: "/learning-areas", icon: BookOpen },
      { title: "Grades", url: "/grades", icon: GraduationCap },
      { title: "Streams", url: "/streams", icon: Columns },
      { title: "Strands", url: "/strands", icon: Layers },
      { title: "Learners", url: "/learners", icon: GraduationCap },
    ],
  },
  {
    label: "Teaching",
    items: [
      { title: "Teacher Assignments", url: "/teacher-assignments", icon: UserCog },
      { title: "Marks Entry", url: "/marks-entry", icon: ClipboardList },
      { title: "Attendance", url: "/attendance", icon: CalendarCheck },
      { title: "Content Generation", url: "/content-generation", icon: NotebookPen },
      { title: "Curriculum Library", url: "/curriculum-library", icon: Library },
      { title: "Timetable", url: "/timetable", icon: CalendarClock },
      { title: "Lesson Allocations", url: "/lesson-allocations", icon: ClipboardList },
    ],
  },
  {
    label: "Insights",
    items: [
      { title: "Reports", url: "/reports", icon: FileText },
      { title: "Consolidated Reports", url: "/consolidated-reports", icon: FileText },
      { title: "Grade Analysis", url: "/grade-analysis", icon: PieChart },
      { title: "Performance Tracking", url: "/performance-tracking", icon: Activity },
      { title: "Analytics", url: "/analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Communication",
    items: [
      { title: "SMS", url: "/sms", icon: MessageSquare },
      { title: "Parent Communication", url: "/parent-communication", icon: MessageSquare },
      { title: "WhatsApp", url: "/whatsapp", icon: MessageCircle },
    ],
  },
  {
    label: "Finance",
    items: [{ title: "Fees", url: "/fees", icon: Wallet }],
  },
  {
    label: "Administration",
    items: [
      { title: "Users", url: "/users", icon: Users },
      { title: "Promotion", url: "/promotion", icon: ArrowUpCircle },
      { title: "Settings", url: "/settings", icon: Settings },
    ],
  },
];

const teacherSections: NavSection[] = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", url: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Teaching",
    items: [
      { title: "Learners", url: "/learners", icon: GraduationCap },
      { title: "Marks Entry", url: "/marks-entry", icon: ClipboardList },
      { title: "Attendance", url: "/attendance", icon: CalendarCheck },
      { title: "Content Generation", url: "/content-generation", icon: NotebookPen },
      { title: "Curriculum Library", url: "/curriculum-library", icon: Library },
      { title: "Timetable", url: "/timetable", icon: CalendarClock },
    ],
  },
  {
    label: "Insights",
    items: [
      { title: "My Dashboard", url: "/teacher-dashboard", icon: Activity },
      { title: "Reports", url: "/reports", icon: FileText },
      { title: "Performance Tracking", url: "/performance-tracking", icon: Activity },
      { title: "Subject Analysis", url: "/grade-analysis", icon: PieChart },
    ],
  },
];

const headteacherSections: NavSection[] = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", url: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Insights",
    items: [
      { title: "Learners", url: "/learners", icon: GraduationCap },
      { title: "Reports", url: "/reports", icon: FileText },
      { title: "Consolidated Reports", url: "/consolidated-reports", icon: FileText },
      { title: "Grade Analysis", url: "/grade-analysis", icon: PieChart },
      { title: "Performance Tracking", url: "/performance-tracking", icon: Activity },
      { title: "Analytics", url: "/analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Curriculum",
    items: [
      { title: "Curriculum Library", url: "/curriculum-library", icon: Library },
      { title: "Timetable", url: "/timetable", icon: CalendarClock },
    ],
  },
];

const parentSections: NavSection[] = [
  {
    label: "Portal",
    items: [
      { title: "Dashboard", url: "/parent", icon: LayoutDashboard },
      { title: "Fees", url: "/parent?tab=fees", icon: Wallet },
      { title: "Reports", url: "/parent?tab=reports", icon: FileText },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { role, profile, signOut } = useAuth();
  const { pathname } = useLocation();

  const sections = role === 'super_admin' ? superAdminSections
    : role === 'admin' ? adminSections
    : role === 'teacher' ? teacherSections
    : role === 'parent' ? parentSections
    : headteacherSections;

  // Auto-open the section containing the active route
  const initialOpen = useMemo(() => {
    const open: Record<string, boolean> = {};
    sections.forEach(sec => {
      open[sec.label] = sec.label === "Overview" ||
        sec.items.some(it => pathname === it.url.split('?')[0] || pathname.startsWith(it.url.split('?')[0] + '/'));
    });
    return open;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(initialOpen);

  const toggle = (label: string) =>
    setOpenSections(s => ({ ...s, [label]: !s[label] }));

  const initials = profile?.full_name
    ?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border/60">
      <SidebarContent className="bg-sidebar">
        {/* Brand */}
        <div className={cn("px-4 py-5", collapsed && "px-2 py-3")}>
          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0">
              <img src={performTrackLogo} alt="PerformTrack" className="h-9 w-9 rounded-xl object-contain" />
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-sidebar-primary ring-2 ring-sidebar" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <h2 className="font-display text-sm font-bold text-sidebar-foreground truncate tracking-tight">
                  PerformTrack
                </h2>
                <p className="text-[10px] text-sidebar-foreground/50 uppercase tracking-[0.14em]">
                  {role === 'super_admin' ? 'Super Admin' : role === 'parent' ? 'Parent Portal' : 'Performance OS'}
                </p>
              </div>
            )}
          </div>
        </div>

        <Separator className="bg-sidebar-border/50 mx-3 w-auto" />

        {/* Sections */}
        <div className="flex-1 overflow-y-auto py-2 scrollbar-thin">
          {sections.map((section) => {
            const isOpen = openSections[section.label] ?? true;
            const isSingle = section.items.length === 1 && section.label === "Overview";

            return (
              <SidebarGroup key={section.label} className="px-2 py-1">
                {!collapsed && !isSingle && (
                  <button
                    onClick={() => toggle(section.label)}
                    className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/40 hover:text-sidebar-foreground/70 transition-colors"
                  >
                    <span>{section.label}</span>
                    <ChevronDown className={cn("h-3 w-3 transition-transform", !isOpen && "-rotate-90")} />
                  </button>
                )}
                {collapsed && !isSingle && (
                  <SidebarGroupLabel className="sr-only">{section.label}</SidebarGroupLabel>
                )}
                {(isOpen || collapsed || isSingle) && (
                  <SidebarGroupContent>
                    <SidebarMenu className="gap-0.5">
                      {section.items.map((item) => (
                        <SidebarMenuItem key={item.title + item.url}>
                          <SidebarMenuButton asChild tooltip={collapsed ? item.title : undefined}>
                            <NavLink
                              to={item.url}
                              end={item.url === '/dashboard' || item.url === '/super-admin' || item.url === '/parent'}
                              className={({ isActive }) =>
                                cn(
                                  "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-all",
                                  isActive
                                    ? "bg-sidebar-accent text-sidebar-primary font-semibold shadow-sm"
                                    : "text-sidebar-foreground/65 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
                                )
                              }
                            >
                              {({ isActive }) => (
                                <>
                                  {isActive && (
                                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r-full bg-sidebar-primary" />
                                  )}
                                  <item.icon className={cn("h-[17px] w-[17px] flex-shrink-0", isActive && "text-sidebar-primary")} />
                                  {!collapsed && (
                                    <>
                                      <span className="flex-1 truncate">{item.title}</span>
                                      <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-40 transition-opacity" />
                                    </>
                                  )}
                                </>
                              )}
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                )}
              </SidebarGroup>
            );
          })}
        </div>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/50 p-3 bg-sidebar">
        {!collapsed && profile && (
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl bg-sidebar-accent/30 mb-2">
            <Avatar className="h-9 w-9 ring-2 ring-sidebar-primary/40">
              <AvatarFallback className="gradient-primary text-primary-foreground text-xs font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-sidebar-foreground truncate leading-tight">{profile.full_name}</p>
              <p className="text-[10px] text-sidebar-foreground/50 capitalize tracking-wide">{role?.replace('_', ' ')}</p>
            </div>
            <Sparkles className="h-3.5 w-3.5 text-sidebar-primary/60" />
          </div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={signOut}
              tooltip={collapsed ? "Sign Out" : undefined}
              className="hover:bg-destructive/10 text-sidebar-foreground/60 hover:text-destructive transition-colors"
            >
              <LogOut className="mr-2 h-4 w-4" />
              {!collapsed && <span className="text-sm">Sign Out</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
