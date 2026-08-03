import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use(config => {
  const token = sessionStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      if (window.location.pathname !== '/login') window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const getApiErrorMessage = (error: unknown, fallback = 'Something went wrong'): string => {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error && error.message ? error.message : fallback;
  }

  const data: unknown = error.response?.data;
  if (typeof data === 'string' && data.trim()) return data;

  if (data && typeof data === 'object') {
    const response = data as Record<string, unknown>;
    for (const key of ['message', 'detail', 'title', 'error']) {
      const value = response[key];
      if (typeof value === 'string' && value.trim()) return value;
    }
  }

  if (!error.response) return 'Unable to connect to the server. Check your connection and try again.';
  return fallback;
};

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export interface LeaveType {
  id: number;
  code: string;
  description: string;
  maxDaysPerYear: number;
  requiresAttachment: boolean;
  isHoursBased: boolean;
  deductsFromBalance: boolean;
}

export interface LeaveBalance {
  id: number;
  leaveTypeId: number;
  leaveTypeCode: string;
  leaveTypeDescription: string;
  year: number;
  totalCredits: number;
  carryOver: number;
  used: number;
  pending: number;
  available: number;
  hrRemarks?: string;
}

export interface LeaveRequestDayDto {
  date: string;
  hours: number;
  isPaid: boolean;
  halfDayTime?: string;
}

export interface LeaveRequest {
  id: number;
  dateFiled: string;
  leaveTypeCode: string;
  leaveTypeDescription: string;
  dateFrom: string;
  dateTo: string;
  totalDays: number;
  totalHours: number;
  halfDayTime?: string;
  reason: string;
  status: string;
  approvalSteps?: ApprovalStepInfo[];
  days?: LeaveRequestDayDto[];
  originalRequestId?: number;
  rescheduledToRequestId?: number;
}

export interface ApprovalStepInfo {
  id?: number;
  stepOrder: number;
  stepLabel: string;
  action: string;
  approverName: string;
  approverPosition: string;
  remarks?: string;
  reasonForRejection?: string;
  signatureData?: string;
  actionDate?: string;
}

export interface LeaveRequestDetail extends LeaveRequest {
  employee: {
    fullName: string;
    employeeID: string;
    position: string;
    department: string;
    section: string;
    employmentStatus: string;
    dateHired: string;
  };
  leaveType: { code: string; description: string; isHoursBased: boolean };
  notedByHR?: string;
  dateProcessed?: string;
  updatedLeaveBalance?: number;
  hrRemarks?: string;
  attachments: { id: number; fileName: string; fileSize: number; uploadedAt: string }[];
  auditTrail: { action: string; performedBy: string; details: string; timestamp: string }[];
  days?: LeaveRequestDayDto[];
  originalRequestId?: number;
  rescheduledToRequestId?: number;
}

export interface PendingApproval {
  approvalStepId: number;
  stepLabel: string;
  leaveRequestId: number;
  dateFiled: string;
  employeeName: string;
  employeeID: string;
  department: string;
  leaveTypeCode: string;
  leaveTypeDescription: string;
  dateFrom: string;
  dateTo: string;
  totalDays: number;
  totalHours: number;
  halfDayTime?: string;
  reason: string;
  status: string;
}

export interface Holiday {
  id: number;
  date: string;
  name: string;
  type: string;
  year: number;
}

export interface DashboardStats {
  pendingRequests: number;
  approvedThisYear: number;
  balances: { leaveTypeCode: string; available: number; totalCredits: number; used: number }[];
}

export interface HREmployee {
  id: number;
  employeeID: string;
  fullName: string;
  position: string;
  department: string;
  section: string;
  employmentStatus: string;
  orgRole: string;
  dateHired: string;
  supervisorId?: number;
  managerId?: number;
  supervisorName?: string;
  managerName?: string;
}

// â”€â”€ API Services â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const AuthAPI = {
  login: (data: { username: string; password: string }) =>
    api.post<{ token: string; user: { id: number; username: string; role: string } }>('/auth/login', data).then(r => r.data),
  employeeLogin: (data: { employeeID: string; pin: string }) =>
    api.post<{ token: string; user: { id: number; username: string; role: string }; requiresPinChange?: boolean }>('/auth/employee-login', data).then(r => r.data),
};

export const LeaveAPI = {
  getTypes: () => api.get<LeaveType[]>('/leave/types').then(r => r.data),
  getBalance: (year?: number) => api.get<LeaveBalance[]>('/leave/balance', { params: { year } }).then(r => r.data),
  getEmployeeBalance: (empId: number, year?: number) => api.get<LeaveBalance[]>(`/leave/balance/${empId}`, { params: { year } }).then(r => r.data),
  apply: (data: { leaveTypeId: number; dateFrom: string; dateTo: string; totalHours: number; halfDayTime?: string; reason: string; days?: LeaveRequestDayDto[] }) =>
    api.post('/leave/apply', data).then(r => r.data),
  reschedule: (id: number, data: { leaveTypeId: number; dateFrom: string; dateTo: string; totalHours: number; halfDayTime?: string; reason: string; days?: LeaveRequestDayDto[] }) =>
    api.post(`/leave/${id}/reschedule`, data).then(r => r.data),
  getMyRequests: (status?: string) => api.get<LeaveRequest[]>('/leave/my-requests', { params: { status } }).then(r => r.data),
  getRequest: (id: number) => api.get<LeaveRequestDetail>(`/leave/${id}`).then(r => r.data),
  cancel: (id: number) => api.put(`/leave/${id}/cancel`).then(r => r.data),
  deleteRequest: (id: number) => api.delete(`/leave/${id}`).then(r => r.data),
  getHistory: (employeeId?: number, year?: number) => api.get<LeaveRequest[]>('/leave/history', { params: { employeeId, year } }).then(r => r.data),
  uploadAttachment: (id: number, file: File, onUploadProgress?: (progressEvent: any) => void) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/leave/${id}/attachments`, formData, { 
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress
    }).then(r => r.data);
  },
  getHolidays: (year?: number) => api.get<Holiday[]>('/leave/holidays', { params: { year } }).then(r => r.data),
  addHoliday: (data: { date: string; name: string; type: string }) => api.post('/leave/holidays', data).then(r => r.data),
  deleteHoliday: (id: number) => api.delete(`/leave/holidays/${id}`),
  getDashboardStats: () => api.get<DashboardStats>('/leave/dashboard-stats').then(r => r.data),
};

export const ApprovalAPI = {
  getPending: () => api.get<PendingApproval[]>('/approval/pending').then(r => r.data),
  approve: (leaveRequestId: number, data: { remarks?: string; signatureData?: string }) =>
    api.post(`/approval/${leaveRequestId}/approve`, data).then(r => r.data),
  disapprove: (leaveRequestId: number, data: { remarks?: string; reasonForRejection?: string; signatureData?: string }) =>
    api.post(`/approval/${leaveRequestId}/disapprove`, data).then(r => r.data),
  getTeamCalendar: (month?: number, year?: number) =>
    api.get('/approval/team-calendar', { params: { month, year } }).then(r => r.data),
  getAllPending: () => api.get('/approval/all-pending').then(r => r.data),
};

export const HRAPI = {
  getLeaveLedger: (department?: string, year?: number) =>
    api.get('/hr/leave-requests', { params: { department, year } }).then(r => r.data),
  getLeaveTransactions: (department?: string, year?: number) =>
    api.get('/hr/leave-transactions', { params: { department, year } }).then(r => r.data),
  getEmployeeLeaveLedger: (employeeId: number, year?: number) =>
    api.get(`/hr/leave-ledger/${employeeId}`, { params: { year } }).then(r => r.data),
  getLeaveSummary: (year?: number, month?: number) =>
    api.get('/hr/reports/summary', { params: { year, month } }).then(r => r.data),
  getEmployeeBalances: (year?: number) => api.get('/hr/employee-balances', { params: { year } }).then(r => r.data),
  updateBalance: (employeeId: number, data: { leaveTypeId: number; totalCredits?: number; carryOver?: number; hrRemarks?: string }) =>
    api.put(`/hr/balance/${employeeId}`, data).then(r => r.data),
  finalize: (leaveRequestId: number, data: { notedByHR?: string; hrRemarks?: string }) =>
    api.post(`/hr/finalize/${leaveRequestId}`, data).then(r => r.data),
  getMonthlySummary: (month?: number, year?: number) =>
    api.get('/hr/reports/summary', { params: { month, year } }).then(r => r.data),
  getAnnualReport: (year?: number, dateFrom?: string, dateTo?: string) => api.get('/hr/reports/annual', { params: { year, dateFrom, dateTo } }).then(r => r.data),
  getDepartments: () => api.get<string[]>('/hr/reports/departments').then(r => r.data),
  getEmployees: () => api.get<HREmployee[]>('/hr/employees').then(r => r.data),
  updateEmployeeOrg: (id: number, data: { orgRole?: string; supervisorId?: number; managerId?: number; section?: string; employmentStatus?: string }) =>
    api.put(`/hr/employees/${id}/org`, data).then(r => r.data),
};

export const SystemAdminAPI = {
  getUsers: () => api.get('/auth/users').then(r => r.data),
  updateUserRole: (id: number, data: { role: string }) =>
    api.put(`/systemadmin/users/${id}/role`, data).then(r => r.data),
  changeUserPassword: (id: number, data: { newPassword: string }) =>
    api.put(`/systemadmin/users/${id}/password`, data).then(r => r.data),
  updateEmployeeRole: (id: number, data: { orgRole: string }) =>
    api.put(`/systemadmin/employees/${id}/orgrole`, data).then(r => r.data),
};
export default api;

export const DepartmentAPI = {
  getAll: async () => (await api.get('/department')).data,
  getById: async (id: number) => (await api.get('/department/' + id)).data,
  create: async (data: any) => (await api.post('/department', data)).data,
  update: async (id: number, data: any) => (await api.put('/department/' + id, data)).data,
  delete: async (id: number) => (await api.delete('/department/' + id)).data,
  assignEmployee: async (id: number, data: any) => (await api.post('/department/' + id + '/employees', data)).data,
};

export const ApprovalRouteAPI = {
  getByEmployee: async (employeeId: number) => (await api.get('/approvalroute/employee/' + employeeId)).data,
  create: async (data: any) => (await api.post('/approvalroute', data)).data,
  delete: async (id: number) => (await api.delete('/approvalroute/' + id)).data,
  deleteAllForEmployee: async (employeeId: number) => (await api.delete('/approvalroute/employee/' + employeeId)).data,
};
