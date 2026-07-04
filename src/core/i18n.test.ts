import { describe, expect, it } from "vitest";
import { resolveLocalizedText } from "./i18n";

describe("resolveLocalizedText", () => {
	it("returns ja when present and locale is ja", () => {
		expect(resolveLocalizedText({ en: "Delete", ja: "削除" }, "ja")).toBe(
			"削除",
		);
	});

	it("returns en when locale is en", () => {
		expect(resolveLocalizedText({ en: "Delete", ja: "削除" }, "en")).toBe(
			"Delete",
		);
	});

	it("falls back to en when ja is missing and locale is ja", () => {
		expect(resolveLocalizedText({ en: "Delete" }, "ja")).toBe("Delete");
	});
});
