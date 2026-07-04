import { useEffect, useMemo, useState } from "react";
import { type BufferState, createBuffer } from "../../core/buffer";
import { type Challenge, loadChallenges } from "../../core/challenges";
import { execute } from "../../core/execute";
import { explainSequence } from "../../core/explain";
import { type Locale, resolveLocalizedText } from "../../core/i18n";
import { backspace, escapeInsert, insertChar } from "../../core/insert";
import { type JudgeResult, judge } from "../../core/judge";
import { initialInputState, parseKey } from "../../core/parser";
import { BufferView } from "../components/BufferView";
import { CommandExplanation } from "../components/CommandExplanation";
import { useLocale, useT } from "../i18n/LocaleContext";
import { domKeyToToken } from "../keyInput";

const DEFAULT_TIME_LIMIT_SEC = 30;

// Only "great"/"verbose" (both are a successful clear) or "timeout" are ever
// stored as the round's outcome - a mid-play "fail" from judge() just means
// "keep playing", not a terminal state.
type RoundResult =
	| Extract<JudgeResult, { verdict: "great" | "verbose" }>
	| { verdict: "timeout" };

function useChallenges(): Challenge[] {
	return useMemo(
		() =>
			loadChallenges()
				.map(({ challenge }) => challenge)
				.sort(
					(a, b) => a.difficulty - b.difficulty || a.id.localeCompare(b.id),
				),
		[],
	);
}

export function GamePage() {
	const challenges = useChallenges();
	const [index, setIndex] = useState(0);
	const challenge = challenges[index];
	const { locale } = useLocale();
	const t = useT();
	const next = () => setIndex((i) => (i + 1) % challenges.length);

	return (
		<main style={{ fontFamily: "monospace", padding: "2rem" }}>
			<h1>vimgram</h1>
			<p>
				#{index + 1} / {challenges.length} —{" "}
				{resolveLocalizedText(challenge.title, locale)} ({t("game.difficulty")}{" "}
				{challenge.difficulty})
			</p>
			{/* key={challenge.id} forces a full remount on challenge change, so all
			    round state (buffer/keys/timer/result) starts fresh synchronously -
			    no separate "reset" effect, and no one-render lag showing stale state. */}
			<ChallengeRound key={challenge.id} challenge={challenge} onNext={next} />
		</main>
	);
}

function ChallengeRound({
	challenge,
	onNext,
}: {
	challenge: Challenge;
	onNext: () => void;
}) {
	const { locale } = useLocale();
	const t = useT();
	const [buffer, setBuffer] = useState<BufferState>(() =>
		createBuffer(
			challenge.initial.text,
			challenge.initial.cursor,
			challenge.initial.mode,
		),
	);
	const [inputState, setInputState] = useState(initialInputState);
	const [keys, setKeys] = useState("");
	const [result, setResult] = useState<RoundResult | null>(null);
	const [timeLeft, setTimeLeft] = useState(
		challenge.constraints?.timeLimitSec ?? DEFAULT_TIME_LIMIT_SEC,
	);

	useEffect(() => {
		if (result !== null) return;
		if (timeLeft <= 0) {
			setResult({ verdict: "timeout" });
			return;
		}
		const timer = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
		return () => clearTimeout(timer);
	}, [timeLeft, result]);

	useEffect(() => {
		if (result !== null) return;

		const finish = (nextBuffer: BufferState, nextKeys: string) => {
			setKeys(nextKeys);
			setBuffer(nextBuffer);
			const verdict = judge(challenge, nextBuffer, nextKeys);
			if (verdict.verdict === "great" || verdict.verdict === "verbose") {
				setResult(verdict);
			}
		};

		const handleKeyDown = (event: KeyboardEvent) => {
			const token = domKeyToToken(event.key);
			if (token === null) return;
			event.preventDefault();
			const nextKeys = keys + token;

			// Top-level mode branch: Normal mode goes through the parser's state
			// machine + execute(); Insert mode dispatches straight to the core
			// insert.ts functions. Both sides call core-only logic.
			if (buffer.mode === "insert") {
				if (token === "<Esc>") {
					finish(escapeInsert(buffer), nextKeys);
				} else if (token === "<BS>") {
					finish(backspace(buffer), nextKeys);
				} else if (token.length === 1) {
					finish(insertChar(buffer, token), nextKeys);
				}
				return;
			}

			const parsed = parseKey(inputState, token);
			setInputState(parsed.state);
			const { command } = parsed;
			if (!command) {
				setKeys(nextKeys);
				return;
			}
			finish(execute(buffer, command), nextKeys);
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [inputState, buffer, keys, challenge, result]);

	const hints = challenge.hints;

	return (
		<>
			<p>{resolveLocalizedText(challenge.prompt, locale)}</p>
			<p>
				<strong>{buffer.mode === "insert" ? "INSERT" : "NORMAL"}</strong>
			</p>
			<BufferView text={buffer.text} cursor={buffer.cursor} />
			<p>
				{t("game.timeLeft")}: {timeLeft}s / {t("game.keys")}:{" "}
				<code>{keys || t("game.keysNone")}</code>
			</p>
			{hints && hints.length > 0 && (
				<p>
					{t("game.hints")}:{" "}
					{hints.map((hint) => resolveLocalizedText(hint, locale)).join(" / ")}
				</p>
			)}
			{result && (
				<ResultBanner
					result={result}
					challenge={challenge}
					yourKeys={keys}
					locale={locale}
				/>
			)}
			<button type="button" onClick={onNext}>
				{t("game.next")}
			</button>
		</>
	);
}

function ResultBanner({
	result,
	challenge,
	yourKeys,
	locale,
}: {
	result: RoundResult;
	challenge: Challenge;
	yourKeys: string;
	locale: Locale;
}) {
	const t = useT();

	if (result.verdict === "great") {
		const yours = explainSequence(yourKeys, locale);
		return (
			<div>
				<p>
					{t("result.great")} {result.keyCount} keys (ideal:{" "}
					{result.idealKeyCount})
				</p>
				<CommandExplanation explanation={yours} />
			</div>
		);
	}

	const expected = explainSequence(challenge.examples[0], locale);

	if (result.verdict === "verbose") {
		const yours = explainSequence(yourKeys, locale);
		return (
			<div>
				<p>
					{t("result.verbose")}: {result.keyCount} keys (ideal:{" "}
					{result.idealKeyCount})
				</p>
				<p>{t("result.yourInput")}</p>
				<CommandExplanation explanation={yours} />
				<p>{t("result.expectedCommand")}</p>
				<CommandExplanation explanation={expected} />
			</div>
		);
	}

	return (
		<div>
			<p>{t("result.timeout")}</p>
			<p>{t("result.expectedCommand")}</p>
			<CommandExplanation explanation={expected} />
		</div>
	);
}
