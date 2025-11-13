import { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (!id || Array.isArray(id)) {
    return res.status(400).json({ error: 'Invalid ID' });
  }

  try {
    if (req.method === 'PUT') {
      // Update record
      const {
        word,
        reference,
        unit,
        section,
        test_point,
        collocation,
        word_family,
        book,
        grade,
        chinese
      } = req.body;

      await query(
        `UPDATE word_records
         SET word = ?,
             reference = ?,
             unit = ?,
             section = ?,
             test_point = ?,
             collocation = ?,
             word_family = ?,
             book = ?,
             grade = ?,
             chinese = ?
         WHERE id = ?`,
        [
          word,
          reference,
          unit || null,
          section || null,
          test_point || null,
          collocation || null,
          word_family || null,
          book || null,
          grade || null,
          chinese || null,
          id
        ]
      );

      return res.status(200).json({ message: 'Record updated successfully' });
    } else if (req.method === 'DELETE') {
      // Delete record
      await query('DELETE FROM word_records WHERE id = ?', [id]);

      // Reset auto increment if table is empty
      const remainingRecords = await query('SELECT COUNT(*) as count FROM word_records');
      if (remainingRecords[0].count === 0) {
        await query('ALTER TABLE word_records AUTO_INCREMENT = 1');
      }

      return res.status(200).json({ message: 'Record deleted successfully' });
    } else {
      res.setHeader('Allow', ['PUT', 'DELETE']);
      return res.status(405).json({ error: `Method ${req.method} not allowed` });
    }
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
