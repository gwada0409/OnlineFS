import { useId, type MouseEvent, type ReactNode } from 'react';
import { Eye } from 'lucide-react';
import type { PendingApproval } from '../lib/api';
import { approvalStageLabel } from '../lib/approvalLabels';
import './ApprovalRequestCard.css';

interface ApprovalRequestCardProps {
  request: PendingApproval;
  onOpen: () => void;
  waiting?: boolean;
  actions?: ReactNode;
  secondaryActions?: ReactNode;
}

export function ApprovalRequestCard({ request, onOpen, waiting = false, actions, secondaryActions }: ApprovalRequestCardProps) {
  const titleId = useId();
  const date = (value: string) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const openCard = (event: MouseEvent<HTMLElement>) => {
    if (!(event.target instanceof Element) || event.target.closest('button, a, input, select, textarea, details, [role="button"]')) return;
    onOpen();
  };
  const kind = request.requestKind && request.requestKind !== 'Leave' ? request.requestKind : request.leaveTypeCode;

  return <article className="approval-request-card" data-waiting={waiting} aria-labelledby={titleId} onClick={openCard}>
    <div className="approval-card-heading">
      <h3 id={titleId}><button type="button" className="approval-card-title" onClick={onOpen} aria-label={`Open request for ${request.employeeName}`}>{request.employeeName}</button></h3>
      <span className="badge badge-info approval-card-type" title={request.leaveTypeDescription}>{kind}</span>
    </div>
    <div className="approval-card-stage">
      <span className="badge badge-pending">{approvalStageLabel(request.stepLabel, request.stepOrder ? request.stepOrder - 1 : undefined)}</span>
      {waiting && <span className="text-sm text-muted">Waiting for employee</span>}
      {request.isDelegatedApproval && <span className="text-sm text-info">Acting for {request.originalApproverName}</span>}
    </div>
    <button type="button" className="btn btn-outline approval-card-primary" onClick={onOpen}><Eye size={17} aria-hidden="true" />{waiting ? 'View request' : 'Review request'}</button>
    {actions && !waiting && <div className="approval-card-decisions">{actions}</div>}
    <dl className="approval-card-metadata">
      <div><dt>Dates</dt><dd>{date(request.dateFrom)}{request.dateFrom.slice(0, 10) !== request.dateTo.slice(0, 10) && <> – {date(request.dateTo)}</>}</dd></div>
      <div><dt>Duration</dt><dd>{request.totalHours > 0 ? `${request.totalHours} hours` : `${request.totalDays} ${request.totalDays === 1 ? 'day' : 'days'}`}{request.balanceDeductionLeaveTypeCode && <span className="block text-sm text-muted">Deduct from {request.balanceDeductionLeaveTypeCode}</span>}{request.leaveTypeCode.toUpperCase() === 'UT' && <span className="block text-sm text-warning">Unpaid UT</span>}</dd></div>
      <div className="approval-card-wide"><dt>Department · Employee ID</dt><dd>{request.department} · {request.employeeID}</dd></div>
    </dl>
    {secondaryActions && <details className="approval-card-secondary"><summary>More actions</summary><div>{secondaryActions}</div></details>}
  </article>;
}
