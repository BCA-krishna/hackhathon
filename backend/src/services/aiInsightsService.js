const env = require('../config/env');
const ApiError = require('../utils/apiError');

function fallbackInsights(summary) {
  const strengths = Array.isArray(summary?.strengths) ? summary.strengths : [];
  const weaknesses = Array.isArray(summary?.weaknesses) ? summary.weaknesses : [];

  return {
    observations: [
      `Sentiment split: Positive ${summary?.sentiment?.positive || '0%'}, Neutral ${summary?.sentiment?.neutral || '0%'}, Negative ${summary?.sentiment?.negative || '0%'}.`,
      weaknesses.length ? `Weakest themes: ${weaknesses.slice(0, 2).join(', ')}.` : 'No strong weakness concentration found.',
      strengths.length ? `Strongest themes: ${strengths.slice(0, 2).join(', ')}.` : 'No strong praise concentration found.'
    ],
    rootCauses: weaknesses.length ? ['Complaint themes indicate process inconsistency in weak areas.'] : ['No dominant root cause detected.'],
    risks: weaknesses.length ? ['If weak themes continue, retention and referral rates can decline.'] : ['No urgent sentiment risk currently detected.'],
    opportunities: strengths.length ? ['Scale praised experience themes in marketing and operations.'] : ['Collect more reviews to identify scalable opportunities.'],
    immediateActions: Array.isArray(summary?.immediateActions) ? summary.immediateActions : ['Resolve top complaint category in a 7-day sprint.'],
    strategicActions: Array.isArray(summary?.strategicActions) ? summary.strategicActions : ['Track monthly feedback KPIs by theme.'],
    nextGoal: 'Reduce top complaint-theme mentions by 30% in the next 30 days.'
  };
}

function sanitizeAiInsights(raw, summary) {
  const base = fallbackInsights(summary);
  return {
    observations: Array.isArray(raw?.observations) ? raw.observations : base.observations,
    rootCauses: Array.isArray(raw?.rootCauses) ? raw.rootCauses : base.rootCauses,
    risks: Array.isArray(raw?.risks) ? raw.risks : base.risks,
    opportunities: Array.isArray(raw?.opportunities) ? raw.opportunities : base.opportunities,
    immediateActions: Array.isArray(raw?.immediateActions) ? raw.immediateActions : base.immediateActions,
    strategicActions: Array.isArray(raw?.strategicActions) ? raw.strategicActions : base.strategicActions,
    nextGoal: typeof raw?.nextGoal === 'string' && raw.nextGoal.trim() ? raw.nextGoal.trim() : base.nextGoal
  };
}

async function generateFeedbackInsights(summary) {
  if (!summary || typeof summary !== 'object') {
    throw new ApiError(400, 'Summary payload is required.');
  }

  if (!env.openAiApiKey) {
    return {
      aiInsights: fallbackInsights(summary),
      source: 'fallback'
    };
  }

  const systemPrompt =
    'You are an AI business analyst. Return ONLY valid JSON with keys: observations, rootCauses, risks, opportunities, immediateActions, strategicActions, nextGoal. Keep each array concise and action-oriented.';

  const userPrompt = `Analyze this customer-feedback summary and produce business insights JSON:\n${JSON.stringify(summary)}`;

  const response = await fetch(`${env.openAiBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.openAiApiKey}`
    },
    body: JSON.stringify({
      model: env.openAiModel,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(502, `AI provider request failed: ${text || response.statusText}`);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) {
    return {
      aiInsights: fallbackInsights(summary),
      source: 'fallback'
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    return {
      aiInsights: fallbackInsights(summary),
      source: 'fallback'
    };
  }

  return {
    aiInsights: sanitizeAiInsights(parsed, summary),
    source: 'live'
  };
}

module.exports = { generateFeedbackInsights };
