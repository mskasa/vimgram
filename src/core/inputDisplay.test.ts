import { describe, expect, it } from "vitest";
import { buildDisplayTokens } from "./inputDisplay";

describe("buildDisplayTokens", () => {
	it("drops Insert-mode characters entirely, keeping only the closing <Esc>", () => {
		const tokens = buildDisplayTokens(`ciw${"a".repeat(100)}<Esc>`);
		expect(tokens).toEqual([
			{ kind: "key", text: "c" },
			{ kind: "key", text: "i" },
			{ kind: "key", text: "w" },
			{ kind: "key", text: "<Esc>" },
		]);
	});

	it("correctly segments a Normal/Insert-mixed sequence", () => {
		const tokens = buildDisplayTokens("dwciwhello<Esc>0");
		expect(tokens).toEqual([
			{ kind: "key", text: "d" },
			{ kind: "key", text: "w" },
			{ kind: "key", text: "c" },
			{ kind: "key", text: "i" },
			{ kind: "key", text: "w" },
			{ kind: "key", text: "<Esc>" },
			{ kind: "key", text: "0" },
		]);
	});

	it("handles a sequence ending mid-insert with no <Esc>", () => {
		const tokens = buildDisplayTokens("ciwhello");
		expect(tokens).toEqual([
			{ kind: "key", text: "c" },
			{ kind: "key", text: "i" },
			{ kind: "key", text: "w" },
		]);
	});

	it("passes through plain Normal-mode keystrokes unchanged when short", () => {
		expect(buildDisplayTokens("dw")).toEqual([
			{ kind: "key", text: "d" },
			{ kind: "key", text: "w" },
		]);
	});

	it("returns an empty list for an empty sequence", () => {
		expect(buildDisplayTokens("")).toEqual([]);
	});

	it("caps the total token count and prepends an ellipsis when exceeded", () => {
		const keys = "x".repeat(20); // 20 separate Normal-mode "x" keystrokes
		const tokens = buildDisplayTokens(keys);
		expect(tokens[0]).toEqual({ kind: "ellipsis" });
		expect(tokens).toHaveLength(13); // ellipsis + last 12
		expect(tokens.slice(1)).toEqual(
			Array.from({ length: 12 }, () => ({ kind: "key", text: "x" })),
		);
	});

	it("does not add an ellipsis when at or under the cap", () => {
		const keys = "x".repeat(12);
		const tokens = buildDisplayTokens(keys);
		expect(tokens).toHaveLength(12);
		expect(tokens.every((token) => token.kind === "key")).toBe(true);
	});
});
