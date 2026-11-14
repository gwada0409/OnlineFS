export type ApprovalStepType =
  | 'ImmediateSupervisor'
  | 'DepartmentManager'
  | 'SectionManager'
  | 'HRStaff'
  | 'HRManager'
  | 'GeneralManager'
  | 'SpecificEmployee'
  | 'OrganizationalRole'
  | 'DepartmentRole';

export type RouteSourceType =
  | 'PersonalOverride'
  | 'AssignedTemplate'
  | 'AutomaticRule'
  | 'DefaultRoute';

export interface ApprovalRouteTemplateStep {
  id: number;
  sequenceNumber: number;
  stepType: ApprovalStepType;
  displayLabel: string;
  isRequired: boolean;
  allowApprove: boolean;
  allowReject: boolean;
  specificEmployeeId?: number;
  specificEmployeeName?: string;
  departmentConstraint?: string;
  orgRole?: string;
}

export interface ApprovalRouteTemplate {
  id: number;
  name: string;
  description: string;
  isActive: boolean;
  version: number;
  createdBy: string;
  createdDate: string;
  updatedBy: string;
  updatedDate: string;
  effectiveStartDate?: string;
  effectiveEndDate?: string;
  steps: ApprovalRouteTemplateStep[];
}

export interface AutomaticRouteRuleCondition {
  department?: string;
  section?: string;
  orgRole?: string;
  employmentStatus?: string;
}

export interface AutomaticRouteRule {
  id: number;
  name: string;
  priority: number;
  isActive: boolean;
  assignedTemplateId: number;
  assignedTemplateName?: string;
  conditions: AutomaticRouteRuleCondition;
  effectiveStartDate?: string;
  effectiveEndDate?: string;
  createdBy: string;
  createdDate: string;
  updatedBy: string;
  updatedDate: string;
}

export interface EmployeeRouteAssignment {
  employeeId: number;
  employeeName: string;
  employeeID: string;
  assignedTemplateId?: number;
  assignedTemplateName?: string;
  hasPersonalOverride: boolean;
  updatedAt: string;
}

export type DelegationScopeType = 'All' | 'Department' | 'Section' | 'StepType';
export type DelegationStatus = 'Scheduled' | 'Active' | 'Expired' | 'Revoked';

export interface ApproverDelegation {
  id: number;
  primaryApproverId: number;
  primaryApproverName: string;
  backupApproverId: number;
  backupApproverName: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: DelegationStatus;
  scopeType: DelegationScopeType;
  departmentScope?: string;
  sectionScope?: string;
  stepTypeScope?: ApprovalStepType;
  transferExisting: boolean;
  createdBy: string;
  createdDate: string;
  activatedBy?: string;
  activatedDate?: string;
  revokedBy?: string;
  revokedDate?: string;
  revocationReason?: string;
}

export interface BulkRouteOperationRecord {
  id: string;
  operationType: 'AssignTemplate' | 'RemoveTemplate' | 'ResetToDefault';
  templateId?: number;
  templateName?: string;
  affectedCount: number;
  affectedEmployeeIds: number[];
  skippedEmployeeIds: number[];
  validationFailures: string[];
  createdBy: string;
  createdDate: string;
  previousAssignments: Record<number, { assignedTemplateId?: number; hasPersonalOverride: boolean }>;
  isUndone?: boolean;
}

export interface AuditLogEntry {
  id: number;
  actorId?: number;
  actorName: string;
  action: string;
  entityType: 'Template' | 'Rule' | 'Assignment' | 'BulkOperation' | 'Delegation' | 'ApprovalAction';
  entityId: string | number;
  details: string;
  previousState?: any;
  newState?: any;
  timestamp: string;
  reason?: string;
  delegationId?: number;
}

export interface RoutePreviewStep {
  sequenceNumber: number;
  stepType: ApprovalStepType;
  displayLabel: string;
  resolvedApproverId?: number;
  resolvedApproverName?: string;
  resolvedApproverRole?: string;
  isMissingApprover: boolean;
  isSelfApprovalRisk: boolean;
  isDuplicate: boolean;
  isInactive: boolean;
  warning?: string;
}

export interface RoutePreviewResult {
  employeeId: number;
  employeeName: string;
  employeeID: string;
  routeSource: RouteSourceType;
  matchedRuleId?: number;
  matchedRuleName?: string;
  templateId?: number;
  templateName?: string;
  steps: RoutePreviewStep[];
  hasWarnings: boolean;
  warnings: string[];
}

export interface CoverageDashboardStats {
  personalOverrideCount: number;
  assignedTemplateCount: number;
  automaticRuleCount: number;
  defaultRouteCount: number;
  misconfiguredCount: number;
  missingSupervisorCount: number;
  missingManagerCount: number;
  inactiveApproverCount: number;
  totalEmployees: number;
}
