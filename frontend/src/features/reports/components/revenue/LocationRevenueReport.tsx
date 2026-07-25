/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { MapPin, Table2 } from 'lucide-react';
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
import { buildLocationRevenueRows, toLocationRevenueSection, LocationRevenueRow } from '../../utils/revenueReportCalculations';
import type { Opportunity } from '@/types';

export interface LocationRevenueReportProps {
  opportunities: Opportunity[];
  periodLabel: string;
  accountLabel: string;
  loading: boolean;
  formatCurrency: (n: number) => string;
}

const CHART_TOP_N = 8;

export const LocationRevenueReport: React.FC<LocationRevenueReportProps> = ({
  opportunities,
  periodLabel,
  accountLabel,
  loading,
  formatCurrency,
}) => {
  const rows = useMemo(() => buildLocationRevenueRows(opportunities), [opportunities]);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<keyof LocationRevenueRow>('pipelineValue');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const handleSort = (field: keyof LocationRevenueRow) => {
    if (sortField === field) setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredRows = rows.filter((r) => r.location.toLowerCase().includes(search.toLowerCase()));
  const sortedRows = [...filteredRows].sort((a, b) => compareForSort(a[sortField], b[sortField], sortDirection));
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = sortedRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Chart shows the top N locations by pipeline value, folding the remainder
  // into "Other" so the bar chart stays readable — the table below always
  // lists every location, unfolded.
  const chartData = useMemo(() => {
    const sorted = [...rows].sort((a, b) => b.pipelineValue - a.pipelineValue);
    const top = sorted.slice(0, CHART_TOP_N);
    const rest = sorted.slice(CHART_TOP_N);
    const bars = top.map((r) => ({ label: r.location, value: r.pipelineValue, color: SEQUENTIAL_CHART_COLOR }));
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
      title: 'Location-wise Revenue Report',
      subtitle: `${periodLabel} · ${accountLabel}`,
      fileName: buildExportFileName('location-revenue', periodLabel, accountLabel),
      sections: [toLocationRevenueSection(rows)],
    }).catch((err) => console.error('[Reports] Location export failed:', err));
  };
  const handleExportXlsx = () => {
    exportReportToXlsx({
      title: 'Location-wise Revenue Report',
      subtitle: `${periodLabel} · ${accountLabel}`,
      fileName: buildExportFileName('location-revenue', periodLabel, accountLabel),
      sections: [toLocationRevenueSection(rows)],
    }).catch((err) => console.error('[Reports] Location export failed:', err));
  };

  if (loading) return <TableSkeleton rows={5} />;

  return (
    <Card
      title="Location-wise Revenue"
      subtitle="Opportunity revenue grouped by deal location, ranked highest first"
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
          icon={<MapPin className="w-6 h-6 text-slate-400" aria-hidden="true" />}
          title="No opportunities match the current filters"
          hint="Adjust the report filters above to see location-wise revenue."
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
        title="Location-wise Revenue — Details"
        icon={<MapPin className="w-5 h-5 text-blue-600" aria-hidden="true" />}
        maxWidth="max-w-4xl"
      >
        <div className="p-4 border-b border-slate-100">
          <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search locations..." />
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHead>
              <TableHeadCell>
                <SortableHeader label="Location" field="location" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
              </TableHeadCell>
              <TableHeadCell align="right">
                <SortableHeader label="Total Opps" field="totalOpportunities" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
              </TableHeadCell>
              <TableHeadCell align="right">
                <SortableHeader label="Won Opps" field="wonOpportunities" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
              </TableHeadCell>
              <TableHeadCell align="right">
                <SortableHeader label="Pipeline Value" field="pipelineValue" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
              </TableHeadCell>
              <TableHeadCell align="right">
                <SortableHeader label="Revenue" field="revenue" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
              </TableHeadCell>
              <TableHeadCell align="right">
                <SortableHeader label="Forecast Revenue" field="forecastRevenue" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
              </TableHeadCell>
            </TableHead>
            <tbody>
              {pagedRows.length === 0 ? (
                <EmptyRow colSpan={6} message="No locations match your search." />
              ) : (
                pagedRows.map((r) => (
                  <TableRow key={r.location}>
                    <TableCell className="font-bold text-slate-700">{r.location}</TableCell>
                    <TableCell align="right" className="font-mono">{r.totalOpportunities}</TableCell>
                    <TableCell align="right" className="font-mono">{r.wonOpportunities}</TableCell>
                    <TableCell align="right" className="font-mono font-bold text-slate-900">{formatCurrency(r.pipelineValue)}</TableCell>
                    <TableCell align="right" className="font-mono text-emerald-600 font-bold">{formatCurrency(r.revenue)}</TableCell>
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
          itemLabel="locations"
        />
      </Modal>
    </Card>
  );
};
