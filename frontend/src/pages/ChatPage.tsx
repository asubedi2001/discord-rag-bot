import React from "react";
import Sidebar from "../components/Sidebar";
import Chat from "../components/Chat";
import type { User } from "../lib/api";

interface ChatPageProps {
  token: string;
  user: User;
  documents: string[];
  onDocumentDeleted: (filename: string) => void;
  onDocumentUploaded: (filename: string) => void;
  onLogout: () => void;
}

/**
 * Authenticated layout.
 * Renders a fixed-width Sidebar on the left and the Chat panel filling the rest.
 * All state management lives in App.tsx and is passed down as props.
 */
export default function ChatPage({
  token,
  user,
  documents,
  onDocumentDeleted,
  onDocumentUploaded,
  onLogout,
}: ChatPageProps) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#0e0f17]">
      <Sidebar
        token={token}
        user={user}
        documents={documents}
        onDocumentDeleted={onDocumentDeleted}
        onDocumentUploaded={onDocumentUploaded}
        onLogout={onLogout}
      />
      <main className="flex-1 flex flex-col min-w-0">
        <Chat token={token} />
      </main>
    </div>
  );
}
