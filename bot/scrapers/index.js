const hungerstation = require('./hungerstation');
const keeta = require('./keeta');
const jahez = require('./jahez');

const scrapers = { hungerstation, keeta, jahez };

function getScraper(appKey) {
  return scrapers[appKey] || null;
}

async function search(appKey, restaurantName) {
  const scraper = getScraper(appKey);
  if (!scraper) throw new Error(`Unknown app: ${appKey}`);
  return scraper.search(restaurantName);
}

async function getMenu(appKey, restaurantUrl) {
  const scraper = getScraper(appKey);
  if (!scraper) throw new Error(`Unknown app: ${appKey}`);
  return scraper.getMenu(restaurantUrl);
}

module.exports = { search, getMenu, getScraper };
