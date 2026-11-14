# OnlineFS Approval Routing System Architecture & Design Specification

The current HR-first Sick Leave rule, grouped stage decisions, optional Noted by stage, and preserved request snapshots are documented in [Sick Leave review and grouped signatories](SICK_LEAVE_APPROVALS.md). That guide supersedes the original sequential-routing and reconciliation behavior described below.

## Overview
This document specifies the architecture, data models, API contracts, resolution priority, delegation mechanics, and migration plan for the OnlineFS Approval Routing System.

---

## 1. Existing Approval Flow Analysis

### 1.1 Submission & Step Generation
- An employee submits a leave application (`LeaveAPI.apply`).
- The backend evaluates the approval chain and attaches `approvalSteps` to the request.
- Default approval chain fallback: `Employee -> Immediate Supervisor -> Department Manager -> HR`.

### 1.2 Approver Resolution & Storage
- Approvers are currently resolved at submission time or configured per employee via `ApprovalRouteAPI`.
- Generated steps store `stepOrder`, `stepLabel`, `approverName`, `approverPosition`, `action`, `actionDate`, and `remarks`.

### 1.3 Action & Finalization
- Active step approvers query pending items via `ApprovalAPI.getPending`.
- Approver calls `ApprovalAPI.approve` or `ApprovalAPI.disapprove`.
- When all steps are approved, HR performs final processing (`HRAPI.finalize`).

---

## 2. Proposed Architecture & Dynamic Approver System

```
                      ┌────────────────────────────────────────┐
                      │        Leave Application Filed         │
                      └──────────────────┬─────────────────────┘
                                         │
                                         ▼
                      ┌────────────────────────────────────────┐
                      │         ApprovalRouteResolver          │
                      └──────────────────┬─────────────────────┘
                                         │
       ┌─────────────────┬───────────────┴───────────────┬─────────────────┐
       │ 1. Personal     │ 2. Explicit                   │ 3. Automatic    │ 4. Default
       │    Override     │    Template                   │    Rule         │    Fallback
       ▼                 ▼                               ▼                 ▼
 ┌───────────┐     ┌───────────┐                   ┌───────────┐     ┌───────────┐
 │ Employee  │     │ Assigned  │                   │ Priority  │     │ Supervisor│
 │ Custom    │     │ Template  │                   │ Rule      │     │ -> Manager│
 │ Route     │     │           │                   │ Match     │     │ -> HR     │
 └─────┬─────┘     └─────┬─────┘                   └─────┬─────┘     └─────┬─────┘
       │                 │                               │                 │
       └─────────────────┴───────────────┬───────────────┴─────────────────┘
                                         │
                                         ▼
                      ┌────────────────────────────────────────┐
                      │   Dynamic Placeholder Resolution       │
                      │   (Supervisor, Manager, Roles)         │
                      └──────────────────┬─────────────────────┘
                                         │
                                         ▼
                      ┌────────────────────────────────────────┐
                      │   Delegation Layer Check               │
                      │   (Active Backup Approver Lookup)      │
                      └──────────────────┬─────────────────────┘
                                         │
                                         ▼
                      ┌────────────────────────────────────────┐
                      │   Immutable Request Step Snapshot      │
                      └────────────────────────────────────────┘
```

---

## 3. Approval Step Types (Enum / Strongly Typed)

We introduce strongly typed step types to replace string matching:

- `ImmediateSupervisor`
- `DepartmentManager`
- `SectionManager`
- `HRStaff`
- `HRManager`
- `GeneralManager`
- `SpecificEmployee`
- `OrganizationalRole`
- `DepartmentRole`

---

## 4. Route Resolution Priority

The `ApprovalRouteResolver` evaluates routes in strict order:

1. **Personal Override**: Individual custom approval route assigned to the specific employee.
2. **Assigned Template**: Explicit template explicitly mapped to the employee.
3. **Automatic Rule**: Highest-priority active rule matching employee attributes (Department, Section, OrgRole, EmploymentStatus).
4. **Default Fallback**: System standard hierarchy (`Supervisor -> Department Manager -> HR`).

---

## 5. Entities & Data Models

### 5.1 ApprovalRouteTemplate & Steps
- `id`: number
- `name`: string
- `description`: string
- `isActive`: boolean
- `version`: number
- `createdBy`, `createdDate`, `updatedBy`, `updatedDate`
- `effectiveStartDate`, `effectiveEndDate`
- `steps`: ApprovalRouteTemplateStep[]

### 5.2 Dynamic Template Step Definition
- `sequenceNumber`: number
- `stepType`: ApprovalStepType
- `displayLabel`: string
- `isRequired`: boolean
- `allowApprove`: boolean
- `allowReject`: boolean
- `specificEmployeeId`?: number
- `departmentConstraint`?: string

### 5.3 Automatic Assignment Rules
- `id`: number
- `name`: string
- `priority`: number (higher = first)
- `isActive`: boolean
- `assignedTemplateId`: number
- `conditions`: { department?, section?, orgRole?, employmentStatus? }

### 5.4 Temporary Approver Delegation
- `id`: number
- `primaryApproverId`: number
- `backupApproverId`: number
- `startDate`: string
- `endDate`: string
- `reason`: string
- `status`: `'Scheduled' | 'Active' | 'Expired' | 'Revoked'`
- `scopeType`: `'All' | 'Department' | 'Section' | 'StepType'`
- `transferExisting`: boolean

### 5.5 Audit Logs
- `id`: number
- `actorId`: number
- `actorName`: string
- `action`: string
- `entityType`: string
- `entityId`: string | number
- `previousState`?: any
- `newState`?: any
- `timestamp`: string
- `reason`?: string

---

## 6. Temporary Backup Approver Delegation Mechanics

- **One-Level Delegation Limit**: A backup cannot re-delegate delegated authority.
- **Safety Checks**:
  - Primary != Backup
  - Requester != Approver (Self-approval blocked)
  - Circular delegation (Alex -> Maria, Maria -> Alex) prevented
  - Overlapping active delegations for same scope prevented
- **Acting-For Snapshot & Display**:
  - When acting on behalf of another approver, display badge: `Acting for [Primary Name] — [Step Label]`
  - Store `actingApproverId`, `delegationId`, and `originalApproverId`.

---

## 7. Migration & Backward Compatibility Strategy

- Existing custom routes per employee are classified as **Personal Override** routes and preserved intact.
- Existing submitted pending requests retain their generated approval snapshot without alteration.
- New requests utilize the centralized `ApprovalRouteResolver`.

---

## 8. Security & RBAC Policies

- **System Admin**: Full CRUD on templates, rules, assignments, delegations, audit logs, and bulk undo.
- **HR Manager / HR Staff**: Manage templates, perform bulk route assignments, create/activate/revoke delegations, view audit logs.
- **Supervisor / Manager**: View own delegation status, request delegation.
- **Employee**: Read-only view of own leave request approval progress.

---

## 9. Centralized Event-Driven Notification System

### 9.1 Application Events
The system emits decoupled domain events to notify recipients:
- `LeaveRequestSubmitted`: Fired on leave submission; notifies employee & first actionable approver (or backup if delegated).
- `ApprovalStepActivated`: Fired when a step becomes active; notifies actionable approver.
- `ApprovalStepApproved`: Fired on step approval; notifies employee and advances progress.
- `ApprovalStepRejected`: Fired on step rejection; notifies employee with rejection reason.
- `LeaveRequestApproved`: Fired on final step approval; sends complete leave details to employee.
- `LeaveRequestRejected`: Fired on rejection; stops workflow and notifies employee.
- `LeaveRequestReturned`: Fired when returned for correction.
- `DelegationActivated`: Fired on delegation start; notifies primary & backup approvers.
- `DelegationRevoked`: Fired on delegation revocation; notifies primary & backup.
- `DelegationExpired`: Fired when delegation expires; restores primary approver responsibilities.

### 9.2 Delegation-Aware Recipient Resolution
- Active steps evaluate delegation status: if the primary approver has an active delegation, the actionable notification is delivered **only to the backup approver**.
- The backup receives a notification titled `Delegated leave request requires your action` with badge `Acting for [Primary Name]`.
- The primary approver receives an informational notice `Approval assigned to your backup`.

### 9.3 Notification Data Model & Deduplication
- **Notification**: `id`, `recipientEmployeeId`, `type`, `title`, `message`, `entityType`, `entityId`, `leaveRequestId`, `approvalStepId`, `delegationId`, `actionUrl`, `severity`, `isRead`, `readAt`, `createdAt`, `deduplicationKey`, `metadataJson`.
- **DeduplicationKey**: Unique deterministic keys (e.g. `leave:{id}:step:{stepId}:activated:{recipientId}`) preventing duplicate notifications upon event retries.
