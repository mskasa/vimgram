import { createContext, type ReactNode, useContext, useState } from "react";
import type { Locale } from "../../core/i18n";
import { detectInitialLocale, persistLocale } from "./locale";
import { t, type UIStringKey } from "./strings";

type LocaleContextValue = {
	locale: Locale;
	setLocale: (locale: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
	const [locale, setLocaleState] = useState<Locale>(detectInitialLocale);

	const setLocale = (next: Locale) => {
		setLocaleState(next);
		persistLocale(next);
	};

	return (
		<LocaleContext.Provider value={{ locale, setLocale }}>
			{children}
		</LocaleContext.Provider>
	);
}

export function useLocale(): LocaleContextValue {
	const context = useContext(LocaleContext);
	if (!context) {
		throw new Error("useLocale must be used within a LocaleProvider");
	}
	return context;
}

// Convenience hook combining the current locale with the string dictionary.
export function useT(): (key: UIStringKey) => string {
	const { locale } = useLocale();
	return (key: UIStringKey) => t(key, locale);
}
