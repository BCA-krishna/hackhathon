import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Spinner from '../components/Spinner';
import ErrorBanner from '../components/ErrorBanner';
import { useAuth } from '../context/AuthContext';
import { useAnalytics } from '../context/AnalyticsContext';
import {
  formatFirestoreError,
  subscribeToAlerts,
  subscribeToForecasts,
  subscribeToRecommendations,
  subscribeToUploads,
  subscribeToUserSalesData
} from '../services/salesDataService';

export default function DashboardPage() {
  const { user } = useAuth();
  const { updateAnalytics } = useAnalytics();

  const [salesRows, setSalesRows] = useState([]);
  const [uploadRows, setUploadRows] = useState([]);
  const [alertRows, setAlertRows] = useState([]);
  const [recommendationRows, setRecommendationRows] = useState([]);
  const [forecastRows, setForecastRows] = useState([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [comparisonMode, setComparisonMode] = useState('current');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const inDateRange = (value) => {
    const time = new Date(value).getTime();
    const fromOk = dateFrom ? time >= new Date(dateFrom).getTime() : true;
    const toOk = dateTo ? time <= new Date(dateTo).getTime() : true;
    return fromOk && toOk;
  };

  const filteredSalesRows = useMemo(() => {
    if (!salesRows.length) return [];
    if (!dateFrom && !dateTo) return salesRows;
    return salesRows.filter((row) => inDateRange(row.date));
  }, [salesRows, dateFrom, dateTo]);

  const windowRows = useMemo(() => {
    if (!salesRows.length) {
      return { current: [], previous: [] };
    }

    const latestTime = Math.max(...salesRows.map((row) => new Date(row.date).getTime()));
    const msPerDay = 24 * 60 * 60 * 1000;
    const currentStart = latestTime - 6 * msPerDay;
    const previousEnd = currentStart - msPerDay;
    const previousStart = previousEnd - 6 * msPerDay;

    const current = salesRows.filter((row) => {
      const t = new Date(row.date).getTime();
      return t >= currentStart && t <= latestTime;
    });

    const previous = salesRows.filter((row) => {
      const t = new Date(row.date).getTime();
      return t >= previousStart && t <= previousEnd;
    });

    return { current, previous };
  }, [salesRows]);

  const analysisRows = useMemo(() => {
    if (dateFrom || dateTo) {
      return filteredSalesRows;
    }

    if (comparisonMode === 'last7') {
      return windowRows.previous;
    }

    return windowRows.current;
  }, [dateFrom, dateTo, filteredSalesRows, comparisonMode, windowRows]);

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
        setError(formatFirestoreError(snapshotError, 'Failed to load sales data'));
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
    if (!analysisRows.length) return [];
    const grouped = analysisRows.reduce((acc, row) => {
      // Robust: always convert to ISO string for consistency
      let dateObj = row.date instanceof Date ? row.date : new Date(row.date);
      if (isNaN(dateObj.getTime())) return acc; // skip invalid dates
      const key = dateObj.toISOString().slice(0, 10);
      acc[key] = (acc[key] || 0) + Number(row.sales || 0);
      return acc;
    }, {});
    const rows = Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, sales]) => ({ date, sales }));
    // Debug: log the trend data
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log('TrendData (filtered):', rows);
    }
    return rows;
  }, [analysisRows]);

  const productData = useMemo(() => {
    if (!salesRows.length) return [];
    if (!analysisRows.length) return [];

    const grouped = analysisRows.reduce((acc, row) => {
      const name = row.productName || 'Unknown';
      acc[name] = (acc[name] || 0) + Number(row.sales || 0);
      return acc;
    }, {});

    const rows = Object.entries(grouped)
      .map(([productName, sales]) => ({ productName, sales }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 6);

    return rows;
  }, [salesRows, analysisRows]);

  const topProductsChartData = useMemo(() => {
    const total = productData.reduce((sum, row) => sum + Number(row.sales || 0), 0);
    return productData.map((row, index) => ({
      ...row,
      rank: index + 1,
      share: total > 0 ? (Number(row.sales || 0) / total) * 100 : 0
    }));
  }, [productData]);

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

  const compactNumber = (value) =>
    new Intl.NumberFormat(undefined, {
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(Number(value || 0));

  const toPercent = (value) => `${Number(value || 0).toFixed(1)}%`;

  const productPerformance = useMemo(() => {
    if (!salesRows.length) return [];

    if (!analysisRows.length) {
      return [];
    }

    const grouped = analysisRows.reduce((acc, row) => {
      const name = row.productName || 'Unknown';
      acc[name] = (acc[name] || 0) + Number(row.sales || 0);
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([productName, sales]) => ({ productName, sales }))
      .sort((a, b) => b.sales - a.sales);
  }, [salesRows, analysisRows]);

  const growthByProduct = useMemo(() => {
    const sourceRows = analysisRows.length ? analysisRows : salesRows;
    const grouped = sourceRows.reduce((acc, row) => {
      const key = row.productName || 'Unknown';
      const day = new Date(row.date).toISOString().slice(0, 10);
      if (!acc[key]) acc[key] = {};
      acc[key][day] = (acc[key][day] || 0) + Number(row.sales || 0);
      return acc;
    }, {});

    return Object.entries(grouped).reduce((acc, [productName, dayMap]) => {
      const points = Object.entries(dayMap)
        .map(([date, sales]) => ({ date, sales }))
        .sort((a, b) => a.date.localeCompare(b.date));

      if (points.length < 2 || Number(points[points.length - 2].sales || 0) <= 0) {
        acc[productName] = 0;
      } else {
        const prev = Number(points[points.length - 2].sales || 0);
        const latest = Number(points[points.length - 1].sales || 0);
        acc[productName] = ((latest - prev) / prev) * 100;
      }

      return acc;
    }, {});
  }, [salesRows, analysisRows]);

  const topSellingProducts = useMemo(() => productPerformance.slice(0, 3), [productPerformance]);
  const lowSellingProducts = useMemo(() => [...productPerformance].reverse().slice(0, 3), [productPerformance]);

  const categoryPerformance = useMemo(() => {
    if (!analysisRows.length) return [];

    const grouped = analysisRows.reduce((acc, row) => {
      const category = row.category || row.productCategory || 'Uncategorized';
      acc[category] = (acc[category] || 0) + Number(row.sales || 0);
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([category, sales]) => ({ category, sales }))
      .sort((a, b) => b.sales - a.sales);
  }, [analysisRows]);

  const topCategories = useMemo(() => categoryPerformance.slice(0, 3), [categoryPerformance]);
  const lowCategories = useMemo(() => [...categoryPerformance].reverse().slice(0, 3), [categoryPerformance]);

  const profitPerformance = useMemo(() => {
    if (!analysisRows.length) return [];

    const grouped = analysisRows.reduce((acc, row) => {
      const productName = row.productName || 'Unknown';
      const profit = Number(
        row.profit ??
          ((Number(row.price || 0) - Number(row.cost || 0)) * Number(row.quantity || 0)) ??
          0
      );

      acc[productName] = (acc[productName] || 0) + (Number.isFinite(profit) ? profit : 0);
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([productName, profit]) => ({ productName, profit }))
      .sort((a, b) => b.profit - a.profit);
  }, [analysisRows]);

  const topProfitProducts = useMemo(() => profitPerformance.slice(0, 3), [profitPerformance]);
  const lowProfitProducts = useMemo(() => [...profitPerformance].reverse().slice(0, 3), [profitPerformance]);

  const strategicSuggestions = useMemo(() => {
    const rows = [];
    const topOne = topSellingProducts[0];
    const lowOne = lowSellingProducts[0];

    if (topOne) {
      rows.push(`Scale ads for ${topOne.productName}; it is currently your best seller.`);
    }

    if (lowOne) {
      rows.push(`Run bundle pricing for ${lowOne.productName} to improve low sales conversion.`);
    }

    const decliningTop = topSellingProducts.find((item) => Number(growthByProduct[item.productName] || 0) < 0);
    if (decliningTop) {
      rows.push(`Watch ${decliningTop.productName}; recent momentum is down despite strong total sales.`);
    }

    if (!rows.length) {
      rows.push('No strong outliers in selected range. Continue monitoring daily performance.');
    }

    return rows;
  }, [topSellingProducts, lowSellingProducts, growthByProduct]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!topSellingProducts.length) return;

    const topProduct = topSellingProducts[0];
    const growth = Number(growthByProduct[topProduct.productName] || 0);
    if (growth >= 0) return;

    const dayKey = new Date().toISOString().slice(0, 10);
    const alertKey = `neg-growth-mail-${topProduct.productName}-${comparisonMode}-${dayKey}`;
    if (window.localStorage.getItem(alertKey)) return;

    const to = user?.email || '';
    const subject = encodeURIComponent(`Action needed: ${topProduct.productName} growth is negative`);
    const body = encodeURIComponent(
      `Top product ${topProduct.productName} shows negative momentum (${growth.toFixed(1)}%). Please review pricing, promotions, and stock strategy.`
    );

    window.localStorage.setItem(alertKey, 'sent');
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
  }, [topSellingProducts, growthByProduct, comparisonMode, user?.email]);

  const formatGrowth = (value) => {
    if (value > 0.1) return `↑ ${value.toFixed(1)}%`;
    if (value < -0.1) return `↓ ${Math.abs(value).toFixed(1)}%`;
    return '→ 0.0%';
  };

  const growthColor = (value) => {
    if (value > 0.1) return 'text-emerald-300';
    if (value < -0.1) return 'text-rose-300';
    return 'text-slate-300';
  };

  const handleDownloadTopLowReport = () => {
    const lines = ['segment,productName,totalSales,growthPercent'];

    topSellingProducts.forEach((item) => {
      lines.push(`top,${item.productName},${item.sales},${(growthByProduct[item.productName] || 0).toFixed(2)}`);
    });

    lowSellingProducts.forEach((item) => {
      lines.push(`low,${item.productName},${item.sales},${(growthByProduct[item.productName] || 0).toFixed(2)}`);
    });

    const blob = new Blob([`${lines.join('\n')}\n`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'top-low-sales-report.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const alerts = useMemo(() => {
    if (alertRows.length) {
      return alertRows;
    }

    if (!salesRows.length) {
      return [{ type: 'NO_DATA', message: 'No sales dataset found. Upload data to generate alerts.', severity: 'low' }];
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

  const normalizedAlerts = useMemo(() => {
    const severityWeight = { high: 3, medium: 2, low: 1 };

    const actionByType = {
      LOW_STOCK: 'Reorder and raise safety stock for impacted products.',
      SALES_DROP: 'Run short-term retention + discount campaign and review pricing.',
      NO_DATA: 'Upload/import dataset to activate live alerts.',
      STABLE: 'Keep monitoring daily trends and weekly demand shifts.'
    };

    return alerts
      .map((item, index) => {
        const severity = item.severity || (item.type === 'LOW_STOCK' ? 'high' : 'low');
        return {
          id: `${item.type || 'ALERT'}-${index}`,
          type: item.type || 'ALERT',
          title: String(item.type || 'ALERT').replace(/_/g, ' '),
          message: item.message || 'Alert generated from current business data.',
          severity,
          actionHint: actionByType[item.type] || 'Review this signal and take corrective action.'
        };
      })
      .sort((a, b) => (severityWeight[b.severity] || 0) - (severityWeight[a.severity] || 0));
  }, [alerts]);

  const alertSummary = useMemo(() => {
    return normalizedAlerts.reduce(
      (acc, item) => {
        acc.total += 1;
        acc[item.severity] = (acc[item.severity] || 0) + 1;
        return acc;
      },
      { total: 0, high: 0, medium: 0, low: 0 }
    );
  }, [normalizedAlerts]);

  const recommendations = useMemo(() => {
    if (recommendationRows.length) {
      return recommendationRows.map((item, index) => ({
        id: `${item.action || 'recommendation'}-${item.productName || 'all'}-${index}`,
        action: item.action || 'Review business performance',
        reason: item.reason || 'Recommendation based on current data.',
        productName: item.productName || 'All Products',
        priority: item.priority || 'medium',
        confidence: Number(item.confidence || 75),
        expectedImpact: item.expectedImpact || 'Potentially improve business outcomes in the selected range.',
        metric: item.metric || ''
      }));
    }

    const rows = [];

    const lowStockAlert = alerts.find((item) => item.type === 'LOW_STOCK');
    if (lowStockAlert) {
      rows.push({
        id: 'fallback-restock',
        action: 'Restock critical items',
        reason: 'Low inventory can cause lost sales and customer churn.',
        productName: 'Inventory',
        priority: 'high',
        confidence: 86,
        expectedImpact: 'Protect revenue by preventing stock-outs.',
        metric: 'Trigger: Low stock alert'
      });
    }

    if (productData.length) {
      rows.push({
        id: 'fallback-promote-top',
        action: `Scale promotion for ${productData[0].productName}`,
        reason: 'Top performer has momentum and can deliver faster returns on campaign spend.',
        productName: productData[0].productName,
        priority: 'medium',
        confidence: 82,
        expectedImpact: 'Improve short-term sales lift from proven demand.',
        metric: `Current sales: ${Number(productData[0].sales || 0).toLocaleString()}`
      });
    }

    const salesDropAlert = alerts.find((item) => item.type === 'SALES_DROP');
    if (salesDropAlert) {
      rows.push({
        id: 'fallback-recover-demand',
        action: 'Launch short demand recovery campaign',
        reason: 'Recent trend indicates a meaningful short-term demand drop.',
        productName: 'All Products',
        priority: 'high',
        confidence: 84,
        expectedImpact: 'Recover weekly run-rate and reduce prolonged decline risk.',
        metric: 'Trigger: Sales drop alert'
      });
    }

    return rows.length
      ? rows
      : [
          {
            id: 'fallback-stable',
            action: 'Maintain current strategy',
            reason: 'No high-risk anomalies detected in selected window.',
            productName: 'All Products',
            priority: 'low',
            confidence: 72,
            expectedImpact: 'Sustain current business performance while monitoring trends.',
            metric: 'System status: Stable'
          }
        ];
  }, [alerts, productData, recommendationRows]);

  const prioritizedRecommendations = useMemo(() => {
    const priorityRank = { high: 0, medium: 1, low: 2 };
    return [...recommendations].sort((a, b) => {
      const pDiff = (priorityRank[a.priority] ?? 99) - (priorityRank[b.priority] ?? 99);
      if (pDiff !== 0) return pDiff;
      return Number(b.confidence || 0) - Number(a.confidence || 0);
    });
  }, [recommendations]);

  const recommendationSummary = useMemo(() => {
    return prioritizedRecommendations.reduce(
      (acc, item) => {
        acc.total += 1;
        acc[item.priority] = (acc[item.priority] || 0) + 1;
        return acc;
      },
      { total: 0, high: 0, medium: 0, low: 0 }
    );
  }, [prioritizedRecommendations]);

  const priorityBadgeClass = (priority) => {
    if (priority === 'high') return 'border-rose-500/40 bg-rose-500/10 text-rose-200';
    if (priority === 'low') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200';
    return 'border-amber-500/40 bg-amber-500/10 text-amber-200';
  };

  const alertBadgeClass = (severity) => {
    if (severity === 'high') return 'border-rose-500/40 bg-rose-500/10 text-rose-200';
    if (severity === 'medium') return 'border-amber-500/40 bg-amber-500/10 text-amber-200';
    return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200';
  };

  const alertCardClass = (severity) => {
    if (severity === 'high') return 'border-rose-500/30 bg-rose-500/10';
    if (severity === 'medium') return 'border-amber-500/30 bg-amber-500/10';
    return 'border-emerald-500/30 bg-emerald-500/10';
  };

  const executionWindow = (priority) => {
    if (priority === 'high') return 'Act within 24 hours';
    if (priority === 'medium') return 'Plan within 2-3 days';
    return 'Track in weekly review';
  };

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

  useEffect(() => {
    if (salesRows.length > 0) {
      updateAnalytics({
        totalRevenue: kpi.revenue,
        records: kpi.totalSales,
        topProducts: topSellingProducts,
        lowProducts: lowSellingProducts,
        lowStockItems: alerts.filter(a => a.type === 'LOW_STOCK').map(a => a.message),
        alerts: normalizedAlerts,
        weekComparison: {
          currentWeek: windowRows.current.reduce((sum, item) => sum + Number(item.sales || 0), 0),
          previousWeek: windowRows.previous.reduce((sum, item) => sum + Number(item.sales || 0), 0),
          growth: (windowRows.previous.reduce((sum, item) => sum + Number(item.sales || 0), 0) > 0)
            ? ((windowRows.current.reduce((sum, item) => sum + Number(item.sales || 0), 0) - windowRows.previous.reduce((sum, item) => sum + Number(item.sales || 0), 0)) / windowRows.previous.reduce((sum, item) => sum + Number(item.sales || 0), 0)) * 100
            : 0
        }
      });
    }
  }, [kpi, topSellingProducts, lowSellingProducts, normalizedAlerts, windowRows, salesRows.length, updateAnalytics]);

  if (loading) return <Spinner label="Loading dashboard" />;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-700 bg-slate-900/55 p-6">
        <h1 className="text-3xl font-bold tracking-tight text-white">Business Intelligence Dashboard</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          Monitor real-time sales and inventory performance, review alerts, and act on smart recommendations.
        </p>
        {!salesRows.length ? <p className="mt-2 text-xs text-amber-300">No dataset found. Import/upload data to view analytics.</p> : null}
      </section>

      <ErrorBanner message={error} />

      <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative group">
            <label className="mb-1 block text-xs font-medium text-slate-400 group-focus-within:text-cyan-400 transition-colors">From</label>
            <div className="relative">
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className="w-full rounded-xl border border-slate-600 bg-slate-900/80 px-4 py-2.5 pl-10 text-sm text-white focus:border-cyan-500/50 focus:outline-none focus:ring-4 focus:ring-cyan-500/10 transition-all"
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none group-focus-within:text-cyan-400 transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
            </div>
          </div>
          <div className="relative group">
            <label className="mb-1 block text-xs font-medium text-slate-400 group-focus-within:text-cyan-400 transition-colors">To</label>
            <div className="relative">
              <input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                className="w-full rounded-xl border border-slate-600 bg-slate-900/80 px-4 py-2.5 pl-10 text-sm text-white focus:border-cyan-500/50 focus:outline-none focus:ring-4 focus:ring-cyan-500/10 transition-all"
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none group-focus-within:text-cyan-400 transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setDateFrom('');
              setDateTo('');
            }}
            className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
          >
            Reset Filter
          </button>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={() => setComparisonMode('current')}
              className={`rounded-lg px-3 py-2 text-xs ${comparisonMode === 'current' ? 'bg-cyan-500/30 text-cyan-200' : 'bg-slate-800 text-slate-300'}`}
            >
              Current 7 Days
            </button>
            <button
              type="button"
              onClick={() => setComparisonMode('last7')}
              className={`rounded-lg px-3 py-2 text-xs ${comparisonMode === 'last7' ? 'bg-cyan-500/30 text-cyan-200' : 'bg-slate-800 text-slate-300'}`}
            >
              Last 7 Days
            </button>
          </div>
        </div>
      </section>

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
          {!trendData.length ? <p className="mt-2 text-xs text-slate-400">No trend data for selected range.</p> : null}
        </article>

        <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
          <div className="mb-3 flex items-end justify-between gap-2">
            <p className="text-sm font-medium text-slate-200">Top Products</p>
            <p className="text-xs text-slate-400">Share-based ranking for quick action</p>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProductsChartData} layout="vertical" margin={{ top: 8, right: 18, bottom: 8, left: 12 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="#334155" />
                <XAxis type="number" stroke="#94a3b8" tickFormatter={compactNumber} />
                <YAxis type="category" dataKey="productName" width={100} stroke="#94a3b8" tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value, name, item) => {
                    if (name !== 'sales') return [value, name];
                    const row = item?.payload || {};
                    return [`${Number(value || 0).toLocaleString()} (${toPercent(row.share)})`, 'Sales (share)'];
                  }}
                />
                <ReferenceLine x={topProductsAverage} stroke="#f59e0b" strokeDasharray="6 4" />
                <Bar
                  dataKey="sales"
                  fill="#38bdf8"
                  radius={[7, 7, 7, 7]}
                  isAnimationActive
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
          {!topProductsChartData.length ? <p className="mt-2 text-xs text-slate-400">No product data for selected range.</p> : null}
          {topProductsChartData.length ? (
            <div className="mt-3 grid gap-2">
              <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">Top Product</p>
                <p className="mt-1 text-sm font-semibold text-cyan-200">{topProductsInsights.leaderName}</p>
                <p className="text-xs text-slate-300">
                  {topProductsInsights.leaderSales.toLocaleString()} sales ({toPercent(topProductsInsights.leaderShare)})
                </p>
              </div>
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">Concentration Risk</p>
                <p className="mt-1 text-sm font-semibold text-amber-200">Top 3 products drive {toPercent(topProductsInsights.topThreeShare)}</p>
                <p className="text-xs text-slate-300">Leader gap vs #2: +{topProductsInsights.gapToRunnerUp.toLocaleString()} sales</p>
              </div>
            </div>
          ) : null}
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-emerald-300">Top Selling Products</p>
            <button
              type="button"
              onClick={handleDownloadTopLowReport}
              className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200 hover:bg-cyan-500/20"
            >
              Download Top-Low Report
            </button>
          </div>
          <div className="space-y-2">
            {topSellingProducts.map((item, idx) => (
              <div key={`${item.productName}-${idx}`} className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                <p className="text-sm font-medium text-slate-100">{item.productName}</p>
                <div className="text-right">
                  <p className="text-sm font-semibold text-emerald-300">{item.sales}</p>
                  <p className={`text-xs ${growthColor(growthByProduct[item.productName] || 0)}`}>
                    {formatGrowth(growthByProduct[item.productName] || 0)}
                  </p>
                </div>
              </div>
            ))}
            {!topSellingProducts.length ? <p className="text-sm text-slate-400">No products in selected date range.</p> : null}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
          <p className="mb-3 text-sm font-medium text-amber-300">Low Selling Products</p>
          <div className="space-y-2">
            {lowSellingProducts.map((item, idx) => (
              <div key={`${item.productName}-${idx}`} className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                <p className="text-sm font-medium text-slate-100">{item.productName}</p>
                <div className="text-right">
                  <p className="text-sm font-semibold text-amber-300">{item.sales}</p>
                  <p className={`text-xs ${growthColor(growthByProduct[item.productName] || 0)}`}>
                    {formatGrowth(growthByProduct[item.productName] || 0)}
                  </p>
                </div>
              </div>
            ))}
            {!lowSellingProducts.length ? <p className="text-sm text-slate-400">No products in selected date range.</p> : null}
          </div>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
        <p className="mb-3 text-sm font-medium text-cyan-300">Strategic Suggestions</p>
        <div className="space-y-2">
          {strategicSuggestions.map((item) => (
            <div key={item} className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3">
              <p className="text-sm text-slate-100">{item}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
          <p className="mb-3 text-sm font-medium text-sky-300">Category-wise Top/Low</p>
          <div className="space-y-3">
            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">Top Categories</p>
              <div className="space-y-2">
                {topCategories.map((item) => (
                  <div key={item.category} className="flex items-center justify-between rounded-xl border border-sky-500/30 bg-sky-500/10 p-3">
                    <p className="text-sm text-slate-100">{item.category}</p>
                    <p className="text-sm font-semibold text-sky-300">{item.sales}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">Low Categories</p>
              <div className="space-y-2">
                {lowCategories.map((item) => (
                  <div key={`low-${item.category}`} className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                    <p className="text-sm text-slate-100">{item.category}</p>
                    <p className="text-sm font-semibold text-amber-300">{item.sales}</p>
                  </div>
                ))}
              </div>
            </div>
            {!categoryPerformance.length ? <p className="text-sm text-slate-400">No category field found in current rows.</p> : null}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
          <p className="mb-3 text-sm font-medium text-violet-300">Profit-based Top/Low</p>
          <div className="space-y-3">
            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">Top Profit Products</p>
              <div className="space-y-2">
                {topProfitProducts.map((item) => (
                  <div key={`tp-${item.productName}`} className="flex items-center justify-between rounded-xl border border-violet-500/30 bg-violet-500/10 p-3">
                    <p className="text-sm text-slate-100">{item.productName}</p>
                    <p className="text-sm font-semibold text-violet-300">{item.profit.toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">Low Profit Products</p>
              <div className="space-y-2">
                {lowProfitProducts.map((item) => (
                  <div key={`lp-${item.productName}`} className="flex items-center justify-between rounded-xl border border-rose-500/30 bg-rose-500/10 p-3">
                    <p className="text-sm text-slate-100">{item.productName}</p>
                    <p className="text-sm font-semibold text-rose-300">{item.profit.toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>
            {!profitPerformance.some((item) => Math.abs(item.profit) > 0) ? (
              <p className="text-sm text-slate-400">Add profit/cost/price fields to get stronger profit analysis.</p>
            ) : null}
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
          <div className="mb-3 flex items-end justify-between gap-2">
            <p className="text-sm font-medium text-slate-200">Smart Alerts</p>
            <p className="text-xs text-slate-400">High: {alertSummary.high} | Medium: {alertSummary.medium} | Low: {alertSummary.low}</p>
          </div>
          <div className="space-y-3">
            {normalizedAlerts.map((item) => (
              <div key={item.id} className={`rounded-xl border p-3 ${alertCardClass(item.severity)}`}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-100">{item.title}</p>
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-wide ${alertBadgeClass(item.severity)}`}>
                    {item.severity}
                  </span>
                </div>
                <p className="text-sm text-slate-100">{item.message}</p>
                <p className="mt-1 text-xs text-slate-300">Next action: {item.actionHint}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
          <div className="mb-3 flex items-end justify-between gap-2">
            <p className="text-sm font-medium text-slate-200">Recommendations</p>
            <p className="text-xs text-slate-400">Top priority: {recommendationSummary.high} high-impact actions</p>
          </div>
          {prioritizedRecommendations[0] ? (
            <div className="mb-3 rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3">
              <p className="text-xs uppercase tracking-wide text-cyan-300">Best Next Action</p>
              <p className="mt-1 text-sm font-semibold text-slate-100">{prioritizedRecommendations[0].action}</p>
              <p className="text-xs text-slate-300">{executionWindow(prioritizedRecommendations[0].priority)}</p>
            </div>
          ) : null}
          <div className="space-y-3">
            {prioritizedRecommendations.map((item, index) => (
              <div key={item.id} className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-100">
                    {index + 1}. {item.action}
                  </p>
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-wide ${priorityBadgeClass(item.priority)}`}>
                    {item.priority} priority
                  </span>
                </div>
                <p className="text-xs text-slate-300">{item.reason}</p>
                <div className="mt-2 grid gap-2 text-xs text-slate-300 sm:grid-cols-2">
                  <p>
                    <span className="text-slate-400">Scope:</span> {item.productName}
                  </p>
                  <p>
                    <span className="text-slate-400">Confidence:</span> {Math.min(99, Math.max(1, Number(item.confidence || 0)))}%
                  </p>
                </div>
                <p className="mt-1 text-xs text-emerald-200">Impact: {item.expectedImpact}</p>
                {item.metric ? <p className="mt-1 text-xs text-cyan-200">Metric: {item.metric}</p> : null}
                <p className="mt-1 text-xs text-slate-400">Execution window: {executionWindow(item.priority)}</p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
