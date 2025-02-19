
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import AdminConsole from "./pages/AdminConsole";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const [hasAccess, setHasAccess] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);

  useEffect(() => {
    const checkAccessPermission = async () => {
      console.log("Starting permission check");
      console.log("Current user:", user);
      
      try {
        if (!user) {
          console.log("No user found, setting checkingAccess to false");
          setCheckingAccess(false);
          return;
        }

        console.log("Fetching user profile for ID:", user.id);
        const { data, error } = await supabase
          .from('profiles')
          .select('permission')
          .eq('id', user.id)
          .single();

        console.log("Profile data received:", data);
        console.log("Profile error if any:", error);

        if (!error && data) {
          const hasUpdatePermission = data.permission === 'update_settings';
          console.log("Permission check result:", hasUpdatePermission);
          setHasAccess(hasUpdatePermission);
        } else {
          console.log("No profile data found or error occurred");
          setHasAccess(false);
        }
      } catch (error) {
        console.error('Error checking permissions:', error);
        setHasAccess(false);
      } finally {
        console.log("Setting checkingAccess to false");
        setCheckingAccess(false);
      }
    };

    checkAccessPermission();
  }, [user]);

  console.log("AdminRoute render state:", {
    loading,
    checkingAccess,
    hasAccess,
    userExists: !!user
  });

  if (loading || checkingAccess) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user || !hasAccess) {
    console.log("Redirecting to home - No access", {
      userExists: !!user,
      hasAccess
    });
    return <Navigate to="/" replace />;
  }

  console.log("Rendering admin console");
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Index />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminConsole />
              </AdminRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
