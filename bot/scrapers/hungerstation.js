const { chromium } = require('playwright');

async function withBrowser(fn) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
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
    const url = `https://hungerstation.com/sa-ar/restaurants?search=${encodeURIComponent(restaurantName)}`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    const results = await page.evaluate(() => {
      const cards = document.querySelectorAll('[data-testid="restaurant-card"], .restaurant-card, [class*="RestaurantCard"]');
      return Array.from(cards).slice(0, 5).map(card => ({
        name: card.querySelector('[class*="name"], h2, h3')?.textContent?.trim() || '',
        url: card.closest('a')?.href || card.querySelector('a')?.href || '',
        rating: card.querySelector('[class*="rating"], [class*="star"]')?.textContent?.trim() || '',
      })).filter(r => r.name && r.url);
    });

    return results.length > 0 ? results : searchFallback(restaurantName, 'hungerstation');
  }).catch(() => searchFallback(restaurantName, 'hungerstation'));
}

async function getMenu(restaurantUrl) {
  return withBrowser(async (ctx) => {
    const page = await ctx.newPage();
    await page.goto(restaurantUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    const menu = await page.evaluate(() => {
      const categories = [];
      const catEls = document.querySelectorAll('[class*="category"], [class*="Category"], section[data-testid]');

      if (catEls.length === 0) {
        const items = document.querySelectorAll('[class*="product"], [class*="Product"], [class*="item"], [class*="Item"]');
        const extracted = Array.from(items).slice(0, 40).map(el => {
          const name = el.querySelector('[class*="name"], h3, h4')?.textContent?.trim();
          const priceText = el.querySelector('[class*="price"], [class*="Price"]')?.textContent?.trim();
          const price = priceText ? parseFloat(priceText.replace(/[^\d.]/g, '')) : 0;
          return name && price > 0 ? { name, price } : null;
        }).filter(Boolean);
        return [{ category: 'القائمة', items: extracted }];
      }

      catEls.forEach(cat => {
        const catName = cat.querySelector('[class*="title"], h2, h3')?.textContent?.trim() || 'الأصناف';
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

function searchFallback(name, app) {
  return [{
    name: name,
    url: `https://hungerstation.com/sa-ar/restaurants?search=${encodeURIComponent(name)}`,
    rating: '',
    manual: true,
  }];
}

module.exports = { search, getMenu };
