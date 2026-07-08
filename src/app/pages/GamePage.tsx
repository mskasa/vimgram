import { useMemo, useState } from "react";
import { type Challenge, loadChallenges } from "../../core/challenges";
import { groupByLevel } from "../../core/levels";
import { isLevelFullyCleared } from "../../core/progress";
import { buildReviewQueue, type ReviewBucket } from "../../core/reviewQueue";
import { shuffle } from "../../core/shuffle";
import { loadChallengeStats } from "../challengeStatsStorage";
import { LevelRound, type LevelSessionResult } from "./LevelRound";
import { LevelSummaryScreen } from "./LevelSummaryScreen";
import { MenuScreen } from "./MenuScreen";
import type { PlaygroundSeed } from "./PlaygroundPage";

// State-based screen switching, no router (see CLAUDE.md "UI 構成"): a level
// playthrough is self-contained enough that URL routing/deep-linking would
// add complexity (browser history, direct level links) with no MVP benefit.
//
// `level: null` marks a review session (challenges gathered across levels,
// see CLAUDE.md "復習モード") - everything else about playing through
// `challenges` is identical to a single-level session, so this stays one
// union member with an optional field rather than a second near-duplicate.
//
// Neither variant tracks "was this level just fully cleared" anymore - that
// detection (and the Star-button celebration it drives) is handled
// independently of session/screen type by the milestone queue (see
// core/milestones.ts and CLAUDE.md "永続化"), not by anything computed here.
type Screen =
	| { type: "menu" }
	| {
			type: "game";
			challenges: Challenge[];
			level: Challenge["difficulty"] | null;
	  }
	| {
			type: "summary";
			level: Challenge["difficulty"] | null;
			stats: LevelSessionResult;
	  };

function useChallenges(): Challenge[] {
	return useMemo(() => loadChallenges().map(({ challenge }) => challenge), []);
}

export function GamePage({
	active,
	onOpenPlayground,
}: {
	active: boolean;
	onOpenPlayground: (seed: PlaygroundSeed) => void;
}) {
	const challenges = useChallenges();
	const levelGroups = useMemo(() => groupByLevel(challenges), [challenges]);
	const [screen, setScreen] = useState<Screen>({ type: "menu" });

	const handleSelectLevel = (level: Challenge["difficulty"]) => {
		const group = levelGroups.find((g) => g.level === level);
		if (!group) return;
		const stats = loadChallengeStats();
		// Only a level that's already been fully cleared once gets shuffled -
		// an in-progress level keeps its fixed order so comparison-learning
		// pairs (e.g. df, next to dt,) stay adjacent (see CLAUDE.md "シャッフル").
		const orderedChallenges = isLevelFullyCleared(group.challenges, stats)
			? shuffle(group.challenges, Math.random)
			: group.challenges;
		setScreen({ type: "game", challenges: orderedChallenges, level });
	};

	const handleStartReview = (reviewChallenges: Challenge[]) => {
		if (reviewChallenges.length === 0) return;
		setScreen({ type: "game", challenges: reviewChallenges, level: null });
	};

	const handleLevelComplete = (stats: LevelSessionResult) => {
		if (screen.type !== "game") return;
		setScreen({ type: "summary", level: screen.level, stats });
	};

	const handleBackToMenu = () => setScreen({ type: "menu" });

	// "Replay" for a level session re-selects the same level (handleSelectLevel
	// already recomputes the shuffle decision fresh). For a review session, it
	// rebuilds the queue from current challengeStats - anything cleared
	// during the session just played naturally drops out.
	const handleReplay = (level: Challenge["difficulty"] | null) => {
		if (level !== null) {
			handleSelectLevel(level);
			return;
		}
		const stats = loadChallengeStats();
		const bucket: ReviewBucket =
			buildReviewQueue(challenges, stats, "uncleared").length > 0
				? "uncleared"
				: "notGreat";
		handleStartReview(buildReviewQueue(challenges, stats, bucket));
	};

	return (
		<main
			className="vg-container"
			style={{ fontFamily: "monospace", padding: "2rem 0" }}
		>
			{screen.type === "menu" && (
				<MenuScreen
					active={active}
					levelGroups={levelGroups}
					challenges={challenges}
					onSelectLevel={handleSelectLevel}
					onStartReview={handleStartReview}
				/>
			)}
			{screen.type === "game" && (
				// No key needed: this branch only ever becomes active by
				// transitioning from a *different* screen.type ("menu" or
				// "summary" - see handleSelectLevel/handleStartReview, both only
				// reachable from MenuScreen), so LevelRound always mounts fresh
				// with whatever `challenges` this session was given.
				<LevelRound
					active={active}
					challenges={screen.challenges}
					onExitToMenu={handleBackToMenu}
					onLevelComplete={handleLevelComplete}
					onOpenPlayground={onOpenPlayground}
				/>
			)}
			{screen.type === "summary" && (
				<LevelSummaryScreen
					active={active}
					level={screen.level}
					stats={screen.stats}
					onBackToMenu={handleBackToMenu}
					onReplayLevel={() => handleReplay(screen.level)}
				/>
			)}
		</main>
	);
}
