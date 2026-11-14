import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApprovalRequestCard } from './ApprovalRequestCard';
import type { PendingApproval } from '../lib/api';

const request: PendingApproval = {
  approvalStepId: 5, leaveRequestId: 42, employeeName: 'Alex Morgan', employeeID: 'PREVIEW-42',
  department: 'Operations', leaveTypeCode: 'SL', leaveTypeDescription: 'Sick Leave',
  dateFrom: '2026-11-06', dateTo: '2026-11-06', dateFiled: '2026-10-16',
  totalDays: 1, totalHours: 0, stepLabel: 'Manager', reason: 'Medical appointment',
};

describe('approval request card interactions', () => {
  it('opens the request when its metadata is tapped', () => {
    const onOpen = vi.fn();
    render(<ApprovalRequestCard request={request} onOpen={onOpen} />);
    fireEvent.click(screen.getByText('Operations · PREVIEW-42'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('offers labeled, keyboard-accessible title and review buttons', () => {
    const onOpen = vi.fn();
    render(<ApprovalRequestCard request={request} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open request for Alex Morgan' }));
    fireEvent.click(screen.getByRole('button', { name: 'Review request' }));
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it('does not navigate when a decision or secondary disclosure is tapped', () => {
    const onOpen = vi.fn(), approve = vi.fn();
    render(<ApprovalRequestCard request={request} onOpen={onOpen} actions={<button onClick={approve}>Approve</button>} secondaryActions={<button>Conversation</button>} />);
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    fireEvent.click(screen.getByText('More actions'));
    fireEvent.click(screen.getByRole('button', { name: 'Conversation' }));
    expect(approve).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('preserves the paused approval state for requests waiting on an employee', () => {
    render(<ApprovalRequestCard request={request} onOpen={vi.fn()} waiting actions={<button>Approve</button>} />);
    expect(screen.getByText('Waiting for employee')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View request' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
  });
});
