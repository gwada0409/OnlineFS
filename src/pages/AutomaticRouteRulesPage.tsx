import React, { useState, useEffect } from 'react';
import { ApprovalRoutingService } from '../services/approvalRoutingService';
import type { HREmployee } from '../lib/api';
import type { AutomaticRouteRule, ApprovalRouteTemplate } from '../types/approvalRouting';
import { HRAPI } from '../lib/api';
import { useToast } from '../components/ToastProvider';
import { Zap, Plus, Trash2, Edit2, X } from 'lucide-react';
import { DialogOverlay } from '../components/ui/DialogOverlay';

export const AutomaticRouteRulesPage: React.FC = () => {
  const toast = useToast();
  const [rules, setRules] = useState<AutomaticRouteRule[]>([]);
  const [templates, setTemplates] = useState<ApprovalRouteTemplate[]>([]);
  const [employees, setEmployees] = useState<HREmployee[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomaticRouteRule | null>(null);

  // Form State
  const [ruleName, setRuleName] = useState('');
  const [rulePriority, setRulePriority] = useState<number>(10);
  const [ruleActive, setRuleActive] = useState(true);
  const [assignedTemplateId, setAssignedTemplateId] = useState<number>(0);
  const [deptCond, setDeptCond] = useState('');
  const [sectionCond, setSectionCond] = useState('');
  const [roleCond, setRoleCond] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      await ApprovalRoutingService.refresh();
      setRules(ApprovalRoutingService.getRules());
      setTemplates(ApprovalRoutingService.getTemplates().filter(t => t.isActive));
      setEmployees(await HRAPI.getEmployees());
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenCreate = () => {
    setEditingRule(null);
    setRuleName('');
    setRulePriority(10);
    setRuleActive(true);
    setAssignedTemplateId(templates[0]?.id || 0);
    setDeptCond('');
    setSectionCond('');
    setRoleCond('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (rule: AutomaticRouteRule) => {
    setEditingRule(rule);
    setRuleName(rule.name);
    setRulePriority(rule.priority);
    setRuleActive(rule.isActive);
    setAssignedTemplateId(rule.assignedTemplateId);
    setDeptCond(rule.conditions.department || '');
    setSectionCond(rule.conditions.section || '');
    setRoleCond(rule.conditions.orgRole || '');
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    try { await ApprovalRoutingService.deleteRule(id); toast.success('Automatic rule deleted'); await loadData(); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to delete rule'); }
  };

  const handleSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim()) return toast.error('Rule name is required');
    if (assignedTemplateId === 0) return toast.error('Please assign a template');

    const template = templates.find(t => t.id === assignedTemplateId);

    try { await ApprovalRoutingService.saveRule({
      id: editingRule?.id,
      name: ruleName,
      priority: rulePriority,
      isActive: ruleActive,
      assignedTemplateId,
      assignedTemplateName: template?.name,
      conditions: {
        department: deptCond || undefined,
        section: sectionCond || undefined,
        orgRole: roleCond || undefined
      }
    });

    toast.success(editingRule ? 'Rule updated' : 'Rule created');
    setIsModalOpen(false);
    await loadData();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to save rule'); }
  };

  const departments = Array.from(new Set(employees.map(e => e.department).filter(Boolean)));
  const sections = Array.from(new Set(employees.map(e => e.section).filter(Boolean)));
  const roles = Array.from(new Set(employees.map(e => e.orgRole).filter(Boolean)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><Zap size={22} className="text-primary" /> Automatic Route Assignment Rules</h2>
          <p className="text-sm text-muted">Configure conditional priority rules to automatically assign approval templates to new or updated employees.</p>
        </div>
        <button className="btn btn-primary flex items-center gap-2" onClick={handleOpenCreate}>
          <Plus size={16} /> Create Assignment Rule
        </button>
      </div>

      {/* Rules List */}
      <div className="glass-card">
        <div className="glass-card-body p-0">
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Priority</th>
                  <th>Rule Name</th>
                  <th>Assigned Template</th>
                  <th>Matching Conditions</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rules.map(rule => (
                  <tr key={rule.id}>
                    <td>
                      <span className="badge badge-primary font-mono font-bold">P{rule.priority}</span>
                    </td>
                    <td>
                      <div className="font-bold">{rule.name}</div>
                      <div className="text-xs text-muted">Updated {new Date(rule.updatedDate).toLocaleDateString()}</div>
                    </td>
                    <td>
                      <div className="font-bold text-primary">{rule.assignedTemplateName || 'Default'}</div>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1 text-xs">
                        {rule.conditions.department && <span className="bg-base px-2 py-0.5 rounded border border-border">Dept: {rule.conditions.department}</span>}
                        {rule.conditions.section && <span className="bg-base px-2 py-0.5 rounded border border-border">Sec: {rule.conditions.section}</span>}
                        {rule.conditions.orgRole && <span className="bg-base px-2 py-0.5 rounded border border-border">Role: {rule.conditions.orgRole}</span>}
                        {!rule.conditions.department && !rule.conditions.section && !rule.conditions.orgRole && (
                          <span className="text-muted">All Employees (Catch-all)</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${rule.isActive ? 'badge-success' : 'badge-danger'}`}>
                        {rule.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="text-right">
                      <button className="btn btn-ghost text-info p-2 mr-1" onClick={() => handleOpenEdit(rule)} title="Edit Rule">
                        <Edit2 size={16} />
                      </button>
                      <button className="btn btn-ghost text-danger p-2" onClick={() => handleDelete(rule.id)} title="Delete Rule">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {rules.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center p-8 text-muted">No automatic route rules defined.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create / Edit Rule Modal */}
      {isModalOpen && (
        <DialogOverlay onClose={() => setIsModalOpen(false)} label={editingRule ? 'Edit automatic route rule' : 'Create automatic route rule'} closeOnBackdrop>
          <div className="modal-content animate-slide-up">
            <div className="modal-header">
              <h2>{editingRule ? 'Edit Assignment Rule' : 'Create Automatic Route Rule'}</h2>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveSubmit}>
              <div className="form-group">
                <label className="form-label">Rule Name</label>
                <input type="text" className="form-input" value={ruleName} onChange={e => setRuleName(e.target.value)} required placeholder="e.g. IT Department Standard Rule" />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Rule Priority (Higher = Evaluated First)</label>
                  <input type="number" className="form-input" value={rulePriority} onChange={e => setRulePriority(Number(e.target.value))} required min={1} max={100} />
                </div>

                <div className="form-group">
                  <label className="form-label">Target Route Template</label>
                  <select className="form-select" value={assignedTemplateId} onChange={e => setAssignedTemplateId(Number(e.target.value))} required>
                    <option value={0}>Select Template...</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="border-t border-border pt-4 mb-4">
                <h4 className="font-bold text-sm text-text mb-3">Matching Conditions (Optional Filters)</h4>
                
                <div className="form-group">
                  <label className="form-label text-xs">Department Match</label>
                  <select className="form-select" value={deptCond} onChange={e => setDeptCond(e.target.value)}>
                    <option value="">Any Department</option>
                    {departments.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label text-xs">Section Match</label>
                  <select className="form-select" value={sectionCond} onChange={e => setSectionCond(e.target.value)}>
                    <option value="">Any Section</option>
                    {sections.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label text-xs">Organizational Role Match</label>
                  <select className="form-select" value={roleCond} onChange={e => setRoleCond(e.target.value)}>
                    <option value="">Any Role</option>
                    {roles.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Rule</button>
              </div>
            </form>
          </div>
        </DialogOverlay>
      )}
    </div>
  );
};
