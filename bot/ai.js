const Anthropic = require('@anthropic-ai/sdk');
const { getSetting } = require('./database');

function getClient() {
  const apiKey = getSetting('claude_api_key') || process.env.CLAUDE_API_KEY;
  if (!apiKey) throw new Error('Claude API key not configured. Use /settings in Telegram.');
  return new Anthropic({ apiKey });
}

async function detectSessionStart(message) {
  const client = getClient();
  const res = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: `You are a parser for Arabic group chat messages in a Saudi workplace food ordering context.

Analyze this message: "${message}"

Does this message indicate that someone wants to order food from a restaurant today?
If yes, extract:
1. restaurant name (the Arabic name as written)
2. delivery app mentioned (one of: hungerstation/keeta/jahez) — null if not mentioned

Reply ONLY with JSON: {"is_order_start": true, "restaurant": "...", "app": "..." or null}
Or if not an order start: {"is_order_start": false}`
    }]
  });

  try {
    const text = res.content[0].text.trim();
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    return json ? JSON.parse(json) : { is_order_start: false };
  } catch {
    return { is_order_start: false };
  }
}

async function parseOrder(userMessage, menuItems) {
  const client = getClient();

  const menuText = menuItems.map(i =>
    `- ${i.name}: ${i.price} ريال${i.category ? ` (${i.category})` : ''}`
  ).join('\n');

  const res = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    system: {
      type: 'text',
      text: `You are an Arabic food order parser for a Saudi workplace group chat.
Menu context (cache this):
${menuText}`,
      cache_control: { type: 'ephemeral' }
    },
    messages: [{
      role: 'user',
      content: `Parse this Arabic order message: "${userMessage}"

Match items to the menu above. Be flexible with spelling variations and abbreviations (كريسبي = دجاج كريسبي, etc.)

If this is a food order, reply ONLY with JSON:
{"is_order": true, "items": [{"name": "exact menu name", "price": 00.0, "quantity": 1}]}

If this message is NOT a food order (greetings, questions, reactions, etc.):
{"is_order": false}

Use exact menu item names and prices. Never invent items not on the menu.`
    }]
  });

  try {
    const text = res.content[0].text.trim();
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    const parsed = json ? JSON.parse(json) : { is_order: false };
    if (parsed.is_order && parsed.items?.length > 0) {
      parsed.total = parsed.items.reduce((s, i) => s + i.price * i.quantity, 0);
    }
    return parsed;
  } catch {
    return { is_order: false };
  }
}

module.exports = { detectSessionStart, parseOrder };
