'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

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
}

type SortColumn = keyof WordRecord | null;
type SortDirection = 'asc' | 'desc' | null;

type NotificationType = 'success' | 'error' | 'info' | 'warning';

interface Notification {
  show: boolean;
  type: NotificationType;
  message: string;
}

export default function Home() {
  const [records, setRecords] = useState<WordRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterColumn, setFilterColumn] = useState('all');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editedData, setEditedData] = useState<Partial<WordRecord>>({});
  const [notification, setNotification] = useState<Notification>({
    show: false,
    type: 'info',
    message: ''
  });
  const [deleteConfirm, setDeleteConfirm] = useState<{show: boolean; id: number | null}>({
    show: false,
    id: null
  });
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<string>('all');
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const [populatingHeadwords, setPopulatingHeadwords] = useState(false);
  const [populationProgress, setPopulationProgress] = useState({ current: 0, total: 0 });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Load sidebar state from localStorage on mount
  useEffect(() => {
    const savedSidebarState = localStorage.getItem('sidebarCollapsed');
    if (savedSidebarState !== null) {
      setSidebarCollapsed(savedSidebarState === 'true');
    }
  }, []);

  // Save sidebar state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    // Try to load from sessionStorage first for instant display
    const cachedRecords = sessionStorage.getItem('wordFamilyRecords');
    if (cachedRecords) {
      try {
        const parsed = JSON.parse(cachedRecords);
        setRecords(parsed);
      } catch (error) {
        console.error('Failed to parse cached records:', error);
      }
    }

    // Fetch fresh data in background
    fetchRecords();
  }, []);

  const showNotification = (type: NotificationType, message: string) => {
    setNotification({ show: true, type, message });
    setTimeout(() => {
      setNotification(prev => ({ ...prev, show: false }));
    }, 5000);
  };

  const fetchRecords = async () => {
    try {
      const response = await fetch('/api/records');
      const data = await response.json();
      setRecords(data);
      // Cache the records in sessionStorage
      sessionStorage.setItem('wordFamilyRecords', JSON.stringify(data));
    } catch (error) {
      console.error('Failed to fetch records:', error);
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
        showNotification('success', 'File imported successfully!');
        fetchRecords();
        setFile(null);
      } else {
        showNotification('error', 'Failed to import file');
      }
    } catch (error) {
      console.error('Upload error:', error);
      showNotification('error', 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const handlePopulateHeadwords = async () => {
    if (!confirm('Populate word_family field for all records without word family? This may take a while.')) {
      return;
    }

    setPopulatingHeadwords(true);

    // Get initial count of records to process
    try {
      const countResponse = await fetch('/api/records');
      const allRecords = await countResponse.json();
      const recordsWithoutFamily = allRecords.filter((r: WordRecord) => !r.word_family);
      const totalCount = recordsWithoutFamily.length;

      setPopulationProgress({ current: 0, total: totalCount });

      // Set up polling to update progress
      const pollInterval = setInterval(async () => {
        try {
          const progressResponse = await fetch('/api/records');
          const currentRecords = await progressResponse.json();
          const currentWithoutFamily = currentRecords.filter((r: WordRecord) => !r.word_family).length;
          const processed = totalCount - currentWithoutFamily;
          setPopulationProgress({ current: processed, total: totalCount });
        } catch (err) {
          console.error('Progress polling error:', err);
        }
      }, 500); // Poll every 500ms

      // Start population
      const response = await fetch('/api/populate-headwords', {
        method: 'POST',
      });

      // Stop polling
      clearInterval(pollInterval);

      if (response.ok) {
        const data = await response.json();
        setPopulationProgress({ current: data.updated, total: data.total });
        showNotification('success', `${data.message}`);
        fetchRecords();
      } else {
        showNotification('error', 'Failed to populate word families');
      }
    } catch (error) {
      console.error('Populate word families error:', error);
      showNotification('error', 'Failed to populate word families');
    } finally {
      setPopulatingHeadwords(false);
      setTimeout(() => {
        setPopulationProgress({ current: 0, total: 0 });
      }, 2000); // Keep progress visible for 2 seconds after completion
    }
  };

  const handleSort = (column: keyof WordRecord) => {
    if (sortColumn === column) {
      // Toggle direction or clear sort
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortColumn(null);
        setSortDirection(null);
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (column: keyof WordRecord) => {
    if (sortColumn !== column) {
      return '⇅';
    }
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  const handleEdit = (record: WordRecord) => {
    setEditingId(record.id);
    setEditedData({ ...record });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditedData({});
  };

  const handleSave = async (id: number) => {
    try {
      const response = await fetch(`/api/records/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editedData),
      });

      if (response.ok) {
        await fetchRecords();
        setEditingId(null);
        setEditedData({});
        showNotification('success', 'Record updated successfully!');
      } else {
        showNotification('error', 'Failed to update record');
      }
    } catch (error) {
      console.error('Update error:', error);
      showNotification('error', 'Failed to update record');
    }
  };

  const handleDeleteClick = (id: number) => {
    setDeleteConfirm({ show: true, id });
  };

  const handleDeleteConfirm = async () => {
    const id = deleteConfirm.id;
    if (!id) return;

    try {
      const response = await fetch(`/api/records/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchRecords();
        showNotification('success', 'Record deleted successfully!');
      } else {
        showNotification('error', 'Failed to delete record');
      }
    } catch (error) {
      console.error('Delete error:', error);
      showNotification('error', 'Failed to delete record');
    } finally {
      setDeleteConfirm({ show: false, id: null });
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm({ show: false, id: null });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(filteredRecords.map(record => record.id));
      setSelectedIds(allIds);
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: number, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkDeleteClick = () => {
    if (selectedIds.size === 0) {
      showNotification('warning', 'No records selected');
      return;
    }
    setBulkDeleteConfirm(true);
  };

  const handleBulkDeleteConfirm = async () => {
    try {
      const idsArray = Array.from(selectedIds);
      const response = await fetch('/api/records/bulk-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids: idsArray }),
      });

      if (response.ok) {
        await fetchRecords();
        setSelectedIds(new Set());
        showNotification('success', `Successfully deleted ${idsArray.length} record(s)`);
      } else {
        showNotification('error', 'Failed to delete records');
      }
    } catch (error) {
      console.error('Bulk delete error:', error);
      showNotification('error', 'Failed to delete records');
    } finally {
      setBulkDeleteConfirm(false);
    }
  };

  const handleBulkDeleteCancel = () => {
    setBulkDeleteConfirm(false);
  };

  const handleFieldChange = (field: keyof WordRecord, value: string) => {
    setEditedData(prev => ({ ...prev, [field]: value }));
  };

  const highlightWord = (sentence: string, targetWord: string) => {
    // Split sentence while preserving spaces and punctuation
    const words = sentence.split(/(\s+)/);

    return (
      <span>
        {words.map((word, index) => {
          // Remove punctuation for comparison
          const cleanWord = word.replace(/[^\w]/g, '').toLowerCase();
          const cleanTarget = targetWord.toLowerCase();

          if (cleanWord === cleanTarget) {
            return (
              <span
                key={index}
                className="bg-yellow-500 text-gray-900 px-1 rounded font-semibold"
              >
                {word}
              </span>
            );
          }
          return <span key={index}>{word}</span>;
        })}
      </span>
    );
  };

  // Get unique units and sections
  const uniqueUnits = Array.from(new Set(records.map(r => r.unit).filter(Boolean))).sort();
  const uniqueSections = Array.from(new Set(records.map(r => r.section).filter(Boolean))).sort();

  const filteredRecords = records
    .filter(record => {
      // Unit filter
      if (selectedUnit !== 'all' && record.unit !== selectedUnit) return false;

      // Section filter
      if (selectedSection !== 'all' && record.section !== selectedSection) return false;

      // Search filter
      if (!searchTerm) return true;

      if (filterColumn === 'all') {
        return Object.values(record).some(value =>
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        );
      }

      return String(record[filterColumn as keyof WordRecord] || '')
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
    })
    .sort((a, b) => {
      if (!sortColumn || !sortDirection) return 0;

      const aValue = String(a[sortColumn] || '');
      const bValue = String(b[sortColumn] || '');

      const comparison = aValue.localeCompare(bValue, undefined, {
        numeric: true,
        sensitivity: 'base'
      });

      return sortDirection === 'asc' ? comparison : -comparison;
    });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-xl text-white">Loading...</div>
      </div>
    );
  }

  const getNotificationStyles = () => {
    const baseStyles = "fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-6 py-4 rounded-lg shadow-lg border-2 transition-all duration-300 flex items-center gap-3 min-w-[400px]";
    const typeStyles = {
      success: "bg-green-600 border-green-500 text-white",
      error: "bg-red-600 border-red-500 text-white",
      warning: "bg-yellow-600 border-yellow-500 text-white",
      info: "bg-blue-600 border-blue-500 text-white"
    };
    return `${baseStyles} ${typeStyles[notification.type]}`;
  };

  return (
    <div className="min-h-screen bg-gray-900 flex">
      {/* Sidebar */}
      <div className={`${sidebarCollapsed ? 'w-16' : 'w-64'} bg-gray-800 border-r border-gray-700 p-6 overflow-y-auto`}>
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
              href="/spot-word"
              prefetch={true}
              scroll={false}
              className="block w-full mb-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-center"
            >
              Spot Word →
            </Link>

            <h2 className="text-xl font-bold text-white mb-6">Filters</h2>

        {/* Unit Filter */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Unit</h3>
          <div className="space-y-2">
            <label className="flex items-center cursor-pointer group">
              <input
                type="radio"
                name="unit"
                value="all"
                checked={selectedUnit === 'all'}
                onChange={(e) => setSelectedUnit(e.target.value)}
                className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 focus:ring-2 focus:ring-blue-500"
              />
              <span className="ml-2 text-gray-300 group-hover:text-white">All Units</span>
            </label>
            {uniqueUnits.map((unit) => (
              <label key={unit} className="flex items-center cursor-pointer group">
                <input
                  type="radio"
                  name="unit"
                  value={unit}
                  checked={selectedUnit === unit}
                  onChange={(e) => setSelectedUnit(e.target.value)}
                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 focus:ring-2 focus:ring-blue-500"
                />
                <span className="ml-2 text-gray-300 group-hover:text-white">{unit}</span>
              </label>
            ))}
            {uniqueUnits.length === 0 && (
              <p className="text-sm text-gray-500 italic">No units available</p>
            )}
          </div>
        </div>

        {/* Section Filter */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Section</h3>
          <div className="space-y-2">
            <label className="flex items-center cursor-pointer group">
              <input
                type="radio"
                name="section"
                value="all"
                checked={selectedSection === 'all'}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 focus:ring-2 focus:ring-blue-500"
              />
              <span className="ml-2 text-gray-300 group-hover:text-white">All Sections</span>
            </label>
            {uniqueSections.map((section) => (
              <label key={section} className="flex items-center cursor-pointer group">
                <input
                  type="radio"
                  name="section"
                  value={section}
                  checked={selectedSection === section}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 focus:ring-2 focus:ring-blue-500"
                />
                <span className="ml-2 text-gray-300 group-hover:text-white">{section}</span>
              </label>
            ))}
            {uniqueSections.length === 0 && (
              <p className="text-sm text-gray-500 italic">No sections available</p>
            )}
          </div>
        </div>

        {/* Clear Filters */}
        {(selectedUnit !== 'all' || selectedSection !== 'all') && (
          <button
            onClick={() => {
              setSelectedUnit('all');
              setSelectedSection('all');
            }}
            className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm font-medium"
          >
            Clear Filters
          </button>
        )}
          </>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 overflow-y-auto">
      <div className="max-w-[1400px] mx-auto">
        {/* Notification Banner */}
        {notification.show && (
          <div className={getNotificationStyles()}>
            <span className="text-lg font-bold">
              {notification.type === 'success' && '✓'}
              {notification.type === 'error' && '✕'}
              {notification.type === 'warning' && '⚠'}
              {notification.type === 'info' && 'ℹ'}
            </span>
            <span className="flex-1">{notification.message}</span>
            <button
              onClick={() => setNotification(prev => ({ ...prev, show: false }))}
              className="text-white hover:text-gray-200 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Delete Confirmation Banner */}
        {deleteConfirm.show && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-6 py-4 rounded-lg shadow-lg border-2 bg-red-600 border-red-500 text-white transition-all duration-300 min-w-[400px]">
            <div className="mb-3">
              <p className="font-semibold">Are you sure you want to delete this record?</p>
              <p className="text-sm text-red-100 mt-1">This action cannot be undone.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-white text-red-600 rounded hover:bg-gray-100 transition-colors font-medium"
              >
                Delete
              </button>
              <button
                onClick={handleDeleteCancel}
                className="px-4 py-2 bg-red-700 text-white rounded hover:bg-red-800 transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Bulk Delete Confirmation Banner */}
        {bulkDeleteConfirm && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-6 py-4 rounded-lg shadow-lg border-2 bg-red-600 border-red-500 text-white transition-all duration-300 min-w-[400px]">
            <div className="mb-3">
              <p className="font-semibold">Delete {selectedIds.size} selected record(s)?</p>
              <p className="text-sm text-red-100 mt-1">This action cannot be undone.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleBulkDeleteConfirm}
                className="px-4 py-2 bg-white text-red-600 rounded hover:bg-gray-100 transition-colors font-medium"
              >
                Delete All
              </button>
              <button
                onClick={handleBulkDeleteCancel}
                className="px-4 py-2 bg-red-700 text-white rounded hover:bg-red-800 transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Combined Import and Search Section */}
        <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-6 border border-gray-700">
          <div className="flex gap-6 items-end">
            {/* Import Section */}
            <form onSubmit={handleFileUpload} className="flex gap-4 items-end flex-1">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-2 text-gray-300">Import Excel File</label>
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
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors font-medium whitespace-nowrap"
              >
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
              <button
                type="button"
                onClick={handlePopulateHeadwords}
                disabled={populatingHeadwords}
                className="relative px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:cursor-not-allowed font-medium whitespace-nowrap overflow-hidden"
              >
                {/* Progress Fill Background */}
                {populatingHeadwords && (
                  <div
                    className="absolute inset-0 bg-green-400 transition-all duration-300 ease-out"
                    style={{
                      width: `${populationProgress.total > 0 ? (populationProgress.current / populationProgress.total) * 100 : 0}%`
                    }}
                  ></div>
                )}
                {/* Button Text */}
                <span className="relative z-10">
                  {populatingHeadwords
                    ? `Processing... ${populationProgress.current}/${populationProgress.total}`
                    : 'Word Family'}
                </span>
              </button>
            </form>

            {/* Search Section */}
            <div className="flex gap-4 flex-1">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-2 text-gray-300">Search</label>
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-600 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">Filter Column</label>
                <select
                  value={filterColumn}
                  onChange={(e) => setFilterColumn(e.target.value)}
                  className="px-4 py-2 border border-gray-600 rounded-lg bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Columns</option>
                  <option value="word">Word</option>
                  <option value="reference">Reference</option>
                  <option value="section">Section</option>
                  <option value="test_point">Test Point</option>
                  <option value="collocation">Collocation</option>
                  <option value="word_family">Word Family</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {selectedIds.size > 0 && (
          <div className="bg-gray-800 rounded-lg shadow-lg p-4 mb-6 border border-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-gray-300">
                {selectedIds.size} record(s) selected
              </span>
              <button
                onClick={handleBulkDeleteClick}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center gap-2"
              >
                <span>🗑️</span>
                Delete Selected
              </button>
            </div>
          </div>
        )}

        <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-700">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-700 border-b border-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left w-12">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filteredRecords.length && filteredRecords.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort('id')}
                      className="flex items-center gap-2 text-sm font-semibold text-gray-200 hover:text-white transition-colors"
                    >
                      ID <span className="text-gray-400">{getSortIcon('id')}</span>
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort('word')}
                      className="flex items-center gap-2 text-sm font-semibold text-gray-200 hover:text-white transition-colors"
                    >
                      Word <span className="text-gray-400">{getSortIcon('word')}</span>
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort('reference')}
                      className="flex items-center gap-2 text-sm font-semibold text-gray-200 hover:text-white transition-colors"
                    >
                      Reference <span className="text-gray-400">{getSortIcon('reference')}</span>
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort('unit')}
                      className="flex items-center gap-2 text-sm font-semibold text-gray-200 hover:text-white transition-colors"
                    >
                      Unit <span className="text-gray-400">{getSortIcon('unit')}</span>
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort('section')}
                      className="flex items-center gap-2 text-sm font-semibold text-gray-200 hover:text-white transition-colors"
                    >
                      Section <span className="text-gray-400">{getSortIcon('section')}</span>
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort('test_point')}
                      className="flex items-center gap-2 text-sm font-semibold text-gray-200 hover:text-white transition-colors"
                    >
                      Test Point <span className="text-gray-400">{getSortIcon('test_point')}</span>
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort('collocation')}
                      className="flex items-center gap-2 text-sm font-semibold text-gray-200 hover:text-white transition-colors"
                    >
                      Collocation <span className="text-gray-400">{getSortIcon('collocation')}</span>
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort('word_family')}
                      className="flex items-center gap-2 text-sm font-semibold text-gray-200 hover:text-white transition-colors"
                    >
                      Word Family <span className="text-gray-400">{getSortIcon('word_family')}</span>
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort('book')}
                      className="flex items-center gap-2 text-sm font-semibold text-gray-200 hover:text-white transition-colors"
                    >
                      Book <span className="text-gray-400">{getSortIcon('book')}</span>
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-200">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center text-gray-400">
                      No records found. Upload an Excel file to get started.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((record) => {
                    const isEditing = editingId === record.id;
                    const isSelected = selectedIds.has(record.id);
                    return (
                      <tr key={record.id} className={`border-b border-gray-700 transition-colors ${isSelected ? 'bg-blue-900/30' : 'hover:bg-gray-750'}`}>
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => handleSelectOne(record.id, e.target.checked)}
                            className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-sm">{record.id}</td>
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editedData.word || ''}
                              onChange={(e) => handleFieldChange('word', e.target.value)}
                              className="w-full px-2 py-1 bg-gray-700 text-white border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          ) : (
                            <span className="text-white font-medium">{record.word}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 max-w-md">
                          {isEditing ? (
                            <textarea
                              value={editedData.reference || ''}
                              onChange={(e) => handleFieldChange('reference', e.target.value)}
                              className="w-full px-2 py-1 bg-gray-700 text-white border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                              rows={2}
                            />
                          ) : (
                            <span className="text-gray-300">
                              {highlightWord(record.reference, record.word)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editedData.unit || ''}
                              onChange={(e) => handleFieldChange('unit', e.target.value)}
                              className="w-full px-2 py-1 bg-gray-700 text-white border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          ) : (
                            <span className="text-gray-300">{record.unit || '-'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editedData.section || ''}
                              onChange={(e) => handleFieldChange('section', e.target.value)}
                              className="w-full px-2 py-1 bg-gray-700 text-white border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          ) : (
                            <span className="px-2 py-1 bg-purple-600 text-white text-xs rounded">
                              {record.section || 'N/A'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editedData.test_point || ''}
                              onChange={(e) => handleFieldChange('test_point', e.target.value)}
                              className="w-full px-2 py-1 bg-gray-700 text-white border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          ) : (
                            <span className="text-gray-300">{record.test_point || '-'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editedData.collocation || ''}
                              onChange={(e) => handleFieldChange('collocation', e.target.value)}
                              className="w-full px-2 py-1 bg-gray-700 text-white border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          ) : (
                            <span className="text-gray-300">{record.collocation || '-'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editedData.word_family || ''}
                              onChange={(e) => handleFieldChange('word_family', e.target.value)}
                              className="w-full px-2 py-1 bg-gray-700 text-white border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          ) : (
                            <span className="text-gray-300">{record.word_family || '-'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editedData.book || ''}
                              onChange={(e) => handleFieldChange('book', e.target.value)}
                              className="w-full px-2 py-1 bg-gray-700 text-white border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          ) : (
                            <span className="text-gray-300">{record.book || '-'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            {isEditing ? (
                              <>
                                <button
                                  onClick={() => handleSave(record.id)}
                                  className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition-colors"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleEdit(record)}
                                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteClick(record.id)}
                                  className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
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
    </div>
  );
}
