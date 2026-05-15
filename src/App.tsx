import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, lazy, Suspense } from "react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";

// Eager: tiny + needed for first paint
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";

// Lazy: split into separate chunks — loaded on demand
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const SuperAdminDashboard = lazy(() => import("./pages/SuperAdminDashboard"));
const ManageSchoolsPage = lazy(() => import("./pages/ManageSchoolsPage"));
const PriceBoardPage = lazy(() => import("./pages/PriceBoardPage"));
const UsersPage = lazy(() => import("./pages/UsersPage"));
const LearningAreasPage = lazy(() => import("./pages/LearningAreasPage"));
const StreamsPage = lazy(() => import("./pages/StreamsPage"));
const GradesPage = lazy(() => import("./pages/GradesPage"));
const LearnersPage = lazy(() => import("./pages/LearnersPage"));
const MarksEntryPage = lazy(() => import("./pages/MarksEntryPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const ConsolidatedReportsPage = lazy(() => import("./pages/ConsolidatedReportsPage"));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));
const SmsPage = lazy(() => import("./pages/SmsPage"));
const PromotionPage = lazy(() => import("./pages/PromotionPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const AttendancePage = lazy(() => import("./pages/AttendancePage"));
const TeacherAssignmentsPage = lazy(() => import("./pages/TeacherAssignmentsPage"));
const GradeAnalysisPage = lazy(() => import("./pages/GradeAnalysisPage"));
const StrandsPage = lazy(() => import("./pages/StrandsPage"));
const PerformanceTrackingPage = lazy(() => import("./pages/PerformanceTrackingPage"));
const TeacherDashboardPage = lazy(() => import("./pages/TeacherDashboardPage"));
const MorePage = lazy(() => import("./pages/MorePage"));
const ContentGenerationPage = lazy(() => import("./pages/ContentGenerationPage"));
const TimetablePage = lazy(() => import("./pages/TimetablePage"));
const TimetableKeysPage = lazy(() => import("./pages/TimetableKeysPage"));
const FeesPage = lazy(() => import("./pages/FeesPage"));
const ParentDashboard = lazy(() => import("./pages/ParentDashboard"));
const SharedReportPage = lazy(() => import("./pages/SharedReportPage"));
const CurriculumDesignManagerPage = lazy(() => import("./pages/CurriculumDesignManagerPage"));
const CurriculumLibraryPage = lazy(() => import("./pages/CurriculumLibraryPage"));
const WhatsAppPage = lazy(() => import("./pages/WhatsAppPage"));
const ParentPortalLinkPage = lazy(() => import("./pages/ParentPortalLinkPage"));
const ParentCommunicationPage = lazy(() => import("./pages/ParentCommunicationPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const PageSpinner = () => (
  <div className="flex min-h-screen items-center justify-center">
    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
  </div>
);

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const { user, role, loading } = useAuth();
  if (loading) return <PageSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !role) return <PageSpinner />;
  if (allowedRoles && role && !allowedRoles.includes(role)) {
    if (role === 'parent') return <Navigate to="/parent" replace />;
    return <Navigate to={role === 'super_admin' ? '/super-admin' : '/dashboard'} replace />;
  }
  return <>{children}</>;
}

function SmartRedirect() {
  const { user, role, loading } = useAuth();
  if (loading) return <PageSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (role === 'super_admin') return <Navigate to="/super-admin" replace />;
  if (role === 'parent') return <Navigate to="/parent" replace />;
  return <Dashboard />;
}

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
      path.startsWith('/r/') ||
      path.startsWith('/p/');

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
            <PwaInstallPrompt />
            <Suspense fallback={<PageSpinner />}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/r/:token" element={<SharedReportPage />} />
                <Route path="/p/:token" element={<ParentPortalLinkPage />} />
                <Route path="/" element={<SmartRedirect />} />
                {/* Super Admin routes */}
                <Route path="/super-admin" element={<ProtectedRoute allowedRoles={['super_admin']}><SuperAdminDashboard /></ProtectedRoute>} />
                <Route path="/manage-schools" element={<ProtectedRoute allowedRoles={['super_admin']}><ManageSchoolsPage /></ProtectedRoute>} />
                <Route path="/price-board" element={<ProtectedRoute allowedRoles={['super_admin']}><PriceBoardPage /></ProtectedRoute>} />
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
                <Route path="/consolidated-reports" element={<ProtectedRoute allowedRoles={['admin', 'headteacher']}><ErrorBoundary inline label="Consolidated Reports"><ConsolidatedReportsPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/analytics" element={<ProtectedRoute allowedRoles={['admin', 'headteacher']}><AnalyticsPage /></ProtectedRoute>} />
                <Route path="/sms" element={<ProtectedRoute allowedRoles={['admin']}><SmsPage /></ProtectedRoute>} />
                <Route path="/parent-communication" element={<ProtectedRoute allowedRoles={['admin']}><ErrorBoundary inline label="Parent Communication"><ParentCommunicationPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/whatsapp" element={<ProtectedRoute allowedRoles={['admin']}><ErrorBoundary inline label="WhatsApp"><WhatsAppPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/promotion" element={<ProtectedRoute allowedRoles={['admin']}><PromotionPage /></ProtectedRoute>} />
                <Route path="/strands" element={<ProtectedRoute allowedRoles={['admin']}><StrandsPage /></ProtectedRoute>} />
                <Route path="/teacher-assignments" element={<ProtectedRoute allowedRoles={['admin']}><TeacherAssignmentsPage /></ProtectedRoute>} />
                <Route path="/grade-analysis" element={<ProtectedRoute allowedRoles={['admin', 'headteacher', 'teacher']}><GradeAnalysisPage /></ProtectedRoute>} />
                <Route path="/performance-tracking" element={<ProtectedRoute allowedRoles={['admin', 'headteacher', 'teacher']}><PerformanceTrackingPage /></ProtectedRoute>} />
                <Route path="/teacher-dashboard" element={<ProtectedRoute allowedRoles={['teacher']}><ErrorBoundary inline label="Teacher Dashboard"><TeacherDashboardPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute allowedRoles={['admin']}><SettingsPage /></ProtectedRoute>} />
                <Route path="/fees" element={<ProtectedRoute allowedRoles={['admin']}><FeesPage /></ProtectedRoute>} />
                <Route path="/content-generation" element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><ContentGenerationPage /></ProtectedRoute>} />
                <Route path="/more" element={<ProtectedRoute><MorePage /></ProtectedRoute>} />
                {/* Parent routes */}
                <Route path="/parent" element={<ProtectedRoute allowedRoles={['parent']}><ParentDashboard /></ProtectedRoute>} />
                <Route path="*" element={<SmartRedirect />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
