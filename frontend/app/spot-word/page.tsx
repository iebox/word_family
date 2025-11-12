'use client';

import { useState, useEffect } from 'react';
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
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Load sidebar state and search history from localStorage on mount
  useEffect(() => {
    const savedSidebarState = localStorage.getItem('sidebarCollapsed');
    if (savedSidebarState !== null) {
      setSidebarCollapsed(savedSidebarState === 'true');
    }

    const savedHistory = localStorage.getItem('spotWordSearchHistory');
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        if (Array.isArray(parsed)) {
          setSearchHistory(parsed);
        }
      } catch (error) {
        console.error('Failed to parse search history:', error);
      }
    }
  }, []);

  // Save sidebar state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  // Save search history to localStorage whenever it changes
  useEffect(() => {
    if (searchHistory.length > 0) {
      localStorage.setItem('spotWordSearchHistory', JSON.stringify(searchHistory));
    }
  }, [searchHistory]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedWord = searchWord.trim();

    if (!trimmedWord) {
      setError('Please enter a word');
      return;
    }

    // Validate that input contains only letters (allow hyphens for compound words)
    if (!/^[a-zA-Z-]+$/.test(trimmedWord)) {
      setError('Please input a word');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(
        `/api/vocabulary/search?word=${encodeURIComponent(trimmedWord)}&type=${searchType}`
      );

      if (response.ok) {
        const data = await response.json();
        setResult(data);

        // Add to search history (avoid duplicates)
        setSearchHistory(prev => {
          const filtered = prev.filter(w => w.toLowerCase() !== trimmedWord.toLowerCase());
          return [trimmedWord, ...filtered].slice(0, 20); // Keep last 20 searches
        });
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

  const handleHistoryClick = (word: string) => {
    setSearchWord(word);
    setError(null);
    setResult(null);
  };

  const handleDeleteHistoryItem = (index: number) => {
    setSearchHistory(prev => {
      const updated = [...prev];
      updated.splice(index, 1);
      if (updated.length === 0) {
        localStorage.removeItem('spotWordSearchHistory');
      }
      return updated;
    });
  };

  const handleClearHistory = () => {
    if (confirm('Clear all search history?')) {
      setSearchHistory([]);
      localStorage.removeItem('spotWordSearchHistory');
    }
  };

  const stripHtmlTags = (text: string) => {
    return text.replace(/<[^>]*>/g, '');
  };

  return (
    <div className="min-h-screen bg-gray-900 flex">
      {/* Sidebar */}
      <div className={`${sidebarCollapsed ? 'w-16' : 'w-64'} bg-gray-800 border-r border-gray-700 p-6 overflow-y-auto transition-all duration-300 flex-shrink-0`}>
        <div className="flex items-center justify-between mb-6">
          {!sidebarCollapsed && (
            <h1 className="text-2xl font-bold text-white">应试单词表</h1>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="text-gray-400 hover:text-white transition-colors"
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? '→' : '←'}
          </button>
        </div>

        {!sidebarCollapsed && (
          <>
            <Link
              href="/"
              prefetch={true}
              scroll={false}
              className="block w-full mb-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-center"
            >
              ← Word Family
            </Link>

            {searchHistory.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-white">Search History</h2>
                  <button
                    onClick={handleClearHistory}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors"
                    title="Clear all history"
                  >
                    Clear All
                  </button>
                </div>
                <div className="space-y-2">
                  {searchHistory.map((word, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 bg-gray-700 rounded hover:bg-gray-600 transition-colors"
                    >
                      <button
                        onClick={() => handleHistoryClick(word)}
                        className="flex-1 text-left px-3 py-2 text-white text-sm"
                      >
                        {word}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteHistoryItem(index);
                        }}
                        className="px-3 py-2 text-red-400 hover:text-red-300 transition-colors text-sm"
                        title="Delete this item"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white">Spot Word</h1>
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

            <div>
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

              {/* Error Message - shown below input */}
              {error && (
                <p className="text-red-400 text-sm mt-2">{error}</p>
              )}
            </div>
          </form>
        </div>

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
                  <div className="mb-6">
                    <span className="px-3 py-1 bg-purple-600 text-white text-sm rounded">
                      {result.partofspeech}
                    </span>
                  </div>
                )}

                <div className="mb-6">
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

                {result.definition && (
                  <div className="text-gray-300">
                    <p className="text-sm font-semibold text-gray-400 mb-3">Definition:</p>
                    <ul className="list-disc list-inside space-y-2">
                      {result.definition.split('|').map((def, index) => {
                        const cleanDef = stripHtmlTags(def.trim());
                        if (!cleanDef) return null;
                        return (
                          <li key={index} className="text-gray-300 leading-relaxed">
                            {cleanDef}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
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
    </div>
  );
}
