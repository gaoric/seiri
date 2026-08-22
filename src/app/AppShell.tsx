import type { ReactNode } from "react";
import { Volume2, VolumeX } from "lucide-react";

type AppShellProps = {
  children: ReactNode;
  titleTabs: ReactNode;
  headerActions?: ReactNode;
  soundEnabled: boolean;
  onToggleSound: () => void;
};

export function AppShell({
  children,
  titleTabs,
  headerActions,
  soundEnabled,
  onToggleSound,
}: AppShellProps) {
  return (
    <main className="app-shell">
      <section className="workspace">
        <header className="workspace-header">
          {titleTabs}
          <div className="workspace-header-actions">
            {headerActions}
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
          </div>
        </header>
        {children}
      </section>
    </main>
  );
}
