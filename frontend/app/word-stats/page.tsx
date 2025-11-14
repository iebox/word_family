'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';

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
  const [selectedGrades, setSelectedGrades] = useState<Set<string>>(new Set());

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);

  // Load sidebar state from localStorage
  useEffect(() => {
    const savedSidebarState = localStorage.getItem('sidebarCollapsed');
    if (savedSidebarState !== null) {
      setSidebarCollapsed(savedSidebarState === 'true');
    }

    // Load pagination settings from localStorage
    const savedItemsPerPage = localStorage.getItem('statsItemsPerPage');
    if (savedItemsPerPage) {
      setItemsPerPage(parseInt(savedItemsPerPage, 10));
    }
  }, []);

  // Save sidebar state
  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  // Save items per page to localStorage
  useEffect(() => {
    localStorage.setItem('statsItemsPerPage', String(itemsPerPage));
  }, [itemsPerPage]);

  // Reset to page 1 when records change or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [records, selectedGrades]);

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
    setSelectedGrades(new Set());
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

  // Get unique grades from records
  const uniqueGrades = Array.from(new Set(records.map(r => r.grade).filter((v): v is string => Boolean(v)))).sort();

  // Filter records by selected grades
  const filteredRecords = records.filter(record => {
    if (selectedGrades.size > 0 && !selectedGrades.has(record.grade || '')) return false;
    return true;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedRecords = filteredRecords.slice(startIndex, endIndex);

  const handleItemsPerPageChange = (value: number) => {
    setItemsPerPage(value);
    setCurrentPage(1);
  };

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const handleExportToExcel = () => {
    if (filteredRecords.length === 0) {
      alert('No records to export');
      return;
    }

    // Create worksheet data
    const worksheetData = filteredRecords.map(record => ({
      'ID': record.id,
      'Word': record.word,
      'Chinese': record.chinese || '',
      'Reference': record.reference,
      'Unit': record.unit || '',
      'Section': record.section || '',
      'Test Point': record.test_point || '',
      'Collocation': record.collocation || '',
      'Word Family': record.word_family || '',
      'Book': record.book || '',
      'Grade': record.grade || ''
    }));

    // Create workbook and worksheet
    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Word Records');

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `word-statistics-${selectedWord || selectedFamily || 'all'}-${timestamp}.xlsx`;

    // Save file
    XLSX.writeFile(workbook, filename);
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Top Navigation Bar */}
      <nav className="bg-gradient-to-r from-gray-800 via-gray-900 to-gray-800 border-b border-gray-700 shadow-lg">
        <div className="max-w-[1920px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo/Title */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-green-400 bg-clip-text text-transparent">
                  应试单词表
                </h1>
              </div>
              <div className="h-6 w-px bg-gray-700"></div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span className="text-sm text-gray-400">Word Statistics</span>
              </div>
            </div>

            {/* Navigation Links */}
            <div className="flex items-center gap-2">
              <Link
                href="/"
                prefetch={true}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-gray-700 transition-all font-medium"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Word Family
              </Link>
              <Link
                href="/word-stats"
                prefetch={true}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white font-medium shadow-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Word Statistics
              </Link>
              <Link
                href="/spot-word"
                prefetch={true}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-gray-700 transition-all font-medium"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Spot Word
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className={`${sidebarCollapsed ? 'w-16' : 'w-80'} bg-gray-800 border-r border-gray-700 p-6 overflow-y-auto transition-all duration-300`}>
        <div className="flex items-center justify-between mb-6">
          {!sidebarCollapsed && (
            <h2 className="text-lg font-semibold text-gray-300">Filters</h2>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="text-gray-400 hover:text-white transition-colors p-1 rounded hover:bg-gray-700"
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? '→' : '←'}
          </button>
        </div>

        {!sidebarCollapsed && (
          <>

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

            {/* Grade Filter */}
            {uniqueGrades.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">Grade Filter</h3>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {uniqueGrades.map((grade) => (
                    <label key={grade} className="flex items-center cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={selectedGrades.has(grade)}
                        onChange={(e) => {
                          const newSet = new Set(selectedGrades);
                          if (e.target.checked) {
                            newSet.add(grade);
                          } else {
                            newSet.delete(grade);
                          }
                          setSelectedGrades(newSet);
                        }}
                        className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-gray-300 group-hover:text-white">{grade}</span>
                    </label>
                  ))}
                </div>
                {selectedGrades.size > 0 && (
                  <button
                    onClick={() => setSelectedGrades(new Set())}
                    className="mt-3 w-full px-3 py-1.5 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-500 transition-colors"
                  >
                    Clear Grade Filter
                  </button>
                )}
              </div>
            )}

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
                          <div className={`flex items-stretch rounded-lg overflow-hidden transition-all ${
                            isHeadwordSelected ? 'bg-green-600' : 'bg-gray-700 hover:bg-gray-650'
                          }`}>
                            {/* Expand/Collapse Icon */}
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFamilyExpand(stat.headword);
                              }}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  toggleFamilyExpand(stat.headword);
                                }
                              }}
                              className={`flex items-center justify-center px-2 cursor-pointer transition-all ${
                                isHeadwordSelected ? 'hover:bg-green-700' : 'hover:bg-gray-600'
                              }`}
                              title={isExpanded ? "Collapse" : "Expand"}
                            >
                              <svg
                                className={`w-3 h-3 transition-transform ${
                                  isExpanded ? 'rotate-90' : 'rotate-0'
                                } ${isHeadwordSelected ? 'text-white' : 'text-gray-400'}`}
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>

                            {/* Headword Button */}
                            <button
                              onClick={() => handleFamilyClick(stat.headword)}
                              className="flex-1 px-3 py-2 text-left transition-colors"
                            >
                              <div className="flex justify-between items-center">
                                <span className={`font-bold truncate ${isHeadwordSelected ? 'text-white' : 'text-gray-200'}`}>
                                  {stat.headword}
                                </span>
                                <span className={`ml-2 font-semibold ${isHeadwordSelected ? 'text-green-200' : 'text-green-400'}`}>
                                  {stat.totalCount}
                                </span>
                              </div>
                            </button>
                          </div>

                          {/* Derivatives List (Expandable) */}
                          {isExpanded && (
                            <div className="ml-7 space-y-1">
                              {stat.derivatives.map((derivative, index) => {
                                const isDerivativeSelected = selectedFamily === stat.headword && selectedDerivative === derivative.word;

                                return (
                                  <div
                                    key={derivative.word}
                                    className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2"
                                    style={{
                                      animationDelay: `${index * 50}ms`,
                                      animationDuration: '200ms'
                                    }}
                                  >
                                    {/* Connection Line */}
                                    <div className="flex flex-col items-center">
                                      <div className={`w-0.5 h-2 ${index === 0 ? 'bg-transparent' : 'bg-gray-600'}`}></div>
                                      <div className="w-2 h-2 rounded-full bg-gray-600"></div>
                                      <div className={`w-0.5 flex-1 ${index === stat.derivatives.length - 1 ? 'bg-transparent' : 'bg-gray-600'}`}></div>
                                    </div>

                                    {/* Derivative Button */}
                                    <button
                                      onClick={() => handleDerivativeClick(stat.headword, derivative.word)}
                                      className={`flex-1 px-3 py-2 rounded-lg text-left transition-all ${
                                        isDerivativeSelected
                                          ? 'bg-green-500 text-white shadow-md'
                                          : 'bg-gray-600 text-gray-300 hover:bg-gray-500 hover:shadow-sm'
                                      }`}
                                    >
                                      <div className="flex justify-between items-center">
                                        <span className="text-sm truncate">{derivative.word}</span>
                                        <span className={`ml-2 text-sm font-semibold ${isDerivativeSelected ? 'text-green-100' : 'text-green-300'}`}>
                                          {derivative.count}
                                        </span>
                                      </div>
                                    </button>
                                  </div>
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
        <div className="flex-1 p-8 overflow-y-auto bg-gray-900">
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
            <>
              <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 overflow-hidden">
              {/* Table Header */}
              <div className="px-6 py-4 bg-gray-700 border-b border-gray-600 flex justify-between items-center">
                <h2 className="text-xl font-bold text-white">
                  {selectedWord && `Records for: ${selectedWord} (${filteredRecords.length} ${filteredRecords.length === 1 ? 'record' : 'records'})`}
                  {selectedFamily && selectedDerivative && `Records for: ${selectedDerivative} (${filteredRecords.length} ${filteredRecords.length === 1 ? 'record' : 'records'})`}
                  {selectedFamily && !selectedDerivative && `Records for family: ${selectedFamily} - All Derivatives (${filteredRecords.length} ${filteredRecords.length === 1 ? 'record' : 'records'})`}
                </h2>
                <button
                  onClick={handleExportToExcel}
                  disabled={filteredRecords.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors font-medium"
                  title="Export to Excel"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export to Excel
                </button>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-700 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase whitespace-nowrap">ID</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase whitespace-nowrap">Word</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase whitespace-nowrap">Chinese</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase whitespace-nowrap">Reference</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase whitespace-nowrap">Unit</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase whitespace-nowrap">Section</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase whitespace-nowrap">Test Point</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase whitespace-nowrap">Collocation</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase whitespace-nowrap">Word Family</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase whitespace-nowrap">Book</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase whitespace-nowrap">Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {paginatedRecords.map((record) => (
                      <tr key={record.id} className="hover:bg-gray-700 transition-colors">
                        <td className="px-4 py-3 text-gray-400 text-sm whitespace-nowrap">{record.id}</td>
                        <td className="px-4 py-3 text-white font-medium whitespace-nowrap">{record.word}</td>
                        <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{record.chinese || '-'}</td>
                        <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{record.reference}</td>
                        <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{record.unit || '-'}</td>
                        <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{record.section || '-'}</td>
                        <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{record.test_point || '-'}</td>
                        <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{record.collocation || '-'}</td>
                        <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{record.word_family || '-'}</td>
                        <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{record.book || '-'}</td>
                        <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{record.grade || '-'}</td>
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

              {/* Pagination Controls */}
              {records.length > 0 && (
                <div className="bg-gray-800 rounded-lg shadow-lg p-4 mt-6 border border-gray-700">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    {/* Items per page selector */}
                    <div className="flex items-center gap-3">
                      <label className="text-sm text-gray-300">Items per page:</label>
                      <select
                        value={itemsPerPage}
                        onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                        className="px-3 py-1.5 bg-gray-700 text-white border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                        <option value={200}>200</option>
                        <option value={500}>500</option>
                        <option value={1000}>1000</option>
                      </select>
                    </div>

                    {/* Page info */}
                    <div className="text-sm text-gray-300">
                      Showing {startIndex + 1}-{Math.min(endIndex, filteredRecords.length)} of {filteredRecords.length} records
                      {selectedGrades.size > 0 && ` (filtered from ${records.length})`}
                    </div>

                    {/* Page navigation */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => goToPage(1)}
                        disabled={currentPage === 1}
                        className="px-3 py-1.5 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
                        title="First page"
                      >
                        ««
                      </button>
                      <button
                        onClick={() => goToPage(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="px-3 py-1.5 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
                        title="Previous page"
                      >
                        «
                      </button>

                      {/* Page numbers */}
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }

                          return (
                            <button
                              key={pageNum}
                              onClick={() => goToPage(pageNum)}
                              className={`px-3 py-1.5 rounded-lg transition-colors ${
                                currentPage === pageNum
                                  ? 'bg-blue-600 text-white font-semibold'
                                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        onClick={() => goToPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1.5 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
                        title="Next page"
                      >
                        »
                      </button>
                      <button
                        onClick={() => goToPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1.5 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
                        title="Last page"
                      >
                        »»
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
