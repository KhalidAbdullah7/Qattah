const { search, getMenu } = require('../scrapers');

async function run() {
  const restaurant = process.argv[2] || 'البيك';
  const apps = ['hungerstation', 'keeta', 'jahez'];

  console.log(`Testing scrapers for: ${restaurant}`);
  console.log('='.repeat(60));

  for (const app of apps) {
    console.log(`\n[${app}] Search:`);
    try {
      const results = await search(app, restaurant);
      console.log(`  Found: ${results.length}`);
      results.slice(0, 3).forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.name}`);
        console.log(`     URL: ${r.url}`);
      });

      if (results.length > 0) {
        console.log(`[${app}] Menu:`);
        const menu = await getMenu(app, results[0].url);
        const itemCount = menu.reduce((sum, cat) => sum + (cat.items?.length || 0), 0);
        console.log(`  Categories: ${menu.length}`);
        console.log(`  Items: ${itemCount}`);
        if (menu.length > 0 && menu[0].items?.length > 0) {
          const sample = menu[0].items[0];
          console.log(`  Sample: ${sample.name} - ${sample.price}`);
        }
      }
    } catch (error) {
      console.log(`  Error: ${error.message}`);
    }
    console.log('-'.repeat(60));
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
