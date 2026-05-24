const html = require('fs').readFileSync('cricbuzz.html', 'utf8');
const cheerio = require('cheerio');
const $ = cheerio.load(html);
console.log('Body length:', $('body').text().length);
console.log($('body').text().substring(0, 500).replace(/\s+/g, ' '));
