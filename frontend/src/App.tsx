import { useState, useEffect, useRef } from 'react';
import { Shield, User, Activity, RefreshCw, Trash2, Key, Copy, Check, ExternalLink, Eye, EyeOff, X, Info, Clock, AlertCircle, AlertTriangle, Terminal } from 'lucide-react';

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

const decodeHeader = (jwt: string): Record<string, any> | null => {
  try {
    const parts = jwt.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[0];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonHeader = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonHeader);
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

const getTokenExpirationInfo = (jwt: string): { label: string; isExpired: boolean; isNearExpiry: boolean } | null => {
  const payload = decodePayload(jwt);
  if (!payload || typeof payload.exp !== 'number') return null;
  const now = Math.floor(Date.now() / 1000);
  const diffSec = payload.exp - now;
  if (diffSec <= 0) {
    return { label: 'Token Expired', isExpired: true, isNearExpiry: false };
  }
  const isNearExpiry = diffSec <= 60;
  const mins = Math.floor(diffSec / 60);
  if (mins < 1) {
    return { label: `Expires in ${diffSec}s`, isExpired: false, isNearExpiry };
  }
  if (mins < 60) {
    return { label: `Expires in ${mins}m`, isExpired: false, isNearExpiry };
  }
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return { label: remMins > 0 ? `Expires in ${hours}h ${remMins}m` : `Expires in ${hours}h`, isExpired: false, isNearExpiry };
};

function App() {
  const [token, setToken] = useState<string>('');
  const [showToken, setShowToken] = useState(false);
  const [showCurl, setShowCurl] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedBearer, setCopiedBearer] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [copiedClaims, setCopiedClaims] = useState(false);
  const [copiedSegment, setCopiedSegment] = useState<string | null>(null);
  const [copiedIso, setCopiedIso] = useState<string | null>(null);
  const [copiedGrafanaUrl, setCopiedGrafanaUrl] = useState(false);
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
  const [, setTick] = useState(0);
  const timeoutRef = useRef<any>(null);
  const userIdInputRef = useRef<HTMLInputElement | null>(null);
  const helpDialogRef = useRef<HTMLDivElement | null>(null);
  const helpTriggerRef = useRef<HTMLButtonElement | null>(null);
  const helpCloseButtonRef = useRef<HTMLButtonElement | null>(null);

  const isRevoked = status.toLowerCase().includes('revoked');
  const trimmedUserId = userId.trim();
  const isUserEmpty = trimmedUserId === '';
  const hasSpaces = userId !== trimmedUserId;
  const activePayload = token ? decodePayload(token) : null;
  const isFormModified = Boolean(
    activePayload &&
      !isUserEmpty &&
      (trimmedUserId !== activePayload.sub || role !== activePayload.role)
  );
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
    if (!token) return;
    const ticker = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(ticker);
  }, [token]);

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
      setAnnouncement('Failed to copy token to clipboard. Clipboard permission denied or unavailable.');
    }
  };

  const handleCopyBearer = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(`Bearer ${token}`);
      setCopiedBearer(true);
      setAnnouncement('Authorization Bearer header copied to clipboard');
      setTimeout(() => setCopiedBearer(false), 2000);
    } catch (e) {
      console.error('Failed to copy Bearer header to clipboard', e);
      setAnnouncement('Failed to copy Authorization Bearer header to clipboard. Clipboard permission denied or unavailable.');
    }
  };

  const handleCopyCurl = async () => {
    if (!token) return;
    const curlCmd = `curl -i -H "Authorization: Bearer ${token}" ${API_BASE}/protected`;
    try {
      await navigator.clipboard.writeText(curlCmd);
      setCopiedCurl(true);
      setAnnouncement('cURL request command copied to clipboard');
      setTimeout(() => setCopiedCurl(false), 2000);
    } catch (e) {
      console.error('Failed to copy cURL command', e);
      setAnnouncement('Failed to copy cURL command to clipboard. Clipboard permission denied or unavailable.');
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
      setAnnouncement('Failed to copy claims to clipboard. Clipboard permission denied or unavailable.');
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
      setAnnouncement(`Failed to copy ${name} segment to clipboard. Clipboard permission denied or unavailable.`);
    }
  };

  const handleCopyIso = async (claimName: string, isoStr: string) => {
    try {
      await navigator.clipboard.writeText(isoStr);
      setCopiedIso(claimName);
      setAnnouncement(`${claimName} claim copied to clipboard: ${isoStr}`);
      setTimeout(() => setCopiedIso(null), 2000);
    } catch (e) {
      console.error(`Failed to copy ${claimName} claim`, e);
      setAnnouncement(`Failed to copy ${claimName} claim to clipboard. Clipboard permission denied or unavailable.`);
    }
  };

  const handleCopyGrafanaUrl = async () => {
    const url = 'http://localhost:3000';
    try {
      await navigator.clipboard.writeText(url);
      setCopiedGrafanaUrl(true);
      setAnnouncement('Grafana dashboard URL copied to clipboard: ' + url);
      setTimeout(() => setCopiedGrafanaUrl(false), 2000);
    } catch (e) {
      console.error('Failed to copy Grafana URL', e);
      setAnnouncement('Failed to copy Grafana URL to clipboard. Clipboard permission denied or unavailable.');
    }
  };

  const handleClear = () => {
    if (!token) return;
    setToken('');
    setShowCurl(false);
    setStatus('Idle');
    setAnnouncement('Token cleared and system status reset to Idle');
    userIdInputRef.current?.focus();
  };

  const stateRef = useRef({
    token,
    isIssuing,
    isRevoking,
    isRevoked,
    isRefreshingMetrics,
    showToken,
    setShowToken,
    showHelp,
    setShowHelp,
    setAnnouncement,
    handleAuth,
    handleRevoke,
    handleCopy,
    handleCopyBearer,
    handleCopyCurl,
    handleClear,
    handleCopyClaims,
    fetchMetrics,
    isUserEmpty,
  });
  stateRef.current = {
    token,
    isIssuing,
    isRevoking,
    isRevoked,
    isRefreshingMetrics,
    showToken,
    setShowToken,
    showHelp,
    setShowHelp,
    setAnnouncement,
    handleAuth,
    handleRevoke,
    handleCopy,
    handleCopyBearer,
    handleCopyCurl,
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
        isRevoked,
        isRefreshingMetrics,
        showToken,
        setShowToken,
        showHelp,
        setShowHelp,
        setAnnouncement,
        handleAuth,
        handleRevoke,
        handleCopy,
        handleCopyBearer,
        handleCopyCurl,
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
          } else if (isRevoked) {
            setAnnouncement("Cannot revoke token: Active token is already revoked");
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
        } else if (key === 'b') {
          e.preventDefault();
          if (!token) {
            setAnnouncement("Cannot copy Bearer header: No active token available");
          } else {
            handleCopyBearer();
          }
        } else if (key === 'u') {
          e.preventDefault();
          if (!token) {
            setAnnouncement("Cannot copy cURL command: No active token available");
          } else {
            handleCopyCurl();
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
          if (!nextHelp) {
            helpTriggerRef.current?.focus();
          }
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

    const activeHeaderObj = decodeHeader(t);
    const headerTitleStr = activeHeaderObj ? `Header: ${JSON.stringify(activeHeaderObj)}` : 'Header: Algorithm & Type';

    return (
      <>
        <span
          onMouseEnter={() => setActiveSegment('Header')}
          onMouseLeave={() => setActiveSegment(null)}
          className={`text-rose-400 font-semibold cursor-pointer transition-all duration-300 ${isHeaderActive ? 'bg-rose-500/20 ring-1 ring-rose-400/60 rounded px-1 shadow-sm shadow-rose-500/10' : ''}`}
          title={headerTitleStr}
        >
          {parts[0]}
        </span>
        <span className="text-slate-500">.</span>
        <span
          onMouseEnter={() => setActiveSegment('Payload')}
          onMouseLeave={() => setActiveSegment(null)}
          className={`text-indigo-400 font-semibold cursor-pointer transition-all duration-300 ${isPayloadActive ? 'bg-indigo-500/20 ring-1 ring-indigo-400/60 rounded px-1 shadow-sm shadow-indigo-500/10' : ''}`}
          title="Payload: Claims & Data"
        >
          {parts[1]}
        </span>
        <span className="text-slate-500">.</span>
        <span
          onMouseEnter={() => setActiveSegment('Signature')}
          onMouseLeave={() => setActiveSegment(null)}
          className={`text-cyan-400 font-semibold cursor-pointer transition-all duration-300 ${isSignatureActive ? 'bg-cyan-500/20 ring-1 ring-cyan-400/60 rounded px-1 shadow-sm shadow-cyan-500/10' : ''}`}
          title="Signature: Security Verification Key"
        >
          {parts[2]}
        </span>
      </>
    );
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8 font-sans relative">
      <a
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          userIdInputRef.current?.focus();
          setAnnouncement("Navigated directly to main form input");
        }}
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-xl border border-emerald-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-emerald-400 transition-all"
      >
        Skip to main content
      </a>
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
              className={`text-xs px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:ring-emerald-500 focus-visible:outline-none ${
                showHelp
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 font-medium'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 border-slate-700'
              }`}
              aria-expanded={showHelp}
              aria-controls="keyboard-shortcuts-dialog"
              aria-haspopup="true"
              aria-keyshortcuts="Alt+K"
              aria-label={showHelp ? "Close keyboard shortcuts help (Alt + K)" : "Open keyboard shortcuts help (Alt + K)"}
              title={showHelp ? "Close keyboard shortcuts menu (Alt + K)" : "Open keyboard shortcuts menu (Alt + K)"}
            >
              <span>Shortcuts</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-sans font-medium text-slate-400 bg-slate-900 border border-slate-700 rounded" aria-hidden="true">Alt+K</kbd>
            </button>
            {showHelp && (
              <>
                <div
                  className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[1px]"
                  onClick={() => {
                    setShowHelp(false);
                    setAnnouncement("Keyboard shortcuts menu closed");
                    helpTriggerRef.current?.focus();
                  }}
                  aria-hidden="true"
                />
                <div
                  ref={helpDialogRef}
                  id="keyboard-shortcuts-dialog"
                  className="absolute right-0 mt-2 w-72 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-4 z-50 text-xs text-slate-300"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Keyboard Shortcuts"
                  onKeyDown={(e) => {
                    if (e.key === 'Tab') {
                      e.preventDefault();
                      helpCloseButtonRef.current?.focus();
                    }
                  }}
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
                    title="Close shortcuts help (Esc)"
                  >
                    &times;
                  </button>
                </div>
                <div className="space-y-2.5" role="list" aria-label="Keyboard shortcuts list">
                  <div className="flex justify-between items-center" role="listitem"><span>Issue Token</span><kbd className="bg-slate-950 px-1.5 py-0.5 border border-slate-700 rounded font-mono text-[10px]">Alt+I</kbd></div>
                  <div className="flex justify-between items-center" role="listitem"><span>Revoke Token</span><kbd className="bg-slate-950 px-1.5 py-0.5 border border-slate-700 rounded font-mono text-[10px]">Alt+R</kbd></div>
                  <div className="flex justify-between items-center" role="listitem"><span>Copy Token</span><kbd className="bg-slate-950 px-1.5 py-0.5 border border-slate-700 rounded font-mono text-[10px]">Alt+C</kbd></div>
                  <div className="flex justify-between items-center" role="listitem"><span>Copy Bearer Header</span><kbd className="bg-slate-950 px-1.5 py-0.5 border border-slate-700 rounded font-mono text-[10px]">Alt+B</kbd></div>
                  <div className="flex justify-between items-center" role="listitem"><span>Copy cURL Command</span><kbd className="bg-slate-950 px-1.5 py-0.5 border border-slate-700 rounded font-mono text-[10px]">Alt+U</kbd></div>
                  <div className="flex justify-between items-center" role="listitem"><span>Clear Token</span><kbd className="bg-slate-950 px-1.5 py-0.5 border border-slate-700 rounded font-mono text-[10px]">Alt+X</kbd></div>
                  <div className="flex justify-between items-center" role="listitem"><span>Copy Decoded Claims</span><kbd className="bg-slate-950 px-1.5 py-0.5 border border-slate-700 rounded font-mono text-[10px]">Alt+P</kbd></div>
                  <div className="flex justify-between items-center" role="listitem"><span>Toggle JWT Visibility</span><kbd className="bg-slate-950 px-1.5 py-0.5 border border-slate-700 rounded font-mono text-[10px]">Alt+V</kbd></div>
                  <div className="flex justify-between items-center" role="listitem"><span>Refresh Metrics</span><kbd className="bg-slate-950 px-1.5 py-0.5 border border-slate-700 rounded font-mono text-[10px]">Alt+M</kbd></div>
                  <div className="flex justify-between items-center text-slate-400" role="listitem"><span>Toggle This Help</span><kbd className="bg-slate-950 px-1.5 py-0.5 border border-slate-700 rounded font-mono text-[10px]">Alt+K</kbd></div>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-700/60 text-[10px] text-slate-400 flex justify-between items-center">
                  <span>Press <kbd className="bg-slate-950 px-1 py-0.5 border border-slate-700 rounded font-mono text-[9px]">Esc</kbd> to dismiss</span>
                </div>
              </div>
              </>
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

      <main id="main-content" tabIndex={-1} className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 focus:outline-none">
        <section className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Key className="w-5 h-5 text-emerald-400" aria-hidden="true" /> Token Management
            </h2>
            {isFormModified && (
              <button
                type="button"
                onClick={() => {
                  if (activePayload?.sub) setUserId(activePayload.sub);
                  if (activePayload?.role) setRole(activePayload.role);
                  setAnnouncement(`Form inputs restored to active token claims: User ID ${activePayload?.sub}, Role ${activePayload?.role}`);
                  userIdInputRef.current?.focus();
                }}
                aria-live="polite"
                title="Form inputs differ from active token claims. Click to restore fields to active token claims."
                aria-label="Inputs modified. Click to restore User ID and Role to active token claims."
                className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full border bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 hover:border-amber-500/50 text-amber-400 flex items-center gap-1 transition-all animate-pulse focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-800 focus-visible:ring-amber-400 focus-visible:outline-none cursor-pointer"
              >
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Inputs Modified <span className="underline decoration-amber-400/50 underline-offset-2">(Restore)</span></span>
              </button>
            )}
          </div>

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
                    aria-invalid={isUserEmpty}
                    autoComplete="off"
                    spellCheck={false}
                    autoCorrect="off"
                    autoCapitalize="none"
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
                  ) : userId.length === 128 ? (
                    <span className="text-rose-400 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      Maximum length limit reached (128 characters).
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
                <div className="flex flex-wrap items-center gap-2 mt-2" role="group" aria-label="Quick role selector">
                  <span className="text-xs text-slate-500 font-medium">Quick role:</span>
                  {[
                    { id: 'admin', label: 'Admin', tier: 'Tier 1' },
                    { id: 'operator', label: 'Operator', tier: 'Tier 2' },
                    { id: 'viewer', label: 'Viewer', tier: 'Tier 3' },
                  ].map((r) => {
                    const isActive = role === r.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => {
                          setRole(r.id);
                          const desc = ROLE_DESCRIPTIONS[r.id] || '';
                          setAnnouncement(`Role changed to ${r.id} (${r.tier}). ${desc}`);
                        }}
                        aria-label={`Set role to ${r.label} (${r.tier})`}
                        title={`Set role to ${r.label} (${r.tier})`}
                        className={`text-xs px-2 py-0.5 rounded border transition-colors focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-800 focus-visible:ring-emerald-500 focus-visible:outline-none ${
                          isActive
                            ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 font-medium'
                            : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-emerald-400 border-slate-700/60'
                        }`}
                      >
                        {r.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isIssuing || isRevoking || isUserEmpty}
                title={
                  isUserEmpty
                    ? "Cannot issue token: User ID is empty"
                    : isFormModified
                    ? "Form inputs modified from active token. Click to issue updated token (Alt + I)"
                    : isIssuing || isRevoking
                    ? "Action in progress"
                    : "Issue Token (Alt + I)"
                }
                aria-keyshortcuts="Alt+I"
                className={`flex-1 text-white font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 focus-visible:ring-emerald-500 focus-visible:outline-none ${
                  isFormModified && !isIssuing && !isRevoking
                    ? 'bg-emerald-600 hover:bg-emerald-500 ring-2 ring-amber-500/40'
                    : 'bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-400 disabled:cursor-not-allowed'
                }`}
              >
                <RefreshCw className={`w-4 h-4 ${isIssuing ? 'animate-spin' : ''}`} aria-hidden="true" />
                <span>{isIssuing ? 'Issuing...' : isFormModified ? 'Reissue Token' : 'Issue Token'}</span>
                <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-sans font-medium text-slate-300 bg-slate-900/40 border border-slate-500/30 rounded" aria-hidden="true">Alt+I</kbd>
              </button>
              <button
                type="button"
                onClick={handleRevoke}
                disabled={!token || isIssuing || isRevoking || isRevoked}
                title={!token ? "No active token to revoke" : isRevoked ? "Token is already revoked" : isIssuing || isRevoking ? "Action in progress" : "Revoke Token (Alt + R)"}
                aria-keyshortcuts="Alt+R"
                className="flex-1 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 focus-visible:ring-rose-500 focus-visible:outline-none"
              >
                <Trash2 className={`w-4 h-4 ${isRevoking ? 'animate-pulse' : ''}`} aria-hidden="true" />
                <span>{isRevoking ? 'Revoking...' : isRevoked ? 'Revoked' : 'Revoke'}</span>
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
                    {(() => {
                      const activeHeaderObj = token ? decodeHeader(token) : null;
                      return activeHeaderObj?.alg ? (
                        <span
                          role="status"
                          aria-live="polite"
                          title={`Signing Algorithm: ${activeHeaderObj.alg}${activeHeaderObj.typ ? ` (${activeHeaderObj.typ})` : ''}`}
                          aria-label={`Signing Algorithm ${activeHeaderObj.alg}`}
                          className="text-[10px] font-mono font-semibold tracking-wider px-2 py-0.5 rounded-full border bg-rose-500/10 border-rose-500/30 text-rose-400 shrink-0"
                        >
                          {activeHeaderObj.alg}
                        </span>
                      ) : null;
                    })()}
                    {isRevoked && (
                      <span
                        role="status"
                        aria-live="polite"
                        className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full border bg-rose-500/10 border-rose-500/30 text-rose-400 shrink-0"
                      >
                        Revoked
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
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
                      className={`text-xs px-2.5 py-1 rounded border flex items-center gap-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 focus-visible:ring-emerald-500 focus-visible:outline-none ${
                        showToken
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 font-medium'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 border-slate-700'
                      }`}
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
                      onClick={() => {
                        const nextShow = !showCurl;
                        setShowCurl(nextShow);
                        setAnnouncement(nextShow ? "cURL command preview shown" : "cURL command preview hidden");
                      }}
                      aria-expanded={showCurl}
                      aria-controls="curl-command-preview"
                      title={showCurl ? "Hide cURL request command preview" : "Preview cURL request command snippet"}
                      className={`text-xs px-2.5 py-1 rounded border flex items-center gap-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 focus-visible:ring-emerald-500 focus-visible:outline-none ${
                        showCurl
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 font-medium'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 border-slate-700'
                      }`}
                      aria-label={showCurl ? "Hide cURL request command preview" : "Show cURL request command preview"}
                    >
                      <Terminal className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{showCurl ? 'Hide cURL' : 'cURL'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyCurl}
                      aria-keyshortcuts="Alt+U"
                      className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 px-2.5 py-1 rounded border border-slate-700 flex items-center gap-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 focus-visible:ring-emerald-500 focus-visible:outline-none"
                      aria-label={copiedCurl ? "cURL request command copied to clipboard" : "Copy cURL request command to clipboard (Alt + U)"}
                      title={`Copy cURL command (curl -i -H "Authorization: Bearer <token>" ${API_BASE}/protected) (Alt + U)`}
                    >
                      {copiedCurl ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                          <span className="text-emerald-400 font-medium">Copied cURL!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Copy cURL</span>
                          <kbd className="hidden sm:inline-block px-1 py-0.5 text-[8px] font-sans font-medium text-slate-400 bg-slate-900 border border-slate-700 rounded" aria-hidden="true">Alt+U</kbd>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleCopy}
                      aria-keyshortcuts="Alt+C"
                      className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 px-2.5 py-1 rounded border border-slate-700 flex items-center gap-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 focus-visible:ring-emerald-500 focus-visible:outline-none"
                      aria-label={copied ? "Token copied to clipboard" : "Copy token to clipboard (Alt + C)"}
                      title="Copy raw token string to clipboard (Alt + C)"
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
                      onClick={handleCopyBearer}
                      aria-keyshortcuts="Alt+B"
                      className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 px-2.5 py-1 rounded border border-slate-700 flex items-center gap-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 focus-visible:ring-emerald-500 focus-visible:outline-none"
                      aria-label={copiedBearer ? "Authorization Bearer header copied to clipboard" : "Copy Authorization Bearer header string to clipboard (Alt + B)"}
                      title="Copy Authorization: Bearer <token> header to clipboard (Alt + B)"
                    >
                      {copiedBearer ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                          <span className="text-emerald-400 font-medium">Copied Bearer!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Copy Bearer</span>
                          <kbd className="hidden sm:inline-block px-1 py-0.5 text-[8px] font-sans font-medium text-slate-400 bg-slate-900 border border-slate-700 rounded" aria-hidden="true">Alt+B</kbd>
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
                    copied || copiedBearer
                      ? 'border-emerald-500 bg-emerald-500/5 text-emerald-200 shadow-md shadow-emerald-500/5 scale-[1.01]'
                      : isRevoked
                      ? 'border-rose-500/40 bg-rose-500/5 text-rose-300'
                      : 'border-slate-800 text-emerald-300'
                  }`}
                >
                  {renderTokenParts(token)}
                </div>
                {showCurl && (() => {
                  const expInfo = getTokenExpirationInfo(token);
                  const isTokenInvalid = isRevoked || (expInfo?.isExpired ?? false);
                  return (
                    <div
                      id="curl-command-preview"
                      tabIndex={0}
                      role="region"
                      aria-label={`${isTokenInvalid ? "Revoked or expired" : "Active"} cURL request command preview`}
                      className={`mt-2.5 p-3 rounded-lg border font-mono text-xs transition-all duration-300 flex items-center justify-between gap-3 overflow-x-auto focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:ring-emerald-500 focus-visible:outline-none ${
                        copiedCurl
                          ? 'border-emerald-500 bg-emerald-500/5 text-emerald-200 shadow-md shadow-emerald-500/5 scale-[1.01]'
                          : isTokenInvalid
                          ? 'border-rose-500/40 bg-rose-500/5 text-rose-300/90'
                          : 'border-slate-800 bg-slate-950 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 flex-wrap font-mono">
                        <span className={isTokenInvalid ? 'text-rose-400 break-words font-mono' : 'text-emerald-400 break-words font-mono'}>
                          curl -i -H "Authorization: Bearer {showToken ? token : `${token.slice(0, 12)}...${token.slice(-12)}`}" {API_BASE}/protected
                        </span>
                        <span
                          role="status"
                          aria-live="polite"
                          title={isTokenInvalid ? "Expected response status: 401 Unauthorized (Token is revoked or expired)" : "Expected response status: 200 OK (Token is active and valid)"}
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${
                            isTokenInvalid
                              ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          }`}
                        >
                          {isTokenInvalid ? '401 Unauthorized Expected' : '200 OK Expected'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyCurl}
                        aria-label={copiedCurl ? "cURL request command copied to clipboard" : "Copy cURL request command to clipboard"}
                        title="Copy cURL command"
                        className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 px-2 py-1 rounded border border-slate-700 flex items-center gap-1 shrink-0 transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
                      >
                        {copiedCurl ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" aria-hidden="true" />
                            <span className="text-emerald-400 font-medium">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" aria-hidden="true" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })()}
                {showToken && (() => {
                  const activeHeaderObj = token ? decodeHeader(token) : null;
                  const headerJsonStr = activeHeaderObj ? JSON.stringify(activeHeaderObj) : null;
                  return (
                    <div
                      className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400 mt-2 px-1"
                      aria-label="JWT segment color guide"
                      role="list"
                    >
                      {[
                        { name: 'Header', color: 'rose', bg: 'bg-rose-400', activeText: 'text-rose-400', hoverText: 'hover:text-rose-400 focus-visible:text-rose-400', ring: 'focus-visible:ring-rose-500/50', desc: headerJsonStr ? `Header (${headerJsonStr}): Contains metadata about the token type and signing algorithm.` : 'Header: Contains metadata about the token type (JWT) and algorithm.' },
                        { name: 'Payload', color: 'indigo', bg: 'bg-indigo-400', activeText: 'text-indigo-400', hoverText: 'hover:text-indigo-400 focus-visible:text-indigo-400', ring: 'focus-visible:ring-indigo-500/50', desc: 'Payload: Contains claims and user data encoded as JSON.' },
                        { name: 'Signature', color: 'cyan', bg: 'bg-cyan-400', activeText: 'text-cyan-400', hoverText: 'hover:text-cyan-400 focus-visible:text-cyan-400', ring: 'focus-visible:ring-cyan-500/50', desc: 'Signature: Cryptographically verifies token integrity.' },
                      ].map((seg, idx) => {
                      const isSegActive = activeSegment === seg.name || copiedSegment === seg.name;
                      return (
                        <div key={seg.name} role="listitem">
                          <button
                            type="button"
                            onClick={() => handleCopySegment(idx, seg.name)}
                            onMouseEnter={() => setActiveSegment(seg.name)}
                            onMouseLeave={() => setActiveSegment(null)}
                            onFocus={() => setActiveSegment(seg.name)}
                            onBlur={() => setActiveSegment(null)}
                            className={`flex items-center gap-1.5 transition-all duration-150 focus-visible:ring-2 ${seg.ring} rounded-md focus-visible:outline-none px-1.5 py-0.5 ${
                              isSegActive ? `${seg.activeText} bg-slate-800/90 shadow-sm` : `text-slate-400 ${seg.hoverText}`
                            }`}
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
                        </div>
                      );
                      })}
                    </div>
                  );
                })()}
              </div>

              <div>
                <div className="flex flex-wrap justify-between items-center gap-2 mb-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <label htmlFor="decoded-claims-container" className="block text-sm font-medium text-slate-400">Decoded Payload (Claims)</label>
                    {activePayload && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 whitespace-nowrap shrink-0">
                        {Object.keys(activePayload).length} {Object.keys(activePayload).length === 1 ? 'claim' : 'claims'}
                      </span>
                    )}
                    {(() => {
                      const expInfo = getTokenExpirationInfo(token);
                      if (!expInfo) return null;
                      const isBadgeExpiredOrRevoked = expInfo.isExpired || isRevoked;
                    const isReissueEligible = expInfo.isExpired || expInfo.isNearExpiry || isRevoked;
                      return (
                        <div className="flex items-center gap-1.5">
                          <span
                            role="status"
                            aria-live="polite"
                            title={
                              isRevoked
                                ? `This JWT token has been revoked (${expInfo.label})`
                                : expInfo.isExpired
                                ? 'This JWT token has expired'
                                : expInfo.isNearExpiry
                                ? `Warning: JWT token expires in less than 1 minute (${expInfo.label})`
                                : `Remaining token validity: ${expInfo.label}`
                            }
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 transition-all whitespace-nowrap shrink-0 ${
                              isBadgeExpiredOrRevoked
                                ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                                : expInfo.isNearExpiry
                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 animate-pulse'
                                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            }`}
                          >
                          <Clock className="w-3 h-3 shrink-0" aria-hidden="true" />
                            <span>{isRevoked ? `${expInfo.label} (Revoked)` : expInfo.isNearExpiry ? `${expInfo.label} (Expiring Soon)` : expInfo.label}</span>
                          </span>
                        {isReissueEligible && (
                            <button
                              type="button"
                              onClick={handleAuth}
                              disabled={isIssuing || isRevoking || isUserEmpty}
                            title={
                              isRevoked
                                ? "Token revoked. Click to reissue a fresh replacement token."
                                : expInfo.isExpired
                                ? "Token expired. Click to reissue a fresh token."
                                : "Token expiring soon. Click to renew with a fresh token."
                            }
                            aria-label={
                              isRevoked
                                ? "Token revoked. Reissue fresh token"
                                : expInfo.isExpired
                                ? "Token expired. Reissue fresh token"
                                : "Token expiring soon. Renew fresh token"
                            }
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 transition-all whitespace-nowrap shrink-0 focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-800 focus-visible:outline-none cursor-pointer ${
                              isBadgeExpiredOrRevoked
                                ? 'bg-rose-500/20 hover:bg-rose-500/30 border-rose-500/40 hover:border-rose-500/60 text-rose-300 focus-visible:ring-rose-400'
                                : 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/40 hover:border-amber-500/60 text-amber-300 focus-visible:ring-amber-400'
                            }`}
                            >
                              <RefreshCw className={`w-3 h-3 ${isIssuing ? 'animate-spin' : ''}`} aria-hidden="true" />
                            <span>{expInfo.isNearExpiry && !expInfo.isExpired && !isRevoked ? 'Renew' : 'Reissue'}</span>
                            </button>
                          )}
                        </div>
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
                  title={isRevoked ? "Revoked decoded JSON Web Token payload claims" : "Decoded JSON Web Token payload claims"}
                  className={`bg-slate-950 p-4 rounded-lg border font-mono text-xs overflow-x-auto whitespace-pre-wrap break-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:ring-emerald-500 focus-visible:outline-none transition-all duration-300 ${
                    copiedClaims
                      ? 'border-amber-500 bg-amber-500/5 text-amber-200 shadow-md shadow-amber-500/5 scale-[1.01]'
                      : isRevoked
                      ? 'border-rose-500/40 bg-rose-500/5 text-rose-300/80'
                      : 'border-slate-800 text-amber-300'
                  }`}
                >
                  {activePayload ? JSON.stringify(activePayload, null, 2) : 'Unable to decode JWT payload claims'}
                </div>
                {(() => {
                  const payload = activePayload;
                  if (
                    !payload ||
                    (typeof payload.iat !== 'number' &&
                      typeof payload.nbf !== 'number' &&
                      typeof payload.exp !== 'number' &&
                      typeof payload.iss !== 'string' &&
                      typeof payload.sub !== 'string' &&
                      !payload.aud)
                  )
                    return null;

                  const subStr = typeof payload.sub === 'string' ? payload.sub : null;
                  const roleStr = typeof payload.role === 'string' ? payload.role : null;
                  const issStr = typeof payload.iss === 'string' ? payload.iss : null;
                  const audStr = Array.isArray(payload.aud)
                    ? payload.aud.join(', ')
                    : typeof payload.aud === 'string'
                    ? payload.aud
                    : null;

                  const formatTime = (ts: number) => {
                    try {
                      return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    } catch {
                      return null;
                    }
                  };
                  const iatStr = typeof payload.iat === 'number' ? formatTime(payload.iat) : null;
                  const nbfStr = typeof payload.nbf === 'number' ? formatTime(payload.nbf) : null;
                  const expStr = typeof payload.exp === 'number' ? formatTime(payload.exp) : null;
                  if (!subStr && !roleStr && !issStr && !audStr && !iatStr && !nbfStr && !expStr) return null;

                  const lifetimeSec = typeof payload.exp === 'number' && typeof payload.iat === 'number' ? payload.exp - payload.iat : null;
                  const formatDuration = (sec: number) => {
                    if (sec <= 0) return '0s';
                    if (sec < 60) return `${sec}s`;
                    const mins = Math.floor(sec / 60);
                    if (mins < 60) return `${mins}m`;
                    const hours = Math.floor(mins / 60);
                    const remMins = mins % 60;
                    return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
                  };

                  const iatIso = typeof payload.iat === 'number' ? new Date(payload.iat * 1000).toISOString() : null;
                  const nbfIso = typeof payload.nbf === 'number' ? new Date(payload.nbf * 1000).toISOString() : null;
                  const expIso = typeof payload.exp === 'number' ? new Date(payload.exp * 1000).toISOString() : null;

                  return (
                    <div
                      className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 mt-2 px-1 font-mono"
                      aria-label="Token registered claims summary"
                      role="list"
                    >
                      {subStr && (
                        <div role="listitem">
                          <button
                            type="button"
                            onClick={() => handleCopyIso('Subject', subStr)}
                            title={`Click to copy Subject (sub) claim: ${subStr}`}
                            aria-label={copiedIso === 'Subject' ? `Subject claim copied: ${subStr}` : `Copy Subject claim (${subStr})`}
                            className="flex items-center gap-1 hover:text-emerald-400 focus-visible:text-emerald-400 rounded px-1 py-0.5 transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
                          >
                            {copiedIso === 'Subject' ? (
                              <Check className="w-3 h-3 text-emerald-400 shrink-0" aria-hidden="true" />
                            ) : (
                              <User className="w-3 h-3 text-slate-500 shrink-0" aria-hidden="true" />
                            )}
                            <span>Subject: <strong className={copiedIso === 'Subject' ? 'text-emerald-400 font-medium' : 'text-slate-300 font-medium'}>{copiedIso === 'Subject' ? 'Copied Subject!' : subStr}</strong></span>
                          </button>
                        </div>
                      )}
                      {roleStr && (
                        <div role="listitem">
                          <button
                            type="button"
                            onClick={() => handleCopyIso('Role', roleStr)}
                            title={`Click to copy Role (role) claim: ${roleStr}`}
                            aria-label={copiedIso === 'Role' ? `Role claim copied: ${roleStr}` : `Copy Role claim (${roleStr})`}
                            className="flex items-center gap-1 hover:text-emerald-400 focus-visible:text-emerald-400 rounded px-1 py-0.5 transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
                          >
                            {copiedIso === 'Role' ? (
                              <Check className="w-3 h-3 text-emerald-400 shrink-0" aria-hidden="true" />
                            ) : (
                              <Shield className="w-3 h-3 text-slate-500 shrink-0" aria-hidden="true" />
                            )}
                            <span>Role: <strong className={copiedIso === 'Role' ? 'text-emerald-400 font-medium' : 'text-slate-300 font-medium'}>{copiedIso === 'Role' ? 'Copied Role!' : roleStr}</strong></span>
                          </button>
                        </div>
                      )}
                      {issStr && (
                        <div role="listitem">
                          <button
                            type="button"
                            onClick={() => handleCopyIso('Issuer', issStr)}
                            title={`Click to copy Issuer (iss) claim: ${issStr}`}
                            aria-label={copiedIso === 'Issuer' ? `Issuer claim copied: ${issStr}` : `Copy Issuer claim (${issStr})`}
                            className="flex items-center gap-1 hover:text-emerald-400 focus-visible:text-emerald-400 rounded px-1 py-0.5 transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
                          >
                            {copiedIso === 'Issuer' ? (
                              <Check className="w-3 h-3 text-emerald-400 shrink-0" aria-hidden="true" />
                            ) : (
                              <Shield className="w-3 h-3 text-slate-500 shrink-0" aria-hidden="true" />
                            )}
                            <span>Issuer: <strong className={copiedIso === 'Issuer' ? 'text-emerald-400 font-medium' : 'text-slate-300 font-medium'}>{copiedIso === 'Issuer' ? 'Copied Issuer!' : issStr}</strong></span>
                          </button>
                        </div>
                      )}
                      {audStr && (
                        <div role="listitem">
                          <button
                            type="button"
                            onClick={() => handleCopyIso('Audience', audStr)}
                            title={`Click to copy Audience (aud) claim: ${audStr}`}
                            aria-label={copiedIso === 'Audience' ? `Audience claim copied: ${audStr}` : `Copy Audience claim (${audStr})`}
                            className="flex items-center gap-1 hover:text-emerald-400 focus-visible:text-emerald-400 rounded px-1 py-0.5 transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
                          >
                            {copiedIso === 'Audience' ? (
                              <Check className="w-3 h-3 text-emerald-400 shrink-0" aria-hidden="true" />
                            ) : (
                              <Shield className="w-3 h-3 text-slate-500 shrink-0" aria-hidden="true" />
                            )}
                            <span>Audience: <strong className={copiedIso === 'Audience' ? 'text-emerald-400 font-medium' : 'text-slate-300 font-medium'}>{copiedIso === 'Audience' ? 'Copied Audience!' : audStr}</strong></span>
                          </button>
                        </div>
                      )}
                      {iatStr && iatIso && (
                        <div role="listitem">
                          <button
                            type="button"
                            onClick={() => handleCopyIso('Issued At', iatIso)}
                            title={`Click to copy Issued At (iat) ISO timestamp: ${iatIso}`}
                            aria-label={copiedIso === 'Issued At' ? `Issued At ISO timestamp copied: ${iatIso}` : `Copy Issued At ISO timestamp (${iatIso}). Local time: ${iatStr}`}
                            className="flex items-center gap-1 hover:text-emerald-400 focus-visible:text-emerald-400 rounded px-1 py-0.5 transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
                          >
                            {copiedIso === 'Issued At' ? (
                              <Check className="w-3 h-3 text-emerald-400 shrink-0" aria-hidden="true" />
                            ) : (
                              <Clock className="w-3 h-3 text-slate-500 shrink-0" aria-hidden="true" />
                            )}
                            <span>Issued: <strong className={copiedIso === 'Issued At' ? 'text-emerald-400 font-medium' : 'text-slate-300 font-medium'}>{copiedIso === 'Issued At' ? 'Copied ISO!' : iatStr}</strong></span>
                          </button>
                        </div>
                      )}
                      {nbfStr && nbfIso && (
                        <div role="listitem">
                          <button
                            type="button"
                            onClick={() => handleCopyIso('Valid From', nbfIso)}
                            title={`Click to copy Not Before (nbf) ISO timestamp: ${nbfIso}`}
                            aria-label={copiedIso === 'Valid From' ? `Valid From ISO timestamp copied: ${nbfIso}` : `Copy Valid From ISO timestamp (${nbfIso}). Local time: ${nbfStr}`}
                            className="flex items-center gap-1 hover:text-emerald-400 focus-visible:text-emerald-400 rounded px-1 py-0.5 transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
                          >
                            {copiedIso === 'Valid From' ? (
                              <Check className="w-3 h-3 text-emerald-400 shrink-0" aria-hidden="true" />
                            ) : (
                              <Clock className="w-3 h-3 text-slate-500 shrink-0" aria-hidden="true" />
                            )}
                            <span>Valid From: <strong className={copiedIso === 'Valid From' ? 'text-emerald-400 font-medium' : 'text-slate-300 font-medium'}>{copiedIso === 'Valid From' ? 'Copied ISO!' : nbfStr}</strong></span>
                          </button>
                        </div>
                      )}
                      {expStr && expIso && (
                        <div role="listitem">
                          <button
                            type="button"
                            onClick={() => handleCopyIso('Expires At', expIso)}
                            title={`Click to copy Expires At (exp) ISO timestamp: ${expIso}`}
                            aria-label={copiedIso === 'Expires At' ? `Expires At ISO timestamp copied: ${expIso}` : `Copy Expires At ISO timestamp (${expIso}). Local time: ${expStr}`}
                            className="flex items-center gap-1 hover:text-emerald-400 focus-visible:text-emerald-400 rounded px-1 py-0.5 transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
                          >
                            {copiedIso === 'Expires At' ? (
                              <Check className="w-3 h-3 text-emerald-400 shrink-0" aria-hidden="true" />
                            ) : (
                              <Clock className="w-3 h-3 text-slate-500 shrink-0" aria-hidden="true" />
                            )}
                            <span>Expires: <strong className={copiedIso === 'Expires At' ? 'text-emerald-400 font-medium' : 'text-slate-300 font-medium'}>{copiedIso === 'Expires At' ? 'Copied ISO!' : expStr}</strong></span>
                          </button>
                        </div>
                      )}
                      {lifetimeSec !== null && lifetimeSec > 0 && (
                        <div role="listitem">
                          <button
                            type="button"
                            onClick={() => {
                              const lifetimeStr = `${formatDuration(lifetimeSec)} (${lifetimeSec}s)`;
                              handleCopyIso('Lifetime', lifetimeStr);
                            }}
                            title={`Click to copy Token Lifetime duration: ${formatDuration(lifetimeSec)} (${lifetimeSec}s)`}
                            aria-label={
                              copiedIso === 'Lifetime'
                                ? `Token lifetime duration copied: ${formatDuration(lifetimeSec)} (${lifetimeSec}s)`
                                : `Copy token lifetime duration (${formatDuration(lifetimeSec)} / ${lifetimeSec}s)`
                            }
                            className="flex items-center gap-1 hover:text-emerald-400 focus-visible:text-emerald-400 rounded px-1 py-0.5 transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
                          >
                            {copiedIso === 'Lifetime' ? (
                              <Check className="w-3 h-3 text-emerald-400 shrink-0" aria-hidden="true" />
                            ) : (
                              <Clock className="w-3 h-3 text-slate-500 shrink-0" aria-hidden="true" />
                            )}
                            <span>Lifetime: <strong className={copiedIso === 'Lifetime' ? 'text-emerald-400 font-medium' : 'text-slate-300 font-medium'}>{copiedIso === 'Lifetime' ? 'Copied Lifetime!' : formatDuration(lifetimeSec)}</strong></span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}
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
              onAnnounce={setAnnouncement}
            />
            <MetricCard
              title="Auth Failures"
              value={metrics?.auth_failure_total || 0}
              color="text-rose-400"
              description="Total number of failed, invalid, or expired token verification attempts."
              onAnnounce={setAnnouncement}
            />
            <MetricCard
              title="Rate Limited"
              value={metrics?.rate_limit_rejections_total || 0}
              color="text-amber-400"
              description="Total number of requests blocked by the token bucket rate limiter."
              onAnnounce={setAnnouncement}
            />
            <MetricCard
              title="Mutations"
              value={metrics?.narrative_mutations_total || 0}
              color="text-blue-400"
              description="Total number of successful state updates (mutations) processed by the lab."
              onAnnounce={setAnnouncement}
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
                <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                  <a
                    href="http://localhost:3000"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 px-4 py-2 rounded-lg border border-slate-700 flex items-center gap-2 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 focus-visible:ring-emerald-500 focus-visible:outline-none"
                    aria-label="Launch live Grafana dashboard in a new tab (opens in a new tab)"
                    title="Opens Grafana dashboard in a new tab (http://localhost:3000)"
                  >
                    <span>Launch Live Dashboard</span>
                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  </a>
                  <button
                    type="button"
                    onClick={handleCopyGrafanaUrl}
                    className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 px-3 py-2 rounded-lg border border-slate-700 flex items-center gap-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 focus-visible:ring-emerald-500 focus-visible:outline-none"
                    aria-label={copiedGrafanaUrl ? "Grafana dashboard URL copied to clipboard" : "Copy Grafana dashboard URL to clipboard"}
                    title="Copy Grafana URL (http://localhost:3000)"
                  >
                    {copiedGrafanaUrl ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                        <span className="text-emerald-400 font-medium">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Copy URL</span>
                      </>
                    )}
                  </button>
                </div>
             </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function MetricCard({
  title,
  value,
  color,
  description,
  onAnnounce,
}: {
  title: string;
  value: number | string;
  color: string;
  description?: string;
  onAnnounce?: (msg: string) => void;
}) {
  const [highlight, setHighlight] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [copied, setCopied] = useState(false);
  const prevValue = useRef(value);

  useEffect(() => {
    if (prevValue.current !== value) {
      setHighlight(true);
      prevValue.current = value;
      const timer = setTimeout(() => setHighlight(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [value]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${title}: ${value}`);
      setCopied(true);
      if (onAnnounce) {
        onAnnounce(`${title} metric copied to clipboard: ${value}`);
      }
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error(`Failed to copy ${title} metric`, e);
      if (onAnnounce) {
        onAnnounce(`Failed to copy ${title} metric to clipboard.`);
      }
    }
  };

  let highlightClass = 'border-emerald-500/50 bg-slate-800/80 shadow-lg shadow-emerald-500/5';
  if (color.includes('rose')) {
    highlightClass = 'border-rose-500/50 bg-slate-800/80 shadow-lg shadow-rose-500/5';
  } else if (color.includes('amber')) {
    highlightClass = 'border-amber-500/50 bg-slate-800/80 shadow-lg shadow-amber-500/5';
  } else if (color.includes('blue')) {
    highlightClass = 'border-blue-500/50 bg-slate-800/80 shadow-lg shadow-blue-500/5';
  }

  const cardId = `metric-desc-${title.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <div
      className={`p-4 rounded-xl border transition-all duration-300 ${
        highlight ? `${highlightClass} scale-[1.02]` : 'bg-slate-900 border-slate-700'
      }`}
      aria-live="polite"
    >
      <div className="flex items-center justify-between text-xs font-medium text-slate-500 uppercase mb-1">
        <span>{title}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleCopy}
            aria-label={copied ? `${title} metric copied: ${value}` : `Copy ${title} metric value (${value})`}
            title={copied ? 'Copied to clipboard!' : `Copy ${title}: ${value}`}
            className="cursor-pointer transition-colors flex items-center text-slate-500 hover:text-emerald-400 focus-visible:text-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-500 rounded p-0.5 focus-visible:outline-none"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
            ) : (
              <Copy className="w-3.5 h-3.5" aria-hidden="true" />
            )}
          </button>
          {description && (
            <button
              type="button"
              onClick={() => setShowInfo(!showInfo)}
              aria-expanded={showInfo}
              aria-controls={cardId}
              className={`cursor-pointer transition-colors flex items-center focus-visible:ring-2 focus-visible:ring-emerald-500 rounded p-0.5 focus-visible:outline-none ${
                showInfo ? 'text-emerald-400 bg-slate-800' : 'text-slate-500 hover:text-emerald-400 focus-visible:text-emerald-400'
              }`}
              title={showInfo ? `Hide ${title} description` : description}
              aria-label={showInfo ? `Hide ${title} description` : `${title} description: ${description}`}
            >
              <Info className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
      <div className={`text-2xl font-bold transition-transform duration-300 ${color} ${highlight ? 'scale-105 origin-left' : ''}`}>
        {value}
      </div>
      {description && (
        <p
          id={cardId}
          className={`text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-800/80 leading-relaxed font-normal normal-case transition-all duration-200 ${
            showInfo ? 'block' : 'hidden'
          }`}
        >
          {description}
        </p>
      )}
    </div>
  );
}

export default App;
