const THEME_KEYWORDS = {
  'delivery time': ['delivery', 'shipping', 'shipment', 'late', 'delay', 'on time', 'fast delivery', 'arrived'],
  'product quality': ['quality', 'durable', 'defect', 'broken', 'material', 'build', 'works great', 'damaged'],
  pricing: ['price', 'pricing', 'expensive', 'cheap', 'cost', 'value', 'discount', 'overpriced'],
  'customer service': ['support', 'service', 'help', 'staff', 'response', 'refund', 'resolved', 'agent'],
  packaging: ['packaging', 'package', 'box', 'seal', 'sealed', 'wrapped']
};

const POSITIVE_WORDS = [
  'good',
  'great',
  'excellent',
  'amazing',
  'fast',
  'helpful',
  'friendly',
  'satisfied',
  'love',
  'perfect',
  'value',
  'recommend'
];

const NEGATIVE_WORDS = [
  'bad',
  'poor',
  'late',
  'delay',
  'broken',
  'defect',
  'expensive',
  'rude',
  'slow',
  'worst',
  'damaged',
  'refund'
];

function normalizeText(value) {
  return String(value || '').toLowerCase();
}

function extractThemes(comment) {
  const text = normalizeText(comment);
  const matched = Object.entries(THEME_KEYWORDS)
    .filter(([, keywords]) => keywords.some((keyword) => text.includes(keyword)))
    .map(([theme]) => theme);

  return matched.length ? matched : ['general experience'];
}

function wordScore(comment) {
  const text = normalizeText(comment);
  const positiveHits = POSITIVE_WORDS.filter((word) => text.includes(word)).length;
  const negativeHits = NEGATIVE_WORDS.filter((word) => text.includes(word)).length;
  return positiveHits - negativeHits;
}

function classifySentiment(review) {
  const rating = Number(review.rating || 0);
  const lexical = wordScore(review.comment || '');
  const score = (rating - 3) * 1.2 + lexical * 0.8;

  if (score >= 1) return 'Positive';
  if (score <= -1) return 'Negative';
  return 'Neutral';
}

function percentage(count, total) {
  if (!total) return '0%';
  return `${Math.round((count / total) * 100)}%`;
}

function topThemes(themeStats, sentimentKey, maxItems = 3) {
  return Object.entries(themeStats)
    .filter(([, stats]) => stats[sentimentKey] > 0)
    .sort((a, b) => b[1][sentimentKey] - a[1][sentimentKey])
    .slice(0, maxItems)
    .map(([theme, stats]) => ({
      theme,
      count: stats[sentimentKey]
    }));
}

function topThemesByNet(themeStats, direction = 'positive', maxItems = 3) {
  const rows = Object.entries(themeStats)
    .map(([theme, stats]) => {
      const positive = Number(stats.positive || 0);
      const negative = Number(stats.negative || 0);
      const net = positive - negative;
      return {
        theme,
        positive,
        negative,
        net
      };
    })
    .filter((item) => (direction === 'positive' ? item.net > 0 : item.net < 0))
    .sort((a, b) => {
      if (direction === 'positive') return b.net - a.net;
      return a.net - b.net;
    })
    .slice(0, maxItems)
    .map((item) => ({
      theme: item.theme,
      count: direction === 'positive' ? item.positive : item.negative
    }));

  return rows;
}

function formatMention(theme, count, label) {
  const n = Number(count || 0);
  const noun = n === 1 ? 'mention' : 'mentions';
  return `${theme} (${n} ${label} ${noun})`;
}

function buildThemeStats(reviewResults) {
  return reviewResults.reduce((acc, item) => {
    item.themes.forEach((theme) => {
      if (!acc[theme]) {
        acc[theme] = { positive: 0, neutral: 0, negative: 0, total: 0 };
      }

      const key = item.sentiment.toLowerCase();
      acc[theme][key] += 1;
      acc[theme].total += 1;
    });
    return acc;
  }, {});
}

function buildRecommendations(themeStats, negativeReviews, positiveReviews) {
  const weakThemes = topThemes(themeStats, 'negative', 3);
  const strongThemes = topThemes(themeStats, 'positive', 3);
  const weakThemeSet = new Set(weakThemes.map((item) => item.theme));

  const immediate = [];
  const strategic = [];

  if (weakThemes.some((item) => item.theme === 'delivery time')) {
    immediate.push('Stabilize logistics SLA and proactively notify customers for late shipments.');
  }
  if (weakThemes.some((item) => item.theme === 'product quality')) {
    immediate.push('Increase quality checks for top-selling SKUs and reduce defect returns.');
  }
  if (weakThemes.some((item) => item.theme === 'customer service')) {
    immediate.push('Set first-response target under 2 hours for support tickets.');
  }
  if (weakThemes.some((item) => item.theme === 'pricing')) {
    immediate.push('Review price perception and launch value bundles for high-complaint items.');
  }

  if (!immediate.length && negativeReviews > 0) {
    immediate.push('Run root-cause review on latest negative reviews and assign owners this week.');
  }
  if (!immediate.length) {
    immediate.push('No urgent red flags. Continue monitoring exceptions daily.');
  }

  if (strongThemes.some((item) => item.theme === 'product quality') && !weakThemeSet.has('product quality')) {
    strategic.push('Scale campaigns around quality and reliability as core brand promise.');
  }
  if (strongThemes.some((item) => item.theme === 'delivery time') && !weakThemeSet.has('delivery time')) {
    strategic.push('Use fast-delivery messaging in ads and checkout to improve conversion.');
  }
  if (strongThemes.some((item) => item.theme === 'customer service') && !weakThemeSet.has('customer service')) {
    strategic.push('Turn support excellence into loyalty offers and referral programs.');
  }
  if (positiveReviews > negativeReviews) {
    strategic.push('Double down on frequently praised features and replicate them across products.');
  }

  if (!strategic.length) {
    strategic.push('Build monthly voice-of-customer review cycles and track theme-level KPIs.');
  }

  return { immediate, strategic };
}

function buildAiInsights({ summary, themeStats, total, positiveCount, negativeCount }) {
  const topNegative = topThemes(themeStats, 'negative', 3);
  const topPositive = topThemes(themeStats, 'positive', 3);

  const observations = [
    `Sentiment split: Positive ${summary.sentiment.positive}, Neutral ${summary.sentiment.neutral}, Negative ${summary.sentiment.negative}.`,
    topNegative.length
      ? `Most negative pressure is from ${topNegative.map((item) => item.theme).join(', ')}.`
      : 'No dominant negative theme detected.',
    topPositive.length
      ? `Most appreciated themes are ${topPositive.map((item) => item.theme).join(', ')}.`
      : 'No dominant positive theme detected.'
  ];

  const rootCauses = [];
  if (topNegative.some((item) => item.theme === 'delivery time')) {
    rootCauses.push('Delivery SLA inconsistency is affecting customer trust.');
  }
  if (topNegative.some((item) => item.theme === 'product quality')) {
    rootCauses.push('Quality variation/defects are driving dissatisfaction and returns risk.');
  }
  if (topNegative.some((item) => item.theme === 'customer service')) {
    rootCauses.push('Support response quality/speed is below customer expectations.');
  }
  if (topNegative.some((item) => item.theme === 'pricing')) {
    rootCauses.push('Value-for-money perception is weak for part of the catalog.');
  }
  if (!rootCauses.length) {
    rootCauses.push('No single dominant root cause detected from current review sample.');
  }

  const risks = [];
  if (negativeCount > positiveCount) {
    risks.push('Negative sentiment outweighs positive sentiment; retention risk is elevated.');
  }
  if (topNegative.length && total > 0 && topNegative[0].count / total >= 0.3) {
    risks.push(`Complaint concentration risk: ${topNegative[0].theme} appears in ${topNegative[0].count} reviews.`);
  }
  if (!risks.length) {
    risks.push('No urgent risk concentration; continue monitoring theme shifts weekly.');
  }

  const opportunities = [];
  if (topPositive.some((item) => item.theme === 'product quality')) {
    opportunities.push('Use quality-focused positioning in campaigns and product detail pages.');
  }
  if (topPositive.some((item) => item.theme === 'delivery time')) {
    opportunities.push('Promote fast-shipping promise to improve conversion rate.');
  }
  if (topPositive.some((item) => item.theme === 'customer service')) {
    opportunities.push('Convert support satisfaction into referrals and loyalty programs.');
  }
  if (!opportunities.length) {
    opportunities.push('Build a stronger value proposition around the most liked themes.');
  }

  return {
    observations,
    rootCauses,
    risks,
    opportunities,
    immediateActions: summary.immediateActions,
    strategicActions: summary.strategicActions,
    nextGoal:
      negativeCount > positiveCount
        ? 'Reduce top complaint-theme mentions by at least 30% in the next 30 days.'
        : 'Scale top praised themes to increase positive sentiment and repeat purchase rate.'
  };
}

export function analyzeCustomerFeedback(reviews) {
  const normalizedReviews = Array.isArray(reviews)
    ? reviews.map((review, index) => ({
        id: index + 1,
        rating: Number(review?.rating || 0),
        comment: String(review?.comment || '').trim()
      }))
    : [];

  const reviewResults = normalizedReviews.map((review) => {
    const themes = extractThemes(review.comment);
    const sentiment = classifySentiment(review);
    return {
      ...review,
      themes,
      sentiment
    };
  });

  const total = reviewResults.length;
  const positiveCount = reviewResults.filter((item) => item.sentiment === 'Positive').length;
  const neutralCount = reviewResults.filter((item) => item.sentiment === 'Neutral').length;
  const negativeCount = reviewResults.filter((item) => item.sentiment === 'Negative').length;

  const themeStats = buildThemeStats(reviewResults);
  const strengths = topThemesByNet(themeStats, 'positive', 3);
  const weaknesses = topThemesByNet(themeStats, 'negative', 3);
  const repeatedComplaints = topThemes(themeStats, 'negative', 5)
    .filter((item) => item.count >= 2)
    .map((item) => `${item.theme} (${item.count} mentions)`);
  const praisedFeatures = topThemes(themeStats, 'positive', 5)
    .filter((item) => item.count >= 2)
    .map((item) => `${item.theme} (${item.count} mentions)`);

  const { immediate, strategic } = buildRecommendations(themeStats, negativeCount, positiveCount);

  const summary = {
    sentiment: {
      positive: percentage(positiveCount, total),
      neutral: percentage(neutralCount, total),
      negative: percentage(negativeCount, total)
    },
    strengths: strengths.map((item) => formatMention(item.theme, item.count, 'positive')),
    weaknesses: weaknesses.map((item) => formatMention(item.theme, item.count, 'negative')),
    painPoints: repeatedComplaints.length
      ? repeatedComplaints
      : ['No repeated complaint pattern detected yet.'],
    praisedFeatures: praisedFeatures.length
      ? praisedFeatures
      : ['No repeated praise pattern detected yet.'],
    immediateActions: immediate,
    strategicActions: strategic,
    direction:
      negativeCount > positiveCount
        ? 'Focus on fixing recurring complaints first, then relaunch growth campaigns once service stability improves.'
        : 'Protect your strongest themes and scale them while systematically removing the top complaint categories.'
  };

  const aiInsights = buildAiInsights({
    summary,
    themeStats,
    total,
    positiveCount,
    negativeCount
  });

  return {
    reviewResults,
    summary,
    aiInsights,
    report: formatFeedbackReport(summary)
  };
}

export function formatFeedbackReport(summary) {
  const lines = [
    'Sentiment Summary:',
    `- Positive: ${summary.sentiment.positive}`,
    `- Neutral: ${summary.sentiment.neutral}`,
    `- Negative: ${summary.sentiment.negative}`,
    '',
    'Key Insights:',
    '- 👍 Strengths:',
    ...(summary.strengths.length ? summary.strengths : ['No major strengths detected.']).map((item) => `  - ${item}`),
    '- 👎 Weaknesses:',
    ...(summary.weaknesses.length ? summary.weaknesses : ['No major weaknesses detected.']).map((item) => `  - ${item}`),
    '',
    'Customer Pain Points:',
    ...summary.painPoints.map((item) => `- ${item}`),
    '',
    'Business Recommendations:',
    '- Immediate Actions:',
    ...summary.immediateActions.map((item) => `  - ${item}`),
    '- Strategic Actions:',
    ...summary.strategicActions.map((item) => `  - ${item}`),
    '',
    'Overall Business Direction:',
    `- ${summary.direction}`
  ];

  return lines.join('\n');
}
