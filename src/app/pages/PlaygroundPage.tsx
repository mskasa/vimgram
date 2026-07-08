import { useCallback, useEffect, useRef, useState } from "react";
import { type BufferState, createBuffer } from "../../core/buffer";
import { execute } from "../../core/execute";
import { explain, explainFailure } from "../../core/explain";
import { backspace, escapeInsert, insertChar } from "../../core/insert";
import {
	type InputState,
	initialInputState,
	isUnsupportedIdleKey,
	type ParsedCommand,
	parseKey,
} from "../../core/parser";
import { BufferStage } from "../components/BufferStage";
import { InputRow } from "../components/InputRow";
import { KeyCheatSheet } from "../components/KeyCheatSheet";
import { KeyHintToast } from "../components/KeyHintToast";
import { useUnsupportedKeyHint } from "../hooks/useUnsupportedKeyHint";
import { useLocale, useT } from "../i18n/LocaleContext";
import type { UIStringKey } from "../i18n/strings";
import { domKeyToToken } from "../keyInput";

// Handed from a challenge's result screen (see LevelRound.tsx's "p" keycap)
// to seed the Playground with that challenge's starting text/cursor.
export type PlaygroundSeed = { text: string; cursor: number };

const DEFAULT_SEED: PlaygroundSeed = {
	text: "const foo = bar(1, 2, 3);",
	cursor: 0,
};

// Code-like samples chosen for f/t and text-object practice: a quoted
// assignment (i"/a", f"), a comma list (f,/t,/dw), a function call
// (i)/a), commas), and a quote-vs-quote comparison (i"/a" vs i'/a').
const PRESETS: { labelKey: UIStringKey; text: string }[] = [
	{ labelKey: "playground.presetVariable", text: 'const name = "hoge";' },
	{ labelKey: "playground.presetList", text: "foo, bar, baz" },
	{
		labelKey: "playground.presetFunctionCall",
		text: "myFunction(alpha, beta, gamma);",
	},
	{ labelKey: "playground.presetQuotes", text: "say \"hello\" and 'goodbye';" },
];

function isAsciiOnly(value: string): boolean {
	for (let i = 0; i < value.length; i++) {
		if (value.charCodeAt(i) > 127) return false;
	}
	return true;
}

type HistoryEntry = {
	id: number;
	keys: string;
	description: string;
	failed: boolean;
};

function HistoryRow({ entry }: { entry: HistoryEntry }) {
	return (
		<li
			style={{
				display: "flex",
				alignItems: "baseline",
				gap: "0.6rem",
				padding: "0.6rem 1rem",
				borderBottom: "1px solid var(--border-base)",
				background: entry.failed
					? "color-mix(in srgb, var(--miss) 10%, transparent)"
					: undefined,
			}}
		>
			<kbd className="vg-keycap-key">{entry.keys}</kbd>
			<span
				style={{
					minWidth: 0,
					color: entry.failed ? "var(--miss)" : "var(--text-body)",
				}}
			>
				{entry.description}
			</span>
		</li>
	);
}

export function PlaygroundPage({
	active,
	seed,
}: {
	active: boolean;
	seed: PlaygroundSeed | null;
}) {
	const { locale } = useLocale();
	const t = useT();
	// No dedupe: there's no "round" here, and seeing the hint every time is
	// fine (helpful, even) in a sandbox meant for practicing.
	const { message: unsupportedHint, show: showUnsupportedHint } =
		useUnsupportedKeyHint({ dedupe: false });
	const [buffer, setBuffer] = useState<BufferState>(() =>
		createBuffer(DEFAULT_SEED.text, DEFAULT_SEED.cursor),
	);
	const [inputState, setInputState] = useState<InputState>(initialInputState);
	const [keysTyped, setKeysTyped] = useState("");
	const [history, setHistory] = useState<HistoryEntry[]>([]);
	// What "Reset" restores: the most recently applied text/cursor, not
	// necessarily DEFAULT_SEED - set via a preset, the text field, or a
	// challenge handoff all count as "the text I'm currently working with".
	const [resetTarget, setResetTarget] = useState<PlaygroundSeed>(DEFAULT_SEED);
	const [textFieldValue, setTextFieldValue] = useState(DEFAULT_SEED.text);
	const [asciiWarning, setAsciiWarning] = useState(false);
	const historyIdRef = useRef(0);
	// Not React state - the global keydown listener below reads this
	// synchronously to decide whether a keystroke belongs to the text field
	// or the Vim engine. Focus/blur only ever happen from direct user
	// action, so there's no staleness concern that would call for it to be
	// state instead (see CLAUDE.md "UI 操作": the field owns its own input;
	// this is the seam between it and the engine).
	const fieldFocusedRef = useRef(false);
	// The "c" command awaiting its closing <Esc>, and the cursor position
	// where its Insert session started - together these let <Esc> record one
	// combined "command + inserted text" history entry (see pushInsertHistory
	// below) instead of the command alone. Both are cleared together.
	const pendingCCommandRef = useRef<ParsedCommand | null>(null);
	const insertStartCursorRef = useRef<number | null>(null);

	const applyBuffer = useCallback((next: PlaygroundSeed) => {
		setBuffer(createBuffer(next.text, next.cursor));
		setInputState(initialInputState);
		setKeysTyped("");
		setHistory([]);
		setResetTarget(next);
		setTextFieldValue(next.text);
		setAsciiWarning(false);
		pendingCCommandRef.current = null;
		insertStartCursorRef.current = null;
	}, []);

	// Arrives fresh (a new object) each time the result screen's "p" keycap
	// is pressed (see App.tsx), even for the same challenge twice in a row -
	// object identity alone is enough to detect "a new handoff happened".
	useEffect(() => {
		if (seed) applyBuffer(seed);
	}, [seed, applyBuffer]);

	// Recent-commands log (see CLAUDE.md "UI 操作": プレイグラウンドの直近の
	// コマンド履歴) - only ever fed Normal-mode ParsedCommands (never Insert-
	// mode text or <Esc>), newest first, capped to the last 8. A failed entry
	// replaces the usual operator+motion description with why it failed
	// (see core/explain.ts's explainFailure), since "delete operator, move to
	// next 'z'" is less useful than "not resolved — 'z' not found" once the
	// command didn't actually do anything.
	const pushHistory = useCallback(
		(command: ParsedCommand, failed: boolean) => {
			const { keys, parts } = explain(command, locale);
			const description = failed
				? `${t("playground.unresolvedPrefix")}${explainFailure(command, locale)}`
				: parts.map((part) => part.description).join(" ");
			setHistory((prev) =>
				[
					{ id: historyIdRef.current++, keys, description, failed },
					...prev,
				].slice(0, 8),
			);
		},
		[locale, t],
	);

	// A "c" command's history entry is deferred until its closing <Esc> (see
	// pendingCCommandRef above), then recorded as ONE entry covering the
	// whole "ciwhello<Esc>" session instead of just the initiating "ciw" -
	// the inserted text is itself part of what happened, even though it's
	// never shown live in the input row anymore (see CLAUDE.md "UI 操作").
	// A simple tail truncation at 20 characters is enough here (unlike
	// InputRow's cap, this text is already finalized when the entry is
	// built, not a token stream with mode boundaries to respect).
	const pushInsertHistory = useCallback(
		(command: ParsedCommand, insertedText: string) => {
			const { keys, parts } = explain(command, locale);
			const description = parts.map((part) => part.description).join(" ");
			const truncated =
				insertedText.length > 20
					? `${insertedText.slice(0, 20)}…`
					: insertedText;
			setHistory((prev) =>
				[
					{
						id: historyIdRef.current++,
						keys: `${keys}${truncated}<Esc>`,
						description,
						failed: false,
					},
					...prev,
				].slice(0, 8),
			);
		},
		[locale],
	);

	// Unlike ChallengeRound's keydown handler, this one resubscribes on
	// state change rather than reading everything via refs - there's no
	// result/phase race to guard against here (no rounds, no judging), so
	// the simpler pattern is enough (see CLAUDE.md "コーディング規約").
	useEffect(() => {
		if (!active) return;

		const handleKeyDown = (event: KeyboardEvent) => {
			// The text-set field is the one place in this app where a UI
			// control - not the Vim engine - owns keystrokes (see CLAUDE.md
			// "UI 操作": a deliberate, Playground-only exception, since every
			// key is otherwise reserved for Vim input here).
			if (fieldFocusedRef.current) return;
			const token = domKeyToToken(event.key);
			if (token === null) return;
			event.preventDefault();

			if (buffer.mode === "insert") {
				let nextBuffer: BufferState | null = null;
				if (token === "<Esc>") nextBuffer = escapeInsert(buffer);
				else if (token === "<BS>") nextBuffer = backspace(buffer);
				else if (token.length === 1) nextBuffer = insertChar(buffer, token);
				if (nextBuffer === null) return;
				if (token === "<Esc>" && pendingCCommandRef.current) {
					const insertStart = insertStartCursorRef.current ?? buffer.cursor;
					pushInsertHistory(
						pendingCCommandRef.current,
						buffer.text.slice(insertStart, buffer.cursor),
					);
					pendingCCommandRef.current = null;
					insertStartCursorRef.current = null;
				}
				setBuffer(nextBuffer);
				setKeysTyped((k) => k + token);
				return;
			}

			if (token.length !== 1) return;
			const wasIdle = inputState.phase === "idle";
			const parsed = parseKey(inputState, token);
			setInputState(parsed.state);
			setKeysTyped((k) => k + token);
			const { command } = parsed;
			if (!command) {
				if (isUnsupportedIdleKey(wasIdle, parsed)) {
					if (event.key === "i" || event.key === "a") {
						showUnsupportedHint("insert", t("hint.insertUnsupported"));
					} else {
						showUnsupportedHint("generic", t("hint.unsupportedKey"));
					}
				}
				return;
			}
			const nextBuffer = execute(buffer, command);
			setBuffer(nextBuffer);
			const failed = nextBuffer === buffer;
			if (
				!failed &&
				command.type === "operatorMotion" &&
				command.operator === "c"
			) {
				// Deferred to <Esc> (see pushInsertHistory above) - not pushed here.
				pendingCCommandRef.current = command;
				insertStartCursorRef.current = nextBuffer.cursor;
			} else {
				pushHistory(command, failed);
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [
		active,
		inputState,
		buffer,
		pushHistory,
		pushInsertHistory,
		showUnsupportedHint,
		t,
	]);

	function handleSetText() {
		if (!isAsciiOnly(textFieldValue)) {
			setAsciiWarning(true);
			return;
		}
		applyBuffer({ text: textFieldValue, cursor: 0 });
	}

	return (
		<main
			className="vg-container"
			style={{ fontFamily: "monospace", padding: "2rem 0" }}
		>
			<h1
				style={{
					fontSize: "1.875rem",
					margin: "0 0 1.25rem",
					display: "flex",
					alignItems: "baseline",
					gap: "0.5rem",
					flexWrap: "wrap",
				}}
			>
				{t("nav.playground")}
				<span
					style={{
						fontSize: "var(--font-keyhint)",
						fontWeight: 400,
						color: "var(--text-secondary)",
					}}
				>
					— {t("playground.subtitle")}
				</span>
			</h1>

			<div className="vg-playground-grid">
				<div className="vg-playground-column">
					<BufferStage
						mode={buffer.mode}
						text={buffer.text}
						cursor={buffer.cursor}
						variant="freeform"
						yankRegister={buffer.yankRegister}
					/>
					<InputRow
						keys={keysTyped}
						inputState={inputState}
						mode={buffer.mode}
					/>
					<KeyHintToast message={unsupportedHint} />

					<div className="vg-card" style={{ padding: 0, marginTop: "1.25rem" }}>
						<h2
							style={{
								margin: 0,
								padding: "1rem 1rem 0.5rem",
								fontSize: "var(--font-card-heading)",
								color: "var(--text-secondary)",
							}}
						>
							{t("playground.history")}
						</h2>
						{history.length === 0 ? (
							<p
								style={{
									margin: 0,
									padding: "0 1rem 1rem",
									color: "var(--text-muted)",
								}}
							>
								{t("playground.historyEmpty")}
							</p>
						) : (
							<ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
								{history.map((entry) => (
									<HistoryRow key={entry.id} entry={entry} />
								))}
							</ul>
						)}
					</div>
				</div>

				<div
					className="vg-playground-column"
					style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
				>
					<div className="vg-card">
						<h2
							style={{
								margin: "0 0 0.75rem",
								fontSize: "var(--font-card-heading)",
							}}
						>
							{t("playground.setTextLabel")}
						</h2>
						<div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
							<input
								type="text"
								aria-label={t("playground.setTextLabel")}
								value={textFieldValue}
								onChange={(event) => {
									setTextFieldValue(event.target.value);
									setAsciiWarning(false);
								}}
								onFocus={() => {
									fieldFocusedRef.current = true;
								}}
								onBlur={() => {
									fieldFocusedRef.current = false;
								}}
								onKeyDown={(event) => {
									if (event.key === "Enter") {
										event.preventDefault();
										handleSetText();
									} else if (event.key === "Escape") {
										event.preventDefault();
										event.currentTarget.blur();
									}
								}}
								placeholder={t("playground.setTextPlaceholder")}
								style={{
									flex: "1 1 12rem",
									fontFamily: "inherit",
									fontSize: "inherit",
									background: "var(--bg-key)",
									color: "var(--text-primary)",
									border: "1px solid var(--border-base)",
									borderRadius: "0.375rem",
									padding: "0.4rem 0.7rem",
								}}
							/>
							<button type="button" onClick={handleSetText}>
								{t("playground.set")}
							</button>
							<button type="button" onClick={() => applyBuffer(resetTarget)}>
								{t("playground.reset")}
							</button>
						</div>
						{asciiWarning && (
							<p style={{ color: "var(--warn-star)" }}>
								{t("playground.asciiOnly")}
							</p>
						)}

						<p
							style={{
								color: "var(--text-secondary)",
								fontSize: "var(--font-keyhint)",
								margin: "1rem 0 0.5rem",
							}}
						>
							{t("playground.presets")}
						</p>
						<div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
							{PRESETS.map((preset) => (
								<button
									key={preset.labelKey}
									type="button"
									className="vg-chip"
									onClick={() => applyBuffer({ text: preset.text, cursor: 0 })}
								>
									{t(preset.labelKey)}
								</button>
							))}
						</div>
					</div>

					<KeyCheatSheet />
				</div>
			</div>
		</main>
	);
}
