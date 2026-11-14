import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LeaveAPI, CalendarPolicyAPI, getApiErrorMessage, type LeaveType, type LeaveBalance, type Holiday } from '../lib/api';
import { FileText, Calendar, Send, AlertCircle, Paperclip, UploadCloud, File as FileIcon, CheckCircle, XCircle, RefreshCw, X, ChevronLeft, ChevronRight, ListChecks, Eye } from 'lucide-react';
import { useToast } from '../components/ToastProvider';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';
import { calculateLeaveHours, leaveBalanceDays, WORK_START, WORK_END } from '../lib/leaveTime';
import { getFriendlyLeaveError } from '../lib/leaveErrors';

export type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

export interface FileQueueItem {
  id: string;
  file: File;
  progress: number;
  status: UploadStatus;
  errorMessage?: string;
  previewUrl?: string;
}

export const FileLeavePage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [selectedTypeId, setSelectedTypeId] = useState<number>(0);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [timeFrom, setTimeFrom] = useState('07:00');
  const [timeTo, setTimeTo] = useState('12:00');
  const [balanceDeductionLeaveTypeId, setBalanceDeductionLeaveTypeId] = useState<number>(0);
  const [leaderOptions, setLeaderOptions] = useState<Awaited<ReturnType<typeof LeaveAPI.getLineLeaderOptions>> | null>(null);
  const [leaderOptionsError, setLeaderOptionsError] = useState('');
  const [selectedLineLeaderId, setSelectedLineLeaderId] = useState(0);
  const [reason, setReason] = useState('');
  
  // New File Queue State
  const [fileQueue, setFileQueue] = useState<FileQueueItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); 
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [leaveRequestId, setLeaveRequestId] = useState<number | null>(null);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [submissionComplete, setSubmissionComplete] = useState(false);

  const [days, setDays] = useState<{ date: string; hours: number; isPaid: boolean; halfDayTime?: string }[]>([]);
  const [calculatedDays, setCalculatedDays] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
    let active = true;
    LeaveAPI.getLineLeaderOptions().then(options => { if (active) setLeaderOptions(options); }).catch(error => { if (active) setLeaderOptionsError(getApiErrorMessage(error, 'Could not load department line leaders. Refresh to try again.')); });
    // Cleanup previews on unmount
    return () => {
      active = false;
      setFileQueue(prev => {
        prev.forEach(item => {
          if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        });
        return prev;
      });
    };
  }, []);

  useEffect(() => {
    const years = [...new Set([dateFrom, dateTo].filter(Boolean).map(value => Number(value.slice(0, 4))))]
      .filter(year => Number.isInteger(year));
    if (years.length === 0) return;
    let active = true;
    Promise.all([Promise.all(years.map(year => LeaveAPI.getHolidays(year))), CalendarPolicyAPI.getCalendar(years[0])])
      .then(([results, calendar]) => { if (active) { setHolidays(results.flat()); setWorkingDays((calendar.workCalendar?.workingDays || '1,2,3,4,5').split(',').map(Number)); } })
      .catch(() => { if (active) setHolidays([]); });
    return () => { active = false; };
  }, [dateFrom, dateTo]);

  const loadData = async () => {
    try {
      const [types, bal, configuredHolidays, calendar] = await Promise.all([
        LeaveAPI.getTypes(),
        LeaveAPI.getBalance(),
        LeaveAPI.getHolidays(),
        CalendarPolicyAPI.getCalendar(new Date().getFullYear())
      ]);
      setLeaveTypes(types);
      setBalances(bal);
      setHolidays(configuredHolidays);
      setWorkingDays((calendar.workCalendar?.workingDays || '1,2,3,4,5').split(',').map(Number));
    } catch (e) { console.error(e); }
  };

  const selectedType = leaveTypes.find(t => t.id === selectedTypeId);
  const selectedBalance = balances.find(b => b.leaveTypeId === selectedTypeId) ?? (['SL', 'VL', 'HDL'].includes(selectedType?.code ?? '') ? balances.find(b => b.leaveTypeCode === 'NPL') : undefined);
  const isSickLeave = selectedType?.code?.trim().toUpperCase() === 'SL';
  const isHdl = selectedType?.code?.trim().toUpperCase() === 'HDL';
  const isUndertime = selectedType?.code?.trim().toUpperCase() === 'UT';
  const isFitToWork = selectedType?.code?.trim().toUpperCase() === 'FTW' || /fit[\s-]*to[\s-]*work/i.test(selectedType?.description || '');
  const todayLocal = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
  const computedTimeHours = selectedType?.isHoursBased ? calculateLeaveHours(timeFrom, timeTo) : 0;
  const selectedDeductionBalance = balances.find(balance => balance.leaveTypeId === balanceDeductionLeaveTypeId) ?? balances.find(balance => balance.leaveTypeCode === 'NPL');
  const sickLeaveTouchesMondayOrFriday = days.some(day => {
    const weekday = new Date(`${day.date}T00:00:00`).getDay();
    return weekday === 1 || weekday === 5;
  });
  const configuredAttachmentThreshold = selectedType?.attachmentRequiredAfterDays;
  const requiresSupportingDocument = isSickLeave
    ? (calculatedDays ?? 0) >= 2 || sickLeaveTouchesMondayOrFriday
    : Boolean(selectedType?.requiresAttachment) ||
      (configuredAttachmentThreshold != null && (calculatedDays ?? 0) >= configuredAttachmentThreshold);
  const attachmentPolicyMessage = isSickLeave
    ? requiresSupportingDocument
      ? sickLeaveTouchesMondayOrFriday
        ? 'A medical certificate or supporting document is required when Sick Leave includes a Monday or Friday.'
        : 'A medical certificate or supporting document is required for two or more consecutive Sick Leave days.'
      : 'A one-day Sick Leave on Tuesday, Wednesday, or Thursday does not require a medical certificate.'
    : requiresSupportingDocument
      ? 'This leave type requires a supporting document.'
      : 'Supporting documents are optional for this request.';

  // Auto-calculate days when dates change
  useEffect(() => {
    if (dateFrom && dateTo && selectedType && !selectedType.isHoursBased) {
      const from = new Date(dateFrom);
      const to = new Date(dateTo);
      if (to >= from) {
        let count = 0;
        const generatedDays = [];
        const holidayDates = new Set(holidays.map(item => item.date.slice(0, 10)));
        for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
          const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          if ((selectedType.countWeekends || workingDays.includes(d.getDay())) && (selectedType.countHolidays || !holidayDates.has(localDate))) {
            count++;
            generatedDays.push({
              date: localDate,
              hours: 8,
              isPaid: true
            });
          }
        }
        setCalculatedDays(count);
        setDays(generatedDays);
      } else {
        setCalculatedDays(0);
        setDays([]);
      }
    } else {
      setCalculatedDays(null);
      setDays([]);
    }
  }, [dateFrom, dateTo, selectedTypeId, holidays, workingDays]);

  const handleDayUpdate = (index: number, field: string, value: any) => {
    const newDays = [...days];
    newDays[index] = { ...newDays[index], [field]: value };
    setDays(newDays);
  };

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (leaveRequestId) return; // Prevent adding if already submitted
    setIsDragging(true);
  }, [leaveRequestId]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const ALLOWED_EXTENSIONS = ['svg', 'png', 'jpg', 'jpeg', 'pdf', 'docx'];
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  const addFilesToQueue = (files: File[]) => {
    if (leaveRequestId) return;
    const newItems: FileQueueItem[] = [];

    if (fileQueue.length + files.length > 5) {
      toast.error('A maximum of 5 supporting documents is allowed.');
      return;
    }

    for (const file of files) {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        toast.error(`File "${file.name}" is not supported. Allowed formats: SVG, PNG, JPG, PDF, DOCX.`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`File "${file.name}" exceeds maximum allowed size of 10MB.`);
        continue;
      }

      let previewUrl;
      if (file.type.startsWith('image/')) {
        previewUrl = URL.createObjectURL(file);
      }
      newItems.push({
        id: Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
        file,
        progress: 0,
        status: 'idle',
        previewUrl
      });
    }

    if (newItems.length > 0) {
      setFileQueue(prev => [...prev, ...newItems]);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFilesToQueue(Array.from(e.dataTransfer.files));
    }
  }, [leaveRequestId]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFilesToQueue(Array.from(e.target.files));
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (id: string) => {
    if (leaveRequestId) return;
    setFileQueue(prev => {
      const item = prev.find(p => p.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter(p => p.id !== id);
    });
  };

  const uploadSingleFile = async (item: FileQueueItem, reqId: number) => {
    setFileQueue(prev => prev.map(p => p.id === item.id ? { ...p, status: 'uploading', progress: 0, errorMessage: undefined } : p));
    try {
      await LeaveAPI.uploadAttachment(reqId, item.file, (progressEvent) => {
        if (progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setFileQueue(prev => prev.map(p => p.id === item.id ? { ...p, progress: percentCompleted } : p));
        }
      });
      setFileQueue(prev => prev.map(p => p.id === item.id ? { ...p, status: 'success', progress: 100 } : p));
      return true;
    } catch (err: any) {
      setFileQueue(prev => prev.map(p => p.id === item.id ? { ...p, status: 'error', progress: 0, errorMessage: err.response?.data || 'Upload failed' } : p));
      return false;
    }
  };

  const processUploadQueue = async (reqId: number, queue: FileQueueItem[]) => {
    setIsUploadingFiles(true);
    let allSuccess = true;
    for (const item of queue) {
      if (item.status !== 'success') {
        const success = await uploadSingleFile(item, reqId);
        if (!success) allSuccess = false;
      }
    }
    
    if (allSuccess) {
      toast.success('Leave request and files successfully submitted!');
      setSubmissionComplete(true);
    } else {
      setIsUploadingFiles(false);
      toast.error('Some files failed to upload. You can retry them below.');
    }
  };

  const validateLeaveDetails = () => {
    if (!isSickLeave && !leaderOptions) return leaderOptionsError || 'Department line leaders are still loading.';
    if (!isSickLeave && leaderOptions?.requiresSelection && !leaderOptions.lineLeaders.some(leader => leader.id === selectedLineLeaderId)) return 'Choose a department line leader to note your leave.';
    if (!selectedTypeId) return 'Please select a leave type.';
    if (!dateFrom || !dateTo) return 'Please select both the starting and ending dates.';
    if (dateFrom > dateTo) return 'The start date cannot be later than the end date.';
    if (dateFrom < todayLocal && !selectedType?.allowBackdatedFiling) return `Backdated filing is not enabled for ${selectedType?.description || 'this leave type'}. Ask HR to review the policy.`;
    if (selectedType?.isHoursBased && computedTimeHours <= 0) return 'Select a valid Time of Leave between 7:00 AM and 5:35 PM that includes working time.';
    if (isHdl && !balanceDeductionLeaveTypeId) return 'Choose whether this HDL request will be deducted from Sick Leave (SL) or Vacation Leave (VL).';
    if (!reason.trim()) return 'Please provide a reason for the request.';
    return '';
  };

  const goToAttachments = () => {
    const validationError = validateLeaveDetails();
    if (validationError) {
      setError(validationError);
      toast.error(validationError);
      return;
    }
    setError('');
    setCurrentStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goToReview = () => {
    if (requiresSupportingDocument && fileQueue.length === 0) {
      const validationError = 'This leave type requires a supporting document before you continue.';
      setError(validationError);
      toast.error(validationError);
      return;
    }
    setError('');
    setCurrentStep(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const retryUpload = (item: FileQueueItem) => {
    if (leaveRequestId) {
      processUploadQueue(leaveRequestId, [item]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError('');

    try {
      const detailsError = validateLeaveDetails();
      if (detailsError) throw new Error(detailsError);
      // 1. Basic validation
      if (!selectedTypeId) {
        throw new Error('Please select a leave type');
      }
      if (!dateFrom || !dateTo) {
        throw new Error('Start date and end date are required.');
      }
      if (dateFrom > dateTo) {
        throw new Error('The start date cannot be later than the end date.');
      }
      if (dateFrom < todayLocal && !selectedType?.allowBackdatedFiling) {
        throw new Error(`Backdated filing is not enabled for ${selectedType?.description || 'this leave type'}. Ask HR to review the policy.`);
      }
      if (!reason.trim()) {
        throw new Error('Please provide a reason');
      }
      if (selectedType?.isHoursBased && computedTimeHours <= 0) {
        throw new Error('Select a valid Time of Leave between 7:00 AM and 5:35 PM that includes working time.');
      }
      if (isHdl && !balanceDeductionLeaveTypeId) throw new Error('Choose Sick Leave (SL) or Vacation Leave (VL) for the HDL deduction.');
      if (requiresSupportingDocument && fileQueue.length === 0) {
        throw new Error('This leave type requires supporting documents');
      }

      // 2. Daily breakdown validation for multi-day requests
      if (!selectedType?.isHoursBased && days.length > 0) {
        const invalidDay = days.some(
          day => !day.date || !Number.isFinite(Number(day.hours)) || Number(day.hours) <= 0
        );
        if (invalidDay) {
          throw new Error('One or more daily breakdown entries are invalid.');
        }
      }

      setIsSubmitting(true);
      let reqId = leaveRequestId;

      // 4. Submit normalized payload
      if (!reqId) {
        const normalizedDays = selectedType?.isHoursBased
          ? undefined
          : days.map(day => ({
              date: day.date,
              hours: Number(day.hours),
              isPaid: Boolean(day.isPaid),
              halfDayTime: day.halfDayTime
            }));

        const payload = {
          selectedLineLeaderId: !isSickLeave && leaderOptions?.requiresSelection ? selectedLineLeaderId : undefined,
          leaveTypeId: Number(selectedTypeId),
          dateFrom,
          dateTo,
          totalHours: selectedType?.isHoursBased ? computedTimeHours : 0,
          halfDayTime: selectedType?.isHoursBased ? `${timeFrom}-${timeTo}` : undefined,
          balanceDeductionLeaveTypeId: isHdl ? balanceDeductionLeaveTypeId : undefined,
          reason: reason.trim(),
          days: normalizedDays
        };

        setIsUploadingFiles(fileQueue.length > 0);
        const result = await LeaveAPI.apply(payload, fileQueue.map(item => item.file));
        reqId = result.id;
        setLeaveRequestId(reqId);
        setFileQueue(prev => prev.map(item => ({ ...item, status: 'success', progress: 100 })));
        toast.success(`Leave request filed successfully! (${result.totalDays} day${result.totalDays !== 1 ? 's' : ''})`);
        setSubmissionComplete(true);
      }
    } catch (err: any) {
      const friendlyMsg = getFriendlyLeaveError(err);
      setError(friendlyMsg);
      toast.error(friendlyMsg);
    } finally {
      setIsSubmitting(false);
      setIsUploadingFiles(false);
    }
  };

  // Determine if the form fields should be locked
  const isLocked = leaveRequestId !== null || isSubmitting || isUploadingFiles;

  return (
    <div className="animate-fade-in filing-page">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0"><FileText size={20} /></div>
          <div><h1 className="text-xl font-bold leading-tight">File Leave Request</h1><p className="text-xs text-text-secondary mt-0.5">Complete the details below and submit your application for approval.</p></div>
        </div>
      </div>

      <div className="page-body">
        <div className="mx-auto w-full" style={{ maxWidth: 1040 }}>
          {/* Form Header */}
          <div className="glass-card mb-5 overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.10), rgba(139,92,246,0.04))' }}>
            <div className="glass-card-body px-5 py-5 sm:px-7">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div><div className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">HIBLOW Philippines Inc.</div><h2 className="text-lg font-bold">Leave of Absence / Undertime Application</h2><p className="text-xs text-muted mt-1">Fields marked with <span className="text-danger">*</span> are required.</p></div>
                <div className="sm:text-right shrink-0"><div className="text-[10px] uppercase tracking-wider text-muted">Date filed</div><div className="font-semibold text-sm mt-1">{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div></div>
              </div>
              <div data-tutorial="filing-stages" className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-border text-xs">
                {([1, 2, 3] as const).map((step, index) => {
                  const labels = ['Leave details', 'Attachments', 'Review & submit'];
                  const active = currentStep === step && !submissionComplete;
                  const complete = currentStep > step || submissionComplete;
                  return <button key={step} type="button" disabled={step > currentStep || submissionComplete} onClick={() => setCurrentStep(step)} className={`flex items-center gap-2 ${index === 1 ? 'justify-center' : index === 2 ? 'justify-end' : ''} ${active || complete ? 'text-primary font-semibold' : 'text-muted'} disabled:cursor-default`}><span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${active || complete ? 'bg-primary text-white' : 'border border-border'}`}>{complete ? <CheckCircle size={14}/> : step}</span><span className="hidden sm:inline">{labels[index]}</span></button>;
                })}
              </div>
            </div>
          </div>

          {submissionComplete && leaveRequestId ? (
            <div className="glass-card animate-slide-up">
              <div className="glass-card-body py-12 px-6 text-center">
                <div className="w-16 h-16 rounded-full bg-success/10 text-success flex items-center justify-center mx-auto mb-4"><CheckCircle size={34}/></div>
                <h2 className="text-xl font-bold">Leave request submitted</h2>
                <p className="text-sm text-muted mt-2 max-w-lg mx-auto">Your request has been sent through the approval route. You can track its progress and receive updates from My Requests or Notifications.</p>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 mt-7">
                  <button type="button" className="btn btn-primary" onClick={() => navigate(`/leave/${leaveRequestId}`)}><Eye size={16}/> View Submitted Request</button>
                  <button type="button" className="btn btn-outline" onClick={() => navigate('/my-requests')}>Go to My Requests</button>
                  <button type="button" className="btn btn-outline" onClick={() => window.location.reload()}>File Another Leave</button>
                </div>
                <p className="text-xs text-muted mt-5">You may safely close this page. The request has already been saved.</p>
              </div>
            </div>
          ) : <form onSubmit={handleSubmit}>
            {/* Leave Type Selection */}
            {currentStep === 1 && <div className={`glass-card mb-5 animate-slide-up ${isLocked ? 'opacity-80 pointer-events-none' : ''}`}>
              <div className="glass-card-header flex items-center gap-3 px-5 sm:px-6" style={{ justifyContent: 'flex-start' }}>
                <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0"><Calendar size={18} /></div>
                <div className="min-w-0 text-left"><h2 className="m-0 text-base">Leave Information</h2><p className="text-xs text-muted mt-0.5">Choose the leave type and requested dates.</p></div>
              </div>
              <div className="glass-card-body px-5 py-5 sm:px-6 sm:py-6">
                <div className="form-group">
                  <label className="form-label" htmlFor="leave-type">Type of Leave <span className="text-danger">*</span></label>
                  <select
                    id="leave-type"
                    className="form-select"
                    value={selectedTypeId}
                    onChange={e => setSelectedTypeId(Number(e.target.value))}
                    required
                    disabled={isLocked}
                  >
                    <option value={0}>Select leave type...</option>
                    {leaveTypes.map(lt => (
                      <option key={lt.id} value={lt.id}>
                        {lt.code} — {lt.description}
                      </option>
                    ))}
                  </select>
                </div>

                {isHdl && <div className="form-group mb-5">
                  <label className="form-label" htmlFor="hdl-deduction">Deduct HDL from <span className="text-danger">*</span></label>
                  <select id="hdl-deduction" className="form-select" value={balanceDeductionLeaveTypeId} onChange={e => setBalanceDeductionLeaveTypeId(Number(e.target.value))} required disabled={isLocked}>
                    <option value={0}>Select SL or VL balance...</option>
                    {leaveTypes.filter(type => ['SL', 'VL'].includes(type.code.trim().toUpperCase())).map(type => <option key={type.id} value={type.id}>{type.code} — {type.description}</option>)}
                  </select>
                </div>}

                {((isHdl && selectedDeductionBalance) || (selectedType && selectedBalance && selectedType.deductsFromBalance)) && (
                  <div className="alert alert-info mb-5">
                    <AlertCircle size={16} />
                    <span>Available Balance for {isHdl ? selectedDeductionBalance?.leaveTypeCode : selectedType?.code}: <strong>{isHdl ? selectedDeductionBalance?.available.toFixed(1) : selectedBalance?.available.toFixed(1)} days</strong>{isHdl ? ` · estimated deduction ${leaveBalanceDays(computedTimeHours).toFixed(4)} day(s)` : ` (Credits: ${selectedBalance?.totalCredits}, Carry-Over: ${selectedBalance?.carryOver})`}</span>
                  </div>
                )}

                {isSickLeave && <div className="alert alert-info mb-5"><AlertCircle size={16}/><span><strong>Sick Leave policy:</strong> An attachment is required for Monday or Friday SL and for two or more consecutive SL days. A single Tuesday–Thursday SL day does not require one.</span></div>}
                {isFitToWork && <div className="alert alert-info mb-5"><AlertCircle size={16}/><span><strong>Fit-to-Work filing:</strong> {selectedType?.allowBackdatedFiling ? 'Previous dates are allowed by the current policy and will follow the normal approval route.' : 'Previous dates require HR to enable backdated filing for this leave type.'} Working-day, eligibility, and attachment rules still apply.</span></div>}

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="date-from">Date From <span className="text-danger">*</span></label>
                    <input id="date-from" type="date" className="form-input" value={dateFrom} onChange={e => { const value = e.target.value; setDateFrom(value); if (dateTo && dateTo < value) setDateTo(value); }} required disabled={isLocked} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="date-to">Date To <span className="text-danger">*</span></label>
                    <input id="date-to" type="date" min={dateFrom || undefined} className="form-input" value={dateTo} onChange={e => setDateTo(e.target.value)} required disabled={isLocked} />
                  </div>
                </div>

                {selectedType?.isHoursBased && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Time of Leave <span className="text-danger">*</span></label>
                      <div className="grid grid-cols-2 gap-3 mobile-form-grid">
                        <label className="text-sm">From<input aria-label="Time of Leave from" type="time" className="form-input mt-1" min={WORK_START} max={WORK_END} value={timeFrom} onChange={e => setTimeFrom(e.target.value)} required disabled={isLocked} /></label>
                        <label className="text-sm">To<input aria-label="Time of Leave to" type="time" className="form-input mt-1" min={WORK_START} max={WORK_END} value={timeTo} onChange={e => setTimeTo(e.target.value)} required disabled={isLocked} /></label>
                      </div>
                      <p className="text-xs text-muted mt-2">Work schedule: 7:00 AM–5:35 PM. Break allocations are 10 + 60 + 10 minutes across the staggered AM, lunch, and PM windows, plus 5 minutes for cleaning. Calculated time: <strong>{computedTimeHours.toFixed(2)} hours</strong>{isHdl ? ` · ${leaveBalanceDays(computedTimeHours).toFixed(4)} ${balanceDeductionLeaveTypeId ? (selectedDeductionBalance?.leaveTypeCode ?? '') + ' ' : ''}day(s)` : ''}</p>
                    </div>
                    {isUndertime && <div className="alert alert-warning"><AlertCircle size={16}/><span><strong>UT is unpaid time, not leave.</strong> It will appear as UT and will not deduct from SL, VL, or any leave balance.</span></div>}
                  </>
                )}

                {calculatedDays !== null && (
                  <div className="alert alert-info">
                    <Calendar size={16} />
                    <span>Total Counted Days: <strong>{calculatedDays} day(s)</strong> ({selectedType?.countWeekends ? 'including' : 'excluding'} non-workweek days; {selectedType?.countHolidays ? 'including' : 'excluding'} holidays)</span>
                  </div>
                )}

                {days.length > 0 && (
                  <div className="mt-4">
                    <label className="form-label">Daily Breakdown</label>
                    <div className="border border-[var(--border)] rounded-lg overflow-hidden">
                      <table className="w-full text-xs text-left mobile-record-table" role="table">
                        <thead className="bg-[var(--bg-secondary)] text-muted">
                          <tr>
                            <th className="px-4 py-3 font-medium" scope="col">Date</th>
                            <th className="px-4 py-3 font-medium" scope="col">Hours</th>
                            <th className="px-4 py-3 font-medium text-center w-32" scope="col">Paid Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                          {days.map((day, index) => (
                            <tr key={index} className="bg-[var(--bg-card)] hover:bg-[var(--bg-secondary)]/50 transition-colors">
                              <td className="px-4 py-3 font-medium" data-label="Date">
                                {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                              </td>
                              <td className="px-4 py-3" data-label="Hours">
                                <select 
                                  className="form-select text-xs py-1.5 px-2.5 h-8 w-32"
                                  value={day.hours}
                                  aria-label={`Leave hours for ${day.date}`}
                                  onChange={(e) => handleDayUpdate(index, 'hours', Number(e.target.value))}
                                  disabled={isLocked}
                                >
                                  <option value={8}>8 hrs</option>
                                  <option value={4}>4 hrs</option>
                                </select>
                                {day.hours === 4 && (
                                  <select 
                                    className="form-select !py-1 !px-2 !pr-8 !h-8 !text-sm !w-24 ml-2"
                                    value={day.halfDayTime || 'AM'}
                                    aria-label={`Half-day period for ${day.date}`}
                                    onChange={(e) => handleDayUpdate(index, 'halfDayTime', e.target.value)}
                                    disabled={isLocked}
                                  >
                                    <option value="AM">AM</option>
                                    <option value="PM">PM</option>
                                  </select>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center" data-label="Paid Status">
                                <div className="flex items-center justify-center w-full gap-2">
                                  <Checkbox 
                                    id={`paid-checkbox-${index}`}
                                    checked={day.isPaid}
                                    onCheckedChange={(checked) => handleDayUpdate(index, 'isPaid', !!checked)}
                                    disabled={isLocked}
                                    className="border-[rgba(255,255,255,0.4)]"
                                  />
                                  <Label 
                                    htmlFor={`paid-checkbox-${index}`}
                                    className="text-muted cursor-pointer"
                                  >
                                    {day.isPaid ? 'Paid' : 'Unpaid'}
                                  </Label>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="form-group mt-4">
                  {selectedType && !isSickLeave && leaderOptions?.requiresSelection && <div className="form-group">
                    <label className="form-label" htmlFor="selected-line-leader">Noted by — department line leader <span className="text-danger">*</span></label>
                    <select id="selected-line-leader" className="form-select" value={selectedLineLeaderId || ''} onChange={event => setSelectedLineLeaderId(Number(event.target.value))} required>
                      <option value="">Choose your line leader</option>
                      {leaderOptions.lineLeaders.map(leader => <option key={leader.id} value={leader.id}>{leader.fullName}</option>)}
                    </select>
                    <p className="text-xs text-muted mt-2">Your selected leader will note the request before Recommending and Approver. If you select the wrong leader, discuss it in the conversation tab, cancel the request, and file again with the correct leader.</p>
                    {leaderOptions.lineLeaders.length === 0 && <p role="alert" className="text-danger">No department line leaders configured. Contact HR before filing.</p>}
                  </div>}
                  <div className="flex items-center justify-between gap-3"><label className="form-label" htmlFor="leave-reason">Reason for Absence / Undertime <span className="text-danger">*</span></label><span className="text-[10px] text-muted">{reason.length}/500</span></div>
                  <textarea
                    id="leave-reason"
                    className="form-textarea"
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="Please provide a detailed reason for your leave..."
                    rows={4}
                    maxLength={500}
                    required
                    disabled={isLocked}
                  />
                </div>
              </div>
            </div>}

            {/* Attachments Drag and Drop */}
            {currentStep === 2 && <div data-tutorial="filing-attachments" className="glass-card mb-5 animate-slide-up">
              <div className="glass-card-header flex items-center gap-3 px-5 sm:px-6" style={{ justifyContent: 'flex-start' }}>
                <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0"><Paperclip size={18} /></div>
                <div className="min-w-0 text-left"><h2 className="m-0 text-base flex flex-wrap items-baseline gap-1">Supporting Documents {requiresSupportingDocument ? <span className="text-danger">*</span> : <span className="text-xs font-normal text-muted">(optional)</span>}</h2><p className="text-xs text-muted mt-0.5">Add medical certificates or other supporting files when applicable.</p></div>
              </div>
              <div className="glass-card-body px-5 py-5 sm:px-6 sm:py-6">
                
                {/* Dropzone */}
                {!leaveRequestId && (
                  <div 
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); fileInputRef.current?.click(); } }}
                    role="button"
                    tabIndex={0}
                    aria-label="Upload supporting documents"
                    className={`
                      relative p-6 sm:p-8 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all duration-300
                      ${isDragging ? 'border-[var(--primary)] bg-[var(--primary)]/10' : 'border-[var(--border)] bg-[var(--bg-secondary)] hover:border-[var(--primary)]/50'}
                    `}
                    style={{
                      boxShadow: isDragging ? '0 0 20px var(--primary)' : 'none',
                      transform: isDragging ? 'scale(1.02)' : 'scale(1)'
                    }}
                  >
                    <input
                      type="file"
                      multiple
                      ref={fileInputRef}
                      onChange={handleFileInput}
                      className="hidden"
                      style={{ display: 'none' }}
                      accept=".svg,.png,.jpg,.jpeg,.pdf,.docx"
                    />
                    <div className="w-12 h-12 rounded-full bg-[var(--bg-card)] shadow-sm flex items-center justify-center mb-4 text-[var(--primary)]">
                      <UploadCloud size={24} />
                    </div>
                    <p className="text-base font-semibold mb-1">Click to upload or drag and drop</p>
                    <p className="text-xs text-muted text-center max-w-sm">
                      SVG, PNG, JPG, PDF or DOCX (maximum 5 files, 10MB each)
                    </p>
                  </div>
                )}

                {/* Requirements Alert */}
                {selectedType && !leaveRequestId && <div className={`alert ${requiresSupportingDocument ? 'alert-warning' : 'alert-info'} mt-4`}><AlertCircle size={16}/><span>{attachmentPolicyMessage}</span></div>}

                {/* Independent Queue List */}
                {fileQueue.length > 0 && (
                  <div className="mt-6 space-y-3">
                    <h3 className="text-sm font-semibold mb-2">Files</h3>
                    {fileQueue.map((item) => (
                      <div key={item.id} className="file-queue-row flex items-center gap-4 p-3 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)] relative overflow-hidden group transition-all">
                        
                        {/* Progress Bar Background */}
                        {item.status === 'uploading' && (
                          <div 
                            className="absolute inset-0 bg-[var(--primary)]/5 origin-left transition-transform duration-300 ease-out z-0" 
                            style={{ transform: `scaleX(${item.progress / 100})` }}
                          />
                        )}

                        {/* Preview Icon/Image */}
                        <div className="w-10 h-10 shrink-0 rounded overflow-hidden bg-[var(--bg-card)] flex items-center justify-center z-10 relative">
                          {item.previewUrl ? (
                            <img src={item.previewUrl} alt="preview" className={`w-full h-full object-cover ${item.status === 'uploading' ? 'opacity-50' : ''}`} />
                          ) : (
                            <FileIcon size={20} className={`text-muted ${item.status === 'uploading' ? 'opacity-50' : ''}`} />
                          )}
                          {item.status === 'uploading' && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <RefreshCw size={18} className="text-[var(--primary)] animate-spin" />
                            </div>
                          )}
                        </div>

                        {/* File Details & Status */}
                        <div className="flex-1 min-w-0 z-10">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-medium truncate pr-4">{item.file.name}</p>
                            <span className="text-xs text-muted whitespace-nowrap">{(item.file.size / 1024 / 1024).toFixed(2)} MB</span>
                          </div>
                          
                          {/* Progress indicators / Error messages */}
                          <div className="flex items-center gap-2 text-xs">
                            {item.status === 'idle' && <span className="text-muted">Queued</span>}
                            {item.status === 'uploading' && (
                              <>
                                <span className="text-[var(--primary)] font-medium">Uploading... {item.progress}%</span>
                                <div className="h-1 flex-1 bg-[var(--border)] rounded-full overflow-hidden">
                                  <div className="h-full bg-[var(--primary)] rounded-full transition-all duration-300" style={{ width: `${item.progress}%` }} />
                                </div>
                              </>
                            )}
                            {item.status === 'success' && <span className="text-success flex items-center gap-1"><CheckCircle size={12} /> Complete</span>}
                            {item.status === 'error' && <span className="text-danger flex items-center gap-1"><XCircle size={12} /> {item.errorMessage}</span>}
                          </div>
                        </div>

                        {/* Actions (Remove / Retry) */}
                        <div className="file-queue-actions z-10 flex items-center gap-2">
                          {item.status === 'error' && (
                            <button 
                              type="button" 
                              onClick={() => retryUpload(item)}
                              className="btn btn-ghost btn-sm text-primary hover:bg-primary/10"
                              title="Retry Upload"
                            >
                              <RefreshCw size={16} /> Retry
                            </button>
                          )}
                          {!leaveRequestId && (
                            <button
                              type="button"
                              onClick={() => removeFile(item.id)}
                              className="file-remove p-1.5 text-muted hover:text-danger rounded-md hover:bg-danger/10 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                              title="Remove file"
                            >
                              <X size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>}

            {currentStep === 3 && <div data-tutorial="filing-review" className="glass-card mb-5 animate-slide-up">
              <div className="glass-card-header flex items-center gap-3 px-5 sm:px-6" style={{ justifyContent: 'flex-start' }}><div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0"><ListChecks size={18}/></div><div className="min-w-0 text-left"><h2 className="m-0 text-base">Review Your Request</h2><p className="text-xs text-muted mt-0.5">Confirm that everything is correct before submitting.</p></div></div>
              <div className="glass-card-body px-5 py-5 sm:px-6 sm:py-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                  <div><span className="form-label block">Type of Leave</span><strong>{selectedType?.code} — {selectedType?.description}</strong></div>
                  <div><span className="form-label block">{selectedType?.isHoursBased ? 'Time of Leave' : 'Duration'}</span><strong>{selectedType?.isHoursBased ? `${timeFrom}–${timeTo} · ${computedTimeHours.toFixed(2)} hours${isUndertime ? ' (unpaid UT; no leave deduction)' : ''}` : `${calculatedDays ?? 0} working day${calculatedDays === 1 ? '' : 's'}`}</strong></div>
                  <div><span className="form-label block">Date From</span><strong>{new Date(`${dateFrom}T00:00:00`).toLocaleDateString()}</strong></div>
                  <div><span className="form-label block">Date To</span><strong>{new Date(`${dateTo}T00:00:00`).toLocaleDateString()}</strong></div>
                </div>
                {!isSickLeave && leaderOptions?.requiresSelection && <p><strong>Noted by:</strong> {leaderOptions.lineLeaders.find(leader => leader.id === selectedLineLeaderId)?.fullName}</p>}
                <div className="p-4 rounded-lg border border-border bg-base/40"><span className="form-label block mb-1">Reason</span><p className="text-sm whitespace-pre-wrap">{reason}</p></div>
                <div className="p-4 rounded-lg border border-border"><div className="review-attachments flex items-center justify-between gap-3"><div><span className="form-label block mb-1">Supporting Documents {requiresSupportingDocument && <span className="text-danger">*</span>}</span><p className="text-xs text-muted">{fileQueue.length ? `${fileQueue.length} file${fileQueue.length === 1 ? '' : 's'} ready to upload` : 'No supporting documents attached'}</p><p className={`text-xs mt-1 ${requiresSupportingDocument ? 'text-warning' : 'text-muted'}`}>{attachmentPolicyMessage}</p></div><button type="button" className="btn btn-outline btn-sm shrink-0" onClick={() => setCurrentStep(2)}>Edit Attachments</button></div>{fileQueue.length > 0 && <div className="mt-3 space-y-2">{fileQueue.map(item => <div key={item.id} className="flex items-center gap-2 text-xs"><FileIcon size={14} className="text-primary"/><span className="truncate">{item.file.name}</span><span className="text-muted ml-auto">{(item.file.size / 1024 / 1024).toFixed(2)} MB</span></div>)}</div>}</div>
                <div className="alert alert-info"><AlertCircle size={16}/><span>{selectedType?.code.toUpperCase() === 'SL' ? 'Sick Leave goes to HR Review first for a fit-to-work assessment. HR may extend the dates during that review. For operators, it then goes to the designated department SL line leader, Recommending, and Approver. Other employees proceed to Recommending and Approver without a line leader stage.' : leaderOptions?.requiresSelection ? 'Your chosen department line leader notes this request, then it proceeds to Recommending and Approver.' : 'The request follows Noted by (if configured), Recommending (if configured), and Approver.'} All members assigned to an active stage receive the request; any one can decide. Monitor the approval history from My Requests.</span></div>
              </div>
            </div>}

            {/* Submit */}
            {error && <div className="alert alert-error mb-4"><AlertCircle size={16} />{error}</div>}

            <div data-tutorial="filing-actions" className="glass-card flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 p-4 sm:px-5 mt-5">
              <button type="button" className="btn btn-outline" onClick={() => currentStep === 1 ? navigate(-1) : setCurrentStep(currentStep === 3 ? 2 : 1)} disabled={isSubmitting || isUploadingFiles}>{currentStep === 1 ? 'Cancel' : <span className="flex items-center gap-1"><ChevronLeft size={16}/> Back</span>}</button>
              {currentStep === 1 && <button type="button" className="btn btn-primary btn-lg min-w-[180px]" onClick={goToAttachments}>Next: Attachments <ChevronRight size={16}/></button>}
              {currentStep === 2 && <button type="button" className="btn btn-primary btn-lg min-w-[180px]" onClick={goToReview}>Next: Review <ChevronRight size={16}/></button>}
              {currentStep === 3 && <button type="submit" className="btn btn-primary btn-lg min-w-[210px]" disabled={isSubmitting || isUploadingFiles}>{isSubmitting || isUploadingFiles ? <span className="flex items-center gap-2"><span className="spinner" style={{ width: 18, height: 18 }}></span>{isUploadingFiles ? 'Uploading Files...' : 'Submitting Request...'}</span> : <span className="flex items-center gap-2"><Send size={16}/> Submit Leave Request</span>}</button>}
            </div>
          </form>}
        </div>
      </div>
    </div>
  );
};

