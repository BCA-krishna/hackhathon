const env = require('../config/env');
const analyticsService = require('./analyticsService');

/**
 * Chatbot Service (V3 - Uses Analytics Pipeline)
 *
 * Instead of querying Firestore directly (which burns quota fast),
 * this service reuses the analyticsService pipeline which:
 *  1. Reads data ONCE via storeService.listSalesByUser
 *  2. Computes all insights (top products, trends, low stock, etc.) in-memory
 *
 * Result: ~1 Firestore read per chatbot query instead of 4–5 collection reads.
 */

// --- In-Memory Cache (10 min TTL) ---
const CACHE_TTL = 10 * 60 * 1000;
const contextCache = new Map();

function getCached(userId) {
  const entry = contextCache.get(userId);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}

function setCache(userId, data) {
  contextCache.set(userId, { ts: Date.now(), data });
}

// --- Simulated Data (Quota-Exceeded Fallback) ---
function simulatedContext() {
  return {
    isSimulated: true,
    totalRevenue: 8450,
    records: 120,
    topProducts: [
      { productName: 'Coffee Beans', sales: 2840 },
      { productName: 'Green Tea', sales: 1950 },
      { productName: 'Protein Bars', sales: 1520 },
      { productName: 'Granola Mix', sales: 1240 }
    ],
    lowStockItems: ['Granola Mix (12 left)', 'Protein Bars (15 left)'],
    alerts: ['LOW_STOCK: Granola Mix inventory is dipping', 'TREND: Coffee Beans sales increased 12%'],
    forecasts: ['2026-04-15: ₹450', '2026-04-16: ₹480'],
    weekComparison: { currentWeek: 3200, previousWeek: 2800, growth: 14.2 }
  };
}

// --- Build Context from Analytics Service ---
async function buildContext(userId) {
  const cached = getCached(userId);
  if (cached) {
    console.log(`[Chatbot] Cache hit for user ${userId}`);
    return cached;
  }

  try {
    // All three calls share the same underlying data fetch from storeService (1 read!)
    const [insights, weekComp] = await Promise.all([
      analyticsService.getInsights(userId),
      analyticsService.getWeekComparison(userId)
    ]);

    // Compute low-stock from raw sales data (latest stock per product)
    const storeService = require('./storeService');
    const rawSales = await storeService.listSalesByUser(userId);

    const latestStock = {};
    rawSales.forEach((row) => {
      const name = row.productName || 'Unknown';
      const d = new Date(row.date).getTime();
      if (!latestStock[name] || d > latestStock[name].date) {
        latestStock[name] = { stock: Number(row.stock ?? 0), date: d };
      }
    });

    const lowStockItems = Object.entries(latestStock)
      .filter(([, v]) => v.stock < 10)
      .map(([name, v]) => `${name} (${v.stock} left)`);

    const context = {
      isSimulated: false,
      totalRevenue: insights.totalSales,
      records: insights.records,
      topProducts: insights.topProducts,
      lowProducts: insights.lowProducts,
      dailyTrends: insights.dailyTrends,
      lowStockItems,
      alerts: lowStockItems.length
        ? lowStockItems.map((i) => `LOW_STOCK: ${i}`)
        : ['No critical stock alerts'],
      weekComparison: {
        currentWeek: weekComp.currentWindow.totalSales,
        previousWeek: weekComp.previousWindow.totalSales,
        growth: weekComp.growthPercent
      }
    };

    setCache(userId, context);
    console.log(`[Chatbot] Context built — ${context.records} records, ₹${context.totalRevenue} revenue`);
    return context;
  } catch (error) {
    const isQuota = error.code === 8 || String(error.details || error.message || '').includes('Quota exceeded');
    if (isQuota) {
      console.warn('[Chatbot] Quota exceeded — using simulated context');
      return simulatedContext();
    }
    throw error;
  }
}

// --- Fallback Rule-Based Response ---
function fallbackReply(message, ctx) {
  const msg = message.toLowerCase();
  const tag = ctx.isSimulated ? '\n\n> ⚠️ *Showing sample data (database quota temporarily reached)*' : '';

  const topList = ctx.topProducts.map((p) => `**${p.productName}** — ₹${p.sales}`).join('\n- ');
  const growth = ctx.weekComparison?.growth ?? 0;
  const growthStr = `${growth > 0 ? '▲' : '▼'} ${Math.abs(growth).toFixed(1)}% vs last week`;

  if (msg.includes('low stock') || msg.includes('inventory')) {
    return ctx.lowStockItems.length
      ? `📦 **Low Stock Alert**\nThese items are below 10 units:\n- ${ctx.lowStockItems.join('\n- ')}${tag}`
      : `✅ **Inventory OK**\nAll products are sufficiently stocked.${tag}`;
  }
  if (msg.includes('top product') || msg.includes('best seller') || msg.includes('top sell')) {
    return `🏆 **Top Products by Sales**\n- ${topList}${tag}`;
  }
  if (msg.includes('sales') || msg.includes('revenue')) {
    return `📈 **Sales Summary**\n- **Total Revenue:** ₹${ctx.totalRevenue}\n- **Records:** ${ctx.records}\n- **Week-on-Week:** ${growthStr}\n- **Top:** ${ctx.topProducts[0]?.productName || 'N/A'}${tag}`;
  }
  if (msg.includes('forecast') || msg.includes('predict')) {
    return ctx.forecasts?.length
      ? `🔮 **Sales Forecast**\n- ${ctx.forecasts.join('\n- ')}${tag}`
      : `🔮 Forecasts are computed when more historical sales data is available.${tag}`;
  }
  if (msg.includes('summary') || msg.includes('overview') || msg.includes('how is my')) {
    return `📋 **Business Summary**\n- **Revenue:** ₹${ctx.totalRevenue} across ${ctx.records} records\n- **Trending:** ${growthStr}\n- **Best Seller:** ${ctx.topProducts[0]?.productName || 'N/A'}\n- **Stock Alerts:** ${ctx.lowStockItems.length} items low${tag}`;
  }
  return `👋 I can help with:\n- **Sales & Revenue** overview\n- **Top products** and best sellers\n- **Low stock** inventory alerts\n- **Week-on-week** comparison\n- **Business summary**\n\nTry asking: *"Which products are selling best?"*${tag}`;
}

// --- Gemini AI ---
async function callGemini(prompt, history = []) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.geminiModel}:generateContent?key=${env.geminiApiKey}`;
  const contents = [
    ...history.slice(-4).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    })),
    { role: 'user', parts: [{ text: prompt }] }
  ];
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents, generationConfig: { temperature: 0.7, maxOutputTokens: 800 } })
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';
}

// --- OpenAI ---
async function callOpenAI(sysPrompt, userMsg, history = []) {
  const res = await fetch(`${env.openAiBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.openAiApiKey}` },
    body: JSON.stringify({
      model: env.openAiModel,
      messages: [
        { role: 'system', content: sysPrompt },
        ...history.slice(-4),
        { role: 'user', content: userMsg }
      ],
      temperature: 0.7,
      max_tokens: 600
    })
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

// --- Main Entry Point ---
async function processMessage(userId, message, conversationHistory = [], analyticsContext = null) {
  const trimmed = message?.trim();
  if (!trimmed) return { reply: "I didn't receive a message. How can I help?", source: 'system' };

  let ctx;
  try {
    if (analyticsContext && typeof analyticsContext === 'object') {
      console.log(`[Chatbot] Using direct frontend context for ${userId}`);
      ctx = {
        ...analyticsContext,
        isSimulated: false,
        source: 'frontend'
      };
    } else {
      ctx = await buildContext(userId);
    }
  } catch (err) {
    console.error('[Chatbot] Context build failed:', err);
    return { reply: "I'm having trouble reading your data right now. Please try again in a moment.", source: 'error' };
  }

  const provider = (env.aiProvider || 'gemini').toLowerCase();
  const hasGemini = !!env.geminiApiKey;
  const hasOpenAI = !!env.openAiApiKey;

  if ((provider === 'gemini' && !hasGemini) || (provider === 'openai' && !hasOpenAI)) {
    return { reply: fallbackReply(trimmed, ctx), source: 'fallback' };
  }

  const simNote = ctx.isSimulated
    ? '\n⚠️ IMPORTANT: The live Firestore database has reached its daily limit. Use the SAMPLE DATA below and let the user know you are showing sample data.'
    : '';

  const systemPrompt = `You are a smart Business Intelligence Assistant for an SME.
${simNote}

USER'S BUSINESS DATA:
- Total Revenue: ₹${ctx.totalRevenue} (${ctx.records} records)
- Top Products: ${ctx.topProducts.map((p) => `${p.productName} ₹${p.sales}`).join(', ')}
- Low Performers: ${ctx.lowProducts?.map((p) => p.productName).join(', ') || 'N/A'}
- Low Stock Items: ${ctx.lowStockItems.join(', ') || 'None'}
- Active Alerts: ${ctx.alerts.join(', ')}
- Week-on-Week Growth: ${ctx.weekComparison?.growth?.toFixed(1)}%
- Daily Trend (last 5 days): ${JSON.stringify((ctx.dailyTrends || []).slice(-5))}

RULES:
1. Always use the data above to answer. Be concise and use Markdown formatting.
2. If showing sample data, always mention it to the user.
3. Provide actionable suggestions when possible.
4. If asked something not business-related, politely redirect.
5. Today is ${new Date().toISOString().slice(0, 10)}.`;

  try {
    let reply;
    if (provider === 'gemini') {
      reply = await callGemini(`${systemPrompt}\n\nUser: ${trimmed}`, conversationHistory);
    } else {
      reply = await callOpenAI(systemPrompt, trimmed, conversationHistory);
    }
    return { reply, source: provider };
  } catch (err) {
    console.error(`[Chatbot] AI call failed (${provider}):`, err.message);
    return { reply: fallbackReply(trimmed, ctx), source: 'fallback' };
  }
}

module.exports = { processMessage };
