import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Spinner from '../components/Spinner';
import ErrorBanner from '../components/ErrorBanner';
import { useAuth } from '../context/AuthContext';
import {
  subscribeToAlerts,
  subscribeToForecasts,
  subscribeToRecommendations,
  subscribeToUploads,
  subscribeToUserSalesData
} from '../services/salesDataService';

const fallbackTrend = [
  { date: '2026-04-07', sales: 140 },
  { date: '2026-04-08', sales: 156 },
  { date: '2026-04-09', sales: 171 },
  { date: '2026-04-10', sales: 165 },
  { date: '2026-04-11', sales: 182 },
  { date: '2026-04-12', sales: 198 },
  { date: '2026-04-13', sales: 210 }
];

const fallbackProducts = [
  { productName: 'Product A', sales: 220 },
  { productName: 'Product B', sales: 175 },
  { productName: 'Product C', sales: 120 },
  { productName: 'Product D', sales: 95 }
];

export default function DashboardPage() {
  const { user } = useAuth();

  const [salesRows, setSalesRows] = useState([]);
  const [uploadRows, setUploadRows] = useState([]);
  const [alertRows, setAlertRows] = useState([]);
  const [recommendationRows, setRecommendationRows] = useState([]);
  const [forecastRows, setForecastRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      setSalesRows([]);
      setUploadRows([]);
      return () => {};
    }

    setLoading(true);
    setError('');

    let salesInitialized = false;
    let uploadsInitialized = false;
    let alertsInitialized = false;
    let recInitialized = false;
    let forecastInitialized = false;

    const doneInit = () => {
      if (salesInitialized && uploadsInitialized && alertsInitialized && recInitialized && forecastInitialized) {
        setLoading(false);
      }
    };

    const unsubSales = subscribeToUserSalesData(
      user.uid,
      (rows) => {
        setSalesRows(rows);
        salesInitialized = true;
        doneInit();
      },
      (snapshotError) => {
        setError(snapshotError.message || 'Failed to load sales data');
        salesInitialized = true;
        doneInit();
      }
    );

    const unsubUploads = subscribeToUploads(
      user.uid,
      (rows) => {
        setUploadRows(rows);
        uploadsInitialized = true;
        doneInit();
      },
      () => {
        setUploadRows([]);
        uploadsInitialized = true;
        doneInit();
      }
    );

    const unsubAlerts = subscribeToAlerts(
      user.uid,
      (rows) => {
        setAlertRows(rows);
        alertsInitialized = true;
        doneInit();
      },
      () => {
        setAlertRows([]);
        alertsInitialized = true;
        doneInit();
      }
    );

    const unsubRecommendations = subscribeToRecommendations(
      user.uid,
      (rows) => {
        setRecommendationRows(rows);
        recInitialized = true;
        doneInit();
      },
      () => {
        setRecommendationRows([]);
        recInitialized = true;
        doneInit();
      }
    );

    const unsubForecasts = subscribeToForecasts(
      user.uid,
      (rows) => {
        setForecastRows(rows);
        forecastInitialized = true;
        doneInit();
      },
      () => {
        setForecastRows([]);
        forecastInitialized = true;
        doneInit();
      }
    );

    return () => {
      unsubSales();
      unsubUploads();
      unsubAlerts();
      unsubRecommendations();
      unsubForecasts();
    };
  }, [user?.uid]);

  const trendData = useMemo(() => {
    if (!salesRows.length) return fallbackTrend;

    const grouped = salesRows.reduce((acc, row) => {
      const key = new Date(row.date).toISOString().slice(0, 10);
      acc[key] = (acc[key] || 0) + Number(row.sales || 0);
      return acc;
    }, {});

    const rows = Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, sales]) => ({ date, sales }));

    return rows.length ? rows : fallbackTrend;
  }, [salesRows]);

  const productData = useMemo(() => {
    if (!salesRows.length) return fallbackProducts;

    const grouped = salesRows.reduce((acc, row) => {
      const name = row.productName || 'Unknown';
      acc[name] = (acc[name] || 0) + Number(row.sales || 0);
      return acc;
    }, {});

    const rows = Object.entries(grouped)
      .map(([productName, sales]) => ({ productName, sales }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 6);

    return rows.length ? rows : fallbackProducts;
  }, [salesRows]);

  const alerts = useMemo(() => {
    if (alertRows.length) {
      return alertRows;
    }

    if (!salesRows.length) {
      return [
        { type: 'LOW_STOCK', message: 'Low stock for Product A', severity: 'high' },
        { type: 'SALES_DROP', message: 'Sales dropped by 25%', severity: 'medium' }
      ];
    }

    const latestByProduct = salesRows.reduce((acc, row) => {
      const key = row.productName || 'Unknown';
      const existing = acc[key];
      if (!existing || new Date(row.date).getTime() > new Date(existing.date).getTime()) {
        acc[key] = row;
      }
      return acc;
    }, {});

    const lowStock = Object.values(latestByProduct)
      .filter((row) => Number(row.stock || 0) < 10)
      .map((row) => ({
        type: 'LOW_STOCK',
        message: `Low stock for ${row.productName}`,
        severity: 'high'
      }));

    const recent = trendData.slice(-2);
    const salesDrop =
      recent.length === 2 && recent[0].sales > 0 && recent[1].sales < recent[0].sales * 0.8
        ? [{ type: 'SALES_DROP', message: 'Sales dropped by more than 20% from the previous day.', severity: 'medium' }]
        : [];

    const rows = [...lowStock, ...salesDrop];
    return rows.length
      ? rows
      : [{ type: 'STABLE', message: 'No critical alerts. Business health looks stable.', severity: 'low' }];
  }, [alertRows, salesRows, trendData]);

  const recommendations = useMemo(() => {
    if (recommendationRows.length) {
      return recommendationRows.map((item) => item.reason || item.action || 'Recommendation');
    }

    const rows = [];

    const lowStockAlert = alerts.find((item) => item.type === 'LOW_STOCK');
    if (lowStockAlert) {
      rows.push('Restock low inventory products to prevent missed sales.');
    }

    if (productData.length) {
      rows.push(`Promote ${productData[0].productName} since it is currently the top performer.`);
    }

    const salesDropAlert = alerts.find((item) => item.type === 'SALES_DROP');
    if (salesDropAlert) {
      rows.push('Launch a short retention campaign to recover sales momentum.');
    }

    return rows.length ? rows : ['Maintain current strategy and keep monitoring daily trends.'];
  }, [alerts, productData, recommendationRows]);

  const kpi = useMemo(() => {
    const totalSales = trendData.reduce((sum, row) => sum + Number(row.sales || 0), 0);
    const baseline = Number(trendData[0]?.sales || 0);
    const latest = Number(trendData[trendData.length - 1]?.sales || 0);
    const growthPercent = baseline > 0 ? ((latest - baseline) / baseline) * 100 : 0;

    return {
      totalSales,
      revenue: totalSales,
      uploadsCount: uploadRows.length,
      growthPercent: Math.round(growthPercent * 10) / 10,
      forecastPoints: forecastRows.length
    };
  }, [trendData, uploadRows.length, forecastRows.length]);

  if (loading) return <Spinner label="Loading dashboard" />;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-700 bg-slate-900/55 p-6">
        <h1 className="text-3xl font-bold tracking-tight text-white">Business Intelligence Dashboard</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          Monitor real-time sales and inventory performance, review alerts, and act on smart recommendations.
        </p>
      </section>

      <ErrorBanner message={error} />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Total Sales</p>
          <p className="mt-2 text-3xl font-semibold text-white">{kpi.totalSales}</p>
        </article>
        <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Revenue</p>
          <p className="mt-2 text-3xl font-semibold text-white">${kpi.revenue}</p>
        </article>
        <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Data Uploads</p>
          <p className="mt-2 text-3xl font-semibold text-cyan-300">{kpi.uploadsCount}</p>
        </article>
        <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Growth</p>
          <p className={`mt-2 text-3xl font-semibold ${kpi.growthPercent >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
            {kpi.growthPercent}%
          </p>
        </article>
        <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 sm:col-span-2 xl:col-span-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Forecast Points Loaded</p>
          <p className="mt-2 text-2xl font-semibold text-cyan-300">{kpi.forecastPoints}</p>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 xl:col-span-2">
          <p className="mb-3 text-sm font-medium text-slate-200">Sales Trend</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="4 4" stroke="#334155" />
                <XAxis dataKey="date" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Line dataKey="sales" type="monotone" stroke="#22c55e" strokeWidth={2.5} isAnimationActive />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
          <p className="mb-3 text-sm font-medium text-slate-200">Top Products</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productData}>
                <CartesianGrid strokeDasharray="4 4" stroke="#334155" />
                <XAxis dataKey="productName" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Bar dataKey="sales" fill="#38bdf8" radius={[7, 7, 0, 0]} isAnimationActive />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
          <p className="mb-3 text-sm font-medium text-slate-200">Smart Alerts</p>
          <div className="space-y-3">
            {alerts.map((item, idx) => (
              <div key={`${item.type}-${idx}`} className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3">
                <p className="text-sm font-semibold text-rose-200">{item.type.replace('_', ' ')}</p>
                <p className="text-sm text-slate-100">{item.message}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
          <p className="mb-3 text-sm font-medium text-slate-200">Recommendations</p>
          <div className="space-y-3">
            {recommendations.map((item) => (
              <div key={item} className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                <p className="text-sm text-slate-100">{item}</p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
