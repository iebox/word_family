import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';

interface VocabularyRecord {
  headword: string;
  derivative: string | null;
}

async function getWordFamily(word: string): Promise<string | null> {
  /**
   * Find the word family for a given word.
   * Returns the headword + all derivatives separated by ' | '
   */
  const wordLower = word.toLowerCase().trim();

  // Try forward search: check if word is a headword
  const forwardResults = await query<VocabularyRecord>(
    'SELECT headword, derivative FROM vocabulary WHERE LOWER(headword) = ?',
    [wordLower]
  );

  // Try reverse search: check if word is a derivative
  // Use REGEXP for exact whole word matching
  // Match only when word is at start/after pipe and followed by pipe/end
  const escapedWord = wordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = `(^|\\|)\\s*${escapedWord}\\s*(\\||$)`;

  const reverseResults = await query<VocabularyRecord>(
    `SELECT headword, derivative FROM vocabulary
     WHERE derivative IS NOT NULL
     AND LOWER(derivative) REGEXP ?
     LIMIT 1`,
    [pattern]
  );

  // Count derivatives for each result
  const countDerivatives = (result: VocabularyRecord | undefined) => {
    if (!result || !result.derivative) return 0;
    return result.derivative.split('|').map(d => d.trim()).filter(d => d.length > 0).length;
  };

  const forwardResult = forwardResults[0];
  const reverseResult = reverseResults[0];
  const forwardCount = countDerivatives(forwardResult);
  const reverseCount = countDerivatives(reverseResult);

  // Prefer reverse search result if it has more derivatives
  let result: VocabularyRecord | undefined;
  if (reverseResult && reverseCount >= forwardCount) {
    result = reverseResult;
  } else if (forwardResult) {
    result = forwardResult;
  }

  if (!result) {
    return null;
  }

  const headword = result.headword;
  const derivative = result.derivative;

  if (derivative && derivative.trim()) {
    const derivatives = derivative.split('|').map(d => d.trim()).filter(d => d.length > 0);
    return ` ${headword} | ${derivatives.join(' | ')} `;
  } else {
    return ` ${headword} `;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get all records without word_family populated
    const records = await query<{ id: number; word: string }>(
      'SELECT id, word FROM word_records WHERE word_family IS NULL'
    );

    console.log(`Starting word_family population for ${records.length} records...`);

    let updatedCount = 0;
    let notFoundCount = 0;

    for (const record of records) {
      const wordFamily = await getWordFamily(record.word);

      if (wordFamily) {
        await query(
          'UPDATE word_records SET word_family = ? WHERE id = ?',
          [wordFamily, record.id]
        );
        updatedCount++;

        // Log progress every 50 records
        if (updatedCount % 50 === 0) {
          console.log(`Progress: ${updatedCount}/${records.length} records updated`);
        }
      } else {
        notFoundCount++;
      }
    }

    console.log(`Word family population complete: ${updatedCount} updated, ${notFoundCount} not found`);

    return res.status(200).json({
      success: true,
      message: `Populated ${updatedCount} word families (${notFoundCount} not found)`,
      updated: updatedCount,
      notFound: notFoundCount,
      total: records.length
    });
  } catch (error) {
    console.error('Head word population error:', error);
    return res.status(500).json({ error: 'Failed to populate head words', details: String(error) });
  }
}
