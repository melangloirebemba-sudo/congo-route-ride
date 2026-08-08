import { useEffect, useState } from "react";
import { Download, X, Share } from "lucide-react";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "transcongo.pwa.install.dismissed";
const DISMISS_DAYS = 7;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (window.navigator as any).standalone === true;

const isIos = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);

const recentlyDismissed = () => {
  const raw = localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const ts = Number(raw);
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts < DISMISS_DAYS * 24 * 60 * 60 * 1000;
};

const InstallPrompt = () => {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    const onInstalled = () => {
      setVisible(false);
      setDeferred(null);
    };
    window.addEventListener("appinstalled", onInstalled);

    // iOS ne déclenche pas beforeinstallprompt : afficher l'astuce Partager
    let t: number | undefined;
    if (isIos()) {
      t = window.setTimeout(() => {
        setIosHint(true);
        setVisible(true);
      }, 2500);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      if (t) window.clearTimeout(t);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "dismissed") localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDeferred(null);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Installer l'application TransCongo"
      className="fixed inset-x-3 bottom-20 z-[60] md:left-auto md:right-4 md:w-96 rounded-2xl border border-border bg-card/95 backdrop-blur-xl shadow-lg p-4 animate-in slide-in-from-bottom-4"
    >
      <div className="flex items-start gap-3">
        <img
          src="/icons/icon-192.png"
          alt="Logo TransCongo"
          width={48}
          height={48}
          loading="lazy"
          className="h-12 w-12 rounded-xl shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="font-display font-semibold text-sm">Installer TransCongo</p>
          {iosHint && !deferred ? (
            <p className="text-xs text-muted-foreground mt-1">
              Appuyez sur <Share className="inline h-3 w-3 align-[-2px]" aria-hidden="true" /> Partager,
              puis « Sur l'écran d'accueil ».
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">
              Accès rapide à vos billets depuis votre écran d'accueil.
            </p>
          )}
          {(!iosHint || deferred) && (
            <Button size="sm" className="mt-3 w-full" onClick={install}>
              <Download className="h-4 w-4 mr-2" aria-hidden="true" />
              Installer l'application
            </Button>
          )}
        </div>
        <Button variant="ghost" size="icon" aria-label="Fermer" onClick={dismiss} className="shrink-0 -mt-1 -mr-1">
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
};

export default InstallPrompt;
