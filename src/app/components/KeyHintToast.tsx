// A small, non-destructive callout for the useUnsupportedKeyHint hook - see
// CLAUDE.md "UI 操作". Renders nothing when there's no active message, so it
// never reserves layout space while idle.
export function KeyHintToast({ message }: { message: string | null }) {
	if (message === null) return null;
	return (
		<p
			role="status"
			style={{
				// Block (not inline-block) so this always starts its own line
				// regardless of what precedes it - an inline-block sibling of
				// another inline-block (e.g. BufferView) would otherwise sit
				// crowded on the same row. `width: fit-content` keeps it sized
				// to its content instead of stretching edge to edge.
				display: "block",
				width: "fit-content",
				maxWidth: "100%",
				marginTop: "0.5rem",
				background: "var(--bg-card-active)",
				border: "1px solid var(--border-strong)",
				borderRadius: "0.375rem",
				padding: "0.4rem 0.8rem",
				color: "var(--text-highlight)",
				fontSize: "var(--font-keyhint)",
			}}
		>
			{message}
		</p>
	);
}
