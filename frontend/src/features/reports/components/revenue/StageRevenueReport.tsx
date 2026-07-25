/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { Filter as FilterIcon, Table2 } from 'lucide-react';
import {
  Card,
  Modal,
  Table,
  TableHead,
  TableHeadCell,
  TableCell,
  TableRow,
  SortableHeader,
  SearchBar,
  Pagination,
  EmptyState,
  EmptyRow,
  TableSkeleton,
  Button,
} from '@/components/ui';
import { HorizontalBarChart, SEQUENTIAL_CHART_COLOR } from '@/components/ui/charts';
import { OPPORTUNITY_STAGE_STYLE } from '@/constants';
import { compareForSort, SortDirection } from '@/utils';
import { exportReportToPdf, exportReportToXlsx, buildExportFileName } from '@/utils/exportReport';
import { ReportExportMenu } from '../ReportExportMenu';
import { buildStageRevenueRows, toStageRevenueSection, StageRevenueRow } from '../../utils/revenueReportCalculations';
import type { Opportunity } from '@/types';

export interface StageRevenueReportProps {
  opportunities: Opportunity[];
  periodLabel: string;
  accountLabel: string;
  loading: boolean;
  formatCurrency: (n: number) => string;
}

export const StageRevenueReport: React.FC<StageRevenueReportProps> = ({
  opportunities,
  periodLabel,
  accountLabel,
  loading,
  formatCurrency,
}) => {
  const rows = useMemo(() => buildStageRevenueRows(opportunities), [opportunities]);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<keyof StageRevenueRow>('pipelineValue');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const handleSort = (field: keyof StageRevenueRow) => {
    if (sortField === field) setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredRows = rows.filter((r) => r.stage.toLowerCase().includes(search.toLowerCase()));
  const sortedRows = [...filteredRows].sort((a, b) => compareForSort(a[sortField], b[sortField], sortDirection));
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = sortedRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Ranked bar — highest-value stage on top, same flat blue used across every
  // Revenue Report chart so color never competes with the ranking itself.
  const chartData = useMemo(
    () =>
      rows
        .filter((r) => r.opportunityCount > 0)
        .sort((a, b) => b.pipelineValue - a.pipelineValue)
        .map((r) => ({ label: r.stage, value: r.pipelineValue, color: SEQUENTIAL_CHART_COLOR })),
    [rows],
  );

  const handleExportPdf = () => {
    exportReportToPdf({
      title: 'Stage-wise Revenue Report',
      subtitle: `${periodLabel} · ${accountLabel}`,
      fileName: buildExportFileName('stage-revenue', periodLabel, accountLabel),
      sections: [toStageRevenueSection(rows)],
    }).catch((err) => console.error('[Reports] Stage export failed:', err));
  };
  const handleExportXlsx = () => {
    exportReportToXlsx({
      title: 'Stage-wise Revenue Report',
      subtitle: `${periodLabel} · ${accountLabel}`,
      fileName: buildExportFileName('stage-revenue', periodLabel, accountLabel),
      sections: [toStageRevenueSection(rows)],
    }).catch((err) => console.error('[Reports] Stage export failed:', err));
  };

  if (loading) return <TableSkeleton rows={5} />;

  return (
    <Card
      title="Stage-wise Revenue"
      subtitle="Opportunity revenue grouped by pipeline stage, ranked highest first"
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="xs"
            icon={<Table2 className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />}
            onClick={() => setDetailsOpen(true)}
            disabled={rows.every((r) => r.opportunityCount === 0)}
          >
            View Details
          </Button>
          <ReportExportMenu onExportPdf={handleExportPdf} onExportXlsx={handleExportXlsx} disabled={rows.every((r) => r.opportunityCount === 0)} />
        </div>
      }
      padding="none"
      clip
    >
      {chartData.length === 0 ? (
        <EmptyState
          icon={<FilterIcon className="w-6 h-6 text-slate-400" aria-hidden="true" />}
          title="No opportunities match the current filters"
          hint="Adjust the report filters above to see stage-wise revenue."
          className="p-6"
        />
      ) : (
        <div className="p-5">
          <HorizontalBarChart
            data={chartData}
            valueFormatter={formatCurrency}
            valueLabel="Pipeline Value"
            height={Math.max(220, chartData.length * 48)}
            labelWidth={140}
          />
        </div>
      )}

      <Modal
        isOpen={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        title="Stage-wise Revenue — Details"
        icon={<FilterIcon className="w-5 h-5 text-blue-600" aria-hidden="true" />}
        maxWidth="max-w-4xl"
      >
        <div className="p-4 border-b border-slate-100">
          <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search stages..." />
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHead>
              <TableHeadCell>
                <SortableHeader label="Stage" field="stage" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
              </TableHeadCell>
              <TableHeadCell align="right">
                <SortableHeader label="Opp Count" field="opportunityCount" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
              </TableHeadCell>
              <TableHeadCell align="right">
                <SortableHeader label="Pipeline Value" field="pipelineValue" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
              </TableHeadCell>
              <TableHeadCell align="right">
                <SortableHeader label="Revenue" field="revenue" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
              </TableHeadCell>
              <TableHeadCell align="right">
                <SortableHeader label="Avg Probability" field="averageProbability" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
              </TableHeadCell>
              <TableHeadCell align="right">
                <SortableHeader label="Forecast Revenue" field="forecastRevenue" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
              </TableHeadCell>
            </TableHead>
            <tbody>
              {pagedRows.length === 0 ? (
                <EmptyRow colSpan={6} message="No stages match your search." />
              ) : (
                pagedRows.map((r) => (
                  <TableRow key={r.stage}>
                    <TableCell className="font-bold text-slate-700">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: OPPORTUNITY_STAGE_STYLE[r.stage].hex }} />
                        {r.stage}
                      </span>
                    </TableCell>
                    <TableCell align="right" className="font-mono">{r.opportunityCount}</TableCell>
                    <TableCell align="right" className="font-mono font-bold text-slate-900">{formatCurrency(r.pipelineValue)}</TableCell>
                    <TableCell align="right" className="font-mono text-emerald-600 font-bold">{formatCurrency(r.revenue)}</TableCell>
                    <TableCell align="right" className="font-mono">{Math.round(r.averageProbability)}%</TableCell>
                    <TableCell align="right" className="font-mono">{formatCurrency(r.forecastRevenue)}</TableCell>
                  </TableRow>
                ))
              )}
            </tbody>
          </Table>
        </div>
        <Pagination
          page={currentPage}
          pageSize={pageSize}
          totalItems={sortedRows.length}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          itemLabel="stages"
        />
      </Modal>
    </Card>
  );
};
