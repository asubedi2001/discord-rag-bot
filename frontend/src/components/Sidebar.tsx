import React, { useRef } from "react";
import { deleteDocument, ingestDocument } from "../lib/api";
import type { User } from "../lib/api";

interface SidebarProps {
  readonly token: string;
  readonly user: User;
  readonly documents: string[];
  readonly onDocumentDeleted: (filename: string) => void;
  readonly onDocumentUploaded: (filename: string) => void;
  readonly onLogout: () => void;
}

export default function Sidebar({
  token,
  user,
  documents,
  onDocumentDeleted,
  onDocumentUploaded,
  onLogout,
}: SidebarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // delete document
  async function handleDelete(filename: string) {
    onDocumentDeleted(filename);
    try {
      await deleteDocument(token, filename);
    } catch (err) {
      console.error("Failed to delete document:", err);
    }
  }

  // upload document
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = "";

    try {
      await ingestDocument(token, file);
      onDocumentUploaded(file.name);
    } catch (err) {
      console.error("Failed to ingest document:", err);
    }
  }

  return (
    <aside className="w-64 shrink-0 flex flex-col h-full bg-[#13141f] border-r border-white/5">

      {/* Header */}
      <div className="px-4 py-5 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#5865F2]/20 border border-[#5865F2]/30 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zm-8 13H8v-2h4v2zm4-4H8V9h8v2z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-white tracking-tight">Discord RAG Bot</span>
        </div>
      </div>

      {/* Documents label */}
      <div className="px-4 pt-4 pb-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
          Documents
        </p>
      </div>

      {/* Document list (scrollable) */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 scrollbar-thin min-h-0">
        {documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-24 gap-2">
            <svg className="w-7 h-7 text-slate-700" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
            </svg>
            <p className="text-xs text-slate-600 text-center px-2">
              No documents yet.
              <br />Upload a PDF below.
            </p>
          </div>
        ) : (
          <ul className="space-y-0.5">
            {documents.map((doc) => (
              <li
                key={doc}
                className="group flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-white/5 transition-colors"
              >
                {/* File icon */}
                <svg
                  className="w-4 h-4 text-[#5865F2] shrink-0"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
                </svg>

                {/* Filename */}
                <span
                  className="flex-1 text-xs text-slate-300 truncate"
                  title={doc}
                >
                  {doc}
                </span>

                {/* Delete button */}
                <button
                  id={`btn-delete-${doc}`}
                  onClick={() => handleDelete(doc)}
                  className="
                    opacity-0 group-hover:opacity-100
                    w-5 h-5 flex items-center justify-center rounded
                    text-slate-500 hover:text-red-400 hover:bg-red-400/10
                    transition-all duration-150 shrink-0
                  "
                  title={`Delete ${doc}`}
                  aria-label={`Delete ${doc}`}
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Upload button */}
      <div className="px-3 py-3 border-t border-white/5">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={handleFileChange}
          id="file-upload-input"
          aria-label="Upload PDF document"
        />
        <button
          id="btn-upload-document"
          onClick={() => fileInputRef.current?.click()}
          className="
            w-full flex items-center justify-center gap-2
            py-2 px-3 rounded-lg
            text-xs font-medium text-slate-300
            bg-white/5 hover:bg-[#5865F2]/20 hover:text-[#5865F2]
            border border-white/5 hover:border-[#5865F2]/30
            transition-all duration-200
          "
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Upload PDF
        </button>
      </div>

      {/* User footer */}
      <div className="px-3 py-3 border-t border-white/5 flex items-center gap-2.5">
        {/* User Avatar */}
        {user.avatar ? (
          <img
            src={user.avatar}
            alt={user.username}
            className="w-8 h-8 rounded-full shrink-0 ring-2 ring-[#5865F2]/30"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-[#5865F2]/30 flex items-center justify-center shrink-0 text-[#5865F2] text-xs font-bold">
            {user.username.charAt(0).toUpperCase()}
          </div>
        )}

        <span className="flex-1 text-sm font-medium text-slate-300 truncate">
          {user.username}
        </span>

        {/* Logout */}
        <button
          id="btn-logout"
          onClick={onLogout}
          className="
            w-7 h-7 flex items-center justify-center rounded-lg
            text-slate-500 hover:text-red-400 hover:bg-red-400/10
            transition-all duration-150 shrink-0
          "
          title="Logout"
          aria-label="Logout"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
