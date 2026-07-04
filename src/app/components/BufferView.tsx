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
				background: "#1e1e1e",
				color: "#d4d4d4",
				display: "inline-block",
				whiteSpace: "pre",
				minHeight: "1.5em",
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
			style={isCursor ? { background: "#d4d4d4", color: "#1e1e1e" } : undefined}
		>
			{char}
		</span>
	);
}
