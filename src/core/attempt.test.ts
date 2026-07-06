import { describe, expect, it } from "vitest";
import { usedCommandTypes } from "./attempt";
import { parseCommands } from "./parser";

describe("usedCommandTypes", () => {
	it("labels a bare motion by its type", () => {
		expect(usedCommandTypes(parseCommands("h"))).toEqual(["h"]);
	});

	it("labels x as its own type", () => {
		expect(usedCommandTypes(parseCommands("x"))).toEqual(["x"]);
	});

	it("labels an operator+motion as operator:motionType", () => {
		expect(usedCommandTypes(parseCommands("dw"))).toEqual(["d:w"]);
		expect(usedCommandTypes(parseCommands('cf"'))).toEqual(["c:f"]);
	});

	it("labels a text object with its scope and target", () => {
		expect(usedCommandTypes(parseCommands('di"'))).toEqual([
			"d:textObject:inner:doubleQuote",
		]);
		expect(usedCommandTypes(parseCommands("daw"))).toEqual([
			"d:textObject:around:word",
		]);
	});

	it("deduplicates repeated command types across a sequence", () => {
		expect(usedCommandTypes(parseCommands("hhh"))).toEqual(["h"]);
	});

	it("preserves distinct types across a mixed sequence", () => {
		const types = usedCommandTypes(parseCommands("hldw"));
		expect(types).toEqual(expect.arrayContaining(["h", "l", "d:w"]));
		expect(types).toHaveLength(3);
	});
});
