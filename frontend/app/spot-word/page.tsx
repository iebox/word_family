'use client';

import { useState } from 'react';
import Link from 'next/link';

interface ForwardSearchResult {
  type: 'forward';
  headword: string;
  derivatives: string[];
  definition?: string;
  pronunciation?: string;
  partofspeech?: string;
}

interface ReverseSearchResult {
  type: 'reverse';
  searchWord: string;
  results: Array<{
    headword: string;
    derivative?: string;
    definition?: string;
    pronunciation?: string;
    partofspeech?: string;
  }>;
}

type SearchResult = ForwardSearchResult | ReverseSearchResult;

export default function SpotWord() {
  const [searchWord, setSearchWord] = useState('');
  const [searchType, setSearchType] = useState<'forward' | 'reverse'>('forward');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!searchWord.trim()) {
      setError('Please enter a word');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(
        `/api/vocabulary/search?word=${encodeURIComponent(searchWord.trim())}&type=${searchType}`
      );

      if (response.ok) {
        const data = await response.json();
        setResult(data);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Search failed');
      }
    } catch (err) {
      setError('Failed to perform search');
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const stripHtmlTags = (text: string) => {
    return text.replace(/<[^>]*>/g, '');
  };

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-white">Spot Word</h1>
          <Link
            href="/"
            className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            ← Back to Word Family
          </Link>
        </div>

        {/* Search Form */}
        <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-6 border border-gray-700">
          <form onSubmit={handleSearch}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Search Type
              </label>
              <div className="flex gap-6">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="searchType"
                    value="forward"
                    checked={searchType === 'forward'}
                    onChange={() => setSearchType('forward')}
                    className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-gray-300">
                    Headword → Derivatives
                  </span>
                </label>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="searchType"
                    value="reverse"
                    checked={searchType === 'reverse'}
                    onChange={() => setSearchType('reverse')}
                    className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-gray-300">
                    Derivative → Headword
                  </span>
                </label>
              </div>
            </div>

            <div className="flex gap-4">
              <input
                type="text"
                value={searchWord}
                onChange={(e) => setSearchWord(e.target.value)}
                placeholder={
                  searchType === 'forward'
                    ? 'Enter headword (e.g., adapt)'
                    : 'Enter derivative (e.g., adapting)'
                }
                className="flex-1 px-4 py-3 border border-gray-600 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={loading}
                className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </form>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-600 border border-red-500 text-white px-6 py-4 rounded-lg mb-6">
            <p className="font-semibold">Error</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
            {result.type === 'forward' ? (
              // Forward Search Results
              <div>
                <h2 className="text-2xl font-bold text-white mb-4">
                  {result.headword}
                  {result.pronunciation && (
                    <span className="ml-3 text-lg text-gray-400 font-normal">
                      /{result.pronunciation}/
                    </span>
                  )}
                </h2>

                {result.partofspeech && (
                  <div className="mb-4">
                    <span className="px-3 py-1 bg-purple-600 text-white text-sm rounded">
                      {result.partofspeech}
                    </span>
                  </div>
                )}

                {result.definition && (
                  <div className="mb-6 text-gray-300">
                    <p className="text-sm font-semibold text-gray-400 mb-2">Definition:</p>
                    <p>{stripHtmlTags(result.definition)}</p>
                  </div>
                )}

                <div className="mt-6">
                  <h3 className="text-lg font-semibold text-white mb-3">
                    Derivatives ({result.derivatives.length})
                  </h3>
                  {result.derivatives.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {result.derivatives.map((derivative, index) => (
                        <div
                          key={index}
                          className="px-4 py-2 bg-gray-700 text-white rounded-lg text-center hover:bg-gray-600 transition-colors"
                        >
                          {derivative}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400 italic">No derivatives found</p>
                  )}
                </div>
              </div>
            ) : (
              // Reverse Search Results
              <div>
                <h2 className="text-2xl font-bold text-white mb-4">
                  Search Results for: "{result.searchWord}"
                </h2>
                <p className="text-gray-400 mb-6">
                  Found {result.results.length} headword(s)
                </p>

                <div className="space-y-6">
                  {result.results.map((item, index) => (
                    <div
                      key={index}
                      className="bg-gray-700 rounded-lg p-5 border border-gray-600"
                    >
                      <h3 className="text-xl font-bold text-white mb-2">
                        {item.headword}
                        {item.pronunciation && (
                          <span className="ml-3 text-base text-gray-400 font-normal">
                            /{item.pronunciation}/
                          </span>
                        )}
                      </h3>

                      {item.partofspeech && (
                        <div className="mb-3">
                          <span className="px-3 py-1 bg-purple-600 text-white text-sm rounded">
                            {item.partofspeech}
                          </span>
                        </div>
                      )}

                      {item.derivative && (
                        <div className="mb-3">
                          <p className="text-sm font-semibold text-gray-400 mb-1">
                            All derivatives:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {item.derivative.split('|').map((d, i) => (
                              <span
                                key={i}
                                className={`px-2 py-1 rounded text-sm ${
                                  d.trim().toLowerCase() === result.searchWord.toLowerCase()
                                    ? 'bg-yellow-500 text-gray-900 font-semibold'
                                    : 'bg-gray-600 text-white'
                                }`}
                              >
                                {d.trim()}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {item.definition && (
                        <div className="text-gray-300 text-sm">
                          <p className="font-semibold text-gray-400 mb-1">Definition:</p>
                          <p>{stripHtmlTags(item.definition).substring(0, 200)}...</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        {!result && !error && !loading && (
          <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">How to use:</h3>
            <div className="space-y-3 text-gray-300">
              <div>
                <span className="font-semibold text-blue-400">Headword → Derivatives:</span>
                <p className="text-sm mt-1">
                  Enter a base word (e.g., "adapt") to see all its derivative forms (adapts, adapting, adapted)
                </p>
              </div>
              <div>
                <span className="font-semibold text-blue-400">Derivative → Headword:</span>
                <p className="text-sm mt-1">
                  Enter a word form (e.g., "adapting") to find its base word (adapt)
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
