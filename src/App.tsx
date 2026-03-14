import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import AuthPage from "./pages/AuthPage";
import PublicHome from "./pages/PublicHome";
import CustomerHome from "./pages/CustomerHome";
import BusinessDetail from "./pages/BusinessDetail";
import MyBookings from "./pages/MyBookings";
import NotificationsPage from "./pages/NotificationsPage";
import ProfilePage from "./pages/ProfilePage";
import OwnerDashboard from "./pages/OwnerDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading, roles } = useAuth();

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <Routes>
      {/* Public landing page */}
      <Route path="/" element={<PublicHome />} />

      <Route path="/auth" element={user ? <Navigate to="/home" replace /> : <AuthPage />} />

      {/* Authenticated home - role-based */}
      <Route path="/home" element={
        <ProtectedRoute>
          {roles.includes('admin') ? <AdminDashboard /> :
           roles.includes('owner') ? <OwnerDashboard /> :
           <CustomerHome />}
        </ProtectedRoute>
      } />

      <Route path="/admin" element={
        <ProtectedRoute><AdminDashboard /></ProtectedRoute>
      } />
      <Route path="/dashboard" element={
        <ProtectedRoute><OwnerDashboard /></ProtectedRoute>
      } />
      <Route path="/business/:id" element={<BusinessDetail />} />
      <Route path="/my-bookings" element={
        <ProtectedRoute><MyBookings /></ProtectedRoute>
      } />
      <Route path="/notifications" element={
        <ProtectedRoute><NotificationsPage /></ProtectedRoute>
      } />
      <Route path="/profile" element={
        <ProtectedRoute><ProfilePage /></ProtectedRoute>
      } />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
