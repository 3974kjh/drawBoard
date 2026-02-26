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

	const refreshBoards = () => {
		boards = getBoards();
	};

	const openCreateModal = () => {
		newBoardTitle = `새 보드 ${boards.length + 1}`;
		selectedThemeId = 'whiteboard';
		showCreateModal = true;
	};

	const closeCreateModal = () => {
		showCreateModal = false;
	};

	const handleCreateBoard = () => {
		const nextTitle = newBoardTitle.trim() || `새 보드 ${boards.length + 1}`;
		const board = createBoard(nextTitle, selectedThemeId);
		showCreateModal = false;
		goto(`/board/${board.id}`);
	};

	const handleDeleteBoard = (boardId: string) => {
		if (!confirm('이 보드를 삭제할까요?')) return;
		deleteBoard(boardId);
		refreshBoards();
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
			<!-- D logo mark -->
			<svg width="40" height="40" viewBox="0 0 64 64" aria-hidden="true">
				<defs>
					<linearGradient id="hbg" x1="0%" y1="0%" x2="100%" y2="100%">
						<stop offset="0%" stop-color="#1d4ed8"/>
						<stop offset="100%" stop-color="#7c3aed"/>
					</linearGradient>
				</defs>
				<rect width="64" height="64" rx="14" fill="url(#hbg)"/>
				<path d="M11 52 Q18 46 25 49 Q32 52 39 46 Q46 40 53 43"
					stroke="#ffffff" stroke-opacity="0.25" stroke-width="2.2"
					stroke-linecap="round" fill="none"/>
				<text x="32" y="44" text-anchor="middle"
					font-family="Georgia,serif" font-size="38" font-weight="700"
					letter-spacing="-1" fill="#ffffff">D</text>
				<circle cx="47" cy="18" r="3.5" fill="#fbbf24"/>
				<line x1="47" y1="22" x2="53" y2="28" stroke="#fbbf24" stroke-width="2" stroke-linecap="round"/>
			</svg>
			<div class="logo-text">
				<h1 class="brand-title">DrawDashBoard</h1>
				<p class="subtitle">Sketch ideas &middot; organize visually</p>
			</div>
		</div>
	</header>

	<!-- ── Board grid (always shown, first card = add new) ── -->
	<section class="boards-section">
		{#if boards.length > 0}
			<p class="board-count">{boards.length}개의 보드</p>
		{/if}

		<div class="boards-grid">
			<!-- "새 보드 만들기" card – always first -->
			<button type="button" class="add-card" onclick={openCreateModal}>
				<div class="add-icon">
					<!-- prettier-ignore -->
					<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
				</div>
				<span class="add-label">새 보드 만들기</span>
			</button>

			{#each boards as board (board.id)}
				<BoardCard {board} onOpen={openBoard} onDelete={handleDeleteBoard} />
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
</style>
