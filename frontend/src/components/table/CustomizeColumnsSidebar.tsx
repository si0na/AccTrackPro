/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { ColumnConfig } from '@/types';
import { 
  X, Pin, Search, ArrowUp, ArrowDown, GripVertical, 
  RotateCcw, Check, Plus, Settings2, Trash2, Calendar, 
  Hash, Type, CheckSquare, Sparkles 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CustomizeColumnsSidebarProps {
  module: 'accounts' | 'opportunities' | 'actionItems' | 'performanceEvaluation';
  isOpen: boolean;
  onClose: () => void;
}

export const CustomizeColumnsSidebar: React.FC<CustomizeColumnsSidebarProps> = ({
  module,
  isOpen,
  onClose
}) => {
  const {
    accountsColumnConfig,
    opportunitiesColumnConfig,
    actionItemsColumnConfig,
    performanceEvaluationColumnConfig,
    updateColumnConfig,
    resetColumnConfig,
    addCustomColumn,
    deleteCustomColumn,
    accountColumns,
    opportunityColumns,
    actionItemColumns,
    performanceEvaluationColumns
  } = useCRM();

  // Active configurations from Context
  const activeConfig = useMemo(() => {
    if (module === 'accounts') return accountsColumnConfig;
    if (module === 'opportunities') return opportunitiesColumnConfig;
    if (module === 'actionItems') return actionItemsColumnConfig;
    return performanceEvaluationColumnConfig;
  }, [module, accountsColumnConfig, opportunitiesColumnConfig, actionItemsColumnConfig, performanceEvaluationColumnConfig]);

  // Local temp copy for changes inside sidebar before clicking "Apply"
  const [tempColumns, setTempColumns] = useState<ColumnConfig[]>([]);
  const [activeTab, setActiveTab] = useState<'columns' | 'arrange'>('columns');
  const [searchQuery, setSearchQuery] = useState('');

  // Add Custom Column collapsed form state
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColType, setNewColType] = useState<'text' | 'number' | 'date' | 'boolean'>('text');
  const [colAddSuccess, setColAddSuccess] = useState(false);

  // Sync active configuration to local temp state on opening
  useEffect(() => {
    if (isOpen) {
      setTempColumns([...activeConfig]);
      setActiveQueryState();
    }
  }, [isOpen, activeConfig]);

  const setActiveQueryState = () => {
    setSearchQuery('');
    setIsAddFormOpen(false);
    setNewColName('');
    setNewColType('text');
  };

  // Filter columns based on search
  const filteredColumns = useMemo(() => {
    if (!searchQuery.trim()) return tempColumns;
    return tempColumns.filter(col => 
      col.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [tempColumns, searchQuery]);

  // Separate column lists
  const pinnedColumns = useMemo(() => {
    return filteredColumns.filter(c => c.isDisplayed && c.isPinned);
  }, [filteredColumns]);

  const displayedColumns = useMemo(() => {
    return filteredColumns.filter(c => c.isDisplayed && !c.isPinned);
  }, [filteredColumns]);

  const availableColumns = useMemo(() => {
    return filteredColumns.filter(c => !c.isDisplayed);
  }, [filteredColumns]);

  // Toggling display checkmark
  const handleToggleDisplay = (key: string) => {
    setTempColumns(prev => prev.map(c => {
      if (c.key === key) {
        const nextDisplayed = !c.isDisplayed;
        return {
          ...c,
          isDisplayed: nextDisplayed,
          // Unpin if hidden
          isPinned: nextDisplayed ? c.isPinned : false
        };
      }
      return c;
    }));
  };

  // Toggling pinned state
  const handleTogglePin = (key: string) => {
    setTempColumns(prev => prev.map(c => {
      if (c.key === key) {
        const nextPinned = !c.isPinned;
        return {
          ...c,
          isPinned: nextPinned,
          // If we pin it, we must display it!
          isDisplayed: nextPinned ? true : c.isDisplayed
        };
      }
      return c;
    }));
  };

  // Reordering Columns (Up / Down)
  const handleMoveColumn = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= tempColumns.length) return;

    const updated = [...tempColumns];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    setTempColumns(updated);
  };

  // Add custom column handler
  const handleCreateColumn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColName.trim()) return;

    const key = `custom_${newColName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
    
    // Add to main context state
    addCustomColumn(module, newColName.trim(), newColType);

    // Add to temp state directly so it shows up instantly in the sidebar list!
    const newConfig: ColumnConfig = {
      key,
      name: newColName.trim(),
      isStandard: false,
      isPinned: false,
      isDisplayed: true,
      type: newColType as any
    };

    setTempColumns(prev => [...prev, newConfig]);
    setNewColName('');
    setNewColType('text');
    setColAddSuccess(true);
    setTimeout(() => setColAddSuccess(false), 2500);
  };

  // Delete custom column
  const handleDeleteCustomCol = (key: string) => {
    // Find the original custom column in Context
    const customList =
      module === 'accounts' ? accountColumns :
      module === 'opportunities' ? opportunityColumns :
      module === 'actionItems' ? actionItemColumns :
      performanceEvaluationColumns;

    const col = customList.find(c => c.key === key);
    if (col) {
      deleteCustomColumn(module, col.id);
      // Also remove from local temp list
      setTempColumns(prev => prev.filter(c => c.key !== key));
    }
  };

  // Reset to Default
  const handleResetToDefault = () => {
    resetColumnConfig(module);
    onClose();
  };

  // Apply changes
  const handleApply = () => {
    updateColumnConfig(module, tempColumns);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900 z-40 transition-opacity"
          />

          {/* Sidebar Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="customize-columns-title"
            onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
            tabIndex={-1}
            className="fixed inset-y-0 right-0 w-full max-w-[420px] bg-white shadow-2xl z-50 flex flex-col h-full border-l border-slate-200"
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 id="customize-columns-title" className="text-base font-black text-slate-800 flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-blue-600" aria-hidden="true" />
                  <span>Customize Columns</span>
                </h3>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
                  For {
                    module === 'accounts' ? 'Accounts List' :
                    module === 'opportunities' ? 'Opportunities List' :
                    module === 'actionItems' ? 'Action Items' :
                    'Performance Evaluations'
                  }
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs & Search */}
            <div className="px-5 pt-3 pb-2 space-y-3">
              {/* Tabs */}
              <div className="flex border-b border-slate-100 text-xs font-bold text-slate-500">
                <button
                  onClick={() => setActiveTab('columns')}
                  className={`flex-1 pb-2 text-center border-b-2 transition-all cursor-pointer ${
                    activeTab === 'columns' 
                      ? 'border-blue-600 text-blue-600 font-extrabold' 
                      : 'border-transparent hover:text-slate-800'
                  }`}
                >
                  Columns
                </button>
                <button
                  onClick={() => setActiveTab('arrange')}
                  className={`flex-1 pb-2 text-center border-b-2 transition-all cursor-pointer ${
                    activeTab === 'arrange' 
                      ? 'border-blue-600 text-blue-600 font-extrabold' 
                      : 'border-transparent hover:text-slate-800'
                  }`}
                >
                  Arrange
                </button>
              </div>

              {/* Add New Custom Column collapsed trigger */}
              <div className="border border-blue-100 bg-blue-50/50 rounded-xl overflow-hidden">
                <button
                  onClick={() => setIsAddFormOpen(!isAddFormOpen)}
                  className="w-full px-4 py-2 flex items-center justify-between text-xs font-extrabold text-blue-700 hover:bg-blue-100/50 transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Create Custom Column</span>
                  </span>
                  <span>{isAddFormOpen ? 'Hide' : 'Add Column +'}</span>
                </button>
                
                <AnimatePresence>
                  {isAddFormOpen && (
                    <motion.form
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      onSubmit={handleCreateColumn}
                      className="px-4 pb-4 border-t border-blue-100/60 bg-white space-y-3 pt-3"
                    >
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Column Name</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Region, Priority"
                            value={newColName}
                            onChange={(e) => setNewColName(e.target.value)}
                            className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Field Type</label>
                          <select
                            value={newColType}
                            onChange={(e) => setNewColType(e.target.value as any)}
                            className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
                          >
                            <option value="text">Text (ABC)</option>
                            <option value="number">Number (123)</option>
                            <option value="date">Date (📅)</option>
                            <option value="boolean">Checkbox (☑)</option>
                          </select>
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Column</span>
                      </button>

                      {colAddSuccess && (
                        <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-green-600">
                          <Check className="w-3.5 h-3.5" />
                          <span>Column created successfully!</span>
                        </div>
                      )}
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>

              {/* Search bar (only on Columns tab) */}
              {activeTab === 'columns' && (
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search columns..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full text-xs pl-9 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 bg-slate-50/50"
                  />
                </div>
              )}
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto px-5 py-2 space-y-5">
              {activeTab === 'columns' ? (
                <>
                  {/* 1. Pinned Columns */}
                  <div>
                    <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
                      <Pin className="w-3 h-3 text-blue-500 rotate-45" />
                      <span>Pinned Columns ({pinnedColumns.length})</span>
                    </h4>
                    {pinnedColumns.length === 0 ? (
                      <div className="text-[11px] text-slate-400 italic py-1 px-2">No columns pinned.</div>
                    ) : (
                      <div className="space-y-1.5">
                        {pinnedColumns.map(col => (
                          <div
                            key={col.key}
                            className="flex items-center justify-between px-3 py-2 border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-all text-xs"
                          >
                            <div className="flex items-center gap-2.5">
                              <input
                                type="checkbox"
                                checked={col.isDisplayed}
                                onChange={() => handleToggleDisplay(col.key)}
                                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                              />
                              <GripVertical className="w-3.5 h-3.5 text-slate-300 shrink-0 cursor-default" />
                              <span className="font-bold text-slate-700">{col.name}</span>
                              {!col.isStandard && (
                                <span className="bg-amber-100 text-amber-700 text-[8px] px-1.5 py-0.5 rounded-full font-bold">Custom</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleTogglePin(col.key)}
                                className="p-1 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                title="Unpin Column"
                              >
                                <Pin className="w-3.5 h-3.5 fill-blue-600" />
                              </button>
                              {!col.isStandard && (
                                <button
                                  onClick={() => handleDeleteCustomCol(col.key)}
                                  className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                  title="Delete Custom Column"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 2. Displayed Columns */}
                  <div>
                    <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-2">
                      Displayed Columns ({displayedColumns.length})
                    </h4>
                    {displayedColumns.length === 0 ? (
                      <div className="text-[11px] text-slate-400 italic py-1 px-2">No other columns displayed.</div>
                    ) : (
                      <div className="space-y-1.5">
                        {displayedColumns.map(col => (
                          <div
                            key={col.key}
                            className="flex items-center justify-between px-3 py-2 border border-slate-150 rounded-xl bg-white hover:bg-slate-50/50 transition-all text-xs"
                          >
                            <div className="flex items-center gap-2.5">
                              <input
                                type="checkbox"
                                checked={col.isDisplayed}
                                onChange={() => handleToggleDisplay(col.key)}
                                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                              />
                              <GripVertical className="w-3.5 h-3.5 text-slate-300 shrink-0 cursor-default" />
                              <span className="font-bold text-slate-700">{col.name}</span>
                              {!col.isStandard && (
                                <span className="bg-amber-100 text-amber-700 text-[8px] px-1.5 py-0.5 rounded-full font-bold">Custom</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleTogglePin(col.key)}
                                className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                title="Pin Column to Front"
                              >
                                <Pin className="w-3.5 h-3.5" />
                              </button>
                              {!col.isStandard && (
                                <button
                                  onClick={() => handleDeleteCustomCol(col.key)}
                                  className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                  title="Delete Custom Column"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 3. Available Columns */}
                  <div>
                    <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-2">
                      Available Columns ({availableColumns.length})
                    </h4>
                    {availableColumns.length === 0 ? (
                      <div className="text-[11px] text-slate-400 italic py-2 px-2">No hidden columns available.</div>
                    ) : (
                      <div className="space-y-1.5">
                        {availableColumns.map(col => (
                          <div
                            key={col.key}
                            className="flex items-center justify-between px-3 py-2 border border-slate-150/70 rounded-xl bg-slate-50/30 hover:bg-slate-50/80 transition-all text-xs opacity-75 hover:opacity-100"
                          >
                            <div className="flex items-center gap-2.5">
                              <input
                                type="checkbox"
                                checked={col.isDisplayed}
                                onChange={() => handleToggleDisplay(col.key)}
                                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                              />
                              <GripVertical className="w-3.5 h-3.5 text-slate-200 shrink-0 cursor-default" />
                              <span className="font-bold text-slate-500">{col.name}</span>
                              {!col.isStandard && (
                                <span className="bg-amber-100 text-amber-700 text-[8px] px-1.5 py-0.5 rounded-full font-bold">Custom</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleTogglePin(col.key)}
                                className="p-1 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                title="Pin Column"
                              >
                                <Pin className="w-3.5 h-3.5 text-slate-300" />
                              </button>
                              {!col.isStandard && (
                                <button
                                  onClick={() => handleDeleteCustomCol(col.key)}
                                  className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                  title="Delete Custom Column"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* ARRANGE TAB: Reordering list */
                <div className="space-y-3">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] leading-relaxed text-slate-500">
                    <p className="font-bold text-slate-700">Arranging Column Order</p>
                    <p className="mt-0.5">Use the up and down arrow controls to rearrange column placement on the main table grid. Columns at the top will be placed further to the left.</p>
                  </div>

                  <div className="space-y-1.5">
                    {tempColumns.map((col, index) => (
                      <div
                        key={col.key}
                        className={`flex items-center justify-between px-3 py-2 border rounded-xl text-xs font-bold transition-all ${
                          col.isDisplayed 
                            ? 'bg-white border-slate-200 text-slate-700' 
                            : 'bg-slate-50/50 border-slate-150 text-slate-400 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-slate-300 text-[10px] font-mono w-4 text-center">
                            {index + 1}
                          </span>
                          <span className="truncate max-w-[180px]">{col.name}</span>
                          {col.isPinned && (
                            <Pin className="w-3 h-3 text-blue-500 fill-blue-500 shrink-0" />
                          )}
                          {!col.isDisplayed && (
                            <span className="text-[9px] font-normal text-slate-400 bg-slate-100 px-1 py-0.5 rounded">Hidden</span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => handleMoveColumn(index, 'up')}
                            className="p-1 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 hover:text-slate-800 disabled:opacity-20 disabled:hover:bg-transparent transition-colors cursor-pointer"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={index === tempColumns.length - 1}
                            onClick={() => handleMoveColumn(index, 'down')}
                            className="p-1 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 hover:text-slate-800 disabled:opacity-20 disabled:hover:bg-transparent transition-colors cursor-pointer"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer buttons */}
            <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
              <button
                onClick={handleResetToDefault}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-600 hover:text-slate-800 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Default</span>
              </button>
              <button
                onClick={handleApply}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/10 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Apply</span>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
