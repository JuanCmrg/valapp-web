"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const noopSubscribe = () => () => {};

function detectStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function detectIos() {
  return (
    /iPhone|iPad|iPod/.test(window.navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);
  // Valores del navegador: en el servidor no existen.
  const isStandalone = useSyncExternalStore(noopSubscribe, detectStandalone, () => false);
  const isIos = useSyncExternalStore(noopSubscribe, detectIos, () => false);

  useEffect(() => {
    // Registrar service worker (necesario para que Android dispare beforeinstallprompt)
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }


    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    const onInstalled = () => {
      setDeferredPrompt(null);
      setInstalled(true);
    };
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const handleClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") setDeferredPrompt(null);
      return;
    }
    if (isIos) setShowIosHelp(true);
  };

  if (isStandalone || installed) return null;

  const canInstall = !!deferredPrompt || isIos;
  if (!canInstall) return null;

  return (
    <>
      <button
        onClick={handleClick}
        aria-label="Instalar VALAPP"
        title="Instalar VALAPP"
        className="inline-flex items-center gap-2 text-xs text-ink-2 hover:text-ink border border-line hover:border-line-strong rounded-lg px-3 py-2 transition-colors"
      >
        <svg
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 3v12" />
          <path d="m7 10 5 5 5-5" />
          <path d="M5 21h14" />
        </svg>
        <span className="hidden sm:inline">Instalar</span>
      </button>

      {showIosHelp && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setShowIosHelp(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-surface border border-line rounded-2xl p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-lg font-medium mb-1">Añadir a pantalla de inicio</p>
            <p className="text-xs text-ink-3 mb-5">
              Tienes que abrir VALAPP en <strong>Safari</strong> (no funciona desde
              Chrome u otros navegadores en iOS).
            </p>
            <ol className="space-y-4 text-sm text-ink">
              <li className="flex items-start gap-3">
                <span className="bg-surface-2 text-ink rounded-full w-6 h-6 flex items-center justify-center text-xs shrink-0 mt-0.5">
                  1
                </span>
                <span className="flex-1">
                  Toca el botón{" "}
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-surface-2 rounded">
                    <svg
                      className="w-3.5 h-3.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                      <polyline points="16 6 12 2 8 6" />
                      <line x1="12" y1="2" x2="12" y2="15" />
                    </svg>
                    <span className="text-xs">Compartir</span>
                  </span>{" "}
                  en la barra de Safari.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="bg-surface-2 text-ink rounded-full w-6 h-6 flex items-center justify-center text-xs shrink-0 mt-0.5">
                  2
                </span>
                <span className="flex-1">
                  Desplázate y elige <strong>Añadir a pantalla de inicio</strong>.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="bg-surface-2 text-ink rounded-full w-6 h-6 flex items-center justify-center text-xs shrink-0 mt-0.5">
                  3
                </span>
                <span className="flex-1">
                  Toca <strong>Añadir</strong> en la esquina superior derecha.
                </span>
              </li>
            </ol>
            <button
              onClick={() => setShowIosHelp(false)}
              className="mt-6 w-full bg-accent hover:opacity-90 text-on-accent text-sm font-medium py-2 rounded-lg transition-colors"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
}
