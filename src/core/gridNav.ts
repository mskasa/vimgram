export type Rect = { left: number; right: number; top: number; bottom: number };

function centerX(r: Rect): number {
	return (r.left + r.right) / 2;
}

function centerY(r: Rect): number {
	return (r.top + r.bottom) / 2;
}

// Finds the next index to move to when pressing j/k (down/up) in a
// responsive card grid whose column count isn't known ahead of time (see
// CLAUDE.md "UI 操作": auto-fit の折り返しを前提にした列数の決め打ちをしない).
// Pure function over already-measured rects (getBoundingClientRect results,
// or plain fixtures in tests) - no DOM access here, so it's unit-testable
// without jsdom.
//
// Algorithm: among items strictly below/above the current one (compared by
// vertical center), find the nearest row (smallest vertical center
// distance), then within that row pick the item whose horizontal center is
// closest. `selectable[i] === false` (e.g. an empty review queue) excludes
// that index as a destination entirely - its rect is otherwise irrelevant.
// Returns `currentIndex` unchanged if nothing qualifies.
export function findNextInDirection(
	rects: Rect[],
	selectable: boolean[],
	currentIndex: number,
	direction: "up" | "down",
): number {
	const current = rects[currentIndex];
	if (!current) return currentIndex;
	const currentCenterY = centerY(current);
	const currentCenterX = centerX(current);

	let bestIndex: number | null = null;
	let bestDy = Number.POSITIVE_INFINITY;
	let bestDx = Number.POSITIVE_INFINITY;

	for (let i = 0; i < rects.length; i++) {
		if (i === currentIndex || !selectable[i]) continue;
		const dy = centerY(rects[i]) - currentCenterY;
		const inDirection = direction === "down" ? dy > 0 : dy < 0;
		if (!inDirection) continue;

		const absDy = Math.abs(dy);
		const absDx = Math.abs(centerX(rects[i]) - currentCenterX);
		if (absDy < bestDy || (absDy === bestDy && absDx < bestDx)) {
			bestIndex = i;
			bestDy = absDy;
			bestDx = absDx;
		}
	}

	return bestIndex ?? currentIndex;
}
