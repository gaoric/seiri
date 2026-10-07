import {
  Activity,
  Apple,
  Bed,
  Bike,
  BookOpen,
  Brain,
  BriefcaseBusiness,
  Brush,
  Camera,
  Circle,
  Coffee,
  Dumbbell,
  Droplets,
  Footprints,
  GlassWater,
  Guitar,
  Heart,
  Languages,
  Leaf,
  Medal,
  Moon,
  Music,
  NotebookPen,
  Palette,
  PawPrint,
  Pill,
  Salad,
  Smile,
  Sparkles,
  Sun,
  Target,
  Timer,
  Utensils,
  Weight,
  Wind,
  Zap,
  type LucideIcon,
} from "lucide-react";

export const HABIT_ICONS = [
  { name: "activity", label: "Activity", Icon: Activity },
  { name: "apple", label: "Apple", Icon: Apple },
  { name: "bed", label: "Sleep", Icon: Bed },
  { name: "bike", label: "Cycling", Icon: Bike },
  { name: "book", label: "Reading", Icon: BookOpen },
  { name: "brain", label: "Learning", Icon: Brain },
  { name: "work", label: "Work", Icon: BriefcaseBusiness },
  { name: "brush", label: "Routine", Icon: Brush },
  { name: "camera", label: "Photography", Icon: Camera },
  { name: "circle", label: "Circle", Icon: Circle },
  { name: "coffee", label: "Coffee", Icon: Coffee },
  { name: "dumbbell", label: "Strength", Icon: Dumbbell },
  { name: "droplets", label: "Hydration", Icon: Droplets },
  { name: "footprints", label: "Walking", Icon: Footprints },
  { name: "water", label: "Water", Icon: GlassWater },
  { name: "guitar", label: "Practice", Icon: Guitar },
  { name: "heart", label: "Health", Icon: Heart },
  { name: "languages", label: "Language", Icon: Languages },
  { name: "leaf", label: "Nature", Icon: Leaf },
  { name: "medal", label: "Training", Icon: Medal },
  { name: "moon", label: "Evening", Icon: Moon },
  { name: "music", label: "Music", Icon: Music },
  { name: "notes", label: "Journal", Icon: NotebookPen },
  { name: "palette", label: "Art", Icon: Palette },
  { name: "paw", label: "Pet care", Icon: PawPrint },
  { name: "pill", label: "Medicine", Icon: Pill },
  { name: "salad", label: "Nutrition", Icon: Salad },
  { name: "smile", label: "Mood", Icon: Smile },
  { name: "sparkles", label: "Self care", Icon: Sparkles },
  { name: "sun", label: "Morning", Icon: Sun },
  { name: "target", label: "Goal", Icon: Target },
  { name: "timer", label: "Focus", Icon: Timer },
  { name: "utensils", label: "Meals", Icon: Utensils },
  { name: "weight", label: "Weight", Icon: Weight },
  { name: "wind", label: "Breathing", Icon: Wind },
  { name: "zap", label: "Energy", Icon: Zap },
] as const satisfies ReadonlyArray<{
  name: string;
  label: string;
  Icon: LucideIcon;
}>;

export type HabitIconName = (typeof HABIT_ICONS)[number]["name"];

const ICONS_BY_NAME = Object.fromEntries(
  HABIT_ICONS.map(({ name, Icon }) => [name, Icon]),
) as Record<HabitIconName, LucideIcon>;

export function HabitIcon({ name }: { name: HabitIconName }) {
  const Icon = ICONS_BY_NAME[name];
  return <Icon aria-hidden="true" />;
}
