import { createHash } from 'crypto';
import { Types } from 'mongoose';

/** Deterministic ObjectId so re-running the seed is idempotent and purge can find exactly its own docs. */
export const oid = (label: string) => new Types.ObjectId(createHash('md5').update(`seed:${label}`).digest('hex').slice(0, 24));

/** Small seeded PRNG (mulberry32) so simulated matches are reproducible. */
export function rng(label: string) {
  let a = parseInt(createHash('md5').update(label).digest('hex').slice(0, 8), 16) >>> 0;
  const next = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    pick: <T>(arr: T[]): T => arr[Math.floor(next() * arr.length)],
    weighted: <T>(items: [T, number][]): T => {
      const total = items.reduce((s, [, w]) => s + w, 0);
      let r = next() * total;
      for (const [v, w] of items) { r -= w; if (r <= 0) return v; }
      return items[items.length - 1][0];
    },
  };
}

export interface TeamDef { key: string; name: string; short: string; code: string; country: string; kind: 'international' | 'franchise'; gender: 'men' | 'women'; color: string }

export const TEAMS: TeamDef[] = [
  { key: 'ind', name: 'India', short: 'India', code: 'IND', country: 'India', kind: 'international', gender: 'men', color: '#1d4ed8' },
  { key: 'aus', name: 'Australia', short: 'Australia', code: 'AUS', country: 'Australia', kind: 'international', gender: 'men', color: '#eab308' },
  { key: 'eng', name: 'England', short: 'England', code: 'ENG', country: 'England', kind: 'international', gender: 'men', color: '#2563eb' },
  { key: 'rsa', name: 'South Africa', short: 'S Africa', code: 'RSA', country: 'South Africa', kind: 'international', gender: 'men', color: '#16a34a' },
  { key: 'nz', name: 'New Zealand', short: 'N Zealand', code: 'NZ', country: 'New Zealand', kind: 'international', gender: 'men', color: '#111827' },
  { key: 'pak', name: 'Pakistan', short: 'Pakistan', code: 'PAK', country: 'Pakistan', kind: 'international', gender: 'men', color: '#15803d' },
  { key: 'sl', name: 'Sri Lanka', short: 'Sri Lanka', code: 'SL', country: 'Sri Lanka', kind: 'international', gender: 'men', color: '#1e3a8a' },
  { key: 'wi', name: 'West Indies', short: 'W Indies', code: 'WI', country: 'West Indies', kind: 'international', gender: 'men', color: '#7f1d1d' },
  // franchise T20 league
  { key: 'mm', name: 'Mumbai Mavericks', short: 'Mavericks', code: 'MM', country: 'India', kind: 'franchise', gender: 'men', color: '#0ea5e9' },
  { key: 'dd', name: 'Delhi Dynamos', short: 'Dynamos', code: 'DD', country: 'India', kind: 'franchise', gender: 'men', color: '#ef4444' },
  { key: 'cc', name: 'Chennai Chargers', short: 'Chargers', code: 'CC', country: 'India', kind: 'franchise', gender: 'men', color: '#f59e0b' },
  { key: 'bb', name: 'Bengaluru Blazers', short: 'Blazers', code: 'BB', country: 'India', kind: 'franchise', gender: 'men', color: '#dc2626' },
  // The Hundred
  { key: 'll', name: 'London Lions', short: 'Lions', code: 'LLN', country: 'England', kind: 'franchise', gender: 'men', color: '#9333ea' },
  { key: 'mh', name: 'Manchester Hawks', short: 'Hawks', code: 'MHK', country: 'England', kind: 'franchise', gender: 'men', color: '#0891b2' },
];

const FIRST = ['Aarav', 'Rohan', 'Kabir', 'Vikram', 'Arjun', 'Ishaan', 'Dev', 'Rahul', 'Karan', 'Nikhil', 'Liam', 'Noah', 'Jack', 'Oliver', 'Harry', 'Ethan', 'Mason', 'Lucas', 'Hamza', 'Imran', 'Faisal', 'Zayn', 'Tariq', 'Sanath', 'Dilan', 'Kasun', 'Jason', 'Kemar', 'Andre', 'Shai', 'Tom', 'Callum', 'Riley', 'Ben'];
const LAST = ['Sharma', 'Patel', 'Verma', 'Singh', 'Kapoor', 'Nair', 'Reddy', 'Mehta', 'Khan', 'Malik', 'Smith', 'Taylor', 'Brown', 'Wilson', 'Clarke', 'Hughes', 'Walker', 'Hall', 'Fernando', 'Perera', 'Silva', 'Joseph', 'Roach', 'Holder', 'Mitchell', 'Conway', 'Latham', 'Ahmed', 'Rizvi', 'Das'];

// 15-man squad template. XI = first 11. Bowling options in XI = 3 all-rounders + 3 bowlers (6) so every format's quota is satisfiable.
export const ROLE_TEMPLATE = ['batsman', 'batsman', 'batsman', 'batsman', 'wicket-keeper', 'all-rounder', 'all-rounder', 'all-rounder', 'bowler', 'bowler', 'bowler', 'bowler', 'bowler', 'batsman', 'bowler'] as const;

export interface PlayerDef { id: Types.ObjectId; teamKey: string; idx: number; name: string; slug: string; role: string; hand: string; arm: string }

export function playersFor(team: TeamDef): PlayerDef[] {
  const r = rng(`players:${team.key}`);
  const used = new Set<string>();
  return ROLE_TEMPLATE.map((role, idx) => {
    let name = '';
    do { name = `${r.pick(FIRST)} ${r.pick(LAST)}`; } while (used.has(name));
    used.add(name);
    return {
      id: oid(`player:${team.key}:${idx}`),
      teamKey: team.key,
      idx,
      name,
      slug: `${name.toLowerCase().replace(/[^a-z]+/g, '-')}-${team.key}-${idx}`,
      role,
      hand: r.next() < 0.3 ? 'left-hand' : 'right-hand',
      arm: r.next() < 0.25 ? 'left' : 'right',
    };
  });
}

export const VENUES = [
  { key: 'mcg', name: 'Melbourne Cricket Ground', city: 'Melbourne', country: 'Australia', capacity: 100024 },
  { key: 'wankhede', name: 'Wankhede Stadium', city: 'Mumbai', country: 'India', capacity: 33108 },
  { key: 'lords', name: "Lord's", city: 'London', country: 'England', capacity: 31100 },
  { key: 'newlands', name: 'Newlands', city: 'Cape Town', country: 'South Africa', capacity: 25000 },
  { key: 'hagley', name: 'Hagley Oval', city: 'Christchurch', country: 'New Zealand', capacity: 18000 },
  { key: 'oval', name: 'The Kia Oval', city: 'London', country: 'England', capacity: 27500 },
];

export const UMPIRES = ['Marcus Allen', 'Ravi Menon', 'Peter Holloway', 'Sipho Dlamini', 'Gareth Pryce', 'Anil Deshpande'];

export type Fmt = 't20' | 't20i' | 'odi' | 'test' | 't10' | 'hundred';

export const SERIES = [
  { key: 'ind-aus-t20i', name: 'India vs Australia T20I Series 2026', short: 'IND v AUS T20I', fmt: 'T20', type: 'International', gender: 'Male', status: 'Running', startOff: -4, endOff: 12, featured: true, teams: ['ind', 'aus'] },
  { key: 'eng-rsa-odi', name: 'England tour of South Africa — ODI Series', short: 'RSA v ENG ODI', fmt: 'ODI', type: 'International', gender: 'Male', status: 'Running', startOff: -3, endOff: 9, featured: true, teams: ['eng', 'rsa'] },
  { key: 'nz-pak-test', name: 'New Zealand vs Pakistan Test Series', short: 'NZ v PAK Test', fmt: 'Test', type: 'International', gender: 'Male', status: 'Running', startOff: -2, endOff: 14, featured: true, teams: ['nz', 'pak'] },
  { key: 'hundred', name: 'The Hundred 2026', short: 'The Hundred', fmt: '100B', type: 'League', gender: 'Male', status: 'Running', startOff: -6, endOff: 20, featured: true, teams: ['ll', 'mh'] },
  { key: 'premier-t20', name: 'Premier T20 League 2026', short: 'PTL 2026', fmt: 'T20', type: 'League', gender: 'Male', status: 'Running', startOff: -10, endOff: 25, featured: true, teams: ['mm', 'dd', 'cc', 'bb'], points: true },
  { key: 't10-blast', name: 'T10 Blast 2026', short: 'T10 Blast', fmt: 'T10', type: 'League', gender: 'Male', status: 'Running', startOff: -1, endOff: 6, featured: false, teams: ['dd', 'cc'] },
  { key: 'asia-cup', name: 'Asia Cup 2027', short: 'Asia Cup', fmt: 'ODI', type: 'International', gender: 'Male', status: 'Upcoming', startOff: 60, endOff: 80, featured: false, teams: ['ind', 'pak', 'sl'] },
  { key: 'tri-series-2025', name: 'Tri-Series 2025', short: 'Tri-Series', fmt: 'T20', type: 'International', gender: 'Male', status: 'Finished', startOff: -400, endOff: -380, featured: false, teams: ['wi', 'sl', 'nz'] },
] as const;

export const RANKING_TEAMS = ['ind', 'aus', 'eng', 'rsa', 'nz', 'pak', 'sl', 'wi'];
