/**
 * API client for bot api.
 *
 * All functions that require authentication accept a JWT token string
 * and send it as "Authorization: Bearer <token>".
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

export interface User {
  discord_id: string;
  username: string;
  avatar: string | null;
}

export interface AuthResponse {
  status: string;
  access_token: string;
  user: User;
}

// Handle Auth

/**
 * Exchanges a Discord OAuth code + PKCE code_verifier for a signed JWT.
 * Called once after the OAuth redirect lands.
 */
export async function exchangeCode(
  code: string,
  codeVerifier: string,
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/discord`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, code_verifier: codeVerifier }),
  });

  if (!res.ok) {
    throw new Error(`Auth failed: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<AuthResponse>;
}

// Handle Documents

/** Returns the list of distinct filenames the user has ingested. */
export async function fetchDocuments(token: string): Promise<string[]> {
  const res = await fetch(`${API_BASE_URL}/documents`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error(`fetchDocuments: ${res.status}`);

  const data = await res.json();
  return data.documents as string[];
}

/** Deletes all embedding chunks for the given filename. */
export async function deleteDocument(token: string, filename: string): Promise<void> {
  const res = await fetch(
    `${API_BASE_URL}/documents/${encodeURIComponent(filename)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  if (!res.ok) throw new Error(`deleteDocument: ${res.status}`);
}

// Handle Ingestion

/**
 * Uploads a PDF file to the backend for ingestion.
 * The file bytes are sent as multipart/form data so the server controls where
 * the file comes from.
 */
export async function ingestDocument(
  token: string,
  file: File,
): Promise<void> {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${API_BASE_URL}/upload`, {
    method: "POST",
    // Do NOT set Content-Type manually; the browser must set the multipart
    // boundary automatically when body is FormData.
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  if (!res.ok) throw new Error(`ingestDocument: ${res.status}`);
}

// Handle Queries

/**
 * Sends a user query to the RAG engine and returns the Ollama-generated response string.
 */
export async function sendQuery(token: string, query: string): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, k: 5 }),
  });

  if (!res.ok) throw new Error(`sendQuery: ${res.status}`);

  const data = await res.json();
  // Backend returns { status: "success", response: "..." }
  return data.response as string;
}
