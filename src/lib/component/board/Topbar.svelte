<script lang="ts">
	import { locale, t } from '$lib/i18n';

	interface Props {
		boardTitle: string;
		canUndo: boolean;
		canRedo: boolean;
		onGoBack: () => void;
		onDownloadPdf: () => void;
		onDownloadImage: () => void;
		/** Resize board to fit strokes and elements (optional; board page only). */
		onFitBoardToContent?: () => void;
		onClear: () => void;
		onShowImport: () => void;
		onExportJson?: () => void;
		onImportJsonClick?: () => void;
		onShowLibrary?: () => void;
		onShowShortcuts?: () => void;
		onUndo: () => void;
		onRedo: () => void;
	}

	let {
		boardTitle = $bindable(''),
		canUndo,
		canRedo,
		onGoBack,
		onDownloadPdf,
		onDownloadImage,
		onFitBoardToContent,
		onClear,
		onShowImport,
		onExportJson,
		onImportJsonClick,
		onShowLibrary,
		onShowShortcuts,
		onUndo,
		onRedo
	}: Props = $props();
</script>

<header class="topbar">
	<span class="sr-only" aria-hidden="true">{$locale}</span>
	<div class="topbar-left">
		<button type="button" class="icon-btn" onclick={onGoBack} title={$t('topbar.goBack')}>
			<!-- prettier-ignore -->
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
		</button>
		<input bind:value={boardTitle} class="title-input" placeholder={$t('topbar.boardTitle')} />
		{#if onShowShortcuts}
			<button type="button" class="icon-btn" onclick={onShowShortcuts} title={$t('topbar.shortcuts')}>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="12" cy="12" r="10"/>
					<path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
					<line x1="12" y1="17" x2="12.01" y2="17"/>
				</svg>
			</button>
		{/if}
	</div>

	<div class="topbar-right">
		<!-- 그룹: 내보내기 (PDF, 이미지, JSON) -->
		<span class="topbar-group">
			<button type="button" class="icon-btn" onclick={onDownloadPdf} title={$t('topbar.exportPdf')} aria-label={$t('topbar.exportPdf')}>
				<!-- prettier-ignore -->
				<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="9" y2="17"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="15" y1="15" x2="15" y2="17"/></svg>
			</button>
			<button type="button" class="icon-btn" onclick={onDownloadImage} title={$t('topbar.exportImage')} aria-label={$t('topbar.exportImage')}>
				<!-- prettier-ignore -->
				<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
			</button>
			{#if onExportJson}
				<button type="button" class="icon-btn" onclick={onExportJson} title={$t('topbar.exportJson')} aria-label={$t('topbar.exportJson')}>
					<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M10 13h4"/><path d="M10 17h4"/><path d="M8 13h.01"/><path d="M8 17h.01"/></svg>
				</button>
			{/if}
		</span>

		<div class="separator" aria-hidden="true"></div>

		<!-- 그룹: 가져오기 (다른 보드, JSON 파일) -->
		<span class="topbar-group">
			<button type="button" class="icon-btn" onclick={onShowImport} title={$t('topbar.import')} aria-label={$t('topbar.import')}>
				<!-- prettier-ignore -->
				<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><polyline points="9 14 12 11 15 14"/></svg>
			</button>
			{#if onImportJsonClick}
				<button type="button" class="icon-btn" onclick={onImportJsonClick} title={$t('topbar.importJson')} aria-label={$t('topbar.importJson')}>
					<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
				</button>
			{/if}
		</span>

		<div class="separator" aria-hidden="true"></div>

		<!-- 그룹: 라이브러리 -->
		{#if onShowLibrary}
			<span class="topbar-group">
				<button type="button" class="icon-btn" onclick={onShowLibrary} title={$t('topbar.library')} aria-label={$t('topbar.library')}>
					<!-- prettier-ignore -->
					<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/><path d="M8 7h8"/><path d="M8 11h8"/></svg>
				</button>
			</span>
			<div class="separator" aria-hidden="true"></div>
		{/if}

		<!-- 그룹: 내용에 맞게 보드 크기 · 보드 비우기 -->
		<span class="topbar-group">
			{#if onFitBoardToContent}
				<button
					type="button"
					class="icon-btn"
					onclick={onFitBoardToContent}
					title={$t('topbar.fitBoardTitle')}
					aria-label={$t('topbar.fitBoard')}
				>
					<!-- Inner content + outer corner brackets = fit bounds to content -->
					<svg
						width="17"
						height="17"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<rect x="8" y="8" width="8" height="8" rx="1" />
						<path d="M4 10V4h6M14 4h6v6M20 14v6h-6M10 20H4v-6" />
					</svg>
				</button>
			{/if}
			<button type="button" class="icon-btn danger" onclick={onClear} title={$t('topbar.clearBoard')} aria-label={$t('topbar.clearBoard')}>
			<!-- Clear board: eraser (wipe clean) – distinct from trash (multi-eraser) and undo/redo -->
			<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20H7L3 16c-.8-.8-.8-2 0-2.8l10-10c.8-.8 2-.8 2.8 0l5.7 5.7c.8.8.8 2 0 2.8L14 19"/></svg>
			</button>
		</span>

		<div class="separator" aria-hidden="true"></div>

		<!-- 그룹: 실행 취소 / 다시 실행 -->
		<span class="topbar-group">
			<button type="button" class="icon-btn" onclick={onUndo} disabled={!canUndo} title={$t('topbar.undo')} aria-label={$t('topbar.undo')}>
				<!-- prettier-ignore -->
				<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>
			</button>
			<button type="button" class="icon-btn" onclick={onRedo} disabled={!canRedo} title={$t('topbar.redo')} aria-label={$t('topbar.redo')}>
				<!-- prettier-ignore -->
				<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.49-3.5"/></svg>
			</button>
		</span>
	</div>
</header>

<style>
	.topbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.7rem;
		padding: 0.6rem 1rem;
		border-bottom: 1px solid var(--ui-border-strong);
		background: var(--ui-surface);
		box-shadow: 0 1px 4px var(--ui-shadow);
	}

	.topbar-left,
	.topbar-right {
		display: flex;
		gap: 0.35rem;
		align-items: center;
	}

	.topbar-group {
		display: inline-flex;
		gap: 0.35rem;
		align-items: center;
	}

	.title-input {
		min-width: 200px;
		border: 1px solid var(--ui-border);
		border-radius: 10px;
		padding: 0.42rem 0.65rem;
		font-size: 0.9rem;
		font-weight: 500;
		color: var(--ui-text-secondary);
		background: var(--ui-surface-alt);
		outline: none;
		transition: border-color 0.15s, box-shadow 0.15s;
	}

	.title-input:focus {
		border-color: var(--ui-accent);
		box-shadow: 0 0 0 3px var(--ui-accent-focus);
		background: var(--ui-surface);
	}

	.icon-btn {
		width: 36px;
		height: 36px;
		padding: 0;
		display: grid;
		place-items: center;
		border: 1px solid var(--ui-border);
		background: var(--ui-surface);
		border-radius: 10px;
		cursor: pointer;
		color: var(--ui-text-muted);
		transition:
			background 0.15s,
			border-color 0.15s,
			color 0.15s,
			box-shadow 0.15s;
		flex-shrink: 0;
	}

	.icon-btn:hover:not(:disabled) {
		background: var(--ui-surface-alt);
		border-color: var(--ui-border-strong);
		color: var(--ui-text-secondary);
	}

	.icon-btn:disabled {
		opacity: 0.32;
		cursor: default;
	}

	.icon-btn.danger:hover:not(:disabled) {
		background: var(--ui-danger-bg);
		border-color: var(--ui-danger);
		color: var(--ui-danger);
	}

	.sr-only {
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

	.separator {
		width: 1px;
		height: 22px;
		background: var(--ui-border);
		margin: 0 0.1rem;
		flex-shrink: 0;
	}
</style>
