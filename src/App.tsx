import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import UsersPage from "./pages/UsersPage";
import LearningAreasPage from "./pages/LearningAreasPage";
import StreamsPage from "./pages/StreamsPage";
import LearnersPage from "./pages/LearnersPage";
import MarksEntryPage from "./pages/MarksEntryPage";
import ReportsPage from "./pages/ReportsPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import SmsPage from "./pages/SmsPage";
import PromotionPage from "./pages/PromotionPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const { user, role, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && role && !allowedRoles.includes(role)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute allowedRoles={['admin']}><UsersPage /></ProtectedRoute>} />
            <Route path="/learning-areas" element={<ProtectedRoute allowedRoles={['admin']}><LearningAreasPage /></ProtectedRoute>} />
            <Route path="/streams" element={<ProtectedRoute allowedRoles={['admin']}><StreamsPage /></ProtectedRoute>} />
            <Route path="/learners" element={<ProtectedRoute allowedRoles={['admin', 'headteacher', 'teacher']}><LearnersPage /></ProtectedRoute>} />
            <Route path="/marks-entry" element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><MarksEntryPage /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute allowedRoles={['admin', 'headteacher']}><AnalyticsPage /></ProtectedRoute>} />
            <Route path="/sms" element={<ProtectedRoute allowedRoles={['admin']}><SmsPage /></ProtectedRoute>} />
            <Route path="/promotion" element={<ProtectedRoute allowedRoles={['admin']}><PromotionPage /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
