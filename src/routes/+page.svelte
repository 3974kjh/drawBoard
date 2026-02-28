<script lang="ts">
	import { goto } from '$app/navigation';
	import { type BoardData, type ThemeId } from '$lib/board-types';
	import { createBoard, deleteBoard, getBoards } from '$lib/board-storage';

	import BoardCard from '$lib/component/home/BoardCard.svelte';
	import CreateBoardModal from '$lib/component/home/CreateBoardModal.svelte';

	let boards = $state<BoardData[]>([]);
	let showCreateModal = $state(false);
	let newBoardTitle = $state('');
	let selectedThemeId = $state<ThemeId>('whiteboard');
	let showDeleteConfirmModal = $state(false);
	let pendingDeleteId = $state<string | null>(null);

	const refreshBoards = async () => {
		boards = await getBoards();
	};

	const openCreateModal = () => {
		newBoardTitle = `New Board ${boards.length + 1}`;
		selectedThemeId = 'whiteboard';
		showCreateModal = true;
	};

	const closeCreateModal = () => {
		showCreateModal = false;
	};

	const handleCreateBoard = async () => {
		const nextTitle = newBoardTitle.trim() || `New Board ${boards.length + 1}`;
		const board = await createBoard(nextTitle, selectedThemeId);
		showCreateModal = false;
		goto(`/board/${board.id}`);
	};

	const openDeleteConfirmModal = (boardId: string) => {
		pendingDeleteId = boardId;
		showDeleteConfirmModal = true;
	};

	const closeDeleteConfirmModal = () => {
		showDeleteConfirmModal = false;
		pendingDeleteId = null;
	};

	const handleConfirmDelete = async () => {
		if (!pendingDeleteId) return;
		await deleteBoard(pendingDeleteId);
		await refreshBoards();
		closeDeleteConfirmModal();
	};

	const openBoard = (boardId: string) => {
		goto(`/board/${boardId}`);
	};

	$effect(() => {
		refreshBoards();
	});
</script>

<main class="page">
	<!-- ── Header (logo + subtitle only, no action button) ── -->
	<header class="header">
		<div class="logo">
			<!-- D logo mark – using static/favicon.svg -->
			<img src="/favicon.svg" alt="DrawDashBoard logo" width="44" height="44" aria-hidden="true" />
			<div class="logo-text">
				<h1 class="brand-title">DrawDashBoard</h1>
				<p class="subtitle">Sketch ideas &middot; organize visually</p>
			</div>
		</div>
	</header>

	<!-- ── Board grid (always shown, first card = add new) ── -->
	<section class="boards-section scrollbar-theme">
		{#if boards.length > 0}
			<p class="board-count">{boards.length} board{boards.length !== 1 ? 's' : ''}</p>
		{/if}

		<div class="boards-grid">
			<!-- "New Board" card – always first -->
			<button type="button" class="add-card" onclick={openCreateModal}>
				<div class="add-icon">
					<!-- prettier-ignore -->
					<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
				</div>
				<span class="add-label">New Board</span>
			</button>

			{#each boards as board (board.id)}
				<BoardCard {board} onOpen={openBoard} onDelete={openDeleteConfirmModal} />
			{/each}
		</div>
	</section>
</main>

<CreateBoardModal
	show={showCreateModal}
	bind:boardTitle={newBoardTitle}
	bind:selectedThemeId
	onCreate={handleCreateBoard}
	onClose={closeCreateModal}
/>

{#if showDeleteConfirmModal}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="modal-overlay"
		role="dialog"
		aria-modal="true"
		aria-labelledby="delete-modal-title"
		onkeydown={(e) => e.key === 'Escape' && closeDeleteConfirmModal()}
		tabindex="-1"
	>
		<div class="modal-dialog">
			<h2 id="delete-modal-title" class="modal-title">Delete this board?</h2>
			<p class="modal-message">This action cannot be undone.</p>
			<div class="modal-actions">
				<button type="button" class="modal-btn secondary" onclick={closeDeleteConfirmModal}>
					Cancel
				</button>
				<button type="button" class="modal-btn danger" onclick={handleConfirmDelete}>
					Delete
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	:global(body) {
		margin: 0;
		font-family: 'Pretendard', 'Noto Sans KR', system-ui, -apple-system, sans-serif;
		background: #f1f5f9;
		color: #0f172a;
	}

	.page {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}

	/* ── Header ── */
	.header {
		padding: 1.1rem 2rem;
		background: #fff;
		border-bottom: 1px solid #e2e8f0;
		box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
		position: sticky;
		top: 0;
		z-index: 5;
	}

	.logo {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.logo-text {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.logo-text h1,
	.brand-title {
		margin: 0;
		line-height: 1;
	}

	/* Handwriting / brush style for the brand name */
	.brand-title {
		font-family: 'Caveat', 'Segoe Script', 'Comic Sans MS', cursive;
		font-size: 1.75rem;
		font-weight: 700;
		letter-spacing: 0.01em;
		/* gradient text */
		background: linear-gradient(135deg, #1d4ed8 0%, #7c3aed 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		/* slight tilt for that sketchy feel */
		display: inline-block;
		transform: rotate(-1deg);
		transform-origin: left center;
	}

	/* Subtitle – clean, refined italic */
	.subtitle {
		margin: 0;
		font-family: 'DM Sans', 'Inter', system-ui, sans-serif;
		font-size: 0.78rem;
		font-weight: 400;
		font-style: italic;
		color: #94a3b8;
		line-height: 1;
		letter-spacing: 0.04em;
		text-transform: lowercase;
	}

	/* ── Boards section ── */
	.boards-section {
		flex: 1;
		padding: 1.5rem 2rem 2rem;
		display: flex;
		flex-direction: column;
		overflow-y: auto;
	}

	.board-count {
		margin: 0 0 0.85rem;
		font-size: 0.83rem;
		color: #64748b;
		font-weight: 500;
	}

	/* ── Boards grid ── */
	.boards-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
		gap: 1rem;
		align-content: start;
	}

	/* ── Add-new card ── */
	.add-card {
		background: #fff;
		border: 2px dashed #cbd5e1;
		border-radius: 16px;
		cursor: pointer;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
		padding: 2rem 1rem;
		/* Match board card height roughly (thumbnail 16/9 of ~260px ≈ 147px + body ≈ 90px) */
		min-height: 200px;
		transition: border-color 0.15s, background 0.15s, transform 0.12s, box-shadow 0.18s;
		color: #94a3b8;
	}

	.add-card:hover {
		border-color: #2563eb;
		background: #eff6ff;
		color: #2563eb;
		transform: translateY(-3px);
		box-shadow: 0 6px 20px rgba(37, 99, 235, 0.12);
	}

	.add-icon {
		width: 56px;
		height: 56px;
		border-radius: 50%;
		background: currentColor;
		display: grid;
		place-items: center;
		opacity: 0.12;
		transition: opacity 0.15s;
	}

	.add-card:hover .add-icon {
		opacity: 0.18;
	}

	/* Use a wrapper trick to show icon on top of the tinted circle */
	.add-card {
		position: relative;
	}

	.add-icon {
		position: relative;
	}

	.add-icon svg {
		position: absolute;
		inset: 0;
		margin: auto;
		opacity: 1;
		/* restore full opacity for the SVG, the circle stays faded */
		filter: none;
	}

	/* Make svg visible against the faded circle */
	.add-icon {
		background: none;
		border: 2px solid currentColor;
		opacity: 1;
	}

	.add-label {
		font-size: 0.9rem;
		font-weight: 600;
		letter-spacing: -0.01em;
	}

	/* ── Delete confirm modal ── */
	.modal-overlay {
		position: fixed;
		inset: 0;
		z-index: 9999;
		background: rgba(15, 23, 42, 0.55);
		backdrop-filter: blur(6px);
		display: grid;
		place-items: center;
	}

	.modal-dialog {
		background: #fff;
		border-radius: 20px;
		padding: 2rem 2.2rem;
		width: min(380px, 92vw);
		box-shadow: 0 25px 60px rgba(0, 0, 0, 0.22);
	}

	.modal-title {
		margin: 0 0 0.5rem;
		font-size: 1.1rem;
		font-weight: 700;
		color: #1e293b;
	}

	.modal-message {
		margin: 0 0 1.5rem;
		font-size: 0.88rem;
		color: #64748b;
		line-height: 1.5;
	}

	.modal-actions {
		display: flex;
		gap: 0.6rem;
		justify-content: flex-end;
	}

	.modal-btn {
		padding: 0.6rem 1rem;
		border-radius: 10px;
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
		border: none;
		transition: filter 0.15s;
	}

	.modal-btn.secondary {
		background: #f1f5f9;
		color: #475569;
	}

	.modal-btn.secondary:hover {
		filter: brightness(0.96);
	}

	.modal-btn.danger {
		background: #dc2626;
		color: #fff;
	}

	.modal-btn.danger:hover {
		filter: brightness(1.08);
	}
</style>
