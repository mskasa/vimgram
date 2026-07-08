import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChallengeStatsMap } from "../../core/challengeStats";
import type { Challenge } from "../../core/challenges";
import { findNextInDirection, type Rect } from "../../core/gridNav";
import { resolveMenuKey } from "../../core/keymap";
import type { LevelGroup } from "../../core/levels";
import {
	isLevelFullyCleared,
	summarizeLevelProgress,
} from "../../core/progress";
import { buildReviewQueue, type ReviewBucket } from "../../core/reviewQueue";
import { loadChallengeStats } from "../challengeStatsStorage";
import { KeyHintRow } from "../components/KeyHint";
import { MilestoneBanner } from "../components/MilestoneBanner";
import { useT } from "../i18n/LocaleContext";
import type { UIStringKey } from "../i18n/strings";
import { hasModifierKey } from "../keyInput";
import { LEVEL_DESCRIPTION_KEYS } from "../levelDescriptions";

const REVIEW_LABEL_KEYS: Record<ReviewBucket, UIStringKey> = {
	uncleared: "menu.reviewUnclearedLabel",
	notGreat: "menu.reviewNotGreatLabel",
};

const REVIEW_DESCRIPTION_KEYS: Record<ReviewBucket, UIStringKey> = {
	uncleared: "menu.reviewUnclearedDescription",
	notGreat: "menu.reviewNotGreatDescription",
};

// Great is represented iconically (a star), not by a translated word, to
// avoid a mixed-language label like ja "Great数" (see CLAUDE.md "多言語対応":
// this reuses the same ★ glyph as the result screen's Great banner).
const GREAT_ICON = "★";

// The menu's selectable cards form one flat sequence (see CLAUDE.md "UI
// 操作"): level cards first, then the review entries below them - visually
// two groups, logically one list. h/l move through it in this logical
// order; j/k move geometrically instead (see core/gridNav.ts) since the
// grid's column count isn't fixed.
type SelectableItem =
	| { kind: "level"; group: LevelGroup }
	| { kind: "review"; bucket: ReviewBucket; queue: Challenge[] };

function isSelectable(item: SelectableItem): boolean {
	return item.kind === "level" || item.queue.length > 0;
}

export function MenuScreen({
	active,
	levelGroups,
	challenges,
	onSelectLevel,
	onStartReview,
}: {
	active: boolean;
	levelGroups: LevelGroup[];
	challenges: Challenge[];
	onSelectLevel: (level: Challenge["difficulty"]) => void;
	onStartReview: (challenges: Challenge[]) => void;
}) {
	const t = useT();
	// Re-read on every visit to this screen (it's freshly mounted each time
	// GamePage switches back to "menu") so progress reflects whatever was
	// just played, without needing to plumb a "did progress change" signal.
	const stats = useMemo(() => loadChallengeStats(), []);
	// Hidden entirely for a brand new visitor (see CLAUDE.md "復習モード") -
	// an empty stats map means nothing has ever been played, not just that
	// both review buckets happen to be empty right now.
	const hasAnyStats = Object.keys(stats).length > 0;
	const unclearedQueue = useMemo(
		() => (hasAnyStats ? buildReviewQueue(challenges, stats, "uncleared") : []),
		[challenges, stats, hasAnyStats],
	);
	const notGreatQueue = useMemo(
		() => (hasAnyStats ? buildReviewQueue(challenges, stats, "notGreat") : []),
		[challenges, stats, hasAnyStats],
	);

	const items: SelectableItem[] = useMemo(() => {
		const levelItems: SelectableItem[] = levelGroups.map((group) => ({
			kind: "level",
			group,
		}));
		if (!hasAnyStats) return levelItems;
		return [
			...levelItems,
			{ kind: "review", bucket: "uncleared", queue: unclearedQueue },
			{ kind: "review", bucket: "notGreat", queue: notGreatQueue },
		];
	}, [levelGroups, hasAnyStats, unclearedQueue, notGreatQueue]);

	const [selectedIndex, setSelectedIndex] = useState(0);
	const [showHelp, setShowHelp] = useState(false);

	// One entry per item in `items`, populated via each card's `cardRef`
	// prop - read only at keydown time (see moveDown/moveUp below), never
	// watched via a resize observer, since geometry only needs to be current
	// the instant a key is pressed.
	const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);
	const setCardRef = useCallback(
		(index: number) => (el: HTMLButtonElement | null) => {
			cardRefs.current[index] = el;
		},
		[],
	);

	// Steps in `delta`'s direction, skipping disabled (0-count) review
	// entries - they're shown but not selectable (see CLAUDE.md "復習モード").
	// Stops at the array boundary rather than wrapping, matching the level
	// cards' existing clamp-at-edge behavior.
	const moveInDirection = useCallback(
		(from: number, delta: 1 | -1): number => {
			let i = from;
			for (;;) {
				const next = i + delta;
				if (next < 0 || next >= items.length) return i;
				if (isSelectable(items[next])) return next;
				i = next;
			}
		},
		[items],
	);

	// Level cards lay out horizontally (see the flex row below), so h/l
	// (left/right) navigate them in logical order, not by geometry.
	const moveLeft = useCallback(
		() => setSelectedIndex((i) => moveInDirection(i, -1)),
		[moveInDirection],
	);
	const moveRight = useCallback(
		() => setSelectedIndex((i) => moveInDirection(i, 1)),
		[moveInDirection],
	);

	// j/k measure every card's rect fresh at keydown time (see CLAUDE.md "UI
	// 操作": auto-fit の折り返しを前提にした列数の決め打ちをしない) - a card
	// missing its ref (shouldn't happen once mounted) falls back to a
	// degenerate zero rect rather than crashing findNextInDirection.
	const measureRects = useCallback((): Rect[] => {
		return items.map((_, i) => {
			const rect = cardRefs.current[i]?.getBoundingClientRect();
			return rect
				? {
						left: rect.left,
						right: rect.right,
						top: rect.top,
						bottom: rect.bottom,
					}
				: { left: 0, right: 0, top: 0, bottom: 0 };
		});
	}, [items]);
	const moveDown = useCallback(() => {
		setSelectedIndex((i) =>
			findNextInDirection(measureRects(), items.map(isSelectable), i, "down"),
		);
	}, [measureRects, items]);
	const moveUp = useCallback(() => {
		setSelectedIndex((i) =>
			findNextInDirection(measureRects(), items.map(isSelectable), i, "up"),
		);
	}, [measureRects, items]);

	const playSelected = useCallback(() => {
		const item = items[selectedIndex];
		if (!item) return;
		if (item.kind === "level") onSelectLevel(item.group.level);
		else if (item.queue.length > 0) onStartReview(item.queue);
	}, [items, selectedIndex, onSelectLevel, onStartReview]);
	const toggleHelp = useCallback(() => setShowHelp((v) => !v), []);

	useEffect(() => {
		if (!active) return;
		const handleKeyDown = (event: KeyboardEvent) => {
			const action = resolveMenuKey({
				key: event.key,
				hasModifier: hasModifierKey(event),
			});
			if (action === null) return;
			event.preventDefault();
			if (action === "moveLeft") moveLeft();
			else if (action === "moveRight") moveRight();
			else if (action === "moveDown") moveDown();
			else if (action === "moveUp") moveUp();
			else if (action === "select") playSelected();
			else toggleHelp();
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [active, moveLeft, moveRight, moveDown, moveUp, playSelected, toggleHelp]);

	return (
		<>
			<h1 style={{ fontSize: "1.875rem", margin: "0 0 0.5rem" }}>vimgram</h1>
			<p
				style={{
					maxWidth: "600px",
					margin: "0 0 1.25rem",
					color: "var(--text-body)",
				}}
			>
				{t("menu.concept")}
			</p>

			{/* Safety net (see CLAUDE.md "永続化"): catches a milestone that never
			    got shown on the summary screen, e.g. the player left mid-session
			    via Esc before reaching it. Self-contained - loads and marks its
			    own queue, so this is a no-op render when nothing is pending. */}
			<MilestoneBanner />

			<h2 style={{ margin: "0 0 0.75rem" }}>{t("menu.chooseLevel")}</h2>
			<div
				style={{
					display: "grid",
					gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
					alignItems: "stretch",
					gap: "1rem",
				}}
			>
				{levelGroups.map((group, i) => (
					<LevelCard
						key={group.level}
						group={group}
						stats={stats}
						selected={i === selectedIndex}
						onPlay={() => onSelectLevel(group.level)}
						cardRef={setCardRef(i)}
					/>
				))}
			</div>

			{hasAnyStats && (
				<>
					<h2 style={{ margin: "1.5rem 0 0.75rem" }}>
						{t("menu.reviewTitle")}{" "}
						<span
							style={{
								fontSize: "var(--font-body)",
								fontWeight: 400,
								color: "var(--text-secondary)",
							}}
						>
							— {t("menu.reviewSubtitle")}
						</span>
					</h2>
					<div
						style={{
							display: "grid",
							gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
							alignItems: "stretch",
							gap: "1rem",
						}}
					>
						{(["uncleared", "notGreat"] as const).map((bucket, i) => {
							const queue =
								bucket === "uncleared" ? unclearedQueue : notGreatQueue;
							const index = levelGroups.length + i;
							return (
								<ReviewCard
									key={bucket}
									label={t(REVIEW_LABEL_KEYS[bucket])}
									description={t(REVIEW_DESCRIPTION_KEYS[bucket])}
									count={queue.length}
									numberColor={
										bucket === "uncleared" ? "var(--miss)" : "var(--warn-star)"
									}
									selected={index === selectedIndex}
									onPlay={() => onStartReview(queue)}
									cardRef={setCardRef(index)}
								/>
							);
						})}
					</div>
				</>
			)}

			{/* Clicking a keycap fires the identical action a keypress would - see
			    CLAUDE.md "UI 操作". No standalone buttons duplicate these. h/j/k/l
			    render as one tightly-grouped cluster sharing a single "選択" label
			    (see KeyHint.tsx's "group" item type), but each keycap still fires
			    its own real navigation action - "one keycap, one action" holds for
			    every individual key here. Arrow-key aliases (ArrowUp/Down/Left/
			    Right) aren't shown separately to avoid ballooning this to 8 keycaps
			    - h/j/k/l are the primary legend. */}
			<KeyHintRow
				items={[
					{
						kind: "group",
						keys: [
							{ keyLabel: "h", onActivate: moveLeft },
							{ keyLabel: "j", onActivate: moveDown },
							{ keyLabel: "k", onActivate: moveUp },
							{ keyLabel: "l", onActivate: moveRight },
						],
						label: t("keyHint.select"),
					},
					{
						keyLabel: "Enter",
						label: t("menu.play"),
						onActivate: playSelected,
						primary: true,
					},
					{
						keyLabel: "?",
						label: t("menu.howToPlayTitle"),
						onActivate: toggleHelp,
					},
				]}
			/>
			{showHelp && (
				<>
					<ul>
						<li>{t("menu.howToPlayOperators")}</li>
						<li>{t("menu.howToPlayMotions")}</li>
						<li>{t("menu.howToPlayTextObjects")}</li>
						<li>{t("menu.howToPlayJudging")}</li>
						<li>{t("menu.howToPlayPlayground")}</li>
					</ul>
					<h3>{t("menu.howToPlayDifferencesTitle")}</h3>
					<ul>
						<li>{t("menu.howToPlayDifferencesSubset")}</li>
						<li>{t("menu.howToPlayDifferencesInsert")}</li>
						<li>{t("menu.howToPlayDifferencesReason")}</li>
						<li>{t("menu.howToPlayDifferencesOther")}</li>
					</ul>
				</>
			)}
		</>
	);
}

function LevelCard({
	group,
	stats,
	selected,
	onPlay,
	cardRef,
}: {
	group: LevelGroup;
	stats: ChallengeStatsMap;
	selected: boolean;
	onPlay: () => void;
	cardRef: (el: HTMLButtonElement | null) => void;
}) {
	const t = useT();
	const progress = summarizeLevelProgress(group.challenges, stats);
	const descriptionKey = LEVEL_DESCRIPTION_KEYS[group.level];
	// A level only shuffles on replay once it's been fully cleared once (see
	// CLAUDE.md "シャッフル") - shown here so that's not a surprise.
	const willShuffle = isLevelFullyCleared(group.challenges, stats);
	const clearRatio =
		progress.totalChallenges > 0
			? progress.clearedCount / progress.totalChallenges
			: 0;

	return (
		<button
			ref={cardRef}
			type="button"
			onClick={onPlay}
			style={{
				border: selected
					? "2px solid var(--accent)"
					: "1px solid var(--border-base)",
				background: selected ? "var(--bg-card-active)" : "var(--bg-card)",
				borderRadius: "0.75rem",
				padding: "1.25rem",
				width: "100%",
				height: "100%",
				color: "inherit",
				font: "inherit",
				textAlign: "left",
				cursor: "pointer",
				display: "flex",
				flexDirection: "column",
				gap: "0.5rem",
			}}
		>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					gap: "0.5rem",
				}}
			>
				<h3 style={{ margin: 0 }}>
					{t("menu.level")} {group.level}
				</h3>
				{selected && (
					<span
						style={{
							fontSize: "0.75rem",
							color: "var(--bg-base)",
							background: "var(--accent)",
							borderRadius: "999px",
							padding: "0.15rem 0.6rem",
							whiteSpace: "nowrap",
						}}
					>
						{t("menu.selected")}
					</span>
				)}
			</div>
			{descriptionKey && (
				<p style={{ margin: 0, color: "var(--text-body)", flex: 1 }}>
					{t(descriptionKey)}
				</p>
			)}
			<div
				style={{
					marginTop: "0.25rem",
					paddingTop: "0.5rem",
					borderTop: "1px solid var(--border-base)",
				}}
			>
				{progress.clearedCount === 0 ? (
					<p style={{ margin: 0, color: "var(--text-muted)" }}>
						{t("menu.notPlayed")} · {progress.totalChallenges}
						{t("menu.challengeUnit")}
					</p>
				) : (
					<div
						style={{
							display: "flex",
							alignItems: "baseline",
							justifyContent: "space-between",
							gap: "0.5rem",
						}}
					>
						<span style={{ color: "var(--success)" }}>
							{t("menu.cleared")} {progress.clearedCount}/
							{progress.totalChallenges}
							{willShuffle && ` · ${t("menu.shuffled")}`}
						</span>
						<span style={{ color: "var(--warn-star)" }}>
							{GREAT_ICON} {progress.greatCount}
						</span>
					</div>
				)}
				<div className="vg-bar-track" style={{ marginTop: "0.5rem" }}>
					<div
						className="vg-bar-fill"
						style={{ width: `${clearRatio * 100}%` }}
					/>
				</div>
			</div>
		</button>
	);
}

function ReviewCard({
	label,
	description,
	count,
	numberColor,
	selected,
	onPlay,
	cardRef,
}: {
	label: string;
	description: string;
	count: number;
	numberColor: string;
	selected: boolean;
	onPlay: () => void;
	cardRef: (el: HTMLButtonElement | null) => void;
}) {
	const enabled = count > 0;

	return (
		<button
			ref={cardRef}
			type="button"
			onClick={onPlay}
			disabled={!enabled}
			style={{
				border: selected
					? "2px solid var(--accent)"
					: "1px solid var(--border-base)",
				background: selected ? "var(--bg-card-active)" : "var(--bg-card)",
				borderRadius: "0.75rem",
				padding: "1rem 1.25rem",
				width: "100%",
				height: "100%",
				color: enabled ? "inherit" : "var(--text-muted)",
				font: "inherit",
				textAlign: "left",
				cursor: enabled ? "pointer" : "default",
				opacity: enabled ? 1 : 0.55,
				display: "flex",
				alignItems: "center",
				gap: "1rem",
			}}
		>
			<span
				style={{
					fontSize: "1.625rem",
					fontWeight: 700,
					lineHeight: 1,
					color: enabled ? numberColor : "var(--text-muted)",
				}}
			>
				{count}
			</span>
			<div>
				<h3 style={{ margin: 0, fontSize: "var(--font-card-heading)" }}>
					{label}
				</h3>
				<p style={{ margin: "0.2rem 0 0", color: "var(--text-secondary)" }}>
					{description}
				</p>
			</div>
		</button>
	);
}
