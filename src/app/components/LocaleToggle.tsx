import { useLocale } from "../i18n/LocaleContext";

export function LocaleToggle() {
	const { locale, setLocale } = useLocale();
	return (
		<span>
			<button
				type="button"
				onClick={() => setLocale("en")}
				disabled={locale === "en"}
			>
				EN
			</button>{" "}
			<button
				type="button"
				onClick={() => setLocale("ja")}
				disabled={locale === "ja"}
			>
				JA
			</button>
		</span>
	);
}
