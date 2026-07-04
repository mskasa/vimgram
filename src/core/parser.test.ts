import { describe, expect, it } from "vitest";
import {
	type InputState,
	initialInputState,
	type ParsedCommand,
	parseKey,
} from "./parser";

// Feeds a sequence of keys through the state machine and returns the final result.
function run(keys: string): {
	state: InputState;
	command: ParsedCommand | null;
} {
	let state = initialInputState;
	let command: ParsedCommand | null = null;
	for (const key of keys) {
		const result = parseKey(state, key);
		state = result.state;
		command = result.command;
	}
	return { state, command };
}

// Narrows `run(keys).command` down to the operatorMotion's `motion` field,
// for tests that only care about the resolved Motion shape.
function runMotion(keys: string) {
	const { command } = run(keys);
	if (command?.type !== "operatorMotion" && command?.type !== "motion") {
		throw new Error(
			`expected a motion-bearing command, got ${JSON.stringify(command)}`,
		);
	}
	return command.motion;
}

describe("bare motions", () => {
	it("emits a motion command for h, l, 0, $, w, e, b", () => {
		for (const key of ["h", "l", "0", "$", "w", "e", "b"]) {
			expect(run(key).command).toEqual({
				type: "motion",
				motion: { type: key },
				count: undefined,
			});
		}
	});

	it("applies a count to a bare motion", () => {
		expect(run("3l").command).toEqual({
			type: "motion",
			motion: { type: "l" },
			count: 3,
		});
	});

	it("f/t go through charMotionPending and resolve on the next key", () => {
		expect(run("f,").command).toEqual({
			type: "motion",
			motion: { type: "f", char: "," },
			count: undefined,
		});
		expect(run("t,").command).toEqual({
			type: "motion",
			motion: { type: "t", char: "," },
			count: undefined,
		});
	});

	it("applies a count to a bare f/t motion", () => {
		expect(run("2f,").command).toEqual({
			type: "motion",
			motion: { type: "f", char: "," },
			count: 2,
		});
	});

	it("resets to idle after emitting a command", () => {
		expect(run("l").state).toEqual(initialInputState);
		expect(run("f,").state).toEqual(initialInputState);
	});
});

describe("x", () => {
	it("emits a single x command", () => {
		expect(run("x").command).toEqual({
			type: "single",
			command: "x",
			count: undefined,
		});
	});

	it("applies a count to x", () => {
		expect(run("3x").command).toEqual({
			type: "single",
			command: "x",
			count: 3,
		});
	});
});

describe("operator + motion", () => {
	it("emits an operatorMotion for d/y + a simple motion", () => {
		expect(run("dw").command).toEqual({
			type: "operatorMotion",
			operator: "d",
			motion: { type: "w" },
			count: undefined,
		});
		expect(run("yw").command).toEqual({
			type: "operatorMotion",
			operator: "y",
			motion: { type: "w" },
			count: undefined,
		});
	});

	it("emits an operatorMotion for d/y + f/t", () => {
		expect(run('df"').command).toEqual({
			type: "operatorMotion",
			operator: "d",
			motion: { type: "f", char: '"' },
			count: undefined,
		});
		expect(run("yt,").command).toEqual({
			type: "operatorMotion",
			operator: "y",
			motion: { type: "t", char: "," },
			count: undefined,
		});
	});

	it("d$ and de work", () => {
		expect(run("d$").command).toEqual({
			type: "operatorMotion",
			operator: "d",
			motion: { type: "$" },
			count: undefined,
		});
		expect(run("de").command).toEqual({
			type: "operatorMotion",
			operator: "d",
			motion: { type: "e" },
			count: undefined,
		});
	});

	it("c is a recognized operator, same as d/y", () => {
		expect(run("cw").command).toEqual({
			type: "operatorMotion",
			operator: "c",
			motion: { type: "w" },
			count: undefined,
		});
		expect(run('cf"').command).toEqual({
			type: "operatorMotion",
			operator: "c",
			motion: { type: "f", char: '"' },
			count: undefined,
		});
	});
});

describe("count multiplication (count1 * count2)", () => {
	it("2d3w multiplies to count: 6", () => {
		expect(run("2d3w").command).toEqual({
			type: "operatorMotion",
			operator: "d",
			motion: { type: "w" },
			count: 6,
		});
	});

	it("d3w uses count2 alone", () => {
		expect(run("d3w").command).toEqual({
			type: "operatorMotion",
			operator: "d",
			motion: { type: "w" },
			count: 3,
		});
	});

	it("2dw uses count1 alone", () => {
		expect(run("2dw").command).toEqual({
			type: "operatorMotion",
			operator: "d",
			motion: { type: "w" },
			count: 2,
		});
	});

	it("dw with no digits leaves count undefined", () => {
		expect(run("dw").command?.count).toBeUndefined();
	});

	it("3df, multiplies count1 by the implicit count2 of 1", () => {
		expect(run("3df,").command).toEqual({
			type: "operatorMotion",
			operator: "d",
			motion: { type: "f", char: "," },
			count: 3,
		});
	});
});

describe("the '0' quirk", () => {
	it("0 with no pending count is the go-to-column-0 motion", () => {
		expect(run("0").command).toEqual({
			type: "motion",
			motion: { type: "0" },
			count: undefined,
		});
	});

	it("0 after a leading digit is appended to the count, not treated as a motion", () => {
		// "10x" -> count "10", then x
		expect(run("10x").command).toEqual({
			type: "single",
			command: "x",
			count: 10,
		});
	});

	it("0 after an operator's leading digit is appended to count2", () => {
		// "d10w" -> operator d, count2 "10", motion w
		expect(run("d10w").command).toEqual({
			type: "operatorMotion",
			operator: "d",
			motion: { type: "w" },
			count: 10,
		});
	});
});

describe("cancellation", () => {
	it("an unrecognized key while idle with a pending count drops the count", () => {
		const result = run("3");
		expect(result.command).toBeNull();
		const next = parseKey(result.state, "z");
		expect(next.command).toBeNull();
		expect(next.state).toEqual(initialInputState);
	});

	it("an unrecognized key while operatorPending cancels the operator", () => {
		const afterD = parseKey(initialInputState, "d");
		const afterZ = parseKey(afterD.state, "z");
		expect(afterZ.command).toBeNull();
		expect(afterZ.state).toEqual(initialInputState);
	});

	it("a repeated operator key (dd) cancels rather than emitting a command", () => {
		expect(run("dd").command).toBeNull();
		expect(run("dd").state).toEqual(initialInputState);
	});
});

describe("charMotionPending accepts any character as the target", () => {
	it("accepts a digit as the f/t target", () => {
		expect(run("f5").command).toEqual({
			type: "motion",
			motion: { type: "f", char: "5" },
			count: undefined,
		});
	});
});

describe("text objects (i/a)", () => {
	it("emits an operatorMotion for d/y/c + iw/aw", () => {
		expect(run("diw").command).toEqual({
			type: "operatorMotion",
			operator: "d",
			motion: { type: "textObject", scope: "inner", target: "word" },
			count: undefined,
		});
		expect(run("yaw").command).toEqual({
			type: "operatorMotion",
			operator: "y",
			motion: { type: "textObject", scope: "around", target: "word" },
			count: undefined,
		});
		expect(run('ci"').command).toEqual({
			type: "operatorMotion",
			operator: "c",
			motion: { type: "textObject", scope: "inner", target: "doubleQuote" },
			count: undefined,
		});
	});

	it("maps target keys: w, \", ', ( and ) (either paren char)", () => {
		expect(runMotion("diw")).toEqual({
			type: "textObject",
			scope: "inner",
			target: "word",
		});
		expect(runMotion('di"')).toEqual({
			type: "textObject",
			scope: "inner",
			target: "doubleQuote",
		});
		expect(runMotion("di'")).toEqual({
			type: "textObject",
			scope: "inner",
			target: "singleQuote",
		});
		expect(runMotion("di(")).toEqual({
			type: "textObject",
			scope: "inner",
			target: "paren",
		});
		expect(runMotion("di)")).toEqual({
			type: "textObject",
			scope: "inner",
			target: "paren",
		});
	});

	it("resets to idle after emitting a text object command", () => {
		expect(run("diw").state).toEqual(initialInputState);
	});

	it("an unrecognized target key cancels the whole command", () => {
		const afterDI = parseKey(parseKey(initialInputState, "d").state, "i");
		const afterZ = parseKey(afterDI.state, "z");
		expect(afterZ.command).toBeNull();
		expect(afterZ.state).toEqual(initialInputState);
	});

	it("count + text object fails to parse entirely (out of scope): 2di and d2i cancel on 'i', not just fail to combine", () => {
		// Checked at the "i" keystroke itself (not the full "...iw" string): a
		// trailing "w" after a cancellation is reprocessed as its own fresh bare
		// motion (correct, general parser behavior), which would otherwise mask
		// what this test is actually about.
		expect(run("2di").command).toBeNull();
		expect(run("2di").state).toEqual(initialInputState);
		expect(run("d2i").command).toBeNull();
		expect(run("d2i").state).toEqual(initialInputState);
	});

	it("i/a in idle (bare, no operator) are not handled - Insert mode entry is a future phase", () => {
		expect(run("i").command).toBeNull();
		expect(run("i").state).toEqual(initialInputState);
		expect(run("a").command).toBeNull();
		expect(run("a").state).toEqual(initialInputState);
	});
});
