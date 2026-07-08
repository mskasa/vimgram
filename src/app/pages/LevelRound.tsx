import {
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { usedCommandTypes } from "../../core/attempt";
import { type BufferState, createBuffer } from "../../core/buffer";
import type { Challenge } from "../../core/challenges";
import { execute } from "../../core/execute";
import { type Explanation, explainSequence } from "../../core/explain";
import { type Locale, resolveLocalizedText } from "../../core/i18n";
import { backspace, escapeInsert, insertChar } from "../../core/insert";
import { type JudgeResult, judge } from "../../core/judge";
import { resolvePlayingKey, routeKeydown } from "../../core/keymap";
import { tokenizeKeys } from "../../core/keys";
import {
	initialInputState,
	isUnsupportedIdleKey,
	type ParsedCommand,
	parseKey,
} from "../../core/parser";
import type { ChallengeSessionEntry } from "../../core/sessionSummary";
import { nextStreak, type RoundVerdict } from "../../core/streak";
import { diffText } from "../../core/textDiff";
import { recordAttempt } from "../attemptStorage";
import { recordChallengeStatsForOutcome } from "../challengeStatsStorage";
import { BufferStage } from "../components/BufferStage";
import { BufferView } from "../components/BufferView";
import { CommandBreakdown } from "../components/CommandBreakdown";
import { InputRow } from "../components/InputRow";
import { KeyHintRow } from "../components/KeyHint";
import { KeyHintToast } from "../components/KeyHintToast";
import { useUnsupportedKeyHint } from "../hooks/useUnsupportedKeyHint";
import { useLocale, useT } from "../i18n/LocaleContext";
import { domKeyToToken, hasModifierKey } from "../keyInput";
import { markRevealed, wasRevealed } from "../revealedTracker";
import type { PlaygroundSeed } from "./PlaygroundPage";

const DEFAULT_TIME_LIMIT_SEC = 30;

// The raw shape produced by judge() (great/verbose) or a timeout/give-up -
// what the keydown handler and the timeout effect pass into endRound. It
// says nothing about "assisted" yet; endRound computes that itself (see
// wasRevealed below) rather than asking every call site to know about it.
type RawRoundVerdict =
	| Extract<JudgeResult, { verdict: "great" | "verbose" }>
	| { verdict: "timeout" }
	| { verdict: "gaveUp" };

// What's actually stored as the round's result and shown by ResultBanner.
// Only "great"/"verbose" (both are a successful clear), "timeout", or
// "gaveUp" are ever stored - a mid-play "fail" from judge() just means "keep
// playing", not a terminal state. `assisted` is only meaningful (and only
// ever `true`) on a great/verbose clear reached after this same challenge
// was revealed via give-up earlier this session (see CLAUDE.md "永続化":
// 回答閲覧後クリアの扱い) - it overrides the display (see ResultBanner)
// without changing which judge() verdict was actually reached underneath.
type RoundResult =
	| (Extract<JudgeResult, { verdict: "great" | "verbose" }> & {
			assisted: boolean;
	  })
	| { verdict: "timeout" }
	| { verdict: "gaveUp" };

type RoundOutcome = {
	verdict: RoundVerdict;
	// Precise wall-clock time this round took (see endRound's `startedAtRef`),
	// always present regardless of verdict - display-time gating on whether
	// to show it (great/verbose/assisted only, never timeout/gaveUp) happens
	// in ResultBanner, not here.
	elapsedMs: number;
	assisted: boolean;
};

export type LevelSessionStats = {
	attempted: number;
	cleared: number;
	great: number;
	// Sum of elapsedMs across REAL clears only (great/verbose) - an assisted
	// clear doesn't count toward attainment anywhere else in this app (see
	// CLAUDE.md "永続化": 回答閲覧後クリアの扱い), so it's excluded here too
	// for the same reason `cleared`/`great` exclude it.
	totalElapsedMs: number;
};
const INITIAL_SESSION_STATS: LevelSessionStats = {
	attempted: 0,
	cleared: 0,
	great: 0,
	totalElapsedMs: 0,
};

// What LevelSummaryScreen actually receives: the numeric aggregate plus the
// full per-challenge breakdown (see CLAUDE.md "UI 操作": サマリの問題別内訳)
// in session order. `entries` is the single source of truth for the summary
// screen's headline branch and metric cards (see core/sessionSummary.ts) -
// `LevelSessionStats`'s own numeric fields stay as they were (streak/timing
// bookkeeping during play), since totalElapsedMs isn't derivable from
// entries alone (entries don't carry per-round timing).
export type LevelSessionResult = LevelSessionStats & {
	entries: ChallengeSessionEntry[];
};

// Plays through one level's challenges in order, then hands the aggregated
// stats to onLevelComplete instead of wrapping back to its own first
// challenge - the game's top-level GamePage owns what happens after a level
// (the summary screen), not this component.
export function LevelRound({
	active,
	challenges,
	onExitToMenu,
	onLevelComplete,
	onOpenPlayground,
}: {
	active: boolean;
	challenges: Challenge[];
	onExitToMenu: () => void;
	onLevelComplete: (result: LevelSessionResult) => void;
	onOpenPlayground: (seed: PlaygroundSeed) => void;
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
	// Keyed by `index`, not challengeId - a session-internal retry re-records
	// at the SAME index, so the latest attempt naturally overwrites any
	// earlier one for that challenge (see CLAUDE.md "UI 操作": セッション内
	// リトライは最後の試行を最終結果とする). A ref, not state: nothing needs
	// to re-render while the level is in progress, only `next()` reads it,
	// once, at level completion.
	const sessionEntriesRef = useRef<Record<number, ChallengeSessionEntry>>({});
	const recordSessionEntry = useCallback(
		(idx: number, entry: ChallengeSessionEntry) => {
			sessionEntriesRef.current[idx] = entry;
		},
		[],
	);

	const handleRoundEnd = (outcome: RoundOutcome) => {
		// An assisted clear leaves the streak exactly where give-up already
		// reset it (0), and doesn't count as "cleared"/"great" in the session
		// metric cards either - it isn't a real clear anywhere in this app
		// (see CLAUDE.md "永続化": 回答閲覧後クリアの扱い).
		const cleared =
			!outcome.assisted &&
			(outcome.verdict === "great" || outcome.verdict === "verbose");
		const great = !outcome.assisted && outcome.verdict === "great";
		setStreak((s) => (outcome.assisted ? s : nextStreak(s, outcome.verdict)));
		setSession((prev) => ({
			attempted: prev.attempted + 1,
			cleared: prev.cleared + (cleared ? 1 : 0),
			great: prev.great + (great ? 1 : 0),
			totalElapsedMs: prev.totalElapsedMs + (cleared ? outcome.elapsedMs : 0),
		}));
	};

	// Reads the just-updated `session` on the next render (see handleRoundEnd)
	// rather than recomputing it here - `next` only fires after the result
	// banner (and thus the round's own onRoundEnd call) has already rendered.
	// `sessionEntriesRef` is likewise guaranteed up to date: it's written
	// synchronously by endRound/skip, both of which complete before the
	// player can press the key that calls `next`.
	const next = () => {
		if (index + 1 >= challenges.length) {
			const entries = challenges
				.map((_, i) => sessionEntriesRef.current[i])
				.filter((e): e is ChallengeSessionEntry => e !== undefined);
			onLevelComplete({ ...session, entries });
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
			{/* Context line (see CLAUDE.md "UI 操作": コンテキスト → お題 →
			    バッファカード → 入力表示 → 静音フッター) - deliberately small and
			    muted so it never competes with the prompt or the buffer stage. */}
			<p
				style={{
					fontSize: "0.8125rem",
					color: "var(--text-muted)",
					margin: "0.5rem 0",
				}}
			>
				{t("menu.level")} {challenge.difficulty} — #{index + 1} /{" "}
				{challenges.length} — {resolveLocalizedText(challenge.title, locale)}
			</p>
			{/* key includes retryNonce (not just challenge.id) so a retry forces the
			    same full-remount reset that moving to a new challenge already gets -
			    round state (buffer/keys/timer/result) starts fresh synchronously,
			    with no separate "reset" effect. */}
			<ChallengeRound
				key={`${challenge.id}:${retryNonce}`}
				active={active}
				challenge={challenge}
				onNext={next}
				onRetry={retry}
				onBack={back}
				onExitToMenu={onExitToMenu}
				onOpenPlayground={onOpenPlayground}
				streak={streak}
				onRoundEnd={handleRoundEnd}
				onChallengeRecorded={(entry) => recordSessionEntry(index, entry)}
			/>
		</>
	);
}

function ChallengeRound({
	active,
	challenge,
	onNext,
	onRetry,
	onBack,
	onExitToMenu,
	onOpenPlayground,
	streak,
	onRoundEnd,
	onChallengeRecorded,
}: {
	active: boolean;
	challenge: Challenge;
	onNext: () => void;
	onRetry: () => void;
	onBack: () => void;
	onExitToMenu: () => void;
	onOpenPlayground: (seed: PlaygroundSeed) => void;
	streak: number;
	onRoundEnd: (outcome: RoundOutcome) => void;
	onChallengeRecorded: (entry: ChallengeSessionEntry) => void;
}) {
	const { locale } = useLocale();
	const t = useT();
	// Dedupe on: the same teaching hint (e.g. "i doesn't insert here") shows
	// at most once per round, so repeatedly reaching for it doesn't nag.
	const { message: unsupportedHint, show: showUnsupportedHint } =
		useUnsupportedKeyHint({ dedupe: true });
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
	const [elapsedMs, setElapsedMs] = useState<number | null>(null);
	// A precise wall-clock start time for this round, distinct from the
	// coarse per-second `timeLeft` countdown (which exists only for the timer
	// bar display). This is what recordAttempt's elapsedMs and the result
	// banner's displayed time both derive from (see CLAUDE.md "経過時間表示と
	// 記録"). Resets naturally on retry: ChallengeRound remounts fresh (see
	// the `key` in LevelRound.tsx), so a new render starts a new clock.
	const startedAtRef = useRef(Date.now());
	// Computed once, synchronously, alongside elapsedMs (see endRound) - NOT
	// re-derived from the `streak` prop at render time in ResultBanner. That
	// prop gets bumped by the parent right after onRoundEnd fires, so a
	// display-time `nextStreak(streak, verdict)` would apply the +1 twice
	// once the parent's update lands (e.g. showing 2 after your very first clear).
	const [displayStreak, setDisplayStreak] = useState(streak);

	// Ends the round exactly once, synchronously, from wherever it happens
	// (the keydown handler for great/verbose, the timer effect for timeout) -
	// recording the Attempt right alongside setResult instead of in a
	// separate effect. A separate "on result change" effect would (a) show
	// the ResultBanner for one render with no elapsed time yet (it's only
	// known after an effect runs later) and (b) risk re-firing: onRoundEnd
	// isn't memoized by the parent, so calling it changes its own identity on
	// the next render, which would re-trigger an effect keyed on it.
	const endRound = useCallback(
		(
			rawVerdict: RawRoundVerdict,
			finalKeys: string,
			finalMistakes: number,
			finalCommands: ParsedCommand[],
			meta?: { revealed?: boolean; skipped?: boolean },
		) => {
			const success =
				rawVerdict.verdict === "great" || rawVerdict.verdict === "verbose";
			// Assisted: this challenge was revealed via give-up earlier this app
			// session (see revealedTracker.ts), and this attempt reached a real
			// clear anyway. It's an honest, well-earned success, but not a Great
			// and not a "real" clear for attainment/proficiency purposes (see
			// CLAUDE.md "永続化": 回答閲覧後クリアの扱い) - the display, streak,
			// and challengeStats update all branch on this flag below.
			const assisted = success && wasRevealed(challenge.id);
			const verdict: RoundResult = success
				? { ...rawVerdict, assisted }
				: rawVerdict;
			setResult(verdict);
			setDisplayStreak(
				assisted ? streak : nextStreak(streak, rawVerdict.verdict),
			);
			const great = success && !assisted && rawVerdict.verdict === "great";
			const roundElapsedMs = Date.now() - startedAtRef.current;
			if (success) setElapsedMs(roundElapsedMs);
			recordAttempt({
				challengeId: challenge.id,
				input: finalKeys,
				success,
				elapsedMs: roundElapsedMs,
				keyCount: tokenizeKeys(finalKeys).length,
				mistakeCount: finalMistakes,
				usedCommandTypes: usedCommandTypes(finalCommands),
				great,
				...(assisted ? { assisted: true as const } : {}),
				...(meta?.revealed ? { revealed: true as const } : {}),
				...(meta?.skipped ? { skipped: true as const } : {}),
			});
			recordChallengeStatsForOutcome({
				challengeId: challenge.id,
				timestamp: Date.now(),
				// `null` for an assisted success (or, elsewhere, a skip) means
				// "record that an attempt happened, but don't move
				// clears/greats/lastOutcome" - see CLAUDE.md "永続化".
				outcome: assisted
					? null
					: !success
						? "fail"
						: great
							? "great"
							: "redundant",
			});
			onChallengeRecorded({
				challengeId: challenge.id,
				title: challenge.title,
				verdict: assisted ? "assisted" : rawVerdict.verdict,
				...(rawVerdict.verdict === "great" || rawVerdict.verdict === "verbose"
					? {
							keyCount: rawVerdict.keyCount,
							idealKeyCount: rawVerdict.idealKeyCount,
						}
					: {}),
			});
			onRoundEnd({
				verdict: rawVerdict.verdict,
				elapsedMs: roundElapsedMs,
				assisted,
			});
		},
		[challenge, streak, onRoundEnd, onChallengeRecorded],
	);

	// Skip abandons the challenge with no explanation and no result banner
	// (distinct from give-up, which shows one) - it's recorded purely for
	// weak-point analysis and otherwise behaves exactly like it did before
	// that recording existed: same call as the post-result "next". It still
	// counts as "played" for challengeStats/review purposes (attempts > 0,
	// clears === 0) - see CLAUDE.md "復習モード". `outcome: null` means the
	// skip doesn't move lastOutcome either (see CLAUDE.md "永続化": スキップは
	// lastOutcome を更新しない).
	const skip = () => {
		recordAttempt({
			challengeId: challenge.id,
			input: keys,
			success: false,
			elapsedMs: Date.now() - startedAtRef.current,
			keyCount: tokenizeKeys(keys).length,
			mistakeCount: mistakes,
			usedCommandTypes: usedCommandTypes(commands),
			great: false,
			skipped: true,
		});
		recordChallengeStatsForOutcome({
			challengeId: challenge.id,
			timestamp: Date.now(),
			outcome: null,
		});
		onChallengeRecorded({
			challengeId: challenge.id,
			title: challenge.title,
			verdict: "skipped",
		});
		onNext();
	};

	// Give-up is the only route to seeing the answer for free of active
	// play - it's recorded as a failure (revealed: true) like any other loss,
	// per CLAUDE.md "正誤判定と評価": no free way to view the expected command.
	const giveUp = () => {
		// Marked BEFORE endRound, not after - a give-up's own result is a
		// failure either way, but this is what makes a LATER clear on this
		// same challenge (this session) count as assisted (see
		// revealedTracker.ts and endRound's `wasRevealed` check above).
		markRevealed(challenge.id);
		endRound({ verdict: "gaveUp" }, keys, mistakes, commands, {
			revealed: true,
		});
	};

	// Hands the challenge's own starting text/cursor to the Playground (see
	// ResultBanner's "p" keycap) - doesn't touch this round's own state at
	// all, so the result banner is exactly as the player left it if they
	// come back (see App.tsx: both pages stay mounted).
	const openPlayground = () => {
		onOpenPlayground({
			text: challenge.initial.text,
			cursor: challenge.initial.cursor,
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
	// The cursor position where the current Insert session started (see
	// InputRow's "挿入中: n文字" count) - set when a "c" operatorMotion
	// resolves, read as buffer.cursor - this while buffer.mode === "insert".
	// null whenever Insert mode isn't (or is no longer) active.
	const insertStartCursorRef = useRef<number | null>(null);
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
	const openPlaygroundRef = useRef(openPlayground);
	openPlaygroundRef.current = openPlayground;
	const tRef = useRef(t);
	tRef.current = t;
	const showUnsupportedHintRef = useRef(showUnsupportedHint);
	showUnsupportedHintRef.current = showUnsupportedHint;
	// Whether the "game" tab is the one currently visible (see App.tsx: both
	// pages stay mounted so a Playground detour doesn't lose this round's
	// state). Gates both effects below so a hidden ChallengeRound never
	// intercepts keystrokes meant for Playground, and its timer doesn't
	// drain while nobody's looking at it.
	const activeRef = useRef(active);
	activeRef.current = active;

	useEffect(() => {
		if (!active) return;
		if (result !== null) return;
		if (timeLeft <= 0) {
			endRound(
				{ verdict: "timeout" },
				keysRef.current,
				mistakesRef.current,
				commandsRef.current,
			);
			return;
		}
		const timer = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
		return () => clearTimeout(timer);
	}, [active, timeLeft, result, endRound]);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (!activeRef.current) return;
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
				else if (routing.action === "playground") openPlaygroundRef.current();
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
				if (token === "<Esc>") {
					nextBuffer = escapeInsert(buffer);
					insertStartCursorRef.current = null;
				} else if (token === "<BS>") nextBuffer = backspace(buffer);
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
					);
				}
				return;
			}

			const wasIdle = inputStateRef.current.phase === "idle";
			const parsed = parseKey(inputStateRef.current, token);
			setInputState(parsed.state);
			const { command } = parsed;
			if (!command) {
				setKeys(nextKeys);
				if (isUnsupportedIdleKey(wasIdle, parsed)) {
					if (event.key === "i" || event.key === "a") {
						showUnsupportedHintRef.current(
							"insert",
							tRef.current("hint.insertUnsupported"),
						);
					} else {
						showUnsupportedHintRef.current(
							"generic",
							tRef.current("hint.unsupportedKey"),
						);
					}
				}
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
			if (
				nextBuffer !== buffer &&
				command.type === "operatorMotion" &&
				command.operator === "c"
			) {
				insertStartCursorRef.current = nextBuffer.cursor;
			}
			setMistakes(nextMistakes);
			setCommands(nextCommands);
			setKeys(nextKeys);
			setBuffer(nextBuffer);
			const verdict = judge(challenge, nextBuffer, nextKeys);
			if (verdict.verdict === "great" || verdict.verdict === "verbose") {
				endRoundRef.current(verdict, nextKeys, nextMistakes, nextCommands);
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [challenge]);

	const hints = challenge.hints;
	// Recomputed on every render, not stored as its own state - it only ever
	// needs to be current at render time, and buffer.cursor (which already
	// triggers a render on every insertChar/backspace) is all it depends on.
	const insertedCount =
		buffer.mode === "insert" && insertStartCursorRef.current !== null
			? Math.max(0, buffer.cursor - insertStartCursorRef.current)
			: undefined;

	// Once a result is showing, everything about "the live round" (buffer
	// stage, input row, hints, unsupported-key toast) has lost its meaning -
	// see CLAUDE.md "UI 操作": リザルトは判定バナー中心の3層構造とし、ラウンド
	// 終了後に意味を失う情報は出さない。The prompt line survives as a small,
	// muted context line instead of disappearing entirely.
	return (
		<>
			<p
				style={
					result
						? {
								fontSize: "var(--font-keyhint)",
								color: "var(--text-muted)",
								margin: "0.5rem 0 1rem",
							}
						: {
								fontSize: "var(--font-prompt)",
								fontWeight: 600,
								color: "var(--text-highlight)",
								margin: "0.5rem 0 1rem",
							}
				}
			>
				{resolveLocalizedText(challenge.prompt, locale)}
			</p>
			{!result && (
				<>
					<BufferStage
						mode={buffer.mode}
						text={buffer.text}
						cursor={buffer.cursor}
						variant="timed"
						timeLeft={timeLeft}
						timeLimitSec={timeLimitSec}
					/>
					<InputRow
						keys={keys}
						inputState={inputState}
						mode={buffer.mode}
						insertedCount={insertedCount}
					/>
					<KeyHintToast message={unsupportedHint} />
					{hints && hints.length > 0 && (
						<p>
							{t("game.hints")}:{" "}
							{hints
								.map((hint) => resolveLocalizedText(hint, locale))
								.join(" / ")}
						</p>
					)}
				</>
			)}
			{result ? (
				<ResultBanner
					result={result}
					challenge={challenge}
					yourKeys={keys}
					finalBuffer={buffer}
					locale={locale}
					elapsedMs={elapsedMs}
					displayStreak={displayStreak}
					onNext={onNext}
					onRetry={onRetry}
					onExitToMenu={onExitToMenu}
					onOpenPlayground={openPlayground}
				/>
			) : (
				<>
					<hr className="vg-divider" />
					<div className="vg-footer-row">
						<KeyHintRow
							items={[
								{ keyLabel: "s", label: t("keyHint.skip"), onActivate: skip },
								{
									keyLabel: "?",
									label: t("keyHint.giveUp"),
									onActivate: giveUp,
								},
								{
									keyLabel: "r",
									label: t("keyHint.retry"),
									onActivate: onRetry,
								},
								{ keyLabel: "[", label: t("keyHint.back"), onActivate: onBack },
							]}
						/>
						{/* The only standalone button left in the app (see CLAUDE.md "UI
						    操作"): a deliberate exception, not a Step 17-0 style duplicate -
						    Esc is reserved for Insert-mode exit while playing, so there is
						    no keycap this could duplicate. It disappears once a result is
						    showing, where ResultBanner's own Esc keycap is the sole "back to
						    menu" affordance. */}
						<button
							type="button"
							className="vg-textlink"
							onClick={onExitToMenu}
						>
							{t("common.backToMenu")}
						</button>
					</div>
				</>
			)}
		</>
	);
}

// What the banner actually renders as - "assisted" overrides great/verbose
// for display purposes (see CLAUDE.md "永続化": 回答閲覧後クリアの扱い), so
// this is derived from `result.verdict` + `result.assisted` in ResultBanner,
// not read directly off RoundResult["verdict"].
type DisplayKind = "great" | "verbose" | "assisted" | "timeout" | "gaveUp";

// Icon + border/headline color per verdict (see CLAUDE.md "UI 操作"):
// Great uses the warm accent (one of its 4 allowed uses), a plain clear uses
// --success, and failures (timeout/gaveUp) use the new --miss token. Verbose
// clears reuse --success but at 1px/neutral-headline to read as visibly
// quieter than a fastest-possible clear. Assisted is deliberately neutral
// (--border-strong/--text-primary) - neither the success family nor the
// failure family, since it's honest but not a "real" clear anywhere in this
// app.
const VERDICT_ICONS: Record<DisplayKind, string> = {
	great: "★",
	verbose: "✓",
	assisted: "✓",
	timeout: "⏱",
	gaveUp: "⚑",
};

const VERDICT_STYLES: Record<
	DisplayKind,
	{ border: string; borderWidth: string; text: string }
> = {
	great: {
		border: "var(--accent)",
		borderWidth: "2px",
		text: "var(--accent-soft)",
	},
	verbose: {
		border: "var(--success)",
		borderWidth: "1px",
		text: "var(--text-primary)",
	},
	assisted: {
		border: "var(--border-strong)",
		borderWidth: "1px",
		text: "var(--text-primary)",
	},
	timeout: { border: "var(--miss)", borderWidth: "2px", text: "var(--miss)" },
	gaveUp: { border: "var(--miss)", borderWidth: "2px", text: "var(--miss)" },
};

// Layer 1: the verdict banner, the star of the result screen (see CLAUDE.md
// "UI 操作" 3層構造) - icon + headline + subtext on the left, elapsed
// time/streak (only for a successful clear) on the right.
function VerdictBanner({
	displayKind,
	headline,
	subtext,
	elapsedMs,
	displayStreak,
}: {
	displayKind: DisplayKind;
	headline: string;
	subtext: string | null;
	elapsedMs: number | null;
	displayStreak: number;
}) {
	const t = useT();
	const style = VERDICT_STYLES[displayKind];
	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				flexWrap: "wrap",
				gap: "1rem",
				border: `${style.borderWidth} solid ${style.border}`,
				borderRadius: "0.75rem",
				padding: "1rem 1.25rem",
				background: "var(--bg-card)",
			}}
		>
			<div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
				<span style={{ fontSize: "1.75rem", color: style.text }}>
					{VERDICT_ICONS[displayKind]}
				</span>
				<div>
					<div
						style={{
							fontSize: "var(--font-verdict)",
							fontWeight: 700,
							color: style.text,
						}}
					>
						{headline}
					</div>
					{subtext && (
						<div
							style={{
								fontSize: "var(--font-body)",
								color: "var(--text-secondary)",
								marginTop: "0.2rem",
							}}
						>
							{subtext}
						</div>
					)}
				</div>
			</div>
			{elapsedMs !== null && (
				<div
					style={{
						textAlign: "right",
						display: "flex",
						flexDirection: "column",
						gap: "0.2rem",
					}}
				>
					<div>
						{t("result.time")} {(elapsedMs / 1000).toFixed(1)}s
					</div>
					<div>
						{t("result.streak")} {displayStreak}
					</div>
				</div>
			)}
		</div>
	);
}

function DiffLine({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
			<span
				style={{
					fontSize: "var(--font-keyhint)",
					color: "var(--text-secondary)",
				}}
			>
				{label}
			</span>
			{children}
		</div>
	);
}

// Layer 2, left card: derives the before/after view purely from the
// challenge's initial text and the final buffer state - no new data (see
// CLAUDE.md "UI 操作"). The deleted middle span is struck through on the
// "before" line; the "after" line reuses BufferView's own cursor-highlighting
// so the final cursor position is visible exactly as it was in play.
function TextChangeCard({
	before,
	after,
	finalCursor,
}: {
	before: string;
	after: string;
	finalCursor: number;
}) {
	const t = useT();
	const diff = diffText(before, after);
	return (
		<div className="vg-card">
			<h3
				style={{ margin: "0 0 0.75rem", fontSize: "var(--font-card-heading)" }}
			>
				{t("result.textChangeTitle")}
			</h3>
			<div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
				<DiffLine label={t("result.before")}>
					<code>
						{diff.prefix}
						<del
							style={{
								color: "var(--text-muted)",
								textDecoration: "line-through",
							}}
						>
							{diff.removed}
						</del>
						{diff.suffix}
					</code>
				</DiffLine>
				<DiffLine label={t("result.after")}>
					<BufferView text={after} cursor={finalCursor} size="compact" />
				</DiffLine>
			</div>
		</div>
	);
}

// Layer 2, right card: keycap + description rows (CommandBreakdown), not the
// bullet list CommandExplanation uses elsewhere - that component stays as-is
// for the Playground's live breakdown, which this redesign doesn't touch.
// `yours` is null for timeout/gaveUp (no successful input to show); when
// both are present (verbose clear), the player's own input is shown above
// the expected command, preserving the same information the old layout had.
function InputCard({
	yours,
	expected,
}: {
	yours: Explanation | null;
	expected: Explanation | null;
}) {
	const t = useT();
	return (
		<div className="vg-card">
			{yours && (
				<>
					<h3
						style={{
							margin: "0 0 0.5rem",
							fontSize: "var(--font-card-heading)",
						}}
					>
						{t("result.yourInput")}: <code>{yours.keys}</code>
					</h3>
					<CommandBreakdown explanation={yours} />
				</>
			)}
			{yours && expected && <hr className="vg-divider" />}
			{expected && (
				<>
					<h3
						style={{
							margin: "0 0 0.5rem",
							fontSize: "var(--font-card-heading)",
						}}
					>
						{t("result.expectedCommand")}: <code>{expected.keys}</code>
					</h3>
					<CommandBreakdown explanation={expected} />
				</>
			)}
		</div>
	);
}

function ResultBanner({
	result,
	challenge,
	yourKeys,
	finalBuffer,
	locale,
	elapsedMs,
	displayStreak,
	onNext,
	onRetry,
	onExitToMenu,
	onOpenPlayground,
}: {
	result: RoundResult;
	challenge: Challenge;
	yourKeys: string;
	finalBuffer: BufferState;
	locale: Locale;
	elapsedMs: number | null;
	displayStreak: number;
	onNext: () => void;
	onRetry: () => void;
	onExitToMenu: () => void;
	onOpenPlayground: () => void;
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
					keyLabel: "p",
					label: t("keyHint.playground"),
					onActivate: onOpenPlayground,
				},
				{
					keyLabel: "Esc",
					label: t("common.backToMenu"),
					onActivate: onExitToMenu,
				},
			]}
		/>
	);

	const success = result.verdict === "great" || result.verdict === "verbose";
	const assisted = success && result.assisted;
	const displayKind: DisplayKind = assisted ? "assisted" : result.verdict;
	const yours = explainSequence(yourKeys, locale);
	// Great skips showing the expected command when it's a REAL Great -
	// there's nothing shorter to teach (see CLAUDE.md "正誤判定と評価"). An
	// assisted clear always shows it, even when the underlying judge()
	// verdict happened to be "great" (typing back the revealed answer),
	// since re-seeing the breakdown is the whole point of the practice hint.
	const expected =
		result.verdict === "great" && !assisted
			? null
			: explainSequence(challenge.examples[0], locale);

	let headline: string;
	let subtext: string | null = null;
	if (assisted) {
		headline = t("result.assistedHeadline");
		subtext = t("result.assistedHint");
	} else if (result.verdict === "great") {
		headline = t("result.great");
		subtext = `${t("result.keyCountLabel")}: ${result.keyCount} / ${t("result.idealKeyCountLabel")}: ${result.idealKeyCount}`;
	} else if (result.verdict === "verbose") {
		headline = t("result.verboseHeadline");
		subtext = `${t("result.shorterSolutionHint")} (${t("result.keyCountLabel")}: ${result.keyCount} / ${t("result.idealKeyCountLabel")}: ${result.idealKeyCount})`;
	} else if (result.verdict === "timeout") {
		headline = t("result.timeout");
	} else {
		headline = t("result.gaveUp");
	}

	return (
		<div>
			<VerdictBanner
				displayKind={displayKind}
				headline={headline}
				subtext={subtext}
				elapsedMs={success ? elapsedMs : null}
				displayStreak={displayStreak}
			/>
			<div className="vg-card-grid">
				<TextChangeCard
					before={challenge.initial.text}
					after={finalBuffer.text}
					finalCursor={finalBuffer.cursor}
				/>
				<InputCard yours={success ? yours : null} expected={expected} />
			</div>
			<hr className="vg-divider" />
			{keyHint}
		</div>
	);
}
