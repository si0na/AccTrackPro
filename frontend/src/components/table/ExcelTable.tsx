/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Opportunity, ActionItem, OpportunityStage, PriorityLevel, ActionItemStatus } from '@/types';
import { Plus, Trash2, ArrowUpDown, FileSpreadsheet, Check, X } from 'lucide-react';

interface ExcelTableProps {
  type: 'opportunity' | 'action-item';
  items: any[];
  ownersList: string[];
  onAdd: () => void;
  onUpdate: (item: any) => void;
  onDelete: (id: string) => void;
  onRowClick?: (id: string) => void;
  selectedRowId?: string | null;
}

export const ExcelTable: React.FC<ExcelTableProps> = ({
  type,
  items,
  ownersList,
  onAdd,
  onUpdate,
  onDelete,
  onRowClick,
  selectedRowId
}) => {
  const [selectedCell, setSelectedCell] = useState<{ rowId: string; colKey: string } | null>(null);
  const [editingCell, setEditingCell] = useState<{ rowId: string; colKey: string; val: string } | null>(null);

  // Column definitions
  const oppColumns = [
    { key: 'name', label: 'Opportunity Name', type: 'text', width: 'w-1/4' },
    { key: 'stage', label: 'Stage', type: 'select', options: ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won'], width: 'w-1/6' },
    { key: 'value', label: 'Deal Value ($)', type: 'currency', width: 'w-1/6' },
    { key: 'probability', label: 'Probability (%)', type: 'percent', width: 'w-1/6' },
    { key: 'closeDate', label: 'Close Date', type: 'date', width: 'w-1/6' },
    { key: 'owner', label: 'Owner', type: 'select', options: ownersList, width: 'w-1/6' }
  ];

  const actionColumns = [
    { key: 'title', label: 'Action Item Title', type: 'text', width: 'w-1/3' },
    { key: 'priority', label: 'Priority', type: 'select', options: ['High', 'Medium', 'Low'], width: 'w-1/6' },
    { key: 'status', label: 'Status', type: 'select', options: ['Not Started', 'In Progress', 'Blocked', 'Completed'], width: 'w-1/6' },
    { key: 'dueDate', label: 'Due Date', type: 'date', width: 'w-1/6' },
    { key: 'owner', label: 'Owner', type: 'select', options: ownersList, width: 'w-1/6' }
  ];

  const columns = type === 'opportunity' ? oppColumns : actionColumns;

  // Handle cell click (select cell)
  const handleCellClick = (rowId: string, colKey: string) => {
    setSelectedCell({ rowId, colKey });
    onRowClick?.(rowId);
  };

  // Handle cell double click (start editing)
  const handleCellDoubleClick = (rowId: string, colKey: string, initialValue: any) => {
    setSelectedCell({ rowId, colKey });
    setEditingCell({ rowId, colKey, val: String(initialValue) });
  };

  // Save the edited cell value
  const handleSaveEdit = (rowId: string, colKey: string) => {
    if (!editingCell) return;
    
    const originalItem = items.find(item => item.id === rowId);
    if (!originalItem) return;

    let newValue: any = editingCell.val;
    if (colKey === 'value' || colKey === 'probability') {
      newValue = Number(newValue.replace(/[^0-9.-]+/g, '')) || 0;
      if (colKey === 'probability') {
        newValue = Math.max(0, Math.min(100, newValue));
      }
    }

    const updatedItem = {
      ...originalItem,
      [colKey]: newValue
    };

    onUpdate(updatedItem);
    setEditingCell(null);
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingCell(null);
  };

  // Sum / Aggregation calculations
  const totalValue = type === 'opportunity' 
    ? items.reduce((sum, item) => sum + (item.value || 0), 0) 
    : 0;

  const avgProbability = type === 'opportunity' && items.length > 0
    ? Math.round(items.reduce((sum, item) => sum + (item.probability || 0), 0) / items.length)
    : 0;

  const completedCount = type === 'action-item'
    ? items.filter(item => item.status === 'Completed').length
    : 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200/95 overflow-hidden shadow-sm flex flex-col">
      {/* Excel Sheet Action Bar */}
      <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200/80 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="p-1 bg-green-600/10 text-green-700 rounded-md">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
            {type === 'opportunity' ? 'Opportunities Sheet' : 'Action Items Sheet'}
          </span>
          <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-mono font-medium">
            GRID ACTIVE
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={onAdd}
            className="flex items-center space-x-1 px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium cursor-pointer shadow-sm shadow-green-600/10 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Row</span>
          </button>
        </div>
      </div>

      {/* Grid Table Workspace */}
      <div className="overflow-x-auto w-full">
        <table className="w-full border-collapse text-left border-spacing-0">
          <thead>
            <tr className="bg-slate-100 text-slate-600 border-b border-slate-200 select-none">
              <th className="w-12 text-center border-r border-slate-200 font-mono text-[10px] bg-slate-100/80 text-slate-400 py-2">
                #
              </th>
              {columns.map(col => (
                <th
                  key={col.key}
                  className={`${col.width} px-3 py-2 border-r border-slate-200 font-sans font-semibold text-xs text-slate-700 tracking-wide bg-slate-50/50`}
                >
                  {col.label}
                </th>
              ))}
              <th className="w-16 text-center text-xs font-semibold text-slate-600 px-2 py-2">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 2} className="px-6 py-8 text-center text-sm text-slate-400 font-medium">
                  No active spreadsheet records. Click "Add Row" to create one.
                </td>
              </tr>
            ) : (
              items.map((item, idx) => {
                const rowId = item.id;
                return (
                  <tr 
                    key={rowId} 
                    className={`hover:bg-slate-50/30 transition-colors border-b border-slate-200 group font-sans text-xs text-slate-800 ${
                      selectedRowId === rowId ? 'bg-blue-50/45 border-l-4 border-l-blue-600' : ''
                    }`}
                  >
                    {/* Row Index Number */}
                    <td className="text-center font-mono text-[10px] bg-slate-50/65 text-slate-500 border-r border-slate-200 select-none py-2.5">
                      {idx + 1}
                    </td>

                    {/* Dynamic Columns */}
                    {columns.map(col => {
                      const isSelected = selectedCell?.rowId === rowId && selectedCell?.colKey === col.key;
                      const isEditing = editingCell?.rowId === rowId && editingCell?.colKey === col.key;
                      const rawVal = item[col.key];

                      let displayVal = rawVal;
                      if (col.type === 'currency' && typeof rawVal === 'number') {
                        displayVal = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(rawVal);
                      } else if (col.type === 'percent' && typeof rawVal === 'number') {
                        displayVal = `${rawVal}%`;
                      }

                      return (
                        <td
                          key={col.key}
                          onClick={() => handleCellClick(rowId, col.key)}
                          onDoubleClick={() => handleCellDoubleClick(rowId, col.key, rawVal)}
                          className={`relative px-3 py-2 border-r border-slate-200 cursor-cell transition-all min-h-[36px] ${
                            isSelected ? 'ring-2 ring-blue-500 ring-inset bg-blue-50/10' : ''
                          }`}
                        >
                          {isEditing ? (
                            <div className="absolute inset-0 flex items-center bg-white z-10 px-1">
                              {col.type === 'select' ? (
                                <select
                                  value={editingCell.val}
                                  onChange={(e) => setEditingCell({ ...editingCell, val: e.target.value })}
                                  onBlur={() => handleSaveEdit(rowId, col.key)}
                                  className="w-full text-xs border border-blue-500 rounded p-1 bg-white focus:outline-none"
                                  autoFocus
                                >
                                  {col.options?.map((opt: string) => (
                                    <option key={opt} value={opt}>
                                      {opt}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  type={col.type === 'currency' || col.type === 'percent' ? 'number' : col.type}
                                  value={editingCell.val}
                                  onChange={(e) => setEditingCell({ ...editingCell, val: e.target.value })}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveEdit(rowId, col.key);
                                    if (e.key === 'Escape') handleCancelEdit();
                                  }}
                                  onBlur={() => handleSaveEdit(rowId, col.key)}
                                  className="w-full text-xs border border-blue-500 rounded px-2 py-0.5 focus:outline-none font-sans"
                                  autoFocus
                                />
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              {col.key === 'stage' ? (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ${
                                  rawVal === 'Won' ? 'bg-green-100 text-green-700' :
                                  rawVal === 'Negotiation' ? 'bg-blue-100 text-blue-700' :
                                  rawVal === 'Proposal' ? 'bg-purple-100 text-purple-700' :
                                  rawVal === 'Qualified' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-slate-100 text-slate-700'
                                }`}>
                                  {displayVal}
                                </span>
                              ) : col.key === 'status' ? (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ${
                                  rawVal === 'Completed' ? 'bg-green-100 text-green-700' :
                                  rawVal === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                                  rawVal === 'Blocked' ? 'bg-red-100 text-red-700' :
                                  'bg-slate-100 text-slate-700'
                                }`}>
                                  {displayVal}
                                </span>
                              ) : col.key === 'priority' ? (
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  rawVal === 'High' ? 'text-red-600 bg-red-50' :
                                  rawVal === 'Medium' ? 'text-orange-600 bg-orange-50' :
                                  'text-green-600 bg-green-50'
                                }`}>
                                  {displayVal}
                                </span>
                              ) : (
                                <span className="truncate max-w-full font-medium">{displayVal}</span>
                              )}
                              
                              {/* Inline Hint */}
                              <span className="hidden group-hover:block text-[10px] text-slate-400 absolute right-1">
                                ✎
                              </span>
                            </div>
                          )}
                        </td>
                      );
                    })}

                    {/* Actions Cell */}
                    <td className="text-center py-2 px-1 border-r border-slate-200">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(rowId);
                        }}
                        className="text-slate-400 hover:text-red-500 p-1 rounded hover:bg-red-50 cursor-pointer transition-colors"
                        title="Delete record row"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}

            {/* Calculations and Aggregate Excel Row */}
            {items.length > 0 && (
              <tr className="bg-slate-50/80 font-mono text-[11px] font-semibold text-slate-600 border-b border-slate-200 select-none">
                <td className="text-center border-r border-slate-200 bg-slate-100 text-slate-400 py-2">
                  Σ
                </td>
                {columns.map((col, idx) => {
                  if (idx === 0) {
                    return (
                      <td key={col.key} className="px-3 py-2 border-r border-slate-200 font-sans font-bold text-slate-600">
                        {type === 'opportunity' ? 'TOTAL / AVERAGE SUMMARY' : 'AGGREGATE SUMMARY'}
                      </td>
                    );
                  }
                  
                  if (type === 'opportunity' && col.key === 'value') {
                    return (
                      <td key={col.key} className="px-3 py-2 border-r border-slate-200 text-slate-900 font-bold">
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(totalValue)}
                      </td>
                    );
                  }

                  if (type === 'opportunity' && col.key === 'probability') {
                    return (
                      <td key={col.key} className="px-3 py-2 border-r border-slate-200 text-slate-900">
                        Avg: {avgProbability}%
                      </td>
                    );
                  }

                  if (type === 'action-item' && col.key === 'status') {
                    return (
                      <td key={col.key} className="px-3 py-2 border-r border-slate-200 text-green-700">
                        Done: {completedCount} / {items.length} ({Math.round((completedCount / items.length) * 100)}%)
                      </td>
                    );
                  }

                  return (
                    <td key={col.key} className="px-3 py-2 border-r border-slate-200 bg-slate-50/50">
                      -
                    </td>
                  );
                })}
                <td className="bg-slate-100"></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="bg-slate-100 px-4 py-1.5 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500 font-mono">
        <div>🔍 Double-click any grid cell to edit inline. Changes are auto-saved.</div>
        <div>Rows Count: {items.length}</div>
      </div>
    </div>
  );
};
