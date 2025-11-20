'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';

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

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);

  // Define default column order with chinese next to word
  const defaultColumnOrder = ['id', 'word', 'chinese', 'reference', 'unit', 'section', 'test_point', 'collocation', 'word_family', 'book', 'grade'];
  const [columnOrder, setColumnOrder] = useState<string[]>(defaultColumnOrder);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [showColumnMenu, setShowColumnMenu] = useState(false);

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

    // Load pagination settings from localStorage
    const savedItemsPerPage = localStorage.getItem('itemsPerPage');
    if (savedItemsPerPage) {
      setItemsPerPage(parseInt(savedItemsPerPage, 10));
    }

    // Load hidden columns from localStorage
    const savedHiddenColumns = localStorage.getItem('hiddenColumns');
    if (savedHiddenColumns) {
      try {
        const parsed = JSON.parse(savedHiddenColumns);
        setHiddenColumns(new Set(parsed));
      } catch (error) {
        console.error('Failed to parse hidden columns:', error);
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

  // Save items per page to localStorage
  useEffect(() => {
    localStorage.setItem('itemsPerPage', String(itemsPerPage));
  }, [itemsPerPage]);

  // Save hidden columns to localStorage
  useEffect(() => {
    localStorage.setItem('hiddenColumns', JSON.stringify(Array.from(hiddenColumns)));
  }, [hiddenColumns]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedGrades, selectedUnits, selectedSections, selectedTestPoints, selectedCollocations, selectedBooks]);

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
        const data = await response.json();
        showNotification('success', `File imported successfully! ${data.records} records added.`);
        fetchRecords();
        setFile(null);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        showNotification('error', `Failed to import file: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      showNotification('error', `Failed to upload file: ${error instanceof Error ? error.message : 'Network error'}`);
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
      // Select all on current page
      const pageIds = new Set([...selectedIds, ...paginatedRecords.map(record => record.id)]);
      setSelectedIds(pageIds);
    } else {
      // Deselect all on current page
      const pageIdsSet = new Set(paginatedRecords.map(record => record.id));
      const newSelected = new Set([...selectedIds].filter(id => !pageIdsSet.has(id)));
      setSelectedIds(newSelected);
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

  // Wildcard search matcher
  const matchesWildcardSearch = (text: string, searchPattern: string): boolean => {
    if (!searchPattern) return true;

    const lowerText = text.toLowerCase();
    const lowerPattern = searchPattern.toLowerCase();

    // Check if pattern contains wildcards
    const startsWithWildcard = lowerPattern.startsWith('%');
    const endsWithWildcard = lowerPattern.endsWith('%');

    if (startsWithWildcard && endsWithWildcard) {
      // %eat% -> contains "eat" anywhere (partial match)
      const searchTerm = lowerPattern.slice(1, -1);
      return lowerText.includes(searchTerm);
    } else if (startsWithWildcard) {
      // %eat -> ends with "eat"
      const searchTerm = lowerPattern.slice(1);
      return lowerText.endsWith(searchTerm);
    } else if (endsWithWildcard) {
      // eat% -> starts with "eat"
      const searchTerm = lowerPattern.slice(0, -1);
      return lowerText.startsWith(searchTerm);
    } else {
      // eat -> exact whole word match only
      // Use word boundary regex to match whole words
      const regex = new RegExp(`\\b${lowerPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
      return regex.test(lowerText);
    }
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
  const uniqueGrades = Array.from(new Set(records.map(r => r.grade).filter((v): v is string => Boolean(v)))).sort();
  const uniqueUnits = Array.from(new Set(records.map(r => r.unit).filter((v): v is string => Boolean(v)))).sort();
  const uniqueSections = Array.from(new Set(records.map(r => r.section).filter((v): v is string => Boolean(v)))).sort();
  const uniqueTestPoints = Array.from(new Set(records.map(r => r.test_point).filter((v): v is string => Boolean(v)))).sort();
  const uniqueCollocations = Array.from(new Set(records.map(r => r.collocation).filter((v): v is string => Boolean(v)))).sort();
  const uniqueBooks = Array.from(new Set(records.map(r => r.book).filter((v): v is string => Boolean(v)))).sort();

  const filteredRecords = records
    .filter(record => {
      // Multi-select filters
      if (selectedGrades.size > 0 && !selectedGrades.has(record.grade || '')) return false;
      if (selectedUnits.size > 0 && !selectedUnits.has(record.unit || '')) return false;
      if (selectedSections.size > 0 && !selectedSections.has(record.section || '')) return false;
      if (selectedTestPoints.size > 0 && !selectedTestPoints.has(record.test_point || '')) return false;
      if (selectedCollocations.size > 0 && !selectedCollocations.has(record.collocation || '')) return false;
      if (selectedBooks.size > 0 && !selectedBooks.has(record.book || '')) return false;

      // Search filter with wildcard support
      if (!searchTerm) return true;

      if (filterColumn === 'all') {
        return Object.values(record).some(value =>
          matchesWildcardSearch(String(value), searchTerm)
        );
      }

      return matchesWildcardSearch(
        String(record[filterColumn as keyof WordRecord] || ''),
        searchTerm
      );
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
    const filename = `word-family-records-${timestamp}.xlsx`;

    // Save file
    XLSX.writeFile(workbook, filename);
  };

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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span className="text-sm text-gray-400">Word Family</span>
              </div>
            </div>

            {/* Navigation Links */}
            <div className="flex items-center gap-2">
              <Link
                href="/"
                prefetch={true}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white font-medium shadow-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Word Family
              </Link>
              <Link
                href="/word-stats"
                prefetch={true}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-gray-700 transition-all font-medium"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Word Statistics
              </Link>
              <Link
                href="/spot-word"
                prefetch={true}
                scroll={false}
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
        <div className={`${sidebarCollapsed ? 'w-16' : 'w-64'} bg-gray-800 border-r border-gray-700 p-6 overflow-y-auto transition-all duration-300`}>
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
        <div className="flex-1 p-8 overflow-y-auto bg-gray-900">
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
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors font-medium whitespace-nowrap min-w-[120px]"
              >
                {uploading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </span>
                ) : 'Upload'}
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
                  placeholder="Search... (use % for wildcards)"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-600 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-400">
                  Examples: <span className="text-blue-400">eat</span> (exact word) • <span className="text-blue-400">eat%</span> (starts with) • <span className="text-blue-400">%eat</span> (ends with) • <span className="text-blue-400">%eat%</span> (contains anywhere)
                </p>
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

        {/* Bulk Actions and Export Bar */}
        <div className="bg-gray-800 rounded-lg shadow-lg p-4 mb-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {selectedIds.size > 0 && (
                <>
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
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Column Visibility Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowColumnMenu(!showColumnMenu)}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium"
                  title="Show/Hide Columns"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                  </svg>
                  Columns
                </button>

                {showColumnMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowColumnMenu(false)}
                    />
                    <div className="absolute right-0 mt-2 w-56 bg-gray-700 rounded-lg shadow-xl border border-gray-600 z-20 max-h-96 overflow-y-auto">
                      <div className="p-3 border-b border-gray-600">
                        <h3 className="text-sm font-semibold text-gray-200">Show/Hide Columns</h3>
                      </div>
                      <div className="p-2 space-y-1">
                        {columnOrder.map((column) => {
                          const config = columnConfig[column];
                          if (!config) return null;

                          return (
                            <label
                              key={column}
                              className="flex items-center px-3 py-2 hover:bg-gray-600 rounded cursor-pointer group"
                            >
                              <input
                                type="checkbox"
                                checked={!hiddenColumns.has(column)}
                                onChange={(e) => {
                                  const newHidden = new Set(hiddenColumns);
                                  if (e.target.checked) {
                                    newHidden.delete(column);
                                  } else {
                                    newHidden.add(column);
                                  }
                                  setHiddenColumns(newHidden);
                                }}
                                className="w-4 h-4 text-blue-600 bg-gray-600 border-gray-500 rounded focus:ring-2 focus:ring-blue-500"
                              />
                              <span className="ml-3 text-sm text-gray-200 group-hover:text-white">
                                {config.label}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                      <div className="p-2 border-t border-gray-600">
                        <button
                          onClick={() => setHiddenColumns(new Set())}
                          className="w-full px-3 py-2 text-sm bg-gray-600 text-white rounded hover:bg-gray-500 transition-colors"
                        >
                          Show All Columns
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <button
                onClick={handleExportToExcel}
                disabled={filteredRecords.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors font-medium"
                title="Export filtered records to Excel"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export to Excel ({filteredRecords.length})
              </button>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-700">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-700 border-b border-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left w-12">
                    <input
                      type="checkbox"
                      checked={paginatedRecords.length > 0 && paginatedRecords.every(record => selectedIds.has(record.id))}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    />
                  </th>
                  {columnOrder.map((columnKey, index) => {
                    const config = columnConfig[columnKey];

                    // Skip hidden columns
                    if (hiddenColumns.has(columnKey)) return null;

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
                          px-4 py-3 text-left relative group whitespace-nowrap
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
                {paginatedRecords.length === 0 ? (
                  <tr>
                    <td colSpan={columnOrder.filter(col => !hiddenColumns.has(col)).length + 2} className="px-4 py-8 text-center text-gray-400">
                      {filteredRecords.length === 0 ? 'No records found. Upload an Excel file to get started.' : 'No records on this page.'}
                    </td>
                  </tr>
                ) : (
                  paginatedRecords.map((record) => {
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

                          // Skip hidden columns
                          if (hiddenColumns.has(columnKey)) return null;

                          return (
                            <td
                              key={columnKey}
                              className="px-4 py-3 whitespace-nowrap"
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

        {/* Pagination Controls */}
        {filteredRecords.length > 0 && (
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

        <div className="mt-4 text-sm text-gray-400 flex justify-between items-center">
          <span>Total records: {filteredRecords.length} / {records.length}</span>
          <span>Page {currentPage} of {totalPages}</span>
        </div>
        </div>
        </div>
      </div>
    </div>
  );
}
