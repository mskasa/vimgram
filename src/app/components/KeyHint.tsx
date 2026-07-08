export type KeyHintItem =
	| {
			kind?: "single";
			keyLabel: string;
			label: string;
			onActivate: () => void;
			// Marks the row's main "confirm/proceed" action (usually Enter) -
			// the only keycap allowed to use the warm accent color (see
			// CLAUDE.md "UI 操作": accent is reserved for selected/primary-key/
			// Star/Great).
			primary?: boolean;
	  }
	// A cluster of keycaps that share ONE label (e.g. the menu's "h/j/k/l
	// 選択" navigation legend) - each key still fires its own onActivate, so
	// "one keycap, one action" holds for every individual key in the group.
	// What's shared is only the label text, not the action.
	| {
			kind: "group";
			keys: { keyLabel: string; onActivate: () => void }[];
			label: string;
	  };

// The keyboard is the first-class way to operate every screen (see CLAUDE.md
// "UI 操作"); this is the mouse/tap affordance for that same set of actions -
// each keycap fires the identical handler a real keypress would, so there is
// never a standalone button duplicating what a keycap already does.
export function KeyHintRow({ items }: { items: KeyHintItem[] }) {
	return (
		<p className="vg-keyhint-row">
			{items.map((item) =>
				item.kind === "group" ? (
					<span
						className="vg-keycap-group"
						key={item.keys.map((k) => k.keyLabel).join("/")}
					>
						{item.keys.map((k) => (
							<button
								key={k.keyLabel}
								type="button"
								className="vg-keycap"
								onClick={k.onActivate}
							>
								<kbd className="vg-keycap-key">{k.keyLabel}</kbd>
							</button>
						))}
						<span>{item.label}</span>
					</span>
				) : (
					<button
						key={item.keyLabel}
						type="button"
						className="vg-keycap"
						onClick={item.onActivate}
					>
						<kbd
							className={
								item.primary
									? "vg-keycap-key vg-keycap-key--primary"
									: "vg-keycap-key"
							}
						>
							{item.keyLabel}
						</kbd>
						<span>{item.label}</span>
					</button>
				),
			)}
		</p>
	);
}
