# Test data seeder

Creates a complete, realistic data set by **playing matches ball by ball through the real score engine**, so
scorecards, commentary, partnerships, over summaries, results and undo history are all genuine.

| Series | Format | What's in it |
|---|---|---|
| India v Australia | T20I | 2 completed (chase + defended), **1 live mid-chase**, 2 upcoming, 1 hidden (`isNotShowing`) |
| England tour of SA | ODI | 1 completed, **1 live (1st innings)**, upcoming, 1 abandoned |
| NZ v Pakistan | Test | **1 live (2nd innings in progress)**, upcoming, 1 cancelled |
| The Hundred | 5-ball sets, 100 balls | 1 completed, **1 live**, upcoming |
| Premier T20 League | T20 | 4 completed incl. **a tie won in a Super Over**, 2 upcoming, **points table** |
| T10 Blast | T10 | 1 completed, 2 upcoming |
| Asia Cup 2027 (upcoming), Tri-Series 2025 (finished, one match with no scorecard) | | edge cases |

Also: 14 teams, 210 players, venues, umpires, squads/playing XI, team + player rankings (men/women, Test/ODI/T20), and two logins.

## Run it

```bash
# Safest: simulate on a throwaway local MongoDB (fast), then copy to the DB you want
SEED_MONGODB_URL=mongodb://127.0.0.1:27017/cricket_seed npm run seed
SEED_FROM_URL=mongodb://127.0.0.1:27017/cricket_seed SEED_MONGODB_URL=<target> npm run seed:copy -- --allow-remote
SEED_MONGODB_URL=<target> npm run seed -- --users-only --allow-remote    # logins with random passwords

npm run seed:reset    # purge previously seeded data, then seed again
npm run seed:purge    # remove everything this script created
```

* The seeder **never reads `MONGODB_URL` from `.env`** — the target is always explicit.
* Non-local targets require `--allow-remote`. Seeded documents have deterministic ids, so purge only touches its own data.
* Simulating directly against a hosted DB works but is slow (~25 round trips per ball).
* On a local DB the logins are `admin@cricket.test / Admin@12345` and `scorer@cricket.test / Scorer@12345`;
  on a remote DB random passwords are generated and printed once.
