import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';

interface GradeStat {
  grade: string;
  uniqueWords: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get unique word count by grade
    const stats = await query<GradeStat>(
      `SELECT grade, COUNT(DISTINCT word) as uniqueWords
       FROM word_records
       WHERE grade IS NOT NULL AND grade != ''
       GROUP BY grade
       ORDER BY grade ASC`
    );

    res.status(200).json(stats);
  } catch (error) {
    console.error('Words by grade stats error:', error);
    res.status(500).json({ error: 'Failed to fetch words by grade statistics' });
  }
}
