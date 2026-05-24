import { Injectable, Logger } from '@nestjs/common';
import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';

export interface PlayerRankingData {
  rank: number;
  name: string;
  country: string;
  rating: number;
  gender: 'men' | 'women';
  format: 'test' | 'odi' | 't20';
  role: 'batsman' | 'bowler' | 'all-rounder' | 'batting';
  cricbuzzId?: string;
  imageUrl?: string;
}

export interface TeamRankingData {
  rank: number;
  teamName: string;
  teamCode?: string;
  matchesPlayed?: number;
  points?: number;
  rating?: number;
  gender: 'men' | 'women';
  format: 'test' | 'odi' | 't20';
}

@Injectable()
export class RankingScraperService {
  private readonly logger = new Logger(RankingScraperService.name);

  async fetchWithParams(params: { type: string; gender: string; format: string; role?: string }): Promise<any[]> {
    const { type, gender, format, role } = params;

    if (type === 'player') {
      const formattedRole = role === 'batting' ? 'batting' : role === 'bowling' ? 'bowling' : 'all-rounder';
      const url = `https://www.cricbuzz.com/cricket-stats/icc-rankings/${gender}/${format}/${formattedRole}`;
      this.logger.log(`Fetching from ${url}`);
      const players = await this.fetchPlayerRankingsModern({ url, gender, format, role: formattedRole });
      return players.map(p => ({ ...p, type: 'player' }));
    } else {
      const url = `https://www.cricbuzz.com/cricket-stats/icc-rankings/${gender}/teams`;
      this.logger.log(`Fetching from ${url}`);
      const teams = await this.fetchTeamRankingsModern({ url, gender, format });
      return teams.map(t => ({ ...t, type: 'team' }));
    }
  }

  /**
   * Modern scraper with proper format switching
   */
  private async fetchPlayerRankingsModern(config: {
    url: string;
    gender: string;
    format: string;
    role: string;
  }): Promise<PlayerRankingData[]> {
    const rankings: PlayerRankingData[] = [];
    const seenPlayerIds = new Set<string>();
    let browser = null;
    let page = null;

    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      page = await browser.newPage();

      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.setViewport({ width: 1920, height: 1080 });

      await page.goto(config.url, { waitUntil: 'networkidle2', timeout: 30000 });

      // Wait for the page to load completely
      await page.waitForSelector('a[href*="/profiles/"]', { timeout: 10000 });

      // Handle format switching
      const targetFormat = config.format.toLowerCase();
      this.logger.debug(`Target format: ${targetFormat}`);

      if (targetFormat !== 'test') {
        const formatSwitched = await this.switchFormat(page, targetFormat);
        if (formatSwitched) {
          this.logger.log(`Successfully switched to ${targetFormat.toUpperCase()} format`);
          // Wait for content to reload after format change
          await new Promise(r => setTimeout(r, 3000));
          await page.waitForSelector('a[href*="/profiles/"]', { timeout: 10000 });
        } else {
          this.logger.warn(`Could not switch to ${targetFormat} format, using default (may be Test)`);
        }
      }

      // Get the final rendered content
      const data = await page.content();
      const $ = cheerio.load(data);

      // Find all player rows using multiple selectors
      const playerRows = this.findPlayerRows($);
      this.logger.debug(`Found ${playerRows.length} player rows on ${config.url}`);

      playerRows.each((_, row) => {
        try {
          const playerData = this.extractPlayerData($, row, config);
          if (playerData && !seenPlayerIds.has(playerData.cricbuzzId)) {
            seenPlayerIds.add(playerData.cricbuzzId);
            rankings.push(playerData);
          }
        } catch (rowError) {
          // Skip individual row errors
        }
      });

      this.logger.log(`Successfully parsed ${rankings.length} ${config.role} rankings for ${config.format.toUpperCase()} from ${config.url}`);
      return rankings;

    } catch (error) {
      this.logger.error(`Error fetching ${config.url}: ${error.message}`);
      throw error;
    } finally {
      if (page) await page.close().catch(e => this.logger.warn(e.message));
      if (browser) await browser.close().catch(e => this.logger.warn(e.message));
    }
  }

  /**
   * Switch format by clicking the appropriate tab
   */
  private async switchFormat(page: any, targetFormat: string): Promise<boolean> {
    try {
      // Try multiple selector strategies to find format tabs
      const formatSelectors = [
        // Direct text content in various elements
        `::-p-text(${targetFormat.toUpperCase()})`,
        // Nav links
        'nav a, nav button, nav div[role="tab"]',
        // Format selector container
        '.cb-nav-tabs a, .tabs a, [role="tablist"] [role="tab"]',
        // Any element containing format text
        'a, button, div[class*="tab"], span[class*="tab"]'
      ];

      for (const selector of formatSelectors) {
        try {
          const elements = await page.$$(selector);
          for (const element of elements) {
            const text = await page.evaluate(el => el.textContent?.trim().toUpperCase(), element);
            if (text === targetFormat.toUpperCase()) {
              // Check if already active
              const isActive = await page.evaluate(el => {
                return el.classList.contains('active') ||
                  el.classList.contains('cb-active-tab') ||
                  el.getAttribute('aria-selected') === 'true';
              }, element);

              if (!isActive) {
                await element.click();
                this.logger.debug(`Clicked ${targetFormat.toUpperCase()} tab`);
                return true;
              } else {
                this.logger.debug(`${targetFormat.toUpperCase()} tab already active`);
                return true;
              }
            }
          }
        } catch (err) {
          // Continue to next selector
        }
      }

      // Alternative: Try to use page.evaluate to click by text content
      const clicked = await page.evaluate((format) => {
        const elements = Array.from(document.querySelectorAll('a, button, div[role="tab"], span'));
        const target = elements.find(el =>
          el.textContent?.trim().toUpperCase() === format.toUpperCase()
        );
        if (target && !target.classList.contains('active')) {
          (target as HTMLElement).click();
          return true;
        }
        return false;
      }, targetFormat);

      if (clicked) {
        this.logger.debug(`Clicked ${targetFormat.toUpperCase()} via evaluate`);
        return true;
      }

      this.logger.warn(`Could not find ${targetFormat.toUpperCase()} tab`);
      return false;

    } catch (error) {
      this.logger.error(`Error switching format: ${error.message}`);
      return false;
    }
  }

  /**
   * Find player rows using multiple selectors
   */
  private findPlayerRows($: cheerio.CheerioAPI): any {
    // Try multiple selectors in order of specificity
    let rows = $('.grid.grid-cols-4.items-center.border-b');
    if (rows.length > 0) return rows;

    rows = $('.cb-ranking-table tbody tr');
    if (rows.length > 0) return rows;

    rows = $('div[class*="border-b"]').filter((_, el) => {
      return $(el).find('a[href*="/profiles/"]').length > 0;
    });
    if (rows.length > 0) return rows;

    rows = $('tr').filter((_, el) => {
      return $(el).find('a[href*="/profiles/"]').length > 0;
    });

    return rows;
  }

  /**
   * Extract player data from a row element
   */
  private extractPlayerData($: cheerio.CheerioAPI, row: any, config: any): PlayerRankingData | null {
    const $row = $(row);
    const $link = $row.find('a[href*="/profiles/"]').first();

    if (!$link.length) return null;

    const href = $link.attr('href');
    const cricbuzzId = href ? href.split('/')[2] : undefined;
    if (!cricbuzzId) return null;

    // Extract rank
    let rank = 0;
    const rankSelectors = ['.text-base:first-child', '.font-bold:first-child', 'td:first-child', '> div:first-child'];
    for (const selector of rankSelectors) {
      const rankText = $row.find(selector).first().text().trim();
      rank = parseInt(rankText, 10);
      if (!isNaN(rank) && rank > 0) break;
    }

    // If still not found, try regex on row text
    if (isNaN(rank) || rank === 0) {
      const match = $row.text().match(/^(\d+)/);
      if (match) rank = parseInt(match[1], 10);
    }

    // Extract name
    let name = $link.find('.text-base.font-medium, .font-medium, .cb-font-16').text().trim();
    if (!name) name = $link.text().trim().split(/\s*\(/)[0].trim();

    // Extract country
    let country = $link.find('.text-cbTxtGray, .text-gray-500, .cb-font-12').text().trim();
    if (!country) country = $row.find('.text-cbTxtGray').last().text().trim();
    if (!country) country = 'Unknown';

    // Clean country name (remove player name if accidentally included)
    country = country.replace(name, '').trim();

    // Extract rating
    let rating = 0;
    const ratingSelectors = ['> div:last-child .text-base', 'td:last-child', '.text-right'];
    for (const selector of ratingSelectors) {
      const ratingText = $row.find(selector).first().text().trim();
      rating = parseInt(ratingText, 10);
      if (!isNaN(rating) && rating > 0) break;
    }

    // If still not found, find last 3-4 digit number in row
    if (isNaN(rating) || rating === 0) {
      const numbers = $row.text().match(/\b(\d{3,4})\b/g);
      if (numbers && numbers.length) {
        rating = parseInt(numbers[numbers.length - 1], 10);
      }
    }

    // Extract image URL
    const img = $link.find('img');
    const imageUrl = img.attr('src') || img.attr('data-src') || img.attr('srcset')?.split(' ')[0];

    // Validate data
    if (isNaN(rank) || rank === 0 || !name || isNaN(rating) || rating === 0) {
      this.logger.debug(`Skipping invalid player: rank=${rank}, name=${name}, rating=${rating}`);
      return null;
    }

    return {
      rank,
      name: name.trim(),
      country: country || 'Unknown',
      rating,
      gender: config.gender as 'men' | 'women',
      format: config.format as 'test' | 'odi' | 't20',
      role: config.role as 'batsman' | 'bowler' | 'all-rounder' | 'batting',
      cricbuzzId,
      imageUrl,
    };
  }

  private async fetchTeamRankingsModern(config: {
    url: string;
    gender: string;
    format: string;
  }): Promise<TeamRankingData[]> {
    const rankings: TeamRankingData[] = [];
    const seenTeams = new Set<string>();
    let browser = null;
    let page = null;

    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      page = await browser.newPage();

      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.setViewport({ width: 1920, height: 1080 });
      await page.goto(config.url, { waitUntil: 'networkidle2', timeout: 30000 });

      await page.waitForSelector('a[href*="/cricket-team/"]', { timeout: 10000 });

      // Switch format for teams if needed
      const targetFormat = config.format.toLowerCase();
      if (targetFormat !== 'test') {
        await this.switchFormat(page, targetFormat);
        await new Promise(r => setTimeout(r, 2000));
      }

      const data = await page.content();
      const $ = cheerio.load(data);

      // Find team rows
      let teamRows = $('.grid.grid-cols-4.items-center.border-b');
      if (teamRows.length === 0) {
        teamRows = $('tr').filter((_, el) => $(el).find('a[href*="/cricket-team/"]').length > 0);
      }

      teamRows.each((_, row) => {
        const $row = $(row);
        const $link = $row.find('a[href*="/cricket-team/"]').first();
        if (!$link.length) return;

        const teamNameText = $link.text().trim();
        if (!teamNameText || seenTeams.has(teamNameText)) return;

        // Extract rank
        const rankText = $row.find('> div:first-child, td:first-child').text().trim();
        const rankMatch = rankText.match(/\d+/);
        const rank = rankMatch ? parseInt(rankMatch[0], 10) : 0;

        // Extract team code
        let teamCode = '';
        const codeMatch = teamNameText.match(/\(([A-Z]{3})\)/);
        if (codeMatch) {
          teamCode = codeMatch[1];
        }

        const cleanTeamName = teamNameText.replace(/\s*\([^)]*\)\s*/, '').trim();

        // Extract numeric values
        const digits = $row.text().match(/\b(\d+)\b/g);
        let matchesPlayed, points, rating;

        if (digits && digits.length >= 3) {
          // For team rankings: typically [rank, matches, points, rating] or [rank, points, rating]
          if (config.format === 'test') {
            rating = parseFloat(digits[digits.length - 1]);
            points = parseInt(digits[digits.length - 2], 10);
            matchesPlayed = parseInt(digits[digits.length - 3], 10);
          } else {
            rating = parseFloat(digits[digits.length - 1]);
            points = parseInt(digits[digits.length - 2], 10);
            matchesPlayed = digits.length >= 3 ? parseInt(digits[digits.length - 3], 10) : undefined;
          }
        }

        if (!isNaN(rank) && rank > 0 && cleanTeamName) {
          seenTeams.add(teamNameText);
          rankings.push({
            rank,
            teamName: cleanTeamName,
            teamCode: teamCode || undefined,
            matchesPlayed: matchesPlayed && !isNaN(matchesPlayed) ? matchesPlayed : undefined,
            points: points && !isNaN(points) ? points : undefined,
            rating: rating && !isNaN(rating) ? rating : undefined,
            gender: config.gender as 'men' | 'women',
            format: config.format as 'test' | 'odi' | 't20',
          });
        }
      });

      this.logger.log(`Successfully parsed ${rankings.length} team rankings for ${config.format.toUpperCase()}`);
      return rankings;

    } catch (error) {
      this.logger.error(`Error fetching team rankings from ${config.url}: ${error.message}`);
      throw error;
    } finally {
      if (page) await page.close().catch(e => this.logger.warn(e.message));
      if (browser) await browser.close().catch(e => this.logger.warn(e.message));
    }
  }
}