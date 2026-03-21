// api/items/index.js — Vercel Serverless API
// Supports: GET, POST, PUT, DELETE
// DB: Vercel Postgres (@vercel/postgres)

import { sql } from '@vercel/postgres';

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS items (
      id          SERIAL PRIMARY KEY,
      title       VARCHAR(100)  NOT NULL,
      description TEXT,
      image       TEXT,
      tags        JSONB         DEFAULT '[]',
      created_at  TIMESTAMPTZ   DEFAULT NOW()
    )
  `;
}

async function maybeSeed() {
  const { rows } = await sql`SELECT COUNT(*) as cnt FROM items`;
  if (Number(rows[0].cnt) === 0) {
    const demo = [
      { title: 'עיצוב מינימליסטי', description: 'סגנון עיצוב המתמקד בפשטות ובהסרת כל מיותר, תוך שמירה על פונקציונליות מלאה.', image: 'https://images.unsplash.com/photo-1616469829941-c7200edec809?w=800&q=80', tags: ['עיצוב', 'מינימליזם', 'אמנות'] },
      { title: 'פיתוח Full-Stack', description: 'פיתוח אפליקציות ווב מקצה לקצה, כולל Frontend, Backend ומסדי נתונים.', image: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&q=80', tags: ['קוד', 'טכנולוגיה', 'פיתוח'] },
      { title: 'צילום נוף עירוני', description: 'תיעוד נופי הערים המודרניות, בניינים, רחובות ואנשים בסביבה העירונית.', image: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&q=80', tags: ['צילום', 'עיר', 'אמנות'] },
      { title: 'בינה מלאכותית', description: 'עולם ה-AI וה-Machine Learning — כלים, מודלים ויישומים שמשנים את הענף.', image: 'https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=800&q=80', tags: ['AI', 'טכנולוגיה', 'מחקר'] },
      { title: 'ארכיטקטורה מודרנית', description: 'מבנים ייחודיים ופתרונות אדריכליים חדשניים מרחבי העולם.', image: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=800&q=80', tags: ['ארכיטקטורה', 'עיצוב', 'בנייה'] },
      { title: 'קפה וטעמים', description: 'מסע בעולם הקפה המיוחד — מגידול הפולים ועד לכוס המושלמת.', image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80', tags: ['קפה', 'אוכל', 'חוויה'] },
    ];
    for (const item of demo) {
      const tagsJson = JSON.stringify(item.tags);
      await sql`INSERT INTO items (title, description, image, tags) VALUES (${item.title}, ${item.description}, ${item.image}, ${tagsJson}::jsonb)`;
    }
  }
}

async function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); } });
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await ensureTable();
    await maybeSeed();

    // ── GET ──────────────────────────────────────────────
    if (req.method === 'GET') {
      const { search, tag, limit = 100, offset = 0 } = req.query;
      let query;

      if (search && tag) {
        const sp = `%${search}%`;
        query = await sql`SELECT * FROM items WHERE (title ILIKE ${sp} OR description ILIKE ${sp}) AND tags @> ${JSON.stringify([tag])}::jsonb ORDER BY created_at DESC LIMIT ${Number(limit)} OFFSET ${Number(offset)}`;
      } else if (search) {
        const sp = `%${search}%`;
        query = await sql`SELECT * FROM items WHERE title ILIKE ${sp} OR description ILIKE ${sp} ORDER BY created_at DESC LIMIT ${Number(limit)} OFFSET ${Number(offset)}`;
      } else if (tag) {
        query = await sql`SELECT * FROM items WHERE tags @> ${JSON.stringify([tag])}::jsonb ORDER BY created_at DESC LIMIT ${Number(limit)} OFFSET ${Number(offset)}`;
      } else {
        query = await sql`SELECT * FROM items ORDER BY created_at DESC LIMIT ${Number(limit)} OFFSET ${Number(offset)}`;
      }

      return res.status(200).json({ items: query.rows, count: query.rows.length });
    }

    const body = await parseBody(req);

    // ── POST ─────────────────────────────────────────────
    if (req.method === 'POST') {
      const { title, description, image, tags } = body;
      if (!title?.trim()) return res.status(400).json({ error: 'כותרת הינה שדה חובה' });
      if (title.trim().length < 2 || title.trim().length > 100) return res.status(400).json({ error: 'כותרת חייבת להכיל בין 2 ל-100 תווים' });

      const tagsJson = Array.isArray(tags) ? JSON.stringify(tags) : (typeof tags === 'string' ? tags : '[]');
      const { rows } = await sql`INSERT INTO items (title, description, image, tags) VALUES (${title.trim()}, ${description?.trim() || null}, ${image?.trim() || null}, ${tagsJson}::jsonb) RETURNING *`;
      return res.status(201).json({ item: rows[0], message: 'פריט נוסף בהצלחה' });
    }

    // ── PUT ──────────────────────────────────────────────
    if (req.method === 'PUT') {
      const { id, title, description, image, tags } = body;
      if (!id) return res.status(400).json({ error: 'מזהה פריט חסר' });
      if (!title?.trim()) return res.status(400).json({ error: 'כותרת הינה שדה חובה' });

      const tagsJson = Array.isArray(tags) ? JSON.stringify(tags) : (typeof tags === 'string' ? tags : '[]');
      const { rows } = await sql`UPDATE items SET title=${title.trim()}, description=${description?.trim() || null}, image=${image?.trim() || null}, tags=${tagsJson}::jsonb WHERE id=${Number(id)} RETURNING *`;
      if (!rows.length) return res.status(404).json({ error: 'פריט לא נמצא' });
      return res.status(200).json({ item: rows[0], message: 'פריט עודכן בהצלחה' });
    }

    // ── DELETE ───────────────────────────────────────────
    if (req.method === 'DELETE') {
      const { id } = body;
      if (!id) return res.status(400).json({ error: 'מזהה פריט חסר' });
      const { rows } = await sql`DELETE FROM items WHERE id=${Number(id)} RETURNING id, title`;
      if (!rows.length) return res.status(404).json({ error: 'פריט לא נמצא' });
      return res.status(200).json({ deleted: rows[0], message: 'פריט נמחק בהצלחה' });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('[API Error]', err);
    return res.status(500).json({
      error: 'שגיאת שרת פנימית',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
}
