import { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../lib/db';

interface VocabularyRecord {
  id: number;
  headword: string;
  derivative?: string;
  definition?: string;
  pronunciation?: string;
  partofspeech?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { word, type = 'forward' } = req.query;

    if (!word || typeof word !== 'string') {
      return res.status(400).json({ error: 'Word parameter is required' });
    }

    const searchWord = word.trim().toLowerCase();

    if (type === 'forward') {
      // Search: headword -> derivatives
      const records = await query<VocabularyRecord>(
        `SELECT id, headword, derivative, definition, pronunciation, partofspeech
         FROM vocabulary
         WHERE LOWER(headword) = ?`,
        [searchWord]
      );

      if (records.length === 0) {
        return res.status(404).json({ error: 'Headword not found', word: searchWord });
      }

      const record = records[0];
      const derivatives = record.derivative
        ? record.derivative.split('|').map(d => d.trim()).filter(d => d.length > 0)
        : [];

      return res.status(200).json({
        type: 'forward',
        headword: record.headword,
        derivatives,
        definition: record.definition,
        pronunciation: record.pronunciation,
        partofspeech: record.partofspeech
      });

    } else if (type === 'reverse') {
      // Search: derivative -> headword
      const records = await query<VocabularyRecord>(
        `SELECT id, headword, derivative, definition, pronunciation, partofspeech
         FROM vocabulary
         WHERE derivative IS NOT NULL
         AND (
           LOWER(derivative) = ?
           OR LOWER(derivative) LIKE ?
           OR LOWER(derivative) LIKE ?
           OR LOWER(derivative) LIKE ?
         )`,
        [searchWord, `${searchWord} |%`, `%| ${searchWord} |%`, `%| ${searchWord}`]
      );

      if (records.length === 0) {
        return res.status(404).json({ error: 'No headword found for this derivative', word: searchWord });
      }

      const results = records.map(record => ({
        headword: record.headword,
        derivative: record.derivative,
        definition: record.definition,
        pronunciation: record.pronunciation,
        partofspeech: record.partofspeech
      }));

      return res.status(200).json({
        type: 'reverse',
        searchWord,
        results
      });

    } else {
      return res.status(400).json({ error: 'Invalid type parameter. Use "forward" or "reverse"' });
    }

  } catch (error) {
    console.error('Vocabulary search error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
