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
        sentence,
        prep_vocab,
        recording,
        section,
        test_point,
        collocation,
        head_word,
        chinese_translation
      } = req.body;

      await query(
        `UPDATE word_records
         SET word = ?,
             sentence = ?,
             prep_vocab = ?,
             recording = ?,
             section = ?,
             test_point = ?,
             collocation = ?,
             head_word = ?,
             chinese_translation = ?
         WHERE id = ?`,
        [
          word,
          sentence,
          prep_vocab || null,
          recording || null,
          section || null,
          test_point || null,
          collocation || null,
          head_word || null,
          chinese_translation || null,
          id
        ]
      );

      return res.status(200).json({ message: 'Record updated successfully' });
    } else if (req.method === 'DELETE') {
      // Delete record
      await query('DELETE FROM word_records WHERE id = ?', [id]);
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
