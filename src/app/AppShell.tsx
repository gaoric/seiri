import type { ReactNode } from "react";
import { Volume2, VolumeX } from "lucide-react";

type AppShellProps = {
  children: ReactNode;
  soundEnabled: boolean;
  onToggleSound: () => void;
};

export function AppShell({
  children,
  soundEnabled,
  onToggleSound,
}: AppShellProps) {
  return (
    <main className="app-shell">
      <section className="workspace">
        <header className="workspace-header">
          <h1>todo</h1>
          <button
            className="sound-toggle"
            type="button"
            data-ui-sound="custom"
            aria-label={soundEnabled ? "Mute sounds" : "Enable sounds"}
            aria-pressed={soundEnabled}
            onClick={onToggleSound}
          >
            {soundEnabled ? <Volume2 /> : <VolumeX />}
          </button>
        </header>
        {children}
      </section>
    </main>
  );
}
