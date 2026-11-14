import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './components/ToastProvider';
import { ConfirmProvider } from './components/ConfirmDialog';
import { ThemeProvider } from './contexts/ThemeContext';
import { LoginPage } from './pages/LoginPage';
import { MainLayout } from './pages/MainLayout';

const EmployeeDashboard = lazy(() => import('./pages/EmployeeDashboard').then(m => ({ default: m.EmployeeDashboard })));
const FileLeavePage = lazy(() => import('./pages/FileLeavePage').then(m => ({ default: m.FileLeavePage })));
const MyRequestsPage = lazy(() => import('./pages/MyRequestsPage').then(m => ({ default: m.MyRequestsPage })));
const LeaveDetailPage = lazy(() => import('./pages/LeaveDetailPage').then(m => ({ default: m.LeaveDetailPage })));
const ApprovalsPage = lazy(() => import('./pages/ApprovalsPage').then(m => ({ default: m.ApprovalsPage })));
const HRDashboard = lazy(() => import('./pages/HRDashboard').then(m => ({ default: m.HRDashboard })));
const SystemAdminDashboard = lazy(() => import('./pages/SystemAdminDashboard').then(m => ({ default: m.SystemAdminDashboard })));
const SystemOperationsPage = lazy(() => import('./pages/SystemOperationsPage').then(m => ({ default: m.SystemOperationsPage })));
const SystemRepairPage = lazy(() => import('./pages/SystemRepairPage').then(m => ({ default: m.SystemRepairPage })));
const EmploymentStatusPage = lazy(() => import('./pages/EmploymentStatusPage').then(m => ({ default: m.EmploymentStatusPage })));
const DepartmentManagementPage = lazy(() => import('./pages/DepartmentManagementPage').then(m => ({ default: m.DepartmentManagementPage })));
const EmployeeApprovalRoutesPage = lazy(() => import('./pages/EmployeeApprovalRoutesPage').then(m => ({ default: m.EmployeeApprovalRoutesPage })));
const ApprovalRoutingHubPage = lazy(() => import('./pages/ApprovalRoutingHubPage').then(m => ({ default: m.ApprovalRoutingHubPage })));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage').then(m => ({ default: m.NotificationsPage })));
const LeavePolicyCalendarPage = lazy(() => import('./pages/LeavePolicyCalendarPage').then(m => ({ default: m.LeavePolicyCalendarPage })));

const LeaveAdministrationPage = lazy(() => import('./pages/LeaveAdministrationPage').then(m => ({ default: m.LeaveAdministrationPage })));

const RouteFallback = () => (
  <div className="loading-spinner" role="status" aria-live="polite">
    <div className="spinner" aria-hidden="true" />
    <span className="sr-only">Loading page…</span>
  </div>
);

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const { isAuthenticated, isSystemAdmin, isHR, isAdmin, isEmployee, isApprover, capabilities, accessLoading } = useAuth();
  if (isAuthenticated && accessLoading) return <RouteFallback />;
  
  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
        <Route index element={isHR ? <Navigate to="/hr" replace /> : isAdmin ? <Navigate to="/system" replace /> : isEmployee ? <EmployeeDashboard /> : <Navigate to="/notifications" replace />} />
        <Route path="personal" element={isEmployee ? <EmployeeDashboard /> : <Navigate to="/" replace />} />
        <Route path="file-leave" element={isEmployee ? <FileLeavePage /> : <Navigate to="/" replace />} />
        <Route path="my-requests" element={isEmployee ? <MyRequestsPage /> : <Navigate to="/" replace />} />
        <Route path="leave/:id" element={isEmployee || isApprover || isHR ? <LeaveDetailPage /> : <Navigate to="/" replace />} />
        <Route path="approvals" element={isApprover ? <ApprovalsPage /> : <Navigate to="/" replace />} />
        <Route path="system" element={isAdmin ? <SystemOperationsPage /> : <Navigate to="/" replace />} />
        <Route path="hr/leave-administration" element={isHR ? <LeaveAdministrationPage /> : <Navigate to="/" replace />} />
        <Route path="system-health" element={isSystemAdmin ? <SystemRepairPage /> : <Navigate to="/" replace />} />
        <Route path="employment-status" element={isHR ? <Navigate to="/hr/employment-status" replace /> : <Navigate to="/" replace />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="hr" element={isHR ? <HRDashboard /> : <Navigate to="/" replace />} />
        <Route path="hr/employment-status" element={isHR ? <EmploymentStatusPage /> : <Navigate to="/" replace />} />
        <Route path="departments" element={isHR ? <DepartmentManagementPage /> : <Navigate to="/" replace />} />
        <Route path="approval-routes" element={isHR ? <EmployeeApprovalRoutesPage /> : <Navigate to="/" replace />} />
        <Route path="approval-routing" element={isHR ? <ApprovalRoutingHubPage /> : <Navigate to="/" replace />} />
        <Route path="hr/leave-policies" element={capabilities.includes('HRManagement') ? <LeavePolicyCalendarPage /> : <Navigate to="/" replace />} />
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
        <ThemeProvider>
          <ToastProvider>
            <ConfirmProvider>
              <Suspense fallback={<RouteFallback />}>
                <AppRoutes />
              </Suspense>
            </ConfirmProvider>
          </ToastProvider>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
