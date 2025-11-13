'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface WordStat {
  word: string;
  count: number;
}

interface WordCount {
  word: string;
  count: number;
}

interface FamilyStat {
  headword: string;
  totalCount: number;
  derivatives: WordCount[];
}

interface WordRecord {
  id: number;
  word: string;
  reference: string;
  unit?: string;
  section?: string;
  test_point?: string;
  collocation?: string;
  word_family?: string;
  book?: string;
  grade?: string;
  chinese?: string;
}

type ViewMode = 'words' | 'families';

export default function WordStats() {
  const [wordStats, setWordStats] = useState<WordStat[]>([]);
  const [familyStats, setFamilyStats] = useState<FamilyStat[]>([]);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null);
  const [selectedDerivative, setSelectedDerivative] = useState<string | null>(null);
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set());
  const [records, setRecords] = useState<WordRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('words');
  const [searchQuery, setSearchQuery] = useState('');

  // Load sidebar state from localStorage
  useEffect(() => {
    const savedSidebarState = localStorage.getItem('sidebarCollapsed');
    if (savedSidebarState !== null) {
      setSidebarCollapsed(savedSidebarState === 'true');
    }
  }, []);

  // Save sidebar state
  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const [wordsRes, familiesRes] = await Promise.all([
        fetch('/api/stats/words'),
        fetch('/api/stats/families')
      ]);

      const words = await wordsRes.json();
      const families = await familiesRes.json();

      setWordStats(words);
      setFamilyStats(families);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWordClick = async (word: string) => {
    setLoadingRecords(true);
    setSelectedWord(word);
    setSelectedFamily(null);

    try {
      const response = await fetch(`/api/stats/words?word=${encodeURIComponent(word)}`);
      const data = await response.json();
      setRecords(data);
    } catch (error) {
      console.error('Failed to fetch word records:', error);
      setRecords([]);
    } finally {
      setLoadingRecords(false);
    }
  };

  const handleFamilyClick = async (headword: string) => {
    setLoadingRecords(true);
    setSelectedFamily(headword);
    setSelectedWord(null);
    setSelectedDerivative(null);

    try {
      const response = await fetch(`/api/stats/families?family=${encodeURIComponent(headword)}`);
      const data = await response.json();
      setRecords(data);
    } catch (error) {
      console.error('Failed to fetch family records:', error);
      setRecords([]);
    } finally {
      setLoadingRecords(false);
    }
  };

  const handleDerivativeClick = async (headword: string, derivative: string) => {
    setLoadingRecords(true);
    setSelectedFamily(headword);
    setSelectedWord(null);
    setSelectedDerivative(derivative);

    try {
      const response = await fetch(`/api/stats/words?word=${encodeURIComponent(derivative)}`);
      const data = await response.json();
      setRecords(data);
    } catch (error) {
      console.error('Failed to fetch derivative records:', error);
      setRecords([]);
    } finally {
      setLoadingRecords(false);
    }
  };

  const toggleFamilyExpand = (headword: string) => {
    const newExpanded = new Set(expandedFamilies);
    if (newExpanded.has(headword)) {
      newExpanded.delete(headword);
    } else {
      newExpanded.add(headword);
    }
    setExpandedFamilies(newExpanded);
  };

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    setSelectedWord(null);
    setSelectedFamily(null);
    setSelectedDerivative(null);
    setRecords([]);
    setSearchQuery('');
  };

  // Filter words based on search query
  const filteredWordStats = wordStats.filter(stat =>
    stat.word.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter families based on search query (search in headword and derivatives)
  const filteredFamilyStats = familyStats.filter(stat => {
    const headwordMatch = stat.headword.toLowerCase().includes(searchQuery.toLowerCase());
    const derivativeMatch = stat.derivatives.some(d =>
      d.word.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return headwordMatch || derivativeMatch;
  });

  return (
    <div className="min-h-screen bg-gray-900 flex">
      {/* Sidebar */}
      <div className={`${sidebarCollapsed ? 'w-16' : 'w-80'} bg-gray-800 border-r border-gray-700 p-6 overflow-y-auto`}>
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
              className="block w-full mb-4 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium text-center"
            >
              ← Word Family
            </Link>

            <Link
              href="/spot-word"
              prefetch={true}
              className="block w-full mb-4 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium text-center"
            >
              Spot Word →
            </Link>

            {/* Toggle Switch */}
            <div className="mb-6 p-4 bg-gray-700 rounded-lg">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">View Mode</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => handleViewModeChange('words')}
                  className={`flex-1 px-3 py-2 rounded-lg font-medium transition-colors ${
                    viewMode === 'words'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                  }`}
                >
                  Unique Words
                </button>
                <button
                  onClick={() => handleViewModeChange('families')}
                  className={`flex-1 px-3 py-2 rounded-lg font-medium transition-colors ${
                    viewMode === 'families'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                  }`}
                >
                  Word Families
                </button>
              </div>
            </div>

            {/* Search Bar */}
            <div className="mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={viewMode === 'words' ? 'Search words...' : 'Search families...'}
                className="w-full px-4 py-2 bg-gray-700 text-white border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="mt-2 text-xs text-gray-400 hover:text-white"
                >
                  Clear search
                </button>
              )}
            </div>

            {/* Word/Family List */}
            {loading ? (
              <div className="text-gray-400 text-center py-4">Loading...</div>
            ) : (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">
                  {viewMode === 'words'
                    ? `Unique Words (${filteredWordStats.length}${searchQuery ? ` of ${wordStats.length}` : ''})`
                    : `Word Families (${filteredFamilyStats.length}${searchQuery ? ` of ${familyStats.length}` : ''})`
                  }
                </h3>
                <div className="space-y-1 max-h-[calc(100vh-500px)] overflow-y-auto">
                  {viewMode === 'words' ? (
                    filteredWordStats.length > 0 ? (
                      filteredWordStats.map((stat) => (
                        <button
                          key={stat.word}
                          onClick={() => handleWordClick(stat.word)}
                          className={`w-full px-3 py-2 rounded-lg text-left flex justify-between items-center transition-colors ${
                            selectedWord === stat.word
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          <span className="font-medium truncate">{stat.word}</span>
                          <span className={`ml-2 font-semibold ${selectedWord === stat.word ? 'text-blue-200' : 'text-blue-400'}`}>
                            {stat.count}
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="text-gray-400 text-center py-4 text-sm">
                        No words found matching &quot;{searchQuery}&quot;
                      </div>
                    )
                  ) : (
                    filteredFamilyStats.length > 0 ? (
                      filteredFamilyStats.map((stat) => {
                      const isExpanded = expandedFamilies.has(stat.headword);
                      const isHeadwordSelected = selectedFamily === stat.headword && !selectedDerivative;

                      return (
                        <div key={stat.headword} className="space-y-1">
                          {/* Headword Row */}
                          <div className="flex items-stretch gap-1">
                            {/* Expand/Collapse Button */}
                            <button
                              onClick={() => toggleFamilyExpand(stat.headword)}
                              className="px-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-gray-300"
                              title={isExpanded ? "Collapse" : "Expand"}
                            >
                              {isExpanded ? '▼' : '▶'}
                            </button>

                            {/* Headword Button */}
                            <button
                              onClick={() => handleFamilyClick(stat.headword)}
                              className={`flex-1 px-3 py-2 rounded-lg text-left transition-colors ${
                                isHeadwordSelected
                                  ? 'bg-green-600 text-white'
                                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              }`}
                            >
                              <div className="flex justify-between items-center">
                                <span className="font-bold truncate">{stat.headword}</span>
                                <span className={`ml-2 font-semibold ${isHeadwordSelected ? 'text-green-200' : 'text-green-400'}`}>
                                  {stat.totalCount}
                                </span>
                              </div>
                            </button>
                          </div>

                          {/* Derivatives List (Expandable) */}
                          {isExpanded && (
                            <div className="ml-8 space-y-1">
                              {stat.derivatives.map((derivative) => {
                                const isDerivativeSelected = selectedFamily === stat.headword && selectedDerivative === derivative.word;

                                return (
                                  <button
                                    key={derivative.word}
                                    onClick={() => handleDerivativeClick(stat.headword, derivative.word)}
                                    className={`w-full px-3 py-2 rounded-lg text-left transition-colors ${
                                      isDerivativeSelected
                                        ? 'bg-green-500 text-white'
                                        : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                                    }`}
                                  >
                                    <div className="flex justify-between items-center">
                                      <span className="text-sm truncate">{derivative.word}</span>
                                      <span className={`ml-2 text-sm font-semibold ${isDerivativeSelected ? 'text-green-100' : 'text-green-300'}`}>
                                        {derivative.count}
                                      </span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })
                    ) : (
                      <div className="text-gray-400 text-center py-4 text-sm">
                        No word families found matching &quot;{searchQuery}&quot;
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Main Content - Table */}
      <div className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-[1600px] mx-auto">
          <h1 className="text-3xl font-bold text-white mb-8">Word Statistics</h1>

          {!selectedWord && !selectedFamily ? (
            <div className="text-center text-gray-400 py-20">
              <p className="text-xl mb-2">Select a word or word family from the sidebar</p>
              <p className="text-sm">Click on any item to view detailed records</p>
            </div>
          ) : loadingRecords ? (
            <div className="text-white text-center py-20">Loading records...</div>
          ) : (
            <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 overflow-hidden">
              {/* Table Header */}
              <div className="px-6 py-4 bg-gray-700 border-b border-gray-600">
                <h2 className="text-xl font-bold text-white">
                  {selectedWord && `Records for: ${selectedWord} (${records.length} ${records.length === 1 ? 'record' : 'records'})`}
                  {selectedFamily && selectedDerivative && `Records for: ${selectedDerivative} (${records.length} ${records.length === 1 ? 'record' : 'records'})`}
                  {selectedFamily && !selectedDerivative && `Records for family: ${selectedFamily} - All Derivatives (${records.length} ${records.length === 1 ? 'record' : 'records'})`}
                </h2>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-700 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase">ID</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase">Word</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase">Chinese</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase">Reference</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase">Unit</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase">Section</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase">Test Point</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase">Collocation</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase">Word Family</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase">Book</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase">Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {records.map((record) => (
                      <tr key={record.id} className="hover:bg-gray-700 transition-colors">
                        <td className="px-4 py-3 text-gray-400 text-sm">{record.id}</td>
                        <td className="px-4 py-3 text-white font-medium">{record.word}</td>
                        <td className="px-4 py-3 text-gray-300">{record.chinese || '-'}</td>
                        <td className="px-4 py-3 text-gray-300 max-w-md">
                          <div className="line-clamp-2">{record.reference}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-300">{record.unit || '-'}</td>
                        <td className="px-4 py-3 text-gray-300">{record.section || '-'}</td>
                        <td className="px-4 py-3 text-gray-300">{record.test_point || '-'}</td>
                        <td className="px-4 py-3 text-gray-300">{record.collocation || '-'}</td>
                        <td className="px-4 py-3 text-gray-300">{record.word_family || '-'}</td>
                        <td className="px-4 py-3 text-gray-300">{record.book || '-'}</td>
                        <td className="px-4 py-3 text-gray-300">{record.grade || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {records.length === 0 && (
                <div className="text-center text-gray-400 py-10">
                  No records found
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
