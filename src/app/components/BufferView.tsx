type BufferViewProps = {
	text: string;
	cursor: number;
};

export function BufferView({ text, cursor }: BufferViewProps) {
	return (
		<div
			style={{
				fontSize: "1.5rem",
				padding: "0.5rem 1rem",
				background: "var(--bg-card)",
				color: "var(--text-primary)",
				border: "1px solid var(--border-base)",
				borderRadius: "0.375rem",
				display: "inline-block",
				whiteSpace: "pre",
				minHeight: "1.5em",
				// Long buffers stay readable rather than stretching the editing
				// area wide enough to hurt motion practice (see CLAUDE.md "UI 操作").
				maxWidth: "900px",
				overflowX: "auto",
			}}
		>
			{text.length === 0
				? renderChar(" ", true, 0)
				: [...text].map((char, i) => renderChar(char, i === cursor, i))}
		</div>
	);
}

function renderChar(char: string, isCursor: boolean, key: number) {
	return (
		<span
			key={key}
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
