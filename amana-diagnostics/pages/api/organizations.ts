import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb, queueSync } from '../../lib/localDb';
import { isHubServer } from '../../lib/runtimeMode';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // This route only works in local/hub mode (SQLite). On cloud deployments, return 404.
  if (!isHubServer()) {
    res.status(404).json({ error: 'Not available in cloud mode' });
    return;
  }

  try {
    const db = getDb();

    if (req.method === 'GET') {
      const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
      const slug = Array.isArray(req.query.slug) ? req.query.slug[0] : req.query.slug;

      if (!id && !slug) {
        res.status(400).json({ error: 'Missing id or slug' });
        return;
      }

      let org;
      if (id) {
        org = db.prepare('SELECT * FROM organizations WHERE id = ?').get(id);
      } else {
        org = db.prepare('SELECT * FROM organizations WHERE slug = ?').get(slug);
      }

      if (!org) {
        res.status(404).json({ error: 'Organization not found' });
        return;
      }

      res.status(200).json(org);
      return;
    }

    if (req.method === 'POST') {
      const { source, ...org } = req.body ?? {};
      if (!org || !org.id || !org.name || !org.slug) {
        res.status(400).json({ error: 'Missing required organization fields' });
        return;
      }

      db.prepare(`
        INSERT INTO organizations (id, name, slug, plan_tier, address, phone, email, letterhead_line2, letterhead_html)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          slug = excluded.slug,
          plan_tier = excluded.plan_tier,
          address = excluded.address,
          phone = excluded.phone,
          email = excluded.email,
          letterhead_line2 = excluded.letterhead_line2,
          letterhead_html = excluded.letterhead_html
      `).run(
        org.id,
        org.name,
        org.slug,
        org.plan_tier || null,
        org.address || null,
        org.phone || null,
        org.email || null,
        org.letterhead_line2 || null,
        org.letterhead_html || null
      );

      // An edit made here has to reach the cloud. A copy *of* the cloud
      // (source: 'cloud', written by AuthProvider after sign-in) must not go
      // back up, or every sign-in would overwrite the clinic's settings with
      // whatever this browser last saw.
      if (source !== 'cloud') {
        queueSync(db, 'organizations', 'UPDATE', org.id, {
          id: org.id,
          name: org.name,
          address: org.address || null,
          phone: org.phone || null,
          email: org.email || null,
          letterhead_line2: org.letterhead_line2 || null,
          letterhead_html: org.letterhead_html || null,
        });
      }

      res.status(200).json({ success: true });
      return;
    }

    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Error in GET /api/organizations:', error);
    res.status(500).json({ error: error.message });
  }
}
