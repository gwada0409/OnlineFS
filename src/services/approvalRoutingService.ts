import api from '../lib/api';
import type { HREmployee } from '../lib/api';
import type { ApprovalRouteTemplate, AutomaticRouteRule, EmployeeRouteAssignment, BulkRouteOperationRecord, AuditLogEntry, RoutePreviewResult, RoutePreviewStep, ApprovalStepType, RouteSourceType, CoverageDashboardStats } from '../types/approvalRouting';

let templates: ApprovalRouteTemplate[] = [];
let rules: AutomaticRouteRule[] = [];
let assignments: Record<number, EmployeeRouteAssignment> = {};
let auditLogs: AuditLogEntry[] = [];

const normalizeRule = (v: any): AutomaticRouteRule => ({ ...v, assignedTemplateName: v.assignedTemplate?.name, conditions: { department: v.department?.name, section: v.section, orgRole: v.orgRole, employmentStatus: v.employmentStatus } });
const normalizeAssignment = (v: any): EmployeeRouteAssignment => ({ employeeId: v.employeeId, employeeName: v.employee?.fullName ?? '', employeeID: v.employee?.employeeID ?? '', assignedTemplateId: v.templateId ?? undefined, assignedTemplateName: v.template?.name, hasPersonalOverride: v.hasPersonalOverride, updatedAt: v.updatedAt });
const templateInput = (v: Partial<ApprovalRouteTemplate>) => ({
  name: v.name, description: v.description ?? '', isActive: v.isActive ?? true,
  effectiveStartDate: v.effectiveStartDate ?? null, effectiveEndDate: v.effectiveEndDate ?? null,
  steps: (v.steps ?? []).map((s, index) => ({ sequenceNumber: index + 1, stepType: s.stepType, displayLabel: s.displayLabel, specificEmployeeId: s.specificEmployeeId ?? null, orgRole: s.orgRole ?? null, isRequired: s.isRequired, allowApprove: s.allowApprove, allowReject: s.allowReject }))
});

export const ApprovalRoutingService = {
  async refresh(): Promise<void> {
    const [t, r, a, logs] = await Promise.all([
      api.get<ApprovalRouteTemplate[]>('/routing-management/templates'), api.get<any[]>('/routing-management/rules'),
      api.get<any[]>('/routing-management/assignments'), api.get<{ items: any[] }>('/routing-management/audit?page=1&pageSize=100')
    ]);
    templates = t.data;
    rules = r.data.map(normalizeRule);
    assignments = Object.fromEntries(a.data.map(item => [item.employeeId, normalizeAssignment(item)]));
    auditLogs = logs.data.items.map(item => ({ ...item, actorName: item.actor, entityType: item.entityType as AuditLogEntry['entityType'] }));
  },
  getTemplates: () => templates,
  getTemplateById: (id: number) => templates.find(item => item.id === id),
  async saveTemplate(value: Partial<ApprovalRouteTemplate>): Promise<ApprovalRouteTemplate> {
    const response = value.id ? await api.put<ApprovalRouteTemplate>(`/routing-management/templates/${value.id}`, templateInput(value)) : await api.post<ApprovalRouteTemplate>('/routing-management/templates', templateInput(value));
    await this.refresh(); return response.data;
  },
  async cloneTemplate(id: number): Promise<ApprovalRouteTemplate> {
    const source = templates.find(item => item.id === id); if (!source) throw new Error('The route template no longer exists.');
    return this.saveTemplate({ ...source, id: undefined, name: `${source.name} (Copy)`, steps: source.steps.map(step => ({ ...step, id: 0 })) });
  },
  async toggleTemplateStatus(id: number): Promise<ApprovalRouteTemplate> {
    const source = templates.find(item => item.id === id); if (!source) throw new Error('The route template no longer exists.');
    return this.saveTemplate({ ...source, isActive: !source.isActive });
  },
  getRules: () => rules,
  async saveRule(value: Partial<AutomaticRouteRule>): Promise<AutomaticRouteRule> {
    const payload = { name: value.name, priority: value.priority, isActive: value.isActive, assignedTemplateId: value.assignedTemplateId, departmentId: null, departmentName: value.conditions?.department ?? null, categoryId: null, section: value.conditions?.section ?? null, orgRole: value.conditions?.orgRole ?? null, employmentStatus: value.conditions?.employmentStatus ?? null };
    const response = value.id ? await api.put(`/routing-management/rules/${value.id}`, payload) : await api.post('/routing-management/rules', payload);
    await this.refresh(); return normalizeRule(response.data);
  },
  async deleteRule(id: number): Promise<void> { await api.delete(`/routing-management/rules/${id}`); await this.refresh(); },
  getAssignments: () => assignments,
  async executeBulkAssignment(employeeIds: number[], _employees: HREmployee[], operationType: 'AssignTemplate' | 'RemoveTemplate' | 'ResetToDefault', templateId?: number): Promise<BulkRouteOperationRecord> {
    const selected = templates.find(item => item.id === templateId);
    const response = await api.put<{ affectedCount: number }>('/routing-management/assignments/bulk', { employeeIds, templateId: operationType === 'AssignTemplate' ? templateId : null, hasPersonalOverride: false });
    await this.refresh();
    return { id: `server-${Date.now()}`, operationType, templateId, templateName: selected?.name, affectedCount: response.data.affectedCount, affectedEmployeeIds: employeeIds, skippedEmployeeIds: [], validationFailures: [], createdBy: 'Server', createdDate: new Date().toISOString(), previousAssignments: {} };
  },
  getBulkOperations: (): BulkRouteOperationRecord[] => [],
  resolveRoute(employee: HREmployee, allEmployees: HREmployee[] = [], hasPersonalCustomRoute = false): RoutePreviewResult {
    let routeSource: RouteSourceType = 'DefaultRoute'; let selected: ApprovalRouteTemplate | undefined; let matched: AutomaticRouteRule | undefined;
    const assignment = assignments[employee.id];
    if (hasPersonalCustomRoute || assignment?.hasPersonalOverride) routeSource = 'PersonalOverride';
    else if (assignment?.assignedTemplateId && (selected = templates.find(t => t.id === assignment.assignedTemplateId && t.isActive))) routeSource = 'AssignedTemplate';
    if (routeSource === 'DefaultRoute') {
      matched = rules.find(r => r.isActive && (!r.conditions.department || r.conditions.department === employee.department) && (!r.conditions.section || r.conditions.section === employee.section) && (!r.conditions.orgRole || r.conditions.orgRole === employee.orgRole) && (!r.conditions.employmentStatus || r.conditions.employmentStatus === employee.employmentStatus));
      selected = templates.find(t => t.id === matched?.assignedTemplateId && t.isActive); if (selected) routeSource = 'AutomaticRule';
    }
    const warnings: string[] = [];
    const steps: RoutePreviewStep[] = (selected?.steps ?? []).map(step => {
      let approver = step.specificEmployeeId ? allEmployees.find(e => e.id === step.specificEmployeeId) : undefined;
      if (!approver && step.stepType === 'ImmediateSupervisor') approver = allEmployees.find(e => e.id === employee.supervisorId);
      if (!approver && step.stepType === 'DepartmentManager') approver = allEmployees.find(e => e.id === employee.managerId);
      if (!approver && step.stepType !== 'SpecificEmployee') approver = allEmployees.find(e => e.orgRole === step.stepType);
      const missing = !approver, self = approver?.id === employee.id;
      if (missing) warnings.push(`No approver could be resolved for ${step.displayLabel}.`); if (self) warnings.push(`Self-approval risk at ${step.displayLabel}.`);
      return { sequenceNumber: step.sequenceNumber, stepType: step.stepType as ApprovalStepType, displayLabel: step.displayLabel, resolvedApproverId: approver?.id, resolvedApproverName: approver?.fullName ?? 'Unassigned Approver', resolvedApproverRole: approver?.orgRole ?? approver?.position ?? 'N/A', isMissingApprover: missing, isSelfApprovalRisk: self, isDuplicate: false, isInactive: false };
    });
    if (!selected) warnings.push('No persisted route template applies to this employee.');
    return { employeeId: employee.id, employeeName: employee.fullName, employeeID: employee.employeeID, routeSource, matchedRuleId: matched?.id, matchedRuleName: matched?.name, templateId: selected?.id, templateName: selected?.name, steps, hasWarnings: warnings.length > 0, warnings };
  },
  getCoverageStats(allEmployees: HREmployee[] = []): CoverageDashboardStats {
    const r = allEmployees.map(e => this.resolveRoute(e, allEmployees));
    return { personalOverrideCount: r.filter(x => x.routeSource === 'PersonalOverride').length, assignedTemplateCount: r.filter(x => x.routeSource === 'AssignedTemplate').length, automaticRuleCount: r.filter(x => x.routeSource === 'AutomaticRule').length, defaultRouteCount: r.filter(x => x.routeSource === 'DefaultRoute').length, misconfiguredCount: r.filter(x => x.hasWarnings).length, missingSupervisorCount: r.filter(x => x.steps.some(s => s.stepType === 'ImmediateSupervisor' && s.isMissingApprover)).length, missingManagerCount: r.filter(x => x.steps.some(s => s.stepType === 'DepartmentManager' && s.isMissingApprover)).length, inactiveApproverCount: r.filter(x => x.steps.some(s => s.isInactive)).length, totalEmployees: allEmployees.length };
  },
  getAuditLogs: () => auditLogs
};
