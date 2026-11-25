import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Plus,
  Link2,
  ExternalLink,
  Download,
  Eye,
  Pencil,
  Trash2,
  File as FileIcon,
  Search,
  Loader2,
} from 'lucide-react';
import type { ProjectDocumentation } from '@/types';
import { projectDocumentationApi } from '@/api/crm.api';
import { useCRM } from '@/contexts/CRMContext';
import { formatDateTime } from '@/utils';
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  RowActionButton,
  Table,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
} from '@/components/ui';
import { ProjectDocumentationModal } from './ProjectDocumentationModal';

function formatBytes(bytes?: number): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface ProjectDocumentationTabProps {
  projectId: string;
  onCountChange?: (count: number) => void;
}

export const ProjectDocumentationTab: React.FC<ProjectDocumentationTabProps> = ({
  projectId,
  onCountChange,
}) => {
  const { can } = useCRM();
  const canCreate = can('projects', 'create') || can('projects', 'update');
  const canEdit = can('projects', 'update');
  const canDelete = can('projects', 'delete');

  const [docs, setDocs] = useState<ProjectDocumentation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [busyDocId, setBusyDocId] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<ProjectDocumentation | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectDocumentation | null>(null);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await projectDocumentationApi.getAllForProject(projectId);
      setDocs(data);
      onCountChange?.(data.length);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to load project documentation';
      setError(Array.isArray(msg) ? msg.join('. ') : String(msg));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      loadDocuments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const filteredDocs = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return docs;
    return docs.filter(
      (d) =>
        d.name.toLowerCase().includes(term) ||
        (d.url && d.url.toLowerCase().includes(term)) ||
        (d.fileName && d.fileName.toLowerCase().includes(term)) ||
        (d.description && d.description.toLowerCase().includes(term)) ||
        (d.addedBy && d.addedBy.toLowerCase().includes(term)),
    );
  }, [docs, searchTerm]);

  const handleCreateUrl = async (data: { name: string; url: string; description?: string }) => {
    const created = await projectDocumentationApi.createUrl(projectId, data);
    setDocs((prev) => [created, ...prev]);
    onCountChange?.(docs.length + 1);
  };

  const handleCreateFile = async (data: { name: string; description?: string }, file: File) => {
    const created = await projectDocumentationApi.uploadFile(projectId, data, file);
    setDocs((prev) => [created, ...prev]);
    onCountChange?.(docs.length + 1);
  };

  const handleUpdate = async (
    id: string,
    data: { name?: string; url?: string; description?: string },
    replacementFile?: File | null,
  ) => {
    const updated = await projectDocumentationApi.update(projectId, id, data, replacementFile);
    setDocs((prev) => prev.map((d) => (d.id === id ? updated : d)));
  };

  const handleDelete = async (doc: ProjectDocumentation) => {
    await projectDocumentationApi.delete(projectId, doc.id);
    setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    onCountChange?.(Math.max(0, docs.length - 1));
  };

  const handleDownload = async (doc: ProjectDocumentation) => {
    if (busyDocId || !doc.fileName) return;
    setBusyDocId(doc.id);
    setError('');
    try {
      const blob = await projectDocumentationApi.getFileBlob(projectId, doc.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = doc.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setError(`Could not download "${doc.fileName}". Please try again.`);
    } finally {
      setBusyDocId(null);
    }
  };

  const handleView = async (doc: ProjectDocumentation) => {
    if (doc.type === 'URL' && doc.url) {
      window.open(doc.url, '_blank', 'noopener,noreferrer');
      return;
    }

    if (doc.type === 'FILE' && doc.fileName) {
      if (busyDocId) return;
      setBusyDocId(doc.id);
      setError('');
      try {
        const blob = await projectDocumentationApi.getFileBlob(projectId, doc.id);
        const url = URL.createObjectURL(blob);
        if (doc.mimeType === 'application/pdf' || doc.mimeType?.startsWith('image/')) {
          window.open(url, '_blank');
          setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } else {
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = doc.fileName;
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
          setTimeout(() => URL.revokeObjectURL(url), 60_000);
        }
      } catch {
        setError(`Could not open "${doc.fileName}".`);
      } finally {
        setBusyDocId(null);
      }
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError('')}
            className="text-red-500 hover:text-red-700 text-xs font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      <Card
        title={
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            <span>Project Documentation</span>
            {!loading && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {docs.length}
              </span>
            )}
          </div>
        }
        actions={
          <div className="flex items-center gap-3">
            {docs.length > 5 && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter documentation…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            )}
            {canCreate && (
              <Button
                variant="primary"
                size="sm"
                icon={<Plus className="w-4 h-4" />}
                onClick={() => {
                  setEditingDoc(null);
                  setIsModalOpen(true);
                }}
              >
                Add Documentation
              </Button>
            )}
          </div>
        }
      >
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
            <span>Loading documentation…</span>
          </div>
        ) : docs.length === 0 ? (
          <div className="py-6 flex flex-col items-center">
            <EmptyState
              icon={<FileText className="w-8 h-8 text-slate-300" aria-hidden="true" />}
              title="No project documentation yet"
              hint="Add reference URLs or upload project documents like specifications, plans, and reports."
            />
            {canCreate && (
              <Button
                variant="primary"
                size="sm"
                icon={<Plus className="w-4 h-4" />}
                onClick={() => {
                  setEditingDoc(null);
                  setIsModalOpen(true);
                }}
                className="mt-2"
              >
                Add Documentation
              </Button>
            )}
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            No documentation matched your filter "{searchTerm}".
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeadCell>Document Name</TableHeadCell>
                  <TableHeadCell>Document Type</TableHeadCell>
                  <TableHeadCell>URL or File Name</TableHeadCell>
                  <TableHeadCell>Added By</TableHeadCell>
                  <TableHeadCell>Created Date</TableHeadCell>
                  <TableHeadCell>Last Modified Date</TableHeadCell>
                  <TableHeadCell align="right">Actions</TableHeadCell>
                </TableRow>
              </TableHead>
              <tbody>
                {filteredDocs.map((doc) => {
                  const isFile = doc.type === 'FILE';
                  return (
                    <TableRow key={doc.id}>
                      {/* Document Name */}
                      <TableCell>
                        <div className="max-w-xs">
                          <p className="font-semibold text-slate-900 text-xs truncate" title={doc.name}>
                            {doc.name}
                          </p>
                          {doc.description && (
                            <p
                              className="text-[11px] text-slate-400 mt-0.5 line-clamp-1"
                              title={doc.description}
                            >
                              {doc.description}
                            </p>
                          )}
                        </div>
                      </TableCell>

                      {/* Document Type */}
                      <TableCell>
                        {doc.type === 'URL' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            <Link2 className="w-3 h-3" /> URL
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <FileIcon className="w-3 h-3" /> Uploaded File
                          </span>
                        )}
                      </TableCell>

                      {/* URL or File Name */}
                      <TableCell>
                        {doc.type === 'URL' ? (
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 hover:underline max-w-xs truncate font-mono text-[11px]"
                            title={doc.url}
                          >
                            <span className="truncate">{doc.url}</span>
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleView(doc)}
                            className="inline-flex items-center gap-1.5 text-slate-700 hover:text-indigo-600 max-w-xs truncate text-left"
                            title={doc.fileName}
                            disabled={busyDocId === doc.id}
                          >
                            <span className="truncate font-medium text-xs text-slate-800 group-hover:text-indigo-600">
                              {doc.fileName}
                            </span>
                            {doc.fileSize ? (
                              <span className="text-[10px] text-slate-400 font-normal shrink-0">
                                ({formatBytes(doc.fileSize)})
                              </span>
                            ) : null}
                          </button>
                        )}
                      </TableCell>

                      {/* Added By */}
                      <TableCell>
                        <span className="text-slate-600 text-xs">
                          {doc.addedBy || 'Unknown'}
                        </span>
                      </TableCell>

                      {/* Created Date */}
                      <TableCell>
                        <span className="text-slate-600 text-xs whitespace-nowrap">
                          {formatDateTime(doc.createdAt)}
                        </span>
                      </TableCell>

                      {/* Last Modified Date */}
                      <TableCell>
                        <span className="text-slate-600 text-xs whitespace-nowrap">
                          {formatDateTime(doc.updatedAt)}
                        </span>
                      </TableCell>

                      {/* Actions */}
                      <TableCell align="right">
                        <div className="flex items-center justify-end space-x-1">
                          <RowActionButton
                            intent="view"
                            label={doc.type === 'URL' ? `Open URL "${doc.name}"` : `View "${doc.fileName}"`}
                            icon={
                              doc.type === 'URL' ? (
                                <ExternalLink className="w-3.5 h-3.5" />
                              ) : (
                                <Eye className="w-3.5 h-3.5" />
                              )
                            }
                            onClick={() => handleView(doc)}
                            disabled={busyDocId === doc.id}
                          />

                          {isFile && (
                            <RowActionButton
                              intent="download"
                              label={`Download "${doc.fileName}"`}
                              icon={<Download className="w-3.5 h-3.5" />}
                              onClick={() => handleDownload(doc)}
                              disabled={busyDocId === doc.id}
                            />
                          )}

                          {canEdit && (
                            <RowActionButton
                              intent="edit"
                              label={`Edit "${doc.name}"`}
                              icon={<Pencil className="w-3.5 h-3.5" />}
                              onClick={() => {
                                setEditingDoc(doc);
                                setIsModalOpen(true);
                              }}
                            />
                          )}

                          {canDelete && (
                            <RowActionButton
                              intent="delete"
                              label={`Delete "${doc.name}"`}
                              icon={<Trash2 className="w-3.5 h-3.5" />}
                              onClick={() => setDeleteTarget(doc)}
                            />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </tbody>
            </Table>
          </div>
        )}
      </Card>

      {/* Add / Edit Modal */}
      <ProjectDocumentationModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingDoc(null);
        }}
        onSubmitUrl={handleCreateUrl}
        onSubmitFile={handleCreateFile}
        onUpdate={handleUpdate}
        editingDoc={editingDoc}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Documentation"
        message={
          deleteTarget ? (
            <>
              Delete documentation <span className="font-bold">"{deleteTarget.name}"</span>?
              {deleteTarget.type === 'FILE' && ' The associated file will also be deleted.'} This
              action cannot be undone.
            </>
          ) : undefined
        }
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await handleDelete(deleteTarget);
          } finally {
            setDeleteTarget(null);
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
