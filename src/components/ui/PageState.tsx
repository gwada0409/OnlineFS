import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export const PageLoading: React.FC<{ label?: string }> = ({ label = 'Loading' }) => (
  <div className="loading-spinner min-h-[240px]" role="status" aria-live="polite"><div className="spinner"/><span className="sr-only">{label}</span></div>
);

export const PageError: React.FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => (
  <div className="empty-state min-h-[240px]" role="alert">
    <AlertCircle size={38}/><h3>Unable to load this view</h3><p>{message}</p>
    <button type="button" className="btn btn-outline" onClick={onRetry}><RefreshCw size={15}/> Retry</button>
  </div>
);
