import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import Spinner from '../components/Spinner';
import ErrorBanner from '../components/ErrorBanner';
import { useAuth } from '../context/AuthContext';
import { formatFirestoreError, subscribeToForecasts, subscribeToUserSalesData } from '../services/salesDataService';

export default function ForecastPage() {
  const { user, authLoading } = useAuth();

  const [salesRows, setSalesRows] = useState([]);
  const [forecastRows, setForecastRows] = useState([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('All Products');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return () => {};

    if (!user?.uid) {
      setSalesRows([]);
      setForecastRows([]);
      setLoading(false);
      return () => {};
    }

    setLoading(true);
    setError('');

    let salesReady = false;
    let forecastsReady = false;

    const done = () => {
      if (salesReady && forecastsReady) {
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

    const unsubForecasts = subscribeToForecasts(
      user.uid,
      (rows) => {
        setForecastRows(rows);
        forecastsReady = true;
        done();
      },
      () => {
        setForecastRows([]);
        forecastsReady = true;
        done();
      }
    );

    return () => {
      unsubSales();
      unsubForecasts();
    };
  }, [authLoading, user?.uid]);

  const dailyTrends = useMemo(() => {
    const grouped = salesRows.reduce((acc, row) => {
      const key = new Date(row.date).toISOString().slice(0, 10);
      acc[key] = (acc[key] || 0) + Number(row.sales || 0);
      return acc;
    }, {});

    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, sales]) => ({ date, sales }));
  }, [salesRows]);

  const topProducts = useMemo(() => {
    const grouped = salesRows.reduce((acc, row) => {
      const productName = row.productName || 'Unknown';
      acc[productName] = (acc[productName] || 0) + Number(row.sales || 0);
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([productName, sales]) => ({ productName, sales }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 8);
  }, [salesRows]);

  const forecast = useMemo(() => {
    if (!forecastRows.length) {
      if (!dailyTrends.length) {
        return {
          method: 'moving_average',
          window: 0,
          predictions: []
        };
      }

      const values = dailyTrends.map((row) => Number(row.sales || 0));
      const window = Math.min(5, values.length || 1);
      const movingAverage = values.length
        ? values.slice(-window).reduce((sum, val) => sum + val, 0) / window
        : 0;
      const startDate = dailyTrends.length ? new Date(dailyTrends[dailyTrends.length - 1].date) : new Date();

      return {
        method: 'moving_average',
        window,
        predictions: Array.from({ length: 7 }).map((_, idx) => {
          const nextDate = new Date(startDate);
          nextDate.setDate(startDate.getDate() + idx + 1);
          return {
            date: nextDate.toISOString().slice(0, 10),
            predictedSales: Math.round(movingAverage * 100) / 100
          };
        })
      };
    }

    return {
      method: forecastRows[0].method || 'moving_average',
      window: Number(forecastRows[0].window || 0),
      predictions: forecastRows.map((item) => ({
        date: item.date,
        predictedSales: Number(item.predictedSales || 0)
      }))
    };
  }, [forecastRows, dailyTrends]);

  const productOptions = useMemo(
    () => ['All Products', ...topProducts.map((item) => item.productName)],
    [topProducts]
  );

  const combinedSeries = useMemo(() => {
    const historical = dailyTrends.map((item) => ({
      date: item.date,
      historicalSales: Number(item.sales),
      predictedSales: null
    }));

    const totalTopProductSales = topProducts.reduce((sum, item) => sum + Number(item.sales || 0), 0);
    const selectedShare =
      selectedProduct === 'All Products'
        ? 1
        : Number(topProducts.find((item) => item.productName === selectedProduct)?.sales || 0) /
          (totalTopProductSales || 1);

    const predictions = (forecast.predictions || []).map((item) => ({
      date: item.date,
      historicalSales: null,
      predictedSales: Math.round(Number(item.predictedSales) * selectedShare * 100) / 100
    }));

    return [...historical, ...predictions].filter((row) => {
      const time = new Date(row.date).getTime();
      const fromOk = dateFrom ? time >= new Date(dateFrom).getTime() : true;
      const toOk = dateTo ? time <= new Date(dateTo).getTime() : true;
      return fromOk && toOk;
    });
  }, [dailyTrends, topProducts, selectedProduct, forecast.predictions, dateFrom, dateTo]);

  const metrics = useMemo(() => {
    const historical = combinedSeries.filter((item) => item.historicalSales != null);
    const predicted = combinedSeries.filter((item) => item.predictedSales != null);
    const histAvg = historical.length
      ? historical.reduce((sum, item) => sum + item.historicalSales, 0) / historical.length
      : 0;
    const predAvg = predicted.length
      ? predicted.reduce((sum, item) => sum + item.predictedSales, 0) / predicted.length
      : 0;
    const expectedGrowth = histAvg > 0 ? ((predAvg - histAvg) / histAvg) * 100 : 0;

    return {
      expectedGrowth: Math.round(expectedGrowth * 10) / 10,
      demandTrend: expectedGrowth >= 5 ? 'Rising demand' : expectedGrowth <= -5 ? 'Declining demand' : 'Stable demand'
    };
  }, [combinedSeries]);

  if (loading) return <Spinner label="Generating forecast" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Sales Forecast</h1>
          <p className="mt-1 text-sm text-slate-400">Predict future trends using real-time Firebase data</p>
          {!salesRows.length ? <p className="mt-1 text-xs text-amber-300">No live data found yet. Upload records to view forecast.</p> : null}
        </div>
        <button type="button" onClick={() => setError('')} className="rounded-lg bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700">
          Realtime Mode
        </button>
      </div>

      <ErrorBanner message={error} />

      <div className="grid gap-3 rounded-2xl border border-slate-700 bg-slate-900/70 p-4 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs text-slate-400">Date range (from)</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-400">Date range (to)</label>
          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-400">Product selection</label>
          <select
            value={selectedProduct}
            onChange={(event) => setSelectedProduct(event.target.value)}
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
          >
            {productOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="h-[440px] rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
        <p className="mb-3 text-sm font-medium text-slate-300">Past vs Predicted Sales</p>
        <ResponsiveContainer width="100%" height="90%">
          <LineChart data={combinedSeries}>
            <CartesianGrid strokeDasharray="4 4" stroke="#334155" />
            <XAxis dataKey="date" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="historicalSales"
              name="Past sales"
              stroke="#38bdf8"
              strokeWidth={2}
              dot={false}
              isAnimationActive
            />
            <Line
              type="monotone"
              dataKey="predictedSales"
              name="Predicted future sales"
              stroke="#22c55e"
              strokeWidth={3}
              strokeDasharray="8 4"
              dot={false}
              isAnimationActive
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Expected growth</p>
          <p className={`mt-2 text-3xl font-semibold ${metrics.expectedGrowth >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
            {metrics.expectedGrowth}%
          </p>
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Demand trend</p>
          <p className="mt-2 text-xl font-semibold text-slate-100">{metrics.demandTrend}</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
        <p className="text-sm text-slate-300">Method: {forecast.method || 'moving_average'}</p>
        <p className="text-sm text-slate-400">Window: {forecast.window || 0} days</p>
      </div>
    </div>
  );
}
