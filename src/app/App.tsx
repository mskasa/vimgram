import { useState } from "react";
import { LocaleToggle } from "./components/LocaleToggle";
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
			<nav
				style={{
					display: "flex",
					justifyContent: "space-between",
					fontFamily: "monospace",
					padding: "0.5rem 2rem",
					borderBottom: "1px solid #444",
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
				<LocaleToggle />
			</nav>
			{page === "game" ? <GamePage /> : <PlaygroundPage />}
		</div>
	);
}
