import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';

interface WordRecord {
  id: number;
  word: string;
  sentence: string;
  unit?: string;
  section?: string;
  test_point?: string;
  collocation?: string;
  head_word?: string;
  chinese_translation?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'GET') {
    try {
      const records = await query<WordRecord>(
        'SELECT * FROM word_records ORDER BY id DESC'
      );
      res.status(200).json(records);
    } catch (error) {
      console.error('Database error:', error);
      res.status(500).json({ error: 'Failed to fetch records' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
