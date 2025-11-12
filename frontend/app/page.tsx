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
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
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

  const handleFieldChange = (field: keyof WordRecord, value: string) => {
    setEditedData(prev => ({ ...prev, [field]: value }));
  };

  const filteredRecords = records
    .filter(record => {
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
    <div className="min-h-screen p-8 bg-gray-900">
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

        <h1 className="text-3xl font-bold mb-6 text-white">应单词表</h1>

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
                  <option value="sentence">Sentence</option>
                  <option value="section">Section</option>
                  <option value="test_point">Test Point</option>
                  <option value="collocation">Collocation</option>
                  <option value="head_word">Head Word</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-700">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-700 border-b border-gray-600">
                <tr>
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
                      onClick={() => handleSort('sentence')}
                      className="flex items-center gap-2 text-sm font-semibold text-gray-200 hover:text-white transition-colors"
                    >
                      Sentence <span className="text-gray-400">{getSortIcon('sentence')}</span>
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-200">Prep Vocab</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-200">Recording</th>
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
                      onClick={() => handleSort('head_word')}
                      className="flex items-center gap-2 text-sm font-semibold text-gray-200 hover:text-white transition-colors"
                    >
                      Head Word <span className="text-gray-400">{getSortIcon('head_word')}</span>
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort('chinese_translation')}
                      className="flex items-center gap-2 text-sm font-semibold text-gray-200 hover:text-white transition-colors"
                    >
                      Chinese <span className="text-gray-400">{getSortIcon('chinese_translation')}</span>
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
                    return (
                      <tr key={record.id} className="border-b border-gray-700 hover:bg-gray-750 transition-colors">
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
                              value={editedData.sentence || ''}
                              onChange={(e) => handleFieldChange('sentence', e.target.value)}
                              className="w-full px-2 py-1 bg-gray-700 text-white border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                              rows={2}
                            />
                          ) : (
                            <span className="text-gray-300">{record.sentence}</span>
                          )}
                        </td>
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
                              value={editedData.head_word || ''}
                              onChange={(e) => handleFieldChange('head_word', e.target.value)}
                              className="w-full px-2 py-1 bg-gray-700 text-white border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          ) : (
                            <span className="text-gray-300">{record.head_word || '-'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editedData.chinese_translation || ''}
                              onChange={(e) => handleFieldChange('chinese_translation', e.target.value)}
                              className="w-full px-2 py-1 bg-gray-700 text-white border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          ) : (
                            <span className="text-gray-300">{record.chinese_translation || '-'}</span>
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
  );
}
