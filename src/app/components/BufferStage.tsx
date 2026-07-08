import { useT } from "../i18n/LocaleContext";
import { BufferView } from "./BufferView";

// The play screen's "stage" (see CLAUDE.md "UI 操作": プレイ画面はコンテキスト
// → お題 → バッファカード → 入力表示 → 静音フッター): mode, countdown, and the
// buffer text are all staged together so nothing needs a separate glance
// elsewhere on the screen. The timer bar's *displayed* width is just
// `timeLeft / timeLimitSec` - the countdown truth stays entirely in
// ChallengeRound's existing per-second `timeLeft` state; only the width
// transition (see index.css's .vg-bar-fill) smooths the visual step between
// ticks, it never runs its own independent clock.
//
// The Playground reuses this same component in its "freeform" variant (see
// CLAUDE.md "UI 操作": プレイグラウンドは左ステージにプレイ画面と同一のバッ
// ファカードを使う) - no countdown to show there, so the header's right side
// shows cursor position + yank register contents instead, and the timer bar
// is omitted entirely (a bar with nothing counting down would be misleading).
type BufferStageProps = {
	mode: "normal" | "insert";
	text: string;
	cursor: number;
} & (
	| { variant: "timed"; timeLeft: number; timeLimitSec: number }
	| { variant: "freeform"; yankRegister: string | undefined }
);

function FreeformStageInfo({
	cursor,
	yankRegister,
}: {
	cursor: number;
	yankRegister: string | undefined;
}) {
	const t = useT();
	return (
		<span className="vg-stage-info">
			<span>
				{t("playground.cursor")}: {cursor}
			</span>
			<span>
				{t("playground.yankLabel")}:{" "}
				{yankRegister === undefined
					? t("playground.yankEmpty")
					: JSON.stringify(yankRegister)}
			</span>
		</span>
	);
}

export function BufferStage(props: BufferStageProps) {
	const { mode, text, cursor } = props;
	return (
		<div className="vg-stage">
			<div className="vg-stage-header">
				<span
					className={
						mode === "insert"
							? "vg-mode-badge vg-mode-badge--insert"
							: "vg-mode-badge"
					}
				>
					{mode === "insert" ? "INSERT" : "NORMAL"}
				</span>
				{props.variant === "freeform" ? (
					<FreeformStageInfo
						cursor={cursor}
						yankRegister={props.yankRegister}
					/>
				) : (
					<span className="vg-stage-info">⏱ {props.timeLeft}s</span>
				)}
			</div>
			<div className="vg-stage-body">
				<BufferView text={text} cursor={cursor} size="stage" />
			</div>
			{props.variant === "timed" && (
				<TimerBar timeLeft={props.timeLeft} timeLimitSec={props.timeLimitSec} />
			)}
		</div>
	);
}

function TimerBar({
	timeLeft,
	timeLimitSec,
}: {
	timeLeft: number;
	timeLimitSec: number;
}) {
	const ratio =
		timeLimitSec > 0 ? Math.max(0, Math.min(1, timeLeft / timeLimitSec)) : 0;
	const low = ratio <= 0.2;
	return (
		<div className="vg-bar-track">
			<div
				className={low ? "vg-bar-fill vg-bar-fill--miss" : "vg-bar-fill"}
				style={{ width: `${ratio * 100}%` }}
			/>
		</div>
	);
}
