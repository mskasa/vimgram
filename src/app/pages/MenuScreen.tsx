import { useCallback, useEffect, useMemo, useState } from "react";
import type { Challenge } from "../../core/challenges";
import { resolveMenuKey } from "../../core/keymap";
import type { LevelGroup } from "../../core/levels";
import { summarizeLevelProgress } from "../../core/progress";
import { loadAttempts } from "../attemptStorage";
import { KeyHintRow } from "../components/KeyHint";
import { useT } from "../i18n/LocaleContext";
import type { UIStringKey } from "../i18n/strings";
import { hasModifierKey } from "../keyInput";

const LEVEL_DESCRIPTION_KEYS: Record<number, UIStringKey> = {
	1: "menu.level1Description",
	2: "menu.level2Description",
	3: "menu.level3Description",
	4: "menu.level4Description",
};

export function MenuScreen({
	levelGroups,
	onSelectLevel,
}: {
	levelGroups: LevelGroup[];
	onSelectLevel: (level: Challenge["difficulty"]) => void;
}) {
	const t = useT();
	// Re-read on every visit to this screen (it's freshly mounted each time
	// GamePage switches back to "menu") so progress reflects whatever was
	// just played, without needing to plumb a "did progress change" signal.
	const attempts = useMemo(() => loadAttempts(), []);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [showHelp, setShowHelp] = useState(false);

	// Level cards lay out horizontally (see the flex row below), so h/l
	// (left/right) navigate them, not j/k - matching the row's actual axis.
	const moveLeft = useCallback(
		() => setSelectedIndex((i) => Math.max(i - 1, 0)),
		[],
	);
	const moveRight = useCallback(
		() => setSelectedIndex((i) => Math.min(i + 1, levelGroups.length - 1)),
		[levelGroups.length],
	);
	const playSelected = useCallback(() => {
		const group = levelGroups[selectedIndex];
		if (group) onSelectLevel(group.level);
	}, [levelGroups, selectedIndex, onSelectLevel]);
	const toggleHelp = useCallback(() => setShowHelp((v) => !v), []);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			const action = resolveMenuKey({
				key: event.key,
				hasModifier: hasModifierKey(event),
			});
			if (action === null) return;
			event.preventDefault();
			if (action === "moveLeft") moveLeft();
			else if (action === "moveRight") moveRight();
			else if (action === "select") playSelected();
			else toggleHelp();
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [moveLeft, moveRight, playSelected, toggleHelp]);

	return (
		<>
			<h1>vimgram</h1>
			<p>{t("menu.concept")}</p>

			<h2>{t("menu.chooseLevel")}</h2>
			<div
				style={{
					display: "grid",
					gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
					gap: "1rem",
				}}
			>
				{levelGroups.map((group, i) => (
					<LevelCard
						key={group.level}
						group={group}
						attempts={attempts}
						selected={i === selectedIndex}
						onPlay={() => onSelectLevel(group.level)}
					/>
				))}
			</div>

			{/* Clicking a keycap fires the identical action a keypress would - see
			    CLAUDE.md "UI 操作". No standalone buttons duplicate these. */}
			<KeyHintRow
				items={[
					{
						keyLabel: "h/←",
						label: t("keyHint.moveLeft"),
						onActivate: moveLeft,
					},
					{
						keyLabel: "l/→",
						label: t("keyHint.moveRight"),
						onActivate: moveRight,
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
				<ul>
					<li>{t("menu.howToPlayOperators")}</li>
					<li>{t("menu.howToPlayMotions")}</li>
					<li>{t("menu.howToPlayTextObjects")}</li>
					<li>{t("menu.howToPlayJudging")}</li>
				</ul>
			)}
		</>
	);
}

function LevelCard({
	group,
	attempts,
	selected,
	onPlay,
}: {
	group: LevelGroup;
	attempts: ReturnType<typeof loadAttempts>;
	selected: boolean;
	onPlay: () => void;
}) {
	const t = useT();
	const progress = summarizeLevelProgress(group.challenges, attempts);
	const descriptionKey = LEVEL_DESCRIPTION_KEYS[group.level];

	return (
		<button
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
				<p style={{ margin: 0, color: "var(--text-body)" }}>
					{t(descriptionKey)}
				</p>
			)}
			<p style={{ margin: 0, color: "var(--text-secondary)" }}>
				{t("menu.challengeCount")}: {group.challenges.length}
			</p>
			<div
				style={{
					display: "flex",
					flexWrap: "wrap",
					gap: "1rem",
					marginTop: "0.25rem",
					paddingTop: "0.5rem",
					borderTop: "1px solid var(--border-base)",
				}}
			>
				{progress.clearedCount === 0 ? (
					<span style={{ color: "var(--text-muted)" }}>
						{t("menu.notPlayed")}
					</span>
				) : (
					<>
						<span style={{ color: "var(--success)" }}>
							{t("menu.cleared")}: {progress.clearedCount}/
							{progress.totalChallenges}
						</span>
						<span style={{ color: "var(--warn-star)" }}>
							{t("menu.great")}: {progress.greatCount}/
							{progress.totalChallenges}
						</span>
					</>
				)}
			</div>
		</button>
	);
}
