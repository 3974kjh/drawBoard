<script lang="ts">
	import type { LibraryItem } from '$lib/library-storage';
	import { getLibraryItems, deleteLibraryItem } from '$lib/library-storage';

	interface Props {
		show: boolean;
		onInsert: (item: LibraryItem) => void;
		onClose: () => void;
	}

	let { show, onInsert, onClose }: Props = $props();

	let items = $state<LibraryItem[]>([]);

	$effect(() => {
		if (show) items = getLibraryItems();
	});

	function handleDelete(e: MouseEvent, id: string) {
		e.stopPropagation();
		deleteLibraryItem(id);
		items = getLibraryItems();
	}
</script>

{#if show}
	<div class="modal-backdrop">
		<!-- svelte-ignore a11y_interactive_supports_focus -->
		<div
			class="backdrop-close"
			role="button"
			aria-label="Close library"
			onclick={onClose}
			onkeydown={(e) => e.key === 'Escape' && onClose()}
		></div>

		<div class="library-modal" role="dialog" aria-modal="true" tabindex="-1">
			<div class="modal-header">
				<div class="modal-title-wrap">
					<!-- prettier-ignore -->
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/><path d="M8 7h8"/><path d="M8 11h8"/></svg>
					<h2>Library</h2>
				</div>
				<p class="modal-desc">Click an item to place it on the board at the position you click next.</p>
			</div>

			<div class="library-list scrollbar-theme">
				{#if items.length === 0}
					<div class="empty-wrap">
						<!-- prettier-ignore -->
						<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5" stroke-linecap="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/><path d="M8 7h8"/><path d="M8 11h8"/></svg>
						<p>No library items yet.</p>
						<p class="hint">Select items on the board, then right-click and choose "Save to Library".</p>
					</div>
				{:else}
					{#each items as item (item.id)}
						<div class="library-item">
							<button type="button" class="library-item-main" onclick={() => onInsert(item)}>
								<div class="item-thumb item-thumb-full" class:no-thumb={!item.thumbnail}>
									{#if item.thumbnail}
										<img src={item.thumbnail} alt="" />
									{:else}
										<!-- prettier-ignore -->
										<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/><path d="M8 7h8"/><path d="M8 11h8"/></svg>
									{/if}
									<span class="item-name-overlay">{item.name}</span>
								</div>
							</button>
							<button
								type="button"
								class="library-item-delete"
								title="Delete"
								onclick={(e) => handleDelete(e, item.id)}
							>
								<!-- prettier-ignore -->
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
							</button>
						</div>
					{/each}
				{/if}
			</div>

			<div class="modal-footer">
				<button type="button" class="btn-secondary" onclick={onClose}>Close</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(15, 23, 42, 0.4);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}
	.backdrop-close {
		position: absolute;
		inset: 0;
	}
	.library-modal {
		position: relative;
		background: #fff;
		border-radius: 12px;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
		width: 90%;
		max-width: 520px;
		height: min(85vh, 720px);
		max-height: 85vh;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}
	.modal-header {
		padding: 1rem 1.25rem;
		border-bottom: 1px solid #e2e8f0;
	}
	.modal-title-wrap {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.35rem;
	}
	.modal-title-wrap h2 {
		margin: 0;
		font-size: 1.1rem;
		font-weight: 600;
		color: #1e293b;
	}
	.modal-desc {
		margin: 0;
		font-size: 0.8rem;
		color: #64748b;
		line-height: 1.4;
	}
	.library-list {
		overflow-y: auto;
		overflow-x: hidden;
		padding: 0.75rem;
		flex: 1 1 0;
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.empty-wrap {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2rem;
		color: #64748b;
		font-size: 0.9rem;
		text-align: center;
	}
	.empty-wrap .hint {
		margin-top: 0.5rem;
		font-size: 0.78rem;
		color: #94a3b8;
	}
	.library-item {
		display: flex;
		align-items: stretch;
		gap: 0;
		flex-shrink: 0;
		border-radius: 10px;
		overflow: hidden;
		border: 1px solid #e2e8f0;
		background: #fff;
	}
	.library-item-main {
		flex: 1;
		display: block;
		padding: 0;
		text-align: left;
		background: #fff;
		border: none;
		cursor: pointer;
		min-width: 0;
		position: relative;
		transition: opacity 0.15s;
	}
	.library-item-main:hover {
		opacity: 0.95;
	}
	.item-thumb {
		width: 140px;
		height: 100px;
		flex-shrink: 0;
		background: #fff;
		border-radius: 8px;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid #e2e8f0;
	}
	.item-thumb-full {
		width: 100%;
		height: 0;
		padding-bottom: calc(148 / 280 * 100%);
		border-radius: 0;
		border: none;
		position: relative;
		overflow: hidden;
	}
	.item-thumb-full img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: contain;
		object-position: center;
		background: #fff;
	}
	.item-thumb img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		object-position: center;
	}
	.item-thumb.no-thumb {
		color: #94a3b8;
		background: #fff;
	}
	.item-thumb.no-thumb.item-thumb-full {
		background: #f8fafc;
	}
	.item-name-overlay {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		padding: 0.5rem 0.75rem 0.6rem;
		font-size: 0.85rem;
		font-weight: 500;
		color: #334155;
		background: linear-gradient(to top, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.7));
		backdrop-filter: blur(4px);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.library-item-delete {
		padding: 0.5rem 0.6rem;
		background: #fff;
		border: none;
		border-left: 1px solid #e2e8f0;
		cursor: pointer;
		color: #64748b;
		transition: color 0.15s, background 0.15s;
	}
	.library-item-delete:hover {
		background: #fef2f2;
		color: #dc2626;
	}
	.modal-footer {
		padding: 0.75rem 1.25rem;
		border-top: 1px solid #e2e8f0;
		display: flex;
		justify-content: flex-end;
	}
	.btn-secondary {
		padding: 0.45rem 1rem;
		font-size: 0.85rem;
		border: 1px solid #cbd5e1;
		background: #fff;
		border-radius: 8px;
		cursor: pointer;
		color: #475569;
	}
	.btn-secondary:hover {
		background: #f8fafc;
	}
</style>
