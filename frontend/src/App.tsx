import { useState, useEffect, useRef } from 'react';
import { Shield, Activity, RefreshCw, Trash2, Key, Copy, Check, ExternalLink, Eye, EyeOff } from 'lucide-react';

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

function App() {
  const [token, setToken] = useState<string>('');
  const [showToken, setShowToken] = useState(false);
  const [copied, setCopied] = useState(false);
  const [userId, setUserId] = useState('student_01');
  const [role, setRole] = useState('admin');
  const [metrics, setMetrics] = useState<any>(null);
  const [status, setStatus] = useState('Idle');
  const [isIssuing, setIsIssuing] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);

  const fetchMetrics = async () => {
    try {
      const res = await fetch(API_BASE + '/metrics/snapshot');
      const data = await res.json();
      setMetrics(data);
    } catch (e) {
      console.error('Failed to fetch metrics', e);
    }
  };

  useEffect(() => {
    const timer = setInterval(fetchMetrics, 2000);
    return () => clearInterval(timer);
  }, []);

  const handleAuth = async () => {
    setStatus('Issuing Token...');
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
      } else {
        setStatus('Error: ' + data.error);
      }
    } catch {
      setStatus('Connection Failed');
    } finally {
      setIsIssuing(false);
    }
  };

  const handleRevoke = async () => {
    if (!token) return;
    setStatus('Revoking...');
    setIsRevoking(true);
    try {
      const res = await fetch(API_BASE + '/revoke', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token },
      });
      const data = await res.json();
      setStatus(data.status || data.error);
    } catch {
      setStatus('Revocation Failed');
    } finally {
      setIsRevoking(false);
    }
  };

  const handleCopy = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy token to clipboard', e);
    }
  };

  const getDisplayToken = (t: string) => {
    if (showToken) return t;
    if (t.length <= 24) return t;
    return `${t.slice(0, 12)}...${t.slice(-12)}`;
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8 font-sans">
      <header className="max-w-6xl mx-auto flex justify-between items-center mb-12">
        <div className="flex items-center gap-3">
          <Shield className="w-10 h-10 text-emerald-400" aria-hidden="true" />
          <h1 className="text-3xl font-bold tracking-tight">NexxusFlow <span className="text-emerald-400">JWT Lab</span></h1>
        </div>
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-300 ${
          status === 'Issuing Token...' || status === 'Revoking...'
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            : status.toLowerCase().includes('failed') || status.toLowerCase().includes('error')
            ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            : status === 'Token Issued' || status === 'token revoked' || status.toLowerCase().includes('revoked')
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            : 'bg-slate-800 border-slate-700 text-slate-300'
        }`}>
          {status === 'Issuing Token...' || status === 'Revoking...' ? (
            <RefreshCw className="w-4 h-4 animate-spin text-amber-400" aria-hidden="true" />
          ) : status.toLowerCase().includes('failed') || status.toLowerCase().includes('error') ? (
            <Activity className="w-4 h-4 text-rose-400 animate-bounce" style={{ animationDuration: '2s' }} aria-hidden="true" />
          ) : status === 'Token Issued' || status === 'token revoked' || status.toLowerCase().includes('revoked') ? (
            <Check className="w-4 h-4 text-emerald-400" aria-hidden="true" />
          ) : (
            <Activity className="w-4 h-4 text-emerald-400 animate-pulse" aria-hidden="true" />
          )}
          <span className="text-sm font-medium" role="status" aria-live="polite">System Status: {status}</span>
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
              if (!isIssuing && !isRevoking) {
                handleAuth();
              }
            }}
            className="mb-6"
          >
            <div className="space-y-4 mb-6">
              <div>
                <label htmlFor="userId" className="block text-sm font-medium text-slate-400 mb-1">
                  User ID <span className="text-rose-500" aria-hidden="true">*</span>
                </label>
                <input
                  id="userId"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  required
                  placeholder="e.g., student_01"
                  aria-describedby="userId-helper"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 focus-visible:ring-emerald-500 focus-visible:outline-none outline-none transition-all duration-150"
                />
                <p id="userId-helper" className="text-xs text-slate-500 mt-1">
                  The subject claim (sub) that uniquely identifies this user in the issued token.
                </p>
              </div>
              <div>
                <label htmlFor="role" className="block text-sm font-medium text-slate-400 mb-1">Role</label>
                <select
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  aria-describedby="role-helper"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 focus-visible:ring-emerald-500 focus-visible:outline-none outline-none transition-all duration-150"
                >
                  <option value="admin">Admin</option>
                  <option value="operator">Operator</option>
                  <option value="viewer">Viewer</option>
                </select>
                <p id="role-helper" className="text-xs text-slate-500 mt-1">
                  Assigned permissions role added to the JWT payload claims for role-based access control.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isIssuing || isRevoking}
                title={isIssuing || isRevoking ? "Action in progress" : ""}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 focus-visible:ring-emerald-500 focus-visible:outline-none"
              >
                <RefreshCw className={`w-4 h-4 ${isIssuing ? 'animate-spin' : ''}`} aria-hidden="true" /> {isIssuing ? 'Issuing...' : 'Issue Token'}
              </button>
              <button
                type="button"
                onClick={handleRevoke}
                disabled={!token || isIssuing || isRevoking}
                title={!token ? "No active token to revoke" : isIssuing || isRevoking ? "Action in progress" : ""}
                className="flex-1 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-700 text-white font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 focus-visible:ring-rose-500 focus-visible:outline-none"
              >
                <Trash2 className={`w-4 h-4 ${isRevoking ? 'animate-pulse' : ''}`} aria-hidden="true" /> {isRevoking ? 'Revoking...' : 'Revoke'}
              </button>
            </div>
          </form>

          {token ? (
            <div className="mt-6 space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-sm font-medium text-slate-400">Active JWT</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="text-xs bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-emerald-400 px-2.5 py-1 rounded border border-slate-700 flex items-center gap-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 focus-visible:ring-emerald-500 focus-visible:outline-none"
                      aria-label={showToken ? "Hide raw JWT" : "Show raw JWT"}
                    >
                      {showToken ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Hide</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Show</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="text-xs bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-emerald-400 px-2.5 py-1 rounded border border-slate-700 flex items-center gap-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 focus-visible:ring-emerald-500 focus-visible:outline-none"
                      aria-label={copied ? "Token copied to clipboard" : "Copy token to clipboard"}
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
                        </>
                      )}
                    </button>
                  </div>
                </div>
                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 break-all font-mono text-xs text-emerald-300">
                  {getDisplayToken(token)}
                </div>
              </div>

              <div>
                <span className="block text-sm font-medium text-slate-400 mb-1.5">Decoded Payload (Claims)</span>
                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-xs text-amber-300 overflow-x-auto whitespace-pre-wrap break-all">
                  {JSON.stringify(decodePayload(token), null, 2)}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-6 p-6 rounded-xl border border-dashed border-slate-700 bg-slate-900/30 text-center">
              <p className="text-sm text-slate-400">
                No active JWT. Fill in the credentials above and click{" "}
                <strong className="text-emerald-400 font-semibold">Issue Token</strong> to generate one.
              </p>
            </div>
          )}
        </section>

        <section className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-400" aria-hidden="true" /> Live Metrics
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <MetricCard title="Auth Success" value={metrics?.auth_success_total || 0} color="text-emerald-400" />
            <MetricCard title="Auth Failures" value={metrics?.auth_failure_total || 0} color="text-rose-400" />
            <MetricCard title="Rate Limited" value={metrics?.rate_limit_rejections_total || 0} color="text-amber-400" />
            <MetricCard title="Mutations" value={metrics?.narrative_mutations_total || 0} color="text-blue-400" />
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
                  className="mt-2 text-xs bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-emerald-400 px-4 py-2 rounded-lg border border-slate-700 flex items-center gap-2 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 focus-visible:ring-emerald-500 focus-visible:outline-none"
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

function MetricCard({ title, value, color }: { title: string, value: number | string, color: string }) {
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
      <div className="text-xs font-medium text-slate-500 uppercase mb-1">{title}</div>
      <div className={`text-2xl font-bold transition-transform duration-300 ${color} ${highlight ? 'scale-105 origin-left' : ''}`}>
        {value}
      </div>
    </div>
  );
}

export default App;
