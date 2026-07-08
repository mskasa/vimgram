import { useCallback, useEffect, useRef, useState } from "react";

const HINT_DURATION_MS = 4000;

// Shows a one-off, auto-dismissing teaching hint when the player presses an
// unsupported key (see CLAUDE.md "UI 操作": unsupported keys are guided, not
// silently ignored). Never disruptive: it doesn't touch the buffer, timer,
// or parser input state - it's purely a side display.
//
// `dedupe: true` (ChallengeRound) shows each distinct hint at most once per
// round, so repeatedly reaching for "i" doesn't spam the same message.
// `dedupe: false` (PlaygroundPage) shows it every time - there's no "round"
// there, and repetition is fine in a sandbox meant for practicing.
export function useUnsupportedKeyHint({ dedupe }: { dedupe: boolean }) {
	const [message, setMessage] = useState<string | null>(null);
	const timeoutRef = useRef<number | null>(null);
	const shownRef = useRef<Set<string>>(new Set());

	const show = useCallback(
		(category: string, text: string) => {
			if (dedupe && shownRef.current.has(category)) return;
			shownRef.current.add(category);
			setMessage(text);
			if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
			timeoutRef.current = window.setTimeout(
				() => setMessage(null),
				HINT_DURATION_MS,
			);
		},
		[dedupe],
	);

	useEffect(() => {
		return () => {
			if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
		};
	}, []);

	return { message, show };
}
