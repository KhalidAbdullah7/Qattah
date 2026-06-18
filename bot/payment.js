const { getSetting } = require('./database');

function buildUserDM(order, restaurant) {
  const items = JSON.parse(order.items);
  const lines = items.map(i => `• ${i.name} × ${i.quantity} = ${(i.price * i.quantity).toFixed(2)} ريال`);

  const stcpay = getSetting('stcpay_number');
  const iban = getSetting('iban');
  const name = getSetting('account_name') || '';

  let paymentSection = '\n💸 حوّل المبلغ على:';
  if (stcpay) paymentSection += `\nSTC Pay: ${stcpay}${name ? ' — ' + name : ''}`;
  if (iban) paymentSection += `\nIBAN: ${iban}`;
  if (!stcpay && !iban) paymentSection += '\n(لم يتم إعداد معلومات الدفع بعد)';

  return [
    `🧾 *طلبك من ${restaurant}:*`,
    ...lines,
    '',
    `*المجموع: ${order.total.toFixed(2)} ريال*`,
    paymentSection,
  ].join('\n');
}

function buildAdminSummary(restaurant, orders) {
  const confirmed = orders.filter(o => o.confirmed);
  const grandTotal = confirmed.reduce((s, o) => s + o.total, 0);

  const lines = confirmed.map(o => {
    const dmIcon = o.dm_sent ? '✅' : '⚠️ (ما وصله الرسالة)';
    return `• ${o.first_name || o.username || 'مجهول'}: ${o.total.toFixed(2)} ريال ${dmIcon}`;
  });

  const unconfirmed = orders.filter(o => !o.confirmed);
  if (unconfirmed.length > 0) {
    lines.push('');
    lines.push('⏳ لم يؤكدوا:');
    unconfirmed.forEach(o => lines.push(`• ${o.first_name || o.username || 'مجهول'}`));
  }

  return [
    `📊 *ملخص الطلب — ${restaurant}*`,
    '',
    ...lines,
    '',
    `💰 *الإجمالي: ${grandTotal.toFixed(2)} ريال*`,
    `👥 ${confirmed.length} أشخاص`,
  ].join('\n');
}

module.exports = { buildUserDM, buildAdminSummary };
