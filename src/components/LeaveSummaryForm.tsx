import React from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';
import type { HREmployee, LeaveBalance, LeaveRequest } from '../lib/api';
import { DialogOverlay } from './ui/DialogOverlay';
import { leaveStatusBadgeClass, leaveStatusLabel } from '../lib/statusFormat';
import './LeaveSummaryForm.css';

interface Props { employee: HREmployee; balances: LeaveBalance[]; requests: LeaveRequest[]; onClose: () => void }
const formatDate = (value?: string) => value ? new Date(value).toLocaleDateString('en-GB') : '';
const balanceAtFile = (request: LeaveRequest | undefined, code: 'SL' | 'VL' | 'AL' | 'NPL') => request?.leaveBalanceAtFile?.[code] ?? '';

export const LeaveSummaryForm: React.FC<Props> = ({ employee, balances, requests, onClose }) => {
  const orderedRequests = [...requests].sort((a, b) => new Date(a.dateFiled).getTime() - new Date(b.dateFiled).getTime() || a.id - b.id).slice(0, 40);
  const pages = [orderedRequests.slice(0, 20), orderedRequests.slice(20, 40)];
  const combined = balances.some(b => b.leaveTypeCode === 'NPL');
  const totalLeave = balances.filter(item => ['SL', 'VL', 'AL', 'NPL'].includes(item.leaveTypeCode)).reduce((sum, item) => sum + item.totalCredits, 0);
  const carryOver = balances.reduce((sum, item) => sum + item.carryOver, 0);
  const sectionTeam = employee.leaveDepartmentName?.trim() || employee.section?.trim() || '';
  const departmentAndTeam = [employee.department?.trim(), sectionTeam]
    .filter((value): value is string => Boolean(value))
    .filter((value, index, all) => all.findIndex(part => part.toLowerCase() === value.toLowerCase()) === index)
    .join(' / ');

  const mobileSummary = <div className="loa-mobile-summary">
    <section className="loa-mobile-profile" aria-label="Employee summary">
      <h3>{employee.fullName}</h3>
      <p>{employee.employeeID} · {employee.department || 'Department not set'}</p>
      <dl className="loa-balance-tiles">
        <div><dt>Total credits</dt><dd>{totalLeave}<small>days</small></dd></div>
        {balances.filter(item => ['SL', 'VL', 'NPL'].includes(item.leaveTypeCode) || (item.leaveTypeCode === 'AL' && item.totalCredits > 0)).map(item =>
          <div key={item.leaveTypeId}><dt>{item.leaveTypeCode} available</dt><dd>{item.available}<small>days</small></dd></div>)}
      </dl>
      <details className="loa-mobile-details"><summary>Employee details</summary><dl className="loa-mobile-metadata">
        <div><dt>Position</dt><dd>{employee.position || 'Not set'}</dd></div>
        <div><dt>Status</dt><dd>{employee.employmentStatus || 'Not set'}</dd></div>
        <div><dt>Section / team</dt><dd>{sectionTeam || 'Not assigned'}</dd></div>
        <div><dt>Date hired</dt><dd>{formatDate(employee.dateHired) || 'Not set'}</dd></div>
        <div><dt>Carry-over</dt><dd>{carryOver} days</dd></div>
      </dl></details>
    </section>
    <section className="loa-mobile-history" aria-labelledby="loa-history-title">
      <h3 id="loa-history-title">Leave records <span>({orderedRequests.length})</span></h3>
      {requests.length > 40 && <p className="loa-summary-hint">Showing the first 40 records, matching the printed form.</p>}
      {orderedRequests.length === 0 && <p className="loa-mobile-empty">No leave records yet. The printed form includes blank rows for future entries.</p>}
      {orderedRequests.map(request => <article className="loa-mobile-record" key={request.id} aria-label={`${request.leaveTypeDescription || request.leaveTypeCode} filed ${formatDate(request.dateFiled)}`}>
        <div className="loa-mobile-record-heading"><h4>{request.leaveTypeDescription || request.leaveTypeCode}</h4><span className={`badge ${leaveStatusBadgeClass(request.status)}`}>{leaveStatusLabel(request.status, request.requestKind)}</span></div>
        <dl className="loa-mobile-metadata">
          <div><dt>From</dt><dd>{formatDate(request.dateFrom)}</dd></div>
          <div><dt>To</dt><dd>{formatDate(request.dateTo)}</dd></div>
          <div><dt>Duration</dt><dd>{request.totalHours > 0 ? `${request.totalHours} hours` : `${request.totalDays} ${request.totalDays === 1 ? 'day' : 'days'}`}</dd></div>
          <div><dt>Date filed</dt><dd>{formatDate(request.dateFiled)}</dd></div>
        </dl>
        <p className="loa-mobile-reason"><strong>Reason</strong>{request.reason || 'No reason recorded'}</p>
        <details className="loa-mobile-details"><summary>Approval details &amp; remarks</summary>
          {request.approvalSteps?.length ? <ul className="loa-mobile-approvals">{request.approvalSteps.map((step, index) => <li key={step.id ?? index}>
            <strong>{step.stepLabel} · {step.action}</strong><span>{step.approverName || 'Approver not recorded'}</span>
            {step.actionDate && <span>{formatDate(step.actionDate)}</span>}
            {(step.reasonForRejection || step.remarks) && <p>{step.reasonForRejection || step.remarks}</p>}
          </li>)}</ul> : <p>No approval details recorded.</p>}
          {request.notedByHR && <p><strong>Noted by HR:</strong> {request.notedByHR}</p>}
          {request.hrRemarks && <p><strong>HR remarks:</strong> {request.hrRemarks}</p>}
          {request.balanceDeductionLeaveTypeCode && <p><strong>Deduct from:</strong> {request.balanceDeductionLeaveTypeCode}</p>}
          {request.status === 'Approved' && request.leaveBalanceAtFile && <p><strong>Recorded balance after approval:</strong> {(['SL', 'VL', 'AL'] as const).filter(code => request.leaveBalanceAtFile?.[code] != null).map(code => `${code}: ${balanceAtFile(request, code)}`).join(' · ')}</p>}
        </details>
      </article>)}
    </section>
    <details className="loa-mobile-details loa-mobile-print-guide"><summary>A4 print settings</summary><p>A4 Portrait is configured at 100% scale. Page 1 contains records 1–20; page 2 contains records 21–40 or blank rows. Select <strong>Print on both sides</strong> and flip on the long edge.</p></details>
  </div>;

  const printForm = () => {
    const source = document.querySelector<HTMLElement>('.loa-print-root');
    const css = document.querySelector<HTMLStyleElement>('style[data-loa-styles]')?.textContent;
    if (!source || !css) return;
    const frame = document.createElement('iframe');
    frame.setAttribute('title', 'Leave summary print document');
    Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '1px', height: '1px', border: '0', opacity: '0' });
    document.body.appendChild(frame);
    const printDocument = frame.contentDocument;
    if (!printDocument) { frame.remove(); return; }
    printDocument.open();
    printDocument.write(`<!doctype html><html><head><meta charset="utf-8"><title>Leave Summary</title><style>${css}</style></head><body><div class="loa-print-root">${source.innerHTML}</div></body></html>`);
    printDocument.close();
    window.setTimeout(() => {
      const printWindow = frame.contentWindow;
      if (!printWindow) { frame.remove(); return; }
      printWindow.addEventListener('afterprint', () => frame.remove(), { once: true });
      printWindow.focus();
      printWindow.print();
      window.setTimeout(() => { if (frame.isConnected) frame.remove(); }, 60_000);
    }, 150);
  };

  const renderSheet = (pageRows: LeaveRequest[], pageIndex: number) => (
    <section className="loa-form" aria-label={`HIBLOW leave summary form page ${pageIndex + 1}`} key={pageIndex}>
      <div className="loa-company">HIBLOW PHILS. INC.</div><div className="loa-title">LEAVE OF ABSENCE/UNDERTIME APPLICATION FORM</div>
      <div className="loa-profile"><div className="loa-profile-column">
        <div className="loa-line"><strong>EMPLOYEE NAME :</strong><span>{employee.fullName}</span></div><div className="loa-line"><strong>SECTION/TEAM :</strong><span>{departmentAndTeam || 'Not assigned'}</span></div><div className="loa-line"><strong>TOTAL NO. OF LEAVE :</strong><span>{totalLeave || 'N/A'}</span></div><div className="loa-line"><strong>TOTAL CARRY-OVER :</strong><span>{carryOver || 'N/A'}</span></div>
      </div><div className="loa-profile-column">
        <div className="loa-line"><strong>ID NO:</strong><span>{employee.employeeID}</span></div><div className="loa-line"><strong>STATUS:</strong><span>{employee.employmentStatus?.trim().toUpperCase() || 'NOT SET'}</span></div><div className="loa-line"><strong>POSITION:</strong><span>{employee.position}</span></div><div className="loa-line"><strong>DATE HIRED:</strong><span>{formatDate(employee.dateHired)}</span></div>
      </div></div>
      <div className="loa-legend"><strong>TYPE OF LEAVE:</strong> VL–Vacation Leave; SL–Sick Leave; BL–Bereavement Leave; PL–Paternity Leave; ML–Maternity Leave; MrgL–Marriage Leave; HDL–Half-day Leave; UT–Undertime; SPL–Solo Parent Leave; VAWC–Violence Against Women and Children; SLW–Special Leave for Women</div>
      <table><colgroup><col style={{width:'6.3%'}}/><col style={{width:'4.2%'}}/><col style={{width:'6.2%'}}/><col style={{width:'6.2%'}}/><col style={{width:'5.6%'}}/><col style={{width:'20.7%'}}/><col style={{width:'6.1%'}}/><col style={{width:'6.8%'}}/><col style={{width:'8.1%'}}/><col style={{width:'6.5%'}}/><col style={{width:'3.1%'}}/><col style={{width:'3.1%'}}/><col style={{width:'3.1%'}}/><col style={{width:'11.7%'}}/></colgroup>
        <thead><tr><th rowSpan={2}>DATE FILED<br/>DD/MM/<br/>YYYY</th><th rowSpan={2}>TYPE OF<br/>LEAVE</th><th colSpan={2}>DATE OF LEAVE/ABSENT</th><th rowSpan={2}>TOTAL<br/>DAYS/HRS</th><th rowSpan={2}>REASON OF ABSENT/UNDERTIME</th><th colSpan={2}>RECOMMENDED ACTION</th><th rowSpan={2}>APPROVED BY:<br/>DEPT. MANAGER</th><th rowSpan={2}>NOTED BY:<br/>(HR SECTION)</th><th colSpan={3}>LEAVE BALANCE</th><th rowSpan={2}>REMARKS</th></tr><tr><th>FROM</th><th>TO</th><th className="loa-tight">Approved</th><th className="loa-tight">Disapproved</th><th>{combined ? 'NPL' : 'SL'}</th><th>{combined ? '—' : 'VL'}</th><th>AL</th></tr></thead>
        <tbody>{Array.from({length:20}, (_, rowIndex) => { const request = pageRows[rowIndex]; const steps = request?.approvalSteps ?? []; const recommending = steps.filter(step => step.stageKind === 'RECOMMENDING'); const first = recommending.find(step => step.action === 'Approved' || step.action === 'Disapproved') ?? recommending[0] ?? steps.find(step => !step.stageKind); const manager = steps.find(step => step.stageKind === 'APPROVER' && step.action === 'Approved') ?? steps[steps.length - 1]; return <tr key={request?.id ?? `blank-${pageIndex}-${rowIndex}`}>
          <td className="loa-date">{formatDate(request?.dateFiled)}</td><td className="loa-center">{request?.leaveTypeCode}{request?.balanceDeductionLeaveTypeCode ? ` → ${request.balanceDeductionLeaveTypeCode}` : ''}</td><td className="loa-date">{formatDate(request?.dateFrom)}</td><td className="loa-date">{formatDate(request?.dateTo)}</td><td className="loa-duration">{request ? (request.totalHours > 0 ? `${request.totalHours} hrs` : `${request.totalDays} days`) : ''}</td><td>{request?.reason}</td><td className="loa-center">{first?.action === 'Approved' ? '✓' : ''}</td><td className="loa-center">{first?.action === 'Disapproved' ? '✓' : ''}</td><td className="loa-center">{manager?.action === 'Approved' ? manager.approverName : ''}</td><td className="loa-center">{request?.notedByHR}</td><td className="loa-center">{request?.status === 'Approved' ? balanceAtFile(request,combined ? 'NPL' : 'SL') : ''}</td><td className="loa-center">{request?.status === 'Approved' ? combined ? '' : balanceAtFile(request,'VL') : ''}</td><td className="loa-center">{request?.status === 'Approved' ? balanceAtFile(request,'AL') : ''}</td><td>{request?.hrRemarks || first?.reasonForRejection || first?.remarks}</td>
        </tr>; })}</tbody>
      </table>
      <div className="loa-notes"><strong>Notes:</strong><br/>1. The immediate superior/Supervisor will sign on the approved/disapproved box for the recommended action.<br/>2. This form must be submitted to Human Resource after signing.<br/>3. Leave Balance shall be updated only by Human Resource.<br/>4. When SL credits are exceeded, VL credits may be used for sickness-related absences.<br/>5. Leave balance columns show the recorded balance after approval; a blank means no historical ledger balance was recorded.</div><div className="loa-code">[HPI-HR20-04] — Page {pageIndex + 1} of 2</div>
    </section>
  );

  const styles = <style data-loa-styles>{`
    .loa-print-root{display:none}.loa-shell{max-width:1500px;width:98vw;max-height:94vh;overflow:auto;background:#e5e7eb;padding:18px;color:#111}.loa-actions{position:sticky;top:0;z-index:2;display:flex;justify-content:flex-end;gap:8px;margin-bottom:12px}.loa-form{box-sizing:border-box;background:#fff;color:#111;font-family:Arial,sans-serif;padding:10mm;width:297mm;min-width:1180px;box-shadow:0 10px 35px #0004}.loa-form+.loa-form{margin-top:18px}.loa-company{font-weight:800;font-size:17px}.loa-title{font-weight:800;font-size:13px;margin-bottom:22px}.loa-profile{display:grid;grid-template-columns:1.3fr .7fr;gap:55px;margin-bottom:12px;font-size:12px}.loa-profile-column{display:grid;gap:7px}.loa-line{display:grid;grid-template-columns:145px 1fr;gap:8px;align-items:end}.loa-line span:last-child{border-bottom:1px solid #222;min-height:22px;padding:2px 5px}.loa-legend{font-size:9px;margin:10px 0 14px}.loa-form table{width:100%;border-collapse:collapse;table-layout:fixed}.loa-form th,.loa-form td{border:1px solid #222;padding:5px;font-size:10px;vertical-align:middle;overflow:hidden;text-overflow:clip}.loa-form th{text-align:center;font-weight:700;overflow-wrap:anywhere;word-break:normal;line-height:1.1}.loa-tight{font-size:8px!important}.loa-date,.loa-duration{text-align:center;white-space:nowrap;font-size:9px!important}.loa-form tbody tr{height:42px}.loa-center{text-align:center}.loa-notes{font-size:10px;line-height:1.55;margin-top:12px}.loa-code{font-size:10px;margin-top:22px}
    @page{size:A4 portrait;margin:5mm}
    @media print{html,body{width:210mm!important;height:auto!important;margin:0!important;padding:0!important;background:#fff!important}body>#root{display:none!important}body>.loa-print-root{display:block!important;width:200mm!important;margin:0!important;padding:0!important}.loa-print-root .loa-form{display:block!important;box-sizing:border-box!important;width:200mm!important;height:287mm!important;min-width:0!important;margin:0!important;padding:3mm!important;box-shadow:none!important;overflow:hidden!important;break-after:page!important;page-break-after:always!important;break-inside:avoid!important;page-break-inside:avoid!important}.loa-print-root .loa-form:last-child{break-after:auto!important;page-break-after:auto!important}.loa-print-root .loa-form table{width:100%!important}.loa-print-root .loa-form th,.loa-print-root .loa-form td{font-size:5.5pt!important;line-height:1.05!important;padding:.35mm!important;overflow-wrap:anywhere!important}.loa-print-root .loa-form .loa-tight{font-size:4.8pt!important}.loa-print-root .loa-form tbody tr{height:9.15mm!important;max-height:9.15mm!important}.loa-print-root .loa-date,.loa-print-root .loa-duration{font-size:5.1pt!important;white-space:nowrap!important;overflow-wrap:normal!important}.loa-print-root .loa-company{font-size:10pt}.loa-print-root .loa-title{font-size:7.5pt;margin-bottom:2.2mm}.loa-print-root .loa-profile{gap:5mm;margin-bottom:1.4mm;font-size:6.5pt}.loa-print-root .loa-profile-column{gap:.5mm}.loa-print-root .loa-line{grid-template-columns:27mm 1fr;gap:1mm}.loa-print-root .loa-line span:last-child{min-height:3.5mm;padding:.3mm 1mm}.loa-print-root .loa-legend{font-size:5.1pt;line-height:1.15;margin:1.2mm 0}.loa-print-root .loa-notes{font-size:5.4pt;line-height:1.2;margin-top:1.5mm}.loa-print-root .loa-code{font-size:5.2pt;margin-top:1.5mm}}
  `}</style>;

  return <>{styles}<DialogOverlay className="loa-dialog" onClose={onClose} label="Leave of absence and undertime application form" closeOnEscape closeOnBackdrop><div className="loa-shell rounded-xl" data-dialog-content><div className="loa-actions"><h2 className="loa-mobile-heading">Leave summary</h2><span className="loa-desktop-guide text-xs text-slate-700 self-center mr-auto">A4 Portrait is configured automatically at 100% scale. Page 1 contains records 1–20; page 2 contains records 21–40 or blank rows. Select <strong>Print on both sides</strong> and flip on the long edge.</span><button type="button" className="btn btn-primary" onClick={printForm}><Printer size={16} aria-hidden="true"/> Print</button><button type="button" className="btn btn-outline" onClick={onClose}><X size={16} aria-hidden="true"/> Close</button></div>{mobileSummary}<div className="loa-desktop-preview">{pages.map(renderSheet)}</div></div></DialogOverlay>{createPortal(<div className="loa-print-root">{pages.map(renderSheet)}</div>, document.body)}</>;
};
