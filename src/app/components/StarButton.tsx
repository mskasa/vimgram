import { useEffect, useState } from "react";
import { useT } from "../i18n/LocaleContext";
import { fetchStarCount } from "../starCache";

const REPO_URL = "https://github.com/mskasa/vimgram";

// Always renders as a working link, even if the star count never loads
// (offline, GitHub API rate limit, etc.) - see CLAUDE.md "GitHub Star ボタン".
export function StarButton() {
	const t = useT();
	const [stars, setStars] = useState<number | null>(null);

	useEffect(() => {
		let cancelled = false;
		fetchStarCount().then((count) => {
			if (!cancelled) setStars(count);
		});
		return () => {
			cancelled = true;
		};
	}, []);

	return (
		<a
			href={REPO_URL}
			target="_blank"
			rel="noopener noreferrer"
			style={{
				color: "var(--accent)",
				textDecoration: "none",
				fontWeight: 600,
			}}
		>
			⭐ {t("star.button")}
			{stars !== null ? ` (${stars})` : ""}
		</a>
	);
}
