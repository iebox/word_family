import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';

interface WordFamilyMapping {
  id: number;
  word: string;
  headword: string;
  created_at: string;
  updated_at: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'GET') {
    // Get all word family mappings
    try {
      const mappings = await query<WordFamilyMapping>(
        'SELECT * FROM word_family_mappings ORDER BY headword ASC, word ASC'
      );
      return res.status(200).json(mappings);
    } catch (error) {
      console.error('Failed to fetch word family mappings:', error);
      return res.status(500).json({ error: 'Failed to fetch word family mappings' });
    }
  }

  if (req.method === 'PUT') {
    // Update word family mapping (change headword for a word)
    try {
      const { word, headword } = req.body;

      if (!word || !headword) {
        return res.status(400).json({ error: 'word and headword are required' });
      }

      await query(
        `INSERT INTO word_family_mappings (word, headword)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE headword = ?`,
        [word, headword, headword]
      );

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Failed to update word family mapping:', error);
      return res.status(500).json({ error: 'Failed to update word family mapping' });
    }
  }

  if (req.method === 'POST') {
    // Batch update: set headword for multiple words
    try {
      const { words, headword } = req.body;

      if (!Array.isArray(words) || !headword) {
        return res.status(400).json({ error: 'words (array) and headword are required' });
      }

      const values = words.map(word => [word, headword, headword]);

      for (const value of values) {
        await query(
          `INSERT INTO word_family_mappings (word, headword)
           VALUES (?, ?)
           ON DUPLICATE KEY UPDATE headword = ?`,
          value
        );
      }

      return res.status(200).json({ success: true, updated: words.length });
    } catch (error) {
      console.error('Failed to batch update word family mappings:', error);
      return res.status(500).json({ error: 'Failed to batch update word family mappings' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
