const { chromium } = require('playwright');

async function withBrowser(fn) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
    locale: 'ar-SA',
    geolocation: { latitude: 24.7136, longitude: 46.6753 },
    permissions: ['geolocation'],
  });
  try {
    return await fn(context);
  } finally {
    await browser.close();
  }
}

async function search(restaurantName) {
  return withBrowser(async (ctx) => {
    const page = await ctx.newPage();
    await page.goto(`https://www.jahez.net/restaurants?search=${encodeURIComponent(restaurantName)}`, {
      waitUntil: 'networkidle', timeout: 30000
    });
    await page.waitForTimeout(2000);

    const results = await page.evaluate(() => {
      const cards = document.querySelectorAll('[class*="restaurant"], [class*="vendor"], [class*="store"]');
      return Array.from(cards).slice(0, 5).map(card => ({
        name: card.querySelector('[class*="name"], h2, h3')?.textContent?.trim() || '',
        url: card.closest('a')?.href || card.querySelector('a')?.href || '',
        rating: card.querySelector('[class*="rating"]')?.textContent?.trim() || '',
      })).filter(r => r.name && r.url);
    });

    return results.length > 0 ? results : [{ name: restaurantName, url: `https://www.jahez.net/restaurants?search=${encodeURIComponent(restaurantName)}`, rating: '', manual: true }];
  }).catch(() => [{ name: restaurantName, url: `https://www.jahez.net`, rating: '', manual: true }]);
}

async function getMenu(restaurantUrl) {
  return withBrowser(async (ctx) => {
    const page = await ctx.newPage();
    await page.goto(restaurantUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    const menu = await page.evaluate(() => {
      const categories = [];
      const catEls = document.querySelectorAll('[class*="category"], section, [class*="menu-section"]');

      if (catEls.length === 0) {
        const items = document.querySelectorAll('[class*="product"], [class*="item"], [class*="meal"]');
        const extracted = Array.from(items).slice(0, 40).map(el => {
          const name = el.querySelector('[class*="name"], h3, h4')?.textContent?.trim();
          const priceText = el.querySelector('[class*="price"]')?.textContent?.trim();
          const price = priceText ? parseFloat(priceText.replace(/[^\d.]/g, '')) : 0;
          return name && price > 0 ? { name, price } : null;
        }).filter(Boolean);
        return [{ category: 'القائمة', items: extracted }];
      }

      catEls.forEach(cat => {
        const catName = cat.querySelector('h2, h3, [class*="title"]')?.textContent?.trim() || 'الأصناف';
        const items = Array.from(cat.querySelectorAll('[class*="product"], [class*="item"]')).map(el => {
          const name = el.querySelector('[class*="name"], h3, h4')?.textContent?.trim();
          const priceText = el.querySelector('[class*="price"]')?.textContent?.trim();
          const price = priceText ? parseFloat(priceText.replace(/[^\d.]/g, '')) : 0;
          return name && price > 0 ? { name, price } : null;
        }).filter(Boolean);
        if (items.length > 0) categories.push({ category: catName, items });
      });

      return categories;
    });

    return menu;
  }).catch(() => []);
}

module.exports = { search, getMenu };
