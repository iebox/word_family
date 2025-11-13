'use client';

import React, { useState, useEffect } from 'react';
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
  grade?: string;
  chinese?: string;
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
  const [sortColumn, setSortColumn] = useState<SortColumn>('id');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
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
  const [selectedGrades, setSelectedGrades] = useState<Set<string>>(new Set());
  const [selectedUnits, setSelectedUnits] = useState<Set<string>>(new Set());
  const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set());
  const [selectedTestPoints, setSelectedTestPoints] = useState<Set<string>>(new Set());
  const [selectedCollocations, setSelectedCollocations] = useState<Set<string>>(new Set());
  const [selectedBooks, setSelectedBooks] = useState<Set<string>>(new Set());
  const [populatingHeadwords, setPopulatingHeadwords] = useState(false);
  const [populationProgress, setPopulationProgress] = useState({ current: 0, total: 0 });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  // Define default column order with chinese next to word
  const defaultColumnOrder = ['id', 'word', 'chinese', 'reference', 'unit', 'section', 'test_point', 'collocation', 'word_family', 'book', 'grade'];
  const [columnOrder, setColumnOrder] = useState<string[]>(defaultColumnOrder);

  // Load sidebar state from localStorage on mount
  useEffect(() => {
    const savedSidebarState = localStorage.getItem('sidebarCollapsed');
    if (savedSidebarState !== null) {
      setSidebarCollapsed(savedSidebarState === 'true');
    }

    // Load column order from localStorage
    const savedColumnOrder = localStorage.getItem('columnOrder');
    if (savedColumnOrder) {
      try {
        const parsed = JSON.parse(savedColumnOrder);
        setColumnOrder(parsed);
      } catch (error) {
        console.error('Failed to parse column order:', error);
      }
    }
  }, []);

  // Save sidebar state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  // Save column order to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('columnOrder', JSON.stringify(columnOrder));
  }, [columnOrder]);

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

  const handleDragStart = (e: React.DragEvent, column: string) => {
    setDraggedColumn(column);
    // Set drag effect
    e.dataTransfer.effectAllowed = 'move';
    // Create a semi-transparent ghost image
    if (e.currentTarget instanceof HTMLElement) {
      const ghost = e.currentTarget.cloneNode(true) as HTMLElement;
      ghost.style.opacity = '0.5';
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 0, 0);
      setTimeout(() => document.body.removeChild(ghost), 0);
    }
  };

  const handleDragOver = (e: React.DragEvent, targetColumn: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (draggedColumn && draggedColumn !== targetColumn) {
      setDragOverColumn(targetColumn);
    }
  };

  const handleDragEnter = (e: React.DragEvent, targetColumn: string) => {
    e.preventDefault();
    if (draggedColumn && draggedColumn !== targetColumn) {
      setDragOverColumn(targetColumn);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if we're leaving the column header, not entering a child
    if (e.currentTarget === e.target) {
      setDragOverColumn(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetColumn: string) => {
    e.preventDefault();

    if (!draggedColumn || draggedColumn === targetColumn) {
      setDraggedColumn(null);
      setDragOverColumn(null);
      return;
    }

    const draggedIdx = columnOrder.indexOf(draggedColumn);
    const targetIdx = columnOrder.indexOf(targetColumn);

    // Build new order by filtering and inserting
    const filteredOrder = columnOrder.filter(col => col !== draggedColumn);

    let newOrder: string[];
    if (draggedIdx < targetIdx) {
      // Dragging RIGHT: insert after target
      const targetPosition = filteredOrder.indexOf(targetColumn);
      newOrder = [
        ...filteredOrder.slice(0, targetPosition + 1),
        draggedColumn,
        ...filteredOrder.slice(targetPosition + 1)
      ];
    } else {
      // Dragging LEFT: insert before target
      const targetPosition = filteredOrder.indexOf(targetColumn);
      newOrder = [
        ...filteredOrder.slice(0, targetPosition),
        draggedColumn,
        ...filteredOrder.slice(targetPosition)
      ];
    }

    console.log('Reorder:', { from: draggedColumn, to: targetColumn, newOrder });

    // Update state immediately
    setColumnOrder(newOrder);
    setDraggedColumn(null);
    setDragOverColumn(null);
  };

  const handleDragEnd = () => {
    setDraggedColumn(null);
    setDragOverColumn(null);
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

  // Column configuration
  const columnConfig: Record<string, {
    label: string;
    sortable: boolean;
    render: (record: WordRecord, isEditing: boolean) => React.ReactNode;
  }> = {
    id: {
      label: 'ID',
      sortable: true,
      render: (record) => <span className="text-gray-400 text-sm">{record.id}</span>
    },
    word: {
      label: 'Word',
      sortable: true,
      render: (record, isEditing) => isEditing ? (
        <input
          type="text"
          value={editedData.word || ''}
          onChange={(e) => handleFieldChange('word', e.target.value)}
          className="w-full px-2 py-1 bg-gray-700 text-white border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      ) : (
        <span className="text-white font-medium">{record.word}</span>
      )
    },
    chinese: {
      label: 'Chinese',
      sortable: true,
      render: (record, isEditing) => isEditing ? (
        <textarea
          value={editedData.chinese || ''}
          onChange={(e) => handleFieldChange('chinese', e.target.value)}
          className="w-full px-2 py-1 bg-gray-700 text-white border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={2}
        />
      ) : (
        <span className="text-gray-300">{record.chinese || '-'}</span>
      )
    },
    reference: {
      label: 'Reference',
      sortable: true,
      render: (record, isEditing) => isEditing ? (
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
      )
    },
    unit: {
      label: 'Unit',
      sortable: true,
      render: (record, isEditing) => isEditing ? (
        <input
          type="text"
          value={editedData.unit || ''}
          onChange={(e) => handleFieldChange('unit', e.target.value)}
          className="w-full px-2 py-1 bg-gray-700 text-white border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      ) : (
        <span className="text-gray-300">{record.unit || '-'}</span>
      )
    },
    section: {
      label: 'Section',
      sortable: true,
      render: (record, isEditing) => isEditing ? (
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
      )
    },
    test_point: {
      label: 'Test Point',
      sortable: true,
      render: (record, isEditing) => isEditing ? (
        <input
          type="text"
          value={editedData.test_point || ''}
          onChange={(e) => handleFieldChange('test_point', e.target.value)}
          className="w-full px-2 py-1 bg-gray-700 text-white border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      ) : (
        <span className="text-gray-300">{record.test_point || '-'}</span>
      )
    },
    collocation: {
      label: 'Collocation',
      sortable: true,
      render: (record, isEditing) => isEditing ? (
        <input
          type="text"
          value={editedData.collocation || ''}
          onChange={(e) => handleFieldChange('collocation', e.target.value)}
          className="w-full px-2 py-1 bg-gray-700 text-white border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      ) : (
        <span className="text-gray-300">{record.collocation || '-'}</span>
      )
    },
    word_family: {
      label: 'Word Family',
      sortable: true,
      render: (record, isEditing) => isEditing ? (
        <input
          type="text"
          value={editedData.word_family || ''}
          onChange={(e) => handleFieldChange('word_family', e.target.value)}
          className="w-full px-2 py-1 bg-gray-700 text-white border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      ) : (
        <span className="text-gray-300">{record.word_family || '-'}</span>
      )
    },
    book: {
      label: 'Book',
      sortable: true,
      render: (record, isEditing) => isEditing ? (
        <input
          type="text"
          value={editedData.book || ''}
          onChange={(e) => handleFieldChange('book', e.target.value)}
          className="w-full px-2 py-1 bg-gray-700 text-white border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      ) : (
        <span className="text-gray-300">{record.book || '-'}</span>
      )
    },
    grade: {
      label: 'Grade',
      sortable: true,
      render: (record, isEditing) => isEditing ? (
        <input
          type="text"
          value={editedData.grade || ''}
          onChange={(e) => handleFieldChange('grade', e.target.value)}
          className="w-full px-2 py-1 bg-gray-700 text-white border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      ) : (
        <span className="text-gray-300">{record.grade || '-'}</span>
      )
    }
  };

  // Get unique values for all filter types
  const uniqueGrades = Array.from(new Set(records.map(r => r.grade).filter(Boolean))).sort();
  const uniqueUnits = Array.from(new Set(records.map(r => r.unit).filter(Boolean))).sort();
  const uniqueSections = Array.from(new Set(records.map(r => r.section).filter(Boolean))).sort();
  const uniqueTestPoints = Array.from(new Set(records.map(r => r.test_point).filter(Boolean))).sort();
  const uniqueCollocations = Array.from(new Set(records.map(r => r.collocation).filter(Boolean))).sort();
  const uniqueBooks = Array.from(new Set(records.map(r => r.book).filter(Boolean))).sort();

  const filteredRecords = records
    .filter(record => {
      // Multi-select filters
      if (selectedGrades.size > 0 && !selectedGrades.has(record.grade || '')) return false;
      if (selectedUnits.size > 0 && !selectedUnits.has(record.unit || '')) return false;
      if (selectedSections.size > 0 && !selectedSections.has(record.section || '')) return false;
      if (selectedTestPoints.size > 0 && !selectedTestPoints.has(record.test_point || '')) return false;
      if (selectedCollocations.size > 0 && !selectedCollocations.has(record.collocation || '')) return false;
      if (selectedBooks.size > 0 && !selectedBooks.has(record.book || '')) return false;

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

        {/* Grade Filter */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Grade</h3>
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
            {uniqueGrades.length === 0 && (
              <p className="text-sm text-gray-500 italic">No grades available</p>
            )}
          </div>
        </div>

        {/* Unit Filter */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Unit</h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {uniqueUnits.map((unit) => (
              <label key={unit} className="flex items-center cursor-pointer group">
                <input
                  type="checkbox"
                  checked={selectedUnits.has(unit)}
                  onChange={(e) => {
                    const newSet = new Set(selectedUnits);
                    if (e.target.checked) {
                      newSet.add(unit);
                    } else {
                      newSet.delete(unit);
                    }
                    setSelectedUnits(newSet);
                  }}
                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-2 focus:ring-blue-500"
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
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {uniqueSections.map((section) => (
              <label key={section} className="flex items-center cursor-pointer group">
                <input
                  type="checkbox"
                  checked={selectedSections.has(section)}
                  onChange={(e) => {
                    const newSet = new Set(selectedSections);
                    if (e.target.checked) {
                      newSet.add(section);
                    } else {
                      newSet.delete(section);
                    }
                    setSelectedSections(newSet);
                  }}
                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="ml-2 text-gray-300 group-hover:text-white">{section}</span>
              </label>
            ))}
            {uniqueSections.length === 0 && (
              <p className="text-sm text-gray-500 italic">No sections available</p>
            )}
          </div>
        </div>

        {/* Test Point Filter */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Test Point</h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {uniqueTestPoints.map((testPoint) => (
              <label key={testPoint} className="flex items-center cursor-pointer group">
                <input
                  type="checkbox"
                  checked={selectedTestPoints.has(testPoint)}
                  onChange={(e) => {
                    const newSet = new Set(selectedTestPoints);
                    if (e.target.checked) {
                      newSet.add(testPoint);
                    } else {
                      newSet.delete(testPoint);
                    }
                    setSelectedTestPoints(newSet);
                  }}
                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="ml-2 text-gray-300 group-hover:text-white">{testPoint}</span>
              </label>
            ))}
            {uniqueTestPoints.length === 0 && (
              <p className="text-sm text-gray-500 italic">No test points available</p>
            )}
          </div>
        </div>

        {/* Collocation Filter */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Collocation</h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {uniqueCollocations.map((collocation) => (
              <label key={collocation} className="flex items-center cursor-pointer group">
                <input
                  type="checkbox"
                  checked={selectedCollocations.has(collocation)}
                  onChange={(e) => {
                    const newSet = new Set(selectedCollocations);
                    if (e.target.checked) {
                      newSet.add(collocation);
                    } else {
                      newSet.delete(collocation);
                    }
                    setSelectedCollocations(newSet);
                  }}
                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="ml-2 text-gray-300 group-hover:text-white">{collocation}</span>
              </label>
            ))}
            {uniqueCollocations.length === 0 && (
              <p className="text-sm text-gray-500 italic">No collocations available</p>
            )}
          </div>
        </div>

        {/* Book Filter */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Book</h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {uniqueBooks.map((book) => (
              <label key={book} className="flex items-center cursor-pointer group">
                <input
                  type="checkbox"
                  checked={selectedBooks.has(book)}
                  onChange={(e) => {
                    const newSet = new Set(selectedBooks);
                    if (e.target.checked) {
                      newSet.add(book);
                    } else {
                      newSet.delete(book);
                    }
                    setSelectedBooks(newSet);
                  }}
                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="ml-2 text-gray-300 group-hover:text-white">{book}</span>
              </label>
            ))}
            {uniqueBooks.length === 0 && (
              <p className="text-sm text-gray-500 italic">No books available</p>
            )}
          </div>
        </div>

        {/* Clear Filters */}
        {(selectedGrades.size > 0 || selectedUnits.size > 0 || selectedSections.size > 0 ||
          selectedTestPoints.size > 0 || selectedCollocations.size > 0 || selectedBooks.size > 0) && (
          <button
            onClick={() => {
              setSelectedGrades(new Set());
              setSelectedUnits(new Set());
              setSelectedSections(new Set());
              setSelectedTestPoints(new Set());
              setSelectedCollocations(new Set());
              setSelectedBooks(new Set());
            }}
            className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm font-medium"
          >
            Clear All Filters
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
                  {columnOrder.map((columnKey, index) => {
                    const config = columnConfig[columnKey];
                    const isDragging = draggedColumn === columnKey;
                    const isDropTarget = dragOverColumn === columnKey;
                    const draggedIndex = draggedColumn ? columnOrder.indexOf(draggedColumn) : -1;
                    const dropIndex = dragOverColumn ? columnOrder.indexOf(dragOverColumn) : -1;

                    // Determine if we should show drop indicator on left or right
                    const showDropBarLeft = draggedColumn && isDropTarget && !isDragging && draggedIndex > dropIndex;
                    const showDropBarRight = draggedColumn && isDropTarget && !isDragging && draggedIndex < dropIndex;

                    return (
                      <th
                        key={columnKey}
                        className={`
                          px-4 py-3 text-left relative group
                          ${columnKey === 'reference' ? 'max-w-md' : ''}
                          ${isDragging ? 'opacity-0 w-0 p-0 overflow-hidden' : ''}
                          ${isDropTarget && !isDragging ? 'bg-blue-600/20' : 'hover:bg-gray-600/50'}
                          transition-all duration-0
                          cursor-grab active:cursor-grabbing
                        `}
                        draggable={!isDragging}
                        onDragStart={(e) => handleDragStart(e, columnKey)}
                        onDragOver={(e) => handleDragOver(e, columnKey)}
                        onDragEnter={(e) => handleDragEnter(e, columnKey)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, columnKey)}
                        onDragEnd={handleDragEnd}
                        title="Drag to reorder columns"
                      >
                        {/* Vertical drop indicator bar - LEFT side (dragging from right to left) */}
                        {showDropBarLeft && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 shadow-lg shadow-blue-500/50 animate-pulse z-10"></div>
                        )}

                        {/* Vertical drop indicator bar - RIGHT side (dragging from left to right) */}
                        {showDropBarRight && (
                          <div className="absolute right-0 top-0 bottom-0 w-1 bg-blue-500 shadow-lg shadow-blue-500/50 animate-pulse z-10"></div>
                        )}

                        {config.sortable ? (
                          <button
                            onClick={() => handleSort(columnKey as keyof WordRecord)}
                            className="flex items-center gap-2 text-sm font-semibold text-gray-200 hover:text-white transition-colors select-none whitespace-nowrap w-full"
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            <span className="text-gray-400 group-hover:text-gray-300 text-base font-bold">⋮⋮</span>
                            {config.label}
                            <span className="text-gray-400 ml-auto">{getSortIcon(columnKey as keyof WordRecord)}</span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-2 select-none whitespace-nowrap w-full">
                            <span className="text-gray-400 group-hover:text-gray-300 text-base font-bold">⋮⋮</span>
                            <span className="text-sm font-semibold text-gray-200 group-hover:text-white">{config.label}</span>
                          </div>
                        )}

                        {/* Visual indicator on hover */}
                        <div className="absolute inset-0 border-2 border-blue-400 rounded opacity-0 group-hover:opacity-20 pointer-events-none transition-opacity duration-150"></div>
                      </th>
                    );
                  })}
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-200">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={columnOrder.length + 2} className="px-4 py-8 text-center text-gray-400">
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
                        {columnOrder.map((columnKey) => {
                          const config = columnConfig[columnKey];
                          return (
                            <td
                              key={columnKey}
                              className={`px-4 py-3 ${columnKey === 'reference' ? 'max-w-md' : ''}`}
                            >
                              {config.render(record, isEditing)}
                            </td>
                          );
                        })}
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
