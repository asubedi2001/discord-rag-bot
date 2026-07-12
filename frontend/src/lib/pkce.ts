/**
 * PKCE (Proof Key for Code Exchange) helpers using the Web Crypto API.
 * These run entirely in the browser — no server involvement.
 *
 * Flow:
 *   1. generateCodeVerifier()  → random high-entropy string, stored in sessionStorage
 *   2. generateCodeChallenge() → SHA-256 hash of verifier, base64url-encoded
 *   3. Send challenge in the OAuth redirect; send verifier when exchanging the code
 *
 * Spec: https://datatracker.ietf.org/doc/html/rfc7636
 */

/** Generates a cryptographically random code verifier (43–128 chars, base64url). */
export function generateCodeVerifier(): string {
  const array = new Uint8Array(48); // 48 bytes → 64 base64url chars (well within 43–128)
  crypto.getRandomValues(array);
  return base64urlEncode(array);
}

/**
 * Derives the S256 code challenge from a verifier.
 * SHA-256(verifier) → base64url-encode (no padding).
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64urlEncode(new Uint8Array(digest));
}

/** Encodes a Uint8Array to base64url (no padding). */
function base64urlEncode(bytes: Uint8Array): string {
  // Convert to regular base64 then swap chars + strip padding
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
