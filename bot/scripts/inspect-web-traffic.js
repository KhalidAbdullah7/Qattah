const { chromium } = require('playwright');

async function run() {
  const target = process.argv[2] || 'hungerstation';
  const query = process.argv[3] || 'البيك';

  const urls = {
    hungerstation: `https://hungerstation.com/sa-ar/restaurants?search=${encodeURIComponent(query)}`,
    jahez: `https://www.jahez.net/restaurants?search=${encodeURIComponent(query)}`,
  };

  const startUrl = urls[target];
  if (!startUrl) {
    console.error('Unknown target');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
    locale: 'ar-SA',
    geolocation: { latitude: 24.7136, longitude: 46.6753 },
    permissions: ['geolocation'],
  });

  const page = await context.newPage();
  const seen = new Set();

  page.on('response', async (response) => {
    const url = response.url();
    if (seen.has(url)) return;
    seen.add(url);

    if (!new RegExp(target, 'i').test(url) && !/api|graphql|search|menu|restaurant|store|vendor/i.test(url)) return;

    const status = response.status();
    const ct = response.headers()['content-type'] || '';
    console.log(`${status} | ${ct || 'no-ct'} | ${url}`);

    if (ct.includes('application/json')) {
      try {
        const text = await response.text();
        console.log(`  snippet: ${text.slice(0, 160).replace(/\s+/g, ' ')}`);
      } catch {
        console.log('  snippet: <unreadable>');
      }
    }
  });

  await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(10000);
  await browser.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
