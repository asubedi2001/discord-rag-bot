/*
  App.tsx ->
    - Handle Auth
    - Handle Document List State
    - Handle Page Routing
*/

import { useEffect, useState } from "react";
import { useAuth } from "./hooks/useAuth";
import { fetchDocuments } from "./lib/api";
import LoginPage from "./pages/Login";
import ChatPage from "./pages/ChatPage";

export default function App() {
  const { token, user, isLoading, login, logout, handleCallback } = useAuth();
  const [documents, setDocuments] = useState<string[]>([]);

  // oauth callback + document load
  useEffect(() => {
    // if ?code= is in the URL -> handleCallback exchanges it for a JWT
    // on success -> hook updates token/user, the component re-renders and
    // the second branch below then loads documents
    handleCallback();
  }, []);

  useEffect(() => {
    if (!token) return;
    fetchDocuments(token)
      .then(setDocuments)
      .catch((err) => {
        console.error("Failed to fetch documents:", err);
        // if the token is invalid/expired, log the user out
        if (err.message?.includes("401") || err.message?.includes("403")) {
          logout();
        }
      });
  }, [token]);

  // document list handlers (passed to ChatPage -> Sidebar)
  function handleDocumentDeleted(filename: string) {
    setDocuments((prev) => prev.filter((d) => d !== filename));
  }

  function handleDocumentUploaded(filename: string) {
    // optimistic add -> the backend queues ingestion in the background
    setDocuments((prev) => (prev.includes(filename) ? prev : [...prev, filename]));
  }

  // not authenticated -> show login page
  if (!token || !user) {
    return <LoginPage onLogin={login} isLoading={isLoading} />;
  }

  // authenticated -> show chat layout
  return (
    <ChatPage
      token={token}
      user={user}
      documents={documents}
      onDocumentDeleted={handleDocumentDeleted}
      onDocumentUploaded={handleDocumentUploaded}
      onLogout={logout}
    />
  );
}