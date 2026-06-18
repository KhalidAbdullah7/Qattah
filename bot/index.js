require('dotenv').config();
const { Bot, session } = require('grammy');
const { BOT_TOKEN, API_PORT } = require('./config');
const { getSetting, getActiveSession, getSessionOrders } = require('./database');
const { startServer } = require('./server');
const {
  handleGroupMessage,
  handleAppSelection,
  handleRestaurantPick,
  handleConfirmOrder,
  handleDoneCommand,
} = require('./handlers/group');
const { handlePrivateStart, handleSettings, handleSetCommand } = require('./handlers/private');

const token = BOT_TOKEN || getSetting('bot_token') || process.env.BOT_TOKEN;
if (!token) {
  console.error('❌ BOT_TOKEN غير موجود. أضفه في ملف .env أو عبر متغير البيئة BOT_TOKEN');
  process.exit(1);
}

const bot = new Bot(token);

bot.use(session({ initial: () => ({}) }));

bot.command('start', async (ctx) => {
  if (ctx.chat.type === 'private') {
    await handlePrivateStart(ctx);
  } else {
    await ctx.reply('أهلاً! أنا بوت قطة الدوام. اكتب "نطلب من [اسم المطعم]" لبدء طلب جماعي.');
  }
});

bot.command('settings', handleSettings);
bot.command('set', handleSetCommand);

bot.command('order', async (ctx) => {
  const args = ctx.message.text?.split(' ').slice(1).join(' ').trim();
  if (args) {
    ctx.message.text = `نطلب من ${args}`;
    await handleGroupMessage(ctx);
  } else {
    await ctx.reply('الاستخدام: /order اسم المطعم\nمثال: /order البيك');
  }
});

bot.command('done', async (ctx) => {
  const groupId = String(ctx.chat.id);
  const userId = String(ctx.from.id);
  await handleDoneCommand(ctx, groupId, userId);
});

bot.command('status', async (ctx) => {
  const groupId = String(ctx.chat.id);
  const session = getActiveSession(groupId);
  if (!session) {
    await ctx.reply('ما في طلب مفتوح الآن.');
    return;
  }
  const orders = getSessionOrders(session.id);
  const confirmed = orders.filter(o => o.confirmed);
  const total = confirmed.reduce((s, o) => s + o.total, 0);
  const lines = confirmed.map(o => `• ${o.first_name || o.username}: ${o.total.toFixed(2)} ريال ✅`);
  const unconf = orders.filter(o => !o.confirmed);
  unconf.forEach(o => lines.push(`• ${o.first_name || o.username}: (لم يؤكد) ⏳`));

  await ctx.reply(
    `📊 *طلب ${session.restaurant}*\n\n${lines.join('\n') || '(لا يوجد طلبات بعد)'}\n\n` +
    `💰 المجموع: ${total.toFixed(2)} ريال`,
    { parse_mode: 'Markdown' }
  );
});

bot.on('callback_query:data', async (ctx) => {
  const data = ctx.callbackQuery.data;
  const groupId = ctx.callbackQuery.message?.chat?.id
    ? String(ctx.callbackQuery.message.chat.id)
    : null;

  if (data.startsWith('app:')) {
    const appKey = data.slice(4);
    await handleAppSelection(ctx, appKey, groupId);
  } else if (data.startsWith('pick:')) {
    const [, gId, idx] = data.split(':');
    await handleRestaurantPick(ctx, gId, parseInt(idx));
  } else if (data.startsWith('confirm:')) {
    const [, sessionId, userId] = data.split(':');
    await handleConfirmOrder(ctx, parseInt(sessionId), userId);
  } else if (data.startsWith('edit:')) {
    await ctx.answerCallbackQuery();
    await ctx.reply('اكتب طلبك مجدداً وسأعدّله 📝');
  } else if (data.startsWith('cancel:')) {
    await ctx.answerCallbackQuery('تم الإلغاء');
    await ctx.deleteMessage();
  }
});

bot.on('message:text', async (ctx) => {
  if (ctx.chat.type === 'private') return;
  await handleGroupMessage(ctx);
});

bot.catch((err) => {
  console.error('Bot error:', err.message);
});

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║      🤖 قطة الدوام - بوت تيليقرام        ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');

  const apiIP = await startServer(API_PORT);

  await bot.start({
    onStart: (info) => {
      console.log(`  Bot: @${info.username}`);
      console.log(`  Mobile App URL: http://${apiIP}:${API_PORT}`);
      console.log('');
      console.log('  ✅ البوت شغال! أضفه للجروب وابدأ.');
      console.log('');
    }
  });
}

main();
