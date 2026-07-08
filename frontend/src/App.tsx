import { useState, useEffect } from 'react';
import { Shield, Activity, RefreshCw, Trash2, Key } from 'lucide-react';

const API_BASE = 'http://localhost:8080';

function App() {
  const [token, setToken] = useState<string>('');
  const [userId, setUserId] = useState('student_01');
  const [role, setRole] = useState('admin');
  const [metrics, setMetrics] = useState<any>(null);
  const [status, setStatus] = useState('Idle');

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
    } catch (e) {
      setStatus('Connection Failed');
    }
  };

  const handleRevoke = async () => {
    if (!token) return;
    setStatus('Revoking...');
    try {
      const res = await fetch(API_BASE + '/revoke', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token },
      });
      const data = await res.json();
      setStatus(data.status || data.error);
    } catch (e) {
      setStatus('Revocation Failed');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8 font-sans">
      <header className="max-w-6xl mx-auto flex justify-between items-center mb-12">
        <div className="flex items-center gap-3">
          <Shield className="w-10 h-10 text-emerald-400" />
          <h1 className="text-3xl font-bold tracking-tight">NexxusFlow <span className="text-emerald-400">JWT Lab</span></h1>
        </div>
        <div className="flex items-center gap-2 bg-slate-800 px-4 py-2 rounded-full border border-slate-700">
          <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span className="text-sm font-medium">System Status: {status}</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <Key className="w-5 h-5 text-emerald-400" /> Token Management
          </h2>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">User ID</label>
              <input
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="admin">Admin</option>
                <option value="operator">Operator</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 mb-6">
            <button
              onClick={handleAuth}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Issue Token
            </button>
            <button
              onClick={handleRevoke}
              disabled={!token}
              className="flex-1 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-700 text-white font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" /> Revoke
            </button>
          </div>

          {token && (
            <div className="mt-6">
              <label className="block text-sm font-medium text-slate-400 mb-1">Active JWT</label>
              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 break-all font-mono text-xs text-emerald-300">
                {token}
              </div>
            </div>
          )}
        </section>

        <section className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-400" /> Live Metrics
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <MetricCard title="Auth Success" value={metrics?.auth_success_total || 0} color="text-emerald-400" />
            <MetricCard title="Auth Failures" value={metrics?.auth_failure_total || 0} color="text-rose-400" />
            <MetricCard title="Rate Limited" value={metrics?.rate_limit_rejections_total || 0} color="text-amber-400" />
            <MetricCard title="Mutations" value={metrics?.narrative_mutations_total || 0} color="text-blue-400" />
          </div>

          <div className="mt-8">
             <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Grafana Observability</h3>
             <div className="aspect-video bg-slate-900 rounded-lg border border-slate-700 flex items-center justify-center">
                <span className="text-slate-500 text-sm italic">Grafana Dashboard (Iframe placeholder)</span>
             </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function MetricCard({ title, value, color }: { title: string, value: number | string, color: string }) {
  return (
    <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
      <div className="text-xs font-medium text-slate-500 uppercase mb-1">{title}</div>
      <div className={'text-2xl font-bold ' + color}>{value}</div>
    </div>
  );
}

export default App;
