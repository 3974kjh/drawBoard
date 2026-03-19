<script lang="ts">
	import { BOARD_THEMES, type BoardData, type ThemeId } from '$lib/board-types';
	import { locale, t } from '$lib/i18n';

	interface Props {
		show: boolean;
		boards: BoardData[];
		onExport: (selectedBoards: BoardData[]) => void;
		onClose: () => void;
	}

	let { show, boards, onExport, onClose }: Props = $props();

	/** Set of board id that are selected (default all) */
	let selectedIds = $state<Set<string>>(new Set());

	$effect(() => {
		if (show && boards.length > 0) {
			selectedIds = new Set(boards.map((b) => b.id));
		}
	});

	const toggleOne = (id: string) => {
		selectedIds = new Set(selectedIds);
		if (selectedIds.has(id)) selectedIds.delete(id);
		else selectedIds.add(id);
	};

	const selectAll = () => {
		selectedIds = new Set(boards.map((b) => b.id));
	};

	const deselectAll = () => {
		selectedIds = new Set();
	};

	const handleExport = () => {
		const selected = boards.filter((b) => selectedIds.has(b.id));
		if (selected.length === 0) return;
		onExport(selected);
		onClose();
	};

	const themeBg = (themeId: ThemeId) =>
		BOARD_THEMES.find((t) => t.id === themeId)?.background ?? '#ffffff';
	const themeGrid = (themeId: ThemeId) =>
		BOARD_THEMES.find((t) => t.id === themeId)?.gridColor ?? '#e2e8f0';

	const handleKeydown = (e: KeyboardEvent) => {
		if (e.key === 'Escape') onClose();
	};
</script>

{#if show}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="modal-backdrop" onkeydown={handleKeydown} role="presentation">
		<span class="sr-only" aria-hidden="true">{$locale}</span>
		<button type="button" class="backdrop-close" aria-label={$t('create.closeModal')} onclick={onClose}></button>
		<div class="modal" role="dialog" aria-modal="true" aria-labelledby="export-boards-title" tabindex="-1">
			<div class="modal-header">
				<h2 id="export-boards-title">{$t('home.exportBoardsTitle')}</h2>
				<button type="button" class="close-x" onclick={onClose} aria-label={$t('create.close')}>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
				</button>
			</div>
			<p class="modal-desc">{$t('home.exportBoardsDesc')}</p>
			<div class="select-actions">
				<button type="button" class="btn-text" onclick={selectAll}>{$t('home.selectAll')}</button>
				<button type="button" class="btn-text" onclick={deselectAll}>{$t('home.deselectAll')}</button>
			</div>
			<div class="board-list scrollbar-theme">
				{#each boards as board (board.id)}
					<label class="board-row" class:selected={selectedIds.has(board.id)}>
						<input
							type="checkbox"
							checked={selectedIds.has(board.id)}
							onchange={() => toggleOne(board.id)}
						/>
						{#if board.thumbnail}
							<img class="thumb" src={board.thumbnail} alt="" />
						{:else}
							<div
								class="thumb-placeholder"
								style="background:{themeBg(board.themeId)};--grid:{themeGrid(board.themeId)};"
							></div>
						{/if}
						<span class="board-title">{board.title}</span>
					</label>
				{/each}
			</div>
			<div class="modal-actions">
				<button type="button" class="btn-ghost" onclick={onClose}>{$t('home.cancel')}</button>
				<button
					type="button"
					class="btn-solid"
					onclick={handleExport}
					disabled={selectedIds.size === 0}
				>
					{$t('home.exportSelected')}
				</button>
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
		width: min(480px, 100%);
		max-height: 85vh;
		display: flex;
		flex-direction: column;
		border-radius: 20px;
		padding: 1.25rem;
		box-shadow: 0 20px 60px var(--ui-shadow-strong);
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.modal-header h2 {
		margin: 0;
		font-size: 1.15rem;
		font-weight: 600;
		color: var(--ui-text-secondary);
	}

	.close-x {
		flex-shrink: 0;
		padding: 0.25rem;
		border: none;
		background: transparent;
		color: var(--ui-text-muted);
		cursor: pointer;
		border-radius: 8px;
	}

	.close-x:hover {
		background: var(--ui-surface-alt);
		color: var(--ui-text-secondary);
	}

	.modal-desc {
		margin: 0 0 0.75rem;
		font-size: 0.9rem;
		color: var(--ui-text-muted);
	}

	.select-actions {
		display: flex;
		gap: 0.75rem;
		margin-bottom: 0.5rem;
	}

	.btn-text {
		padding: 0.25rem 0;
		font-size: 0.85rem;
		color: var(--ui-accent);
		background: none;
		border: none;
		cursor: pointer;
	}

	.btn-text:hover {
		text-decoration: underline;
	}

	.board-list {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin-bottom: 1rem;
	}

	.board-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem 0.6rem;
		border-radius: 12px;
		border: 1px solid var(--ui-border);
		background: var(--ui-surface-alt);
		cursor: pointer;
		transition: background 0.15s, border-color 0.15s;
	}

	.board-row:hover,
	.board-row.selected {
		background: var(--ui-accent-muted);
		border-color: var(--ui-accent-soft);
	}

	.board-row input[type='checkbox'] {
		width: 18px;
		height: 18px;
		flex-shrink: 0;
		accent-color: var(--ui-accent);
	}

	.thumb {
		width: 56px;
		height: 32px;
		object-fit: cover;
		border-radius: 6px;
		flex-shrink: 0;
	}

	.thumb-placeholder {
		width: 56px;
		height: 32px;
		border-radius: 6px;
		flex-shrink: 0;
		background-image:
			repeating-linear-gradient(0deg, var(--grid) 0 1px, transparent 1px 8px),
			repeating-linear-gradient(90deg, var(--grid) 0 1px, transparent 1px 8px);
	}

	.board-title {
		flex: 1;
		min-width: 0;
		font-size: 0.9rem;
		font-weight: 500;
		color: var(--ui-text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	.btn-ghost {
		padding: 0.5rem 1rem;
		font-size: 0.9rem;
		color: var(--ui-text-muted);
		background: var(--ui-surface-alt);
		border: 1px solid var(--ui-border);
		border-radius: 10px;
		cursor: pointer;
	}

	.btn-ghost:hover {
		background: var(--ui-border);
		color: var(--ui-text-secondary);
	}

	.btn-solid {
		padding: 0.5rem 1rem;
		font-size: 0.9rem;
		font-weight: 500;
		color: white;
		background: var(--ui-accent);
		border: none;
		border-radius: 10px;
		cursor: pointer;
	}

	.btn-solid:hover:not(:disabled) {
		background: var(--ui-accent-hover);
	}

	.btn-solid:disabled {
		opacity: 0.5;
		cursor: not-allowed;
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

	.scrollbar-theme {
		scrollbar-width: thin;
		scrollbar-color: var(--ui-scrollbar) transparent;
	}

	.scrollbar-theme::-webkit-scrollbar {
		width: 8px;
		height: 8px;
	}

	.scrollbar-theme::-webkit-scrollbar-track {
		background: transparent;
	}

	.scrollbar-theme::-webkit-scrollbar-thumb {
		background: var(--ui-scrollbar);
		border-radius: 4px;
	}

	.scrollbar-theme::-webkit-scrollbar-thumb:hover {
		background: var(--ui-scrollbar-hover);
	}
</style>
