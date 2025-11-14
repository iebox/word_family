import type { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm } from 'formidable';
import * as XLSX from 'xlsx';
import { query } from '@/lib/db';
import fs from 'fs';
import path from 'path';

interface VocabularyRecord {
  headword: string;
  derivative: string | null;
}

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
  maxDuration: 300, // 5 minutes for large files
};

function parseForm(req: NextApiRequest): Promise<{ fields: any; files: any }> {
  return new Promise((resolve, reject) => {
    const uploadDir = path.join(process.cwd(), 'uploads');

    // Ensure upload directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const form = new IncomingForm({
      uploadDir,
      keepExtensions: true,
      maxFileSize: 50 * 1024 * 1024, // 50MB
      maxFieldsSize: 50 * 1024 * 1024, // 50MB
    });

    form.parse(req, (err, fields, files) => {
      if (err) {
        console.error('Form parse error:', err);
        reject(err);
      } else {
        console.log('Files received:', Object.keys(files));
        resolve({ fields, files });
      }
    });
  });
}

function expandContractions(text: string): string {
  // First normalize apostrophes (handle smart quotes and other variants)
  // U+2018 = ' (left single quotation mark)
  // U+2019 = ' (right single quotation mark)
  // U+201C = " (left double quotation mark)
  // U+201D = " (right double quotation mark)
  let normalized = text
    .replace(/[\u2018\u2019]/g, "'")  // Replace smart single quotes with straight apostrophe
    .replace(/[\u201C\u201D]/g, '"'); // Replace smart double quotes

  const contractions: Record<string, string> = {
    "I'm": "I am",
    "I've": "I have",
    "I'll": "I will",
    "I'd": "I would",
    "you're": "you are",
    "you've": "you have",
    "you'll": "you will",
    "you'd": "you would",
    "he's": "he is",
    "he'll": "he will",
    "he'd": "he would",
    "she's": "she is",
    "she'll": "she will",
    "she'd": "she would",
    "it's": "it is",
    "it'll": "it will",
    "it'd": "it would",
    "we're": "we are",
    "we've": "we have",
    "we'll": "we will",
    "we'd": "we would",
    "they're": "they are",
    "they've": "they have",
    "they'll": "they will",
    "they'd": "they would",
    "that's": "that is",
    "that'll": "that will",
    "that'd": "that would",
    "who's": "who is",
    "who'll": "who will",
    "who'd": "who would",
    "what's": "what is",
    "what'll": "what will",
    "what'd": "what would",
    "where's": "where is",
    "where'll": "where will",
    "where'd": "where would",
    "when's": "when is",
    "when'll": "when will",
    "when'd": "when would",
    "why's": "why is",
    "why'll": "why will",
    "why'd": "why would",
    "how's": "how is",
    "how'll": "how will",
    "how'd": "how would",
    "can't": "cannot",
    "won't": "will not",
    "don't": "do not",
    "doesn't": "does not",
    "didn't": "did not",
    "isn't": "is not",
    "aren't": "are not",
    "wasn't": "was not",
    "weren't": "were not",
    "hasn't": "has not",
    "haven't": "have not",
    "hadn't": "had not",
    "shouldn't": "should not",
    "wouldn't": "would not",
    "couldn't": "could not",
    "mightn't": "might not",
    "mustn't": "must not",
    "needn't": "need not",
    "shan't": "shall not",
    "let's": "let us",
    "there's": "there is",
    "here's": "here is"
  };

  let result = normalized;

  // Replace contractions (case-insensitive)
  for (const [contraction, expansion] of Object.entries(contractions)) {
    // Escape special regex characters
    const escapedContraction = contraction.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedContraction}\\b`, 'gi');
    result = result.replace(regex, (match) => {
      // Preserve the original case pattern
      if (match[0] === match[0].toUpperCase()) {
        return expansion.charAt(0).toUpperCase() + expansion.slice(1);
      }
      return expansion;
    });
  }

  return result;
}

function isProperNoun(word: string): boolean {
  // Common proper nouns - names, countries, languages, days, months, etc.
  const properNouns = new Set([
    // Common names (add more as needed)
    'Mike', 'John', 'Mary', 'Sarah', 'Tom', 'Lisa', 'David', 'Anna',
    'James', 'Emma', 'Michael', 'Emily', 'Robert', 'Olivia', 'William',
    'Sophia', 'Richard', 'Ava', 'Joseph', 'Isabella', 'Thomas', 'Mia',
    'Charles', 'Charlotte', 'Daniel', 'Amelia', 'Matthew', 'Harper',

    // Countries and regions
    'China', 'America', 'USA', 'UK', 'Canada', 'Australia', 'Japan',
    'Korea', 'France', 'Germany', 'Italy', 'Spain', 'India', 'Brazil',
    'Russia', 'Mexico', 'England', 'Scotland', 'Wales', 'Ireland',
    'Europe', 'Asia', 'Africa', 'Antarctica', 'California', 'Texas',
    'Florida', 'London', 'Paris', 'Tokyo', 'Beijing', 'Shanghai',

    // Languages
    'English', 'Chinese', 'Spanish', 'French', 'German', 'Japanese',
    'Korean', 'Italian', 'Portuguese', 'Russian', 'Arabic', 'Hindi',

    // Days and months
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
    'January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December',

    // Titles
    'Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'President', 'King', 'Queen'
  ]);

  // Check if word is in proper noun list
  if (properNouns.has(word)) {
    return true;
  }

  // Check for abbreviations (all caps, 2-4 letters)
  if (word.length >= 2 && word.length <= 4 && word === word.toUpperCase()) {
    return true; // Abbreviations like PE, USA, UK, etc.
  }

  return false;
}

function splitReferenceIntoWords(reference: string): string[] {
  // First expand contractions (BEFORE removing punctuation)
  const expanded = expandContractions(reference);

  // Remove punctuation but keep spaces and letters
  const cleanText = expanded.replace(/[^\w\s]/g, ' ');

  // Split into words
  const words = cleanText
    .split(/\s+/)
    .map(word => word.trim())
    .filter(word => word.length > 0);

  // Filter out non-words (must contain at least one letter)
  // This excludes things like "_____", "123", "___", etc.
  const validWords = words.filter(word => /[a-zA-Z]/.test(word));

  // Convert to lowercase except for proper nouns/names
  const result = validWords.map((word) => {
    if (isProperNoun(word)) {
      return word; // Keep original case for proper nouns
    }
    return word.toLowerCase();
  });

  return result;
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

async function populateWordFamilies(insertedRecordIds: number[]): Promise<number> {
  /**
   * Populate word_family field for newly inserted records
   * Returns count of updated records
   */
  let updatedCount = 0;

  for (const recordId of insertedRecordIds) {
    // Get the word for this record
    const records = await query<{ word: string }>(
      'SELECT word FROM word_records WHERE id = ?',
      [recordId]
    );

    if (records.length === 0) continue;

    const word = records[0].word;
    const wordFamily = await getWordFamily(word);

    if (wordFamily) {
      await query(
        'UPDATE word_records SET word_family = ? WHERE id = ?',
        [wordFamily, recordId]
      );
      updatedCount++;
    }
  }

  return updatedCount;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { files } = await parseForm(req);
    const uploadedFile = Array.isArray(files.file) ? files.file[0] : files.file;

    if (!uploadedFile) {
      console.error('No file in request');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('File received:', uploadedFile.originalFilename, 'Size:', uploadedFile.size);
    const filePath = uploadedFile.filepath;

    console.log('Reading Excel file from:', filePath);
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    console.log('Sheet name:', sheetName);

    const worksheet = workbook.Sheets[sheetName];
    const data: any[] = XLSX.utils.sheet_to_json(worksheet);
    console.log('Rows parsed:', data.length);
    console.log('First row sample:', data[0]);

    const insertedRecords: any[] = [];
    const BATCH_SIZE = 100; // Process 100 records at a time
    let processedRows = 0;

    // Prepare all insert values first
    const valuesToInsert: any[][] = [];

    for (const row of data) {
      // Support multiple column names for reference
      const reference = row['Reference'] || row['reference'] || row['Sentence'] || row['sentence'] || '';

      if (!reference) {
        console.log('Skipping row with no reference:', row);
        continue;
      }

      const words = splitReferenceIntoWords(reference);

      for (const word of words) {
        valuesToInsert.push([
          word,
          reference,
          row['Unit'] || row['unit'] || null,
          row['Section'] || row['section'] || null,
          row['test_point'] || null,
          row['collocation'] || null,
          null,
          row['Book'] || row['book'] || null,
          row['Grade'] || row['grade'] || null,
          row['Chinese'] || row['chinese'] || null
        ]);
      }
    }

    console.log(`Total values to insert: ${valuesToInsert.length}`);

    // Insert in batches
    for (let i = 0; i < valuesToInsert.length; i += BATCH_SIZE) {
      const batch = valuesToInsert.slice(i, i + BATCH_SIZE);

      try {
        // Build multi-row insert query
        const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
        const values = batch.flat();

        await query(
          `INSERT INTO word_records
          (word, reference, unit, section, test_point, collocation, word_family, book, grade, chinese)
          VALUES ${placeholders}`,
          values
        );

        processedRows += batch.length;
        console.log(`Inserted batch: ${processedRows}/${valuesToInsert.length}`);

        batch.forEach(([word, reference]) => {
          insertedRecords.push({ word, reference });
        });
      } catch (error) {
        console.error('Error inserting batch:', error);
        // Try individual inserts for this batch
        for (const values of batch) {
          try {
            await query(
              `INSERT INTO word_records
              (word, reference, unit, section, test_point, collocation, word_family, book, grade, chinese)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              values
            );
            insertedRecords.push({ word: values[0], reference: values[1] });
          } catch (individualError) {
            console.error('Error inserting individual record:', individualError);
          }
        }
      }
    }

    console.log('Total records inserted:', insertedRecords.length);

    fs.unlinkSync(filePath);

    res.status(200).json({
      success: true,
      message: `Imported ${insertedRecords.length} records`,
      records: insertedRecords.length
    });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ error: 'Failed to import file', details: String(error) });
  }
}
