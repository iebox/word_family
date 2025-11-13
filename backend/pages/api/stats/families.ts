import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';

interface WordCount {
  word: string;
  count: number;
}

interface FamilyStat {
  headword: string;
  totalCount: number;
  derivatives: WordCount[];
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
      // Get all records for words in this family (headword)
      // First, get all words that belong to this headword
      const familyWords = await query<{ word: string }>(
        'SELECT word FROM word_family_mappings WHERE headword = ?',
        [family]
      );

      if (familyWords.length === 0) {
        return res.status(200).json([]);
      }

      // Get all records for these words
      const words = familyWords.map(fw => fw.word);
      const placeholders = words.map(() => '?').join(',');
      const records = await query(
        `SELECT * FROM word_records WHERE word IN (${placeholders}) ORDER BY word ASC, id ASC`,
        words
      );

      return res.status(200).json(records);
    }

    // Get word family statistics grouped by headword with derivative details
    const headwords = await query<{ headword: string }>(
      `SELECT DISTINCT headword FROM word_family_mappings ORDER BY headword ASC`
    );

    const familyStats: FamilyStat[] = [];

    for (const { headword } of headwords) {
      // Get all derivatives and their counts for this headword
      const derivatives = await query<WordCount>(
        `SELECT
           wfm.word,
           COUNT(wr.id) as count
         FROM word_family_mappings wfm
         LEFT JOIN word_records wr ON wfm.word = wr.word
         WHERE wfm.headword = ?
         GROUP BY wfm.word
         HAVING count > 0
         ORDER BY count DESC, wfm.word ASC`,
        [headword]
      );

      if (derivatives.length > 0) {
        const totalCount = derivatives.reduce((sum, d) => sum + d.count, 0);
        familyStats.push({
          headword,
          totalCount,
          derivatives
        });
      }
    }

    // Sort by total count descending
    familyStats.sort((a, b) => b.totalCount - a.totalCount);

    res.status(200).json(familyStats);
  } catch (error) {
    console.error('Word family stats error:', error);
    res.status(500).json({ error: 'Failed to fetch word family statistics' });
  }
}
