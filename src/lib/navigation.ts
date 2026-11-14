import { BadgeCheck, Bell, Building2, CheckSquare, Clock, FileText, GitMerge, LayoutDashboard, Settings2, Users, Wrench, type LucideIcon } from 'lucide-react';

export type NavigationItem = { label: string; path: string; icon: LucideIcon; section: string };

interface NavigationAccess { isEmployee: boolean; isHR: boolean; isAdmin: boolean; isSystemAdmin: boolean; canViewPendingApprovals: boolean; capabilities: string[] }

export function getNavigationItems({ isEmployee, isHR, isAdmin, isSystemAdmin, canViewPendingApprovals, capabilities }: NavigationAccess): NavigationItem[] {
  return [
    ...(isEmployee ? [
      { label: 'My Dashboard', path: '/personal', icon: LayoutDashboard, section: 'Personal' },
      { label: 'File Leave', path: '/file-leave', icon: FileText, section: 'Personal' },
      { label: 'My Requests', path: '/my-requests', icon: Clock, section: 'Personal' },
      { label: 'Personal Notifications', path: '/notifications?workspace=Personal', icon: Bell, section: 'Personal' },
    ] : []),
    ...(canViewPendingApprovals ? [
      { label: 'Pending Approvals', path: '/approvals', icon: CheckSquare, section: 'Approvals' },
      { label: 'Approval Alerts', path: '/notifications?workspace=Approvals', icon: Bell, section: 'Approvals' },
    ] : []),
    ...(isHR ? [
      { label: 'HR Dashboard', path: '/hr', icon: Users, section: 'HR' },
      { label: 'Employee Hub', path: '/hr/employment-status', icon: BadgeCheck, section: 'HR' },
      { label: 'Departments', path: '/departments', icon: Building2, section: 'HR' },
      ...(capabilities.includes('HRManagement') ? [{ label: 'Leave Policies & Calendar', path: '/hr/leave-policies', icon: Settings2, section: 'HR' }] : []),
      { label: 'Delegation Management', path: '/approval-routing', icon: GitMerge, section: 'HR' },
      { label: 'HR Notifications', path: '/notifications?workspace=HR', icon: Bell, section: 'HR' },
    ] : []),
    ...(isAdmin ? [
      { label: 'System Operations', path: '/system', icon: LayoutDashboard, section: 'System' },
      ...(isSystemAdmin ? [
        { label: 'Health & Repair', path: '/system-health', icon: Wrench, section: 'System' },
        { label: 'Role Management', path: '/system-admin', icon: Users, section: 'System' },
      ] : []),
      { label: 'System Alerts', path: '/notifications?workspace=System', icon: Bell, section: 'System' },
    ] : []),
  ];
}
