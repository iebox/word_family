'use client';

import { useState, useEffect } from 'react';

interface WordRecord {
  id: number;
  word: string;
  sentence: string;
  prep_vocab?: string;
  recording?: string;
  section?: string;
  test_point?: string;
  collocation?: string;
  head_word?: string;
  chinese_translation?: string;
}

export default function Home() {
  const [records, setRecords] = useState<WordRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterColumn, setFilterColumn] = useState('all');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    try {
      const response = await fetch('/api/records');
      const data = await response.json();
      setRecords(data);
    } catch (error) {
      console.error('Failed to fetch records:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/import', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        alert('File imported successfully!');
        fetchRecords();
        setFile(null);
      } else {
        alert('Failed to import file');
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const filteredRecords = records.filter(record => {
    if (!searchTerm) return true;

    if (filterColumn === 'all') {
      return Object.values(record).some(value =>
        String(value).toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return String(record[filterColumn as keyof WordRecord] || '')
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-xl text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 bg-gray-900">
      <div className="max-w-[1400px] mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-white">应单词表</h1>

        <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-6 border border-gray-700">
          <h2 className="text-xl font-semibold mb-4 text-white">Import Excel File</h2>
          <form onSubmit={handleFileUpload} className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2 text-gray-300">Select Excel File</label>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="block w-full text-sm border border-gray-600 rounded-lg p-2 bg-gray-700 text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
              />
            </div>
            <button
              type="submit"
              disabled={!file || uploading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </form>
        </div>

        <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-6 border border-gray-700">
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-600 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={filterColumn}
              onChange={(e) => setFilterColumn(e.target.value)}
              className="px-4 py-2 border border-gray-600 rounded-lg bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Columns</option>
              <option value="word">Word</option>
              <option value="sentence">Sentence</option>
              <option value="section">Section</option>
              <option value="test_point">Test Point</option>
              <option value="collocation">Collocation</option>
              <option value="head_word">Head Word</option>
            </select>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-700">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-700 border-b border-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-200">Word</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-200">Sentence</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-200">Prep Vocab</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-200">Recording</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-200">Section</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-200">Test Point</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-200">Collocation</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-200">Head Word</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-200">Chinese</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                      No records found. Upload an Excel file to get started.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((record) => (
                    <tr key={record.id} className="border-b border-gray-700 hover:bg-gray-750 transition-colors">
                      <td className="px-4 py-3 text-white font-medium">{record.word}</td>
                      <td className="px-4 py-3 max-w-md text-gray-300">{record.sentence}</td>
                      <td className="px-4 py-3">
                        <button className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors">
                          准备
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors">
                          录音
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-purple-600 text-white text-xs rounded">
                          {record.section || 'N/A'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-300">{record.test_point || '-'}</td>
                      <td className="px-4 py-3 text-gray-300">{record.collocation || '-'}</td>
                      <td className="px-4 py-3 text-gray-300">{record.head_word || '-'}</td>
                      <td className="px-4 py-3 text-gray-300">{record.chinese_translation || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 text-sm text-gray-400">
          Total records: {filteredRecords.length} / {records.length}
        </div>
      </div>
    </div>
  );
}
