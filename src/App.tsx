
import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import ProjectManager from './pages/ProjectManager';
import AdminConsole from './pages/AdminConsole';
import ExecutionViewer from './pages/ExecutionViewer';
import { useAuth } from './hooks/useAuth';

function App() {
  const { user } = useAuth();

  return (
    <Router>
      <Routes>
        {/* Main Routes */}
        <Route path="/" element={<ProjectManager />} />
        <Route path="/admin" element={<AdminConsole />} />
        <Route path="/admin/executions/:executionId" element={<ExecutionViewer />} />
      </Routes>
    </Router>
  );
}

export default App;
