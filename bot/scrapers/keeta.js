const { chromium } = require('playwright');

function parsePrice(value) {
  const normalized = String(value || '').replace(/,/g, '.').replace(/[^\d.]/g, '');
  const num = parseFloat(normalized);
  return Number.isFinite(num) ? num : 0;
}

function normalizeCategories(rawMenu) {
  const categories = [];
  for (const cat of rawMenu || []) {
    const category = (cat?.category || 'القائمة').trim() || 'القائمة';
    const items = [];
    for (const item of cat?.items || []) {
      const name = String(item?.name || '').trim();
      const price = parsePrice(item?.price);
      if (!name || price <= 0) continue;
      items.push({ name, price });
    }
    if (items.length > 0) categories.push({ category, items });
  }
  return categories;
}

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
    await page.goto(`https://www.keeta.com/search?q=${encodeURIComponent(restaurantName)}&city=riyadh`, {
      waitUntil: 'networkidle', timeout: 30000
    });
    await page.waitForTimeout(1800);

    const results = await page.evaluate((origin) => {
      const asAbs = (value) => {
        try { return new URL(value, origin).href; } catch { return ''; }
      };

      const selectors = [
        '[class*="vendor"]',
        '[class*="restaurant"]',
        '[class*="store"]',
        'a[href*="restaurant"]',
        'a[href*="store"]',
      ];

      const seen = new Set();
      const found = [];

      for (const selector of selectors) {
        for (const card of Array.from(document.querySelectorAll(selector))) {
          const anchor = card.tagName === 'A' ? card : card.closest('a') || card.querySelector('a');
          const url = asAbs(anchor?.getAttribute('href') || anchor?.href || '');
          const name = (
            card.querySelector('[class*="name"]')?.textContent ||
            card.querySelector('h2,h3,strong')?.textContent ||
            anchor?.textContent ||
            ''
          ).trim();

          if (!name || !url || seen.has(url)) continue;
          seen.add(url);
          found.push({
            name,
            url,
            rating: (card.querySelector('[class*="rating"]')?.textContent || '').trim(),
          });
          if (found.length >= 10) return found;
        }
      }

      return found;
    });

    return results.length > 0 ? results : [{ name: restaurantName, url: `https://www.keeta.com/search?q=${encodeURIComponent(restaurantName)}`, rating: '', manual: true }];
  }).catch(() => [{ name: restaurantName, url: `https://www.keeta.com`, rating: '', manual: true }]);
}

async function getMenu(restaurantUrl) {
  return withBrowser(async (ctx) => {
    const page = await ctx.newPage();
    await page.goto(restaurantUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    const menu = await page.evaluate(() => {
      const categories = [];
      const catEls = document.querySelectorAll('[class*="category"], [class*="section"], [class*="group"], [data-testid*="section"]');

      if (catEls.length === 0) {
        const items = document.querySelectorAll('[class*="item"], [class*="product"], [class*="meal"], [data-testid*="item"]');
        const extracted = Array.from(items).slice(0, 40).map(el => {
          const name = el.querySelector('[class*="name"], h3, h4, strong')?.textContent?.trim();
          const priceText = el.querySelector('[class*="price"]')?.textContent?.trim();
          const price = priceText ? parseFloat(priceText.replace(/[^\d.]/g, '')) : 0;
          return name && price > 0 ? { name, price } : null;
        }).filter(Boolean);
        return [{ category: 'القائمة', items: extracted }];
      }

      catEls.forEach(cat => {
        const catName = cat.querySelector('[class*="title"], h2, h3')?.textContent?.trim() || 'الأصناف';
        const items = Array.from(cat.querySelectorAll('[class*="item"], [class*="product"], [data-testid*="item"]')).map(el => {
          const name = el.querySelector('[class*="name"], h3, h4')?.textContent?.trim();
          const priceText = el.querySelector('[class*="price"]')?.textContent?.trim();
          const price = priceText ? parseFloat(priceText.replace(/[^\d.]/g, '')) : 0;
          return name && price > 0 ? { name, price } : null;
        }).filter(Boolean);
        if (items.length > 0) categories.push({ category: catName, items });
      });

      return categories;
    });

    return normalizeCategories(menu);
  }).catch(() => []);
}

module.exports = { search, getMenu };
