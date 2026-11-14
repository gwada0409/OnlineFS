export type NotificationType =
  | 'LeaveSubmitted'
  | 'ApprovalRequired'
  | 'ApprovalMovedForward'
  | 'ApprovalStageCompleted'
  | 'LeaveUpdated'
  | 'LeaveApproved'
  | 'LeaveRejected'
  | 'LeaveReturned'
  | 'LeaveConversation'
  | 'DelegationActivated'
  | 'DelegationEndingSoon'
  | 'DelegationExpired'
  | 'DelegationRevoked'
  | 'ApprovalDelegated'
  | 'ApprovalReclaimed'
  | 'AttachmentRequired'
  | 'OperationFailed'
  | 'ConfigurationChanged'
  | 'PrivilegedAccountChanged'
  | 'SystemNotice';

export type NotificationSeverity = 'Info' | 'Success' | 'Warning' | 'Critical';

export interface NotificationItem {
  id: number;
  recipientEmployeeId?: number | null;
  type: NotificationType;
  title: string;
  message: string;
  entityType: 'LeaveRequest' | 'ApprovalStep' | 'Delegation' | 'System';
  entityId: string | number;
  leaveRequestId?: number;
  approvalStepId?: number;
  delegationId?: number;
  actionUrl: string;
  severity: NotificationSeverity;
  category?: string;
  workspace?: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
  expiresAt?: string;
  deduplicationKey: string;
  metadataJson?: Record<string, any>;
}

export interface NotificationPreference {
  recipientEmployeeId?: number | null;
  inAppEnabled: boolean; // Always true (mandatory)
  emailEnabled: boolean;
  browserPushEnabled: boolean;
  approvalRequiredEnabled: boolean;
  requestProgressEnabled: boolean;
  finalDecisionEnabled: boolean; // Always true (mandatory)
  delegationEnabled: boolean;
  dailyDigestEnabled: boolean;
}

export interface NotificationDeliveryRecord {
  id: number;
  notificationId: number;
  channel: 'InApp' | 'SignalR' | 'Email' | 'BrowserPush';
  status: 'Pending' | 'Delivered' | 'Failed' | 'Skipped';
  attemptCount: number;
  lastAttemptAt: string;
  deliveredAt?: string;
  failedAt?: string;
  errorMessage?: string;
}

export type ApplicationEventType =
  | 'LeaveRequestSubmitted'
  | 'ApprovalStepActivated'
  | 'ApprovalStepApproved'
  | 'ApprovalStepRejected'
  | 'LeaveRequestApproved'
  | 'LeaveRequestRejected'
  | 'LeaveRequestReturned'
  | 'DelegationActivated'
  | 'DelegationRevoked'
  | 'DelegationExpired'
  | 'ApprovalReassignedToBackup'
  | 'ApprovalReclaimedByPrimary';

export interface ApplicationEventPayload {
  eventType: ApplicationEventType;
  employeeId: number;
  employeeName: string;
  leaveRequestId?: number;
  leaveTypeCode?: string;
  dateFrom?: string;
  dateTo?: string;
  totalDaysOrHours?: string;
  approvalStepId?: number;
  stepLabel?: string;
  approverId?: number;
  approverName?: string;
  actingApproverName?: string;
  delegationId?: number;
  rejectionReason?: string;
  returnReason?: string;
  startDate?: string;
  endDate?: string;
  scope?: string;
  timestamp: string;
}
