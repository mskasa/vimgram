import { useEffect, useState } from "react";
import { type BufferState, createBuffer } from "../../core/buffer";
import { execute } from "../../core/execute";
import { backspace, escapeInsert, insertChar } from "../../core/insert";
import {
	type InputState,
	initialInputState,
	parseKey,
} from "../../core/parser";
import { BufferView } from "../components/BufferView";
import { domKeyToToken } from "../keyInput";

const INITIAL_TEXT = "const foo = bar(1, 2, 3);";
const INITIAL_CURSOR = 0;

function describePending(inputState: InputState): string {
	switch (inputState.phase) {
		case "idle":
			return inputState.countBuffer === ""
				? ""
				: `count: ${inputState.countBuffer}`;
		case "operatorPending":
			return `${inputState.operator} ${inputState.countBuffer}...`;
		case "charMotionPending":
			return `${inputState.operator ?? ""}${inputState.motion}...`;
		case "textObjectPending":
			return `${inputState.operator}${inputState.scope === "inner" ? "i" : "a"}...`;
	}
}

export function PlaygroundPage() {
	const [buffer, setBuffer] = useState<BufferState>(() =>
		createBuffer(INITIAL_TEXT, INITIAL_CURSOR),
	);
	const [inputState, setInputState] = useState<InputState>(initialInputState);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			const token = domKeyToToken(event.key);
			if (token === null) return;
			event.preventDefault();

			// Same top-level mode branch as GamePage: Normal mode goes through
			// the parser; Insert mode dispatches straight to core/insert.ts.
			if (buffer.mode === "insert") {
				if (token === "<Esc>") setBuffer((prev) => escapeInsert(prev));
				else if (token === "<BS>") setBuffer((prev) => backspace(prev));
				else if (token.length === 1)
					setBuffer((prev) => insertChar(prev, token));
				return;
			}

			if (token.length !== 1) return;
			const result = parseKey(inputState, token);
			setInputState(result.state);
			const { command } = result;
			if (command) {
				setBuffer((prev) => execute(prev, command));
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [inputState, buffer.mode]);

	const reset = () => {
		setBuffer(createBuffer(INITIAL_TEXT, INITIAL_CURSOR));
		setInputState(initialInputState);
	};

	return (
		<main style={{ fontFamily: "monospace", padding: "2rem" }}>
			<h1>vimgram playground</h1>
			<p>
				Step 6: <code>h l 0 $ w e b</code> / <code>f{"{char}"}</code>{" "}
				<code>t{"{char}"}</code> / <code>x</code> / <code>d</code>{" "}
				<code>y</code> <code>c</code> + motion（count 対応） /{" "}
				<code>{"iw aw i\" a\" i' a' i) a)"}</code> / Insert mode（
				<code>{"<Esc>"}</code> <code>{"<BS>"}</code>）
			</p>
			<p>
				<strong>{buffer.mode === "insert" ? "INSERT" : "NORMAL"}</strong>
			</p>
			<BufferView text={buffer.text} cursor={buffer.cursor} />
			<p>
				cursor: {buffer.cursor} / mode: {buffer.mode} / pending:{" "}
				{describePending(inputState) || "(none)"}
			</p>
			<p>
				yankRegister:{" "}
				{buffer.yankRegister === undefined
					? "(empty)"
					: JSON.stringify(buffer.yankRegister)}
			</p>
			<button type="button" onClick={reset}>
				reset
			</button>
		</main>
	);
}
