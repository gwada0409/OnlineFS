import React, { useEffect, useState, useRef } from 'react';
import { ApprovalRouteAPI, HRAPI } from '../lib/api';
import { GitMerge, Plus, Trash2, X, Search, CheckCircle, RotateCcw, UserCheck } from 'lucide-react';
import { useToast } from '../components/ToastProvider';
import { useConfirm } from '../components/ConfirmDialog';
import { DialogOverlay } from '../components/ui/DialogOverlay';

export const EmployeeApprovalRoutesPage: React.FC = () => {
  const toast = useToast();
  const confirm = useConfirm();
  const [employees, setEmployees] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [routes, setRoutes] = useState<any[]>([]);
  const approvalFlowRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (selectedEmployee && window.innerWidth <= 640) {
      setTimeout(() => {
        approvalFlowRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [selectedEmployee]);
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRouteForm, setNewRouteForm] = useState({ approverId: 0, stepOrder: 1, stepLabel: '' });

  useEffect(() => {
    HRAPI.getEmployees().then(setEmployees).catch(console.error);
  }, []);

  const loadRoutes = async (empId: number) => {
    try {
      const data = await ApprovalRouteAPI.getByEmployee(empId);
      setRoutes(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectEmployee = (emp: any) => {
    setSelectedEmployee(emp);
    loadRoutes(emp.id);
  };

  const handleCreateRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    
    try {
      await ApprovalRouteAPI.create({
        employeeId: selectedEmployee.id,
        ...newRouteForm
      });
      setShowAddForm(false);
      setNewRouteForm({ approverId: 0, stepOrder: routes.length + 2, stepLabel: '' });
      toast.success('Approval route step added');
      loadRoutes(selectedEmployee.id);
    } catch (e: any) {
      toast.error(e.response?.data || "Failed to add route step");
    }
  };

  const handleDeleteRoute = async (id: number) => {
    const confirmed = await confirm({
      title: 'Remove Step',
      message: 'Remove this approval step? The remaining steps will be reordered.',
      confirmText: 'Remove',
      variant: 'danger'
    });
    if (!confirmed) return;
    try {
      await ApprovalRouteAPI.delete(id);
      toast.success('Route step removed');
      if (selectedEmployee) loadRoutes(selectedEmployee.id);
    } catch (e) {
      toast.error("Failed to delete route");
    }
  };

  const handleResetRoutes = async () => {
    if (!selectedEmployee) return;
    const confirmed = await confirm({
      title: 'Reset to Default',
      message: 'This will delete all custom routes and revert to the default approval flow. Proceed?',
      confirmText: 'Reset Routes',
      variant: 'danger'
    });
    if (!confirmed) return;
    try {
      await ApprovalRouteAPI.deleteAllForEmployee(selectedEmployee.id);
      toast.success('Routes reset to default');
      loadRoutes(selectedEmployee.id);
    } catch (e) {
      toast.error("Failed to reset routes");
    }
  };

  const filteredEmployees = employees.filter(e => 
    e.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    e.employeeID.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="page-container" style={{ padding: '1rem 2rem' }}>
      <div className="page-header" style={{ marginBottom: '1rem', borderBottom: 'none', paddingBottom: '0' }}>
        <h1 className="page-title flex items-center" style={{ fontSize: '1.5rem' }}>Custom Approval Routes</h1>
      </div>

      <div className="dashboard-grid two-cols">
        {/* Left column: Employee List */}
        <div className="glass-card">
          <div className="glass-card-header">
            <h2 className="flex items-center gap-2"><UserCheck size={18} className="text-[var(--primary)]" /> Select Employee</h2>
          </div>
          <div className="glass-card-body" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', padding: '0.5rem 0.75rem', border: '1px solid var(--border)' }}>
              <Search style={{ color: 'var(--text-muted)' }} size={16} />
              <input 
                type="text" 
                style={{ background: 'transparent', border: 'none', outline: 'none', flex: 1, fontSize: '0.875rem', color: 'var(--text-primary)' }} 
                placeholder="Search by name or ID..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
              />
            </div>
            
            <div className="mt-4 flex-col gap-2 mobile-list-height" style={{ overflowY: 'auto' }}>
              {filteredEmployees.map(emp => (
                <div 
                  key={emp.id} 
                  className={`employee-list-item ${selectedEmployee?.id === emp.id ? 'selected' : ''}`}
                  onClick={() => handleSelectEmployee(emp)}
                >
                  <div className="employee-list-title">{emp.fullName}</div>
                  <div className="employee-list-subtitle">
                    {emp.employeeID} - {emp.department}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column: Approval Route */}
        {selectedEmployee ? (
          <div ref={approvalFlowRef} className="glass-card animate-slide-up">
            <div className="glass-card-header flex-between">
              <h2 className="flex items-center text-lg gap-2"><GitMerge size={18} className="text-primary" /> Approval Flow for {selectedEmployee.fullName}</h2>
              <div className="flex items-center gap-3">
                <button className="btn btn-ghost btn-sm text-danger flex items-center gap-1 hover:bg-danger/10 transition-colors" onClick={handleResetRoutes} title="Revert to Default">
                  <RotateCcw size={16} /> Revert to Default
                </button>
                <button className="btn btn-primary btn-sm flex items-center gap-1 shadow-md hover:shadow-lg transition-shadow" onClick={() => {
                  setNewRouteForm({ approverId: 0, stepOrder: routes.length + 1, stepLabel: '' });
                  setShowAddForm(true);
                }}>
                  <Plus size={16} /> Add Step
                </button>
              </div>
            </div>
            <div className="glass-card-body">
              {routes.length === 0 ? (
                <div className="empty-state-card glass-card" style={{ margin: '2rem', borderRadius: 'var(--radius-lg)', background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--border)' }}>
                  <CheckCircle size={48} className="empty-state-icon" style={{ color: 'var(--success)', opacity: 0.8 }} />
                  <h4 style={{ color: 'var(--text-primary)', fontSize: '1.25rem', marginBottom: '0.5rem' }}>Using Default Approval Flow</h4>
                  <p className="text-sm text-center max-w-md mx-auto" style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
                    This employee is currently assigned to the system's standard hierarchy:<br/>
                    <strong style={{ display: 'block', marginTop: '0.5rem', background: 'var(--bg-secondary)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', color: 'var(--text-accent)' }}>Employee &rarr; Immediate Supervisor &rarr; Department Manager &rarr; HR</strong>
                  </p>
                  <button className="btn btn-primary mt-6 flex items-center gap-2" onClick={() => {
                    setNewRouteForm({ approverId: 0, stepOrder: routes.length + 1, stepLabel: '' });
                    setShowAddForm(true);
                  }}>
                    <Plus size={16} /> Create Custom Route
                  </button>
                </div>
              ) : (
                <div className="route-pipeline">
                  {routes.map((route) => (
                    <div key={route.id} className="route-step">
                      <div className="route-number">
                        {route.stepOrder}
                      </div>
                      <div className="route-card">
                        <div>
                          <div className="route-card-title">{route.stepLabel}</div>
                          <div className="route-card-subtitle">
                            {route.approverName} ({route.approverRole})
                          </div>
                        </div>
                        <button className="btn btn-ghost text-danger" onClick={() => handleDeleteRoute(route.id)}>
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="route-step" style={{ opacity: 0.8 }}>
                    <div className="route-number final">
                      <CheckCircle size={24} />
                    </div>
                    <div className="route-card" style={{ background: 'transparent', borderColor: 'transparent', boxShadow: 'none', padding: '0 1rem' }}>
                      <div className="route-card-title" style={{ margin: 0, color: 'var(--success)' }}>HR Final Processing</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="glass-card empty-state-card">
            <UserCheck size={48} className="empty-state-icon" />
            Select an employee to configure their approval route.
          </div>
        )}
      </div>

      {/* Add Route Step Modal */}
      {showAddForm && (
        <DialogOverlay onClose={() => setShowAddForm(false)} label="Add approval step" closeOnBackdrop>
          <div className="modal-content">
            <div className="modal-header">
              <h3>Add Approval Step</h3>
              <button className="btn btn-ghost" onClick={() => setShowAddForm(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateRoute}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Step Label (e.g. 'Project Manager Review')</label>
                  <input type="text" className="form-input" required
                         value={newRouteForm.stepLabel} onChange={e => setNewRouteForm({ ...newRouteForm, stepLabel: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Step Order</label>
                  <input type="number" min="1" className="form-input" required
                         value={newRouteForm.stepOrder} onChange={e => setNewRouteForm({ ...newRouteForm, stepOrder: Number(e.target.value) })} />
                </div>
                <div className="form-group">
                  <label>Approver</label>
                  <select className="form-input" required
                          value={newRouteForm.approverId} onChange={e => setNewRouteForm({ ...newRouteForm, approverId: Number(e.target.value) })}>
                    <option value={0}>-- Select Approver --</option>
                    {employees.map(e => (
                      <option key={e.id} value={e.id}>{e.fullName} ({e.position})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowAddForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Step</button>
              </div>
            </form>
          </div>
        </DialogOverlay>
      )}
    </div>
  );
};
