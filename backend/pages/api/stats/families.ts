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

// Cache for family stats (expires after 5 minutes)
let familyStatsCache: FamilyStat[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

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

    // Check cache first
    const now = Date.now();
    if (familyStatsCache && (now - cacheTimestamp) < CACHE_DURATION) {
      console.log('Returning cached family stats');
      return res.status(200).json(familyStatsCache);
    }

    // Optimized: Get all family statistics in a single query using GROUP_CONCAT
    const allData = await query<{
      headword: string;
      totalCount: number;
      derivatives_json: string;
    }>(
      `SELECT
         wfm.headword,
         SUM(word_counts.count) as totalCount,
         JSON_ARRAYAGG(
           JSON_OBJECT('word', wfm.word, 'count', word_counts.count)
         ) as derivatives_json
       FROM word_family_mappings wfm
       INNER JOIN (
         SELECT word, COUNT(*) as count
         FROM word_records
         GROUP BY word
       ) word_counts ON wfm.word = word_counts.word
       GROUP BY wfm.headword
       HAVING totalCount > 0
       ORDER BY totalCount DESC, wfm.headword ASC`
    );

    // Transform the result to the expected format
    const familyStats: FamilyStat[] = allData.map(row => {
      // MySQL may return derivatives_json as string or already parsed
      let derivatives: WordCount[];
      if (typeof row.derivatives_json === 'string') {
        derivatives = JSON.parse(row.derivatives_json);
      } else {
        derivatives = row.derivatives_json as any;
      }

      // Sort derivatives by count descending
      derivatives.sort((a, b) => b.count - a.count);

      return {
        headword: row.headword,
        totalCount: row.totalCount,
        derivatives
      };
    });

    // Update cache
    familyStatsCache = familyStats;
    cacheTimestamp = now;

    res.status(200).json(familyStats);
  } catch (error) {
    console.error('Word family stats error:', error);
    res.status(500).json({ error: 'Failed to fetch word family statistics' });
  }
}
