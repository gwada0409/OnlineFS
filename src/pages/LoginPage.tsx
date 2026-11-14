import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AuthAPI } from '../lib/api';
import { Lock, User, Hash, Eye, EyeOff, ArrowRight, ArrowLeft, AlertTriangle } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [mode, setMode] = useState<'employee' | 'admin'>('employee');
  const [employeeID, setEmployeeID] = useState('');
  const [pin, setPin] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  
  const [showPin, setShowPin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);

  const employeeIdInputRef = useRef<HTMLInputElement>(null);
  const adminUserInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode === 'employee' && employeeIdInputRef.current) {
      employeeIdInputRef.current.focus();
    } else if (mode === 'admin' && adminUserInputRef.current) {
      adminUserInputRef.current.focus();
    }
  }, [mode]);

  const toggleMode = () => {
    setMode(prev => prev === 'employee' ? 'admin' : 'employee');
    setError('');
  };

  const checkCapsLock = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.getModifierState && e.getModifierState('CapsLock')) {
      setCapsLockOn(true);
    } else {
      setCapsLockOn(false);
    }
  };

  const formatEmployeeId = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 5);
    if (digits.length <= 2) {
      return digits;
    }
    return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  };

  const handleEmployeeIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmployeeID(formatEmployeeId(e.target.value));
    setError('');
  };

  const handleEmployeeLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeID) {
      setError('Employee ID is required.');
      setShakeKey(k => k + 1);
      return;
    }
    if (!/^\d{2}-\d{3}$/.test(employeeID)) {
      setError('Employee ID must be in XX-XXX format.');
      setShakeKey(k => k + 1);
      return;
    }
    if (!pin) {
      setError('PIN is required.');
      setShakeKey(k => k + 1);
      return;
    }
    if (!/^\d{6}$/.test(pin)) {
      setError('PIN must contain exactly 6 digits.');
      setShakeKey(k => k + 1);
      return;
    }
    
    setError('');
    setLoading(true);
    try {
      const res = await AuthAPI.employeeLogin({ employeeID, pin });
      login(res.token, res.user);
    } catch (err: any) {
      setError('Invalid login credentials. Please try again.');
      setShakeKey(k => k + 1);
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username) {
      setError('Username is required.');
      setShakeKey(k => k + 1);
      return;
    }
    if (!password) {
      setError('Password is required.');
      setShakeKey(k => k + 1);
      return;
    }
    
    setError('');
    setLoading(true);
    try {
      const res = await AuthAPI.login({ username, password });
      login(res.token, res.user);
    } catch (err: any) {
      setError('Invalid login credentials. Please try again.');
      setShakeKey(k => k + 1);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page w-full min-h-screen flex items-center justify-center p-4">
      <div className={`login-container-wrapper ${mode === 'admin' ? 'right-panel-active' : ''} ${error ? 'login-shake' : ''}`} key={shakeKey}>
        
        {/* Mobile Switcher (Visible only on mobile) */}
        <div className="mobile-switcher p-4">
          <button className={`btn flex-1 ${mode === 'employee' ? 'btn-primary' : 'btn-outline'}`} onClick={() => { setMode('employee'); setError(''); }} type="button">
            <User size={16} /> Employee
          </button>
          <button className={`btn flex-1 ${mode === 'admin' ? 'btn-primary' : 'btn-outline'}`} onClick={() => { setMode('admin'); setError(''); }} type="button">
            <Lock size={16} /> Admin
          </button>
        </div>

        {/* Employee Form (Left Side) */}
        <div className="login-form-container employee-container">
          <div className="max-w-[320px] w-full mx-auto">
            <div className="flex justify-center mb-6">
              <img src="/logo.png" alt="HIBLOW Logo" style={{ height: 45, objectFit: 'contain' }} />
            </div>
            <h1 className="text-3xl font-bold mb-2">Employee Portal</h1>
            <p className="text-muted text-sm mb-8">Sign in with your Company ID</p>

            <form onSubmit={handleEmployeeLogin} className="flex flex-col gap-4">
              <div className="form-group mb-0">
                <label className="form-label text-xs font-bold uppercase tracking-wide text-muted mb-1.5 block">Company ID Number</label>
                <div style={{ position: 'relative' }}>
                  <Hash size={16} className="text-muted" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                  <input ref={employeeIdInputRef} className="form-input w-full h-12 bg-base/50" style={{ paddingLeft: 36 }} value={employeeID} onChange={handleEmployeeIdChange} placeholder="e.g. 12-345" inputMode="numeric" maxLength={6} />
                </div>
              </div>
              <div className="form-group mb-0">
                <label className="form-label text-xs font-bold uppercase tracking-wide text-muted mb-1.5 block">6-Digit PIN</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} className="text-muted" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                  <input className="form-input w-full h-12 bg-base/50" style={{ paddingLeft: 36, paddingRight: 40 }} type={showPin ? "text" : "password"} value={pin} onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }} placeholder="Enter your 6-digit PIN" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="current-password" />
                  <button type="button" className="text-muted hover:text-primary transition-colors focus:outline-none" style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', padding: 8, cursor: 'pointer' }} onClick={() => setShowPin(!showPin)}>
                    {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <div className="flex justify-end mt-2">
                  <a href="#" className="text-xs text-muted hover:text-primary transition-colors">Forgot PIN?</a>
                </div>
              </div>
              {error && mode === 'employee' && <div className="text-sm text-danger bg-danger/10 p-3 rounded-md border border-danger/20 text-center">{error}</div>}
              <button className="btn w-full h-12 text-base font-bold mt-2 shadow-sm" type="submit" disabled={loading} style={{ background: '#10b981', borderColor: '#10b981', color: 'white' }}>
                {loading ? <span className="spinner w-5 h-5 border-2"></span> : 'Sign In'}
              </button>
            </form>
          </div>
        </div>

        {/* Admin Form (Right Side) */}
        <div className="login-form-container admin-container">
          <div className="max-w-[320px] w-full mx-auto">
            <div className="flex justify-center mb-6">
              <img src="/logo.png" alt="HIBLOW Logo" style={{ height: 45, objectFit: 'contain' }} />
            </div>
            <h1 className="text-3xl font-bold mb-2">Admin Access</h1>
            <p className="text-muted text-sm mb-8">Manage employees and system settings</p>

            <form onSubmit={handleAdminLogin} className="flex flex-col gap-4">
              <div className="form-group mb-0">
                <label className="form-label text-xs font-bold uppercase tracking-wide text-muted mb-1.5 block">Username</label>
                <div style={{ position: 'relative' }}>
                  <User size={16} className="text-muted" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                  <input ref={adminUserInputRef} className="form-input w-full h-12 bg-base/50" style={{ paddingLeft: 36 }} value={username} onChange={e => { setUsername(e.target.value); setError(''); }} placeholder="Enter username" />
                </div>
              </div>
              <div className="form-group mb-0">
                <label className="form-label text-xs font-bold uppercase tracking-wide text-muted mb-1.5 block">Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} className="text-muted" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                  <input className="form-input w-full h-12 bg-base/50" style={{ paddingLeft: 36, paddingRight: 40 }} type={showPassword ? "text" : "password"} value={password} onChange={e => { setPassword(e.target.value); setError(''); }} onKeyUp={checkCapsLock} onKeyDown={checkCapsLock} placeholder="Enter your password" />
                  <button type="button" className="text-muted hover:text-primary transition-colors focus:outline-none" style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', padding: 8, cursor: 'pointer' }} onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              {capsLockOn && mode === 'admin' && (
                <div className="text-xs text-warning flex items-center gap-1 mt-0 -mb-2">
                  <AlertTriangle size={14} /> Caps Lock is ON
                </div>
              )}
              {error && mode === 'admin' && <div className="text-sm text-danger bg-danger/10 p-3 rounded-md border border-danger/20 text-center">{error}</div>}
              <button className="btn w-full h-12 text-base font-bold mt-2 shadow-sm" type="submit" disabled={loading} style={{ background: '#3b82f6', borderColor: '#3b82f6', color: 'white' }}>
                {loading ? <span className="spinner w-5 h-5 border-2"></span> : 'Sign In'}
              </button>
            </form>
          </div>
        </div>

        {/* Overlay Container */}
        <div className="login-overlay-container">
          <div className="login-overlay-inner">
            <div className="login-overlay">
              <div className="overlay-panel overlay-left text-white">
                <div className="mb-6 opacity-100">
                  <img src="/app_icon.png" alt="Logo" style={{ width: 64, height: 64, objectFit: 'contain', margin: '0 auto' }} />
                </div>
                <h2 className="text-4xl font-bold mb-4 tracking-tight">Leave System</h2>
                <p className="text-base opacity-80 max-w-[260px] leading-relaxed">
                  System administration portal for managing employees, leave balances, and settings.
                </p>
              </div>
              <div className="overlay-panel overlay-right text-white">
                <div className="mb-6 opacity-100">
                  <img src="/app_icon.png" alt="Logo" style={{ width: 64, height: 64, objectFit: 'contain', margin: '0 auto' }} />
                </div>
                <h2 className="text-4xl font-bold mb-4 tracking-tight">Leave System</h2>
                <p className="text-base opacity-80 max-w-[260px] leading-relaxed">
                  Welcome back! Log in to file your leave and view your leave balances.
                </p>
              </div>
            </div>
          </div>
          
          <button className="login-toggle-btn" onClick={toggleMode} aria-label="Toggle Login Mode">
            {mode === 'employee' ? <ArrowLeft size={24} strokeWidth={2.5} /> : <ArrowRight size={24} strokeWidth={2.5} />}
          </button>
        </div>

      </div>
    </div>
  );
};
