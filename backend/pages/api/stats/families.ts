import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';

interface FamilyStat {
  word_family: string;
  headword: string;
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
    const { family } = req.query;

    if (family && typeof family === 'string') {
      // Get all records for a specific word family
      const records = await query(
        'SELECT * FROM word_records WHERE word_family = ? ORDER BY word ASC',
        [family]
      );
      return res.status(200).json(records);
    }

    // Get word family statistics
    // Extract headword from word_family (first word before |)
    const stats = await query<FamilyStat>(
      `SELECT
         word_family,
         TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(word_family, '|', 1), ' ', -1)) as headword,
         COUNT(*) as count
       FROM word_records
       WHERE word_family IS NOT NULL AND word_family != ''
       GROUP BY word_family
       ORDER BY count DESC, headword ASC`
    );

    res.status(200).json(stats);
  } catch (error) {
    console.error('Word family stats error:', error);
    res.status(500).json({ error: 'Failed to fetch word family statistics' });
  }
}
