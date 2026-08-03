import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LeaveAPI, type LeaveType, type LeaveBalance } from '../lib/api';
import { FileText, Calendar, Send, AlertCircle, Paperclip, UploadCloud, File as FileIcon, CheckCircle, XCircle, RefreshCw, X } from 'lucide-react';
import { useToast } from '../components/ToastProvider';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';

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
  const [selectedTypeId, setSelectedTypeId] = useState<number>(0);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [totalHours, setTotalHours] = useState<number>(0);
  const [halfDayTime, setHalfDayTime] = useState<string>('AM');
  const [reason, setReason] = useState('');
  
  // New File Queue State
  const [fileQueue, setFileQueue] = useState<FileQueueItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); 
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [leaveRequestId, setLeaveRequestId] = useState<number | null>(null);

  const [days, setDays] = useState<{ date: string; hours: number; isPaid: boolean; halfDayTime?: string }[]>([]);
  const [calculatedDays, setCalculatedDays] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
    // Cleanup previews on unmount
    return () => {
      setFileQueue(prev => {
        prev.forEach(item => {
          if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        });
        return prev;
      });
    };
  }, []);

  const loadData = async () => {
    try {
      const [types, bal] = await Promise.all([
        LeaveAPI.getTypes(),
        LeaveAPI.getBalance()
      ]);
      setLeaveTypes(types);
      setBalances(bal);
    } catch (e) { console.error(e); }
  };

  const selectedType = leaveTypes.find(t => t.id === selectedTypeId);
  const selectedBalance = balances.find(b => b.leaveTypeId === selectedTypeId);

  // Auto-calculate days when dates change
  useEffect(() => {
    if (dateFrom && dateTo && selectedType && !selectedType.isHoursBased) {
      const from = new Date(dateFrom);
      const to = new Date(dateTo);
      if (to >= from) {
        let count = 0;
        const generatedDays = [];
        for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
          if (d.getDay() !== 0 && d.getDay() !== 6) {
            count++;
            generatedDays.push({
              date: d.toISOString().split('T')[0],
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
  }, [dateFrom, dateTo, selectedTypeId]);

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

  const addFilesToQueue = (files: File[]) => {
    if (leaveRequestId) return;
    const newItems: FileQueueItem[] = files.map(file => {
      let previewUrl;
      if (file.type.startsWith('image/')) {
        previewUrl = URL.createObjectURL(file);
      }
      return {
        id: Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
        file,
        progress: 0,
        status: 'idle',
        previewUrl
      };
    });
    setFileQueue(prev => [...prev, ...newItems]);
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
    // Reset the input value so selecting the same file again triggers onChange
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (id: string) => {
    if (leaveRequestId) return; // Disallow removal if request is already created
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
      setTimeout(() => navigate('/my-requests'), 1500);
    } else {
      setIsUploadingFiles(false);
      toast.error('Some files failed to upload. You can retry them below.');
    }
  };

  const retryUpload = (item: FileQueueItem) => {
    if (leaveRequestId) {
      processUploadQueue(leaveRequestId, [item]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!selectedTypeId) return setError('Please select a leave type');
    if (!dateFrom || !dateTo) return setError('Please select date range');
    if (!reason.trim()) return setError('Please provide a reason');
    if (selectedType?.isHoursBased && totalHours <= 0) return setError('Please enter total hours');
    if (selectedType?.requiresAttachment && fileQueue.length === 0) return setError('This leave type requires supporting documents');

    setIsSubmitting(true);
    try {
      let reqId = leaveRequestId;
      
      // If we haven't created the request yet, create it.
      if (!reqId) {
        const result = await LeaveAPI.apply({
          leaveTypeId: selectedTypeId,
          dateFrom,
          dateTo,
          totalHours: selectedType?.isHoursBased ? totalHours : 0,
          halfDayTime: selectedType?.isHoursBased && totalHours === 4 ? halfDayTime : undefined,
          reason,
          days: selectedType?.isHoursBased ? undefined : days
        });
        reqId = result.id;
        setLeaveRequestId(reqId);
        toast.success(`Leave request filed successfully! (${result.totalDays} days)`);
      }

      if (reqId && fileQueue.length > 0) {
        await processUploadQueue(reqId, fileQueue);
      } else {
        setTimeout(() => navigate('/my-requests'), 1500);
      }
    } catch (err: any) {
      toast.error(err.response?.data || 'Failed to file leave request');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Determine if the form fields should be locked
  const isLocked = leaveRequestId !== null || isSubmitting || isUploadingFiles;

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1>File Leave Request</h1>
        <p>Submit a new leave of absence or undertime application</p>
      </div>

      <div className="page-body">
        <div style={{ maxWidth: 800 }}>
          {/* Form Header */}
          <div className="glass-card mb-6" style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(139,92,246,0.05))' }}>
            <div className="glass-card-body text-center py-8">
              <h2 className="text-xl font-bold mb-1">HIBLOW PHILIPPINES INC.</h2>
              <p className="text-muted text-sm">Leave of Absence / Undertime Application Form</p>
              <p className="text-xs text-muted mt-2">Date Filed: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Leave Type Selection */}
            <div className={`glass-card mb-6 ${isLocked ? 'opacity-80 pointer-events-none' : ''}`}>
              <div className="glass-card-header flex items-center">
                <FileText size={18} className="mr-2" />
                <h2 className="m-0">Leave Information</h2>
              </div>
              <div className="glass-card-body">
                <div className="form-group">
                  <label className="form-label">Type of Leave</label>
                  <select
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

                {selectedType && selectedBalance && selectedType.deductsFromBalance && (
                  <div className="alert alert-info mb-5">
                    <AlertCircle size={16} />
                    <span>Available Balance for {selectedType.code}: <strong>{selectedBalance.available.toFixed(1)} days</strong> (Credits: {selectedBalance.totalCredits}, Carry-Over: {selectedBalance.carryOver})</span>
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Date From</label>
                    <input type="date" className="form-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} required disabled={isLocked} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Date To</label>
                    <input type="date" className="form-input" value={dateTo} onChange={e => setDateTo(e.target.value)} required disabled={isLocked} />
                  </div>
                </div>

                {selectedType?.isHoursBased && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Number of Hours</label>
                      <input type="number" className="form-input" min="0.5" step="0.5" max="8" value={totalHours || ''} onChange={e => setTotalHours(Number(e.target.value))} required placeholder="Enter hours" disabled={isLocked} />
                    </div>
                    {totalHours === 4 && (
                      <div className="form-group">
                        <label className="form-label">Time of Leave</label>
                        <select className="form-select" value={halfDayTime} onChange={e => setHalfDayTime(e.target.value)} disabled={isLocked}>
                          <option value="AM">Morning (AM)</option>
                          <option value="PM">Afternoon (PM)</option>
                        </select>
                      </div>
                    )}
                  </>
                )}

                {calculatedDays !== null && (
                  <div className="alert alert-info">
                    <Calendar size={16} />
                    <span>Total Working Days: <strong>{calculatedDays} day(s)</strong> (excluding weekends)</span>
                  </div>
                )}

                {days.length > 0 && (
                  <div className="mt-4">
                    <label className="form-label">Daily Breakdown</label>
                    <div className="border border-[var(--border)] rounded-md overflow-hidden">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-[var(--bg-secondary)] text-muted">
                          <tr>
                            <th className="!pl-8 pr-4 py-2 font-medium">Date</th>
                            <th className="px-4 py-2 font-medium">Hours</th>
                            <th className="px-4 py-2 font-medium text-center w-32">Paid Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                          {days.map((day, index) => (
                            <tr key={index} className="bg-[var(--bg-card)] hover:bg-[var(--bg-secondary)]/50 transition-colors">
                              <td className="!pl-8 pr-4 py-3">
                                {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                              </td>
                              <td className="px-4 py-3">
                                <select 
                                  className="form-select !py-1 !px-2 !pr-8 !h-8 !text-sm !w-32"
                                  value={day.hours}
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
                                    onChange={(e) => handleDayUpdate(index, 'halfDayTime', e.target.value)}
                                    disabled={isLocked}
                                  >
                                    <option value="AM">AM</option>
                                    <option value="PM">PM</option>
                                  </select>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center">
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
                  <label className="form-label">Reason for Absence / Undertime</label>
                  <textarea
                    className="form-textarea"
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="Please provide a detailed reason for your leave..."
                    rows={4}
                    required
                    disabled={isLocked}
                  />
                </div>
              </div>
            </div>

            {/* Attachments Drag and Drop */}
            <div className="glass-card mb-6">
              <div className="glass-card-header flex items-center">
                <Paperclip size={18} className="mr-2" />
                <h2 className="m-0">Attachments</h2>
              </div>
              <div className="glass-card-body">
                <p className="text-sm text-muted mb-4">Upload supporting documents (medical certificates, etc.)</p>
                
                {/* Dropzone */}
                {!leaveRequestId && (
                  <div 
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`
                      relative p-8 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all duration-300
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
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    />
                    <div className="w-12 h-12 rounded-full bg-[var(--bg-card)] shadow-sm flex items-center justify-center mb-4 text-[var(--primary)]">
                      <UploadCloud size={24} />
                    </div>
                    <p className="text-base font-semibold mb-1">Click to upload or drag and drop</p>
                    <p className="text-xs text-muted text-center max-w-sm">
                      SVG, PNG, JPG, PDF or DOCX (max. 10MB)
                    </p>
                  </div>
                )}

                {/* Requirements Alert */}
                {selectedType?.requiresAttachment && fileQueue.length === 0 && !leaveRequestId && (
                  <div className="alert alert-warning mt-4">
                    <AlertCircle size={16} />
                    <span>This leave type requires supporting documents (e.g., medical certificate).</span>
                  </div>
                )}

                {/* Independent Queue List */}
                {fileQueue.length > 0 && (
                  <div className="mt-6 space-y-3">
                    <h3 className="text-sm font-semibold mb-2">Files</h3>
                    {fileQueue.map((item) => (
                      <div key={item.id} className="flex items-center gap-4 p-3 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)] relative overflow-hidden group transition-all">
                        
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
                        <div className="z-10 flex items-center gap-2">
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
                              className="p-1.5 text-muted hover:text-danger rounded-md hover:bg-danger/10 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
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
            </div>

            {/* Submit */}
            {error && <div className="alert alert-error mb-4"><AlertCircle size={16} />{error}</div>}

            <div className="flex items-center justify-between mt-8">
              {!leaveRequestId ? (
                <button type="button" className="btn btn-outline" onClick={() => navigate(-1)} disabled={isSubmitting}>Cancel</button>
              ) : (
                <button type="button" className="btn btn-outline" onClick={() => navigate('/my-requests')} disabled={isUploadingFiles}>
                  I'll fix it later
                </button>
              )}
              
              <button 
                type="submit" 
                className="btn btn-primary btn-lg min-w-[200px]" 
                disabled={isSubmitting || isUploadingFiles || (leaveRequestId !== null && fileQueue.every(f => f.status === 'success'))}
              >
                {isSubmitting || isUploadingFiles ? (
                  <span className="flex items-center gap-2">
                    <span className="spinner" style={{ width: 18, height: 18 }}></span> 
                    {isUploadingFiles ? 'Uploading Files...' : 'Submitting Request...'}
                  </span>
                ) : (
                  <span className="flex items-center gap-2"><Send size={16} /> Submit Leave Request</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
