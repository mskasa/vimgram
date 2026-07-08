import { buildDisplayTokens } from "../../core/inputDisplay";
import type { InputState } from "../../core/parser";
import { useT } from "../i18n/LocaleContext";
import type { UIStringKey } from "../i18n/strings";

// Named-phase hint per pending InputState - shared by the play screen and
// the Playground (see CLAUDE.md "UI 操作": プレイグラウンドは左ステージに
// プレイ画面と同一の入力表示コンポーネントを使う), so both read a pending
// operator/motion/text-object wait identically.
export function describePendingHint(
	inputState: InputState,
	t: (key: UIStringKey) => string,
): string | null {
	switch (inputState.phase) {
		case "idle":
			return inputState.countBuffer === ""
				? null
				: `${inputState.countBuffer} — ${t("game.pendingCount")}`;
		case "operatorPending":
			return t("game.pendingOperator");
		case "charMotionPending":
			return t("game.pendingCharTarget");
		case "textObjectPending":
			return t("game.pendingTextObjectTarget");
	}
}

const ROW_STYLE = {
	display: "flex",
	alignItems: "center",
	flexWrap: "wrap",
	gap: "0.5rem",
	margin: "0.75rem 0",
} as const;

const LABEL_STYLE = {
	color: "var(--text-secondary)",
	fontSize: "var(--font-keyhint)",
} as const;

// While Insert mode is active, the inserted text is already visible in the
// buffer itself - re-listing it here (character by character, or even as a
// single collapsed chip) would just be duplicated information, so this row
// collapses to a state message instead (see CLAUDE.md "UI 操作"). `count`
// is the caller's own tally of characters inserted so far in this session
// (see LevelRound.tsx's insertStartCursorRef) - omitted entirely (not just
// hidden) on the Playground, which doesn't show a running count.
function InsertStatusRow({ count }: { count: number | undefined }) {
	const t = useT();
	return (
		<div style={ROW_STYLE}>
			<span style={LABEL_STYLE}>{t("game.insertStatus")}</span>
			{count !== undefined && (
				<span style={LABEL_STYLE}>
					{t("game.insertedCountPrefix")}
					{count}
					{t("game.insertedCountSuffix")}
				</span>
			)}
		</div>
	);
}

// Typed tokens as a run of keycaps (matching the result screen's visual
// language, see CommandBreakdown) instead of a raw "input keys: ..." string,
// plus a pending-command hint reusing describePendingHint above. Shows only
// the "入力" label with no keycaps and no placeholder text when nothing has
// been typed yet. Insert-mode characters never appear here at all (see
// InsertStatusRow above) - `mode` picks which of the two rows to render.
export function InputRow({
	keys,
	inputState,
	mode,
	insertedCount,
}: {
	keys: string;
	inputState: InputState;
	mode: "normal" | "insert";
	// Only ever passed by the game screen (see CLAUDE.md "UI 操作": プレイ
	// グラウンドは状態表示のみ、ゲーム画面はそれに加えて挿入文字数を表示).
	insertedCount?: number;
}) {
	const t = useT();

	if (mode === "insert") {
		return <InsertStatusRow count={insertedCount} />;
	}

	const pendingHint = describePendingHint(inputState, t);
	const tokens = keys === "" ? [] : buildDisplayTokens(keys);
	return (
		<div style={ROW_STYLE}>
			<span style={LABEL_STYLE}>{t("game.inputLabel")}</span>
			{/* tokens are rebuilt fresh from `keys` every render (append-only,
			    never reordered), so the index is a stable-enough identity here. */}
			{tokens.map((token, i) => {
				if (token.kind === "ellipsis") {
					return (
						<span key="ellipsis" style={{ color: "var(--text-muted)" }}>
							…
						</span>
					);
				}
				return (
					// biome-ignore lint/suspicious/noArrayIndexKey: tokens are rebuilt fresh from `keys` every render, index is stable enough here
					<kbd key={i} className="vg-keycap-key">
						{token.text}
					</kbd>
				);
			})}
			{pendingHint && <span style={LABEL_STYLE}>{pendingHint}</span>}
		</div>
	);
}
