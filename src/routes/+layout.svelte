<script lang="ts">
	import { onMount } from 'svelte';
	import { Toaster } from 'svelte-hot-french-toast';
	import {
		UI_THEMES,
		getStoredUiTheme,
		setStoredUiTheme,
		applyUiTheme,
		type UiThemeId
	} from '$lib/ui-theme';
	import { locale, t, getStoredLocale, setStoredLocale, type Locale } from '$lib/i18n';

	import '../app.css';

	let { children } = $props();
	let uiTheme = $state<UiThemeId>(getStoredUiTheme());
	let themeMenuOpen = $state(false);
	let langMenuOpen = $state(false);

	onMount(() => {
		applyUiTheme(uiTheme);
		locale.set(getStoredLocale());
	});

	const setTheme = (theme: UiThemeId) => {
		uiTheme = theme;
		setStoredUiTheme(theme);
		applyUiTheme(theme);
		themeMenuOpen = false;
	};

	const setLang = (loc: Locale) => {
		locale.set(loc);
		setStoredLocale(loc);
		langMenuOpen = false;
	};
</script>

<Toaster />
<svelte:head>
	<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
</svelte:head>

{@render children()}

<!-- 언어 · 테마 전환 (전역 노출) -->
<div class="global-switchers">
	<div class="lang-switcher-wrap">
		<button
			type="button"
			class="switcher-trigger"
			onclick={() => (langMenuOpen = !langMenuOpen)}
			onkeydown={(e) => e.key === 'Escape' && (langMenuOpen = false)}
			title={$t('lang.switch')}
			aria-label={$t('lang.switch')}
			aria-expanded={langMenuOpen}
			aria-haspopup="true"
		>
			<span class="switcher-label">{$locale === 'ko' ? $t('lang.ko') : $t('lang.en')}</span>
		</button>
		{#if langMenuOpen}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<div class="switcher-backdrop" role="presentation" onclick={() => (langMenuOpen = false)}></div>
			<div class="switcher-menu" role="menu">
				<button type="button" class="switcher-option" class:active={$locale === 'en'} onclick={() => setLang('en')} role="menuitemradio" aria-checked={$locale === 'en'}>{$t('lang.en')}</button>
				<button type="button" class="switcher-option" class:active={$locale === 'ko'} onclick={() => setLang('ko')} role="menuitemradio" aria-checked={$locale === 'ko'}>{$t('lang.ko')}</button>
			</div>
		{/if}
	</div>
	<div class="theme-switcher-wrap">
		<button
			type="button"
			class="theme-trigger switcher-trigger"
			onclick={() => (themeMenuOpen = !themeMenuOpen)}
			onkeydown={(e) => e.key === 'Escape' && (themeMenuOpen = false)}
			title={$t('theme.switch')}
			aria-label={$t('theme.switch')}
			aria-expanded={themeMenuOpen}
			aria-haspopup="true"
		>
			<span class="theme-trigger-dot" data-theme={uiTheme}></span>
			<span class="theme-trigger-label">{UI_THEMES.find((th) => th.id === uiTheme)?.label ?? uiTheme}</span>
		</button>
	{#if themeMenuOpen}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			class="theme-backdrop"
			role="presentation"
			onclick={() => (themeMenuOpen = false)}
		></div>
		<div class="theme-menu switcher-menu" role="menu">
			{#each UI_THEMES as theme}
				<button
					type="button"
					class="theme-option"
					class:active={uiTheme === theme.id}
					onclick={() => setTheme(theme.id)}
					role="menuitemradio"
					aria-checked={uiTheme === theme.id}
				>
					<span class="theme-option-dot" data-theme={theme.id}></span>
					{theme.label}
				</button>
			{/each}
		</div>
	{/if}
	</div>
</div>

<style>
	.global-switchers {
		position: fixed;
		bottom: 1rem;
		right: 1rem;
		z-index: 9998;
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.lang-switcher-wrap,
	.theme-switcher-wrap {
		position: relative;
	}

	.switcher-trigger {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.45rem 0.75rem;
		border-radius: 12px;
		border: 1px solid var(--ui-border-strong);
		background: var(--ui-glass-bg);
		backdrop-filter: blur(8px);
		color: var(--ui-text-secondary);
		font-size: 0.8rem;
		font-weight: 500;
		cursor: pointer;
		box-shadow: 0 2px 10px var(--ui-shadow);
		transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
	}

	.switcher-trigger:hover {
		background: var(--ui-surface);
		border-color: var(--ui-border-strong);
		box-shadow: 0 4px 14px var(--ui-shadow);
	}

	.switcher-label {
		letter-spacing: 0.02em;
	}

	.switcher-backdrop {
		position: fixed;
		inset: 0;
		background: transparent;
	}

	.switcher-menu {
		position: absolute;
		bottom: calc(100% + 0.5rem);
		right: 0;
		min-width: 100px;
		padding: 0.35rem;
		border-radius: 12px;
		border: 1px solid var(--ui-border);
		background: var(--ui-surface);
		box-shadow: 0 8px 24px var(--ui-shadow-strong);
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.switcher-option {
		display: flex;
		align-items: center;
		justify-content: flex-start;
		gap: 0.5rem;
		padding: 0.5rem 0.65rem;
		border: none;
		border-radius: 8px;
		background: transparent;
		color: var(--ui-text-secondary);
		font-size: 0.85rem;
		cursor: pointer;
		text-align: left;
		transition: background 0.12s, color 0.12s;
	}

	.switcher-option:hover {
		background: var(--ui-accent-muted);
		color: var(--ui-accent-hover);
	}

	.switcher-option.active {
		background: var(--ui-accent-muted);
		color: var(--ui-accent-hover);
		font-weight: 600;
	}

	:global(.sr-only) {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	/* Shared scrollbar – 테마 변수 사용 */
	:global(.scrollbar-theme) {
		scrollbar-width: thin;
		scrollbar-color: var(--ui-scrollbar) transparent;
	}

	:global(.scrollbar-theme)::-webkit-scrollbar {
		width: 7px;
		height: 7px;
	}

	:global(.scrollbar-theme)::-webkit-scrollbar-track {
		background: transparent;
		border-radius: 99px;
	}

	:global(.scrollbar-theme)::-webkit-scrollbar-thumb {
		background: var(--ui-scrollbar);
		border-radius: 99px;
		border: 2px solid transparent;
		background-clip: padding-box;
		transition: background 0.2s;
	}

	:global(.scrollbar-theme)::-webkit-scrollbar-thumb:hover {
		background: var(--ui-scrollbar-hover);
		border: 2px solid transparent;
		background-clip: padding-box;
	}

	:global(.scrollbar-theme)::-webkit-scrollbar-corner {
		background: transparent;
	}

	.theme-trigger:hover {
		background: var(--ui-surface);
		border-color: var(--ui-border-strong);
		box-shadow: 0 4px 14px var(--ui-shadow);
	}

	.theme-trigger-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		flex-shrink: 0;
		transition: background 0.2s;
	}

	.theme-trigger-dot[data-theme='light'] {
		background: #94a3b8;
		box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.08);
	}

	.theme-trigger-dot[data-theme='dark'] {
		background: #475569;
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1);
	}

	.theme-trigger-dot[data-theme='modern'] {
		background: #8b6914;
		box-shadow: 0 0 0 1px rgba(139, 105, 20, 0.35);
	}

	.theme-trigger-label {
		letter-spacing: 0.02em;
	}

	.theme-backdrop {
		position: fixed;
		inset: 0;
		background: transparent;
	}

	.theme-menu.switcher-menu {
		position: absolute;
		bottom: calc(100% + 0.5rem);
		right: 0;
		min-width: 120px;
		padding: 0.35rem;
		border-radius: 12px;
		border: 1px solid var(--ui-border);
		background: var(--ui-surface);
		box-shadow: 0 8px 24px var(--ui-shadow-strong);
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.theme-option {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.65rem;
		border: none;
		border-radius: 8px;
		background: transparent;
		color: var(--ui-text-secondary);
		font-size: 0.85rem;
		cursor: pointer;
		text-align: left;
		transition: background 0.12s, color 0.12s;
	}

	.theme-option:hover {
		background: var(--ui-accent-muted);
		color: var(--ui-accent-hover);
	}

	.theme-option.active {
		background: var(--ui-accent-muted);
		color: var(--ui-accent-hover);
		font-weight: 600;
	}

	.theme-option-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.theme-option-dot[data-theme='light'] {
		background: #94a3b8;
	}

	.theme-option-dot[data-theme='dark'] {
		background: #475569;
	}

	.theme-option-dot[data-theme='modern'] {
		background: #8b6914;
	}
</style>
