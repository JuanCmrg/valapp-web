"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Registrar service worker (necesario para que Android dispare beforeinstallprompt)
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
        true;
    setIsStandalone(standalone);

    const ua = window.navigator.userAgent;
    const ios =
      /iPhone|iPad|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setIsIos(ios);

    setHydrated(true);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    const onInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
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

  if (!hydrated || isStandalone) return null;

  const canInstall = !!deferredPrompt || isIos;
  if (!canInstall) return null;

  return (
    <>
      <button
        onClick={handleClick}
        aria-label="Instalar VALAPP"
        title="Instalar VALAPP"
        className="inline-flex items-center gap-2 text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-800 hover:border-zinc-700 rounded-lg px-3 py-2 transition-colors"
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
            className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-lg font-medium mb-1">Añadir a pantalla de inicio</p>
            <p className="text-xs text-zinc-500 mb-5">
              Tienes que abrir VALAPP en <strong>Safari</strong> (no funciona desde
              Chrome u otros navegadores en iOS).
            </p>
            <ol className="space-y-4 text-sm text-zinc-300">
              <li className="flex items-start gap-3">
                <span className="bg-zinc-800 text-zinc-300 rounded-full w-6 h-6 flex items-center justify-center text-xs shrink-0 mt-0.5">
                  1
                </span>
                <span className="flex-1">
                  Toca el botón{" "}
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-zinc-800 rounded">
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
                <span className="bg-zinc-800 text-zinc-300 rounded-full w-6 h-6 flex items-center justify-center text-xs shrink-0 mt-0.5">
                  2
                </span>
                <span className="flex-1">
                  Desplázate y elige <strong>Añadir a pantalla de inicio</strong>.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="bg-zinc-800 text-zinc-300 rounded-full w-6 h-6 flex items-center justify-center text-xs shrink-0 mt-0.5">
                  3
                </span>
                <span className="flex-1">
                  Toca <strong>Añadir</strong> en la esquina superior derecha.
                </span>
              </li>
            </ol>
            <button
              onClick={() => setShowIosHelp(false)}
              className="mt-6 w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-medium py-2 rounded-lg transition-colors"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
}
