
import { Routes, Route } from 'react-router-dom';
import React from 'react';
import AdminPage from './pages/AdminPage';
import ChatPage from './pages/ChatPage';
import ProjectPage from './pages/ProjectPage';
import CompanyPage from './pages/CompanyPage';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import PublicPage from './pages/PublicPage';
import PricingPage from './pages/PricingPage';
import AccountPage from './pages/AccountPage';
import SubscriptionPage from './pages/SubscriptionPage';
import NotFoundPage from './pages/NotFoundPage';
import WebhookTestPage from './pages/WebhookTestPage';

const LazyWebhookTestPage = React.lazy(() => import('./pages/WebhookTestPage'));

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/public" element={<PublicPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="*" element={<NotFoundPage />} />
      <Route path="/" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
      <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
      <Route path="/project/:id" element={<ProtectedRoute><ProjectPage /></ProtectedRoute>} />
      <Route path="/company/:id" element={<ProtectedRoute><CompanyPage /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
      <Route path="/account" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />
      <Route path="/subscription" element={<ProtectedRoute><SubscriptionPage /></ProtectedRoute>} />
      <Route path="/webhook-test" element={
        <React.Suspense fallback={<div>Loading...</div>}>
          <LazyWebhookTestPage />
        </React.Suspense>
      } />
    </Routes>
  );
}

export default App;
