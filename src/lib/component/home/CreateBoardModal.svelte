<script lang="ts">
	import { BOARD_THEMES, type ThemeId } from '$lib/board-types';
	import { locale, t } from '$lib/i18n';

	interface Props {
		show: boolean;
		boardTitle: string;
		selectedThemeId: ThemeId;
		onCreate: () => void;
		onClose: () => void;
	}

	let {
		show,
		boardTitle = $bindable(''),
		selectedThemeId = $bindable<ThemeId>('whiteboard'),
		onCreate,
		onClose
	}: Props = $props();

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') onClose();
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			onCreate();
		}
	}
</script>

{#if show}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="modal-backdrop" onkeydown={handleKeydown}>
		<span class="sr-only" aria-hidden="true">{$locale}</span>
		<button class="backdrop-close" type="button" aria-label={$t('create.closeModal')} onclick={onClose}></button>
		<div class="modal" role="dialog" aria-modal="true" tabindex="-1">
			<div class="modal-header">
				<h2>{$t('create.title')}</h2>
				<button type="button" class="close-x" onclick={onClose} aria-label={$t('create.close')}>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
				</button>
			</div>

		<label class="field-label" for="board-title">{$t('create.boardName')}</label>
		<input id="board-title" class="field-input" bind:value={boardTitle} placeholder={$t('create.enterName')} />

		<p class="theme-title">{$t('create.selectTheme')}</p>
			<div class="theme-grid">
				{#each BOARD_THEMES as theme}
					<button
						type="button"
						class={`theme-btn ${theme.id === selectedThemeId ? 'active' : ''}`}
						onclick={() => (selectedThemeId = theme.id)}
					>
						<span
							class="preview"
							style={`background:${theme.background};--grid:${theme.gridColor};`}
						></span>
						<span class="theme-name">{theme.label}</span>
					</button>
				{/each}
			</div>

			<div class="modal-actions">
			<button type="button" class="btn-ghost" onclick={onClose}>{$t('create.cancel')}</button>
			<button type="button" class="btn-solid" onclick={onCreate}>{$t('create.create')}</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: var(--ui-overlay);
		backdrop-filter: blur(4px);
		display: grid;
		place-items: center;
		padding: 1rem;
		z-index: 100;
	}

	.backdrop-close {
		position: absolute;
		inset: 0;
		border: none;
		background: transparent;
		cursor: default;
	}

	.modal {
		position: relative;
		z-index: 1;
		background: var(--ui-surface);
		width: min(560px, 100%);
		border-radius: 20px;
		padding: 1.5rem;
		box-shadow: 0 20px 60px var(--ui-shadow-strong);
		animation: fadeUp 0.2s ease;
	}

	@keyframes fadeUp {
		from {
			opacity: 0;
			transform: translateY(12px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.2rem;
	}

	.modal-header h2 {
		margin: 0;
		font-size: 1.2rem;
		font-weight: 700;
	}

	.close-x {
		width: 32px;
		height: 32px;
		display: grid;
		place-items: center;
		border: none;
		background: var(--ui-surface-alt);
		border-radius: 8px;
		cursor: pointer;
		color: var(--ui-text-muted);
		transition: background 0.12s;
	}

	.close-x:hover {
		background: var(--ui-border);
		color: var(--ui-text-secondary);
	}

	.field-label {
		display: block;
		font-size: 0.85rem;
		font-weight: 600;
		margin-bottom: 0.4rem;
		color: var(--ui-text-secondary);
	}

	.field-input {
		width: 100%;
		box-sizing: border-box;
		border-radius: 10px;
		border: 1px solid var(--ui-border-strong);
		padding: 0.65rem 0.85rem;
		font-size: 0.92rem;
		outline: none;
		transition: border-color 0.15s, box-shadow 0.15s;
	}

	.field-input:focus {
		border-color: var(--ui-accent);
		box-shadow: 0 0 0 3px var(--ui-accent-focus);
	}

	.theme-title {
		margin: 1.2rem 0 0.5rem;
		font-weight: 600;
		font-size: 0.85rem;
		color: var(--ui-text-secondary);
	}

	.theme-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.65rem;
	}

	.theme-btn {
		border: 2px solid var(--ui-border);
		border-radius: 14px;
		padding: 0;
		background: var(--ui-surface);
		cursor: pointer;
		text-align: center;
		overflow: hidden;
		transition: border-color 0.15s, box-shadow 0.15s;
	}

	.theme-btn.active {
		border-color: var(--ui-accent);
		box-shadow: 0 0 0 2px var(--ui-accent-focus);
	}

	.theme-btn:hover:not(.active) {
		border-color: var(--ui-border-strong);
	}

	.preview {
		display: block;
		height: 60px;
		background-image:
			repeating-linear-gradient(0deg, var(--grid) 0 1px, transparent 1px 16px),
			repeating-linear-gradient(90deg, var(--grid) 0 1px, transparent 1px 16px);
	}

	.theme-name {
		display: block;
		padding: 0.4rem 0;
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--ui-text-muted);
	}

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.6rem;
		margin-top: 1.4rem;
	}

	.modal-actions button {
		border-radius: 10px;
		border: none;
		padding: 0.6rem 1.15rem;
		font-size: 0.9rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.12s;
	}

	.btn-ghost {
		background: var(--ui-surface-alt);
		color: var(--ui-text-muted);
	}

	.btn-ghost:hover {
		background: var(--ui-border);
	}

	.btn-solid {
		background: var(--ui-accent);
		color: #fff;
	}

	.btn-solid:hover {
		background: var(--ui-accent-hover);
	}
</style>
