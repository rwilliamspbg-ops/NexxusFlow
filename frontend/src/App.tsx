import { useState, useEffect, useRef } from 'react';
import { Shield, Activity, RefreshCw, Trash2, Key, Copy, Check, ExternalLink, Eye, EyeOff, X, Info, Clock, AlertCircle, AlertTriangle } from 'lucide-react';

const API_BASE = 'http://localhost:8080';

const decodePayload = (jwt: string): Record<string, any> | null => {
  try {
    const parts = jwt.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  admin: 'Full access. Admin claim with permissions to invoke state mutations and bypass standard security restrictions.',
  operator: 'Read-write access. Operator claim allowed to trigger actions but subject to rate limiting.',
  viewer: 'Read-only access. Viewer claim restricted from executing state mutations or performing administrative tasks.',
};

const ROLE_BADGES: Record<string, { label: string, colorClass: string }> = {
  admin: {
    label: 'Tier 1 - Full Access',
    colorClass: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
  },
  operator: {
    label: 'Tier 2 - Write Access',
    colorClass: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
  },
  viewer: {
    label: 'Tier 3 - Read Only',
    colorClass: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
  },
};

const getTokenExpirationInfo = (jwt: string): { label: string; isExpired: boolean } | null => {
  const payload = decodePayload(jwt);
  if (!payload || typeof payload.exp !== 'number') return null;
  const now = Math.floor(Date.now() / 1000);
  const diffSec = payload.exp - now;
  if (diffSec <= 0) {
    return { label: 'Token Expired', isExpired: true };
  }
  const mins = Math.floor(diffSec / 60);
  if (mins < 1) {
    return { label: 'Expires in < 1m', isExpired: false };
  }
  if (mins < 60) {
    return { label: `Expires in ${mins}m`, isExpired: false };
  }
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return { label: remMins > 0 ? `Expires in ${hours}h ${remMins}m` : `Expires in ${hours}h`, isExpired: false };
};

function App() {
  const [token, setToken] = useState<string>('');
  const [showToken, setShowToken] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedClaims, setCopiedClaims] = useState(false);
  const [copiedSegment, setCopiedSegment] = useState<string | null>(null);
  const [activeSegment, setActiveSegment] = useState<string | null>(null);
  const [userId, setUserId] = useState('student_01');
  const [role, setRole] = useState('admin');
  const [metrics, setMetrics] = useState<any>(null);
  const [status, setStatus] = useState('Idle');
  const [isIssuing, setIsIssuing] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [isOffline, setIsOffline] = useState(false);
  const [isRefreshingMetrics, setIsRefreshingMetrics] = useState(false);
  const timeoutRef = useRef<any>(null);
  const userIdInputRef = useRef<HTMLInputElement | null>(null);
  const helpDialogRef = useRef<HTMLDivElement | null>(null);
  const helpTriggerRef = useRef<HTMLButtonElement | null>(null);
  const helpCloseButtonRef = useRef<HTMLButtonElement | null>(null);

  const isRevoked = status.toLowerCase().includes('revoked');
  const trimmedUserId = userId.trim();
  const isUserEmpty = trimmedUserId === '';
  const hasSpaces = userId !== trimmedUserId;
  const progressPercent = Math.min((userId.length / 128) * 100, 100);
  const barColor = userId.length === 128
    ? 'bg-rose-500 animate-pulse'
    : userId.length >= 110
    ? 'bg-amber-500'
    : 'bg-emerald-500';

  const fetchMetrics = async (isManual = false) => {
    if (isManual) {
      setIsRefreshingMetrics(true);
    }
    try {
      const res = await fetch(API_BASE + '/metrics/snapshot');
      const data = await res.json();
      setMetrics(data);
      setIsOffline(false);
      if (isManual) {
        setAnnouncement('Metrics refreshed successfully.');
      }
    } catch (e) {
      console.error('Failed to fetch metrics', e);
      setIsOffline(true);
      if (isManual) {
        setAnnouncement('Failed to refresh metrics. Backend may be offline.');
      }
    } finally {
      if (isManual) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setIsRefreshingMetrics(false), 300);
      }
    }
  };

  useEffect(() => {
    fetchMetrics();
    const timer = setInterval(() => fetchMetrics(false), 2000);
    return () => {
      clearInterval(timer);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (showHelp) {
      helpCloseButtonRef.current?.focus();
    }
  }, [showHelp]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        showHelp &&
        helpDialogRef.current &&
        !helpDialogRef.current.contains(event.target as Node)
      ) {
        const target = event.target as HTMLElement;
        if (!target.closest('[aria-label="Toggle keyboard shortcuts help"]')) {
          setShowHelp(false);
          setAnnouncement("Keyboard shortcuts menu closed");
          helpTriggerRef.current?.focus();
        }
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showHelp]);

  const handleAuth = async () => {
    setStatus('Issuing Token...');
    setAnnouncement('Issuing new JSON Web Token for User ' + userId + ' with role ' + role);
    setIsIssuing(true);
    try {
      const res = await fetch(API_BASE + '/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, role }),
      });
      const data = await res.json();
      if (data.token) {
        setToken(data.token);
        setStatus('Token Issued');
        setAnnouncement('Token successfully issued for user ' + userId);
      } else {
        setStatus('Error: ' + data.error);
        setAnnouncement('Error issuing token: ' + data.error);
      }
    } catch {
      setStatus('Connection Failed');
      setAnnouncement('Connection failed while issuing token');
    } finally {
      setIsIssuing(false);
    }
  };

  const handleRevoke = async () => {
    if (!token) return;
    setStatus('Revoking...');
    setAnnouncement('Revoking active token');
    setIsRevoking(true);
    try {
      const res = await fetch(API_BASE + '/revoke', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token },
      });
      const data = await res.json();
      const nextStatus = data.status || data.error;
      setStatus(nextStatus);
      setAnnouncement('Token revocation outcome: ' + nextStatus);
    } catch {
      setStatus('Revocation Failed');
      setAnnouncement('Revocation failed due to network error');
    } finally {
      setIsRevoking(false);
    }
  };

  const handleCopy = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setAnnouncement('Token copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy token to clipboard', e);
    }
  };

  const handleCopyClaims = async () => {
    if (!token) return;
    try {
      const decoded = decodePayload(token);
      if (!decoded) {
        setAnnouncement('Cannot copy claims: Token payload could not be decoded');
        return;
      }
      await navigator.clipboard.writeText(JSON.stringify(decoded, null, 2));
      setCopiedClaims(true);
      setAnnouncement('Decoded payload claims copied to clipboard');
      setTimeout(() => setCopiedClaims(false), 2000);
    } catch (e) {
      console.error('Failed to copy claims to clipboard', e);
    }
  };

  const handleCopySegment = async (index: number, name: string) => {
    if (!token) return;
    const parts = token.split('.');
    if (parts.length !== 3 || !parts[index]) return;
    try {
      await navigator.clipboard.writeText(parts[index]);
      setCopiedSegment(name);
      setAnnouncement(`${name} segment copied to clipboard`);
      setTimeout(() => setCopiedSegment(null), 2000);
    } catch (e) {
      console.error(`Failed to copy ${name} segment`, e);
    }
  };

  const handleClear = () => {
    if (!token) return;
    setToken('');
    setStatus('Idle');
    setAnnouncement('Token cleared and system status reset to Idle');
    userIdInputRef.current?.focus();
  };

  const stateRef = useRef({
    token,
    isIssuing,
    isRevoking,
    isRefreshingMetrics,
    showToken,
    setShowToken,
    showHelp,
    setShowHelp,
    setAnnouncement,
    handleAuth,
    handleRevoke,
    handleCopy,
    handleClear,
    handleCopyClaims,
    fetchMetrics,
    isUserEmpty,
  });
  stateRef.current = {
    token,
    isIssuing,
    isRevoking,
    isRefreshingMetrics,
    showToken,
    setShowToken,
    showHelp,
    setShowHelp,
    setAnnouncement,
    handleAuth,
    handleRevoke,
    handleCopy,
    handleClear,
    handleCopyClaims,
    fetchMetrics,
    isUserEmpty,
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const {
        token,
        isIssuing,
        isRevoking,
        isRefreshingMetrics,
        showToken,
        setShowToken,
        showHelp,
        setShowHelp,
        setAnnouncement,
        handleAuth,
        handleRevoke,
        handleCopy,
        handleClear,
        handleCopyClaims,
        fetchMetrics,
        isUserEmpty,
      } = stateRef.current;
      if (e.key === 'Escape' && showHelp) {
        e.preventDefault();
        setShowHelp(false);
        setAnnouncement("Keyboard shortcuts menu closed");
        helpTriggerRef.current?.focus();
        return;
      }
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === 'i') {
          e.preventDefault();
          if (isIssuing || isRevoking) {
            setAnnouncement("Cannot issue token while an action is in progress");
          } else if (isUserEmpty) {
            setAnnouncement("Cannot issue token: User ID is empty");
            userIdInputRef.current?.focus();
          } else {
            handleAuth();
          }
        } else if (key === 'r') {
          e.preventDefault();
          if (isIssuing || isRevoking) {
            setAnnouncement("Cannot revoke token while an action is in progress");
          } else if (!token) {
            setAnnouncement("Cannot revoke token: No active token available");
          } else {
            handleRevoke();
          }
        } else if (key === 'c') {
          e.preventDefault();
          if (!token) {
            setAnnouncement("Cannot copy token: No active token available");
          } else {
            handleCopy();
          }
        } else if (key === 'x') {
          e.preventDefault();
          if (!token) {
            setAnnouncement("Cannot clear token: No active token available");
          } else {
            handleClear();
          }
        } else if (key === 'p') {
          e.preventDefault();
          if (!token) {
            setAnnouncement("Cannot copy claims: No active token available");
          } else {
            handleCopyClaims();
          }
        } else if (key === 'm' && !isRefreshingMetrics) {
          e.preventDefault();
          fetchMetrics(true);
        } else if (key === 'v') {
          e.preventDefault();
          if (!token) {
            setAnnouncement("Cannot toggle token visibility: No active token available");
          } else {
            const nextShow = !showToken;
            setShowToken(nextShow);
            setAnnouncement(nextShow ? "Raw JWT shown" : "Raw JWT hidden");
          }
        } else if (key === 'k') {
          e.preventDefault();
          const nextHelp = !showHelp;
          setShowHelp(nextHelp);
          setAnnouncement(nextHelp ? "Keyboard shortcuts menu opened" : "Keyboard shortcuts menu closed");
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const renderTokenParts = (t: string) => {
    if (!showToken) return t.length <= 24 ? t : `${t.slice(0, 12)}...${t.slice(-12)}`;
    const parts = t.split('.');
    if (parts.length !== 3) return t;
    const isHeaderActive = activeSegment === 'Header' || copiedSegment === 'Header';
    const isPayloadActive = activeSegment === 'Payload' || copiedSegment === 'Payload';
    const isSignatureActive = activeSegment === 'Signature' || copiedSegment === 'Signature';

    return (
      <>
        <span className={`text-rose-400 font-semibold transition-all duration-300 ${isHeaderActive ? 'bg-rose-500/20 ring-1 ring-rose-400/60 rounded px-1 shadow-sm shadow-rose-500/10' : ''}`} title="Header: Algorithm & Type">{parts[0]}</span>
        <span className="text-slate-500">.</span>
        <span className={`text-indigo-400 font-semibold transition-all duration-300 ${isPayloadActive ? 'bg-indigo-500/20 ring-1 ring-indigo-400/60 rounded px-1 shadow-sm shadow-indigo-500/10' : ''}`} title="Payload: Claims & Data">{parts[1]}</span>
        <span className="text-slate-500">.</span>
        <span className={`text-cyan-400 font-semibold transition-all duration-300 ${isSignatureActive ? 'bg-cyan-500/20 ring-1 ring-cyan-400/60 rounded px-1 shadow-sm shadow-cyan-500/10' : ''}`} title="Signature: Security Verification Key">{parts[2]}</span>
      </>
    );
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8 font-sans">
      <div className="sr-only" aria-live="polite" role="status">
        {announcement}
      </div>
      <header className="max-w-6xl mx-auto flex justify-between items-center mb-12">
        <div className="flex items-center gap-3">
          <Shield className="w-10 h-10 text-emerald-400" aria-hidden="true" />
          <h1 className="text-3xl font-bold tracking-tight">NexxusFlow <span className="text-emerald-400">JWT Lab</span></h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <button
              ref={helpTriggerRef}
              type="button"
              onClick={() => {
                const nextHelp = !showHelp;
                setShowHelp(nextHelp);
                setAnnouncement(nextHelp ? "Keyboard shortcuts menu opened" : "Keyboard shortcuts menu closed");
              }}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 px-3 py-1.5 rounded-lg border border-slate-700 flex items-center gap-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:ring-emerald-500 focus-visible:outline-none"
              aria-expanded={showHelp}
              aria-haspopup="true"
              aria-label="Toggle keyboard shortcuts help"
            >
              <span>Shortcuts</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-sans font-medium text-slate-400 bg-slate-900 border border-slate-700 rounded" aria-hidden="true">Alt+K</kbd>
            </button>
            {showHelp && (
              <div
                ref={helpDialogRef}
                className="absolute right-0 mt-2 w-72 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-4 z-50 text-xs text-slate-300"
                role="dialog"
                aria-modal="true"
                aria-label="Keyboard Shortcuts"
              >
                <div className="font-semibold text-slate-200 mb-3 text-sm flex justify-between items-center">
                  <span>Keyboard Shortcuts</span>
                  <button
                    ref={helpCloseButtonRef}
                    onClick={() => {
                      setShowHelp(false);
                      setAnnouncement("Keyboard shortcuts menu closed");
                      helpTriggerRef.current?.focus();
                    }}
                    className="text-slate-400 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:text-emerald-400 text-lg leading-none p-1 rounded"
                    aria-label="Close shortcuts help"
                  >
                    &times;
                  </button>
                </div>
                <div className="space-y-2.5" role="list" aria-label="Keyboard shortcuts list">
                  <div className="flex justify-between items-center" role="listitem"><span>Issue Token</span><kbd className="bg-slate-950 px-1.5 py-0.5 border border-slate-700 rounded font-mono text-[10px]">Alt+I</kbd></div>
                  <div className="flex justify-between items-center" role="listitem"><span>Revoke Token</span><kbd className="bg-slate-950 px-1.5 py-0.5 border border-slate-700 rounded font-mono text-[10px]">Alt+R</kbd></div>
                  <div className="flex justify-between items-center" role="listitem"><span>Copy Token</span><kbd className="bg-slate-950 px-1.5 py-0.5 border border-slate-700 rounded font-mono text-[10px]">Alt+C</kbd></div>
                  <div className="flex justify-between items-center" role="listitem"><span>Clear Token</span><kbd className="bg-slate-950 px-1.5 py-0.5 border border-slate-700 rounded font-mono text-[10px]">Alt+X</kbd></div>
                  <div className="flex justify-between items-center" role="listitem"><span>Copy Decoded Claims</span><kbd className="bg-slate-950 px-1.5 py-0.5 border border-slate-700 rounded font-mono text-[10px]">Alt+P</kbd></div>
                  <div className="flex justify-between items-center" role="listitem"><span>Toggle JWT Visibility</span><kbd className="bg-slate-950 px-1.5 py-0.5 border border-slate-700 rounded font-mono text-[10px]">Alt+V</kbd></div>
                  <div className="flex justify-between items-center" role="listitem"><span>Refresh Metrics</span><kbd className="bg-slate-950 px-1.5 py-0.5 border border-slate-700 rounded font-mono text-[10px]">Alt+M</kbd></div>
                  <div className="flex justify-between items-center text-slate-400" role="listitem"><span>Toggle This Help</span><kbd className="bg-slate-950 px-1.5 py-0.5 border border-slate-700 rounded font-mono text-[10px]">Alt+K</kbd></div>
                </div>
              </div>
            )}
          </div>
          <div
            title={`Current System Status: ${status}`}
            className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-300 ${
              status === 'Issuing Token...' || status === 'Revoking...'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : status.toLowerCase().includes('failed') || status.toLowerCase().includes('error') || status.toLowerCase().includes('revoked')
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                : status === 'Token Issued'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-slate-800 border-slate-700 text-slate-300'
            }`}
          >
            {status === 'Issuing Token...' || status === 'Revoking...' ? (
              <RefreshCw className="w-4 h-4 animate-spin text-amber-400" aria-hidden="true" />
            ) : status.toLowerCase().includes('failed') || status.toLowerCase().includes('error') ? (
              <Activity className="w-4 h-4 text-rose-400 animate-bounce" style={{ animationDuration: '2s' }} aria-hidden="true" />
            ) : status.toLowerCase().includes('revoked') ? (
              <Trash2 className="w-4 h-4 text-rose-400" aria-hidden="true" />
            ) : status === 'Token Issued' ? (
              <Check className="w-4 h-4 text-emerald-400" aria-hidden="true" />
            ) : (
              <Activity className="w-4 h-4 text-emerald-400 animate-pulse" aria-hidden="true" />
            )}
            <span className="text-sm font-medium" role="status" aria-live="polite">System Status: {status}</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <Key className="w-5 h-5 text-emerald-400" aria-hidden="true" /> Token Management
          </h2>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (isIssuing || isRevoking) return;
              if (isUserEmpty) {
                setAnnouncement('Cannot issue token: User ID is empty');
                userIdInputRef.current?.focus();
                return;
              }
              handleAuth();
            }}
            className="mb-6"
          >
            <div className="space-y-4 mb-6">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label htmlFor="userId" className="block text-sm font-medium text-slate-400">
                    User ID <span className="text-rose-500" aria-hidden="true">*</span>
                  </label>
                  <span
                    className={`text-xs transition-colors duration-200 ${
                      userId.length === 128
                        ? 'text-rose-500 font-semibold animate-pulse'
                        : userId.length >= 110
                        ? 'text-amber-500 font-medium'
                        : 'text-slate-500'
                    }`}
                    aria-live="polite"
                    aria-label={`User ID character count: ${userId.length} out of 128 limit`}
                  >
                    {userId.length}/128
                  </span>
                </div>
                <div className="relative w-full">
                  <input
                    id="userId"
                    ref={userIdInputRef}
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    maxLength={128}
                    required
                    aria-required="true"
                    placeholder="e.g., student_01"
                    aria-describedby="userId-helper userId-validation"
                    className={`w-full bg-slate-900 border rounded-lg pl-4 pr-10 py-2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 focus-visible:outline-none outline-none transition-all duration-150 ${
                      isUserEmpty
                        ? 'border-rose-500 focus-visible:ring-rose-500'
                        : hasSpaces
                        ? 'border-amber-500 focus-visible:ring-amber-500'
                        : 'border-slate-700 focus-visible:ring-emerald-500'
                    }`}
                  />
                  {userId && (
                    <button
                      type="button"
                      onClick={() => {
                        setUserId('');
                        setAnnouncement('User ID cleared');
                        userIdInputRef.current?.focus();
                      }}
                      aria-label="Clear User ID"
                      title="Clear User ID"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded p-0.5"
                    >
                      <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
                {/* Visual character-count progress bar */}
                <div className="w-full bg-slate-950 h-1 rounded-full mt-1.5 overflow-hidden border border-slate-800/80" aria-hidden="true">
                  <div
                    className={`h-full transition-all duration-300 ${barColor}`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p id="userId-helper" className="text-xs text-slate-500 mt-1.5">
                  The subject claim (sub) that uniquely identifies this user in the issued token.
                </p>
                <div id="userId-validation" className="mt-1.5 flex items-center gap-1.5 text-xs font-medium" aria-live="polite">
                  {isUserEmpty ? (
                    <span className="text-rose-400 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      User ID cannot be empty or only spaces.
                    </span>
                  ) : hasSpaces ? (
                    <span className="text-amber-400 flex items-center gap-1.5 flex-wrap">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>Leading/trailing spaces will be trimmed by the server.</span>
                      <button
                        type="button"
                        onClick={() => {
                          setUserId(trimmedUserId);
                          setAnnouncement('User ID whitespace trimmed');
                          userIdInputRef.current?.focus();
                        }}
                        aria-label="Trim leading and trailing spaces from User ID"
                        title="Trim leading and trailing spaces"
                        className="ml-1 px-1.5 py-0.5 text-[10px] font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded transition-colors focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-800 focus-visible:ring-amber-400 focus-visible:outline-none"
                      >
                        Trim now
                      </button>
                    </span>
                  ) : (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      User ID format is valid.
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-2" role="group" aria-label="User ID quick fill shortcuts">
                  <span className="text-xs text-slate-500 font-medium">Quick fill:</span>
                  {['student_01', 'operator_99', 'admin_root'].map((id) => {
                    const matchedRole = id === 'student_01' ? 'viewer' : id === 'operator_99' ? 'operator' : 'admin';
                    const isActive = userId === id && role === matchedRole;
                    const roleLabel = matchedRole === 'viewer' ? 'Viewer' : matchedRole === 'operator' ? 'Operator' : 'Admin';
                    return (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => {
                          setUserId(id);
                          setRole(matchedRole);
                          const roleDesc = ROLE_DESCRIPTIONS[matchedRole] || '';
                          setAnnouncement(`User ID quick-filled to ${id} and synchronized role to ${matchedRole}. ${roleDesc}`);
                          userIdInputRef.current?.focus();
                        }}
                        aria-label={`Quick fill User ID as ${id} with ${roleLabel} role`}
                        title={`Quick fill ${id} (${roleLabel} role)`}
                        className={`text-xs px-2 py-0.5 rounded border transition-colors focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-800 focus-visible:ring-emerald-500 focus-visible:outline-none ${
                          isActive
                            ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 font-medium'
                            : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-emerald-400 border-slate-700/60'
                        }`}
                      >
                        {id} <span className="text-[10px] opacity-75 font-normal">({roleLabel})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label htmlFor="role" className="block text-sm font-medium text-slate-400">Role</label>
                  <div
                    key={role}
                    role="status"
                    aria-live="polite"
                    className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full border transition-all duration-300 ${
                      ROLE_BADGES[role]?.colorClass || 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    {ROLE_BADGES[role]?.label || 'Pending'}
                  </div>
                </div>
                <select
                  id="role"
                  value={role}
                  onChange={(e) => {
                    const nextRole = e.target.value;
                    setRole(nextRole);
                    const desc = ROLE_DESCRIPTIONS[nextRole] || '';
                    setAnnouncement(`Role changed to ${nextRole}. ${desc}`);
                  }}
                  aria-describedby="role-helper"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 focus-visible:ring-emerald-500 focus-visible:outline-none outline-none transition-all duration-150"
                >
                  <option value="admin">Admin (Tier 1 - Full Access)</option>
                  <option value="operator">Operator (Tier 2 - Write Access)</option>
                  <option value="viewer">Viewer (Tier 3 - Read Only)</option>
                </select>
                <p id="role-helper" className="text-xs text-slate-500 mt-1 transition-all duration-300">
                  {ROLE_DESCRIPTIONS[role] || 'Assigned permissions role added to the JWT payload claims for role-based access control.'}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isIssuing || isRevoking || isUserEmpty}
                title={isUserEmpty ? "Cannot issue token: User ID is empty" : isIssuing || isRevoking ? "Action in progress" : "Issue Token (Alt + I)"}
                aria-keyshortcuts="Alt+I"
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 focus-visible:ring-emerald-500 focus-visible:outline-none"
              >
                <RefreshCw className={`w-4 h-4 ${isIssuing ? 'animate-spin' : ''}`} aria-hidden="true" />
                <span>{isIssuing ? 'Issuing...' : 'Issue Token'}</span>
                <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-sans font-medium text-slate-300 bg-slate-900/40 border border-slate-500/30 rounded" aria-hidden="true">Alt+I</kbd>
              </button>
              <button
                type="button"
                onClick={handleRevoke}
                disabled={!token || isIssuing || isRevoking}
                title={!token ? "No active token to revoke" : isIssuing || isRevoking ? "Action in progress" : "Revoke Token (Alt + R)"}
                aria-keyshortcuts="Alt+R"
                className="flex-1 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 focus-visible:ring-rose-500 focus-visible:outline-none"
              >
                <Trash2 className={`w-4 h-4 ${isRevoking ? 'animate-pulse' : ''}`} aria-hidden="true" />
                <span>{isRevoking ? 'Revoking...' : 'Revoke'}</span>
                <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-sans font-medium text-slate-300 bg-slate-900/40 border border-slate-500/30 rounded" aria-hidden="true">Alt+R</kbd>
              </button>
            </div>
          </form>

          {token ? (
            <div className="mt-6 space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <div className="flex items-center gap-2">
                    <label htmlFor="raw-token-container" className="block text-sm font-medium text-slate-400">
                      {isRevoked ? 'Revoked JWT' : 'Active JWT'}
                    </label>
                    {isRevoked && (
                      <span
                        role="status"
                        aria-live="polite"
                        className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full border bg-rose-500/10 border-rose-500/30 text-rose-400"
                      >
                        Revoked
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowToken(!showToken);
                        setAnnouncement(showToken ? "Raw JWT hidden" : "Raw JWT shown");
                      }}
                      aria-expanded={showToken}
                      aria-controls="raw-token-container"
                      aria-keyshortcuts="Alt+V"
                      title={showToken ? "Hide raw JWT (Alt + V)" : "Show raw JWT (Alt + V)"}
                      className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 px-2.5 py-1 rounded border border-slate-700 flex items-center gap-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 focus-visible:ring-emerald-500 focus-visible:outline-none"
                      aria-label={showToken ? "Hide raw JWT (Alt + V)" : "Show raw JWT (Alt + V)"}
                    >
                      {showToken ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Hide</span>
                          <kbd className="hidden sm:inline-block px-1 py-0.5 text-[8px] font-sans font-medium text-slate-400 bg-slate-900 border border-slate-700 rounded" aria-hidden="true">Alt+V</kbd>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Show</span>
                          <kbd className="hidden sm:inline-block px-1 py-0.5 text-[8px] font-sans font-medium text-slate-400 bg-slate-900 border border-slate-700 rounded" aria-hidden="true">Alt+V</kbd>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleCopy}
                      aria-keyshortcuts="Alt+C"
                      className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 px-2.5 py-1 rounded border border-slate-700 flex items-center gap-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 focus-visible:ring-emerald-500 focus-visible:outline-none"
                      aria-label={copied ? "Token copied to clipboard" : "Copy token to clipboard (Alt + C)"}
                      title="Copy token to clipboard (Alt + C)"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                          <span className="text-emerald-400 font-medium">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Copy</span>
                          <kbd className="hidden sm:inline-block px-1 py-0.5 text-[8px] font-sans font-medium text-slate-400 bg-slate-900 border border-slate-700 rounded" aria-hidden="true">Alt+C</kbd>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleClear}
                      aria-keyshortcuts="Alt+X"
                      className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-rose-400 px-2.5 py-1 rounded border border-slate-700 flex items-center gap-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 focus-visible:ring-rose-500 focus-visible:outline-none"
                      aria-label="Clear active token (Alt + X)"
                      title="Clear active token (Alt + X)"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Clear</span>
                      <kbd className="hidden sm:inline-block px-1 py-0.5 text-[8px] font-sans font-medium text-slate-400 bg-slate-900 border border-slate-700 rounded" aria-hidden="true">Alt+X</kbd>
                    </button>
                  </div>
                </div>
                <div
                  id="raw-token-container"
                  tabIndex={0}
                  aria-label={`${isRevoked ? "Revoked" : "Active"} JSON Web Token container (${showToken ? "Full raw JWT unmasked" : "Privacy masked signature preview"})`}
                  title={showToken ? "Full raw JSON Web Token string" : "Truncated signature for privacy protection during screen sharing"}
                  className={`bg-slate-950 p-4 rounded-lg border break-all font-mono text-xs transition-all duration-300 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:ring-emerald-500 focus-visible:outline-none ${
                    copied
                      ? 'border-emerald-500 bg-emerald-500/5 text-emerald-200 shadow-md shadow-emerald-500/5 scale-[1.01]'
                      : isRevoked
                      ? 'border-rose-500/40 bg-rose-500/5 text-rose-300'
                      : 'border-slate-800 text-emerald-300'
                  }`}
                >
                  {renderTokenParts(token)}
                </div>
                {showToken && (
                  <div
                    className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400 mt-2 px-1"
                    aria-label="JWT segment color guide"
                    role="list"
                  >
                    {[
                      { name: 'Header', color: 'rose', bg: 'bg-rose-400', hoverText: 'hover:text-rose-400 focus-visible:text-rose-400', ring: 'focus-visible:ring-rose-500/50', desc: 'Header: Contains metadata about the token type (JWT) and algorithm.' },
                      { name: 'Payload', color: 'indigo', bg: 'bg-indigo-400', hoverText: 'hover:text-indigo-400 focus-visible:text-indigo-400', ring: 'focus-visible:ring-indigo-500/50', desc: 'Payload: Contains claims and user data encoded as JSON.' },
                      { name: 'Signature', color: 'cyan', bg: 'bg-cyan-400', hoverText: 'hover:text-cyan-400 focus-visible:text-cyan-400', ring: 'focus-visible:ring-cyan-500/50', desc: 'Signature: Cryptographically verifies token integrity.' },
                    ].map((seg, idx) => (
                      <button
                        key={seg.name}
                        type="button"
                        role="listitem"
                        onClick={() => handleCopySegment(idx, seg.name)}
                        onMouseEnter={() => setActiveSegment(seg.name)}
                        onMouseLeave={() => setActiveSegment(null)}
                        onFocus={() => setActiveSegment(seg.name)}
                        onBlur={() => setActiveSegment(null)}
                        className={`flex items-center gap-1.5 transition-colors duration-150 focus-visible:ring-2 ${seg.ring} rounded-md focus-visible:outline-none px-1.5 py-0.5 text-slate-400 ${seg.hoverText}`}
                        title={`Click to copy ${seg.name} segment`}
                        aria-label={copiedSegment === seg.name ? `${seg.name} segment copied to clipboard` : `Copy ${seg.name} segment (${seg.color}). ${seg.desc}`}
                      >
                        {copiedSegment === seg.name ? (
                          <Check className="w-3 h-3 text-emerald-400 shrink-0" aria-hidden="true" />
                        ) : (
                          <span className={`w-2 h-2 rounded-full ${seg.bg} block shrink-0`} aria-hidden="true" />
                        )}
                        <span className={`font-medium ${copiedSegment === seg.name ? 'text-emerald-400' : ''}`}>
                          {copiedSegment === seg.name ? `Copied ${seg.name}!` : `${seg.color.charAt(0).toUpperCase() + seg.color.slice(1)}: ${seg.name}`}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <div className="flex items-center gap-2">
                    <label htmlFor="decoded-claims-container" className="block text-sm font-medium text-slate-400">Decoded Payload (Claims)</label>
                    {(() => {
                      const expInfo = getTokenExpirationInfo(token);
                      if (!expInfo) return null;
                      const isBadgeExpiredOrRevoked = expInfo.isExpired || isRevoked;
                      return (
                        <span
                          role="status"
                          aria-live="polite"
                          title={isRevoked ? `This JWT token has been revoked (${expInfo.label})` : expInfo.isExpired ? "This JWT token has expired" : `Remaining token validity: ${expInfo.label}`}
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 transition-all ${
                            isBadgeExpiredOrRevoked
                              ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          }`}
                        >
                          <Clock className="w-3 h-3" aria-hidden="true" />
                          <span>{isRevoked ? `${expInfo.label} (Revoked)` : expInfo.label}</span>
                        </span>
                      );
                    })()}
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyClaims}
                    aria-keyshortcuts="Alt+P"
                    className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 px-2 py-0.5 rounded border border-slate-700 flex items-center gap-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 focus-visible:ring-emerald-500 focus-visible:outline-none"
                    aria-label={copiedClaims ? "Claims copied to clipboard" : "Copy decoded payload claims to clipboard (Alt + P)"}
                    title="Copy decoded payload claims (Alt + P)"
                  >
                    {copiedClaims ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                        <span className="text-emerald-400 font-medium">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Copy Claims</span>
                        <kbd className="hidden sm:inline-block px-1 py-0.5 text-[8px] font-sans font-medium text-slate-400 bg-slate-900 border border-slate-700 rounded" aria-hidden="true">Alt+P</kbd>
                      </>
                    )}
                  </button>
                </div>
                <div
                  id="decoded-claims-container"
                  tabIndex={0}
                  aria-label={isRevoked ? "Revoked decoded payload claims list" : "Decoded payload claims list"}
                  className={`bg-slate-950 p-4 rounded-lg border font-mono text-xs overflow-x-auto whitespace-pre-wrap break-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:ring-emerald-500 focus-visible:outline-none transition-all duration-300 ${
                    copiedClaims
                      ? 'border-amber-500 bg-amber-500/5 text-amber-200 shadow-md shadow-amber-500/5 scale-[1.01]'
                      : isRevoked
                      ? 'border-rose-500/40 bg-rose-500/5 text-rose-300/80'
                      : 'border-slate-800 text-amber-300'
                  }`}
                >
                  {decodePayload(token) ? JSON.stringify(decodePayload(token), null, 2) : 'Unable to decode JWT payload claims'}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-6 p-6 rounded-xl border border-dashed border-slate-700 bg-slate-900/30 text-center flex flex-col items-center gap-3">
              <div className="p-3 bg-slate-800/80 rounded-full border border-slate-700/80 text-emerald-400">
                <Key className="w-6 h-6" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-300">No Active JSON Web Token</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  Configure a User ID and Role above, or click below to quickly issue a demo authentication token.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAuth}
                disabled={isIssuing || isRevoking || isUserEmpty}
                title={isUserEmpty ? "Cannot issue token: User ID is empty" : isIssuing || isRevoking ? "Action in progress" : "Quickly issue demo JWT token"}
                aria-label={isIssuing ? "Issuing demo JWT token..." : "Quickly issue demo JWT token"}
                className="mt-1 text-xs bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800/50 text-emerald-400 hover:text-emerald-300 disabled:text-slate-600 disabled:cursor-not-allowed px-3.5 py-1.5 rounded-lg border border-slate-700/80 flex items-center gap-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:ring-emerald-500 focus-visible:outline-none"
              >
                {isIssuing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Key className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                <span>{isIssuing ? 'Issuing...' : 'Quick Issue Demo Token'}</span>
                <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-sans font-medium text-slate-300 bg-slate-900/40 border border-slate-500/30 rounded" aria-hidden="true">Alt+I</kbd>
              </button>
            </div>
          )}
        </section>

        <section className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-400" aria-hidden="true" /> Live Metrics
            </h2>
            <div className="flex items-center gap-3">
              <span
                role="status"
                aria-live="polite"
                title={isOffline ? "Backend API service is unreachable" : "Backend API service is connected (polling metrics every 2s)"}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border transition-all ${
                  isOffline
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full block ${
                    isOffline ? 'bg-rose-500 animate-pulse' : 'bg-emerald-400 animate-ping'
                  }`}
                  aria-hidden="true"
                />
                {isOffline ? 'Offline' : 'Connected'}
              </span>
              <button
                type="button"
                onClick={() => fetchMetrics(true)}
                disabled={isRefreshingMetrics}
                aria-label="Refresh metrics (Alt + M)"
                title="Refresh metrics (Alt + M)"
                aria-keyshortcuts="Alt+M"
                className="p-1 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-700 disabled:cursor-not-allowed border border-slate-700 transition-colors flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 focus-visible:ring-emerald-500 focus-visible:outline-none"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingMetrics ? 'animate-spin text-emerald-400' : ''}`} aria-hidden="true" />
                <kbd className="hidden sm:inline-block px-1 py-0.5 text-[8px] font-sans font-medium text-slate-400 bg-slate-900 border border-slate-700 rounded" aria-hidden="true">Alt+M</kbd>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <MetricCard
              title="Auth Success"
              value={metrics?.auth_success_total || 0}
              color="text-emerald-400"
              description="Total number of successful JWT authentications validated by the API."
            />
            <MetricCard
              title="Auth Failures"
              value={metrics?.auth_failure_total || 0}
              color="text-rose-400"
              description="Total number of failed, invalid, or expired token verification attempts."
            />
            <MetricCard
              title="Rate Limited"
              value={metrics?.rate_limit_rejections_total || 0}
              color="text-amber-400"
              description="Total number of requests blocked by the token bucket rate limiter."
            />
            <MetricCard
              title="Mutations"
              value={metrics?.narrative_mutations_total || 0}
              color="text-blue-400"
              description="Total number of successful state updates (mutations) processed by the lab."
            />
          </div>

          <div className="mt-8">
             <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Grafana Observability</h3>
             <div className="aspect-video bg-slate-900 rounded-lg border border-slate-700 flex flex-col items-center justify-center p-6 text-center gap-3">
                <div className="bg-slate-800 p-3 rounded-full border border-slate-700 text-emerald-400 animate-pulse" style={{ animationDuration: '3s' }}>
                  <Activity className="w-6 h-6" aria-hidden="true" />
                </div>
                <div>
                  <span className="block text-slate-300 font-medium text-sm">Live Observability Portal</span>
                  <span className="block text-slate-500 text-xs mt-1">Visualize real-time authorization requests, rate-limiting tokens, and container health.</span>
                </div>
                <a
                  href="http://localhost:3000"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 px-4 py-2 rounded-lg border border-slate-700 flex items-center gap-2 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 focus-visible:ring-emerald-500 focus-visible:outline-none"
                  aria-label="Launch live Grafana dashboard in a new tab"
                >
                  <span>Launch Live Dashboard</span>
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                </a>
             </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function MetricCard({ title, value, color, description }: { title: string, value: number | string, color: string, description?: string }) {
  const [highlight, setHighlight] = useState(false);
  const prevValue = useRef(value);

  useEffect(() => {
    if (prevValue.current !== value) {
      setHighlight(true);
      prevValue.current = value;
      const timer = setTimeout(() => setHighlight(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [value]);

  let highlightClass = 'border-emerald-500/50 bg-slate-800/80 shadow-lg shadow-emerald-500/5';
  if (color.includes('rose')) {
    highlightClass = 'border-rose-500/50 bg-slate-800/80 shadow-lg shadow-rose-500/5';
  } else if (color.includes('amber')) {
    highlightClass = 'border-amber-500/50 bg-slate-800/80 shadow-lg shadow-amber-500/5';
  } else if (color.includes('blue')) {
    highlightClass = 'border-blue-500/50 bg-slate-800/80 shadow-lg shadow-blue-500/5';
  }

  return (
    <div
      className={`p-4 rounded-xl border transition-all duration-300 ${
        highlight ? `${highlightClass} scale-[1.02]` : 'bg-slate-900 border-slate-700'
      }`}
      aria-live="polite"
    >
      <div className="flex items-center justify-between text-xs font-medium text-slate-500 uppercase mb-1">
        <span>{title}</span>
        {description && (
          <span
            className="cursor-help text-slate-500 hover:text-emerald-400 focus-visible:text-emerald-400 transition-colors flex items-center focus-visible:ring-2 focus-visible:ring-emerald-500 rounded p-0.5 focus-visible:outline-none"
            title={description}
            aria-label={description}
            tabIndex={0}
            role="tooltip"
          >
            <Info className="w-3.5 h-3.5" aria-hidden="true" />
          </span>
        )}
      </div>
      <div className={`text-2xl font-bold transition-transform duration-300 ${color} ${highlight ? 'scale-105 origin-left' : ''}`}>
        {value}
      </div>
    </div>
  );
}

export default App;
