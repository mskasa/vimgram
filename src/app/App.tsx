import { useState } from "react";
import { LocaleToggle } from "./components/LocaleToggle";
import { StarButton } from "./components/StarButton";
import { LocaleProvider, useT } from "./i18n/LocaleContext";
import { GamePage } from "./pages/GamePage";
import { PlaygroundPage } from "./pages/PlaygroundPage";

type Page = "game" | "playground";

export function App() {
	return (
		<LocaleProvider>
			<AppShell />
		</LocaleProvider>
	);
}

function AppShell() {
	const t = useT();
	const [page, setPage] = useState<Page>("game");

	return (
		<div>
			{/* The header bar spans the full viewport width; only its content is
			    constrained to vg-container's max-width (see CLAUDE.md "UI 操作"). */}
			<nav
				style={{
					background: "var(--bg-header)",
					borderBottom: "1px solid var(--border-base)",
				}}
			>
				<div
					className="vg-container"
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						fontFamily: "monospace",
						padding: "0.75rem 2rem",
					}}
				>
					<span>
						<button
							type="button"
							onClick={() => setPage("game")}
							disabled={page === "game"}
						>
							{t("nav.game")}
						</button>{" "}
						<button
							type="button"
							onClick={() => setPage("playground")}
							disabled={page === "playground"}
						>
							{t("nav.playground")}
						</button>
					</span>
					<span>
						<StarButton /> <LocaleToggle />
					</span>
				</div>
			</nav>
			{page === "game" ? <GamePage /> : <PlaygroundPage />}
		</div>
	);
}
