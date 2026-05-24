const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
  const { data } = await axios.get('https://www.cricbuzz.com/cricket-stats/icc-rankings/men/t20/all-rounder', {
    headers: {
      'User-Agent': 'Mozilla/5.0',
    }
  });
  const $ = cheerio.load(data);
  const rows = $('.grid.grid-cols-4.items-center.border-b');
  console.log('Found rows:', rows.length);
  
  rows.each((i, el) => {
    const $row = $(el);
    const $link = $row.find('a[href*="/profiles/"]');
    
    // Attempt to extract rank from the first text chunk in the row
    const rankText = $row.find('.text-base, .cb-col-16, .cb-rank-num').first().text().trim() || $row.text().trim().split(/\s+/)[0];
    const rank = parseInt(rankText, 10);

    const name = $link.find('.text-base.font-medium, .cb-font-16').text().trim() || $link.text().trim();
    
    // Country is usually greyed out text
    const country = $link.find('.text-cbTxtGray, .cb-font-12').text().trim() || $row.find('.text-cbTxtGray').last().text().trim() || "Unknown";

    // Extract rating/points - usually the last numeric value in the row
    const pointsDiv = $row.find('> div:last-child, td:last-child, .cb-col-16:last-child');
    const ratingText = pointsDiv.find('.text-base, .cb-font-16').text().trim() || pointsDiv.text().trim();
    const rating = parseInt(ratingText, 10) || parseInt($row.text().match(/\b(\d{3,4})\b/g)?.pop() || "0", 10);

    const isRankNum = !isNaN(rank);
    const isRatingNum = !isNaN(rating) && rating > 0;
    
    console.log(`[${i}] ${name} | rankText: ${rankText} -> ${rank} | ratingText: ${ratingText} -> ${rating}`);
    console.log(`Valid? rank:${isRankNum} name:${!!name} rating:${isRatingNum}`);
  });
}

test();
