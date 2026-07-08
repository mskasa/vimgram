import type { StoredMilestone } from "../core/milestones";
import type { UIStringKey } from "./i18n/strings";

// Shared between MilestoneBanner (passive) and MilestoneModal (the Star
// prompt) so the two surfaces can never describe the same milestone
// differently.
export function describeMilestone(
	milestone: StoredMilestone,
	t: (key: UIStringKey) => string,
): string {
	switch (milestone.type) {
		case "levelFullyCleared":
			return `${t("milestone.levelFullyClearedPrefix")}${milestone.level}${t("milestone.levelFullyClearedSuffix")}`;
	}
}
