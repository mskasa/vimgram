import { useEffect, useState } from "react";
import { milestoneKey, type StoredMilestone } from "../../core/milestones";
import { useT } from "../i18n/LocaleContext";
import { describeMilestone } from "../milestoneText";
import { fetchStarCount } from "../starCache";
import { KeyHintRow } from "./KeyHint";

// The app's first true modal (see CLAUDE.md "永続化": Star 促しはこの
// マイルストーン達成モーダルのみ). Keyboard-first per CLAUDE.md "UI 操作",
// but also a game-external dialog, so every action is equally reachable by
// click via the keycap row.
export function MilestoneModal({
	milestones,
	onStar,
	onMute,
	onClose,
}: {
	milestones: StoredMilestone[];
	onStar: () => void;
	onMute: () => void;
	onClose: () => void;
}) {
	const t = useT();
	const [stars, setStars] = useState<number | null>(null);

	useEffect(() => {
		let cancelled = false;
		fetchStarCount().then((count) => {
			if (!cancelled) setStars(count);
		});
		return () => {
			cancelled = true;
		};
	}, []);

	// Capture phase, not bubble: this fires before any listener the screen
	// behind the modal already attached (LevelSummaryScreen/MenuScreen),
	// regardless of mount order (see CLAUDE.md "UI 操作"). Every keydown is
	// stopped unconditionally while the modal is open, not just the 3 keys
	// it recognizes, so the background screen truly can't react to anything -
	// a real focus trap, not just "these particular keys are also bound here".
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			event.stopPropagation();
			event.preventDefault();
			if (event.key === "s" || event.key === "S") onStar();
			else if (event.key === "n" || event.key === "N") onMute();
			else if (event.key === "Enter" || event.key === "Escape") onClose();
		};
		window.addEventListener("keydown", handleKeyDown, true);
		return () => window.removeEventListener("keydown", handleKeyDown, true);
	}, [onStar, onMute, onClose]);

	return (
		<div className="vg-modal-overlay">
			<div className="vg-modal" role="dialog" aria-modal="true">
				<h2
					style={{
						margin: "0 0 0.5rem",
						fontSize: "var(--font-card-heading)",
						color: "var(--accent-soft)",
					}}
				>
					{t("milestone.bannerTitle")}
				</h2>
				<ul style={{ margin: "0 0 0.75rem", paddingLeft: "1.2rem" }}>
					{milestones.map((milestone) => (
						<li
							key={milestoneKey(milestone)}
							style={{ color: "var(--text-primary)" }}
						>
							{describeMilestone(milestone, t)}
						</li>
					))}
				</ul>
				<p style={{ margin: "0 0 0.5rem", color: "var(--text-body)" }}>
					{t("milestone.starPromptMessage")}
				</p>
				{stars !== null && (
					<p style={{ margin: "0 0 1rem", color: "var(--text-secondary)" }}>
						⭐ {stars}
					</p>
				)}
				<KeyHintRow
					items={[
						{
							keyLabel: "s",
							label: t("milestone.starAction"),
							onActivate: onStar,
						},
						{
							keyLabel: "Enter/Esc",
							label: t("keyHint.close"),
							onActivate: onClose,
							primary: true,
						},
						{
							keyLabel: "n",
							label: t("milestone.muteAction"),
							onActivate: onMute,
						},
					]}
				/>
			</div>
		</div>
	);
}
