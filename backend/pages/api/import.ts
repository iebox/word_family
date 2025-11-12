import type { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm } from 'formidable';
import * as XLSX from 'xlsx';
import { query } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export const config = {
  api: {
    bodyParser: false,
  },
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

function splitSentenceIntoWords(sentence: string): string[] {
  return sentence
    .split(/\s+/)
    .map(word => word.trim())
    .filter(word => word.length > 0);
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

    for (const row of data) {
      // Support multiple column names for sentences
      const sentence = row['Reference'] || row['reference'] || row['Sentence'] || row['sentence'] || '';

      if (!sentence) {
        console.log('Skipping row with no sentence:', row);
        continue;
      }

      const words = splitSentenceIntoWords(sentence);
      console.log(`Processing sentence "${sentence}" -> ${words.length} words`);

      for (const word of words) {
        try {
          await query(
            `INSERT INTO word_records
            (word, sentence, prep_vocab, recording, section, test_point, collocation, head_word, chinese_translation)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              word,
              sentence,
              null,
              null,
              row['Section'] || row['section'] || null,
              row['test_point'] || null,
              row['collocation'] || null,
              null,
              row['Chinese'] || row['chinese'] || null
            ]
          );
          insertedRecords.push({ word, sentence });
        } catch (error) {
          console.error('Error inserting record:', error);
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
