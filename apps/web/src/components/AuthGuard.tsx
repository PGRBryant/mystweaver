import React, { useEffect, useState } from 'react';

const STORAGE_KEY = 'verikaToken';
const EXPIRES_KEY = 'verikaTokenExpiresAt';
const TARGET_SERVICE = 'mystweaver-api';

const VERIKA_ENDPOINT =
  (import.meta as unknown as { env: Record<string, string> }).env['VITE_VERIKA_ENDPOINT'] ?? '';

function isTokenValid(): boolean {
  const token = localStorage.getItem(STORAGE_KEY);
  const expiresAt = localStorage.getItem(EXPIRES_KEY);
  if (!token || !expiresAt) return false;
  // Treat as expired 60s early to avoid edge cases
  return Date.now() < Number(expiresAt) - 60_000;
}

function redirectToLogin(): void {
  const redirectUri = window.location.href;
  const url = new URL(`${VERIKA_ENDPOINT}/v1/auth/google`);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('target_service', TARGET_SERVICE);
  window.location.replace(url.toString());
}

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Absorb token from URL if Verika just redirected back
    const params = new URLSearchParams(window.location.search);
    const incomingToken = params.get('verikaToken');
    const incomingExpiry = params.get('verikaTokenExpiresAt');

    if (incomingToken && incomingExpiry) {
      localStorage.setItem(STORAGE_KEY, incomingToken);
      localStorage.setItem(EXPIRES_KEY, incomingExpiry);
      // Strip the token from the URL without reloading
      params.delete('verikaToken');
      params.delete('verikaTokenExpiresAt');
      const clean = params.toString()
        ? `${window.location.pathname}?${params.toString()}`
        : window.location.pathname;
      window.history.replaceState(null, '', clean);
    }

    if (isTokenValid()) {
      setReady(true);
    } else {
      redirectToLogin();
    }
  }, []);

  if (!ready) return null;
  return <>{children}</>;
}

/** Returns the stored Verika human token, or null if missing/expired. */
export function getStoredToken(): string | null {
  return isTokenValid() ? localStorage.getItem(STORAGE_KEY) : null;
}
