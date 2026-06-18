const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const app = express();
const PORT = 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'sessions.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '{}');

function loadSessions() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return {}; }
}

function saveSessions(sessions) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(sessions, null, 2));
}

function getNetworkIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}

app.post('/api/session', (req, res) => {
  const { restaurant, items } = req.body;
  if (!restaurant || !items || items.length === 0)
    return res.status(400).json({ error: 'بيانات ناقصة' });

  const sessions = loadSessions();
  const id = crypto.randomBytes(4).toString('hex');
  sessions[id] = { id, restaurant, items, orders: {}, createdAt: new Date().toISOString(), status: 'open' };
  saveSessions(sessions);
  res.json({ id, networkIP: getNetworkIP(), port: PORT });
});

app.get('/api/session/:id', (req, res) => {
  const sessions = loadSessions();
  const session = sessions[req.params.id];
  if (!session) return res.status(404).json({ error: 'الجلسة غير موجودة' });
  res.json({
    id: session.id,
    restaurant: session.restaurant,
    items: session.items,
    status: session.status,
    orderCount: Object.keys(session.orders).length
  });
});

app.post('/api/order/:id', (req, res) => {
  const { name, items } = req.body;
  if (!name || !items || items.length === 0)
    return res.status(400).json({ error: 'بيانات ناقصة' });

  const sessions = loadSessions();
  const session = sessions[req.params.id];
  if (!session) return res.status(404).json({ error: 'الجلسة غير موجودة' });
  if (session.status === 'closed') return res.status(400).json({ error: 'الطلبات مغلقة' });

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  session.orders[name] = { name, items, total, submittedAt: new Date().toISOString() };
  saveSessions(sessions);
  res.json({ success: true, total });
});

app.post('/api/session/:id/status', (req, res) => {
  const { status } = req.body;
  const sessions = loadSessions();
  const session = sessions[req.params.id];
  if (!session) return res.status(404).json({ error: 'الجلسة غير موجودة' });
  session.status = status;
  saveSessions(sessions);
  res.json({ success: true });
});

app.get('/api/summary/:id', (req, res) => {
  const sessions = loadSessions();
  const session = sessions[req.params.id];
  if (!session) return res.status(404).json({ error: 'الجلسة غير موجودة' });

  const orders = Object.values(session.orders);
  const grandTotal = orders.reduce((sum, o) => sum + o.total, 0);
  res.json({ id: session.id, restaurant: session.restaurant, status: session.status, orders, grandTotal });
});

const networkIP = getNetworkIP();
app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║        قطة الدوام - شغال!                ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
  console.log(`  على جهازك:    http://localhost:${PORT}`);
  console.log(`  شبكة الدوام:  http://${networkIP}:${PORT}`);
  console.log('');
  console.log('  شارك رابط شبكة الدوام مع زملاءك');
  console.log('');
});
