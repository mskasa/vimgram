import { useCallback, useEffect, useRef, useState } from "react";
import { usedCommandTypes } from "../../core/attempt";
import { type BufferState, createBuffer } from "../../core/buffer";
import { type Challenge, idealKeyCount } from "../../core/challenges";
import { execute } from "../../core/execute";
import { explainSequence } from "../../core/explain";
import { type Locale, resolveLocalizedText } from "../../core/i18n";
import { backspace, escapeInsert, insertChar } from "../../core/insert";
import { type JudgeResult, judge } from "../../core/judge";
import { resolvePlayingKey, routeKeydown } from "../../core/keymap";
import { tokenizeKeys } from "../../core/keys";
import {
	initialInputState,
	type ParsedCommand,
	parseKey,
} from "../../core/parser";
import { computeScore, nextStreak, type RoundVerdict } from "../../core/score";
import { recordAttempt } from "../attemptStorage";
import { BufferView } from "../components/BufferView";
import { CommandExplanation } from "../components/CommandExplanation";
import { KeyHintRow } from "../components/KeyHint";
import { useLocale, useT } from "../i18n/LocaleContext";
import { domKeyToToken, hasModifierKey } from "../keyInput";

const DEFAULT_TIME_LIMIT_SEC = 30;

// Only "great"/"verbose" (both are a successful clear), "timeout", or
// "gaveUp" are ever stored as the round's outcome - a mid-play "fail" from
// judge() just means "keep playing", not a terminal state.
type RoundResult =
	| Extract<JudgeResult, { verdict: "great" | "verbose" }>
	| { verdict: "timeout" }
	| { verdict: "gaveUp" };

type RoundOutcome = { verdict: RoundVerdict; score: number | null };

export type LevelSessionStats = {
	attempted: number;
	cleared: number;
	great: number;
	totalScore: number;
};
const INITIAL_SESSION_STATS: LevelSessionStats = {
	attempted: 0,
	cleared: 0,
	great: 0,
	totalScore: 0,
};

// Plays through one level's challenges in order, then hands the aggregated
// stats to onLevelComplete instead of wrapping back to its own first
// challenge - the game's top-level GamePage owns what happens after a level
// (the summary screen), not this component.
export function LevelRound({
	challenges,
	onExitToMenu,
	onLevelComplete,
}: {
	challenges: Challenge[];
	onExitToMenu: () => void;
	onLevelComplete: (stats: LevelSessionStats) => void;
}) {
	const [index, setIndex] = useState(0);
	// Bumped by "retry" (see ChallengeRound's result-phase keys) to force a
	// fresh ChallengeRound mount for the SAME challenge - retrying doesn't
	// advance `index`, it just needs a way to reset all of the round's state
	// the same way moving to a new challenge already does (see the `key` below).
	const [retryNonce, setRetryNonce] = useState(0);
	const challenge = challenges[index];
	const { locale } = useLocale();
	const t = useT();
	const [streak, setStreak] = useState(0);
	const [session, setSession] = useState<LevelSessionStats>(
		INITIAL_SESSION_STATS,
	);

	const handleRoundEnd = (outcome: RoundOutcome) => {
		const cleared =
			outcome.verdict === "great" || outcome.verdict === "verbose";
		setStreak((s) => nextStreak(s, outcome.verdict));
		setSession((prev) => ({
			attempted: prev.attempted + 1,
			cleared: prev.cleared + (cleared ? 1 : 0),
			great: prev.great + (outcome.verdict === "great" ? 1 : 0),
			totalScore: prev.totalScore + (outcome.score ?? 0),
		}));
	};

	// Reads the just-updated `session` on the next render (see handleRoundEnd)
	// rather than recomputing it here - `next` only fires after the result
	// banner (and thus the round's own onRoundEnd call) has already rendered.
	const next = () => {
		if (index + 1 >= challenges.length) {
			onLevelComplete(session);
		} else {
			setIndex((i) => i + 1);
		}
	};

	const retry = () => setRetryNonce((n) => n + 1);

	// Undoes an accidental skip (or just revisits an earlier challenge) by
	// stepping index back - no Attempt is recorded for this, since arriving
	// at a challenge isn't a round outcome. A no-op at index 0.
	const back = () => setIndex((i) => Math.max(i - 1, 0));

	return (
		<>
			<p>
				{t("menu.level")} {challenge.difficulty} — #{index + 1} /{" "}
				{challenges.length} — {resolveLocalizedText(challenge.title, locale)}
			</p>
			{/* key includes retryNonce (not just challenge.id) so a retry forces the
			    same full-remount reset that moving to a new challenge already gets -
			    round state (buffer/keys/timer/result) starts fresh synchronously,
			    with no separate "reset" effect. */}
			<ChallengeRound
				key={`${challenge.id}:${retryNonce}`}
				challenge={challenge}
				onNext={next}
				onRetry={retry}
				onBack={back}
				onExitToMenu={onExitToMenu}
				streak={streak}
				onRoundEnd={handleRoundEnd}
			/>
			<p>
				<button type="button" onClick={onExitToMenu}>
					{t("common.backToMenu")}
				</button>
			</p>
		</>
	);
}

function ChallengeRound({
	challenge,
	onNext,
	onRetry,
	onBack,
	onExitToMenu,
	streak,
	onRoundEnd,
}: {
	challenge: Challenge;
	onNext: () => void;
	onRetry: () => void;
	onBack: () => void;
	onExitToMenu: () => void;
	streak: number;
	onRoundEnd: (outcome: RoundOutcome) => void;
}) {
	const { locale } = useLocale();
	const t = useT();
	const timeLimitSec =
		challenge.constraints?.timeLimitSec ?? DEFAULT_TIME_LIMIT_SEC;
	const [buffer, setBuffer] = useState<BufferState>(() =>
		createBuffer(
			challenge.initial.text,
			challenge.initial.cursor,
			challenge.initial.mode,
		),
	);
	const [inputState, setInputState] = useState(initialInputState);
	const [keys, setKeys] = useState("");
	const [commands, setCommands] = useState<ParsedCommand[]>([]);
	const [mistakes, setMistakes] = useState(0);
	const [result, setResult] = useState<RoundResult | null>(null);
	const [timeLeft, setTimeLeft] = useState(timeLimitSec);
	const [score, setScore] = useState<number | null>(null);
	// Computed once, synchronously, alongside score (see endRound) - NOT
	// re-derived from the `streak` prop at render time in ResultBanner. That
	// prop gets bumped by the parent right after onRoundEnd fires, so a
	// display-time `nextStreak(streak, verdict)` would apply the +1 twice
	// once the parent's update lands (e.g. showing 2 after your very first clear).
	const [displayStreak, setDisplayStreak] = useState(streak);

	// Ends the round exactly once, synchronously, from wherever it happens
	// (the keydown handler for great/verbose, the timer effect for timeout) -
	// computing score and recording the Attempt right alongside setResult
	// instead of in a separate effect. A separate "on result change" effect
	// would (a) show the ResultBanner for one render with no score yet
	// (score is only known after an effect runs later) and (b) risk re-firing:
	// onRoundEnd isn't memoized by the parent, so calling it changes its own
	// identity on the next render, which would re-trigger an effect keyed on it.
	const endRound = useCallback(
		(
			verdict: RoundResult,
			finalKeys: string,
			finalMistakes: number,
			finalCommands: ParsedCommand[],
			finalTimeLeft: number,
			meta?: { revealed?: boolean; skipped?: boolean },
		) => {
			setResult(verdict);
			setDisplayStreak(nextStreak(streak, verdict.verdict));
			const success =
				verdict.verdict === "great" || verdict.verdict === "verbose";
			let roundScore: number | null = null;
			if (success) {
				roundScore = computeScore({
					remainingTimeMs: finalTimeLeft * 1000,
					idealKeys: idealKeyCount(challenge),
					actualKeys: tokenizeKeys(finalKeys).length,
					streak,
					mistakes: finalMistakes,
				});
				setScore(roundScore);
			}
			recordAttempt({
				challengeId: challenge.id,
				input: finalKeys,
				success,
				elapsedMs: (timeLimitSec - finalTimeLeft) * 1000,
				keyCount: tokenizeKeys(finalKeys).length,
				mistakeCount: finalMistakes,
				usedCommandTypes: usedCommandTypes(finalCommands),
				...(meta?.revealed ? { revealed: true as const } : {}),
				...(meta?.skipped ? { skipped: true as const } : {}),
			});
			onRoundEnd({ verdict: verdict.verdict, score: roundScore });
		},
		[challenge, streak, onRoundEnd, timeLimitSec],
	);

	// Skip abandons the challenge with no explanation and no result banner
	// (distinct from give-up, which shows one) - it's recorded purely for
	// weak-point analysis and otherwise behaves exactly like it did before
	// that recording existed: same call as the post-result "next".
	const skip = () => {
		recordAttempt({
			challengeId: challenge.id,
			input: keys,
			success: false,
			elapsedMs: (timeLimitSec - timeLeft) * 1000,
			keyCount: tokenizeKeys(keys).length,
			mistakeCount: mistakes,
			usedCommandTypes: usedCommandTypes(commands),
			skipped: true,
		});
		onNext();
	};

	// Give-up is the only route to seeing the answer for free of active
	// play - it's recorded as a failure (revealed: true) like any other loss,
	// per CLAUDE.md "正誤判定と評価": no free way to view the expected command.
	const giveUp = () => {
		endRound({ verdict: "gaveUp" }, keys, mistakes, commands, timeLeft, {
			revealed: true,
		});
	};

	// Refs mirror the latest value of everything the keydown handler below
	// needs, updated every render. The handler is registered ONCE for this
	// challenge's whole lifetime (see the effect's [challenge] deps - `challenge`
	// itself never actually changes without a remount, since retry/next both
	// change the `key` on this component) instead of resubscribing on every
	// keystroke. That's not just an efficiency nicety: a resubscribing effect
	// (the previous design, keyed on `result` among other things) tears the
	// listener down and re-adds it right as `result` flips from null to
	// non-null - a fast keystroke landing exactly in that gap (e.g. mashing
	// Enter the instant a round ends) could be dropped. A single persistent
	// listener that reads `resultRef.current` at call time has no such gap;
	// see routeKeydown in core/keymap.ts and its "phase read at call time" test.
	const bufferRef = useRef(buffer);
	bufferRef.current = buffer;
	const inputStateRef = useRef(inputState);
	inputStateRef.current = inputState;
	const keysRef = useRef(keys);
	keysRef.current = keys;
	const mistakesRef = useRef(mistakes);
	mistakesRef.current = mistakes;
	const commandsRef = useRef(commands);
	commandsRef.current = commands;
	const resultRef = useRef(result);
	resultRef.current = result;
	const timeLeftRef = useRef(timeLeft);
	timeLeftRef.current = timeLeft;
	const endRoundRef = useRef(endRound);
	endRoundRef.current = endRound;
	const onNextRef = useRef(onNext);
	onNextRef.current = onNext;
	const onRetryRef = useRef(onRetry);
	onRetryRef.current = onRetry;
	const onBackRef = useRef(onBack);
	onBackRef.current = onBack;
	const onExitToMenuRef = useRef(onExitToMenu);
	onExitToMenuRef.current = onExitToMenu;
	const skipRef = useRef(skip);
	skipRef.current = skip;
	const giveUpRef = useRef(giveUp);
	giveUpRef.current = giveUp;

	useEffect(() => {
		if (result !== null) return;
		if (timeLeft <= 0) {
			endRound(
				{ verdict: "timeout" },
				keysRef.current,
				mistakesRef.current,
				commandsRef.current,
				timeLeft,
			);
			return;
		}
		const timer = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
		return () => clearTimeout(timer);
	}, [timeLeft, result, endRound]);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			const routing = routeKeydown(
				resultRef.current !== null ? "result" : "playing",
				{
					key: event.key,
					hasModifier: hasModifierKey(event),
				},
			);
			if (routing.target === "ignored") return;

			if (routing.target === "result") {
				event.preventDefault();
				if (routing.action === "next") onNextRef.current();
				else if (routing.action === "retry") onRetryRef.current();
				else onExitToMenuRef.current();
				return;
			}

			// routing.target === "command": either a playing meta-key
			// (skip/giveUp/retry/back) or Normal/Insert-mode entry. Meta-keys
			// only apply in Normal mode with no operator/f/t/text-object pending
			// (inputState.phase === "idle") - "s"/"?"/"r" are all valid f/t
			// *target characters*, so a player mid-motion (e.g. just pressed
			// "f") still gets real Vim behavior instead of having their search
			// hijacked. In Insert mode none of these is consulted at all, so
			// they're all typed as literal replacement text. Esc keeps its
			// existing meaning here (Insert-mode exit, or a no-op cancel of a
			// pending Normal-mode count/operator) - it is never routed to
			// onExitToMenu while playing, only once a result is showing (see
			// routeKeydown/resolveResultKey).
			const buffer = bufferRef.current;
			if (buffer.mode === "normal" && inputStateRef.current.phase === "idle") {
				const playingAction = resolvePlayingKey({
					key: event.key,
					hasModifier: hasModifierKey(event),
				});
				if (playingAction === "skip") {
					event.preventDefault();
					skipRef.current();
					return;
				}
				if (playingAction === "giveUp") {
					event.preventDefault();
					giveUpRef.current();
					return;
				}
				if (playingAction === "retry") {
					event.preventDefault();
					onRetryRef.current();
					return;
				}
				if (playingAction === "back") {
					event.preventDefault();
					onBackRef.current();
					return;
				}
			}

			const token = domKeyToToken(event.key);
			if (token === null) return;
			event.preventDefault();
			const nextKeys = keysRef.current + token;

			if (buffer.mode === "insert") {
				let nextBuffer: BufferState | null = null;
				if (token === "<Esc>") nextBuffer = escapeInsert(buffer);
				else if (token === "<BS>") nextBuffer = backspace(buffer);
				else if (token.length === 1) nextBuffer = insertChar(buffer, token);
				if (nextBuffer === null) return;
				setKeys(nextKeys);
				setBuffer(nextBuffer);
				const verdict = judge(challenge, nextBuffer, nextKeys);
				if (verdict.verdict === "great" || verdict.verdict === "verbose") {
					endRoundRef.current(
						verdict,
						nextKeys,
						mistakesRef.current,
						commandsRef.current,
						timeLeftRef.current,
					);
				}
				return;
			}

			const parsed = parseKey(inputStateRef.current, token);
			setInputState(parsed.state);
			const { command } = parsed;
			if (!command) {
				setKeys(nextKeys);
				return;
			}
			const nextBuffer = execute(buffer, command);
			// execute() returns the exact same buffer reference when a command's
			// motion/text-object fails to resolve (see execute.ts's `!result.found`
			// branches) - a fresh object is always constructed on success, even if
			// the values end up identical. That reference equality is precisely
			// "was this command a mistake" (found: false), with no need to change
			// execute()'s return shape to track it separately.
			const nextMistakes =
				mistakesRef.current + (nextBuffer === buffer ? 1 : 0);
			const nextCommands = [...commandsRef.current, command];
			setMistakes(nextMistakes);
			setCommands(nextCommands);
			setKeys(nextKeys);
			setBuffer(nextBuffer);
			const verdict = judge(challenge, nextBuffer, nextKeys);
			if (verdict.verdict === "great" || verdict.verdict === "verbose") {
				endRoundRef.current(
					verdict,
					nextKeys,
					nextMistakes,
					nextCommands,
					timeLeftRef.current,
				);
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [challenge]);

	const hints = challenge.hints;

	return (
		<>
			<p
				style={{
					fontSize: "var(--font-prompt)",
					fontWeight: 600,
					color: "var(--text-highlight)",
					margin: "0.5rem 0 1rem",
				}}
			>
				{resolveLocalizedText(challenge.prompt, locale)}
			</p>
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
			{result ? (
				<ResultBanner
					result={result}
					challenge={challenge}
					yourKeys={keys}
					locale={locale}
					score={score}
					displayStreak={displayStreak}
					onNext={onNext}
					onRetry={onRetry}
					onExitToMenu={onExitToMenu}
				/>
			) : (
				<KeyHintRow
					items={[
						{ keyLabel: "s", label: t("keyHint.skip"), onActivate: skip },
						{ keyLabel: "?", label: t("keyHint.giveUp"), onActivate: giveUp },
						{ keyLabel: "r", label: t("keyHint.retry"), onActivate: onRetry },
						{ keyLabel: "[", label: t("keyHint.back"), onActivate: onBack },
					]}
				/>
			)}
		</>
	);
}

function ResultBanner({
	result,
	challenge,
	yourKeys,
	locale,
	score,
	displayStreak,
	onNext,
	onRetry,
	onExitToMenu,
}: {
	result: RoundResult;
	challenge: Challenge;
	yourKeys: string;
	locale: Locale;
	score: number | null;
	displayStreak: number;
	onNext: () => void;
	onRetry: () => void;
	onExitToMenu: () => void;
}) {
	const t = useT();
	const keyHint = (
		<KeyHintRow
			items={[
				{
					keyLabel: "Enter",
					label: t("keyHint.next"),
					onActivate: onNext,
					primary: true,
				},
				{ keyLabel: "r", label: t("keyHint.retry"), onActivate: onRetry },
				{
					keyLabel: "Esc",
					label: t("common.backToMenu"),
					onActivate: onExitToMenu,
				},
			]}
		/>
	);

	if (result.verdict === "great" || result.verdict === "verbose") {
		const yours = explainSequence(yourKeys, locale);
		const scoreLine = (
			<p>
				{t("result.score")}: {score} / {t("result.streak")}: {displayStreak}
			</p>
		);
		if (result.verdict === "great") {
			return (
				<div>
					<p>
						{t("result.great")} {result.keyCount} keys (ideal:{" "}
						{result.idealKeyCount})
					</p>
					{scoreLine}
					<CommandExplanation explanation={yours} />
					{keyHint}
				</div>
			);
		}
		const expected = explainSequence(challenge.examples[0], locale);
		return (
			<div>
				<p>
					{t("result.verbose")}: {result.keyCount} keys (ideal:{" "}
					{result.idealKeyCount})
				</p>
				{scoreLine}
				<p>{t("result.yourInput")}</p>
				<CommandExplanation explanation={yours} />
				<p>{t("result.expectedCommand")}</p>
				<CommandExplanation explanation={expected} />
				{keyHint}
			</div>
		);
	}

	// "timeout" and "gaveUp" share the same explanation body - only the
	// headline differs (see CLAUDE.md "正誤判定と評価": both are failures,
	// but a player should be able to tell "ran out of time" apart from
	// "asked to see the answer").
	const expected = explainSequence(challenge.examples[0], locale);
	const headline =
		result.verdict === "timeout" ? "result.timeout" : "result.gaveUp";
	return (
		<div>
			<p>{t(headline)}</p>
			<p>{t("result.expectedCommand")}</p>
			<CommandExplanation explanation={expected} />
			{keyHint}
		</div>
	);
}
