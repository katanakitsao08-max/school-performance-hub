import {
  LayoutDashboard, Users, BookOpen, GraduationCap, ClipboardList,
  FileText, BarChart3, MessageSquare, ArrowUpCircle, LogOut, Settings, Columns, ChevronRight
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

const adminItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Users", url: "/users", icon: Users },
  { title: "Learning Areas", url: "/learning-areas", icon: BookOpen },
  { title: "Streams", url: "/streams", icon: Columns },
  { title: "Learners", url: "/learners", icon: GraduationCap },
  { title: "Marks Entry", url: "/marks-entry", icon: ClipboardList },
  { title: "Reports", url: "/reports", icon: FileText },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "SMS", url: "/sms", icon: MessageSquare },
  { title: "Promotion", url: "/promotion", icon: ArrowUpCircle },
  { title: "Settings", url: "/settings", icon: Settings },
];

const teacherItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Learners", url: "/learners", icon: GraduationCap },
  { title: "Marks Entry", url: "/marks-entry", icon: ClipboardList },
  { title: "Reports", url: "/reports", icon: FileText },
];

const headteacherItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Learners", url: "/learners", icon: GraduationCap },
  { title: "Reports", url: "/reports", icon: FileText },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { role, profile, signOut } = useAuth();

  const items = role === 'admin' ? adminItems 
    : role === 'teacher' ? teacherItems 
    : headteacherItems;

  const initials = profile?.full_name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '??';

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Brand Header */}
        <div className={`px-4 py-5 ${collapsed ? 'px-2 py-3' : ''}`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0">
              <GraduationCap className="h-5 w-5 text-primary-foreground" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <h2 className="font-display text-sm font-bold text-sidebar-foreground truncate">CBC Smart School</h2>
                <p className="text-[10px] text-sidebar-foreground/50 uppercase tracking-wider">Performance Manager</p>
              </div>
            )}
          </div>
        </div>

        <Separator className="bg-sidebar-border mx-3 w-auto" />

        {/* Navigation */}
        <SidebarGroup className="mt-2">
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === '/dashboard'}
                      className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sidebar-foreground/70 transition-all hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold"
                    >
                      <item.icon className="h-[18px] w-[18px] flex-shrink-0" />
                      {!collapsed && (
                        <>
                          <span className="flex-1 text-sm">{item.title}</span>
                          <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-50 transition-opacity" />
                        </>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        {!collapsed && profile && (
          <div className="flex items-center gap-3 px-2 mb-3">
            <Avatar className="h-9 w-9 border-2 border-sidebar-primary/30">
              <AvatarFallback className="gradient-primary text-primary-foreground text-xs font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{profile.full_name}</p>
              <p className="text-[11px] text-sidebar-foreground/50 capitalize">{role}</p>
            </div>
          </div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={signOut}
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
