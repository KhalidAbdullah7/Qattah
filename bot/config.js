const path = require('path');

module.exports = {
  BOT_TOKEN: process.env.BOT_TOKEN || '',
  CLAUDE_API_KEY: process.env.CLAUDE_API_KEY || '',

  DB_PATH: path.join(__dirname, 'data', 'qattah.db'),

  API_PORT: parseInt(process.env.API_PORT || '3001'),

  RIYADH_COORDS: { lat: 24.7136, lng: 46.6753 },

  DELIVERY_APPS: {
    hungerstation: { nameAr: 'هنقرستيشن', nameEn: 'HungerStation' },
    keeta: { nameAr: 'كيتا', nameEn: 'Keeta' },
    jahez: { nameAr: 'جاهز', nameEn: 'Jahez' },
  },

  ADMIN_TRIGGERS: ['تم الطلب', 'اقفل الطلب', 'done', '/done'],
  ORDER_START_PATTERNS: ['نطلب من', 'اليوم من', 'نفطر من', 'نتغدى من', 'نتعشى من', '/order'],
};
