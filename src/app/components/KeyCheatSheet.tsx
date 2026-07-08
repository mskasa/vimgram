import {
	type CheatSheetItem,
	listMotions,
	listOperators,
	listTextObjects,
} from "../../core/explain";
import { useLocale, useT } from "../i18n/LocaleContext";
import type { UIStringKey } from "../i18n/strings";

// A <button>, not a <span tabIndex>, so it's keyboard/tap-focusable without
// an a11y lint override - it never fires anything on click (see CLAUDE.md
// スコープ外: 早見表からのクリックでコマンド実行はしない), it's just the one
// native element that's both non-interactive-looking and reachable by tab.
function KeycapTip({ displayKey, description }: Omit<CheatSheetItem, "key">) {
	return (
		<button type="button" className="vg-keycap-tip">
			<kbd className="vg-keycap-key">{displayKey}</kbd>
			<span className="vg-keycap-tip-bubble">{description}</span>
		</button>
	);
}

function CheatGroup({
	titleKey,
	items,
}: {
	titleKey: UIStringKey;
	items: CheatSheetItem[];
}) {
	const t = useT();
	return (
		<div>
			<h3
				style={{
					margin: "0 0 0.5rem",
					fontSize: "var(--font-keyhint)",
					color: "var(--text-secondary)",
				}}
			>
				{t(titleKey)}
			</h3>
			<div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
				{items.map((item) => (
					<KeycapTip
						key={item.key}
						displayKey={item.displayKey}
						description={item.description}
					/>
				))}
			</div>
		</div>
	);
}

// Every group here is generated from src/core/explain.ts's own description
// dictionaries (listOperators/listMotions/listTextObjects), not a
// hand-maintained key list (see CLAUDE.md "UI 操作": 早見表は explain 辞書
// から自動生成する) - a new motion/operator/text-object target added to
// those dictionaries appears here automatically.
export function KeyCheatSheet() {
	const { locale } = useLocale();
	const t = useT();
	return (
		<div className="vg-card">
			<h2
				style={{
					margin: "0 0 1rem",
					fontSize: "var(--font-card-heading)",
				}}
			>
				{t("playground.cheatSheetTitle")}
			</h2>
			<div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
				<CheatGroup
					titleKey="playground.cheatSheetOperators"
					items={listOperators(locale)}
				/>
				<CheatGroup
					titleKey="playground.cheatSheetMotions"
					items={listMotions(locale)}
				/>
				<CheatGroup
					titleKey="playground.cheatSheetTextObjects"
					items={listTextObjects(locale)}
				/>
			</div>
		</div>
	);
}
