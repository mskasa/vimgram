import type { UIStringKey } from "./i18n/strings";

// Shared between MenuScreen (level cards) and LevelSummaryScreen (context
// line) - kept in one place so the two screens can't drift out of sync
// about which description belongs to which level.
export const LEVEL_DESCRIPTION_KEYS: Record<number, UIStringKey> = {
	1: "menu.level1Description",
	2: "menu.level2Description",
	3: "menu.level3Description",
	4: "menu.level4Description",
};
