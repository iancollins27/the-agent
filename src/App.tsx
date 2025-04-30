import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import ProjectManager from './pages/ProjectManager';
import ProjectDetails from './pages/ProjectDetails';
import ActionApprovals from './pages/ActionApprovals';
import AdminConsole from './pages/AdminConsole';
import Settings from './pages/Settings';
import { useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import UpdateProfile from './pages/UpdateProfile';
import PrivateRoute from './components/PrivateRoute';
import PublicRoute from './components/PublicRoute';
import ExecutionViewer from './pages/ExecutionViewer';

function App() {
  const { currentUser } = useAuth();

  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
        <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />

        {/* Private Routes */}
        <Route path="/" element={<PrivateRoute><ProjectManager /></PrivateRoute>} />
        <Route path="/project/:id" element={<PrivateRoute><ProjectDetails /></PrivateRoute>} />
        <Route path="/action-approvals" element={<PrivateRoute><ActionApprovals /></PrivateRoute>} />
        <Route path="/admin" element={<PrivateRoute><AdminConsole /></PrivateRoute>} />
        <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
        <Route path="/update-profile" element={<PrivateRoute><UpdateProfile /></PrivateRoute>} />
        
        {/* Add the new route for execution viewer */}
        <Route path="/admin/executions/:executionId" element={<ExecutionViewer />} />
      </Routes>
    </Router>
  );
}

export default App;
