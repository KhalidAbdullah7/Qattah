const { chromium } = require('playwright');

function toAbsoluteUrl(value, base) {
  if (!value) return '';
  try {
    return new URL(value, base).href;
  } catch {
    return '';
  }
}

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
    await page.waitForTimeout(1200);

    const results = await page.evaluate((origin) => {
      const asAbs = (value) => {
        try { return new URL(value, origin).href; } catch { return ''; }
      };

      const selectors = [
        '[data-testid="restaurant-card"]',
        'a[href*="restaurant"]',
        'a[href*="store"]',
        '.restaurant-card',
        '[class*="RestaurantCard"]',
      ];

      const seen = new Set();
      const found = [];

      for (const selector of selectors) {
        const nodes = Array.from(document.querySelectorAll(selector));
        for (const node of nodes) {
          const anchor = node.tagName === 'A' ? node : node.closest('a') || node.querySelector('a');
          const href = asAbs(anchor?.getAttribute('href') || anchor?.href || '');

          const name = (
            node.querySelector('[class*="name"]')?.textContent ||
            node.querySelector('h2,h3,strong')?.textContent ||
            anchor?.textContent ||
            ''
          ).trim();

          if (!name || !href || seen.has(href)) continue;

          seen.add(href);
          found.push({
            name,
            url: href,
            rating: (node.querySelector('[class*="rating"], [class*="star"]')?.textContent || '').trim(),
          });
          if (found.length >= 10) return found;
        }
      }

      return found;
    });

    if (results.length > 0) return results;

    const keyword = restaurantName.trim().toLowerCase();
    const fallbackLinks = await page.$$eval('a[href]', (anchors, origin) => {
      const out = [];
      const seen = new Set();
      for (const a of anchors) {
        const text = (a.textContent || '').trim();
        const hrefRaw = a.getAttribute('href') || a.href || '';
        let href = '';
        try { href = new URL(hrefRaw, origin).href; } catch { href = ''; }
        if (!text || !href || seen.has(href)) continue;
        seen.add(href);
        out.push({ name: text, url: href, rating: '' });
        if (out.length >= 40) break;
      }
      return out;
    }, 'https://hungerstation.com');

    const filtered = fallbackLinks
      .filter((r) => r.name.toLowerCase().includes(keyword) || r.url.toLowerCase().includes(encodeURIComponent(keyword)))
      .slice(0, 8);

    return filtered.length > 0 ? filtered : searchFallback(restaurantName, 'hungerstation');
  }).catch(() => searchFallback(restaurantName, 'hungerstation'));
}

async function getMenu(restaurantUrl) {
  return withBrowser(async (ctx) => {
    const page = await ctx.newPage();
    await page.goto(restaurantUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2500);

    const menu = await page.evaluate(() => {
      const categories = [];
      const catEls = document.querySelectorAll(
        '[class*="category"], [class*="Category"], [class*="menu-section"], section[data-testid]'
      );

      if (catEls.length === 0) {
        const items = document.querySelectorAll(
          '[class*="product"], [class*="Product"], [class*="item"], [class*="Item"], [data-testid*="menu-item"]'
        );
        const extracted = Array.from(items).slice(0, 40).map(el => {
          const name = el.querySelector('[class*="name"], h3, h4')?.textContent?.trim();
          const priceText = el.querySelector('[class*="price"], [class*="Price"]')?.textContent?.trim();
          const price = priceText ? parseFloat(priceText.replace(/[^\d.]/g, '')) : 0;
          return name && price > 0 ? { name, price } : null;
        }).filter(Boolean);
        return [{ category: 'القائمة', items: extracted }];
      }

      catEls.forEach((cat) => {
        const catName = cat.querySelector('[class*="title"], h2, h3')?.textContent?.trim() || 'الأصناف';
        const items = Array.from(cat.querySelectorAll('[class*="product"], [class*="item"], [data-testid*="menu-item"]')).map(el => {
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

function searchFallback(name, app) {
  return [{
    name: name,
    url: `https://hungerstation.com/sa-ar/restaurants?search=${encodeURIComponent(name)}`,
    rating: '',
    manual: true,
  }];
}

module.exports = { search, getMenu };
