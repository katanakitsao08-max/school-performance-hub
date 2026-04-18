import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef } from "react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import ManageSchoolsPage from "./pages/ManageSchoolsPage";
import UsersPage from "./pages/UsersPage";
import LearningAreasPage from "./pages/LearningAreasPage";
import StreamsPage from "./pages/StreamsPage";
import GradesPage from "./pages/GradesPage";
import LearnersPage from "./pages/LearnersPage";
import MarksEntryPage from "./pages/MarksEntryPage";
import ReportsPage from "./pages/ReportsPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import SmsPage from "./pages/SmsPage";
import PromotionPage from "./pages/PromotionPage";
import SettingsPage from "./pages/SettingsPage";
import AttendancePage from "./pages/AttendancePage";
import TeacherAssignmentsPage from "./pages/TeacherAssignmentsPage";
import GradeAnalysisPage from "./pages/GradeAnalysisPage";
import StrandsPage from "./pages/StrandsPage";
import PerformanceTrackingPage from "./pages/PerformanceTrackingPage";
import MorePage from "./pages/MorePage";
import ContentGenerationPage from "./pages/ContentGenerationPage";
import TimetablePage from "./pages/TimetablePage";
import TimetableKeysPage from "./pages/TimetableKeysPage";
import FeesPage from "./pages/FeesPage";
import ParentDashboard from "./pages/ParentDashboard";
import SharedReportPage from "./pages/SharedReportPage";
import CurriculumDesignManagerPage from "./pages/CurriculumDesignManagerPage";
import CurriculumLibraryPage from "./pages/CurriculumLibraryPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const { user, role, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  // Wait for role to load before enforcing role-based access
  if (allowedRoles && !role) return <div className="flex min-h-screen items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (allowedRoles && role && !allowedRoles.includes(role)) {
    if (role === 'parent') return <Navigate to="/parent" replace />;
    return <Navigate to={role === 'super_admin' ? '/super-admin' : '/dashboard'} replace />;
  }
  return <>{children}</>;
}

function SmartRedirect() {
  const { user, role, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role === 'super_admin') return <Navigate to="/super-admin" replace />;
  if (role === 'parent') return <Navigate to="/parent" replace />;
  return <Dashboard />;
}

/**
 * On a hard refresh (initial app mount), send the user back to their dashboard
 * instead of staying on the deep-linked page. Public routes (login, shared
 * report links, root) are exempt so they keep working on direct visits.
 */
function RefreshRedirector() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    if (loading) return;

    const path = location.pathname;
    const exempt =
      path === '/' ||
      path === '/login' ||
      path === '/forgot-password' ||
      path === '/reset-password' ||
      path.startsWith('/r/');

    handled.current = true;

    if (exempt || !user) return;

    const target =
      role === 'super_admin' ? '/super-admin' :
      role === 'parent' ? '/parent' :
      '/';

    if (path !== target) {
      navigate(target, { replace: true });
    }
  }, [loading, user, role, location.pathname, navigate]);

  return null;
}


const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <RefreshRedirector />
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/r/:token" element={<SharedReportPage />} />
              <Route path="/" element={<SmartRedirect />} />
              {/* Super Admin routes */}
              <Route path="/super-admin" element={<ProtectedRoute allowedRoles={['super_admin']}><SuperAdminDashboard /></ProtectedRoute>} />
              <Route path="/manage-schools" element={<ProtectedRoute allowedRoles={['super_admin']}><ManageSchoolsPage /></ProtectedRoute>} />
              <Route path="/timetable-keys" element={<ProtectedRoute allowedRoles={['super_admin']}><ErrorBoundary inline label="Timetable Keys"><TimetableKeysPage /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/curriculum-manager" element={<ProtectedRoute allowedRoles={['super_admin']}><ErrorBoundary inline label="Curriculum Design Manager"><CurriculumDesignManagerPage /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/curriculum-library" element={<ProtectedRoute allowedRoles={['admin', 'teacher', 'headteacher']}><ErrorBoundary inline label="Curriculum Library"><CurriculumLibraryPage /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/timetable" element={<ProtectedRoute allowedRoles={['admin', 'teacher', 'headteacher']}><ErrorBoundary inline label="Timetable"><TimetablePage /></ErrorBoundary></ProtectedRoute>} />
              {/* School-level routes */}
              <Route path="/dashboard" element={<Navigate to="/" replace />} />
              <Route path="/users" element={<ProtectedRoute allowedRoles={['admin']}><ErrorBoundary inline label="Users"><UsersPage /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/learning-areas" element={<ProtectedRoute allowedRoles={['admin']}><LearningAreasPage /></ProtectedRoute>} />
              <Route path="/streams" element={<ProtectedRoute allowedRoles={['admin']}><StreamsPage /></ProtectedRoute>} />
              <Route path="/grades" element={<ProtectedRoute allowedRoles={['admin']}><GradesPage /></ProtectedRoute>} />
              <Route path="/learners" element={<ProtectedRoute allowedRoles={['admin', 'headteacher', 'teacher']}><ErrorBoundary inline label="Learners"><LearnersPage /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/marks-entry" element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><MarksEntryPage /></ProtectedRoute>} />
              <Route path="/attendance" element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><AttendancePage /></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute><ErrorBoundary inline label="Reports"><ReportsPage /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/analytics" element={<ProtectedRoute allowedRoles={['admin', 'headteacher']}><AnalyticsPage /></ProtectedRoute>} />
              <Route path="/sms" element={<ProtectedRoute allowedRoles={['admin']}><SmsPage /></ProtectedRoute>} />
              <Route path="/promotion" element={<ProtectedRoute allowedRoles={['admin']}><PromotionPage /></ProtectedRoute>} />
              <Route path="/strands" element={<ProtectedRoute allowedRoles={['admin']}><StrandsPage /></ProtectedRoute>} />
              <Route path="/teacher-assignments" element={<ProtectedRoute allowedRoles={['admin']}><TeacherAssignmentsPage /></ProtectedRoute>} />
              <Route path="/grade-analysis" element={<ProtectedRoute allowedRoles={['admin', 'headteacher']}><GradeAnalysisPage /></ProtectedRoute>} />
              <Route path="/performance-tracking" element={<ProtectedRoute allowedRoles={['admin', 'headteacher', 'teacher']}><PerformanceTrackingPage /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute allowedRoles={['admin']}><SettingsPage /></ProtectedRoute>} />
              <Route path="/fees" element={<ProtectedRoute allowedRoles={['admin']}><FeesPage /></ProtectedRoute>} />
              <Route path="/content-generation" element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><ContentGenerationPage /></ProtectedRoute>} />
              <Route path="/more" element={<ProtectedRoute><MorePage /></ProtectedRoute>} />
              {/* Parent routes */}
              <Route path="/parent" element={<ProtectedRoute allowedRoles={['parent']}><ParentDashboard /></ProtectedRoute>} />
              <Route path="*" element={<SmartRedirect />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
