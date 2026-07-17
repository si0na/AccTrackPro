import React from 'react';
import type { ColumnConfig, CustomColumn } from '@/types';
import { INPUT_CLS } from '@/components/ui';

export interface CustomColumnFieldsProps {
  /** All custom columns defined for the module. */
  columns: CustomColumn[];
  /** The module's column config — only columns displayed there are rendered. */
  config: ColumnConfig[];
  /** Current form values keyed by column key. */
  values: Record<string, any>;
  /** Called with the column key and its new value. */
  onChange: (key: string, value: any) => void;
}

/**
 * "Custom Fields" section for create forms. Renders an input per active custom
 * column (hidden columns from Customize Columns are excluded), typed by the
 * column definition. Values are written straight onto the entity payload, so
 * the backend stores them in `custom_data` exactly as before.
 */
export const CustomColumnFields: React.FC<CustomColumnFieldsProps> = ({
  columns,
  config,
  values,
  onChange,
}) => {
  const visibleCols = columns.filter(
    (col) => config.find((c) => c.key === col.key)?.isDisplayed,
  );
  if (visibleCols.length === 0) return null;

  return (
    <div className="pt-2 space-y-3 text-xs">
      <h4 className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <span className="w-1 h-3.5 rounded-full bg-indigo-500 shrink-0" aria-hidden="true" />
        <span className="text-label font-bold text-slate-700 uppercase tracking-wider">Custom Fields</span>
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleCols.map((col) => {
          const rawVal = values[col.key] ?? (col.type === 'boolean' ? false : '');
          return (
            <div key={col.id} className="space-y-1">
              <label className="font-bold text-slate-600 uppercase tracking-wide">{col.name}</label>
              {col.type === 'boolean' ? (
                <div className="flex items-center h-8">
                  <input
                    type="checkbox"
                    checked={!!rawVal}
                    onChange={(e) => onChange(col.key, e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-xs font-medium text-slate-500 ml-2">Active / Yes</span>
                </div>
              ) : col.type === 'number' ? (
                <input
                  type="number"
                  placeholder="Enter number"
                  value={rawVal ?? ''}
                  onChange={(e) => onChange(col.key, e.target.value === '' ? '' : Number(e.target.value))}
                  className={INPUT_CLS}
                />
              ) : col.type === 'date' ? (
                <input
                  type="date"
                  value={rawVal ?? ''}
                  onChange={(e) => onChange(col.key, e.target.value)}
                  className={`${INPUT_CLS} font-mono`}
                />
              ) : (
                <input
                  type="text"
                  placeholder="Enter text value"
                  value={rawVal ?? ''}
                  onChange={(e) => onChange(col.key, e.target.value)}
                  className={INPUT_CLS}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
