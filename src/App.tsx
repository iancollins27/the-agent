import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
import ExecutionView from "./components/admin/execution-view/ExecutionView";
import UpdateProjectEmbeddings from "./pages/UpdateProjectEmbeddings";

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

const App = () => (
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
          path="/admin/executions/:executionId" 
          element={
            <ProtectedRoute>
              <AdminConsole />
            </ProtectedRoute>
          }
        >
          <Route path="" element={<ExecutionView />} />
        </Route>
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
        <Route path="/update-project-embeddings" element={<UpdateProjectEmbeddings />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
