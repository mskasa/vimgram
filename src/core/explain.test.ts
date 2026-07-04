import { describe, expect, it } from "vitest";
import { explain, explainSequence } from "./explain";
import type { Motion } from "./motions";
import { parseCommands } from "./parser";

const MOTION_TYPES: Motion["type"][] = [
	"h",
	"l",
	"0",
	"$",
	"w",
	"e",
	"b",
	"f",
	"t",
];

describe("explain: representative commands", () => {
	it("df, decomposes into the delete operator and an inclusive find", () => {
		const [command] = parseCommands("df,");
		const result = explain(command, "en");
		expect(result.keys).toBe("df,");
		expect(result.parts).toEqual([
			{ keys: "d", description: "delete operator" },
			{ keys: "f,", description: 'move to the next "," (inclusive)' },
		]);
	});

	it("2dw includes the count in the motion's description", () => {
		const [command] = parseCommands("2dw");
		const result = explain(command, "en");
		expect(result.keys).toBe("d2w");
		expect(result.parts).toEqual([
			{ keys: "d", description: "delete operator" },
			{ keys: "2w", description: "move forward 2 words" },
		]);
	});

	it('yt" decomposes into the yank operator and an exclusive till', () => {
		const [command] = parseCommands('yt"');
		const result = explain(command, "en");
		expect(result.parts).toEqual([
			{ keys: "y", description: "yank (copy) operator" },
			{
				keys: 't"',
				description: 'move to just before the next """ (exclusive)',
			},
		]);
	});

	it("x is a single atomic part, not an operator+motion pair", () => {
		const [command] = parseCommands("x");
		const result = explain(command, "en");
		expect(result.keys).toBe("x");
		expect(result.parts).toEqual([
			{ keys: "x", description: "delete the character under the cursor" },
		]);
	});

	it("3x includes the count", () => {
		const [command] = parseCommands("3x");
		const result = explain(command, "en");
		expect(result.parts).toEqual([
			{
				keys: "3x",
				description: "delete 3 characters at and after the cursor",
			},
		]);
	});

	it("f/t descriptions always state inclusive vs exclusive", () => {
		const [fCommand] = parseCommands("f,");
		const [tCommand] = parseCommands("t,");
		expect(explain(fCommand, "en").parts[0].description).toMatch(/inclusive/);
		expect(explain(tCommand, "en").parts[0].description).toMatch(/exclusive/);
	});
});

describe("explain: ja locale", () => {
	it("produces Japanese descriptions for df,", () => {
		const [command] = parseCommands("df,");
		const result = explain(command, "ja");
		expect(result.parts).toEqual([
			{ keys: "d", description: "削除オペレータ" },
			{ keys: "f,", description: "次の「,」まで移動（含む）" },
		]);
	});
});

describe("explainSequence (key string, mode-aware)", () => {
	it("concatenates multiple Normal-mode commands typed in one round", () => {
		const result = explainSequence("lldw", "en"); // l, l, then dw
		expect(result.keys).toBe("lldw");
		expect(result.parts).toHaveLength(4);
		expect(result.parts[0]).toEqual({
			keys: "l",
			description: "move right one character",
		});
		expect(result.parts[2]).toEqual({
			keys: "d",
			description: "delete operator",
		});
	});

	it('ct"jiro<Esc> segments into command, inserted text, and <Esc>', () => {
		const result = explainSequence('ct"jiro<Esc>', "en");
		expect(result.keys).toBe('ct"jiro<Esc>');
		expect(result.parts).toEqual([
			{
				keys: "c",
				description: "change operator (delete, then enter Insert mode)",
			},
			{
				keys: 't"',
				description: 'move to just before the next """ (exclusive)',
			},
			{ keys: "jiro", description: "type the replacement text" },
			{ keys: "<Esc>", description: "return to Normal mode" },
		]);
	});

	it("cwgoodbye<Esc> produces the same three-part shape for a simple motion", () => {
		const result = explainSequence("cwgoodbye<Esc>", "en");
		expect(result.parts.map((p) => p.keys)).toEqual([
			"c",
			"w",
			"goodbye",
			"<Esc>",
		]);
		expect(result.parts.at(-1)).toEqual({
			keys: "<Esc>",
			description: "return to Normal mode",
		});
	});

	it("produces Japanese segment descriptions", () => {
		const result = explainSequence('ct"jiro<Esc>', "ja");
		expect(result.parts).toEqual([
			{
				keys: "c",
				description: "チェンジオペレータ（削除して Insert mode へ）",
			},
			{ keys: 't"', description: '次の「"」の手前まで移動（含まない）' },
			{ keys: "jiro", description: "置き換えるテキストを入力" },
			{ keys: "<Esc>", description: "Normal mode に戻る" },
		]);
	});
});

describe("explain: text objects", () => {
	it('ci"jiro<Esc> mentions "inner" in the explanation', () => {
		const result = explainSequence('ci"jiro<Esc>', "en");
		expect(result.parts).toEqual([
			{
				keys: "c",
				description: "change operator (delete, then enter Insert mode)",
			},
			{
				keys: 'i"',
				description:
					"only the double-quoted string itself, not the surrounding delimiter or space (inner)",
			},
			{ keys: "jiro", description: "type the replacement text" },
			{ keys: "<Esc>", description: "return to Normal mode" },
		]);
	});

	it("inner and around descriptions differ", () => {
		const [innerCommand] = parseCommands("diw");
		const [aroundCommand] = parseCommands("daw");
		const innerDesc = explain(innerCommand, "en").parts[1].description;
		const aroundDesc = explain(aroundCommand, "en").parts[1].description;
		expect(innerDesc).not.toBe(aroundDesc);
		expect(innerDesc).toMatch(/inner/);
		expect(aroundDesc).toMatch(/around/);
	});
});

describe("dictionary coverage", () => {
	it("has an English and Japanese description for every directional motion type", () => {
		for (const type of MOTION_TYPES) {
			const motion = (
				type === "f" || type === "t" ? { type, char: "x" } : { type }
			) as Motion;
			expect(() => explain({ type: "motion", motion }, "en")).not.toThrow();
			expect(() => explain({ type: "motion", motion }, "ja")).not.toThrow();
		}
	});

	it("has an English and Japanese description for every scope x target combination", () => {
		const scopes = ["inner", "around"] as const;
		const targets = ["word", "doubleQuote", "singleQuote", "paren"] as const;
		for (const scope of scopes) {
			for (const target of targets) {
				const command = {
					type: "operatorMotion",
					operator: "d",
					motion: { type: "textObject", scope, target },
				} as const;
				expect(() => explain(command, "en")).not.toThrow();
				expect(() => explain(command, "ja")).not.toThrow();
			}
		}
	});

	it("has an English and Japanese description for d, y, and c", () => {
		for (const operator of ["d", "y", "c"] as const) {
			const command = {
				type: "operatorMotion",
				operator,
				motion: { type: "w" },
			} as const;
			expect(() => explain(command, "en")).not.toThrow();
			expect(() => explain(command, "ja")).not.toThrow();
		}
	});
});
