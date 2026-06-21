const { InlineKeyboard } = require('grammy');
const { detectSessionStart, parseOrder } = require('../ai');
const {
  createSession, getActiveSession, closeSession,
  insertMenuItems, getMenuItems, upsertOrder, getOrder,
  getLatestMenuForRestaurant,
  getSessionOrders,
} = require('../database');
const { search: scraperSearch, getMenu: scraperMenu } = require('../scrapers');
const { buildOrderSummary } = require('../payment');
const { DELIVERY_APPS, ADMIN_TRIGGERS, ORDER_START_PATTERNS } = require('../config');

const activatedGroups = new Set();
const pendingRestaurantSearch = new Map();

function activateGroup(groupId) {
  activatedGroups.add(groupId);
}

function isGroupActivated(groupId) {
  return activatedGroups.has(groupId);
}

async function handleStartCommand(ctx) {
  if (ctx.chat.type === 'private') {
    await ctx.reply(
      'استخدم البوت داخل القروب فقط.\n\n' +
      'بعد ما تضيفني للقروب، اكتب /start هناك وبعدين ابدأ الطلب بعبارة مثل: بنطلب من البيك.'
    );
    return;
  }

  const groupId = String(ctx.chat.id);
  activateGroup(groupId);

  await ctx.reply(
    '✅ تم تفعيل البوت في القروب.\n\n' +
    'اكتب: بنطلب من البيك\n' +
    'وبعدها أختار تطبيق التوصيل، وأنا أسحب المنيو تلقائيًا.'
  );
}

function buildAppKeyboard() {
  const kb = new InlineKeyboard();
  Object.entries(DELIVERY_APPS).forEach(([key, app]) => {
    kb.text(app.nameAr, `app:${key}`).row();
  });
  return kb;
}

async function searchInApps(restaurant, preferredApp) {
  const appKeys = Object.keys(DELIVERY_APPS);
  const orderedApps = preferredApp
    ? [preferredApp, ...appKeys.filter((key) => key !== preferredApp)]
    : appKeys;

  for (const appKey of orderedApps) {
    try {
      const results = await scraperSearch(appKey, restaurant);
      if (Array.isArray(results) && results.length > 0) {
        return { appKey, results: results.slice(0, 8) };
      }
    } catch {
      // try next app
    }
  }

  return { appKey: preferredApp || null, results: [] };
}

async function handleGroupMessage(ctx) {
  const text = ctx.message?.text;
  if (!text) return;

  const groupId = String(ctx.chat.id);
  if (!isGroupActivated(groupId)) return;

  const userId = String(ctx.from.id);
  const username = ctx.from.username || null;
  const firstName = ctx.from.first_name || username || 'مجهول';

  const lowerText = text.toLowerCase().trim();

  const isAdminTrigger = ADMIN_TRIGGERS.some(t => lowerText.includes(t.toLowerCase()));
  if (isAdminTrigger) {
    await handleDoneCommand(ctx, groupId, userId);
    return;
  }

  const isStartTrigger = ORDER_START_PATTERNS.some(t => lowerText.includes(t.toLowerCase()));
  const activeSession = getActiveSession(groupId);

  if (isStartTrigger && !activeSession) {
    await handleSessionStart(ctx, text, groupId, userId);
    return;
  }

  if (activeSession) {
    await handleOrderMessage(ctx, text, activeSession, userId, username, firstName);
  }
}

async function handleSessionStart(ctx, text, groupId, userId) {
  try {
    const detection = await detectSessionStart(text);
    if (!detection.is_order_start) return;

    const restaurant = detection.restaurant;

    if (detection.app && DELIVERY_APPS[detection.app]) {
      await startRestaurantSearch(ctx, groupId, restaurant, detection.app);
    } else {
      pendingRestaurantSearch.set(groupId, { restaurant, messageId: ctx.message.message_id });

      const kb = buildAppKeyboard();
      await ctx.reply(
        `🍔 رائع! طلب من *${restaurant}*\n\nمن أي تطبيق توصيل؟`,
        { parse_mode: 'Markdown', reply_markup: kb }
      );
    }
  } catch (err) {
    console.error('Session start error:', err.message);
    if (err.message.includes('API key')) {
      await ctx.reply('❌ Claude API غير مضبوط، لكن تقدر تبدأ بـ /order اسم المطعم.');
    }
  }
}

async function startRestaurantSearch(ctx, groupId, restaurant, preferredApp) {
  const preferredName = preferredApp && DELIVERY_APPS[preferredApp]
    ? DELIVERY_APPS[preferredApp].nameAr
    : 'تطبيقات التوصيل';
  const searching = await ctx.reply(`🔍 أدور على *${restaurant}* في ${preferredName}...`, { parse_mode: 'Markdown' });

  try {
    const { appKey, results } = await searchInApps(restaurant, preferredApp);

    if (!results || results.length === 0) {
      await ctx.api.editMessageText(
        ctx.chat.id,
        searching.message_id,
        `❌ ما لقيت "${restaurant}" في كيتا/هنقرستيشن/جاهز. جرّب اسم مطعم أوضح.`
      );
      return;
    }

    pendingRestaurantSearch.set(groupId, { restaurant, appKey, results });

    const kb = new InlineKeyboard();
    results.forEach((r, i) => {
      const label = r.rating ? `${r.name} ⭐${r.rating}` : r.name;
      kb.text(label, `pick:${groupId}:${i}`).row();
    });
    kb.text('❌ إلغاء', `cancel:${groupId}`);

    const appName = DELIVERY_APPS[appKey]?.nameAr || appKey;
    await ctx.api.editMessageText(
      ctx.chat.id,
      searching.message_id,
      `🔍 نتائج *${restaurant}* في ${appName}:\n\nاختار المطعم الصح:`,
      { parse_mode: 'Markdown', reply_markup: kb }
    );
  } catch (err) {
    await ctx.api.editMessageText(
      ctx.chat.id,
      searching.message_id,
      '⚠️ ما قدرت أسحب المطاعم حالياً من تطبيقات التوصيل. جرّب بعد دقيقة.'
    );
    console.error('Search error:', err.message);
  }
}

async function handleAppSelection(ctx, appKey, groupId) {
  const pending = pendingRestaurantSearch.get(groupId);
  if (!pending) { await ctx.answerCallbackQuery(); return; }

  await ctx.answerCallbackQuery();
  await startRestaurantSearch(ctx, groupId, pending.restaurant, appKey);
}

async function handleRestaurantPick(ctx, groupId, resultIndex) {
  const pending = pendingRestaurantSearch.get(groupId);
  if (!pending?.results) { await ctx.answerCallbackQuery(); return; }

  const chosen = pending.results[resultIndex];
  if (!chosen) { await ctx.answerCallbackQuery(); return; }

  pendingRestaurantSearch.delete(groupId);
  await ctx.answerCallbackQuery('👍');

  const loadingMsg = await ctx.reply(`⏳ جاري تحميل منيو *${chosen.name}*...`, { parse_mode: 'Markdown' });

  try {
    const appKey = chosen.appKey || pending.appKey;
    const cachedItems = getLatestMenuForRestaurant(appKey, chosen.name);
    let allItems = [];
    let menuCategories = [];

    if (cachedItems.length > 0) {
      allItems = cachedItems.map((item) => ({
        category: item.category || 'القائمة',
        name: item.name,
        price: item.price,
      }));

      const grouped = new Map();
      for (const item of allItems) {
        const key = item.category || 'القائمة';
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push({ name: item.name, price: item.price });
      }
      menuCategories = Array.from(grouped.entries()).map(([category, items]) => ({ category, items }));
    } else {
      menuCategories = await scraperMenu(appKey, chosen.url);
      allItems = menuCategories.flatMap((cat) =>
        cat.items.map((item) => ({ ...item, category: cat.category }))
      );
    }

    if (allItems.length === 0) {
      await ctx.api.editMessageText(
        ctx.chat.id,
        loadingMsg.message_id,
        `⚠️ ما قدرت أجيب منيو *${chosen.name}* حالياً. جرّب مطعم ثاني أو التطبيق الآخر.`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    const session = createSession({
      group_id: groupId,
      group_title: ctx.chat.title || '',
      restaurant: chosen.name,
      delivery_app: appKey,
      restaurant_url: chosen.url,
    });

    const sessionId = session.lastInsertRowid;
    insertMenuItems(allItems.map((i) => ({ session_id: sessionId, ...i })));

    let menuText = `🍽️ *منيو ${chosen.name}*\n\n`;
    for (const category of menuCategories) {
      if (category.category) menuText += `*${category.category}*\n`;
      for (const item of category.items) {
        menuText += `• ${item.name} — ${item.price.toFixed(2)} ريال\n`;
      }
      menuText += '\n';
      if (menuText.length > 3500) {
        menuText += '...\n(تم اختصار عرض المنيو لكبر الحجم)';
        break;
      }
    }

    await ctx.api.deleteMessage(ctx.chat.id, loadingMsg.message_id);
    await ctx.reply(menuText, { parse_mode: 'Markdown' });
    if (cachedItems.length > 0) {
      await ctx.reply('⚡ تم استخدام نسخة منيو محفوظة محلياً (Cache).');
    }
    await ctx.reply(
      `🍔 *الطلب فُتح من ${chosen.name}!*\n\nكل واحد يكتب طلبه في الجروب الآن 👇`,
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    console.error('Menu load error:', err.message);
    await ctx.api.editMessageText(
      ctx.chat.id,
      loadingMsg.message_id,
      '⚠️ صار خطأ أثناء تحميل المنيو. جرّب مطعم ثاني.'
    );
  }
}

async function handleSyncKeetaCommand(ctx) {
  if (ctx.chat.type === 'private') {
    await ctx.reply('استخدم الأمر داخل القروب.');
    return;
  }

  const chatMember = await ctx.getChatMember(ctx.from.id);
  const isAdminOrCreator = ['administrator', 'creator'].includes(chatMember.status);
  if (!isAdminOrCreator) {
    await ctx.reply('❌ فقط الإداري يقدر يشغّل المزامنة.');
    return;
  }

  const args = ctx.message.text?.split(' ').slice(1);
  const query = (args && args[0]) ? args.join(' ').trim() : 'ال';

  const startMsg = await ctx.reply(`🚚 بدء مزامنة كيتا للبحث: *${query}*\nقد تستغرق دقيقتين...`, { parse_mode: 'Markdown' });

  try {
    const seedQueries = [query, 'ا', 'ال', 'برجر', 'شاورما', 'بيتزا'];
    const byUrl = new Map();

    const isRealKeetaRestaurant = (result) => {
      if (!result || !result.url || !result.name) return false;
      if (result.manual) return false;

      try {
        const parsed = new URL(result.url);
        if (!parsed.hostname.includes('keeta.com')) return false;
        if (parsed.pathname === '/' || parsed.pathname.startsWith('/search')) return false;
        return true;
      } catch {
        return false;
      }
    };

    for (const seed of seedQueries) {
      const results = await scraperSearch('keeta', seed);
      for (const result of results) {
        if (!isRealKeetaRestaurant(result)) continue;
        if (!byUrl.has(result.url)) byUrl.set(result.url, result);
      }
      if (byUrl.size >= 20) break;
    }

    const candidates = Array.from(byUrl.values()).slice(0, 12);

    if (candidates.length === 0) {
      await ctx.api.editMessageText(
        ctx.chat.id,
        startMsg.message_id,
        '❌ ما لقيت روابط مطاعم حقيقية من كيتا حالياً (النتائج كانت fallback/صفحات عامة).\n\n' +
        'جرّب لاحقاً أو ابدأ طلب عادي، وإذا اشتغل جلب منيو لمطعم معين راح ينحفظ تلقائيًا في الكاش.'
      );
      return;
    }

    let synced = 0;
    let failed = 0;
    let emptyMenu = 0;

    for (const restaurant of candidates) {
      try {
        const menuCategories = await scraperMenu('keeta', restaurant.url);
        const allItems = menuCategories.flatMap((cat) =>
          cat.items.map((item) => ({ ...item, category: cat.category }))
        );
        if (allItems.length === 0) {
          emptyMenu++;
          failed++;
          continue;
        }

        const session = createSession({
          group_id: `sync_keeta_${Date.now()}`,
          group_title: 'sync-cache',
          restaurant: restaurant.name,
          delivery_app: 'keeta',
          restaurant_url: restaurant.url,
        });

        insertMenuItems(allItems.map((i) => ({ session_id: session.lastInsertRowid, ...i })));
        synced++;
      } catch {
        failed++;
      }
    }

    await ctx.api.editMessageText(
      ctx.chat.id,
      startMsg.message_id,
      `✅ تمت مزامنة كيتا\n\nالمحفوظ: ${synced}\nالفاشل: ${failed}\nبدون منيو: ${emptyMenu}\nالمحاولات: ${candidates.length}`
    );
  } catch (err) {
    await ctx.api.editMessageText(
      ctx.chat.id,
      startMsg.message_id,
      `❌ فشلت المزامنة: ${err.message}`
    );
  }
}

async function handleOrderMessage(ctx, text, session, userId, username, firstName) {
  const menuItems = getMenuItems(session.id);
  if (menuItems.length === 0) return;

  try {
    const parsed = await parseOrder(text, menuItems);
    if (!parsed.is_order || !parsed.items?.length) return;

    upsertOrder({
      session_id: session.id,
      user_id: userId,
      username,
      first_name: firstName,
      items: JSON.stringify(parsed.items),
      total: parsed.total,
      confirmed: 0,
    });

    const itemLines = parsed.items.map(i => `${i.name} × ${i.quantity}`).join(' + ');
    const confirmKb = new InlineKeyboard()
      .text('✅ أيوه صح', `confirm:${session.id}:${userId}`)
      .text('❌ لا، عدّل', `edit:${session.id}:${userId}`);

    const mention = username ? `@${username}` : firstName;
    await ctx.reply(
      `🛒 *${mention}*: ${itemLines} = *${parsed.total.toFixed(2)} ريال* — صح؟`,
      { parse_mode: 'Markdown', reply_markup: confirmKb, reply_to_message_id: ctx.message.message_id }
    );
  } catch (err) {
    console.error('Order parse error:', err.message);
  }
}

async function handleConfirmOrder(ctx, sessionId, userId) {
  const order = getOrder(sessionId, userId);
  if (!order) { await ctx.answerCallbackQuery(); return; }

  if (String(ctx.from.id) !== userId) {
    await ctx.answerCallbackQuery('❌ هذا مو طلبك!');
    return;
  }

  upsertOrder({
    session_id: sessionId,
    user_id: userId,
    username: order.username,
    first_name: order.first_name,
    items: order.items,
    total: order.total,
    confirmed: 1,
  });

  await ctx.answerCallbackQuery('✅ تم تأكيد طلبك!');
  await ctx.editMessageText(ctx.callbackQuery.message.text + '\n✅ *تم التأكيد*', { parse_mode: 'Markdown' });
}

async function handleDoneCommand(ctx, groupId, requesterId) {
  const session = getActiveSession(groupId);
  if (!session) {
    await ctx.reply('❌ ما في طلب مفتوح الآن.');
    return;
  }

  const chatMember = await ctx.getChatMember(ctx.from.id);
  const isAdminOrCreator = ['administrator', 'creator'].includes(chatMember.status);
  if (!isAdminOrCreator) {
    await ctx.reply('❌ فقط الإداري يقدر يغلق الطلب.');
    return;
  }

  closeSession(session.id);

  const orders = getSessionOrders(session.id);
  const summary = buildOrderSummary(session.restaurant, orders);

  await ctx.reply(`✅ *تم إغلاق الطلب!*`, { parse_mode: 'Markdown' });
  await ctx.reply(summary, { parse_mode: 'Markdown' });
}

module.exports = {
  handleStartCommand,
  handleGroupMessage,
  handleSyncKeetaCommand,
  handleAppSelection,
  handleRestaurantPick,
  handleConfirmOrder,
  handleDoneCommand,
};
