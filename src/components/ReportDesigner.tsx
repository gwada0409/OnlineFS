import { useEffect, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { HRAPI, getApiErrorMessage } from '../lib/api';
import { useToast } from './ToastProvider';

const fields = [
  ['minDays', 'Minimum leave days', 'number'], ['maxDays', 'Maximum leave days', 'number'],
  ['minHours', 'Minimum time hours', 'number'], ['maxHours', 'Maximum time hours', 'number'],
  ['filedFrom', 'Filed from', 'date'], ['filedTo', 'Filed to', 'date'],
  ['leaveFrom', 'Leave range from', 'date'], ['leaveTo', 'Leave range to', 'date'],
] as const;

type Filters = Record<string, string>;
type Report = Awaited<ReturnType<typeof HRAPI.designReport>>;
type Options = Awaited<ReturnType<typeof HRAPI.getReportDesignerOptions>>;

export function ReportDesigner() {
  const toast = useToast();
  const [filters, setFilters] = useState<Filters>({});
  const [options, setOptions] = useState<Options | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const params = () => Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== ''));
  const update = (key: string, value: string) => { setFilters(previous => ({ ...previous, [key]: value, ...(key === 'department' ? { employeeId: '' } : {}) })); setReport(null); };

  useEffect(() => {
    HRAPI.getReportDesignerOptions().then(setOptions).catch(error => toast.error(getApiErrorMessage(error, 'Could not load report filters.')));
  }, []);

  const generate = async () => {
    setBusy(true);
    try { setReport(await HRAPI.designReport(params())); }
    catch (error) { toast.error(getApiErrorMessage(error, 'Could not generate the report.')); }
    finally { setBusy(false); }
  };
  const download = async () => {
    setExporting(true);
    try {
      const response = await HRAPI.exportDesignedReport(params());
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `Leave_Report_${new Date().toISOString().slice(0, 10)}.csv`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { toast.error(getApiErrorMessage(error, 'Could not export the report.')); }
    finally { setExporting(false); }
  };

  return <div className="glass-card-body p-5 sm:p-8 space-y-6">
    <div><h3>Report & Analytics Designer</h3><p className="text-muted text-sm">Combine filters to review leave activity. Results follow your HR access and department permissions.</p></div>
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mobile-form-grid">
      {fields.map(([key, label, type]) => <label className="form-group" key={key}><span className="form-label">{label}</span><input className="form-input" type={type} inputMode={type === 'number' ? 'decimal' : undefined} min={type === 'number' ? 0 : undefined} step={type === 'number' ? '0.25' : undefined} value={filters[key] || ''} onChange={event => update(key, event.target.value)} /></label>)}
      <label className="form-group"><span className="form-label">Type of leave</span><select className="form-select" value={filters.leaveType || ''} onChange={event => update('leaveType', event.target.value)}><option value="">All types</option>{options?.leaveTypes.map(code => <option key={code} value={code}>{code}</option>)}</select></label>
      <label className="form-group"><span className="form-label">Department</span><select className="form-select" value={filters.department || ''} onChange={event => update('department', event.target.value)}><option value="">All permitted departments</option>{options?.departments.map(department => <option key={department} value={department}>{department}</option>)}</select></label>
      <label className="form-group"><span className="form-label">Employee</span><select className="form-select" value={filters.employeeId || ''} onChange={event => update('employeeId', event.target.value)}><option value="">All permitted employees</option>{options?.employees.filter(person => !filters.department || person.department === filters.department).map(person => <option key={person.id} value={person.id}>{person.fullName} ({person.employeeID})</option>)}</select></label>
      <label className="form-group"><span className="form-label">Leave status</span><select className="form-select" value={filters.status || ''} onChange={event => update('status', event.target.value)}><option value="">All statuses</option>{options?.statuses.map(status => <option key={status} value={status}>{status}</option>)}</select></label>
      <label className="form-group"><span className="form-label">Approval status</span><select className="form-select" value={filters.approvalStatus || ''} onChange={event => update('approvalStatus', event.target.value)}><option value="">All approval stages</option>{['Pending', 'Approved', 'Disapproved'].map(status => <option key={status}>{status}</option>)}</select></label>
    </div>
    <div className="mobile-actions flex flex-wrap gap-3"><button className="btn btn-primary" onClick={generate} disabled={busy}><Search size={16}/>{busy ? 'Generating…' : 'Generate results'}</button><button className="btn btn-outline" onClick={download} disabled={exporting}><Download size={16}/>{exporting ? 'Exporting…' : 'Export CSV'}</button><button className="btn btn-ghost" onClick={() => { setFilters({}); setReport(null); }}>Clear filters</button></div>
    {report && <div className="space-y-4"><div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">{[['Records', report.totalRecords], ['Approved leave days', report.totalLeaveDays], ['Approved time hours', report.totalTimeHours], ['Pending records', report.pendingRecords]].map(([label, value]) => <div key={label} className="p-4 border border-border rounded-lg"><span className="text-muted block">{label}</span><strong className="text-lg">{value}</strong></div>)}</div>{report.isTruncated && <p className="text-sm text-muted">Showing the first 500 records. CSV export includes every matching record.</p>}<div className="data-table-wrapper"><table className="data-table mobile-record-table" role="table"><thead><tr><th scope="col">Employee</th><th scope="col">Department</th><th scope="col">Leave</th><th scope="col">Filed</th><th scope="col">Date range</th><th scope="col">Duration</th><th scope="col">Status</th><th scope="col">Approval</th></tr></thead><tbody>{report.results.map(row => <tr key={row.id}><td data-label="Employee">{row.employee}<div className="text-xs text-muted">{row.employeeID}</div></td><td data-label="Department">{row.department}</td><td data-label="Leave">{row.leaveType}{row.deductedFrom && <div className="text-xs text-muted">From {row.deductedFrom}</div>}{row.requestKind !== 'Leave' && <div className="text-xs text-muted">{row.requestKind}</div>}</td><td data-label="Filed">{new Date(row.dateFiled).toLocaleDateString()}</td><td data-label="Date range">{new Date(row.dateFrom).toLocaleDateString()} – {new Date(row.dateTo).toLocaleDateString()}</td><td data-label="Duration">{row.totalHours > 0 ? `${row.totalHours} h` : `${row.totalDays} d`}</td><td data-label="Status">{row.status}</td><td data-label="Approval">{row.approvalStatus}</td></tr>)}</tbody></table>{report.results.length === 0 && <p className="p-5 text-muted">No matching requests.</p>}</div></div>}
  </div>;
}
