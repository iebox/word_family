import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';

interface WordStat {
  word: string;
  count: number;
  records?: any[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { word } = req.query;

    if (word && typeof word === 'string') {
      // Get all records for a specific word
      const records = await query(
        'SELECT * FROM word_records WHERE word = ? ORDER BY id ASC',
        [word]
      );
      return res.status(200).json(records);
    }

    // Get unique word statistics
    const stats = await query<WordStat>(
      `SELECT word, COUNT(*) as count
       FROM word_records
       GROUP BY word
       ORDER BY count DESC, word ASC`
    );

    res.status(200).json(stats);
  } catch (error) {
    console.error('Word stats error:', error);
    res.status(500).json({ error: 'Failed to fetch word statistics' });
  }
}
