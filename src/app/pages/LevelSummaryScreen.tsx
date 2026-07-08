import { type ReactNode, useEffect } from "react";
import type { Challenge } from "../../core/challenges";
import { resolveLocalizedText } from "../../core/i18n";
import { resolveSummaryKey } from "../../core/keymap";
import {
	type ChallengeSessionEntry,
	summarizeSessionEntries,
	summaryHeadlineKind,
} from "../../core/sessionSummary";
import { KeyHintRow } from "../components/KeyHint";
import { MilestoneBanner } from "../components/MilestoneBanner";
import { useLocale, useT } from "../i18n/LocaleContext";
import type { UIStringKey } from "../i18n/strings";
import { hasModifierKey } from "../keyInput";
import { LEVEL_DESCRIPTION_KEYS } from "../levelDescriptions";
import type { LevelSessionResult } from "./LevelRound";

// Icon + pill background per row verdict (see CLAUDE.md "UI 操作": 判定バッジ
// はリザルトと同一マッピング). Deliberately --warn-star for Great here (not
// --accent, which the result screen's big banner uses) - matching how the
// menu's level cards already color their own Great count, since this is the
// same "a small, recurring Great indicator" context, not the one-time
// celebration moment the banner is.
const ROW_BADGE: Record<
	ChallengeSessionEntry["verdict"],
	{ icon: string | null; background: string; labelKey: UIStringKey }
> = {
	great: {
		icon: "★",
		background: "var(--warn-star)",
		labelKey: "session.great",
	},
	verbose: {
		icon: "✓",
		background: "var(--success)",
		labelKey: "result.verboseHeadline",
	},
	// Neutral, on purpose (see CLAUDE.md "永続化"): an assisted clear is
	// honest but isn't a real clear anywhere in this app, so it gets neither
	// the success family nor the failure family's color.
	assisted: {
		icon: null,
		background: "var(--text-muted)",
		labelKey: "levelSummary.badgeAssisted",
	},
	timeout: {
		icon: null,
		background: "var(--miss)",
		labelKey: "levelSummary.badgeFailed",
	},
	gaveUp: {
		icon: null,
		background: "var(--miss)",
		labelKey: "levelSummary.badgeFailed",
	},
	skipped: {
		icon: null,
		background: "var(--miss)",
		labelKey: "levelSummary.badgeFailed",
	},
};

const KEY_INFO_KEY: Partial<
	Record<ChallengeSessionEntry["verdict"], UIStringKey>
> = {
	timeout: "levelSummary.timeoutShort",
	gaveUp: "levelSummary.gaveUpShort",
	skipped: "levelSummary.skippedShort",
};

function isFailed(verdict: ChallengeSessionEntry["verdict"]): boolean {
	return verdict === "timeout" || verdict === "gaveUp" || verdict === "skipped";
}

function Badge({ verdict }: { verdict: ChallengeSessionEntry["verdict"] }) {
	const t = useT();
	const { icon, background, labelKey } = ROW_BADGE[verdict];
	return (
		<span
			style={{
				display: "inline-flex",
				alignItems: "center",
				gap: "0.3rem",
				fontSize: "var(--font-keyhint)",
				fontWeight: 700,
				color: "var(--bg-base)",
				background,
				opacity: verdict === "verbose" ? 0.85 : 1,
				borderRadius: "999px",
				padding: "0.2rem 0.7rem",
				whiteSpace: "nowrap",
			}}
		>
			{icon && <span>{icon}</span>}
			{t(labelKey)}
		</span>
	);
}

function ChallengeRow({
	index,
	entry,
}: {
	index: number;
	entry: ChallengeSessionEntry;
}) {
	const t = useT();
	const { locale } = useLocale();
	const failed = isFailed(entry.verdict);
	const keyInfoKey = KEY_INFO_KEY[entry.verdict];
	const keyInfo = keyInfoKey
		? t(keyInfoKey)
		: `${entry.keyCount}/${entry.idealKeyCount} ${t("levelSummary.keysUnit")}`;

	return (
		<li
			style={{
				display: "flex",
				alignItems: "center",
				gap: "1rem",
				padding: "0.75rem 1rem",
				borderBottom: "1px solid var(--border-base)",
				background: failed
					? "color-mix(in srgb, var(--miss) 10%, transparent)"
					: undefined,
			}}
		>
			<span
				style={{
					color: "var(--text-muted)",
					fontSize: "var(--font-keyhint)",
					minWidth: "2.5rem",
				}}
			>
				#{index + 1}
			</span>
			<span style={{ flex: 1, minWidth: 0, color: "var(--text-primary)" }}>
				{resolveLocalizedText(entry.title, locale)}
			</span>
			<span
				style={{
					color: "var(--text-secondary)",
					fontSize: "var(--font-keyhint)",
					whiteSpace: "nowrap",
				}}
			>
				{keyInfo}
			</span>
			<Badge verdict={entry.verdict} />
		</li>
	);
}

function MetricCard({
	title,
	color,
	children,
	barRatio,
}: {
	title: string;
	color: string;
	children: ReactNode;
	barRatio?: number;
}) {
	return (
		<div className="vg-card">
			<h3
				style={{
					margin: "0 0 0.5rem",
					fontSize: "var(--font-card-heading)",
					color: "var(--text-secondary)",
				}}
			>
				{title}
			</h3>
			<div
				style={{
					display: "flex",
					alignItems: "baseline",
					gap: "0.4rem",
					fontSize: "1.625rem",
					fontWeight: 700,
					color,
				}}
			>
				{children}
			</div>
			{barRatio !== undefined && (
				<div className="vg-bar-track" style={{ marginTop: "0.6rem" }}>
					<div
						className="vg-bar-fill"
						style={{ width: `${barRatio * 100}%` }}
					/>
				</div>
			)}
		</div>
	);
}

export function LevelSummaryScreen({
	active,
	level,
	stats,
	onBackToMenu,
	onReplayLevel,
}: {
	active: boolean;
	level: Challenge["difficulty"] | null;
	stats: LevelSessionResult;
	onBackToMenu: () => void;
	onReplayLevel: () => void;
}) {
	const t = useT();

	useEffect(() => {
		if (!active) return;
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
	}, [active, onBackToMenu, onReplayLevel]);

	// The single source of truth for the headline branch and every count
	// shown below - see core/sessionSummary.ts. Never derived separately from
	// `stats`'s own numeric fields, so the headline can't say "cleared" while
	// the breakdown list still shows a timeout (see CLAUDE.md "UI 操作": 見出し
	// は実結果と食い違う文言を使わない).
	const summary = summarizeSessionEntries(stats.entries);
	const kind = summaryHeadlineKind(summary);

	let headline: string;
	let headlineColor: string;
	let subtext: string | null = null;
	if (kind === "allGreat") {
		headline = t("levelSummary.allGreatHeadline");
		headlineColor = "var(--accent)";
	} else if (kind === "cleared") {
		headline = t("levelSummary.clearedHeadline");
		headlineColor = "var(--success)";
		// Always > 0 here: "cleared" means every challenge cleared but NOT
		// every one was great (otherwise summaryHeadlineKind would have
		// returned "allGreat" instead) - the two branches are mutually
		// exclusive by construction.
		subtext = `${t("levelSummary.notGreatPrefix")}${summary.notGreatClearedCount}${t("levelSummary.notGreatSuffix")}`;
	} else {
		headline = t("levelSummary.partialHeadline");
		headlineColor = "var(--text-primary)";
		// Everything still outstanding was actually cleared, just after
		// viewing the answer - "N more to clear" would be misleading (they
		// DID clear them), so this gets its own encouraging subtext instead
		// (see CLAUDE.md "永続化": 回答閲覧後クリアの扱い). A session with a
		// genuine failure/skip mixed in keeps the plain "N more" wording.
		const realFailureCount = summary.notClearedCount - summary.assistedCount;
		subtext =
			summary.assistedCount > 0 && realFailureCount === 0
				? `${t("levelSummary.assistedRemainingPrefix")}${summary.assistedCount}${t("levelSummary.assistedRemainingSuffix")}`
				: `${t("levelSummary.remainingPrefix")}${summary.notClearedCount}${t("levelSummary.remainingSuffix")}`;
	}
	if (level === null) headline += t("levelSummary.reviewSuffix");

	const levelDescriptionKey =
		level !== null ? LEVEL_DESCRIPTION_KEYS[level] : undefined;

	return (
		<>
			<p
				style={{
					fontSize: "0.8125rem",
					color: "var(--text-muted)",
					margin: "0.5rem 0",
				}}
			>
				{level === null
					? t("menu.reviewTitle")
					: `${t("menu.level")} ${level}${
							levelDescriptionKey ? ` — ${t(levelDescriptionKey)}` : ""
						}`}
			</p>
			<h1
				style={{
					fontSize: "1.875rem",
					margin: "0 0 0.25rem",
					color: headlineColor,
				}}
			>
				{headline}
			</h1>
			{subtext && (
				<p style={{ margin: "0 0 1rem", color: "var(--text-secondary)" }}>
					{subtext}
				</p>
			)}
			<MilestoneBanner />

			<div className="vg-card-grid" style={{ marginTop: 0 }}>
				<MetricCard
					title={t("session.cleared")}
					color="var(--success)"
					barRatio={
						summary.total > 0 ? summary.clearedCount / summary.total : 0
					}
				>
					{summary.clearedCount}{" "}
					<span style={{ fontSize: "1rem" }}>/ {summary.total}</span>
				</MetricCard>
				<MetricCard title={t("session.great")} color="var(--warn-star)">
					★ {summary.greatCount}
				</MetricCard>
				<MetricCard title={t("session.totalTime")} color="var(--text-primary)">
					{(stats.totalElapsedMs / 1000).toFixed(1)}s
				</MetricCard>
			</div>

			<h2 style={{ margin: "1.5rem 0 0.75rem" }}>
				{t("levelSummary.breakdownTitle")}
			</h2>
			<div className="vg-card" style={{ padding: 0 }}>
				<ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
					{stats.entries.map((entry, i) => (
						<ChallengeRow key={entry.challengeId} index={i} entry={entry} />
					))}
				</ul>
			</div>

			<hr className="vg-divider" />
			<KeyHintRow
				items={[
					{
						keyLabel: "Enter",
						label: t("common.backToMenu"),
						onActivate: onBackToMenu,
						primary: true,
					},
					{
						keyLabel: "r",
						label: t("levelSummary.replay"),
						onActivate: onReplayLevel,
					},
				]}
			/>
		</>
	);
}
