
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import AdminConsole from "./pages/AdminConsole";
import AgentChat from "./pages/AgentChat";
import ChatbotConfig from "./pages/ChatbotConfig";
import CompanySettings from "./pages/CompanySettings";
import MermaidDiagrams from "./pages/MermaidDiagrams";
import ProjectManager from "./pages/ProjectManager";
import { useState } from "react";

// Create a QueryClient with proper configuration for error handling
const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      // Set up global query options
      retry: 2, // Retry failed queries twice
      retryDelay: attempt => Math.min(1000 * 2 ** attempt, 30000), // Exponential backoff
      staleTime: 1000 * 60 * 5, // Data is fresh for 5 minutes
      refetchOnWindowFocus: false, // Don't refetch on window focus
      refetchOnMount: true, // Refetch on component mount if stale
    },
  },
});

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

const App = () => {
  // Create a new QueryClient instance for each session
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AdminConsole />
              </ProtectedRoute>
            }
          />
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute>
                <AdminConsole />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/chat" 
            element={
              <ProtectedRoute>
                <AgentChat />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/chatbot-config" 
            element={
              <ProtectedRoute>
                <ChatbotConfig />
              </ProtectedRoute>
            } 
          />
          <Route path="/company-settings" element={<CompanySettings />} />
          <Route
            path="/system-diagrams"
            element={
              <ProtectedRoute>
                <MermaidDiagrams />
              </ProtectedRoute>
            }
          />
          <Route
            path="/project-manager"
            element={
              <ProtectedRoute>
                <ProjectManager />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
};

export default App;
