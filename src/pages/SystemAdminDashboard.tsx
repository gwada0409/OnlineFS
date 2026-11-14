import React, { useEffect, useMemo, useState } from 'react';
import { SystemAdminAPI, getApiErrorMessage, type HREmployee } from '../lib/api';
import { Users, Shield, RefreshCw, ShieldAlert, ShieldCheck, UserCog, Database, Key, X, Search, UserPlus } from 'lucide-react';
import { useToast } from '../components/ToastProvider';
import { DialogOverlay } from '../components/ui/DialogOverlay';

interface User {
  id: number;
  username: string;
  role: string;
}

export const SystemAdminDashboard: React.FC = () => {
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [employees, setEmployees] = useState<HREmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [createUserModalOpen, setCreateUserModalOpen] = useState(false);
  const [createUsername, setCreateUsername] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [createRole, setCreateRole] = useState<'SystemAdmin' | 'Admin' | 'Editor'>('Admin');
  const [createError, setCreateError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [selectedUserForPassword, setSelectedUserForPassword] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersData, employeesData] = await Promise.all([
        SystemAdminAPI.getUsers(),
        SystemAdminAPI.getEmployeeDirectory()
      ]);
      setUsers(usersData);
      setEmployees(employeesData);
    } catch (err) {
      console.error('Failed to load data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredEmployees = useMemo(() => {
    const query = employeeSearch.trim().toLocaleLowerCase();
    if (!query) return employees;
    return employees.filter(employee => [
      employee.employeeID, employee.fullName, employee.department, employee.section,
      employee.position, employee.orgRole, employee.employmentStatus,
      employee.supervisorName, employee.managerName
    ].some(value => value?.toLocaleLowerCase().includes(query)));
  }, [employeeSearch, employees]);

  const openCreateUser = () => {
    setCreateUsername(''); setCreatePassword(''); setConfirmPassword('');
    setCreateRole('Admin'); setCreateError(''); setCreateUserModalOpen(true);
  };

  const handleCreateUser = async (event: React.FormEvent) => {
    event.preventDefault(); setCreateError('');
    if (createUsername.trim().length < 3) return setCreateError('Username must contain at least 3 characters.');
    if (createPassword.length < 8) return setCreateError('Password must contain at least 8 characters.');
    if (createPassword !== confirmPassword) return setCreateError('Passwords do not match.');
    setSubmitting(true);
    try {
      const created = await SystemAdminAPI.createUser({ username: createUsername.trim(), password: createPassword, role: createRole });
      setUsers(current => [...current, created]);
      toast.success(`${createRole} account '${created.username}' created successfully.`);
      setCreateUserModalOpen(false);
    } catch (error) {
      setCreateError(getApiErrorMessage(error, 'Failed to create administrator account.'));
    } finally { setSubmitting(false); }
  };

  const handleUserRoleChange = async (userId: number, newRole: string) => {
    try {
      await SystemAdminAPI.updateUserRole(userId, { role: newRole });
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
      toast.success(`User role updated to ${newRole}`);
    } catch (err) {
      toast.error('Failed to update user role');
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForPassword || !newPassword.trim()) return;
    
    try {
      await SystemAdminAPI.changeUserPassword(selectedUserForPassword.id, { newPassword });
      toast.success('Password updated successfully');
      setPasswordModalOpen(false);
      setNewPassword('');
      setSelectedUserForPassword(null);
    } catch (err) {
      toast.error('Failed to update password');
    }
  };

  const handleEmployeeRoleChange = async (empId: number, newRole: string) => {
    try {
      await SystemAdminAPI.updateEmployeeRole(empId, { orgRole: newRole });
      setEmployees(employees.map(e => e.id === empId ? { ...e, orgRole: newRole } : e));
      toast.success(`Employee org role updated to ${newRole}`);
    } catch (err) {
      toast.error('Failed to update employee role');
    }
  };

  const getSystemRoleBadge = (role: string) => {
    switch (role) {
      case 'SystemAdmin': return <span className="badge" style={{ background: 'var(--info-light)', color: 'var(--info)' }}><ShieldAlert size={12} /> System Admin</span>;
      case 'Admin': return <span className="badge badge-approved"><ShieldCheck size={12} /> Admin</span>;
      case 'Editor': return <span className="badge badge-draft"><UserCog size={12} /> Editor</span>;
      default: return <span className="badge">{role}</span>;
    }
  };

  const getOrgRoleBadge = (role: string) => {
    switch (role) {
      case 'GeneralManager':
      case 'HRManager':
      case 'DeptManager': return <span className="badge" style={{ background: 'var(--info-light)', color: 'var(--info)' }}>{role}</span>;
      case 'Supervisor':
      case 'HRStaff': return <span className="badge badge-approved">{role}</span>;
      default: return <span className="badge badge-draft">{role}</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <RefreshCw size={32} className="animate-spin text-primary mx-auto mb-4" />
          <p className="text-text-secondary text-sm tracking-wider uppercase">Loading System Administration Data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container fade-in">
      <header className="page-header flex justify-between items-center">
        <div className="header-title">
          <Shield size={32} color="var(--primary)" style={{ filter: 'drop-shadow(0 0 8px var(--primary-glow))' }} />
          <div>
            <h1>System Administration</h1>
            <p>Manage backend accounts and organizational hierarchy</p>
          </div>
        </div>
        <button className="btn btn-outline" onClick={fetchData}>
          <RefreshCw size={16} /> Refresh Data
        </button>
      </header>

      <div className="page-body">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          
          {/* System Users Table */}
          <div className="glass-card">
            <div className="glass-card-header">
              <div className="flex items-center gap-3">
                <Database size={20} className="text-primary" />
                <h2>Backend System Accounts</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="badge badge-draft">{users.length} Users</span>
                <button className="btn btn-primary btn-sm" onClick={openCreateUser}><UserPlus size={14} /> Add Admin</button>
              </div>
            </div>
            <div className="glass-card-body p-0">
              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Account ID</th>
                      <th>Username</th>
                      <th>Current Role</th>
                      <th>Assign Role</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id}>
                        <td className="font-mono text-xs opacity-70">#{u.id.toString().padStart(4, '0')}</td>
                        <td className="font-medium">{u.username}</td>
                        <td>{getSystemRoleBadge(u.role)}</td>
                        <td>
                          <select 
                            className="form-select text-sm py-1.5" 
                            value={u.role} 
                            onChange={(e) => handleUserRoleChange(u.id, e.target.value)}
                          >
                            <option value="SystemAdmin">SystemAdmin</option>
                            <option value="Admin">Admin</option>
                            <option value="Editor">Editor</option>
                          </select>
                        </td>
                        <td className="text-right">
                          <button 
                            className="btn btn-outline text-xs py-1.5 px-3 flex items-center gap-1.5 ml-auto"
                            onClick={() => {
                              setSelectedUserForPassword(u);
                              setNewPassword('');
                              setPasswordModalOpen(true);
                            }}
                          >
                            <Key size={14} /> Change Pass
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Employees Table */}
          <div className="glass-card">
            <div className="glass-card-header">
              <div className="flex items-center gap-3">
                <Users size={20} className="text-info" />
                <h2>Organizational Hierarchy</h2>
              </div>
              <span className="badge badge-draft">{employees.length} Employees</span>
            </div>
            <div className="glass-card-body p-0">
              <div className="p-3 border-b border-border">
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    className="form-input w-full pl-9"
                    value={employeeSearch}
                    onChange={event => setEmployeeSearch(event.target.value)}
                    placeholder="Search ID, name, department, position, section, role, status, supervisor..."
                    aria-label="Search employees by details"
                  />
                </div>
                <div className="text-[11px] text-muted mt-2">Showing {filteredEmployees.length} of {employees.length} employees</div>
              </div>
              <div className="data-table-wrapper" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                <table className="data-table">
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 10 }}>
                    <tr>
                      <th>Emp ID</th>
                      <th>Full Name</th>
                      <th>Dept.</th>
                      <th>Current Role</th>
                      <th>Assign Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.map(e => (
                      <tr key={e.id}>
                        <td className="font-mono text-xs opacity-70">{e.employeeID}</td>
                        <td className="font-medium">{e.fullName}</td>
                        <td className="text-xs">{e.department}</td>
                        <td>{getOrgRoleBadge(e.orgRole)}</td>
                        <td>
                          <select 
                            className="form-select text-sm py-1.5" 
                            value={e.orgRole} 
                            onChange={(ev: any) => handleEmployeeRoleChange(e.id, ev.target.value)}
                          >
                            <option value="Employee">Employee</option>
                            <option value="Supervisor">Supervisor</option>
                            <option value="DeptManager">DeptManager</option>
                            <option value="HRStaff">HRStaff</option>
                            <option value="HRManager">HRManager</option>
                            <option value="GeneralManager">GeneralManager</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                    {filteredEmployees.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-muted">No employees match “{employeeSearch}”.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {createUserModalOpen && (
        <DialogOverlay onClose={() => !submitting && setCreateUserModalOpen(false)} label="Add administrator account" closeOnEscape={!submitting} closeOnBackdrop={!submitting}>
          <div className="modal-content glass-card w-full max-w-md p-6 space-y-4">
            <div className="modal-header">
              <div><h2 className="flex items-center gap-2"><UserPlus size={19} className="text-primary" /> Add Administrator</h2><p className="text-xs text-muted mt-1">Create a separate secured backend account.</p></div>
              <button className="modal-close" aria-label="Close" disabled={submitting} onClick={() => setCreateUserModalOpen(false)}><X size={18} /></button>
            </div>
            {createError && <div className="alert alert-danger text-xs">{createError}</div>}
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div><label className="form-label">Username *</label><input className="form-input w-full" value={createUsername} onChange={event => setCreateUsername(event.target.value)} minLength={3} maxLength={64} autoComplete="off" disabled={submitting} required /></div>
              <div><label className="form-label">Account Role *</label><select className="form-select w-full" value={createRole} onChange={event => setCreateRole(event.target.value as typeof createRole)} disabled={submitting}><option value="Admin">Admin</option><option value="SystemAdmin">System Administrator</option><option value="Editor">Editor</option></select><p className="text-[11px] text-muted mt-1">Admin manages the application. System Administrator can also manage accounts and roles.</p></div>
              <div><label className="form-label">Password *</label><input type="password" className="form-input w-full" value={createPassword} onChange={event => setCreatePassword(event.target.value)} minLength={8} autoComplete="new-password" disabled={submitting} required /></div>
              <div><label className="form-label">Confirm Password *</label><input type="password" className="form-input w-full" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} minLength={8} autoComplete="new-password" disabled={submitting} required /></div>
              <div className="flex justify-end gap-2 pt-3 border-t border-border"><button type="button" className="btn btn-outline" disabled={submitting} onClick={() => setCreateUserModalOpen(false)}>Cancel</button><button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Creating…' : 'Create Account'}</button></div>
            </form>
          </div>
        </DialogOverlay>
      )}

      {passwordModalOpen && selectedUserForPassword && (
        <div 
          className="modal-backdrop z-50" 
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', padding: '16px' }}
        >
          <div className="glass-card w-full shadow-2xl relative fade-in-up" style={{ maxWidth: '420px', padding: '32px', animation: 'slideUp 0.3s ease-out' }}>
            <button 
              className="text-muted hover:text-text transition-colors"
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}
              onClick={() => setPasswordModalOpen(false)}
            >
              <X size={20} />
            </button>
            <div className="flex flex-col items-center text-center mt-2" style={{ marginBottom: '24px' }}>
              <div className="flex items-center justify-center text-primary shadow-[0_0_15px_var(--primary-glow)]" style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(var(--primary-rgb), 0.1)', border: '1px solid rgba(var(--primary-rgb), 0.2)', marginBottom: '16px' }}>
                <Key size={24} />
              </div>
              <h3 className="text-xl font-bold mb-1">Change Password</h3>
              <p className="text-sm text-muted">For user <span className="font-bold text-text">{selectedUserForPassword.username}</span></p>
            </div>
            <form onSubmit={handlePasswordSubmit}>
              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label text-xs font-bold uppercase tracking-wide text-muted block" style={{ marginBottom: '8px' }}>New Password</label>
                <input
                  type="password"
                  className="form-input w-full"
                  style={{ background: 'var(--bg-secondary)', padding: '12px 16px', fontSize: '14px' }}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  autoFocus
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
                <button 
                  type="button" 
                  className="btn btn-outline" 
                  style={{ flex: 1, padding: '10px', justifyContent: 'center' }}
                  onClick={() => setPasswordModalOpen(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary shadow-[0_0_15px_var(--primary-glow)]"
                  style={{ flex: 1, padding: '10px', justifyContent: 'center' }}
                  disabled={!newPassword.trim()}
                >
                  Save Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
