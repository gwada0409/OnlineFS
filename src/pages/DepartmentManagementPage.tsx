import React, { useEffect, useState } from 'react';
import { DepartmentAPI, HRAPI } from '../lib/api';
import { Building2, Users, Plus, X, UserPlus, Edit2, Eye } from 'lucide-react';
import { useToast } from '../components/ToastProvider';

export const DepartmentManagementPage: React.FC = () => {
  const toast = useToast();
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDept, setSelectedDept] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Forms
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDeptForm, setNewDeptForm] = useState({ name: '', description: '' });

  const [showAssignForm, setShowAssignForm] = useState(false);
  const [assignForm, setAssignForm] = useState({ employeeId: 0, position: '', orgRole: 'Employee' });
  const [isEditingEmployee, setIsEditingEmployee] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);

  useEffect(() => {
    loadDepartments();
    HRAPI.getEmployees().then(setEmployees).catch(console.error);
  }, []);

  const loadDepartments = async () => {
    setLoading(true);
    try {
      const data = await DepartmentAPI.getAll();
      setDepartments(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadDepartmentDetails = async (id: number) => {
    try {
      const data = await DepartmentAPI.getById(id);
      setSelectedDept(data);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load department details');
    }
  };

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await DepartmentAPI.create(newDeptForm);
      setShowAddForm(false);
      setNewDeptForm({ name: '', description: '' });
      toast.success('Department created successfully');
      loadDepartments();
    } catch (e) {
      toast.error("Failed to create department");
    }
  };

  const handleAssignEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDept || assignForm.employeeId === 0) return;
    
    try {
      await DepartmentAPI.assignEmployee(selectedDept.id, assignForm);
      setShowAssignForm(false);
      setIsEditingEmployee(false);
      setAssignForm({ employeeId: 0, position: '', orgRole: 'Employee' });
      toast.success(isEditingEmployee ? 'Employee updated successfully' : 'Employee assigned successfully');
      loadDepartmentDetails(selectedDept.id);
      loadDepartments();
    } catch (e) {
      toast.error("Failed to assign/update employee");
    }
  };

  const handleEditEmployee = (e: any) => {
    setAssignForm({
      employeeId: e.id,
      position: e.position || '',
      orgRole: e.orgRole || 'Employee'
    });
    setIsEditingEmployee(true);
    setShowAssignForm(true);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title flex items-center">Department Management</h1>
        <button className="btn btn-primary" onClick={() => setShowAddForm(true)}>
          <Plus size={18} /> New Department
        </button>
      </div>

      <div className="dashboard-grid two-cols">
        <div className="glass-card">
          <div className="glass-card-header">
            <h2 className="flex items-center gap-2"><Building2 size={18} className="text-[var(--primary)]" /> Departments</h2>
          </div>
          <div className="glass-card-body p-0">
            {loading ? <div style={{ padding: '1.5rem' }}>Loading...</div> : (
              <>
                <div className="desktop-only">
                  <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Description</th>
                      <th>Employees</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departments.map(d => (
                      <tr key={d.id} className={`hoverable-row ${selectedDept?.id === d.id ? 'selected-row' : ''}`} onClick={() => loadDepartmentDetails(d.id)}>
                        <td>{d.name}</td>
                        <td>{d.description}</td>
                        <td>{d.employeeCount}</td>
                        <td>
                          <button className="btn btn-outline btn-sm text-[var(--primary)] border-[var(--primary)] hover:bg-[var(--primary)] hover:text-white flex items-center gap-1" onClick={(e) => { e.stopPropagation(); loadDepartmentDetails(d.id); }}>
                            <Eye size={14} /> View
                          </button>
                        </td>
                      </tr>
                    ))}
                    {departments.length === 0 && (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center' }}>No departments found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
                </div>
                
                <div className="mobile-only">
                  <div className="p-4 flex flex-col gap-4">
                  {departments.map(d => (
                    <div key={`mob-${d.id}`} className="glass-card p-4 flex flex-col gap-2" style={{ border: selectedDept?.id === d.id ? '1px solid var(--primary)' : '1px solid var(--border)' }}>
                      <div className="font-bold text-lg">{d.name}</div>
                      <div className="text-sm text-muted mb-2">{d.description}</div>
                      <div className="text-sm mb-4"><strong>Employees:</strong> {d.employeeCount}</div>
                      
                      {selectedDept?.id === d.id ? (
                        <>
                          <button className="btn btn-outline btn-sm w-full text-danger border-danger hover:bg-danger hover:text-white flex items-center justify-center gap-1" onClick={() => setSelectedDept(null)}>
                            <X size={14} /> Close
                          </button>
                          <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                             <div className="flex justify-between items-center mb-4">
                               <h4 className="font-bold">Employees</h4>
                               <button className="btn btn-primary btn-sm" onClick={() => {
                                 setAssignForm({ employeeId: 0, position: '', orgRole: 'Employee' });
                                 setIsEditingEmployee(false);
                                 setShowAssignForm(true);
                               }}>
                                 <UserPlus size={14} /> Assign
                               </button>
                             </div>
                             {selectedDept.employees?.length > 0 ? (
                               <div className="flex flex-col gap-2">
                                 {selectedDept.employees.map((e: any) => (
                                   <div key={`emp-${e.id}`} className="p-3 bg-[var(--bg-input)] rounded-md border border-[var(--border)]">
                                     <div className="flex justify-between items-start mb-2">
                                       <div>
                                         <div className="font-bold">{e.fullName}</div>
                                         <div className="text-xs text-muted">{e.employeeID} - {e.position}</div>
                                       </div>
                                       <span className={`status-badge status-${e.orgRole.toLowerCase()}`}>{e.orgRole}</span>
                                     </div>
                                     <button className="btn btn-ghost btn-sm w-full text-[var(--primary)] border border-[var(--border)]" onClick={() => handleEditEmployee(e)}>
                                       <Edit2 size={14} className="mr-1" /> Edit Role
                                     </button>
                                   </div>
                                 ))}
                               </div>
                             ) : (
                               <div className="text-center text-muted text-sm p-4 bg-[var(--bg-input)] rounded-md border border-[var(--border)]">No employees found for this department.</div>
                             )}
                          </div>
                        </>
                      ) : (
                        <button className="btn btn-outline btn-sm w-full text-[var(--primary)] border-[var(--primary)] hover:bg-[var(--primary)] hover:text-white flex items-center justify-center gap-1" onClick={() => loadDepartmentDetails(d.id)}>
                          <Eye size={14} /> View
                        </button>
                      )}
                    </div>
                  ))}
                  {departments.length === 0 && (
                    <div className="text-center text-muted p-4">No departments found</div>
                  )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {selectedDept ? (
          <div className="glass-card animate-slide-up desktop-only">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 24px 16px 24px' }}>
              <h3 className="flex items-center"><Users size={18} className="mr-2 text-[var(--primary)]" /> {selectedDept.name} - Employees</h3>
              <button className="btn btn-primary btn-sm" onClick={() => {
                setAssignForm({ employeeId: 0, position: '', orgRole: 'Employee' });
                setIsEditingEmployee(false);
                setShowAssignForm(true);
              }}>
                <UserPlus size={16} /> Assign Employee
              </button>
            </div>
            <div className="card-content" style={{ padding: '0 24px 24px 24px' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Position</th>
                    <th>Role</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedDept.employees?.map((e: any) => (
                    <tr key={e.id}>
                      <td>{e.employeeID}</td>
                      <td>{e.fullName}</td>
                      <td>{e.position}</td>
                      <td>
                        <span className={`status-badge status-${e.orgRole.toLowerCase()}`}>{e.orgRole}</span>
                      </td>
                      <td>
                        <button className="btn btn-outline btn-sm text-[var(--primary)] border-[var(--primary)] hover:bg-[var(--primary)] hover:text-white" onClick={() => handleEditEmployee(e)} title="Edit Role/Position">
                          <Edit2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(!selectedDept.employees || selectedDept.employees.length === 0) && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center' }}>No employees in this department</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="glass-card desktop-only flex flex-col items-center justify-center text-muted" style={{ minHeight: '400px' }}>
            <Building2 size={48} className="mb-4 opacity-50" />
            <p>Select a department to view details.</p>
          </div>
        )}
      </div>

      {/* Add Department Modal */}
      {showAddForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Create New Department</h3>
              <button className="btn btn-ghost" onClick={() => setShowAddForm(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateDepartment}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Department Name</label>
                  <input type="text" className="form-input" required
                         value={newDeptForm.name} onChange={e => setNewDeptForm({ ...newDeptForm, name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea className="form-input" rows={3}
                            value={newDeptForm.description} onChange={e => setNewDeptForm({ ...newDeptForm, description: e.target.value })} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowAddForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Employee Modal */}
      {showAssignForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{isEditingEmployee ? `Edit Employee in ${selectedDept?.name}` : `Assign Employee to ${selectedDept?.name}`}</h3>
              <button className="btn btn-ghost" onClick={() => setShowAssignForm(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleAssignEmployee}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Select Employee</label>
                  <select className="form-input" required disabled={isEditingEmployee}
                          value={assignForm.employeeId} onChange={e => setAssignForm({ ...assignForm, employeeId: Number(e.target.value) })}>
                    <option value={0}>-- Select Employee --</option>
                    {employees.map(e => (
                      <option key={e.id} value={e.id}>{e.employeeID} - {e.fullName}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Position / Title</label>
                  <input type="text" className="form-input"
                         value={assignForm.position} onChange={e => setAssignForm({ ...assignForm, position: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Role in Department (for approvals)</label>
                  <select className="form-input" required
                          value={assignForm.orgRole} onChange={e => setAssignForm({ ...assignForm, orgRole: e.target.value })}>
                    <option value="Employee">Employee</option>
                    <option value="Supervisor">Supervisor</option>
                    <option value="DeptManager">Department Manager</option>
                    <option value="HRStaff">HR Staff</option>
                    <option value="HRManager">HR Manager</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowAssignForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{isEditingEmployee ? 'Save Changes' : 'Assign Employee'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
