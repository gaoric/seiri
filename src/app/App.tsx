import { MotionConfig } from "motion/react";
import { Toaster } from "sonner";
import { AppShell } from "@/app/AppShell";
import { TodoTool } from "@/features/todo";
import { useUiSounds } from "@/shared/sound";
import { TooltipProvider } from "@/shared/ui/tooltip";

export function App() {
  const sounds = useUiSounds();

  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider delay={350}>
        <AppShell
          soundEnabled={sounds.soundEnabled}
          onToggleSound={sounds.toggleSound}
        >
          <TodoTool soundEffects={sounds} />
        </AppShell>
        <Toaster
          theme="dark"
          position="bottom-center"
          toastOptions={{
            classNames: {
              toast: "app-toast",
              actionButton: "app-toast-action",
            },
          }}
        />
      </TooltipProvider>
    </MotionConfig>
  );
}
