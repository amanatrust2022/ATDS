import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '../../lib/localDb';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const db = getDb();

    if (req.method === 'GET') {
      const userId = Array.isArray(req.query.userId) ? req.query.userId[0] : req.query.userId;
      const organizationId = Array.isArray(req.query.organizationId)
        ? req.query.organizationId[0]
        : req.query.organizationId;

      if (!userId && !organizationId) {
        res.status(400).json({ error: 'Missing userId or organizationId' });
        return;
      }

      if (userId) {
        const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(userId);
        if (!profile) {
          res.status(404).json({ error: 'Profile not found' });
          return;
        }
        res.status(200).json(profile);
        return;
      }

      const profiles = db.prepare('SELECT * FROM profiles WHERE organization_id = ?').all(organizationId);
      res.status(200).json(profiles);
      return;
    }

    if (req.method === 'POST') {
      const profile = req.body;
      if (!profile || !profile.id || !profile.full_name || !profile.role) {
        res.status(400).json({ error: 'Missing required profile fields' });
        return;
      }

      db.prepare(`
        INSERT INTO profiles (id, full_name, title, first_name, surname, last_name, signature_url, role, organization_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          full_name = excluded.full_name,
          title = excluded.title,
          first_name = excluded.first_name,
          surname = excluded.surname,
          last_name = excluded.last_name,
          signature_url = excluded.signature_url,
          role = excluded.role,
          organization_id = excluded.organization_id
      `).run(
        profile.id,
        profile.full_name,
        profile.title || null,
        profile.first_name || null,
        profile.surname || null,
        profile.last_name || null,
        profile.signature_url || null,
        profile.role,
        profile.organization_id || null
      );

      res.status(200).json({ success: true });
      return;
    }

    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Error in GET /api/profiles:', error);
    res.status(500).json({ error: error.message });
  }
}
