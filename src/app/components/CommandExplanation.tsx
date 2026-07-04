import type { Explanation } from "../../core/explain";
import { useT } from "../i18n/LocaleContext";

export function CommandExplanation({
	explanation,
}: {
	explanation: Explanation;
}) {
	const t = useT();
	return (
		<div>
			<p>
				{t("explanation.title")}: <code>{explanation.keys}</code>
			</p>
			<ul>
				{explanation.parts.map((part) => (
					<li key={part.keys}>
						<code>{part.keys}</code>: {part.description}
					</li>
				))}
			</ul>
		</div>
	);
}
