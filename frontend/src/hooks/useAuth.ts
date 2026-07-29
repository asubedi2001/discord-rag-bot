/*
  useAuth.ts ->
    - Handle PKCE OAuth2 Authorization Flow
    - Store code_verifier -> sessionStorage
    - Store access_token + user -> localStorage
*/

import { useState, useCallback } from "react";
import { generateCodeVerifier, generateCodeChallenge } from "../lib/pkce";
import { exchangeCode } from "../lib/api";
import type { User } from "../lib/api";

const DISCORD_CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID as string;
const DISCORD_REDIRECT_URI = import.meta.env.VITE_DISCORD_REDIRECT_URI as string;

const STORAGE_TOKEN = "rag_token";
const STORAGE_USER = "rag_user";
const SESSION_VERIFIER = "pkce_code_verifier";

export interface AuthState {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  // initiates PKCE OAuth redirect to Discord.
  login: () => Promise<void>;
  // clears auth state and localStorage.
  logout: () => void;

  // called once on app mount. detects ?code= in URL, exchanges for JWT, and cleans URL. Returns true if callback was handled.
  handleCallback: () => Promise<boolean>;
}

export function useAuth(): AuthState {
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem(STORAGE_TOKEN),
  );
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem(STORAGE_USER);
    return saved ? (JSON.parse(saved) as User) : null;
  });
  const [isLoading, setIsLoading] = useState(false);

  // login -> builds PKCE params, store verifier, redirect to Discord
  const login = useCallback(async () => {
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);

    // store verifier so handleCallback can retrieve it after the redirect
    sessionStorage.setItem(SESSION_VERIFIER, verifier);

    const params = new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      redirect_uri: DISCORD_REDIRECT_URI,
      response_type: "code",
      scope: "identify",
      code_challenge: challenge,
      code_challenge_method: "S256",
    });

    window.location.href = `https://discord.com/api/oauth2/authorize?${params}`;
  }, []);

  // logout -> clears auth state and localStorage
  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_TOKEN);
    localStorage.removeItem(STORAGE_USER);
    setToken(null);
    setUser(null);
  }, []);

  // handleCallback -> called once on App mount
  const handleCallback = useCallback(async (): Promise<boolean> => {
    const urlParams = new URLSearchParams(globalThis.location.search);
    const code = urlParams.get("code");

    if (!code) return false;

    // immediately clean URL so refresh doesn't re-trigger
    globalThis.history.replaceState({}, document.title, "/");

    const verifier = sessionStorage.getItem(SESSION_VERIFIER);
    if (!verifier) {
      console.error("PKCE verifier missing from sessionStorage, cannot exchange code.");
      return false;
    }

    setIsLoading(true);
    try {
      const data = await exchangeCode(code, verifier);
      sessionStorage.removeItem(SESSION_VERIFIER);

      localStorage.setItem(STORAGE_TOKEN, data.access_token);
      localStorage.setItem(STORAGE_USER, JSON.stringify(data.user));

      setToken(data.access_token);
      setUser(data.user);
      console.log("User signed in successfully: ", data.user);
      return true;
    } catch (err) {
      console.error("OAuth callback failed: ", err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { token, user, isLoading, login, logout, handleCallback };
}
