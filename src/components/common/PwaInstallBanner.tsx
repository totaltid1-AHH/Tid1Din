import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, Share } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const PwaInstallBanner: React.FC = () => {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Sjekk om appen allerede kjører i installert/standalone modus
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || 
      (window.navigator as any).standalone === true;
    setIsStandalone(isStandaloneMode);

    // Sjekk om enheten er iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    // Lytt på Android / Chrome / Edge install-prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  // Hvis allerede installert eller lukket av bruker
  if (isStandalone || isDismissed) {
    return null;
  }

  // Chrome / Android / Edge: Vis direkte installer-knapp
  if (installPrompt) {
    return (
      <div className="bg-sky-700 text-white px-3 py-2 text-xs flex items-center justify-between shadow-md transition-all">
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-sky-200 flex-shrink-0" />
          <span>Installer <strong>Tid1Din</strong> som app på hjemskjermen for rask tilgang.</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleInstallClick}
            className="px-2.5 py-1 rounded-lg bg-white text-sky-800 font-bold hover:bg-sky-50 transition-colors flex items-center gap-1 shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            Installer
          </button>
          <button
            onClick={() => setIsDismissed(true)}
            className="p-1 text-sky-200 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // iOS Safari: Vis instruksjon om "Legg til på Hjem-skjerm"
  if (isIOS) {
    return (
      <div className="bg-sky-800 text-white px-3 py-2 text-[11px] flex items-center justify-between shadow-md">
        <div className="flex items-center gap-1.5">
          <Share className="w-4 h-4 text-sky-300 flex-shrink-0" />
          <span>
            Installer på iPhone: Trykk på <strong>Del</strong>-ikonet og velg <strong>«Legg til på Hjem-skjerm»</strong>.
          </span>
        </div>
        <button
          onClick={() => setIsDismissed(true)}
          className="p-1 text-sky-200 hover:text-white ml-2 flex-shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return null;
};
