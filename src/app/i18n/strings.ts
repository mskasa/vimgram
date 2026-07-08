import type { Locale } from "../../core/i18n";

export type UIStringKey =
	| "nav.game"
	| "nav.playground"
	| "game.difficulty"
	| "game.keysNone"
	| "game.hints"
	| "game.inputLabel"
	| "game.pendingCount"
	| "game.pendingOperator"
	| "game.pendingCharTarget"
	| "game.pendingTextObjectTarget"
	| "game.insertStatus"
	| "game.insertedCountPrefix"
	| "game.insertedCountSuffix"
	| "common.backToMenu"
	| "result.great"
	| "result.verboseHeadline"
	| "result.shorterSolutionHint"
	| "result.keyCountLabel"
	| "result.idealKeyCountLabel"
	| "result.textChangeTitle"
	| "result.before"
	| "result.after"
	| "result.timeout"
	| "result.gaveUp"
	| "result.assistedHeadline"
	| "result.assistedHint"
	| "result.yourInput"
	| "result.expectedCommand"
	| "result.time"
	| "result.streak"
	| "session.cleared"
	| "session.great"
	| "session.totalTime"
	| "star.button"
	| "menu.concept"
	| "menu.chooseLevel"
	| "menu.level"
	| "menu.level1Description"
	| "menu.level2Description"
	| "menu.level3Description"
	| "menu.level4Description"
	| "menu.challengeUnit"
	| "menu.cleared"
	| "menu.notPlayed"
	| "menu.play"
	| "menu.selected"
	| "menu.shuffled"
	| "menu.reviewTitle"
	| "menu.reviewSubtitle"
	| "menu.reviewUnclearedLabel"
	| "menu.reviewNotGreatLabel"
	| "menu.reviewUnclearedDescription"
	| "menu.reviewNotGreatDescription"
	| "menu.howToPlayTitle"
	| "menu.howToPlayOperators"
	| "menu.howToPlayMotions"
	| "menu.howToPlayTextObjects"
	| "menu.howToPlayJudging"
	| "menu.howToPlayPlayground"
	| "menu.howToPlayDifferencesTitle"
	| "menu.howToPlayDifferencesSubset"
	| "menu.howToPlayDifferencesInsert"
	| "menu.howToPlayDifferencesReason"
	| "menu.howToPlayDifferencesOther"
	| "hint.insertUnsupported"
	| "hint.unsupportedKey"
	| "milestone.bannerTitle"
	| "milestone.levelFullyClearedPrefix"
	| "milestone.levelFullyClearedSuffix"
	| "milestone.starPromptMessage"
	| "milestone.starAction"
	| "milestone.muteAction"
	| "levelSummary.allGreatHeadline"
	| "levelSummary.clearedHeadline"
	| "levelSummary.partialHeadline"
	| "levelSummary.reviewSuffix"
	| "levelSummary.notGreatPrefix"
	| "levelSummary.notGreatSuffix"
	| "levelSummary.remainingPrefix"
	| "levelSummary.remainingSuffix"
	| "levelSummary.assistedRemainingPrefix"
	| "levelSummary.assistedRemainingSuffix"
	| "levelSummary.badgeFailed"
	| "levelSummary.badgeAssisted"
	| "levelSummary.timeoutShort"
	| "levelSummary.gaveUpShort"
	| "levelSummary.skippedShort"
	| "levelSummary.keysUnit"
	| "levelSummary.breakdownTitle"
	| "levelSummary.replay"
	| "keyHint.select"
	| "keyHint.close"
	| "keyHint.skip"
	| "keyHint.giveUp"
	| "keyHint.next"
	| "keyHint.retry"
	| "keyHint.back"
	| "keyHint.playground"
	| "playground.subtitle"
	| "playground.cursor"
	| "playground.yankLabel"
	| "playground.yankEmpty"
	| "playground.setTextLabel"
	| "playground.setTextPlaceholder"
	| "playground.set"
	| "playground.reset"
	| "playground.asciiOnly"
	| "playground.presets"
	| "playground.presetVariable"
	| "playground.presetList"
	| "playground.presetFunctionCall"
	| "playground.presetQuotes"
	| "playground.history"
	| "playground.historyEmpty"
	| "playground.unresolvedPrefix"
	| "playground.cheatSheetTitle"
	| "playground.cheatSheetOperators"
	| "playground.cheatSheetMotions"
	| "playground.cheatSheetTextObjects";

// en is required (base language). ja is a Partial - any key left out here
// falls back to en (see CLAUDE.md "多言語対応").
const en: Record<UIStringKey, string> = {
	"nav.game": "game",
	"nav.playground": "playground",
	"game.difficulty": "difficulty",
	"game.keysNone": "(none)",
	"game.hints": "hints",
	"game.inputLabel": "input",
	"game.pendingCount": "count",
	"game.pendingOperator": "Waiting for a motion...",
	"game.pendingCharTarget": "Waiting for a target character...",
	"game.pendingTextObjectTarget": "Waiting for a target (w, \", ', ))...",
	"game.insertStatus": "INSERT — press <Esc> to return to Normal",
	"game.insertedCountPrefix": "typing: ",
	"game.insertedCountSuffix": " characters",
	"common.backToMenu": "back to menu",
	"result.great": "Great!",
	"result.verboseHeadline": "Clear",
	"result.shorterSolutionHint": "A shorter solution exists",
	"result.keyCountLabel": "keys",
	"result.idealKeyCountLabel": "ideal",
	"result.textChangeTitle": "Text change",
	"result.before": "Before",
	"result.after": "After",
	"result.timeout": "Time's up.",
	"result.gaveUp": "Gave up.",
	"result.assistedHeadline": "Cleared (after reveal)",
	"result.assistedHint":
		"Good practice - solve it again on your own later for a real clear.",
	"result.yourInput": "Your input",
	"result.expectedCommand": "Expected command",
	"result.time": "time",
	"result.streak": "streak",
	"session.cleared": "cleared",
	"session.great": "great",
	"session.totalTime": "total time",
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
	// Leading space is deliberate: "N challenges" needs a space before the
	// word, while ja's counter word ("問") is written directly against the
	// digit with no space (e.g. "7問") - see MenuScreen.tsx's LevelCard.
	"menu.challengeUnit": " challenges",
	"menu.cleared": "cleared",
	"menu.notPlayed": "not played yet",
	"menu.play": "Play",
	"menu.selected": "Selected",
	"menu.shuffled": "Shuffled",
	"menu.reviewTitle": "Review",
	"menu.reviewSubtitle": "solve across levels",
	"menu.reviewUnclearedLabel": "Not yet cleared",
	"menu.reviewNotGreatLabel": "Not yet Great",
	"menu.reviewUnclearedDescription": "Not cleared on your most recent attempt",
	"menu.reviewNotGreatDescription":
		"Cleared last time, but not with the fewest keys",
	"menu.howToPlayTitle": "How to play",
	"menu.howToPlayOperators":
		"Operators: d (delete), c (change), y (yank), x (delete one character)",
	"menu.howToPlayMotions":
		"Motions: h l 0 $ w e b, f{char} (to, inclusive), t{char} (till, exclusive)",
	"menu.howToPlayTextObjects":
		"Text objects: iw/aw (word), i\"/a\" and i'/a' (quotes), i)/a) (parentheses)",
	"menu.howToPlayJudging":
		"Judging: your final text is compared to the goal, not the keys you pressed — Clear, Great (fewest keys), or a verbose Clear",
	"menu.howToPlayPlayground":
		"Playground: no timer, no judging - a sandbox for practicing freely",
	"menu.howToPlayDifferencesTitle": "How vimgram differs from Vim",
	"menu.howToPlayDifferencesSubset":
		"vimgram is a subset of Vim, focused specifically on practicing operator + motion.",
	"menu.howToPlayDifferencesInsert":
		"i / a alone don't enter INSERT mode - that's intentional. The only way into INSERT is through the c operator (cw, ci\", ...).",
	"menu.howToPlayDifferencesReason":
		"Why: this game trains you to see the range you want to edit as a motion and change it in one strike - not to insert first and fix up after.",
	"menu.howToPlayDifferencesOther":
		"Also not supported: Visual mode, multi-line editing, undo/redo, registers, macros, and . (repeat).",
	"hint.insertUnsupported":
		'Insert with i is not supported in vimgram. Try a change operator like cw or ci" instead.',
	"hint.unsupportedKey": "This key is not supported in vimgram.",
	"milestone.bannerTitle": "Milestone reached!",
	"milestone.levelFullyClearedPrefix": "Level ",
	"milestone.levelFullyClearedSuffix": " fully cleared!",
	"milestone.starPromptMessage":
		"If vimgram has been useful, a star on GitHub would help.",
	"milestone.starAction": "Star on GitHub",
	"milestone.muteAction": "don't show this again",
	"levelSummary.allGreatHeadline": "All Great!",
	"levelSummary.clearedHeadline": "Level clear!",
	"levelSummary.partialHeadline": "One lap done",
	"levelSummary.reviewSuffix": " (Review)",
	"levelSummary.notGreatPrefix": "Not yet Great on ",
	"levelSummary.notGreatSuffix": " challenges",
	"levelSummary.remainingPrefix": "",
	"levelSummary.remainingSuffix": " more to clear them all",
	"levelSummary.assistedRemainingPrefix": "",
	"levelSummary.assistedRemainingSuffix":
		" challenges were cleared after viewing the answer - solve them again on your own later for a real clear.",
	"levelSummary.badgeFailed": "Failed",
	"levelSummary.badgeAssisted": "assisted",
	"levelSummary.timeoutShort": "Time's up",
	"levelSummary.gaveUpShort": "Gave up",
	"levelSummary.skippedShort": "Skipped",
	"levelSummary.keysUnit": "keys",
	"levelSummary.breakdownTitle": "Challenge results",
	"levelSummary.replay": "Replay",
	"keyHint.select": "select",
	"keyHint.close": "close",
	"keyHint.skip": "skip",
	"keyHint.giveUp": "give up",
	"keyHint.next": "next",
	"keyHint.retry": "retry",
	"keyHint.back": "back",
	"keyHint.playground": "playground",
	"playground.subtitle": "no timer, no judging - just a sandbox",
	"playground.cursor": "cursor",
	"playground.yankLabel": "yank",
	"playground.yankEmpty": "—",
	"playground.setTextLabel": "Buffer text",
	"playground.setTextPlaceholder": "Type ASCII text...",
	"playground.set": "Set",
	"playground.reset": "Reset",
	"playground.asciiOnly": "ASCII characters only - that text wasn't set.",
	"playground.presets": "Presets",
	"playground.presetVariable": "Variable",
	"playground.presetList": "List",
	"playground.presetFunctionCall": "Function call",
	"playground.presetQuotes": "Quotes",
	"playground.history": "recent commands",
	"playground.historyEmpty": "Commands you type will appear here.",
	"playground.unresolvedPrefix": "not resolved — ",
	"playground.cheatSheetTitle": "Key cheat sheet",
	"playground.cheatSheetOperators": "Operators",
	"playground.cheatSheetMotions": "Motions",
	"playground.cheatSheetTextObjects": "Text objects",
};

const ja: Partial<Record<UIStringKey, string>> = {
	"nav.game": "ゲーム",
	"nav.playground": "プレイグラウンド",
	"game.difficulty": "難易度",
	"game.keysNone": "（なし）",
	"game.hints": "ヒント",
	"game.inputLabel": "入力",
	"game.pendingCount": "カウント",
	"game.pendingOperator": "オペレータ待機中 — モーションを入力…",
	"game.pendingCharTarget": "対象文字待ち…",
	"game.pendingTextObjectTarget": "対象待ち（w, \", ', )）…",
	"game.insertStatus": "INSERT — <Esc> で Normal に戻る",
	"game.insertedCountPrefix": "挿入中: ",
	"game.insertedCountSuffix": "文字",
	"common.backToMenu": "メニューへ戻る",
	"result.great": "Great!",
	"result.verboseHeadline": "クリア",
	"result.shorterSolutionHint": "より短い操作があります",
	"result.keyCountLabel": "キー数",
	"result.idealKeyCountLabel": "想定",
	"result.textChangeTitle": "テキストの変化",
	"result.before": "変更前",
	"result.after": "変更後",
	"result.timeout": "時間切れ。",
	"result.gaveUp": "ギブアップ。",
	"result.assistedHeadline": "クリア（回答閲覧後）",
	"result.assistedHint":
		"いい練習です。後日もう一度自力で解くと正式なクリアになります。",
	"result.yourInput": "あなたの入力",
	"result.expectedCommand": "想定コマンド",
	"result.time": "タイム",
	"result.streak": "連続クリア",
	"session.cleared": "クリア",
	"session.great": "Great",
	"session.totalTime": "合計タイム",
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
	"menu.challengeUnit": "問",
	"menu.cleared": "クリア",
	"menu.notPlayed": "未プレイ",
	"menu.play": "遊ぶ",
	"menu.selected": "選択中",
	"menu.shuffled": "シャッフル",
	"menu.reviewTitle": "復習",
	"menu.reviewSubtitle": "レベル横断で解き直す",
	"menu.reviewUnclearedLabel": "未クリア",
	"menu.reviewNotGreatLabel": "Great未達",
	"menu.reviewUnclearedDescription": "直近の挑戦でまだクリアできていない問題",
	"menu.reviewNotGreatDescription": "直近のクリアが最短ではなかった問題",
	"menu.howToPlayTitle": "遊び方",
	"menu.howToPlayOperators":
		"オペレータ: d（削除）, c（チェンジ）, y（ヤンク）, x（1文字削除）",
	"menu.howToPlayMotions":
		"モーション: h l 0 $ w e b, f{文字}（含む）, t{文字}（含まない）",
	"menu.howToPlayTextObjects":
		"テキストオブジェクト: iw/aw（単語）, i\"/a\" と i'/a'（クォート）, i)/a)（丸括弧）",
	"menu.howToPlayJudging":
		"判定: 押したキーではなく最終的なテキストの一致で判定します（クリア / Great（最短） / 冗長クリア）",
	"menu.howToPlayPlayground":
		"プレイグラウンド: タイマーも判定もない、自由に試せる素振り場です",
	"menu.howToPlayDifferencesTitle": "vimgram と Vim の違い",
	"menu.howToPlayDifferencesSubset":
		"vimgram は operator + motion の練習に特化した Vim のサブセットです。",
	"menu.howToPlayDifferencesInsert":
		'i / a 単体での INSERT モード突入は意図的に非対応です。INSERT に入るのは c オペレータ（cw, ci" など）経由のみです。',
	"menu.howToPlayDifferencesReason":
		"理由: 挿入してから直すのではなく、「編集したい範囲を motion で捉えて一撃で変える」感覚を鍛えるのがこのゲームの目的だからです。",
	"menu.howToPlayDifferencesOther":
		"ほかにも未対応: Visual mode、複数行編集、undo/redo、レジスタ指定、マクロ、.（リピート）。",
	"hint.insertUnsupported":
		'vimgram では i での INSERT 突入は非対応です。c オペレータ（cw, ci" など）で変更してみましょう',
	"hint.unsupportedKey": "このキーは vimgram では未対応です",
	"milestone.bannerTitle": "達成しました！",
	"milestone.levelFullyClearedPrefix": "レベル ",
	"milestone.levelFullyClearedSuffix": " を全問クリアしました！",
	"milestone.starPromptMessage":
		"vimgram が役に立っていたら、GitHub でスターをお願いします。",
	"milestone.starAction": "GitHub でスターする",
	"milestone.muteAction": "今後表示しない",
	"levelSummary.allGreatHeadline": "全問 Great!",
	"levelSummary.clearedHeadline": "レベルクリア!",
	"levelSummary.partialHeadline": "1周おつかれさまでした",
	"levelSummary.reviewSuffix": "（復習）",
	"levelSummary.notGreatPrefix": "Great未達が",
	"levelSummary.notGreatSuffix": "問あります",
	"levelSummary.remainingPrefix": "あと",
	"levelSummary.remainingSuffix": "問で全問クリアです",
	"levelSummary.assistedRemainingPrefix": "回答閲覧後にクリアした問題が",
	"levelSummary.assistedRemainingSuffix":
		"問あります。後日自力で解くと正式なクリアになります。",
	"levelSummary.badgeFailed": "失敗",
	"levelSummary.badgeAssisted": "閲覧後",
	"levelSummary.timeoutShort": "時間切れ",
	"levelSummary.gaveUpShort": "ギブアップ",
	"levelSummary.skippedShort": "スキップ",
	"levelSummary.keysUnit": "キー",
	"levelSummary.breakdownTitle": "問題ごとの結果",
	"levelSummary.replay": "もう一周",
	"keyHint.select": "選択",
	"keyHint.close": "閉じる",
	"keyHint.skip": "スキップ",
	"keyHint.giveUp": "ギブアップ",
	"keyHint.next": "次へ",
	"keyHint.retry": "リトライ",
	"keyHint.back": "前の問題へ",
	"keyHint.playground": "プレイグラウンド",
	"playground.subtitle": "タイマーも判定もない素振り場",
	"playground.cursor": "カーソル",
	"playground.yankLabel": "yank",
	"playground.yankEmpty": "—",
	"playground.setTextLabel": "バッファのテキスト",
	"playground.setTextPlaceholder": "ASCIIテキストを入力...",
	"playground.set": "セット",
	"playground.reset": "リセット",
	"playground.asciiOnly":
		"ASCIIのみ対応しています（このテキストは設定されませんでした）。",
	"playground.presets": "プリセット",
	"playground.presetVariable": "変数",
	"playground.presetList": "リスト",
	"playground.presetFunctionCall": "関数呼び出し",
	"playground.presetQuotes": "クォート",
	"playground.history": "直近のコマンド",
	"playground.historyEmpty": "コマンドを打つとここに履歴が並びます",
	"playground.unresolvedPrefix": "不成立 — ",
	"playground.cheatSheetTitle": "使えるキー早見表",
	"playground.cheatSheetOperators": "オペレータ",
	"playground.cheatSheetMotions": "モーション",
	"playground.cheatSheetTextObjects": "テキストオブジェクト",
};

export function t(key: UIStringKey, locale: Locale): string {
	if (locale === "ja") {
		return ja[key] ?? en[key];
	}
	return en[key];
}
