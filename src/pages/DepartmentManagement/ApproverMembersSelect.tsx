import { useId, useState } from 'react';
import type { HREmployee } from '../../lib/api';

export function ApproverMembersSelect({ label, employees, value, onChange, helpText, optional = true }: {
  label: string;
  helpText?: string;
  optional?: boolean;
  employees: HREmployee[];
  value: number[];
  onChange: (ids: number[]) => void;
}) {
  const id = useId();
  const [search, setSearch] = useState('');
  const visible = employees.filter(employee => `${employee.fullName} ${employee.position} ${employee.department}`.toLowerCase().includes(search.toLowerCase()));
  return <fieldset className="form-group space-y-2">
    <legend className="form-label">{label}{optional ? ' (Optional)' : ''}</legend>
    <label htmlFor={id} className="sr-only">Search {label} members</label>
    <input id={id} type="search" className="form-input" placeholder="Search employees…" value={search} onChange={event => setSearch(event.target.value)} />
    <div className="border border-border rounded-lg p-2 space-y-2" style={{ maxHeight: 160, overflowY: 'auto' }}>
      {visible.map(employee => <label key={employee.id} className="flex items-start gap-2 text-xs cursor-pointer p-1">
        <input type="checkbox" checked={value.includes(employee.id)} onChange={event => onChange(event.target.checked ? [...value, employee.id] : value.filter(member => member !== employee.id))} />
        <span>{employee.fullName} · {employee.position || 'Staff'} ({employee.department || 'No department'})</span>
      </label>)}
      {!visible.length && <p className="text-xs text-muted">No matching employees.</p>}
    </div>
    <p className="text-xs text-muted">{helpText || `${value.length} selected · All selected members receive the request; any one can decide. Leave empty to skip this stage.`}</p>
  </fieldset>;
}
