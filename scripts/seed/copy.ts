/**
 * Copies a locally-seeded database into another (e.g. a hosted) database. Insert-only: existing
 * documents with the same _id are left untouched. The `users` collection is never copied
 * (create logins on the target with:  seed --users-only).
 *
 *   SEED_FROM_URL=mongodb://127.0.0.1:27017/cricket_seed SEED_MONGODB_URL=<target> npm run seed:copy -- --allow-remote
 */
import mongoose from 'mongoose';

const to = process.env.SEED_MONGODB_URL;
const from = process.env.SEED_FROM_URL;
const allowRemote = process.argv.includes('--allow-remote');
if (!to || !from) { console.error('Set SEED_FROM_URL (source) and SEED_MONGODB_URL (target).'); process.exit(1); }
const hostOf = (u: string) => (u.match(/^mongodb(?:\+srv)?:\/\/(?:[^@/]*@)?([^/:?,]+)/) || [])[1] || '';
const local = (h: string) => ['localhost', '127.0.0.1', '::1'].includes(h);
if (!local(hostOf(to)) && !allowRemote) { console.error(`Refusing to write to non-local "${hostOf(to)}" without --allow-remote.`); process.exit(1); }

(async () => {
  const src = await mongoose.createConnection(from).asPromise();
  const dst = await mongoose.createConnection(to).asPromise();
  console.log(`Copying ${src.name}@${hostOf(from)} → ${dst.name}@${hostOf(to)}`);
  const cols = (await src.db.listCollections().toArray()).map((c) => c.name).filter((n) => !n.startsWith('system.') && n !== 'users');
  for (const name of cols) {
    const docs = await src.db.collection(name).find({}).toArray();
    if (!docs.length) continue;
    let inserted = 0;
    for (let i = 0; i < docs.length; i += 500) {
      try {
        const r = await dst.db.collection(name).insertMany(docs.slice(i, i + 500), { ordered: false });
        inserted += r.insertedCount;
      } catch (e: any) {
        if (e?.code === 11000 || e?.writeErrors) inserted += e.result?.insertedCount ?? e.insertedCount ?? 0; else throw e;
      }
    }
    console.log(`  ${name.padEnd(22)} ${String(inserted).padStart(5)} / ${docs.length}`);
  }
  await src.close(); await dst.close();
  console.log('Done.');
})().catch((e) => { console.error(e); process.exit(1); });
