import { derived } from 'svelte/store';
import { writable } from 'svelte/store';
import type { Locale } from './translations.js';
import { translations } from './translations.js';

export type { Locale, TranslationMap } from './translations.js';
export { translations };

const STORAGE_KEY = 'drawboard-locale';

const isValidLocale = (v: string): v is Locale => v === 'en' || v === 'ko';

export const getStoredLocale = (): Locale => {
	if (typeof window === 'undefined') return 'en';
	const raw = localStorage.getItem(STORAGE_KEY);
	return isValidLocale(raw ?? '') ? (raw as Locale) : 'en';
};

export const setStoredLocale = (locale: Locale): void => {
	localStorage.setItem(STORAGE_KEY, locale);
};

export const locale = writable<Locale>(getStoredLocale());

/**
 * 번역 함수 스토어. 템플릿에서 $t('key') 또는 $t('key', { n: 1 }) 로 쓰면
 * 언어 전환 시 자동으로 반응합니다. (다른 코드의 getContext, createElement 등은 변경하지 말 것)
 */
export const t = derived(locale, ($loc) => {
	return (key: string, params?: Record<string, string | number>): string => {
		const str = translations[$loc][key] ?? translations.en[key] ?? key;
		if (!params) return str;
		return Object.entries(params).reduce(
			(acc, [k, v]) => acc.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)),
			str
		);
	};
});
