import { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Invalid or empty IDs array' });
    }

    // Create placeholders for SQL query
    const placeholders = ids.map(() => '?').join(',');

    // Delete all records with matching IDs
    await query(
      `DELETE FROM word_records WHERE id IN (${placeholders})`,
      ids
    );

    // Reset auto increment if table is empty
    const remainingRecords = await query('SELECT COUNT(*) as count FROM word_records');
    if (remainingRecords[0].count === 0) {
      await query('ALTER TABLE word_records AUTO_INCREMENT = 1');
    }

    return res.status(200).json({
      message: 'Records deleted successfully',
      count: ids.length
    });
  } catch (error) {
    console.error('Bulk delete error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
