import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './components/ToastProvider';
import { ConfirmProvider } from './components/ConfirmDialog';
import { LoginPage } from './pages/LoginPage';
import { MainLayout } from './pages/MainLayout';
import { EmployeeDashboard } from './pages/EmployeeDashboard';
import { FileLeavePage } from './pages/FileLeavePage';
import { MyRequestsPage } from './pages/MyRequestsPage';
import { LeaveDetailPage } from './pages/LeaveDetailPage';
import { ApprovalsPage } from './pages/ApprovalsPage';
import { HRDashboard } from './pages/HRDashboard';
import { SystemAdminDashboard } from './pages/SystemAdminDashboard';
import { DepartmentManagementPage } from './pages/DepartmentManagementPage';
import { EmployeeApprovalRoutesPage } from './pages/EmployeeApprovalRoutesPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const { isAuthenticated, isSystemAdmin, isHR, isAdmin } = useAuth();
  
  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
        <Route index element={(isHR || isAdmin) ? <Navigate to="/hr" replace /> : <EmployeeDashboard />} />
        <Route path="file-leave" element={<FileLeavePage />} />
        <Route path="my-requests" element={<MyRequestsPage />} />
        <Route path="leave/:id" element={<LeaveDetailPage />} />
        <Route path="approvals" element={<ApprovalsPage />} />
        <Route path="hr" element={isHR ? <HRDashboard /> : <Navigate to="/" replace />} />
        <Route path="departments" element={isHR ? <DepartmentManagementPage /> : <Navigate to="/" replace />} />
        <Route path="approval-routes" element={isHR ? <EmployeeApprovalRoutesPage /> : <Navigate to="/" replace />} />
        <Route path="system-admin" element={isSystemAdmin ? <SystemAdminDashboard /> : <Navigate to="/" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <ConfirmProvider>
            <AppRoutes />
          </ConfirmProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
