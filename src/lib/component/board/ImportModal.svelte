<script lang="ts">
	import { BOARD_THEMES, type BoardData } from '$lib/board-types';

	interface Props {
		show: boolean;
		boards: BoardData[];
		onImport: (board: BoardData) => void;
		onClose: () => void;
	}

	let { show, boards, onImport, onClose }: Props = $props();

	const themeBg = (id: BoardData['themeId']) =>
		BOARD_THEMES.find((t) => t.id === id)?.background ?? '#fff';

	const themeGrid = (id: BoardData['themeId']) =>
		BOARD_THEMES.find((t) => t.id === id)?.gridColor ?? '#e2e8f0';

	const themeLabel = (id: BoardData['themeId']) =>
		BOARD_THEMES.find((t) => t.id === id)?.label ?? id;

	const fmt = (iso: string) =>
		new Intl.DateTimeFormat('en-US', {
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit'
		}).format(new Date(iso));
</script>

{#if show}
	<div class="modal-backdrop">
		<!-- svelte-ignore a11y_interactive_supports_focus -->
		<div
			class="backdrop-close"
			role="button"
			aria-label="Close import modal"
			onclick={onClose}
			onkeydown={(e) => e.key === 'Escape' && onClose()}
		></div>

		<div class="import-modal" role="dialog" aria-modal="true" tabindex="-1">
			<!-- Header -->
			<div class="modal-header">
				<div class="modal-title-wrap">
					<!-- prettier-ignore -->
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
				<h2>Import Board</h2>
			</div>
			<p class="modal-desc">Copy the selected board's content into the current board.</p>
			</div>

			<!-- Board list -->
			<div class="import-list">
				{#if boards.length === 0}
					<div class="empty-wrap">
						<!-- prettier-ignore -->
						<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 12h6M12 9v6"/></svg>
						<p>No boards available to import.</p>
					</div>
				{:else}
					{#each boards as item (item.id)}
						<button type="button" class="import-item" onclick={() => onImport(item)}>
							<!-- Thumbnail / fallback -->
							<div
								class="item-thumb"
								style={`background:${themeBg(item.themeId)};--grid:${themeGrid(item.themeId)};`}
							>
								{#if item.thumbnail}
									<img src={item.thumbnail} alt="" class="thumb-img" />
								{:else}
									<div class="thumb-grid"></div>
								{/if}
								<span class="item-badge">{themeLabel(item.themeId)}</span>
							</div>

							<!-- Info -->
							<div class="item-info">
								<strong class="item-title">{item.title}</strong>
								<span class="item-meta">
									<!-- prettier-ignore -->
									<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
									{fmt(item.updatedAt)}
								</span>
								<span class="item-stats">
									<!-- prettier-ignore -->
									<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
								{item.elements.length} element{item.elements.length !== 1 ? 's' : ''} &nbsp;·&nbsp;
								<!-- prettier-ignore -->
								<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/></svg>
								{item.strokes.length} stroke{item.strokes.length !== 1 ? 's' : ''}
								</span>
							</div>

							<!-- Hover arrow -->
							<span class="item-arrow">
								<!-- prettier-ignore -->
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
							</span>
						</button>
					{/each}
				{/if}
			</div>

			<!-- Footer -->
			<div class="modal-footer">
				<button type="button" class="btn-close" onclick={onClose}>Close</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		display: grid;
		place-items: center;
		background: rgba(15, 23, 42, 0.5);
		backdrop-filter: blur(3px);
		z-index: 100;
	}

	.backdrop-close {
		position: absolute;
		inset: 0;
		border: none;
		background: transparent;
		cursor: default;
	}

	/* ── Modal shell ── */
	.import-modal {
		position: relative;
		z-index: 1;
		width: min(580px, calc(100vw - 2rem));
		background: #fff;
		border-radius: 20px;
		box-shadow: 0 20px 60px rgba(15, 23, 42, 0.2);
		overflow: hidden;
		display: flex;
		flex-direction: column;
		max-height: calc(100vh - 4rem);
	}

	/* ── Header ── */
	.modal-header {
		padding: 1.25rem 1.4rem 0.9rem;
		border-bottom: 1px solid #f1f5f9;
	}

	.modal-title-wrap {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: #1e293b;
		margin-bottom: 0.3rem;
	}

	.modal-title-wrap h2 {
		margin: 0;
		font-size: 1.05rem;
		font-weight: 700;
	}

	.modal-desc {
		margin: 0;
		font-size: 0.8rem;
		color: #64748b;
	}

	/* ── List ── */
	.import-list {
		overflow-y: auto;
		flex: 1;
		padding: 0.75rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}

	.empty-wrap {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.6rem;
		padding: 2rem 0;
		color: #94a3b8;
		font-size: 0.875rem;
	}

	/* ── Each board row ── */
	.import-item {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		border: 1px solid #e2e8f0;
		background: #fafafa;
		padding: 0.55rem 0.65rem 0.55rem 0;
		border-radius: 12px;
		cursor: pointer;
		text-align: left;
		transition: border-color 0.14s, background 0.14s, box-shadow 0.14s, transform 0.1s;
	}

	.import-item:hover {
		border-color: #2563eb;
		background: #eff6ff;
		box-shadow: 0 2px 10px rgba(37, 99, 235, 0.1);
		transform: translateX(2px);
	}

	/* Thumbnail cell */
	.item-thumb {
		position: relative;
		width: 90px;
		height: 58px;
		flex-shrink: 0;
		border-radius: 10px;
		overflow: hidden;
		background: var(--bg, #f1f5f9);
		border: 1px solid rgba(0, 0, 0, 0.06);
		margin-left: 0.55rem;
	}

	.thumb-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.thumb-grid {
		width: 100%;
		height: 100%;
		background-image:
			repeating-linear-gradient(0deg, var(--grid) 0 1px, transparent 1px 14px),
			repeating-linear-gradient(90deg, var(--grid) 0 1px, transparent 1px 14px);
	}

	.item-badge {
		position: absolute;
		bottom: 3px;
		left: 4px;
		font-size: 0.6rem;
		font-weight: 600;
		color: #475569;
		background: rgba(255, 255, 255, 0.85);
		border-radius: 4px;
		padding: 1px 5px;
		line-height: 1.5;
	}

	/* Info column */
	.item-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.22rem;
		min-width: 0;
	}

	.item-title {
		font-size: 0.9rem;
		font-weight: 600;
		color: #1e293b;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.item-meta,
	.item-stats {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.74rem;
		color: #64748b;
	}

	.item-stats svg,
	.item-meta svg {
		flex-shrink: 0;
		opacity: 0.7;
	}

	/* Arrow hint */
	.item-arrow {
		color: #93c5fd;
		flex-shrink: 0;
		margin-right: 0.4rem;
		opacity: 0;
		transform: translateX(-4px);
		transition: opacity 0.15s, transform 0.15s;
	}

	.import-item:hover .item-arrow {
		opacity: 1;
		transform: translateX(0);
	}

	/* ── Footer ── */
	.modal-footer {
		padding: 0.8rem 1.4rem;
		border-top: 1px solid #f1f5f9;
		display: flex;
		justify-content: flex-end;
	}

	.btn-close {
		border: 1px solid #e2e8f0;
		background: #fff;
		border-radius: 10px;
		padding: 0.45rem 1rem;
		font-size: 0.85rem;
		cursor: pointer;
		transition: background 0.12s, border-color 0.12s;
	}

	.btn-close:hover {
		background: #f1f5f9;
		border-color: #cbd5e1;
	}
</style>
