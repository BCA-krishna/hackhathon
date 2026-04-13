import { auth } from './firebase';

function parseThemeLabel(item) {
  if (!item) return '';
  const idx = item.lastIndexOf('(');
  return idx > 0 ? item.slice(0, idx).trim() : String(item).trim();
}

function firstOrFallback(values, fallback) {
  return values && values.length ? values[0] : fallback;
}

function buildLocalInsights(summary) {
  const strengths = (summary?.strengths || []).map(parseThemeLabel).filter(Boolean);
  const weaknesses = (summary?.weaknesses || []).map(parseThemeLabel).filter(Boolean);

  const primaryWeakness = firstOrFallback(weaknesses, 'general experience');
  const primaryStrength = firstOrFallback(strengths, 'overall customer experience');

  const observations = [
    `Current sentiment mix is Positive ${summary?.sentiment?.positive || '0%'}, Neutral ${summary?.sentiment?.neutral || '0%'}, Negative ${summary?.sentiment?.negative || '0%'}.`,
    weaknesses.length
      ? `Customer friction is concentrated around ${weaknesses.slice(0, 2).join(' and ')}.`
      : 'No concentrated complaint theme detected yet.',
    strengths.length
      ? `Customers consistently appreciate ${strengths.slice(0, 2).join(' and ')}.`
      : 'No concentrated praise theme detected yet.'
  ];

  const rootCauses = [
    `Primary root-cause area appears to be ${primaryWeakness}.`,
    'Process consistency across operations and support likely needs improvement.'
  ];

  const risks = [
    `If ${primaryWeakness} is not fixed, repeat purchase and referral rates can decline.`,
    'Complaint clustering can increase support load and return-related costs.'
  ];

  const opportunities = [
    `Scale messaging around ${primaryStrength} since customers already value it.`,
    'Use top positive themes as proof points in retention and acquisition campaigns.'
  ];

  const immediateActions = summary?.immediateActions?.length
    ? summary.immediateActions
    : ['Resolve top complaint category with a 7-day corrective sprint.'];

  const strategicActions = summary?.strategicActions?.length
    ? summary.strategicActions
    : ['Establish monthly feedback-to-action governance and theme KPI tracking.'];

  const nextGoal = weaknesses.length
    ? `Reduce ${primaryWeakness} complaints by 30% in the next 30 days.`
    : 'Increase positive sentiment by 10% over the next quarter.';

  return {
    observations,
    rootCauses,
    risks,
    opportunities,
    immediateActions,
    strategicActions,
    nextGoal
  };
}

export async function generateAIInsights(summary) {
  const fallback = buildLocalInsights(summary);
  const withMeta = (insights, source) => ({
    ...insights,
    _meta: {
      source
    }
  });

  try {
    const user = auth.currentUser;
    if (!user) {
      return withMeta(fallback, 'fallback');
    }

    const token = await user.getIdToken();
    const baseUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
    const response = await fetch(`${baseUrl}/api/ai/feedback-insights`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ summary })
    });

    if (!response.ok) {
      return withMeta(fallback, 'fallback');
    }

    const payload = await response.json();
    const source = payload?.data?.source === 'live' ? 'live' : 'fallback';
    return withMeta(payload?.data?.aiInsights || fallback, source);
  } catch {
    return withMeta(fallback, 'fallback');
  }
}
