import type { Locale } from "../../core/i18n";

export type UIStringKey =
	| "nav.game"
	| "nav.playground"
	| "game.difficulty"
	| "game.timeLeft"
	| "game.keys"
	| "game.keysNone"
	| "game.next"
	| "game.hints"
	| "result.great"
	| "result.verbose"
	| "result.timeout"
	| "result.yourInput"
	| "result.expectedCommand"
	| "explanation.title";

// en is required (base language). ja is a Partial - any key left out here
// falls back to en (see CLAUDE.md "多言語対応").
const en: Record<UIStringKey, string> = {
	"nav.game": "game",
	"nav.playground": "playground",
	"game.difficulty": "difficulty",
	"game.timeLeft": "time left",
	"game.keys": "keys",
	"game.keysNone": "(none)",
	"game.next": "next challenge",
	"game.hints": "hints",
	"result.great": "Great!",
	"result.verbose": "Clear (verbose)",
	"result.timeout": "Time's up.",
	"result.yourInput": "Your input",
	"result.expectedCommand": "Expected command",
	"explanation.title": "Breakdown",
};

const ja: Partial<Record<UIStringKey, string>> = {
	"nav.game": "ゲーム",
	"nav.playground": "プレイグラウンド",
	"game.difficulty": "難易度",
	"game.timeLeft": "残り時間",
	"game.keys": "入力キー",
	"game.keysNone": "（なし）",
	"game.next": "次の問題へ",
	"game.hints": "ヒント",
	"result.great": "Great!",
	"result.verbose": "クリア（冗長）",
	"result.timeout": "時間切れ。",
	"result.yourInput": "あなたの入力",
	"result.expectedCommand": "想定コマンド",
	"explanation.title": "分解",
};

export function t(key: UIStringKey, locale: Locale): string {
	if (locale === "ja") {
		return ja[key] ?? en[key];
	}
	return en[key];
}
