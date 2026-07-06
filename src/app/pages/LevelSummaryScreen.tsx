import { useEffect } from "react";
import type { Challenge } from "../../core/challenges";
import { resolveSummaryKey } from "../../core/keymap";
import { KeyHintRow } from "../components/KeyHint";
import { StarButton } from "../components/StarButton";
import { useT } from "../i18n/LocaleContext";
import { hasModifierKey } from "../keyInput";
import type { LevelSessionStats } from "./LevelRound";

export function LevelSummaryScreen({
	level,
	stats,
	isFirstFullClear,
	onBackToMenu,
	onReplayLevel,
}: {
	level: Challenge["difficulty"];
	stats: LevelSessionStats;
	isFirstFullClear: boolean;
	onBackToMenu: () => void;
	onReplayLevel: () => void;
}) {
	const t = useT();

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			const action = resolveSummaryKey({
				key: event.key,
				hasModifier: hasModifierKey(event),
			});
			if (action === null) return;
			event.preventDefault();
			if (action === "backToMenu") onBackToMenu();
			else onReplayLevel();
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [onBackToMenu, onReplayLevel]);

	return (
		<>
			<h1>{t("levelSummary.title")}</h1>
			<p>
				{t("menu.level")} {level}
			</p>
			<p>
				{t("session.title")} — {t("session.attempted")}: {stats.attempted} /{" "}
				<span style={{ color: "var(--success)" }}>
					{t("session.cleared")}: {stats.cleared}
				</span>{" "}
				/{" "}
				<span style={{ color: "var(--warn-star)" }}>
					{t("session.great")}: {stats.great}
				</span>{" "}
				/ {t("session.totalScore")}: {stats.totalScore}
			</p>
			{isFirstFullClear && (
				<p>
					{t("levelSummary.firstClear")} <StarButton />
				</p>
			)}
			<KeyHintRow
				items={[
					{
						keyLabel: "Enter",
						label: t("common.backToMenu"),
						onActivate: onBackToMenu,
						primary: true,
					},
					{ keyLabel: "r", label: t("menu.play"), onActivate: onReplayLevel },
				]}
			/>
		</>
	);
}
