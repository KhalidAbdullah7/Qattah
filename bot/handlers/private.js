const { setSetting, getSetting } = require('../database');

const awaitingInput = new Map();

async function handlePrivateStart(ctx) {
  const userId = String(ctx.from.id);
  const firstName = ctx.from.first_name || 'هلا';

  await ctx.reply(
    `أهلاً ${firstName}! 👋\n\n` +
    `أنا بوت قطة الدوام 🍔\n\n` +
    `✅ تم تسجيل رقمك — راح يوصلك نصيبك في القطة بالخاص بعد كل طلب.\n\n` +
    `للإداريين: استخدم /settings لضبط معلومات الدفع.`
  );
}

async function handleSettings(ctx) {
  const stcpay = getSetting('stcpay_number') || '(غير محدد)';
  const iban = getSetting('iban') || '(غير محدد)';
  const accountName = getSetting('account_name') || '(غير محدد)';
  const claudeKey = getSetting('claude_api_key') ? '✅ مضبوط' : '❌ غير محدد';

  await ctx.reply(
    `⚙️ *الإعدادات الحالية:*\n\n` +
    `STC Pay: ${stcpay}\n` +
    `IBAN: ${iban}\n` +
    `اسم الحساب: ${accountName}\n` +
    `Claude API: ${claudeKey}\n\n` +
    `لتغيير إعداد، أرسل:\n` +
    `/set stcpay 0512345678\n` +
    `/set iban SA1234567890\n` +
    `/set name محمد الأحمد\n` +
    `/set claude sk-ant-...`,
    { parse_mode: 'Markdown' }
  );
}

async function handleSetCommand(ctx) {
  const args = ctx.message.text?.split(' ').slice(1);
  if (!args || args.length < 2) {
    await ctx.reply('الاستخدام: /set [stcpay|iban|name|claude] [القيمة]');
    return;
  }

  const [key, ...valueParts] = args;
  const value = valueParts.join(' ').trim();

  const keyMap = {
    stcpay: 'stcpay_number',
    iban: 'iban',
    name: 'account_name',
    claude: 'claude_api_key',
  };

  const dbKey = keyMap[key.toLowerCase()];
  if (!dbKey) {
    await ctx.reply('مفتاح غير معروف. استخدم: stcpay, iban, name, claude');
    return;
  }

  setSetting(dbKey, value);
  const displayValue = dbKey === 'claude_api_key' ? '(محفوظ)' : value;
  await ctx.reply(`✅ تم الحفظ: ${key} = ${displayValue}`);
}

module.exports = { handlePrivateStart, handleSettings, handleSetCommand };
