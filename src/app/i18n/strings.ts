import type { Locale } from "../../core/i18n";

export type UIStringKey =
	| "nav.game"
	| "nav.playground"
	| "game.difficulty"
	| "game.timeLeft"
	| "game.keys"
	| "game.keysNone"
	| "game.hints"
	| "common.backToMenu"
	| "result.great"
	| "result.verbose"
	| "result.timeout"
	| "result.gaveUp"
	| "result.yourInput"
	| "result.expectedCommand"
	| "result.score"
	| "result.streak"
	| "session.title"
	| "session.attempted"
	| "session.cleared"
	| "session.great"
	| "session.totalScore"
	| "explanation.title"
	| "star.button"
	| "menu.concept"
	| "menu.chooseLevel"
	| "menu.level"
	| "menu.level1Description"
	| "menu.level2Description"
	| "menu.level3Description"
	| "menu.level4Description"
	| "menu.challengeCount"
	| "menu.cleared"
	| "menu.great"
	| "menu.notPlayed"
	| "menu.play"
	| "menu.selected"
	| "menu.howToPlayTitle"
	| "menu.howToPlayOperators"
	| "menu.howToPlayMotions"
	| "menu.howToPlayTextObjects"
	| "menu.howToPlayJudging"
	| "levelSummary.title"
	| "levelSummary.firstClear"
	| "keyHint.moveLeft"
	| "keyHint.moveRight"
	| "keyHint.skip"
	| "keyHint.giveUp"
	| "keyHint.next"
	| "keyHint.retry"
	| "keyHint.back";

// en is required (base language). ja is a Partial - any key left out here
// falls back to en (see CLAUDE.md "多言語対応").
const en: Record<UIStringKey, string> = {
	"nav.game": "game",
	"nav.playground": "playground",
	"game.difficulty": "difficulty",
	"game.timeLeft": "time left",
	"game.keys": "keys",
	"game.keysNone": "(none)",
	"game.hints": "hints",
	"common.backToMenu": "back to menu",
	"result.great": "Great!",
	"result.verbose": "Clear (verbose)",
	"result.timeout": "Time's up.",
	"result.gaveUp": "Gave up.",
	"result.yourInput": "Your input",
	"result.expectedCommand": "Expected command",
	"result.score": "score",
	"result.streak": "streak",
	"session.title": "Session",
	"session.attempted": "attempted",
	"session.cleared": "cleared",
	"session.great": "great",
	"session.totalScore": "total score",
	"explanation.title": "Breakdown",
	"star.button": "Star on GitHub",
	"menu.concept":
		"vimgram is a browser game for learning Vim's operator + motion editing grammar — not memorizing individual commands, but training the instinct to look at a piece of text and see it as a motion.",
	"menu.chooseLevel": "Choose a level",
	"menu.level": "Level",
	"menu.level1Description": "Basic deletion: x, dw, de, d$, ...",
	"menu.level2Description": "Character search: f vs t, side by side",
	"menu.level3Description":
		"Word text objects and the change operator: iw/aw, cw, ce, ...",
	"menu.level4Description": 'Quote and paren text objects: i"/a", i)/a), ...',
	"menu.challengeCount": "challenges",
	"menu.cleared": "cleared",
	"menu.great": "great",
	"menu.notPlayed": "not played yet",
	"menu.play": "Play",
	"menu.selected": "Selected",
	"menu.howToPlayTitle": "How to play",
	"menu.howToPlayOperators":
		"Operators: d (delete), c (change), y (yank), x (delete one character)",
	"menu.howToPlayMotions":
		"Motions: h l 0 $ w e b, f{char} (to, inclusive), t{char} (till, exclusive)",
	"menu.howToPlayTextObjects":
		"Text objects: iw/aw (word), i\"/a\" and i'/a' (quotes), i)/a) (parentheses)",
	"menu.howToPlayJudging":
		"Judging: your final text is compared to the goal, not the keys you pressed — Clear, Great (fewest keys), or a verbose Clear",
	"levelSummary.title": "Level complete",
	"levelSummary.firstClear": "First clear of this level!",
	"keyHint.moveLeft": "left",
	"keyHint.moveRight": "right",
	"keyHint.skip": "skip",
	"keyHint.giveUp": "give up",
	"keyHint.next": "next",
	"keyHint.retry": "retry",
	"keyHint.back": "back",
};

const ja: Partial<Record<UIStringKey, string>> = {
	"nav.game": "ゲーム",
	"nav.playground": "プレイグラウンド",
	"game.difficulty": "難易度",
	"game.timeLeft": "残り時間",
	"game.keys": "入力キー",
	"game.keysNone": "（なし）",
	"game.hints": "ヒント",
	"common.backToMenu": "メニューへ戻る",
	"result.great": "Great!",
	"result.verbose": "クリア（冗長）",
	"result.timeout": "時間切れ。",
	"result.gaveUp": "ギブアップ。",
	"result.yourInput": "あなたの入力",
	"result.expectedCommand": "想定コマンド",
	"result.score": "スコア",
	"result.streak": "連続クリア",
	"session.title": "セッション",
	"session.attempted": "挑戦数",
	"session.cleared": "クリア数",
	"session.great": "Great数",
	"session.totalScore": "合計スコア",
	"explanation.title": "分解",
	"star.button": "GitHub で Star",
	"menu.concept":
		"vimgram は、Vim の operator + motion という編集文法を身体に入れるためのブラウザゲームです。個々のコマンドを暗記するのではなく、テキストを見て「これはモーションとして捉えられる」という感覚を鍛えることが目的です。",
	"menu.chooseLevel": "レベルを選ぶ",
	"menu.level": "レベル",
	"menu.level1Description": "基本の削除: x, dw, de, d$ など",
	"menu.level2Description": "文字検索: f と t の違いを比較する",
	"menu.level3Description":
		"単語のテキストオブジェクトと change オペレータ: iw/aw, cw, ce など",
	"menu.level4Description":
		'クォート・括弧のテキストオブジェクト: i"/a", i)/a) など',
	"menu.challengeCount": "問題数",
	"menu.cleared": "クリア数",
	"menu.great": "Great数",
	"menu.notPlayed": "未プレイ",
	"menu.play": "遊ぶ",
	"menu.selected": "選択中",
	"menu.howToPlayTitle": "遊び方",
	"menu.howToPlayOperators":
		"オペレータ: d（削除）, c（チェンジ）, y（ヤンク）, x（1文字削除）",
	"menu.howToPlayMotions":
		"モーション: h l 0 $ w e b, f{文字}（含む）, t{文字}（含まない）",
	"menu.howToPlayTextObjects":
		"テキストオブジェクト: iw/aw（単語）, i\"/a\" と i'/a'（クォート）, i)/a)（丸括弧）",
	"menu.howToPlayJudging":
		"判定: 押したキーではなく最終的なテキストの一致で判定します（クリア / Great（最短） / 冗長クリア）",
	"levelSummary.title": "レベルクリア",
	"levelSummary.firstClear": "このレベルを初クリアしました！",
	"keyHint.moveLeft": "左へ",
	"keyHint.moveRight": "右へ",
	"keyHint.skip": "スキップ",
	"keyHint.giveUp": "ギブアップ",
	"keyHint.next": "次へ",
	"keyHint.retry": "リトライ",
	"keyHint.back": "前の問題へ",
};

export function t(key: UIStringKey, locale: Locale): string {
	if (locale === "ja") {
		return ja[key] ?? en[key];
	}
	return en[key];
}
