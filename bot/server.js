const express = require('express');
const { getSessions, getSession, getSessionOrders, getMenuItems, getSetting, setSetting } = require('./database');
const os = require('os');

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

app.get('/api/sessions', (req, res) => {
  res.json(getSessions());
});

app.get('/api/sessions/:id', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Not found' });
  const orders = getSessionOrders(req.params.id);
  const menu = getMenuItems(req.params.id);
  res.json({ ...session, orders, menu });
});

app.get('/api/settings', (req, res) => {
  res.json({
    claude_api_key: getSetting('claude_api_key') ? 'configured' : '',
    api_port: getSetting('api_port') || '3001',
  });
});

app.put('/api/settings', (req, res) => {
  const allowed = ['claude_api_key'];
  for (const [key, value] of Object.entries(req.body)) {
    if (allowed.includes(key)) setSetting(key, value);
  }
  res.json({ success: true });
});

function getNetworkIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}

function startServer(port) {
  return new Promise((resolve) => {
    app.listen(port, '0.0.0.0', () => {
      const ip = getNetworkIP();
      console.log(`  API Server: http://${ip}:${port}`);
      resolve(ip);
    });
  });
}

module.exports = { startServer };
