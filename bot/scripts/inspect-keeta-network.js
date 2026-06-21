const { chromium } = require('playwright');

async function run() {
  const query = process.argv[2] || 'البيك';
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
    try {
      const url = response.url();
      const ct = response.headers()['content-type'] || '';
      if (!ct.includes('application/json')) return;

      const lower = url.toLowerCase();
      if (!/(search|restaurant|store|vendor|menu|category|item)/.test(lower)) return;
      if (seen.has(url)) return;
      seen.add(url);

      let snippet = '';
      try {
        const text = await response.text();
        snippet = text.slice(0, 220).replace(/\s+/g, ' ');
      } catch {
        snippet = '<unable to read body>';
      }

      console.log('---');
      console.log('status:', response.status());
      console.log('url:', url);
      console.log('snippet:', snippet);
    } catch {
      // ignore
    }
  });

  const url = `https://www.keeta.com/search?q=${encodeURIComponent(query)}&city=riyadh`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(8000);

  await browser.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
