import { MotionConfig } from "motion/react";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Settings2 } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/app/AppShell";
import { PomodoroTool } from "@/features/pomodoro";
import { TodoTool } from "@/features/todo";
import { useUiSounds } from "@/shared/sound";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/ui/tabs";
import { TooltipProvider } from "@/shared/ui/tooltip";

export function App() {
  const sounds = useUiSounds();
  const [activeTool, setActiveTool] = useState("todo");
  const [pomodoroSettingsOpen, setPomodoroSettingsOpen] = useState(false);

  function changeTool(value: string) {
    setActiveTool(value);
    if (value !== "pomodoro") setPomodoroSettingsOpen(false);
  }

  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider delay={350}>
        <Tabs
          value={activeTool}
          onValueChange={changeTool}
          className="tool-tabs"
        >
          <AppShell
            soundEnabled={sounds.soundEnabled}
            onToggleSound={sounds.toggleSound}
            headerActions={activeTool === "pomodoro" && (
              <button
                className="pomodoro-settings-trigger"
                type="button"
                aria-label="Pomodoro settings"
                aria-haspopup="dialog"
                aria-expanded={pomodoroSettingsOpen}
                title="Pomodoro settings"
                onClick={() => setPomodoroSettingsOpen(true)}
              >
                <Settings2 />
              </button>
            )}
            titleTabs={
              <TabsList className="workspace-title-tabs" aria-label="Tools">
                <h1>
                  <TabsTrigger value="todo" data-ui-sound="open">
                    todo
                  </TabsTrigger>
                </h1>
                <TabsTrigger value="pomodoro" data-ui-sound="open">
                  pomo
                </TabsTrigger>
              </TabsList>
            }
          >
            <TabsContent value="todo">
              <TodoTool soundEffects={sounds} />
            </TabsContent>
            <TabsContent value="pomodoro" keepMounted>
              <PomodoroTool
                settingsOpen={pomodoroSettingsOpen}
                onSettingsOpenChange={setPomodoroSettingsOpen}
              />
            </TabsContent>
          </AppShell>
        </Tabs>
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
        <Analytics />
        <SpeedInsights />
      </TooltipProvider>
    </MotionConfig>
  );
}
