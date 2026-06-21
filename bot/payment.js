function buildOrderSummary(restaurant, orders) {
  const confirmed = orders.filter(o => o.confirmed);

  if (confirmed.length === 0) {
    return `📊 *ملخص الطلب — ${restaurant}*\n\nما فيه طلبات مؤكدة لسه.`;
  }

  const lines = confirmed.map((order) => {
    const items = JSON.parse(order.items);
    const itemText = items.map((item) => `${item.name} × ${item.quantity}`).join(' + ');
    return `• ${order.first_name || order.username || 'مجهول'}: ${itemText} = ${order.total.toFixed(2)} ريال`;
  });

  const grandTotal = confirmed.reduce((sum, order) => sum + order.total, 0);

  return [
    `📊 *ملخص الطلب — ${restaurant}*`,
    '',
    ...lines,
    '',
    `💰 *الإجمالي: ${grandTotal.toFixed(2)} ريال*`,
    `👥 ${confirmed.length} أشخاص`,
  ].join('\n');
}

module.exports = { buildOrderSummary };
