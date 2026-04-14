import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { analyzeCustomerFeedback } from '../services/feedbackAnalysisService';
import { generateAIInsights } from '../services/aiInsightsService';
import { saveFeedbackAnalysis, subscribeFeedbackHistory, deleteAllFeedbackHistory } from '../services/feedbackHistoryService';

const SAMPLE_REVIEWS = [
  { rating: 5, comment: 'Delivery was fast and product quality is excellent. Packaging was neat.' },
  { rating: 2, comment: 'Delivery was late and the box was damaged.' },
  { rating: 4, comment: 'Great value for price, support team was very helpful.' },
  { rating: 1, comment: 'Product quality is poor and customer service response was slow.' },
  { rating: 3, comment: 'Pricing is okay but shipping took longer than expected.' }
];


import { useRef } from 'react';
export default function FeedbackInsightsPage() {
  const { user } = useAuth();
  const [rawInput, setRawInput] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [saving, setSaving] = useState(false);
  const [historyRows, setHistoryRows] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [realTime, setRealTime] = useState(false);
  const debounceRef = useRef();

  useEffect(() => {
    if (!user?.uid) {
      setHistoryRows([]);
      return () => {};
    }

    return subscribeFeedbackHistory(
      user.uid,
      (rows) => {
        setHistoryRows(rows);
      },
      () => {
        setHistoryRows([]);
      }
    );
  }, [user?.uid]);

  const sentimentPillClass = (sentiment) => {
    if (sentiment === 'Positive') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200';
    if (sentiment === 'Negative') return 'border-rose-500/40 bg-rose-500/10 text-rose-200';
    return 'border-amber-500/40 bg-amber-500/10 text-amber-200';
  };

  const totalReviews = useMemo(() => analysis?.reviewResults?.length || 0, [analysis]);
  const aiSource = analysis?.aiInsights?._meta?.source === 'live' ? 'live' : 'fallback';

  const aiSourceBadgeClass = aiSource === 'live'
    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
    : 'border-amber-500/40 bg-amber-500/10 text-amber-200';

  const chatbotContext = useMemo(() => ({
    product: {
      name: 'Customer Feedback Engine',
      category: 'SaaS analytics',
      launchQuarter: 'Q2 2026',
    },
    salesData: {
      trend: analysis?.summary?.sentiment?.negative?.includes('0%') ? 'up' : 'stable',
      monthlyRevenue: '$42.5k',
      conversionRate: '4.1%'
    },
    feedbackSummary: {
      overallSentiment: analysis?.summary?.sentiment || {},
      painPoints: analysis?.summary?.themes?.negative || [],
      praisedFeatures: analysis?.summary?.themes?.positive || []
    },
    aiInsights: analysis?.aiInsights || {}
  }), [analysis]);

  const handleAnalyze = async (inputOverride) => {
    setError('');
    setInfo('');

    try {
      const parsed = JSON.parse(inputOverride !== undefined ? inputOverride : rawInput);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        setAnalysis(null);
        throw new Error('Please enter at least one review to analyze.');
      }

      parsed.forEach((item, idx) => {
        if (typeof item !== 'object' || item === null) {
          throw new Error(`Review ${idx + 1}: must be an object with rating and comment.`);
        }
        const rating = Number(item.rating);
        const comment = String(item.comment || '').trim();
        if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
          throw new Error(`Review ${idx + 1}: rating must be between 1 and 5.`);
        }
        if (!comment) {
          throw new Error(`Review ${idx + 1}: comment is required.`);
        }
      });

      const result = analyzeCustomerFeedback(parsed);

      // Step 1: Send summary to AI insights layer.
      const aiResponse = await generateAIInsights(result.summary);
      const enrichedAnalysis = {
        ...result,
        aiInsights: aiResponse
      };

      setAnalysis(enrichedAnalysis);

      if (user?.uid) {
        setSaving(true);
        try {
          // Step 2: Save complete payload including AI insights.
          await saveFeedbackAnalysis({
            userId: user.uid,
            reviews: parsed,
            analysis: enrichedAnalysis,
            aiInsights: aiResponse
          });
          setInfo('Analysis saved to Firestore history.');
        } catch {
          setError('Analysis generated, but saving to Firestore failed. Check Firestore rules.');
        } finally {
          setSaving(false);
        }
      } else {
        setInfo('Analysis generated locally. Sign in to save history in Firestore.');
      }
    } catch (parseError) {
      setAnalysis(null);
      setError(parseError.message || 'Invalid review input format.');
    }
  };

  // Real-time analysis effect
  useEffect(() => {
    if (!realTime) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      handleAnalyze(rawInput);
    }, 700);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line
  }, [rawInput, realTime]);

  const handleLoadHistory = (row) => {
    if (Array.isArray(row.reviews)) {
      setRawInput(JSON.stringify(row.reviews, null, 2));
      const localAnalysis = analyzeCustomerFeedback(row.reviews);
      setAnalysis({
        ...localAnalysis,
        aiInsights: row.aiInsights || {
          ...localAnalysis.aiInsights,
          _meta: {
            source: 'fallback'
          }
        }
      });
      setInfo('Loaded a saved analysis from history.');
      setError('');
      return;
    }

    setError('Selected history entry does not contain raw reviews.');
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-700 bg-slate-900/60 p-6">
        <h1 className="text-3xl font-bold tracking-tight text-white">AI Customer Feedback Analyzer</h1>
        <p className="mt-2 text-sm text-slate-300">
          Paste review data and generate sentiment summary, key themes, pain points, and business recommendations.
        </p>
      </section>


      <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 md:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-slate-100">Input Reviews</p>
            <p className="mt-1 text-xs text-slate-400">Paste a JSON array with rating (1-5) and comment fields.</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1 text-xs text-cyan-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={realTime}
                onChange={e => setRealTime(e.target.checked)}
                className="accent-cyan-500"
              />
              Real-Time Mode
            </label>
            <button
              type="button"
              onClick={() => setRawInput(JSON.stringify(SAMPLE_REVIEWS, null, 2))}
              className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 transition hover:bg-slate-800"
            >
              Load Sample
            </button>
            <button
              type="button"
              onClick={() => {
                setRawInput('');
                setAnalysis(analyzeCustomerFeedback(SAMPLE_REVIEWS));
                setError('');
                setInfo('Reviews reset to default.');
              }}
              className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-200 transition hover:bg-rose-500/20"
            >
              Reset Reviews
            </button>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap gap-2 text-[11px] text-slate-300">
          <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1">Format: JSON Array</span>
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1">Required: rating, comment</span>
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1">Rating range: 1 to 5</span>
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-950/80 p-2 shadow-inner shadow-black/20">
          <textarea
            value={rawInput}
            onChange={(event) => setRawInput(event.target.value)}
            className="h-64 w-full resize-y rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-xs leading-5 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20"
            placeholder={'[\n  { "rating": 5, "comment": "Fast delivery and good quality" }\n]'}
            disabled={saving}
          />
        </div>

        {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
        {info ? <p className="mt-2 text-xs text-emerald-300">{info}</p> : null}

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-[11px] text-slate-500">Tip: Use 20+ reviews for stronger trend and theme reliability.</p>
          <button
            type="button"
            onClick={() => handleAnalyze()}
            disabled={saving || realTime}
            className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-200 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {realTime ? 'Real-Time Mode On' : (saving ? 'Analyzing + Saving...' : 'Analyze Feedback')}
          </button>
        </div>
      </section>


      <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-slate-200">Analysis History (Firestore)</p>
          <div className="flex items-center gap-2">
            <p className="text-xs text-slate-400">{historyRows.length} saved runs</p>
            <button
              type="button"
              onClick={async () => {
                if (!user?.uid) return;
                await deleteAllFeedbackHistory(user.uid);
                setInfo('Analysis history reset.');
              }}
              className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1 text-xs text-rose-200 transition hover:bg-rose-500/20"
            >
              Reset History
            </button>
          </div>
        </div>

        {!historyRows.length ? (
          <p className="text-xs text-slate-400">No saved history yet. Run Analyze Feedback to store history.</p>
        ) : null}

        <div className="space-y-3">
          {(showAllHistory ? historyRows : historyRows.slice(0, 3)).map((row, idx) => (
            <div
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-cyan-700/30 bg-gradient-to-br from-cyan-900/40 via-slate-950/60 to-emerald-900/30 p-4 shadow-md hover:scale-[1.01] transition"
            >
              <div>
                <p className="text-xs text-cyan-200 font-mono">{new Date(row.createdAt?.seconds ? row.createdAt.seconds * 1000 : row.createdAt || 0).toLocaleString()}</p>
                <p className="text-base text-white font-semibold">{row.reviewCount || 0} Reviews</p>
              </div>
              <button
                type="button"
                onClick={() => handleLoadHistory(row)}
                className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-1.5 text-xs text-cyan-200 hover:bg-cyan-500/20 transition"
              >
                Load
              </button>
            </div>
          ))}
        </div>
        {historyRows.length > 3 && (
          <div className="mt-3 flex justify-center">
            <button
              type="button"
              onClick={() => setShowAllHistory((v) => !v)}
              className="rounded-full border border-slate-600 bg-slate-900 px-4 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
            >
              {showAllHistory ? 'Show Less' : 'Show More'}
            </button>
          </div>
        )}
      </section>

      {analysis ? (
        <section className="grid gap-4 sm:grid-cols-4">
          <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Reviews</p>
            <p className="mt-2 text-2xl font-semibold text-white">{analysis?.reviewResults?.length || 0}</p>
          </article>
          <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Positive</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-300">{analysis?.summary?.sentiment?.positive || '0%'}</p>
          </article>
          <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Neutral</p>
            <p className="mt-2 text-2xl font-semibold text-amber-300">{analysis?.summary?.sentiment?.neutral || '0%'}</p>
          </article>
          <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Negative</p>
            <p className="mt-2 text-2xl font-semibold text-rose-300">{analysis?.summary?.sentiment?.negative || '0%'}</p>
          </article>
        </section>
      ) : (
        <section className="flex flex-col items-center justify-center py-12">
          <div className="text-5xl mb-4">📝</div>
          <p className="text-lg text-slate-300 font-semibold">Paste or load reviews to see analytics!</p>
        </section>
      )}


      {analysis && (
        <section className="grid gap-4 xl:grid-cols-2">
          <article className="rounded-2xl border-2 border-cyan-500/30 bg-gradient-to-br from-cyan-900/60 via-slate-900/80 to-emerald-900/40 p-6 shadow-lg">
            <h2 className="mb-3 text-lg font-bold text-cyan-200 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              AI-Powered Summary
            </h2>
            <ul className="space-y-2 text-base text-slate-100">
              {(analysis?.aiInsights?.observations || []).map((item, idx) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 inline-block w-2 h-2 rounded-full bg-cyan-400"></span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 grid gap-2 md:grid-cols-2">
              <div>
                <h3 className="text-xs uppercase tracking-wide text-rose-300 font-semibold">Root Causes & Risks</h3>
                <ul className="mt-1 space-y-1 text-sm text-rose-100">
                  {(analysis?.aiInsights?.rootCauses || []).slice(0, 2).map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                  {(analysis?.aiInsights?.risks || []).slice(0, 2).map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-xs uppercase tracking-wide text-emerald-300 font-semibold">Opportunities & Next Goal</h3>
                <ul className="mt-1 space-y-1 text-sm text-emerald-100">
                  {(analysis?.aiInsights?.opportunities || []).slice(0, 2).map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-emerald-200">Goal: {analysis?.aiInsights?.nextGoal || ''}</p>
              </div>
            </div>
          </article>

          <article className="rounded-2xl border-2 border-amber-500/30 bg-gradient-to-br from-amber-900/60 via-slate-900/80 to-rose-900/40 p-6 shadow-lg">
            <h2 className="mb-3 text-lg font-bold text-amber-200 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
              Per-Review Sentiment
            </h2>
            <div className="space-y-2">
              {(analysis?.reviewResults || []).map((review) => (
                <div key={review.id} className="rounded-xl border border-slate-700 bg-slate-950/60 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs text-slate-300">Review #{review.id} | Rating: {review.rating}/5</p>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] ${sentimentPillClass(review.sentiment)}`}>
                      {review.sentiment}
                    </span>
                  </div>
                  <p className="text-sm text-slate-100">{review.comment}</p>
                  <p className="mt-1 text-xs text-cyan-300">Themes: {review.themes.join(', ')}</p>
                </div>
              ))}
            </div>
          </article>
        </section>
      )}

      <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-slate-200">AI Insights Layer</p>
          <span className={`rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-wide ${aiSourceBadgeClass}`}>
            {aiSource === 'live' ? 'Live AI' : 'Fallback'}
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <article className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3">
            <p className="text-xs uppercase tracking-wide text-cyan-300">Observations</p>
            <ul className="mt-2 space-y-1 text-xs text-slate-100">
              {(analysis?.aiInsights?.observations || []).map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          </article>

          <article className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3">
            <p className="text-xs uppercase tracking-wide text-rose-300">Root Causes & Risks</p>
            <ul className="mt-2 space-y-1 text-xs text-slate-100">
              {(analysis?.aiInsights?.rootCauses || []).slice(0, 2).map((item) => (
                <li key={item}>- {item}</li>
              ))}
              {(analysis?.aiInsights?.risks || []).slice(0, 2).map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          </article>

          <article className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
            <p className="text-xs uppercase tracking-wide text-emerald-300">Opportunities & Next Goal</p>
            <ul className="mt-2 space-y-1 text-xs text-slate-100">
              {(analysis?.aiInsights?.opportunities || []).slice(0, 2).map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-emerald-200">Goal: {analysis?.aiInsights?.nextGoal || ''}</p>
          </article>
        </div>
      </section>
    </div>
  );
}
