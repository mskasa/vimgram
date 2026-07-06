export type KeyHintItem = {
	keyLabel: string;
	label: string;
	onActivate: () => void;
	// Marks the row's main "confirm/proceed" action (usually Enter) - the
	// only keycap allowed to use the warm accent color (see CLAUDE.md
	// "UI 操作": accent is reserved for selected/primary-key/Star/Great).
	primary?: boolean;
};

// The keyboard is the first-class way to operate every screen (see CLAUDE.md
// "UI 操作"); this is the mouse/tap affordance for that same set of actions -
// each item fires the identical handler a real keypress would, so there is
// never a standalone button duplicating what a keycap already does.
export function KeyHintRow({ items }: { items: KeyHintItem[] }) {
	return (
		<p className="vg-keyhint-row">
			{items.map((item) => (
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
			))}
		</p>
	);
}
