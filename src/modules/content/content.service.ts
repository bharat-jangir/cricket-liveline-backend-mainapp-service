import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomBytes } from 'crypto';
import { Model, Types } from 'mongoose';
import { Article, ARTICLE_CATEGORIES } from '../../entities/article.entity';
import { Short } from '../../entities/short.entity';

const isId = (v: any) => typeof v === 'string' && /^[0-9a-fA-F]{24}$/.test(v);
const ok = (data: any, statusCode = 200) => ({ status: true, statusCode, data });
const fail = (statusCode: number, userMessage: string) => ({ status: false, statusCode, userMessage, data: null });

const slugify = (t: string) =>
  t.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'article';

/** Only http(s) URLs are accepted for media: blocks javascript:/data: URLs from ever reaching clients. */
const cleanUrl = (u: any): string | null => {
  if (u === undefined || u === null || u === '') return null;
  try {
    const url = new URL(String(u));
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
};

const cleanTags = (t: any): string[] =>
  Array.isArray(t) ? Array.from(new Set(t.map((x) => String(x).trim().toLowerCase()).filter(Boolean))).slice(0, 10) : [];

const PUBLIC_FILTER = () => ({ status: 'published', publishedAt: { $ne: null, $lte: new Date() } });

@Injectable()
export class ContentService {
  constructor(
    @InjectModel(Article.name) private readonly articles: Model<any>,
    @InjectModel(Short.name) private readonly shorts: Model<any>,
  ) {}

  // ───────────────────────── articles: admin ─────────────────────────
  async articleAdminList(q: any = {}) {
    const page = Math.max(parseInt(q.page) || 1, 1);
    const limit = Math.min(parseInt(q.limit) || 20, 100);
    const filter: any = {};
    if (['draft', 'published', 'archived'].includes(q.status)) filter.status = q.status;
    if (q.category && ARTICLE_CATEGORIES.includes(q.category)) filter.category = q.category;
    if (q.search) filter.title = new RegExp(String(q.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 60), 'i');
    const [result, total] = await Promise.all([
      this.articles.find(filter).select('-body').sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.articles.countDocuments(filter),
    ]);
    return ok({ result, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  }

  async articleAdminGet(id: string) {
    if (!isId(id)) return fail(400, 'Invalid article id');
    const a = await this.articles.findById(id).lean();
    return a ? ok({ result: a }) : fail(404, 'Article not found');
  }

  private articleFields(d: any, existing?: any) {
    const out: any = {};
    if (d.title !== undefined) out.title = String(d.title).trim().slice(0, 200);
    if (d.summary !== undefined) out.summary = String(d.summary).trim().slice(0, 500);
    if (d.body !== undefined) out.body = String(d.body).slice(0, 50000);
    if (d.category !== undefined) out.category = ARTICLE_CATEGORIES.includes(d.category) ? d.category : 'general';
    if (d.tags !== undefined) out.tags = cleanTags(d.tags);
    if (d.coverImage !== undefined) out.coverImage = cleanUrl(d.coverImage);
    if (d.isFeatured !== undefined) out.isFeatured = !!d.isFeatured;
    if (d.seriesId !== undefined) out.seriesId = isId(d.seriesId) ? new Types.ObjectId(d.seriesId) : null;
    if (d.matchId !== undefined) out.matchId = isId(d.matchId) ? new Types.ObjectId(d.matchId) : null;
    if (d.status !== undefined && ['draft', 'published', 'archived'].includes(d.status)) out.status = d.status;
    if (d.publishedAt !== undefined) {
      const dt = d.publishedAt ? new Date(d.publishedAt) : null;
      out.publishedAt = dt && !isNaN(dt.getTime()) ? dt : null;
    }
    // Publishing without a date means "now"
    const status = out.status ?? existing?.status;
    const when = 'publishedAt' in out ? out.publishedAt : existing?.publishedAt;
    if (status === 'published' && !when) out.publishedAt = new Date();
    return out;
  }

  async articleCreate(d: any, author?: { id?: string; name?: string }) {
    if (!d?.title || !String(d.title).trim()) return fail(400, 'Title is required');
    if (!d?.body || !String(d.body).trim()) return fail(400, 'Body is required');
    const fields = this.articleFields(d);
    const slug = `${slugify(fields.title)}-${randomBytes(3).toString('hex')}`;
    const doc = await this.articles.create({
      ...fields,
      slug,
      authorName: (author?.name || '').slice(0, 100) || undefined,
      authorId: isId(author?.id as string) ? new Types.ObjectId(author!.id) : undefined,
    });
    return ok({ result: doc.toObject() }, 201);
  }

  async articleUpdate(id: string, d: any) {
    if (!isId(id)) return fail(400, 'Invalid article id');
    const existing = await this.articles.findById(id).lean();
    if (!existing) return fail(404, 'Article not found');
    const fields = this.articleFields(d, existing);
    if (fields.title === '' || fields.body === '') return fail(400, 'Title and body cannot be empty');
    const doc = await this.articles.findByIdAndUpdate(id, { $set: fields }, { new: true }).lean();
    return ok({ result: doc });
  }

  async articleRemove(id: string) {
    if (!isId(id)) return fail(400, 'Invalid article id');
    const r = await this.articles.findByIdAndDelete(id);
    return r ? ok({ result: { deleted: true } }) : fail(404, 'Article not found');
  }

  // ───────────────────────── articles: public ─────────────────────────
  async articlePublicList(q: any = {}) {
    const page = Math.max(parseInt(q.page) || 1, 1);
    const limit = Math.min(parseInt(q.limit) || 10, 50);
    const filter: any = PUBLIC_FILTER();
    if (q.category && ARTICLE_CATEGORIES.includes(q.category)) filter.category = q.category;
    if (q.featured === true || q.featured === 'true') filter.isFeatured = true;
    if (isId(q.seriesId)) filter.seriesId = new Types.ObjectId(q.seriesId);
    if (isId(q.matchId)) filter.matchId = new Types.ObjectId(q.matchId);
    const [result, total] = await Promise.all([
      this.articles.find(filter).select('-body').sort({ publishedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.articles.countDocuments(filter),
    ]);
    return ok({ result, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  }

  /** Accepts an ObjectId or a slug. Counts a view. */
  async articlePublicGet(idOrSlug: string, countView = true) {
    const key = String(idOrSlug || '').toLowerCase().slice(0, 120);
    const filter: any = { ...PUBLIC_FILTER(), ...(isId(key) ? { _id: key } : { slug: key }) };
    const a: any = await this.articles.findOneAndUpdate(filter, countView ? { $inc: { views: 1 } } : {}, { new: true }).lean();
    if (!a) return fail(404, 'Article not found');
    const related = await this.articles
      .find({ ...PUBLIC_FILTER(), _id: { $ne: a._id }, category: a.category })
      .select('-body')
      .sort({ publishedAt: -1 })
      .limit(3)
      .lean();
    return ok({ result: { ...a, related } });
  }

  // ───────────────────────── shorts: admin ─────────────────────────
  async shortAdminList(q: any = {}) {
    const page = Math.max(parseInt(q.page) || 1, 1);
    const limit = Math.min(parseInt(q.limit) || 20, 100);
    const filter: any = {};
    if (['draft', 'published', 'archived'].includes(q.status)) filter.status = q.status;
    if (q.search) filter.title = new RegExp(String(q.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 60), 'i');
    const [result, total] = await Promise.all([
      this.shorts.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.shorts.countDocuments(filter),
    ]);
    return ok({ result, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  }

  private shortFields(d: any, existing?: any) {
    const out: any = {};
    if (d.title !== undefined) out.title = String(d.title).trim().slice(0, 150);
    if (d.description !== undefined) out.description = String(d.description).trim().slice(0, 500);
    if (d.videoUrl !== undefined) out.videoUrl = cleanUrl(d.videoUrl);
    if (d.thumbnail !== undefined) out.thumbnail = cleanUrl(d.thumbnail);
    if (d.durationSec !== undefined) out.durationSec = Math.max(0, Math.min(Number(d.durationSec) || 0, 3600));
    if (d.tags !== undefined) out.tags = cleanTags(d.tags);
    if (d.matchId !== undefined) out.matchId = isId(d.matchId) ? new Types.ObjectId(d.matchId) : null;
    if (d.status !== undefined && ['draft', 'published', 'archived'].includes(d.status)) out.status = d.status;
    if (d.publishedAt !== undefined) {
      const dt = d.publishedAt ? new Date(d.publishedAt) : null;
      out.publishedAt = dt && !isNaN(dt.getTime()) ? dt : null;
    }
    const status = out.status ?? existing?.status;
    const when = 'publishedAt' in out ? out.publishedAt : existing?.publishedAt;
    if (status === 'published' && !when) out.publishedAt = new Date();
    return out;
  }

  async shortCreate(d: any, author?: { id?: string }) {
    if (!d?.title || !String(d.title).trim()) return fail(400, 'Title is required');
    const fields = this.shortFields(d);
    if (!fields.videoUrl) return fail(400, 'A valid http(s) video URL is required');
    const doc = await this.shorts.create({ ...fields, authorId: isId(author?.id as string) ? new Types.ObjectId(author!.id) : undefined });
    return ok({ result: doc.toObject() }, 201);
  }

  async shortUpdate(id: string, d: any) {
    if (!isId(id)) return fail(400, 'Invalid short id');
    const existing = await this.shorts.findById(id).lean();
    if (!existing) return fail(404, 'Short not found');
    const fields = this.shortFields(d, existing);
    if ('videoUrl' in fields && !fields.videoUrl) return fail(400, 'A valid http(s) video URL is required');
    const doc = await this.shorts.findByIdAndUpdate(id, { $set: fields }, { new: true }).lean();
    return ok({ result: doc });
  }

  async shortRemove(id: string) {
    if (!isId(id)) return fail(400, 'Invalid short id');
    const r = await this.shorts.findByIdAndDelete(id);
    return r ? ok({ result: { deleted: true } }) : fail(404, 'Short not found');
  }

  // ───────────────────────── shorts: public ─────────────────────────
  async shortPublicList(q: any = {}) {
    const page = Math.max(parseInt(q.page) || 1, 1);
    const limit = Math.min(parseInt(q.limit) || 10, 30);
    const filter: any = PUBLIC_FILTER();
    const [result, total] = await Promise.all([
      this.shorts.find(filter).sort({ publishedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.shorts.countDocuments(filter),
    ]);
    return ok({ result, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  }

  async shortView(id: string) {
    if (!isId(id)) return fail(400, 'Invalid short id');
    await this.shorts.updateOne({ _id: id, ...PUBLIC_FILTER() }, { $inc: { views: 1 } });
    return ok({ result: { ok: true } });
  }

  /** like=true increments, false decrements (never below 0). The gateway rate-limits per client. */
  async shortLike(id: string, like: boolean) {
    if (!isId(id)) return fail(400, 'Invalid short id');
    const s: any = await this.shorts.findOneAndUpdate({ _id: id, ...PUBLIC_FILTER() }, { $inc: { likes: like ? 1 : -1 } }, { new: true }).lean();
    if (!s) return fail(404, 'Short not found');
    if (s.likes < 0) await this.shorts.updateOne({ _id: id }, { $set: { likes: 0 } });
    return ok({ result: { likes: Math.max(0, s.likes) } });
  }
}
