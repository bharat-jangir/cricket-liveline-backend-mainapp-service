const puppeteer = require('puppeteer-core');
const cheerio = require('cheerio');

async function testPuppeteer() {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: 'C:\\Users\\ASUS\\.cache\\puppeteer\\chrome\\win64-148.0.7778.167\\chrome-win64\\chrome.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  const url = 'https://www.cricbuzz.com/cricket-stats/icc-rankings/men/batting';
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  
  const format = 't20';
  const tabs = await page.$$('a');
  for (const tab of tabs) {
    const text = await page.evaluate(el => el.textContent, tab);
    if (text && text.trim().toUpperCase() === format.toUpperCase()) {
      await tab.click();
      await new Promise(r => setTimeout(r, 2000));
      break;
    }
  }
  
  const data = await page.content();
  await browser.close();

  const $ = cheerio.load(data);
  const profileLinks = $('a[href*="/profiles/"]');
  console.log(`Found ${profileLinks.length} profile links`);
  
  const players = [];
  profileLinks.each((_, link) => {
    const $link = $(link);
    const $row = $link.closest('div.grid, tr, div.cb-col, div.border-b');
    if ($row.length === 0) return;
    
    const name = $link.find('.text-base.font-medium, .cb-font-16').text().trim() || $link.text().trim();
    if (name) {
      players.push(name);
    }
  });
  
  console.log('Top 3 T20 Batsmen:');
  console.log(players.slice(0, 3));
}

testPuppeteer().catch(console.error);
