import { type RefObject, useEffect, useRef } from "react";

type BufferViewSize =
	// The main in-play view (used standalone in Playground) and the result
	// screen's "text change" card, respectively.
	| "default"
	| "compact"
	// Play screen's buffer stage (see LevelRound.tsx's BufferStage) - larger
	// than "default" and borderless/transparent, since the surrounding
	// .vg-stage card supplies its own frame and background.
	| "stage";

type BufferViewProps = {
	text: string;
	cursor: number;
	size?: BufferViewSize;
};

const SIZE_STYLE: Record<
	BufferViewSize,
	{ fontSize: string; padding: string; border: string; background: string }
> = {
	default: {
		fontSize: "1.5rem",
		padding: "0.5rem 1rem",
		border: "1px solid var(--border-base)",
		background: "var(--bg-card)",
	},
	compact: {
		fontSize: "1rem",
		padding: "0.2rem 0.5rem",
		border: "1px solid var(--border-base)",
		background: "var(--bg-card)",
	},
	stage: {
		fontSize: "1.625rem",
		padding: "0",
		border: "none",
		background: "transparent",
	},
};

export function BufferView({
	text,
	cursor,
	size = "default",
}: BufferViewProps) {
	const style = SIZE_STYLE[size];
	const cursorRef = useRef<HTMLSpanElement>(null);

	// Keeps the cursor in view when it moves or a character is inserted past
	// the scrollable edge (see CLAUDE.md "UI 操作") - instant, not smooth
	// (default scrollIntoView behavior), and scoped to "nearest" so it never
	// scrolls anything beyond this element's own horizontal scrollbar. cursor
	// and text aren't read inside the callback (it just re-finds the current
	// cursorRef node), but they're exactly what should trigger a re-scroll.
	// biome-ignore lint/correctness/useExhaustiveDependencies: re-run on cursor/text change even though the callback doesn't read them directly (see comment above)
	useEffect(() => {
		cursorRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
	}, [cursor, text]);

	return (
		<div
			style={{
				fontSize: style.fontSize,
				padding: style.padding,
				background: style.background,
				color: "var(--text-primary)",
				border: style.border,
				borderRadius: "0.375rem",
				display: "inline-block",
				whiteSpace: "pre",
				minHeight: "1.5em",
				// Long buffers stay readable rather than stretching the editing
				// area wide enough to hurt motion practice (see CLAUDE.md "UI 操作").
				maxWidth: size === "default" ? "900px" : "100%",
				// min-width: 0 keeps this shrinkable when it's a flex/grid item's
				// only content (e.g. inside .vg-stage in the Playground's grid
				// column) - without it, the default min-width: auto lets an
				// unbroken (white-space: pre) long line force the ancestor grid
				// track to grow instead of triggering overflowX below (see CLAUDE.md
				// "UI 操作").
				minWidth: 0,
				overflowX: "auto",
			}}
		>
			{text.length === 0
				? renderChar(" ", true, 0, cursorRef)
				: [...text].map((char, i) =>
						renderChar(
							char,
							i === cursor,
							i,
							i === cursor ? cursorRef : undefined,
						),
					)}
		</div>
	);
}

function renderChar(
	char: string,
	isCursor: boolean,
	key: number,
	ref?: RefObject<HTMLSpanElement | null>,
) {
	return (
		<span
			key={key}
			ref={ref}
			style={
				isCursor
					? { background: "var(--text-primary)", color: "var(--bg-base)" }
					: undefined
			}
		>
			{char}
		</span>
	);
}
