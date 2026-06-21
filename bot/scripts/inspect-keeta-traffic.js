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
  let count = 0;

  page.on('response', async (response) => {
    const url = response.url();
    if (seen.has(url)) return;
    seen.add(url);

    if (!/keeta|meituan|wmapi|api/i.test(url)) return;

    const status = response.status();
    const ct = response.headers()['content-type'] || '';

    console.log(`${status} | ${ct || 'no-ct'} | ${url}`);

    if (ct.includes('application/json') && count < 15) {
      try {
        const text = await response.text();
        const snippet = text.slice(0, 180).replace(/\s+/g, ' ');
        console.log(`  snippet: ${snippet}`);
        count++;
      } catch {
        console.log('  snippet: <unreadable>');
      }
    }
  });

  const url = `https://www.keeta.com/search?q=${encodeURIComponent(query)}&city=riyadh`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(12000);

  await browser.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
