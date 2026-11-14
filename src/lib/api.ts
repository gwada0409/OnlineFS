import axios from 'axios';

const api = axios.create({
  baseURL: '/api'
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
    const validationErrors = response.errors;
    if (validationErrors && typeof validationErrors === 'object') {
      const messages = Object.values(validationErrors as Record<string, unknown>)
        .flatMap(value => Array.isArray(value) ? value : [value])
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
      if (messages.length > 0) return [...new Set(messages)].join(' ');
    }
    for (const key of ['message', 'detail', 'title', 'error']) {
      const value = response[key];
      if (typeof value === 'string' && value.trim()) return value;
    }
  }

  if (!error.response) return 'Unable to connect to the server. Check your connection and try again.';
  return fallback;
};

// -- Types -------------------------------------------------------------

export interface LeaveType {
  id: number;
  code: string;
  description: string;
  maxDaysPerYear: number;
  requiresAttachment: boolean;
  isHoursBased: boolean;
  deductsFromBalance: boolean;
  carryOverLimit: number; probationWaitingDays: number; minimumDaysPerRequest: number;
  maximumDaysPerRequest?: number; advanceFilingDays: number; maximumFutureFilingDays: number;
  allowBackdatedFiling: boolean; attachmentRequiredAfterDays?: number;
  eligibleEmploymentStatuses: string; countWeekends: boolean; countHolidays: boolean; isActive?: boolean;
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
  balanceDeductionLeaveTypeCode?: string;
  reason: string;
  status: string;
  requestKind: 'Leave' | 'Reschedule' | 'Cancellation';
  approvalSteps?: ApprovalStepInfo[];
  days?: LeaveRequestDayDto[];
  originalRequestId?: number;
  rescheduledToRequestId?: number;
  pendingChangeKind?: 'Cancellation' | 'Reschedule' | null;
  notedByHR?: string;
  dateProcessed?: string;
  updatedLeaveBalance?: number;
  hrRemarks?: string;
  hrConfirmedPaidException?: boolean;
  disciplinaryReviewRequired?: boolean;
  leaveBalanceAtFile?: Partial<Record<'SL' | 'VL' | 'AL' | 'NPL', number>>;
}

export interface ApprovalStepInfo {
  id?: number;
  stepOrder: number;
  stageOrder?: number | null;
  stageKind?: string | null;
  stepLabel: string;
  action: string;
  approverId?: number;
  originalApproverId?: number;
  actingApproverId?: number;
  wasDelegated?: boolean;
  delegationId?: number;
  approverName: string;
  actingApproverName?: string;
  approverPosition: string;
  remarks?: string;
  reasonForRejection?: string;
  signatureData?: string;
  actionDate?: string;
}

export interface LeaveRequestDetail extends LeaveRequest {
  conversationAccess?: { isEmployeeOwner: boolean; canComment: boolean; canRequestEmployeeDetails: boolean; canUploadAttachments: boolean; canRevise: boolean };
  employee: {
    fullName: string;
    employeeID: string;
    position: string;
    department: string;
    section: string;
    employmentStatus: string;
    dateHired: string;
  };
  leaveType: { id: number; code: string; description: string; isHoursBased: boolean };
  balanceDeductionLeaveType?: { id: number; code: string; description: string } | null;
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
  stepOrder?: number;
  stageOrder?: number | null;
  stageKind?: string | null;
  leaveRequestId: number;
  employeeName: string;
  employeeID: string;
  employeePosition?: string;
  department: string;
  leaveTypeCode: string;
  leaveTypeDescription: string;
  dateFrom: string;
  dateTo: string;
  totalDays: number;
  totalHours: number;
  halfDayTime?: string;
  balanceDeductionLeaveTypeCode?: string;
  reason: string;
  dateFiled: string;
  status?: string;
  requestKind?: 'Leave' | 'Reschedule' | 'Cancellation';
  originalRequestId?: number;
  isDelegatedAction?: boolean;
  isDelegatedApproval?: boolean;
  waitingForEmployee?: boolean;
  delegationReason?: string;
  originalApproverName?: string;
}

export interface PendingApprovalLeaveSummary {
  employee: HREmployee;
  balances: LeaveBalance[];
  requests: LeaveRequest[];
}

export interface Holiday {
  id: number;
  date: string;
  name: string;
  type: string;
  year?: number;
  scope?: string; department?: string; location?: string; source?: string;
  isWorkingDay?: boolean; isAutoGenerated?: boolean; isAdminOverride?: boolean; isActive?: boolean;
}

export interface WorkCalendar { id: number; name: string; department?: string; workingDays: string; isDefault: boolean; isActive: boolean; }

export interface DashboardStats {
  pendingCount?: number;
  approvedCount?: number;
  disapprovedCount?: number;
  totalEmployees?: number;
  pendingRequests?: number;
  approvedThisYear?: number;
  balances?: any[];
}

export interface HREmployee {
  id: number;
  employeeID: string;
  fullName: string;
  position: string;
  department: string;
  leaveDepartmentId?: number | null;
  leaveDepartmentName?: string | null;
  section: string;
  orgRole: string;
  employmentStatus: string;
  dateHired: string;
  regularLineLeaderId?: number | null;
  supervisorId?: number;
  supervisorName?: string;
  managerId?: number;
  managerName?: string;
}

// -- Organizational Category & Department Types ------------------------

export interface ApprovalCategoryNode {
  id: number | null;
  name: string;
  description?: string;
  secondApproverId?: number | null;
  secondApproverName?: string | null;
  secondApproverPosition?: string | null;
  isActive: boolean;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
  departmentCount: number;
  employeeCount: number;
  departmentsWithFirstApproverCount?: number;
  departments: DepartmentNode[];
}

export interface DepartmentMember {
  id: number;
  employeeID: string;
  fullName: string;
  position: string;
  orgRole: string;
  department?: string;
}

export interface DepartmentBackupApprovers {
  notedBy: number | null;
  recommending: number | null;
  approver: number | null;
}

export interface DepartmentNode {
  id: number;
  name: string;
  description?: string;
  categoryId?: number | null;
  categoryName?: string | null;
  firstApproverId?: number | null;
  firstApproverIds?: number[] | null;
  notedByApproverIds?: number[] | null;
  backupApprovers?: DepartmentBackupApprovers;
    requiresOperatorLineLeader?: boolean;
    sickLeaveLineLeaderId?: number | null;
    operatorLineLeaderAssignments?: Record<number, number | null>;

  firstApproverName?: string | null;
  firstApproverPosition?: string | null;
  secondApproverId?: number | null;
  secondApproverName?: string | null;
  secondApproverPosition?: string | null;
  secondApproverOverrideId?: number | null;
  secondApproverOverrideName?: string | null;
  secondApproverOverridePosition?: string | null;
  hasSecondApproverOverride?: boolean;
  parentId?: number | null;
  parentName?: string | null;
  isActive: boolean;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
  employeeCount: number;
  approverCount?: number;
  approvers?: any[];
  employees?: DepartmentMember[];
  children?: DepartmentNode[];
}

export interface ApprovalRouteStepPreview {
  approverId: number;
  approverName: string;
  approverPosition: string;
  stepOrder: number;
  stageOrder?: number | null;
  stageKind?: string | null;
  stepLabel: string;
  approverType?: string;
  unitId: number;
  unitName: string;
  categoryId?: number | null;
  categoryName?: string | null;
}

export interface RouteValidationPreview {
  isValid: boolean;
  errorMessage?: string;
  departmentName?: string;
  categoryName?: string;
  hasFirstApprover?: boolean;
  hasSecondApprover?: boolean;
  steps: ApprovalRouteStepPreview[];
}

// -- Delegation Types --------------------------------------------------

export interface ApproverAbsenceRecord {
  id: number;
  employeeId: number;
  employeeName: string;
  employeePosition: string;
  employeeDepartment: string;
  startDate: string;
  endDate: string;
  reason: string;
  isActive: boolean;
  status: 'Active' | 'Scheduled' | 'Expired' | 'Revoked';
  createdAt: string;
  createdBy: string;
  revokedAt?: string;
  revocationReason?: string;
  revokedBy?: string;
}

export const ApproverAbsenceAPI = {
  getAll: () => api.get<ApproverAbsenceRecord[]>('/delegation/absences').then(r => r.data),
  create: (data: { employeeId: number; startDate: string; endDate: string; reason: string }) =>
    api.post('/delegation/absences', data).then(r => r.data),
  revoke: (id: number, reason: string) => api.put(`/delegation/absences/${id}/revoke`, { reason }).then(r => r.data),
};

export interface DelegationRecord {
  id: number;
  delegatorId: number;
  delegatorName: string;
  delegatorPosition: string;
  delegatorDepartment: string;
  delegateId: number;
  delegateName: string;
  delegatePosition: string;
  delegateDepartment: string;
  startDate: string;
  endDate: string;
  reason: string;
  isActive: boolean;
  isCurrentlyEffective: boolean;
  status: 'Active' | 'Scheduled' | 'Expired' | 'Revoked';
  createdAt: string;
  revokedAt?: string;
  revocationReason?: string;
}

// -- API Services ------------------------------------------------------

export const AuthAPI = {
  login: (data: { username: string; password: string }) =>
    api.post<{ token: string; user: { id: number; username: string; role: string } }>('/auth/login', data).then(r => r.data),
  employeeLogin: (data: { employeeID: string; pin: string }) =>
    api.post<{ token: string; user: { id: number; username: string; role: string }; requiresPinChange?: boolean }>('/auth/employee-login', data).then(r => r.data),
};

export const LeaveAPI = {
  getLineLeaderOptions: () => api.get<{ requiresSelection: boolean; departmentName?: string; lineLeaders: { id: number; fullName: string; position: string }[] }>('/leave/line-leader-options').then(r => r.data),
  getMyProfile: () => api.get<HREmployee>('/leave/my-profile').then(r => r.data),
  getTypes: () => api.get<LeaveType[]>('/leave/types').then(r => r.data),
  getBalance: (year?: number) => api.get<LeaveBalance[]>('/leave/balance', { params: { year } }).then(r => r.data),
  getEmployeeBalance: (empId: number, year?: number) => api.get<LeaveBalance[]>('/leave/balance/' + empId, { params: { year } }).then(r => r.data),
  apply: (data: { selectedLineLeaderId?: number; leaveTypeId: number; dateFrom: string; dateTo: string; totalHours: number; halfDayTime?: string; balanceDeductionLeaveTypeId?: number; reason: string; days?: LeaveRequestDayDto[] }, files: File[] = []) => {
    const formData = new FormData();
    formData.append('request', JSON.stringify(data));
    files.forEach(file => formData.append('files', file));
    return api.post('/leave/apply-with-attachments', formData).then(r => r.data);
  },
  reschedule: (id: number, data: { leaveTypeId: number; dateFrom: string; dateTo: string; totalHours: number; halfDayTime?: string; balanceDeductionLeaveTypeId?: number; reason: string; days?: LeaveRequestDayDto[] }, files: File[] = []) => {
    const formData = new FormData();
    formData.append('request', JSON.stringify(data));
    files.forEach(file => formData.append('files', file));
    return api.post('/leave/' + id + '/reschedule-with-attachments', formData).then(r => r.data);
  },
  getMyRequests: (status?: string) => api.get<LeaveRequest[]>('/leave/my-requests', { params: { status } }).then(r => r.data),
  getRequest: (id: number) => api.get<LeaveRequestDetail>('/leave/' + id).then(r => r.data),
  getAttachment: (id: number) => api.get<Blob>('/leave/attachments/' + id, { responseType: 'blob' }).then(r => r.data),
  cancel: (id: number) => api.put('/leave/' + id + '/cancel').then(r => r.data),
  requestCancellation: (id: number, reason: string) => api.post('/leave/' + id + '/request-cancellation', { reason }).then(r => r.data),
  deleteRequest: (id: number) => api.delete('/leave/' + id).then(r => r.data),
  getHistory: (employeeId?: number, year?: number) => api.get<LeaveRequest[]>('/leave/history', { params: { employeeId, year } }).then(r => r.data),
  uploadAttachment: (id: number, file: File, onUploadProgress?: (progressEvent: any) => void) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/leave/' + id + '/attachments', formData, { onUploadProgress }).then(r => r.data);
  },
  addConversationMessage: (id: number, message: string, requestEmployeeDetails = false) =>
    api.post(`/leave/${id}/conversation`, { message, requestEmployeeDetails }).then(r => r.data),
  revisePending: (id: number, data: { leaveTypeId: number; dateFrom: string; dateTo: string; totalHours: number; halfDayTime?: string; balanceDeductionLeaveTypeId?: number; reason: string; days?: LeaveRequestDayDto[] }, files: File[] = []) => {
    const formData = new FormData();
    formData.append('request', JSON.stringify(data));
    files.forEach(file => formData.append('files', file));
    return api.post(`/leave/${id}/revise-pending`, formData).then(r => r.data);
  },
  getHolidays: (year?: number) => api.get<Holiday[]>('/leave/holidays', { params: { year } }).then(r => r.data),
  addHoliday: (data: { date: string; name: string; type: string }) => api.post('/leave/holidays', data).then(r => r.data),
  deleteHoliday: (id: number) => api.delete('/leave/holidays/' + id).then(r => r.data),
  getDashboardStats: () => api.get<DashboardStats>('/leave/dashboard-stats').then(r => r.data),
};

export const CalendarPolicyAPI = {
  getCalendar: (year: number) => api.get('/calendar-policy/calendar', { params: { year } }).then(r => r.data),
  getAdmin: (year: number) => api.get('/calendar-policy/admin', { params: { year } }).then(r => r.data),
  initializePhilippines: (year: number) => api.post(`/calendar-policy/philippines/${year}`).then(r => r.data),
  saveHoliday: (data: Partial<Holiday>) => api.post('/calendar-policy/holidays', data).then(r => r.data),
  saveWorkCalendar: (data: Partial<WorkCalendar>) => api.post('/calendar-policy/work-calendars', data).then(r => r.data),
  saveLeavePolicy: (id: number, data: Partial<LeaveType>) => api.put(`/calendar-policy/leave-policies/${id}`, data).then(r => r.data),
};

export const ApprovalAPI = {
  getPending: () => api.get<PendingApproval[]>('/approval/pending').then(r => r.data),
  getWaitingOnEmployees: () => api.get<PendingApproval[]>('/approval/waiting-on-employees').then(r => r.data),
  getPendingLeaveSummary: (leaveRequestId: number, year?: number) =>
    api.get<PendingApprovalLeaveSummary>(`/approval/${leaveRequestId}/leave-summary`, { params: { year } }).then(r => r.data),
  approve: (leaveRequestId: number, data: { remarks?: string; signatureData?: string; fitnessAssessment?: string; expectedDateTo?: string }) =>
    api.post('/approval/' + leaveRequestId + '/approve', data).then(r => r.data),
  disapprove: (leaveRequestId: number, data: { remarks?: string; reasonForRejection?: string; signatureData?: string }) =>
    api.post('/approval/' + leaveRequestId + '/disapprove', data).then(r => r.data),
  getTeamCalendar: (month?: number, year?: number) =>
    api.get('/approval/team-calendar', { params: { month, year } }).then(r => r.data),
  getAllPending: () => api.get('/approval/all-pending').then(r => r.data),
  extendSickLeave: (id: number, data: { expectedDateTo: string; dateTo: string; reason: string }, files: File[]) => {
    const form = new FormData();
    form.append('request', JSON.stringify(data));
    files.forEach(file => form.append('files', file));
    return api.post(`/leave/${id}/extend-sick-leave`, form).then(r => r.data);
  },
};

export const HRAPI = {
  getEmployeeLeaveSummary: (employeeId: number, year?: number) =>
    api.get<{ employee: HREmployee; balances: LeaveBalance[]; requests: LeaveRequest[] }>(`/hr/employees/${employeeId}/leave-summary`, { params: { year } }).then(r => r.data),
  getReportDesignerOptions: () => api.get<{ employees: { id: number; fullName: string; employeeID: string; department: string }[]; departments: string[]; leaveTypes: string[]; statuses: string[] }>('/hr/reports/designer/options').then(r => r.data),
  designReport: (filters: Record<string, string | number>) => api.get<{ totalRecords: number; totalLeaveDays: number; totalTimeHours: number; pendingRecords: number; isTruncated: boolean; results: { id: number; employee: string; employeeID: string; department: string; leaveType: string; deductedFrom?: string; requestKind: string; dateFiled: string; dateFrom: string; dateTo: string; totalDays: number; totalHours: number; status: string; approvalStatus: string }[] }>('/hr/reports/designer', { params: filters }).then(r => r.data),
  exportDesignedReport: (filters: Record<string, string | number>) => api.get<Blob>('/hr/reports/designer.csv', { params: filters, responseType: 'blob' }),
  notifyApprover: (leaveRequestId: number) => api.post(`/hr/pending/${leaveRequestId}/notify-approver`).then(r => r.data),
  getLeaveLedger: (department?: string, year?: number) =>
    api.get('/hr/leave-requests', { params: { department, year } }).then(r => r.data),
  getFinalizationPending: () => api.get('/hr/finalization-pending').then(r => r.data),
  getLeaveTransactions: (department?: string, year?: number) =>
    api.get('/hr/leave-transactions', { params: { department, year } }).then(r => r.data),
  getEmployeeLeaveLedger: (employeeId: number, year?: number) =>
    api.get('/hr/leave-ledger/' + employeeId, { params: { year } }).then(r => r.data),
  getLeaveSummary: (year?: number, month?: number) =>
    api.get('/hr/reports/summary', { params: { year, month } }).then(r => r.data),
  getEmployeeBalances: (year?: number) => api.get('/hr/employee-balances', { params: { year } }).then(r => r.data),
  updateBalance: (employeeId: number, data: { leaveTypeId: number; totalCredits?: number; carryOver?: number; hrRemarks?: string }) =>
    api.put('/hr/balance/' + employeeId, data).then(r => r.data),
  finalize: (leaveRequestId: number, data: { notedByHR?: string; hrRemarks?: string }) =>
    api.post('/hr/finalize/' + leaveRequestId, data).then(r => r.data),
  getMonthlySummary: (month?: number, year?: number) =>
    api.get('/hr/reports/summary', { params: { month, year } }).then(r => r.data),
  getAnnualReport: (year?: number, dateFrom?: string, dateTo?: string) => api.get('/hr/reports/annual', { params: { year, dateFrom, dateTo } }).then(r => r.data),
  exportLeaveReport: (year?: number, dateFrom?: string, dateTo?: string) =>
    api.get<Blob>('/hr/reports/export.csv', { params: { year, dateFrom, dateTo }, responseType: 'blob' }),
  getDepartments: () => api.get<string[]>('/hr/reports/departments').then(r => r.data),
  getEmployees: () => api.get<HREmployee[]>('/hr/employees').then(r => r.data),
  updateEmployeeOrg: (id: number, data: { orgRole?: string; supervisorId?: number; managerId?: number; section?: string; employmentStatus?: string }) =>
    api.put('/hr/employees/' + id + '/org', data).then(r => r.data),
};

export const CategoryAPI = {
  getAll: (includeInactive = false) => api.get<ApprovalCategoryNode[]>('/category', { params: { includeInactive } }).then(r => r.data),
  getById: (id: number) => api.get<ApprovalCategoryNode>('/category/' + id).then(r => r.data),
  create: (data: { name: string; description?: string; secondApproverId?: number | null; isActive?: boolean }) =>
    api.post<ApprovalCategoryNode>('/category', data).then(r => r.data),
  update: (id: number, data: { name: string; description?: string; secondApproverId?: number | null; isActive?: boolean }) =>
    api.put<ApprovalCategoryNode>('/category/' + id, data).then(r => r.data),
  delete: (id: number, force = false) => api.delete('/category/' + id, { params: { force } }).then(r => r.data),
  setApprover: (id: number, data: { secondApproverId?: number | null }) =>
    api.post('/category/' + id + '/set-approver', data).then(r => r.data),
  assignDepartments: (id: number, data: { departmentIds: number[] }) =>
    api.post('/category/' + id + '/assign-departments', data).then(r => r.data),
};

export const DepartmentAPI = {
  getAll: (includeInactive = false, categoryId?: number) =>
    api.get<DepartmentNode[]>('/department', { params: { includeInactive, categoryId } }).then(r => r.data),
  getHierarchy: (includeInactive = false) =>
    api.get<ApprovalCategoryNode[]>('/department/hierarchy', { params: { includeInactive } }).then(r => r.data),
  getTree: () => api.get<ApprovalCategoryNode[]>('/department/tree').then(r => r.data),
  getById: (id: number) => api.get<DepartmentNode>('/department/' + id).then(r => r.data),
  create: (data: { name: string; description?: string; categoryId?: number | null; firstApproverId?: number | null; firstApproverIds?: number[]; notedByApproverIds?: number[]; backupApprovers?: DepartmentBackupApprovers; requiresOperatorLineLeader?: boolean; sickLeaveLineLeaderId?: number | null; operatorLineLeaderAssignments?: Record<number, number | null>; secondApproverOverrideId?: number | null; isActive?: boolean }) =>
    api.post<DepartmentNode>('/department', data).then(r => r.data),
  update: (id: number, data: { name: string; description?: string; categoryId?: number | null; firstApproverId?: number | null; firstApproverIds?: number[]; notedByApproverIds?: number[]; backupApprovers?: DepartmentBackupApprovers; requiresOperatorLineLeader?: boolean; sickLeaveLineLeaderId?: number | null; operatorLineLeaderAssignments?: Record<number, number | null>; secondApproverOverrideId?: number | null; isActive?: boolean }) =>
    api.put<DepartmentNode>('/department/' + id, data).then(r => r.data),
  delete: (id: number) => api.delete('/department/' + id).then(r => r.data),
  assignCategory: (id: number, data: { categoryId?: number | null }) =>
    api.post('/department/' + id + '/assign-category', data).then(r => r.data),
  setFirstApprover: (id: number, data: { firstApproverId?: number | null; firstApproverIds?: number[] }) =>
    api.post('/department/' + id + '/set-approver', data).then(r => r.data),
  assignEmployeesBatch: (id: number, data: { selectedEmployeeIds: number[] }) =>
    api.post('/department/' + id + '/employees', data).then(r => r.data),
  unassignEmployee: (id: number, employeeId: number) =>
    api.post('/department/' + id + '/unassign-employee', { employeeId }).then(r => r.data),
  previewRoute: (employeeId: number, leaveTypeCode?: string, selectedLineLeaderId?: number) =>
    api.get<RouteValidationPreview>('/department/route-preview/' + employeeId, { params: { leaveTypeCode, selectedLineLeaderId } }).then(r => r.data),
  reorderHierarchy: (data: { categoryIds: number[]; groups: { categoryId: number | null; departmentIds: number[] }[] }) =>
    api.post('/department/reorder', data).then(r => r.data),
};

export const DelegationAPI = {
  getAll: (params?: { delegatorId?: number; delegateId?: number; isActive?: boolean }) =>
    api.get<DelegationRecord[]>('/delegation', { params }).then(r => r.data),
  getMyDelegations: () => api.get<DelegationRecord[]>('/delegation/my-delegations').then(r => r.data),
  create: (data: { delegatorId?: number; delegateId: number; startDate: string; endDate: string; reason: string }) =>
    api.post('/delegation', data).then(r => r.data),
  revoke: (id: number, reason?: string) =>
    api.put('/delegation/' + id + '/revoke', { reason }).then(r => r.data),
};

export const ApprovalRouteAPI = {
  getByEmployee: async (employeeId: number) => (await api.get('/approvalroute/employee/' + employeeId)).data,
  create: async (data: any) => (await api.post('/approvalroute', data)).data,
  delete: async (id: number) => (await api.delete('/approvalroute/' + id)).data,
  deleteAllForEmployee: async (employeeId: number) => (await api.delete('/approvalroute/employee/' + employeeId)).data,
};

export const SystemAdminAPI = {
  getEmployeeDirectory: () => api.get<HREmployee[]>('/systemadmin/employee-directory').then(response => response.data),
  getUsers: () => api.get('/auth/users').then(r => r.data),
  createUser: (data: { username: string; password: string; role: 'SystemAdmin' | 'Admin' | 'Editor' }) =>
    api.post('/systemadmin/users', data).then(r => r.data),
  updateUserRole: (id: number, data: { role: string }) =>
    api.put('/systemadmin/users/' + id + '/role', data).then(r => r.data),
  changeUserPassword: (id: number, data: { newPassword: string }) =>
    api.put('/systemadmin/users/' + id + '/password', data).then(r => r.data),
  updateEmployeeRole: (id: number, data: { orgRole: string }) =>
    api.put('/systemadmin/employees/' + id + '/orgrole', data).then(r => r.data),
};

export interface SystemRepairOverview {
  status: 'Healthy' | 'Warning';
  applicationVersion: string;
  environment: string;
  collectedAt: string;
  diagnostics: {
    databaseIntegrity: string;
    foreignKeyViolations: number;
    missingAnnualBalances: number;
    staleDeliveries: number;
    retryableFailedDeliveries: number;
    unassignedEmployees: number;
    stalePendingRequests: number;
    balanceYear: number;
  };
  recentRepairs: Array<{ id: number; action: string; details: string; username: string; timestamp: string }>;
}

export const SystemRepairAPI = {
  overview: () => api.get<SystemRepairOverview>('/system-repair/overview').then(response => response.data),
  initializeMissingBalances: () => api.post<{ affectedEmployees: number; createdBalances: number; year: number }>('/system-repair/initialize-missing-balances').then(response => response.data),
  retryFailedNotifications: () => api.post<{ queuedDeliveries: number }>('/system-repair/retry-failed-notifications').then(response => response.data),
};

export default api;
