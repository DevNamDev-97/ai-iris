import React, { useState, useMemo } from 'react';
import { 
  Table, 
  Grid3X3, 
  Download, 
  FileSpreadsheet, 
  Search, 
  Filter, 
  Plus, 
  Trash2, 
  Check, 
  Copy, 
  X, 
  ArrowUpDown, 
  FileDown, 
  Layers, 
  CheckCircle2, 
  Circle, 
  Edit3,
  ExternalLink,
  Sparkles,
  BarChart3
} from 'lucide-react';
import { FuturisticScrollTrack } from './FuturisticScrollTrack.tsx';

export interface SpreadsheetColumn {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'currency' | 'status' | 'date' | 'tag' | 'checkbox';
  width?: string;
}

export interface SpreadsheetRow {
  id?: string;
  [key: string]: any;
}

export interface StructuredListData {
  title: string;
  description?: string;
  category?: 'tasks' | 'finance' | 'inventory' | 'comparison' | 'ranking' | 'general' | string;
  columns: SpreadsheetColumn[];
  rows: SpreadsheetRow[];
}

interface SpreadsheetGridModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: StructuredListData | null;
  onUpdateData?: (updated: StructuredListData) => void;
  theme?: 'light' | 'dark';
}

export const SpreadsheetGridModal: React.FC<SpreadsheetGridModalProps> = ({
  isOpen,
  onClose,
  data,
  onUpdateData,
  theme = 'dark',
}) => {
  const [viewMode, setViewMode] = useState<'sheet' | 'grid'>('sheet');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCell, setActiveCell] = useState<{ rowIdx: number; colKey: string } | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [localRows, setLocalRows] = useState<SpreadsheetRow[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Sync rows when data changes
  React.useEffect(() => {
    if (data && data.rows) {
      setLocalRows(data.rows.map((r, i) => ({ id: r.id || `row-${i}`, ...r })));
    }
  }, [data]);

  // Extract unique categories or tags for filtering
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    localRows.forEach((row) => {
      if (row.category) cats.add(String(row.category));
      if (row.status) cats.add(String(row.status));
      if (row.type) cats.add(String(row.type));
    });
    return Array.from(cats);
  }, [localRows]);

  // Filtered & Sorted Rows
  const processedRows = useMemo(() => {
    let result = [...localRows];

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((row) =>
        Object.values(row).some((val) =>
          String(val).toLowerCase().includes(q)
        )
      );
    }

    // Category / Status Filter
    if (selectedCategory !== 'all') {
      result = result.filter((row) =>
        row.category === selectedCategory ||
        row.status === selectedCategory ||
        row.type === selectedCategory
      );
    }

    // Column sort
    if (sortConfig) {
      result.sort((a, b) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];

        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
        }

        const strA = String(valA || '').toLowerCase();
        const strB = String(valB || '').toLowerCase();
        if (strA < strB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (strA > strB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [localRows, searchQuery, selectedCategory, sortConfig]);

  if (!isOpen || !data) return null;

  const isDark = theme === 'dark';

  // Sorting handler
  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (!prev || prev.key !== key) {
        return { key, direction: 'asc' };
      }
      if (prev.direction === 'asc') {
        return { key, direction: 'desc' };
      }
      return null;
    });
  };

  // Cell editing
  const handleCellChange = (rowIndex: number, colKey: string, value: any) => {
    const updated = [...localRows];
    updated[rowIndex] = { ...updated[rowIndex], [colKey]: value };
    setLocalRows(updated);
    if (onUpdateData && data) {
      onUpdateData({ ...data, rows: updated });
    }
  };

  // Toggle row completion for checklist items
  const toggleRowStatus = (rowIndex: number) => {
    const updated = [...localRows];
    const currentStatus = updated[rowIndex].status || updated[rowIndex].completed;
    const isDone = currentStatus === 'completed' || currentStatus === 'Done' || currentStatus === true;
    updated[rowIndex] = {
      ...updated[rowIndex],
      status: isDone ? 'pending' : 'completed',
      completed: !isDone,
    };
    setLocalRows(updated);
    if (onUpdateData && data) {
      onUpdateData({ ...data, rows: updated });
    }
  };

  // Add new row
  const handleAddRow = () => {
    const newRow: SpreadsheetRow = { id: `row-${Date.now()}` };
    data.columns.forEach((col) => {
      newRow[col.key] = col.type === 'number' || col.type === 'currency' ? 0 : '';
    });
    const updated = [...localRows, newRow];
    setLocalRows(updated);
    if (onUpdateData && data) {
      onUpdateData({ ...data, rows: updated });
    }
  };

  // Delete row
  const handleDeleteRow = (rowIndex: number) => {
    const updated = localRows.filter((_, idx) => idx !== rowIndex);
    setLocalRows(updated);
    if (onUpdateData && data) {
      onUpdateData({ ...data, rows: updated });
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = data.columns.map((c) => `"${c.label.replace(/"/g, '""')}"`).join(',');
    const rowsText = localRows
      .map((r) =>
        data.columns
          .map((c) => {
            const val = r[c.key] !== undefined && r[c.key] !== null ? String(r[c.key]) : '';
            return `"${val.replace(/"/g, '""')}"`;
          })
          .join(',')
      )
      .join('\n');

    const csvContent = `${headers}\n${rowsText}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${data.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_sheet.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Copy formatted table for Microsoft Excel / Google Sheets
  const handleCopyTable = () => {
    const headers = data.columns.map((c) => c.label).join('\t');
    const rowsText = localRows
      .map((r) => data.columns.map((c) => (r[c.key] !== undefined && r[c.key] !== null ? String(r[c.key]) : '')).join('\t'))
      .join('\n');

    const tsvContent = `${headers}\n${rowsText}`;
    navigator.clipboard.writeText(tsvContent);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Convert column index to Excel letter (0 -> A, 1 -> B, etc.)
  const getColLetter = (index: number) => String.fromCharCode(65 + index);

  // Active cell coordinate display
  const activeCoordinate = activeCell
    ? `${getColLetter(data.columns.findIndex((c) => c.key === activeCell.colKey))}${activeCell.rowIdx + 1}`
    : 'A1';

  const activeCellValue = activeCell && localRows[activeCell.rowIdx]
    ? String(localRows[activeCell.rowIdx][activeCell.colKey] || '')
    : localRows[0] && data.columns[0]
    ? String(localRows[0][data.columns[0].key] || '')
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md animate-motion-blur-in">
      <div
        className={`w-full max-w-5xl h-[88vh] rounded-3xl border flex flex-col shadow-2xl overflow-hidden relative ${
          isDark
            ? 'bg-slate-950 border-cyan-500/30 text-white shadow-cyan-950/40'
            : 'bg-white border-blue-200 text-slate-900 shadow-blue-500/20'
        }`}
      >
        {/* Top Center Close Button */}
        <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-40">
          <button
            onClick={onClose}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold border shadow-xl transition-all active:scale-95 group backdrop-blur-md ${
              isDark
                ? 'bg-slate-950/90 hover:bg-rose-950/90 text-slate-200 hover:text-rose-200 border-slate-700 hover:border-rose-500/60 shadow-black/80'
                : 'bg-white/95 hover:bg-rose-50 text-slate-700 hover:text-rose-600 border-slate-300 hover:border-rose-300 shadow-slate-300/60'
            }`}
            title="Close Spreadsheet"
          >
            <X className="w-3.5 h-3.5 text-rose-500 group-hover:scale-110 transition-transform" />
            <span>Close Sheet</span>
          </button>
        </div>

        {/* Top Header Bar */}
        <div
          className={`px-4 py-3 border-b flex items-center justify-between gap-3 shrink-0 ${
            isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold tracking-tight">
                  {data.title || 'Structured List & Spreadsheet'}
                </h3>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-bold">
                  {localRows.length} Items
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {data.description || 'Interactive professional Excel Sheet & Grid Catalog'}
              </p>
            </div>
          </div>

          {/* View Mode Toggle & Primary Actions */}
          <div className="flex items-center gap-2">
            {/* Sheet / Grid Switcher */}
            <div className={`flex items-center p-1 rounded-xl border ${
              isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
            }`}>
              <button
                onClick={() => setViewMode('sheet')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'sheet'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-200'
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Excel Grid</span>
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'grid'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-200'
                }`}
              >
                <Grid3X3 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Cards Grid</span>
              </button>
            </div>

            {/* Copy Table to Clipboard (Excel Ready) */}
            <button
              onClick={handleCopyTable}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                isCopied
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
              }`}
              title="Copy table formatted for Excel / Sheets"
            >
              {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden md:inline">{isCopied ? 'Copied Table!' : 'Copy Table'}</span>
            </button>

            {/* Export CSV Download */}
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition-all active:scale-95"
              title="Download as .csv file"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar & Excel Formula Bar */}
        <div
          className={`px-4 py-2 border-b flex flex-wrap items-center justify-between gap-3 text-xs ${
            isDark ? 'bg-slate-900/60 border-slate-800/80' : 'bg-slate-100/60 border-slate-200'
          }`}
        >
          {/* Formula Bar / Active Coordinate */}
          <div className="flex items-center gap-2 grow max-w-md">
            <span className={`px-2 py-1 rounded font-mono font-bold text-[11px] border ${
              isDark ? 'bg-slate-950 border-slate-800 text-cyan-400' : 'bg-white border-slate-300 text-blue-600'
            }`}>
              {activeCoordinate}
            </span>
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border grow ${
              isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-300'
            }`}>
              <span className="font-mono text-slate-500 font-bold">fx</span>
              <input
                type="text"
                readOnly
                value={activeCellValue}
                placeholder="Formula / Cell value"
                className="bg-transparent border-none outline-none w-full text-xs font-mono"
              />
            </div>
          </div>

          {/* Search in Sheet & Category Filter */}
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${
              isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-300'
            }`}>
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search rows & columns..."
                className="bg-transparent border-none outline-none text-xs w-28 sm:w-44"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-slate-500 hover:text-slate-300">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {availableCategories.length > 0 && (
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className={`px-2 py-1 rounded-lg border text-xs outline-none ${
                  isDark ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-white border-slate-300 text-slate-700'
                }`}
              >
                <option value="all">All Categories</option>
                {availableCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={handleAddRow}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all ${
                isDark ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-cyan-300' : 'bg-white hover:bg-slate-50 border-slate-300 text-blue-600'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Row</span>
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="grow overflow-hidden relative">
          <FuturisticScrollTrack>
            {viewMode === 'sheet' ? (
              /* Excel Spreadsheet Table View */
              <div className="min-w-full inline-block align-middle p-2">
                <table className="min-w-full border-collapse text-left text-xs font-mono">
                  <thead>
                    <tr className={isDark ? 'bg-slate-900 border-b border-slate-800' : 'bg-slate-100 border-b border-slate-200'}>
                      {/* Row Index Header */}
                      <th className="w-12 px-2 py-2.5 text-center font-bold text-slate-500 border-r border-slate-800/40 select-none">
                        #
                      </th>
                      {/* Dynamic Columns with Excel Letter (A, B, C...) */}
                      {data.columns.map((col, idx) => {
                        const isSorted = sortConfig?.key === col.key;
                        return (
                          <th
                            key={col.key}
                            onClick={() => handleSort(col.key)}
                            className={`px-3 py-2.5 font-bold cursor-pointer transition-colors border-r border-slate-800/40 select-none ${
                              isDark ? 'hover:bg-slate-800/80 text-slate-200' : 'hover:bg-slate-200/80 text-slate-800'
                            }`}
                            style={{ width: col.width || 'auto' }}
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                                  {getColLetter(idx)}
                                </span>
                                <span>{col.label}</span>
                              </div>
                              <ArrowUpDown
                                className={`w-3 h-3 ${
                                  isSorted ? 'text-emerald-500' : 'text-slate-500 opacity-40'
                                }`}
                              />
                            </div>
                          </th>
                        );
                      })}
                      {/* Action Column */}
                      <th className="w-12 px-2 py-2 text-center text-slate-500">Act</th>
                    </tr>
                  </thead>
                  <tbody>
                    {processedRows.map((row, rowIdx) => {
                      const isCompleted = row.status === 'completed' || row.status === 'Done' || row.completed === true;

                      return (
                        <tr
                          key={row.id || rowIdx}
                          className={`border-b transition-colors ${
                            isDark
                              ? 'border-slate-900 hover:bg-slate-900/50'
                              : 'border-slate-100 hover:bg-slate-50'
                          } ${isCompleted ? 'opacity-60 bg-emerald-950/10' : ''}`}
                        >
                          {/* Row Number (1, 2, 3...) */}
                          <td className="w-12 px-2 py-2 text-center text-slate-500 border-r border-slate-800/40 select-none font-bold">
                            {rowIdx + 1}
                          </td>

                          {/* Data Cells */}
                          {data.columns.map((col) => {
                            const val = row[col.key];
                            const isCellActive = activeCell?.rowIdx === rowIdx && activeCell?.colKey === col.key;

                            return (
                              <td
                                key={col.key}
                                onClick={() => setActiveCell({ rowIdx, colKey: col.key })}
                                className={`px-3 py-2 border-r border-slate-800/20 relative ${
                                  isCellActive
                                    ? isDark
                                      ? 'bg-cyan-950/40 ring-1 ring-cyan-500'
                                      : 'bg-blue-50 ring-1 ring-blue-500'
                                    : ''
                                }`}
                              >
                                {col.type === 'status' ? (
                                  <button
                                    onClick={() => toggleRowStatus(rowIdx)}
                                    className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase transition-all ${
                                      isCompleted
                                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                    }`}
                                  >
                                    {isCompleted ? <CheckCircle2 className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
                                    <span>{String(val || (isCompleted ? 'Done' : 'Active'))}</span>
                                  </button>
                                ) : col.type === 'tag' ? (
                                  <span className="px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[11px]">
                                    {String(val || '')}
                                  </span>
                                ) : (
                                  <input
                                    type={col.type === 'number' ? 'number' : 'text'}
                                    value={val !== undefined && val !== null ? val : ''}
                                    onChange={(e) => handleCellChange(rowIdx, col.key, e.target.value)}
                                    className={`w-full bg-transparent border-none outline-none font-mono text-xs ${
                                      isCompleted ? 'line-through text-slate-500' : ''
                                    }`}
                                  />
                                )}
                              </td>
                            );
                          })}

                          {/* Delete Action */}
                          <td className="w-12 px-2 py-2 text-center">
                            <button
                              onClick={() => handleDeleteRow(rowIdx)}
                              className="p-1 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                              title="Delete row"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {processedRows.length === 0 && (
                  <div className="py-12 text-center text-slate-500 text-xs">
                    No rows match the search query "{searchQuery}".
                  </div>
                )}
              </div>
            ) : (
              /* Modern Interactive Grid / Cards List View */
              <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {processedRows.map((row, rowIdx) => {
                  const isCompleted = row.status === 'completed' || row.status === 'Done' || row.completed === true;
                  const primaryTitle = row.title || row.name || row.item || row.task || row.label || `Item #${rowIdx + 1}`;

                  return (
                    <div
                      key={row.id || rowIdx}
                      className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between relative group ${
                        isDark
                          ? 'bg-slate-900/70 border-slate-800 hover:border-cyan-500/40 hover:shadow-lg hover:shadow-cyan-950/30'
                          : 'bg-slate-50 border-slate-200 hover:border-blue-400 hover:shadow-md'
                      } ${isCompleted ? 'opacity-65 border-emerald-500/30' : ''}`}
                    >
                      {/* Top Card Info */}
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 font-bold">
                            #{rowIdx + 1}
                          </span>
                          {row.status && (
                            <button
                              onClick={() => toggleRowStatus(rowIdx)}
                              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                isCompleted
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                              }`}
                            >
                              {isCompleted ? <CheckCircle2 className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
                              <span>{String(row.status)}</span>
                            </button>
                          )}
                        </div>

                        <h4 className={`text-sm font-bold mb-2 tracking-tight ${isCompleted ? 'line-through text-slate-500' : ''}`}>
                          {String(primaryTitle)}
                        </h4>

                        {/* Property List */}
                        <div className="space-y-1.5 text-xs text-slate-400">
                          {data.columns
                            .filter((c) => !['title', 'name', 'item', 'task', 'status'].includes(c.key))
                            .map((col) => {
                              const val = row[col.key];
                              if (val === undefined || val === null || val === '') return null;
                              return (
                                <div key={col.key} className="flex items-center justify-between text-[11px]">
                                  <span className="text-slate-500 font-medium">{col.label}:</span>
                                  <span className="font-mono text-slate-200">{String(val)}</span>
                                </div>
                              );
                            })}
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-800/60">
                        <button
                          onClick={() => toggleRowStatus(rowIdx)}
                          className="text-[11px] font-semibold text-emerald-400 hover:underline flex items-center gap-1"
                        >
                          {isCompleted ? 'Mark Pending' : 'Mark Done'}
                        </button>
                        <button
                          onClick={() => handleDeleteRow(rowIdx)}
                          className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </FuturisticScrollTrack>
        </div>

        {/* Bottom Statistics & Summary Bar */}
        <div
          className={`px-4 py-2.5 border-t flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono shrink-0 ${
            isDark ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
          }`}
        >
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Rows: <strong>{processedRows.length}</strong></span>
            </span>
            <span>Columns: <strong>{data.columns.length}</strong></span>
            <span>Completed: <strong>{processedRows.filter((r) => r.status === 'completed' || r.completed === true).length}</strong></span>
          </div>

          <div className="flex items-center gap-2 text-slate-500">
            <span>Click any cell to edit • Export ready for MS Excel / Google Sheets</span>
          </div>
        </div>
      </div>
    </div>
  );
};
