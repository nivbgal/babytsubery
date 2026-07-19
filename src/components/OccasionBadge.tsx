import { CakeSlice, PartyPopper, Sparkles, Star } from "lucide-react";
import type { Occasion, OccasionType } from "../types";

export function OccasionTypeIcon({ type, size = 16 }: { type: OccasionType; size?: number }) {
  const props = { size, strokeWidth: 2, "aria-hidden": true as const };
  if (type === "birthday") return <CakeSlice {...props} />;
  if (type === "celebration") return <PartyPopper {...props} />;
  if (type === "milestone") return <Sparkles {...props} />;
  return <Star {...props} />;
}

export function occasionTypeLabel(type: OccasionType) {
  if (type === "birthday") return "Birthday";
  if (type === "celebration") return "Celebration";
  if (type === "milestone") return "Milestone";
  return "Special moment";
}

export function occasionSummary(occasions: Occasion[]) {
  return occasions.map((occasion) => `${occasionTypeLabel(occasion.type)}: ${occasion.title}`).join(", ");
}
