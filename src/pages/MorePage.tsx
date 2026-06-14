import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useNavigate } from "react-router-dom";
import {
  Users, BookOpen, GraduationCap, Columns, UserCog, BarChart3,
  MessageSquare, ArrowUpCircle, Settings, PieChart, Activity,
  CalendarCheck, LogOut, ChevronRight, Building2, Wallet, Calendar, FileEdit, Library, BookMarked
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const adminMenuSections = [
  {
    title: "Academics",
    items: [
      { title: "Learning Areas", icon: BookOpen, to: "/learning-areas" },
      { title: "Grades", icon: GraduationCap, to: "/grades" },
      { title: "Streams", icon: Columns, to: "/streams" },
      { title: "Teacher Assignments", icon: UserCog, to: "/teacher-assignments" },
      { title: "Attendance", icon: CalendarCheck, to: "/attendance" },
    ],
  },
  {
    title: "Insights",
    items: [
      { title: "Grade Analysis", icon: PieChart, to: "/grade-analysis" },
      { title: "Performance Tracking", icon: Activity, to: "/performance-tracking" },
      { title: "Analytics", icon: BarChart3, to: "/analytics" },
    ],
  },
  {
    title: "Communication",
    items: [
      { title: "SMS", icon: MessageSquare, to: "/sms" },
      { title: "Parent Communication", icon: MessageSquare, to: "/parent-communication" },
    ],
  },
  {
    title: "Finance",
    items: [
      { title: "Fee Management", icon: Wallet, to: "/fees" },
    ],
  },
  {
    title: "Planning",
    items: [
      { title: "Timetable", icon: Calendar, to: "/timetable" },
      { title: "Content Generator", icon: FileEdit, to: "/content-generation" },
      { title: "Curriculum Library", icon: Library, to: "/curriculum-library" },
    ],
  },
  {
    title: "Administration",
    items: [
      { title: "Users", icon: Users, to: "/users" },
      // { title: "Subscription & Billing", icon: Wallet, to: "/billing" },
      { title: "Promotion", icon: ArrowUpCircle, to: "/promotion" },
      { title: "Settings", icon: Settings, to: "/settings" },
    ],
  },
];

const teacherMenuSections = [
  {
    title: "Teaching",
    items: [
      { title: "Attendance", icon: CalendarCheck, to: "/attendance" },
      { title: "Performance Tracking", icon: Activity, to: "/performance-tracking" },
      { title: "Timetable", icon: Calendar, to: "/timetable" },
      { title: "Content Generator", icon: FileEdit, to: "/content-generation" },
      { title: "Curriculum Library", icon: Library, to: "/curriculum-library" },
    ],
  },
];

const headteacherMenuSections = [
  {
    title: "Analysis & Tracking",
    items: [
      { title: "Grade Analysis", icon: PieChart, to: "/grade-analysis" },
      { title: "Performance Tracking", icon: Activity, to: "/performance-tracking" },
      { title: "Analytics", icon: BarChart3, to: "/analytics" },
    ],
  },
  {
    title: "Planning",
    items: [
      { title: "Timetable", icon: Calendar, to: "/timetable" },
      { title: "Content Generator", icon: FileEdit, to: "/content-generation" },
      { title: "Curriculum Library", icon: Library, to: "/curriculum-library" },
    ],
  },
];

const superAdminMenuSections = [
  {
    title: "Platform",
    items: [
      { title: "Manage Schools", icon: Building2, to: "/manage-schools" },
      { title: "Billing & Collections", icon: Wallet, to: "/admin/billing" },
      { title: "Curriculum Designs", icon: BookMarked, to: "/curriculum-manager" },
      { title: "LMS Catalog", icon: BookOpen, to: "/super-admin/lms" },
      { title: "Platform Analytics", icon: BarChart3, to: "/super-admin/analytics" },
    ],
  },
];

export default function MorePage() {
  const { role, profile, signOut } = useAuth();
  const navigate = useNavigate();

  const sections = role === 'super_admin' ? superAdminMenuSections
    : role === 'admin' ? adminMenuSections
    : role === 'teacher' ? teacherMenuSections
    : headteacherMenuSections;

  const initials = profile?.full_name
    ?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';

  return (
    <DashboardLayout>
      <div className="space-y-5 animate-fade-in pb-20">
        {/* Profile Card */}
        <div className="flex items-center gap-4 p-4 bg-card rounded-2xl border border-border shadow-card">
          <Avatar className="h-14 w-14 border-2 border-primary/20">
            <AvatarFallback className="gradient-primary text-primary-foreground text-lg font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold font-display text-foreground truncate">{profile?.full_name}</p>
            <p className="text-sm text-muted-foreground capitalize">{role?.replace('_', ' ')}</p>
          </div>
        </div>

        {/* Menu Sections */}
        {sections.map((section) => (
          <div key={section.title} className="space-y-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1 mb-2">
              {section.title}
            </h3>
            <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden divide-y divide-border">
              {section.items.map((item) => (
                <button
                  key={item.to}
                  onClick={() => navigate(item.to)}
                  className="flex items-center gap-3 w-full px-4 py-3.5 text-left hover:bg-muted/50 transition-colors"
                >
                  <div className="w-9 h-9 rounded-xl bg-primary/8 flex items-center justify-center flex-shrink-0">
                    <item.icon className="h-[18px] w-[18px] text-primary" />
                  </div>
                  <span className="flex-1 text-sm font-medium text-foreground">{item.title}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Sign Out */}
        <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
          <button
            onClick={signOut}
            className="flex items-center gap-3 w-full px-4 py-3.5 text-left hover:bg-destructive/5 transition-colors"
          >
            <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center">
              <LogOut className="h-[18px] w-[18px] text-destructive" />
            </div>
            <span className="text-sm font-medium text-destructive">Sign Out</span>
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
