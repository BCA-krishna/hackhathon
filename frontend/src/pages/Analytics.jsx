import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  ComposedChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import Spinner from '../components/Spinner';
import ErrorBanner from '../components/ErrorBanner';
import { useAuth } from '../context/AuthContext';
import { formatFirestoreError, subscribeToUserSalesData } from '../services/salesDataService';

const monthLabel = (value) => {
  if (!value) return '';
  const date = new Date(`${value}-01T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
};

const compactNumber = (value) =>
  new Intl.NumberFormat(undefined, {
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(Number(value || 0));

const percent = (value) => `${Number(value || 0).toFixed(1)}%`;

function MonthlySalesTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;

  const barPoint = payload.find((entry) => entry.dataKey === 'sales');
  const trendPoint = payload.find((entry) => entry.dataKey === 'trend');
  const sales = Number(barPoint?.value || 0);
  const trend = Number(trendPoint?.value || 0);
  const mom = Number(barPoint?.payload?.momChange || 0);

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/95 px-3 py-2 text-xs text-slate-100 shadow-lg">
      <p className="font-semibold text-cyan-200">{monthLabel(label)}</p>
      <p className="mt-1">Sales: {sales.toLocaleString()}</p>
      <p>Trend (3M avg): {trend.toLocaleString(undefined, { maximumFractionDigits: 1 })}</p>
      <p className={mom >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
        MoM: {mom >= 0 ? '+' : ''}
        {mom.toFixed(1)}%
      </p>
    </div>
  );
}

export default function AnalyticsPage() {
  const { user, authLoading } = useAuth();
  const [salesRows, setSalesRows] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState('All Products');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return () => {};

    if (!user?.uid) {
      setSalesRows([]);
      setLoading(false);
      return () => {};
    }

    setLoading(true);
    setError('');

    const unsub = subscribeToUserSalesData(
      user.uid,
      (rows) => {
        setSalesRows(rows);
        setLoading(false);
      },
      (snapshotError) => {
        setError(formatFirestoreError(snapshotError, 'Failed to load analytics data'));
        setLoading(false);
      }
    );

    return () => unsub();
  }, [authLoading, user?.uid]);

  const analyticsRows = salesRows;

  const productOptions = useMemo(() => {
    const unique = Array.from(new Set(analyticsRows.map((row) => row.productName || 'Unknown'))).sort((a, b) =>
      a.localeCompare(b)
    );
    return ['All Products', ...unique];
  }, [analyticsRows]);

  const scopedRows = useMemo(() => {
    if (selectedProduct === 'All Products') return analyticsRows;
    return analyticsRows.filter((row) => (row.productName || 'Unknown') === selectedProduct);
  }, [analyticsRows, selectedProduct]);

  const dailySales = useMemo(() => {
    const grouped = scopedRows.reduce((acc, row) => {
      const day = new Date(row.date).toISOString().slice(0, 10);
      acc[day] = (acc[day] || 0) + Number(row.sales || 0);
      return acc;
    }, {});

    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, sales]) => ({ date, sales }));
  }, [scopedRows]);

  const topProducts = useMemo(() => {
    const grouped = analyticsRows.reduce((acc, row) => {
      const key = row.productName || 'Unknown';
      acc[key] = (acc[key] || 0) + Number(row.sales || 0);
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([productName, sales]) => ({ productName, sales }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 8);
  }, [analyticsRows]);

  const topProductsChartData = useMemo(() => {
    const total = topProducts.reduce((sum, row) => sum + Number(row.sales || 0), 0);

    return topProducts.map((row, index) => ({
      ...row,
      rank: index + 1,
      share: total > 0 ? (Number(row.sales || 0) / total) * 100 : 0
    }));
  }, [topProducts]);

  const topProductsInsights = useMemo(() => {
    if (!topProductsChartData.length) {
      return {
        leaderName: 'N/A',
        leaderSales: 0,
        leaderShare: 0,
        gapToRunnerUp: 0,
        topThreeShare: 0
      };
    }

    const leader = topProductsChartData[0];
    const runnerUp = topProductsChartData[1];
    const topThreeShare = topProductsChartData.slice(0, 3).reduce((sum, row) => sum + Number(row.share || 0), 0);

    return {
      leaderName: leader.productName,
      leaderSales: Number(leader.sales || 0),
      leaderShare: Number(leader.share || 0),
      gapToRunnerUp: Math.max(0, Number(leader.sales || 0) - Number(runnerUp?.sales || 0)),
      topThreeShare
    };
  }, [topProductsChartData]);

  const topProductsAverage = useMemo(() => {
    if (!topProductsChartData.length) return 0;
    return topProductsChartData.reduce((sum, row) => sum + Number(row.sales || 0), 0) / topProductsChartData.length;
  }, [topProductsChartData]);

  const stockTrend = useMemo(() => {
    const grouped = scopedRows.reduce((acc, row) => {
      const day = new Date(row.date).toISOString().slice(0, 10);
      acc[day] = (acc[day] || 0) + Number(row.stock || 0);
      return acc;
    }, {});

    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, stock]) => ({ date, stock }));
  }, [scopedRows]);

  const monthlySales = useMemo(() => {
    const grouped = scopedRows.reduce((acc, row) => {
      const month = new Date(row.date).toISOString().slice(0, 7);
      acc[month] = (acc[month] || 0) + Number(row.sales || 0);
      return acc;
    }, {});

    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, sales]) => ({ month, sales }));
  }, [scopedRows]);

  const monthlySalesChartData = useMemo(() => {
    return monthlySales.map((item, index, arr) => {
      const prev = index > 0 ? Number(arr[index - 1].sales || 0) : 0;
      const momChange = prev > 0 ? ((Number(item.sales || 0) - prev) / prev) * 100 : 0;

      const slice = arr.slice(Math.max(0, index - 2), index + 1);
      const trend =
        slice.reduce((sum, point) => sum + Number(point.sales || 0), 0) /
        (slice.length || 1);

      return {
        ...item,
        shortMonth: monthLabel(item.month),
        trend,
        momChange
      };
    });
  }, [monthlySales]);

  const monthlyAverage = useMemo(() => {
    if (!monthlySalesChartData.length) return 0;
    return (
      monthlySalesChartData.reduce((sum, row) => sum + Number(row.sales || 0), 0) /
      monthlySalesChartData.length
    );
  }, [monthlySalesChartData]);

  const yearSales = useMemo(() => {
    const grouped = scopedRows.reduce((acc, row) => {
      const year = new Date(row.date).toISOString().slice(0, 4);
      acc[year] = (acc[year] || 0) + Number(row.sales || 0);
      return acc;
    }, {});

    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([year, sales]) => ({ year, sales }));
  }, [scopedRows]);

  const currentMonthSales = monthlySales.length ? Number(monthlySales[monthlySales.length - 1].sales || 0) : 0;
  const currentYearSales = yearSales.length ? Number(yearSales[yearSales.length - 1].sales || 0) : 0;
  const previousMonthSales = monthlySales.length > 1 ? Number(monthlySales[monthlySales.length - 2].sales || 0) : 0;
  const momGrowth = previousMonthSales > 0 ? ((currentMonthSales - previousMonthSales) / previousMonthSales) * 100 : 0;

  const perProductTrend = useMemo(() => {
    const grouped = analyticsRows.reduce((acc, row) => {
      const productName = row.productName || 'Unknown';
      const day = new Date(row.date).toISOString().slice(0, 10);
      if (!acc[productName]) {
        acc[productName] = {};
      }
      acc[productName][day] = (acc[productName][day] || 0) + Number(row.sales || 0);
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([productName, byDay]) => {
        const trend = Object.entries(byDay)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, sales]) => ({ date, sales }));
        const totalSales = trend.reduce((sum, item) => sum + Number(item.sales || 0), 0);
        return { productName, totalSales, trend };
      })
      .sort((a, b) => b.totalSales - a.totalSales)
      .slice(0, 6);
  }, [analyticsRows]);

  const metrics = useMemo(() => {
    const totalSales = dailySales.reduce((sum, row) => sum + Number(row.sales || 0), 0);
    const avgDailySales = dailySales.length ? totalSales / dailySales.length : 0;

    return {
      totalSales,
      avgDailySales: Math.round(avgDailySales * 10) / 10,
      recordsCount: analyticsRows.length,
      productsTracked: topProducts.length
    };
  }, [dailySales, analyticsRows.length, topProducts.length]);

  if (loading) return <Spinner label="Loading analytics" />;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-700 bg-slate-900/60 p-6">
        <h1 className="text-3xl font-bold tracking-tight text-white">Sales Analytics</h1>
        <p className="mt-2 text-sm text-slate-300">Track your sales performance with real-time charts and insights.</p>
        {!salesRows.length ? <p className="mt-2 text-xs text-amber-300">No live data found yet. Upload records to view analytics.</p> : null}
      </section>

      <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
        <label className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Track Specific Product</label>
        <select
          value={selectedProduct}
          onChange={(event) => setSelectedProduct(event.target.value)}
          className="w-full max-w-sm rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
        >
          {productOptions.map((productName) => (
            <option key={productName} value={productName}>
              {productName}
            </option>
          ))}
        </select>
      </section>

      <ErrorBanner message={error} />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Total Sales</p>
          <p className="mt-2 text-3xl font-semibold text-white">{metrics.totalSales}</p>
        </article>
        <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Avg Daily Sales</p>
          <p className="mt-2 text-3xl font-semibold text-cyan-300">{metrics.avgDailySales}</p>
        </article>
        <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Records Tracked</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-300">{metrics.recordsCount}</p>
        </article>
        <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Products Tracked</p>
          <p className="mt-2 text-3xl font-semibold text-amber-300">{metrics.productsTracked}</p>
        </article>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Current Month Sales ({selectedProduct})</p>
          <p className="mt-2 text-3xl font-semibold text-cyan-300">{currentMonthSales}</p>
        </article>
        <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Current Year Sales ({selectedProduct})</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-300">{currentYearSales}</p>
        </article>
        <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">MoM Growth ({selectedProduct})</p>
          <p className={`mt-2 text-3xl font-semibold ${momGrowth >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
            {momGrowth >= 0 ? '↑' : '↓'} {Math.abs(momGrowth).toFixed(1)}%
          </p>
          <p className="mt-1 text-xs text-slate-500">Compared to previous month</p>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 xl:col-span-2">
          <p className="mb-3 text-sm font-medium text-slate-200">Daily Sales Trend</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailySales}>
                <CartesianGrid strokeDasharray="4 4" stroke="#334155" />
                <XAxis dataKey="date" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Line type="monotone" dataKey="sales" stroke="#22c55e" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
          <div className="mb-3 flex items-end justify-between gap-2">
            <p className="text-sm font-medium text-slate-200">Top Products by Sales</p>
            <p className="text-xs text-slate-400">Rank + share visibility for faster decisions</p>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProductsChartData} layout="vertical" margin={{ top: 8, right: 18, bottom: 8, left: 14 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="#334155" />
                <XAxis type="number" stroke="#94a3b8" tickFormatter={compactNumber} />
                <YAxis type="category" dataKey="productName" width={110} stroke="#94a3b8" tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value, name, item) => {
                    if (name !== 'sales') return [value, name];
                    const row = item?.payload || {};
                    return [`${Number(value || 0).toLocaleString()} (${percent(row.share)})`, 'Sales (share)'];
                  }}
                />
                <ReferenceLine x={topProductsAverage} stroke="#f59e0b" strokeDasharray="6 4" />
                <Bar
                  dataKey="sales"
                  fill="#38bdf8"
                  radius={[6, 6, 6, 6]}
                  label={{
                    position: 'right',
                    fill: '#cbd5e1',
                    fontSize: 11,
                    formatter: (value) => compactNumber(value)
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {!topProductsChartData.length ? <p className="mt-2 text-xs text-slate-400">No top-product sales data available.</p> : null}
          {topProductsChartData.length ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">Top Product</p>
                <p className="mt-1 text-sm font-semibold text-cyan-200">{topProductsInsights.leaderName}</p>
                <p className="text-xs text-slate-300">
                  {topProductsInsights.leaderSales.toLocaleString()} sales ({percent(topProductsInsights.leaderShare)})
                </p>
              </div>
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">Leader Gap</p>
                <p className="mt-1 text-sm font-semibold text-amber-200">
                  +{topProductsInsights.gapToRunnerUp.toLocaleString()} vs #2 product
                </p>
                <p className="text-xs text-slate-300">Top 3 concentration: {percent(topProductsInsights.topThreeShare)}</p>
              </div>
            </div>
          ) : null}
        </article>
      </section>

      <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
        <p className="mb-3 text-sm font-medium text-slate-200">Inventory Stock Trend</p>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stockTrend}>
              <CartesianGrid strokeDasharray="4 4" stroke="#334155" />
              <XAxis dataKey="date" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip />
              <Area type="monotone" dataKey="stock" stroke="#f59e0b" fill="#f59e0b33" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <p className="text-sm font-medium text-slate-200">Monthly Sales ({selectedProduct})</p>
          <p className="text-xs text-slate-400">Bars = actual sales, line = rolling 3-month trend</p>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={monthlySalesChartData}>
              <CartesianGrid strokeDasharray="4 4" stroke="#334155" />
              <XAxis dataKey="shortMonth" stroke="#94a3b8" tick={{ fontSize: 12 }} />
              <YAxis stroke="#94a3b8" tickFormatter={compactNumber} width={56} />
              <Tooltip content={<MonthlySalesTooltip />} />
              <Legend />
              <ReferenceLine
                y={monthlyAverage}
                stroke="#f59e0b"
                strokeDasharray="6 4"
                name="Average"
                label={{ value: 'Avg', fill: '#fbbf24', position: 'insideTopRight', fontSize: 10 }}
              />
              <Bar name="Monthly Sales" dataKey="sales" fill="#22c55e" radius={[6, 6, 0, 0]} maxBarSize={42} />
              <Line
                name="3-Month Trend"
                type="monotone"
                dataKey="trend"
                stroke="#38bdf8"
                strokeWidth={2.5}
                dot={{ r: 2 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        {!monthlySalesChartData.length ? <p className="mt-2 text-xs text-slate-400">No monthly sales data available.</p> : null}
      </section>

      <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
        <p className="mb-3 text-sm font-medium text-slate-200">Product-wise Sales Trend Graphs</p>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {perProductTrend.map((item) => (
            <article key={item.productName} className="rounded-xl border border-slate-700 bg-slate-950/50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-100">{item.productName}</p>
                <p className="text-xs text-cyan-300">{item.totalSales}</p>
              </div>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={item.trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" stroke="#94a3b8" hide />
                    <YAxis stroke="#94a3b8" hide />
                    <Tooltip />
                    <Line type="monotone" dataKey="sales" stroke="#38bdf8" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}