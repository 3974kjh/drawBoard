/**
 * UI 테마 (앱 전체 무드): light | dark | modern
 * 보드 캔버스 테마(BOARD_THEMES)와 별개로, 툴바·패널·모달 등 UI 색상을 제어합니다.
 */

export type UiThemeId = 'light' | 'dark' | 'modern';

export const UI_THEMES: { id: UiThemeId; label: string }[] = [
	{ id: 'light', label: 'Light' },
	{ id: 'dark', label: 'Dark' },
	{ id: 'modern', label: 'Modern' }
];

const STORAGE_KEY = 'drawboard-ui-theme';

const isValidTheme = (v: string): v is UiThemeId =>
	v === 'light' || v === 'dark' || v === 'modern';

export const getStoredUiTheme = (): UiThemeId => {
	if (typeof window === 'undefined') return 'light';
	const raw = localStorage.getItem(STORAGE_KEY);
	return isValidTheme(raw ?? '') ? raw : 'light';
};

export const setStoredUiTheme = (theme: UiThemeId): void => {
	localStorage.setItem(STORAGE_KEY, theme);
};

export const applyUiTheme = (theme: UiThemeId): void => {
	document.documentElement.setAttribute('data-ui-theme', theme);
	// 브라우저 theme-color (주소창 등)
	const meta = document.querySelector('meta[name="theme-color"]');
	if (meta) {
		const colors: Record<UiThemeId, string> = {
			light: '#2563eb',
			dark: '#1e293b',
			modern: '#8b6914'
		};
		meta.setAttribute('content', colors[theme]);
	}
};
