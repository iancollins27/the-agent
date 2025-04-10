
import { Routes, Route } from 'react-router-dom';
import React from 'react';
import { AuthProvider } from '@/integrations/supabase/UserProvider';
import NotFound from './pages/NotFound';
import WebhookTestPage from './pages/WebhookTestPage';
import AgentChat from './pages/AgentChat';
import AdminConsole from './pages/AdminConsole';
import ProjectManager from './pages/ProjectManager';
import CompanySettings from './pages/CompanySettings';
import MermaidDiagrams from './pages/MermaidDiagrams';
import Auth from './pages/Auth';

const LazyWebhookTestPage = React.lazy(() => import('./pages/WebhookTestPage'));

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Auth />} />
        <Route path="/admin" element={<AdminConsole />} />
        <Route path="/chat" element={<AgentChat />} />
        <Route path="/" element={<ProjectManager />} />
        <Route path="/company/settings" element={<CompanySettings />} />
        <Route path="/diagrams" element={<MermaidDiagrams />} />
        <Route path="/webhook-test" element={
          <React.Suspense fallback={<div>Loading...</div>}>
            <LazyWebhookTestPage />
          </React.Suspense>
        } />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
