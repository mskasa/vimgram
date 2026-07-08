import { useEffect, useState } from "react";
import { milestoneKey, type StoredMilestone } from "../../core/milestones";
import { useT } from "../i18n/LocaleContext";
import {
	loadUncelebratedMilestones,
	markMilestonesCelebrated,
} from "../milestoneStorage";
import { describeMilestone } from "../milestoneText";
import {
	loadStarPromptStatus,
	markStarPromptDone,
	markStarPromptMuted,
} from "../starPromptStorage";
import { MilestoneModal } from "./MilestoneModal";
import { REPO_URL } from "./StarButton";

// Self-contained: reads the uncelebrated queue (and the Star prompt's own
// permanent status) once on mount and marks the queue celebrated right
// away, so both integration points (LevelSummaryScreen, the primary
// surface, and MenuScreen, the safety net for sessions that never reach a
// summary) can just render this with no props and no risk of diverging
// load/mark logic (see CLAUDE.md "永続化"). Renders nothing when the queue
// is empty - the common case.
//
// The Star prompt itself only ever appears as the modal (see
// MilestoneModal.tsx), and only while its status is still "active" - once
// the user presses either action key even once, every later milestone gets
// the plain, link-free banner instead, permanently (see CLAUDE.md "永続化":
// スター状態は検証不能のため自己申告を信頼する).
export function MilestoneBanner() {
	const t = useT();
	const [milestones] = useState<StoredMilestone[]>(() =>
		loadUncelebratedMilestones(),
	);
	const [starPromptStatus] = useState(() => loadStarPromptStatus());
	const [dismissed, setDismissed] = useState(false);

	useEffect(() => {
		if (milestones.length > 0) markMilestonesCelebrated(milestones);
	}, [milestones]);

	if (milestones.length === 0 || dismissed) return null;

	if (starPromptStatus === "active") {
		return (
			<MilestoneModal
				milestones={milestones}
				onStar={() => {
					// Opened via a real user keystroke/click, so popup blockers
					// allow it - same as StarButton's plain <a>, just triggered
					// programmatically here instead of a native link click.
					window.open(REPO_URL, "_blank", "noopener,noreferrer");
					markStarPromptDone();
					setDismissed(true);
				}}
				onMute={() => {
					markStarPromptMuted();
					setDismissed(true);
				}}
				onClose={() => setDismissed(true)}
			/>
		);
	}

	return (
		<div
			className="vg-card"
			style={{ border: "2px solid var(--accent)", marginBottom: "1.25rem" }}
		>
			<h3
				style={{
					margin: "0 0 0.5rem",
					color: "var(--accent-soft)",
					fontSize: "var(--font-card-heading)",
				}}
			>
				{t("milestone.bannerTitle")}
			</h3>
			<ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
				{milestones.map((milestone) => (
					<li
						key={milestoneKey(milestone)}
						style={{ color: "var(--text-primary)" }}
					>
						{describeMilestone(milestone, t)}
					</li>
				))}
			</ul>
		</div>
	);
}
