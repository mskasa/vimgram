import type { Explanation } from "../../core/explain";

// Non-interactive keycap + description rows for an Explanation - the result
// screen's visual language for "what these keys meant" (see CLAUDE.md "UI
// 操作"). The Playground's command history (see PlaygroundPage.tsx) renders
// its own row shape instead of reusing this - it needs a failure/miss state
// per row, which this component doesn't have.
export function CommandBreakdown({
	explanation,
}: {
	explanation: Explanation;
}) {
	return (
		<div className="vg-breakdown">
			{explanation.parts.map((part) => (
				<div className="vg-breakdown-row" key={part.keys}>
					<kbd className="vg-keycap-key">{part.keys}</kbd>
					<span>{part.description}</span>
				</div>
			))}
		</div>
	);
}
