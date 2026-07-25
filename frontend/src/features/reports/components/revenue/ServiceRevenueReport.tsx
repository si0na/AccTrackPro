/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { Layers, Table2 } from 'lucide-react';
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
import { HorizontalBarChart, SEQUENTIAL_CHART_COLOR, OTHER_CATEGORY_COLOR } from '@/components/ui/charts';
import { compareForSort, SortDirection } from '@/utils';
import { exportReportToPdf, exportReportToXlsx, buildExportFileName } from '@/utils/exportReport';
import { ReportExportMenu } from '../ReportExportMenu';
import { buildServiceRevenueRows, toServiceRevenueSection, ServiceRevenueRow } from '../../utils/revenueReportCalculations';
import type { Opportunity } from '@/types';

export interface ServiceRevenueReportProps {
  opportunities: Opportunity[];
  periodLabel: string;
  accountLabel: string;
  loading: boolean;
  formatCurrency: (n: number) => string;
}

const CHART_TOP_N = 8;

export const ServiceRevenueReport: React.FC<ServiceRevenueReportProps> = ({
  opportunities,
  periodLabel,
  accountLabel,
  loading,
  formatCurrency,
}) => {
  const rows = useMemo(() => buildServiceRevenueRows(opportunities), [opportunities]);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<keyof ServiceRevenueRow>('pipelineValue');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const handleSort = (field: keyof ServiceRevenueRow) => {
    if (sortField === field) setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredRows = rows.filter((r) => r.serviceLine.toLowerCase().includes(search.toLowerCase()));
  const sortedRows = [...filteredRows].sort((a, b) => compareForSort(a[sortField], b[sortField], sortDirection));
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = sortedRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Chart shows the top N service lines by pipeline value, folding the
  // remainder into "Other" — the table always lists every service line,
  // unfolded. One flat hue throughout, consistent with every other Revenue
  // Report chart, since a ranked bar needs length (not color) to carry meaning.
  const chartData = useMemo(() => {
    const sorted = [...rows].sort((a, b) => b.pipelineValue - a.pipelineValue);
    const top = sorted.slice(0, CHART_TOP_N);
    const rest = sorted.slice(CHART_TOP_N);
    const bars = top.map((r) => ({ label: r.serviceLine, value: r.pipelineValue, color: SEQUENTIAL_CHART_COLOR }));
    if (rest.length > 0) {
      bars.push({
        label: `Other (${rest.length})`,
        value: rest.reduce((sum, r) => sum + r.pipelineValue, 0),
        color: OTHER_CATEGORY_COLOR,
      });
    }
    return bars;
  }, [rows]);

  const handleExportPdf = () => {
    exportReportToPdf({
      title: 'Service-wise Revenue Report',
      subtitle: `${periodLabel} · ${accountLabel}`,
      fileName: buildExportFileName('service-revenue', periodLabel, accountLabel),
      sections: [toServiceRevenueSection(rows)],
    }).catch((err) => console.error('[Reports] Service export failed:', err));
  };
  const handleExportXlsx = () => {
    exportReportToXlsx({
      title: 'Service-wise Revenue Report',
      subtitle: `${periodLabel} · ${accountLabel}`,
      fileName: buildExportFileName('service-revenue', periodLabel, accountLabel),
      sections: [toServiceRevenueSection(rows)],
    }).catch((err) => console.error('[Reports] Service export failed:', err));
  };

  if (loading) return <TableSkeleton rows={5} />;

  return (
    <Card
      title="Service-wise Revenue"
      subtitle="Opportunity revenue grouped by service line, ranked highest first"
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="xs"
            icon={<Table2 className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />}
            onClick={() => setDetailsOpen(true)}
            disabled={rows.length === 0}
          >
            View Details
          </Button>
          <ReportExportMenu onExportPdf={handleExportPdf} onExportXlsx={handleExportXlsx} disabled={rows.length === 0} />
        </div>
      }
      padding="none"
      clip
    >
      {rows.length === 0 ? (
        <EmptyState
          icon={<Layers className="w-6 h-6 text-slate-400" aria-hidden="true" />}
          title="No opportunities match the current filters"
          hint="Adjust the report filters above to see service-wise revenue."
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
        title="Service-wise Revenue — Details"
        icon={<Layers className="w-5 h-5 text-blue-600" aria-hidden="true" />}
        maxWidth="max-w-4xl"
      >
        <div className="p-4 border-b border-slate-100">
          <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search service lines..." />
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHead>
              <TableHeadCell>
                <SortableHeader label="Service" field="serviceLine" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
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
                <SortableHeader label="Avg Deal Size" field="averageDealSize" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
              </TableHeadCell>
            </TableHead>
            <tbody>
              {pagedRows.length === 0 ? (
                <EmptyRow colSpan={5} message="No service lines match your search." />
              ) : (
                pagedRows.map((r) => (
                  <TableRow key={r.serviceLine}>
                    <TableCell className="font-bold text-slate-700">{r.serviceLine}</TableCell>
                    <TableCell align="right" className="font-mono">{r.opportunityCount}</TableCell>
                    <TableCell align="right" className="font-mono font-bold text-slate-900">{formatCurrency(r.pipelineValue)}</TableCell>
                    <TableCell align="right" className="font-mono text-emerald-600 font-bold">{formatCurrency(r.revenue)}</TableCell>
                    <TableCell align="right" className="font-mono">{formatCurrency(r.averageDealSize)}</TableCell>
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
          itemLabel="service lines"
        />
      </Modal>
    </Card>
  );
};
