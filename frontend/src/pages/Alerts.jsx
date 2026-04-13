import { useEffect, useState } from 'react';
import Spinner from '../components/Spinner';
import ErrorBanner from '../components/ErrorBanner';
import { useAuth } from '../context/AuthContext';
import { formatFirestoreError, subscribeToAlerts, subscribeToRecommendations, subscribeToUserSalesData } from '../services/salesDataService';

function severityClasses(severity) {
  if (severity === 'high') return 'border-rose-400/40 bg-rose-500/10 text-rose-200';
  if (severity === 'medium') return 'border-amber-400/40 bg-amber-500/10 text-amber-200';
  return 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200';
}

function alertIcon(type) {
  if (type === 'LOW_STOCK') return 'LS';
  if (type === 'SALES_DROP') return 'SD';
  return 'AL';
}

function recommendationTone(action) {
  if (action.toLowerCase().includes('restock')) return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200';
  if (action.toLowerCase().includes('promote') || action.toLowerCase().includes('promotion')) {
    return 'border-amber-400/30 bg-amber-500/10 text-amber-200';
  }
  return 'border-cyan-400/30 bg-cyan-500/10 text-cyan-200';
}

export default function AlertsPage() {
  const { user, authLoading } = useAuth();

  const [alerts, setAlerts] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [salesRows, setSalesRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return () => {};

    if (!user?.uid) {
      setAlerts([]);
      setRecommendations([]);
      setLoading(false);
      return () => {};
    }

    setLoading(true);
    setError('');

    let alertsReady = false;
    let recReady = false;
    let salesReady = false;

    const done = () => {
      if (alertsReady && recReady && salesReady) {
        setLoading(false);
      }
    };

    const unsubSales = subscribeToUserSalesData(
      user.uid,
      (rows) => {
        setSalesRows(rows);
        salesReady = true;
        done();
      },
      (snapshotError) => {
        setError(formatFirestoreError(snapshotError, 'Failed to load sales data.'));
        salesReady = true;
        done();
      }
    );

    const unsubAlerts = subscribeToAlerts(
      user.uid,
      (rows) => {
        setAlerts(rows);
        alertsReady = true;
        done();
      },
      () => {
        setAlerts([]);
        alertsReady = true;
        done();
      }
    );

    const unsubRecommendations = subscribeToRecommendations(
      user.uid,
      (rows) => {
        setRecommendations(rows);
        recReady = true;
        done();
      },
      () => {
        setRecommendations([]);
        recReady = true;
        done();
      }
    );

    return () => {
      unsubSales();
      unsubAlerts();
      unsubRecommendations();
    };
  }, [authLoading, user?.uid]);

  const computedAlerts = alerts.length
    ? alerts
    : (() => {
        if (!salesRows.length) return [];

        const latestByProduct = salesRows.reduce((acc, row) => {
          const key = row.productName || 'Unknown';
          const existing = acc[key];
          const rowTime = new Date(row.date).getTime();
          const existingTime = existing ? new Date(existing.date).getTime() : 0;
          if (!existing || rowTime > existingTime) {
            acc[key] = row;
          }
          return acc;
        }, {});

        return Object.values(latestByProduct)
          .filter((row) => Number(row.stock || 0) < 10)
          .map((row) => ({
            id: row.id,
            type: 'LOW_STOCK',
            message: `Low stock for ${row.productName}`,
            severity: Number(row.stock || 0) < 5 ? 'high' : 'medium',
            createdAt: new Date().toISOString()
          }));
      })();

  const computedRecommendations = recommendations.length
    ? recommendations
    : (() => {
        if (!computedAlerts.length) return [];
        return computedAlerts.map((item) => ({
          id: `${item.id || item.type}-rec`,
          action: `Restock ${item.message.replace('Low stock for ', '')}`,
          productName: item.message.replace('Low stock for ', ''),
          reason: 'Inventory threshold breached.'
        }));
      })();

  if (loading) return <Spinner label="Loading alerts" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Alerts & Recommendations</h1>
          <p className="mt-1 text-sm text-slate-400">Stay ahead with real-time warnings and smart suggestions</p>
        </div>
        <button type="button" onClick={() => setError('')} className="rounded-lg bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700">
          Realtime Mode
        </button>
      </div>

      <ErrorBanner message={error} />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
          <p className="mb-3 text-sm font-medium text-slate-300">Alerts List</p>

          <div className="space-y-3">
            {computedAlerts.length ? (
              computedAlerts.map((alert, idx) => (
                <div key={alert.id || idx} className={`rounded-xl border p-3 ${severityClasses(alert.severity)}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full border border-current/30 text-xs font-bold">
                        {alertIcon(alert.type)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{(alert.type || 'ALERT').replace('_', ' ')}</p>
                        <p className="text-sm">{alert.message}</p>
                      </div>
                    </div>

                    <span className="rounded-full bg-slate-900/35 px-2 py-1 text-[10px] uppercase tracking-wide">
                      {alert.severity}
                    </span>
                  </div>

                  <p className="mt-2 text-xs opacity-80">{new Date(alert.createdAt || Date.now()).toLocaleString()}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">No active alerts.</p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
          <p className="mb-3 text-sm font-medium text-slate-300">Recommendations Panel</p>

          <div className="space-y-3">
            {computedRecommendations.length ? (
              computedRecommendations.map((rec, idx) => (
                <div key={rec.id || `${rec.productName}-${idx}`} className={`rounded-xl border p-3 ${recommendationTone(rec.action || '')}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{rec.action}</p>
                    <span className="rounded-full bg-slate-900/30 px-2 py-1 text-[10px] uppercase">Suggestion</span>
                  </div>
                  <p className="mt-1 text-sm">{rec.productName}</p>
                  <p className="mt-1 text-xs opacity-90">{rec.reason}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">No recommendations yet.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
