import { useMemo, useState } from "react";
import { type Challenge, loadChallenges } from "../../core/challenges";
import { groupByLevel } from "../../core/levels";
import { isLevelFullyCleared } from "../../core/progress";
import { loadAttempts } from "../attemptStorage";
import { LevelRound, type LevelSessionStats } from "./LevelRound";
import { LevelSummaryScreen } from "./LevelSummaryScreen";
import { MenuScreen } from "./MenuScreen";

// State-based screen switching, no router (see CLAUDE.md "UI 構成"): a level
// playthrough is self-contained enough that URL routing/deep-linking would
// add complexity (browser history, direct level links) with no MVP benefit.
type Screen =
	| { type: "menu" }
	| {
			type: "game";
			level: Challenge["difficulty"];
			wasFullyClearedBefore: boolean;
	  }
	| {
			type: "summary";
			level: Challenge["difficulty"];
			stats: LevelSessionStats;
			isFirstFullClear: boolean;
	  };

function useChallenges(): Challenge[] {
	return useMemo(() => loadChallenges().map(({ challenge }) => challenge), []);
}

export function GamePage() {
	const challenges = useChallenges();
	const levelGroups = useMemo(() => groupByLevel(challenges), [challenges]);
	const [screen, setScreen] = useState<Screen>({ type: "menu" });

	const handleSelectLevel = (level: Challenge["difficulty"]) => {
		const group = levelGroups.find((g) => g.level === level);
		const wasFullyClearedBefore = group
			? isLevelFullyCleared(group.challenges, loadAttempts())
			: false;
		setScreen({ type: "game", level, wasFullyClearedBefore });
	};

	const handleLevelComplete = (stats: LevelSessionStats) => {
		if (screen.type !== "game") return;
		const group = levelGroups.find((g) => g.level === screen.level);
		// Recomputed fresh (not just "did every round in this session succeed"):
		// a level can also become fully cleared by combining today's clears with
		// clears from an earlier, incomplete visit.
		const isFullyClearedNow = group
			? isLevelFullyCleared(group.challenges, loadAttempts())
			: false;
		setScreen({
			type: "summary",
			level: screen.level,
			stats,
			isFirstFullClear: !screen.wasFullyClearedBefore && isFullyClearedNow,
		});
	};

	const handleBackToMenu = () => setScreen({ type: "menu" });

	return (
		<main
			className="vg-container"
			style={{ fontFamily: "monospace", padding: "2rem 0" }}
		>
			{screen.type === "menu" && (
				<MenuScreen
					levelGroups={levelGroups}
					onSelectLevel={handleSelectLevel}
				/>
			)}
			{screen.type === "game" &&
				(() => {
					const group = levelGroups.find((g) => g.level === screen.level);
					// Can't happen: `level` always comes from levelGroups itself.
					if (!group) return null;
					return (
						<LevelRound
							key={screen.level}
							challenges={group.challenges}
							onExitToMenu={handleBackToMenu}
							onLevelComplete={handleLevelComplete}
						/>
					);
				})()}
			{screen.type === "summary" && (
				<LevelSummaryScreen
					level={screen.level}
					stats={screen.stats}
					isFirstFullClear={screen.isFirstFullClear}
					onBackToMenu={handleBackToMenu}
					// "Replay" is just re-selecting the same level - handleSelectLevel
					// already recomputes wasFullyClearedBefore fresh, which is exactly
					// right here too (the level may have just become fully cleared).
					onReplayLevel={() => handleSelectLevel(screen.level)}
				/>
			)}
		</main>
	);
}
