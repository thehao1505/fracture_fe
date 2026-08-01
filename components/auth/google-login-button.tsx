"use client";

import Script from "next/script";
import { useCallback, useRef, useState, useTransition } from "react";
import { loginWithGoogleAction } from "@/app/(auth)/actions";
import { Alert } from "@/components/ui";

interface GoogleCredentialResponse {
  credential: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(config: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
          }): void;
          renderButton(
            parent: HTMLElement,
            options: Record<string, unknown>,
          ): void;
        };
      };
    };
  }
}

/**
 * docs/FE_GUIDELINE_GOOGLE_SIGNIN.md §3 — renders Google's own button via the
 * Identity Services script and forwards the resulting ID token (JWT) to
 * `loginWithGoogleAction`. Same button serves login and register (§5: no
 * separate sign-up step).
 */
export function GoogleLoginButton({ next }: { next?: string }) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleCredential = useCallback(
    (response: GoogleCredentialResponse) => {
      setError(null);
      startTransition(async () => {
        const result = await loginWithGoogleAction(response.credential, next);
        if (result?.error) setError(result.error);
      });
    },
    [next],
  );

  const handleScriptLoad = useCallback(() => {
    if (!clientId || !window.google || !containerRef.current) return;
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: handleCredential,
    });
    window.google.accounts.id.renderButton(containerRef.current, {
      theme: "outline",
      size: "large",
      width: 320,
      text: "continue_with",
    });
  }, [clientId, handleCredential]);

  if (!clientId) return null;

  return (
    <div className="flex flex-col gap-2">
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={handleScriptLoad}
      />
      {error && <Alert tone="error">{error}</Alert>}
      <div
        ref={containerRef}
        className={`flex justify-center ${pending ? "pointer-events-none opacity-60" : ""}`}
      />
    </div>
  );
}
