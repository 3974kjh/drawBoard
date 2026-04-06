<script lang="ts">
	import { goto } from '$app/navigation';
	import { type BoardData, type ThemeId } from '$lib/board-types';
	import { createBoard, deleteBoard, getBoards, upsertBoard } from '$lib/board-storage';
	import { get } from 'svelte/store';
	import { locale, t } from '$lib/i18n';
	import { boardToJsonBlob, downloadBlob, parseBoardJson } from '$lib/board-json';
	import toast from 'svelte-hot-french-toast';

	import BoardCard from '$lib/component/home/BoardCard.svelte';
	import CreateBoardModal from '$lib/component/home/CreateBoardModal.svelte';
	import ExportBoardsModal from '$lib/component/home/ExportBoardsModal.svelte';

	let boards = $state<BoardData[]>([]);
	let showCreateModal = $state(false);
	let newBoardTitle = $state('');
	let selectedThemeId = $state<ThemeId>('whiteboard');
	let showDeleteConfirmModal = $state(false);
	let pendingDeleteId = $state<string | null>(null);
	let showExportBoardsModal = $state(false);
	let importFilesInputRef = $state<HTMLInputElement | null>(null);
	let boardsGridRef = $state<HTMLDivElement | null>(null);
	let selectedBoardIndex = $state(-1);

	const handleBoardsGridKeydown = (e: KeyboardEvent) => {
		const totalItems = boards.length + 1;
		if (totalItems === 0) return;

		if (e.key === 'ArrowDown') {
			e.preventDefault();
			selectedBoardIndex = selectedBoardIndex < totalItems - 1 ? selectedBoardIndex + 1 : 0;
			focusCard(selectedBoardIndex);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			selectedBoardIndex = selectedBoardIndex > 0 ? selectedBoardIndex - 1 : totalItems - 1;
			focusCard(selectedBoardIndex);
		}
	};

	const focusCard = (index: number) => {
		if (!boardsGridRef) return;
		const cards = boardsGridRef.querySelectorAll('.boards-grid > *');
		const card = cards[index] as HTMLElement;
		if (card) {
			card.focus();
		}
	};

	const refreshBoards = async () => {
		const list = await getBoards();
		LOG('refreshBoards done', { count: list.length, ids: list.map((b) => b.id) });
		boards = list;
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

	const safeFilename = (title: string): string => {
		const base =
			(title || 'board')
				.replace(/[^\w\s가-힣\-]/g, '')
				.trim()
				.slice(0, 80) || 'board';
		return `${base}.json`;
	};

	const handleExportSelectedBoards = (selectedBoards: BoardData[]) => {
		showExportBoardsModal = false;
		selectedBoards.forEach((board, i) => {
			setTimeout(() => {
				const blob = boardToJsonBlob(board);
				downloadBlob(blob, safeFilename(board.title));
			}, i * 120);
		});
		if (selectedBoards.length > 0) {
			const tFn = get(t);
			toast.success(
				selectedBoards.length === 1
					? tFn('home.exportedOne')
					: tFn('home.exportedMany', { n: selectedBoards.length })
			);
		}
	};

	const createId = (): string => {
		if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
			return crypto.randomUUID();
		}
		return `board-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
	};

	const LOG = (msg: string, data?: unknown) => {
		console.log('[Home Import]', msg, data !== undefined ? data : '');
	};

	/** 메인 페이지 전용: 업로드한 각 파일을 신규 보드로 추가(기존 보드 덮어쓰지 않음) */
	const handleImportFiles = async (e: Event) => {
		const input = e.currentTarget as HTMLInputElement;
		const fileList = input.files;
		LOG('handleImportFiles called', {
			filesLength: fileList?.length ?? 0,
			fileNames: fileList ? Array.from(fileList).map((f) => f.name) : []
		});
		if (!fileList?.length) {
			LOG('early return: no files');
			return;
		}
		// input.value 초기화를 여기서 하면 change가 다시 발생해 files가 비는 환경이 있음 → 처리 끝난 뒤에만 비움
		const now = new Date().toISOString();
		const created: BoardData[] = [];
		for (const file of Array.from(fileList)) {
			const titleFromFile = file.name.replace(/\.json$/i, '').trim() || 'Imported';
			const newId = createId();
			LOG('processing file', { fileName: file.name, titleFromFile, newId });
			let boardData: BoardData;
			try {
				const text = await file.text();
				LOG('file.text() ok', { textLength: text?.length ?? 0, textPreview: text?.slice(0, 80) });
				const list = parseBoardJson(text);
				LOG('parseBoardJson result', { listLength: list.length, firstBoardId: list[0]?.id });
				if (list.length > 0) {
					const src = list[0];
					boardData = {
						id: newId,
						title: titleFromFile,
						themeId: src.themeId ?? 'whiteboard',
						createdAt: now,
						updatedAt: now,
						strokes: Array.isArray(src.strokes) ? [...src.strokes] : [],
						elements: Array.isArray(src.elements) ? [...src.elements] : [],
						thumbnail: src.thumbnail,
						width: src.width,
						height: src.height,
						gridEnabled: src.gridEnabled,
						gridSize: src.gridSize
					};
				} else {
					boardData = {
						id: newId,
						title: titleFromFile,
						themeId: 'whiteboard',
						createdAt: now,
						updatedAt: now,
						strokes: [],
						elements: []
					};
				}
			} catch (err) {
				LOG('file read/parse error', err);
				boardData = {
					id: newId,
					title: titleFromFile,
					themeId: 'whiteboard',
					createdAt: now,
					updatedAt: now,
					strokes: [],
					elements: []
				};
			}
			LOG('calling upsertBoard', { id: boardData.id, title: boardData.title });
			await upsertBoard(boardData);
			LOG('upsertBoard done', { id: boardData.id });
			created.push(boardData);
		}
		LOG('all files processed', {
			createdCount: created.length,
			createdIds: created.map((b) => b.id)
		});
		if (created.length > 0) {
			const afterBoards = await getBoards();
			LOG('getBoards after import', {
				count: afterBoards.length,
				ids: afterBoards.map((b) => b.id)
			});
			boards = afterBoards;
			const tFn = get(t);
			toast.success(
				created.length === 1
					? tFn('home.importedOne')
					: tFn('home.importedMany', { n: created.length })
			);
		} else {
			toast.error(get(t)('home.importNoBoards'));
		}
		input.value = '';
	};

	$effect(() => {
		LOG('$effect running, calling refreshBoards');
		refreshBoards();
	});
</script>

<main class="page">
	<!-- ── Header (logo + subtitle + export/import) ── -->
	<header class="header">
		<div class="logo">
			<img src="/favicon.svg" alt="DrawDashBoard logo" width="44" height="44" aria-hidden="true" />
			<div class="logo-text">
				<h1 class="brand-title">DrawDashBoard</h1>
				<p class="subtitle">{$t('home.subtitle')}</p>
			</div>
		</div>
		<div class="header-actions">
			<button
				type="button"
				class="action-btn"
				onclick={() => (showExportBoardsModal = true)}
				disabled={boards.length === 0}
				title={$t('home.exportBoards')}
			>
				<svg
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline
						points="7 10 12 15 17 10"
					/><line x1="12" y1="15" x2="12" y2="3" /></svg
				>
				<span>{$t('home.exportBoards')}</span>
			</button>
			<button
				type="button"
				class="action-btn"
				onclick={() => importFilesInputRef?.click()}
				title={$t('home.importFromFiles')}
			>
				<svg
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline
						points="17 8 12 3 7 8"
					/><line x1="12" y1="3" x2="12" y2="15" /></svg
				>
				<span>{$t('home.importFromFiles')}</span>
			</button>
		</div>
		<input
			type="file"
			accept=".json,application/json"
			multiple
			class="hidden-file-input"
			bind:this={importFilesInputRef}
			onchange={handleImportFiles}
			aria-hidden="true"
			tabindex="-1"
		/>
	</header>

	<!-- ── Board grid (always shown, first card = add new) ── -->
	<section class="boards-section scrollbar-theme">
		{#if boards.length > 0}
			<p class="board-count">
				{boards.length === 1
					? $t('home.boardCount', { n: 1 })
					: $t('home.boardCountPlural', { n: boards.length })}
			</p>
		{/if}

		<div
			class="boards-grid"
			bind:this={boardsGridRef}
			onkeydown={handleBoardsGridKeydown}
			tabindex="-1"
		>
			<!-- "New Board" card – always first -->
			<button type="button" class="add-card" onclick={openCreateModal}>
				<div class="add-icon">
					<!-- prettier-ignore -->
					<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
				</div>
				<span class="add-label">{$t('home.newBoard')}</span>
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

<ExportBoardsModal
	show={showExportBoardsModal}
	{boards}
	onExport={handleExportSelectedBoards}
	onClose={() => (showExportBoardsModal = false)}
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
			<h2 id="delete-modal-title" class="modal-title">{$t('home.deleteBoardTitle')}</h2>
			<p class="modal-message">{$t('home.deleteBoardMessage')}</p>
			<div class="modal-actions">
				<button type="button" class="modal-btn secondary" onclick={closeDeleteConfirmModal}>
					{$t('home.cancel')}
				</button>
				<button type="button" class="modal-btn danger" onclick={handleConfirmDelete}>
					{$t('home.delete')}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	:global(body) {
		margin: 0;
		font-family:
			'Pretendard',
			'Noto Sans KR',
			system-ui,
			-apple-system,
			sans-serif;
	}

	.page {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}

	/* ── Header ── */
	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1.1rem 2rem;
		background: var(--ui-surface);
		border-bottom: 1px solid var(--ui-border);
		box-shadow: 0 1px 3px var(--ui-shadow);
		position: sticky;
		top: 0;
		z-index: 5;
	}

	.logo {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	.action-btn {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.45rem 0.75rem;
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--ui-text-secondary);
		background: var(--ui-surface-alt);
		border: 1px solid var(--ui-border);
		border-radius: 10px;
		cursor: pointer;
		transition:
			background 0.15s,
			border-color 0.15s,
			color 0.15s;
	}

	.action-btn:hover:not(:disabled) {
		background: var(--ui-accent-muted);
		border-color: var(--ui-accent-soft);
		color: var(--ui-accent);
	}

	.action-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.hidden-file-input {
		position: absolute;
		width: 0;
		height: 0;
		opacity: 0;
		pointer-events: none;
		overflow: hidden;
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
		/* gradient text – 테마별 accent 반영 */
		background: linear-gradient(135deg, var(--ui-accent-hover) 0%, var(--ui-accent) 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
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
		color: var(--ui-text-subtle);
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
		color: var(--ui-text-muted);
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
		background: var(--ui-surface);
		border: 2px dashed var(--ui-border-strong);
		border-radius: 16px;
		cursor: pointer;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
		padding: 2rem 1rem;
		min-height: 200px;
		transition:
			border-color 0.15s,
			background 0.15s,
			transform 0.12s,
			box-shadow 0.18s;
		color: var(--ui-text-subtle);
	}

	.add-card:hover {
		border-color: var(--ui-accent);
		background: var(--ui-accent-muted);
		color: var(--ui-accent);
		transform: translateY(-3px);
		box-shadow: 0 6px 20px var(--ui-shadow);
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
		background: var(--ui-overlay);
		backdrop-filter: blur(6px);
		display: grid;
		place-items: center;
	}

	.modal-dialog {
		background: var(--ui-surface);
		border-radius: 20px;
		padding: 2rem 2.2rem;
		width: min(380px, 92vw);
		box-shadow: 0 25px 60px var(--ui-shadow-strong);
	}

	.modal-title {
		margin: 0 0 0.5rem;
		font-size: 1.1rem;
		font-weight: 700;
		color: var(--ui-text-secondary);
	}

	.modal-message {
		margin: 0 0 1.5rem;
		font-size: 0.88rem;
		color: var(--ui-text-muted);
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
		background: var(--ui-surface-alt);
		color: var(--ui-text-muted);
	}

	.modal-btn.secondary:hover {
		filter: brightness(0.96);
	}

	.modal-btn.danger {
		background: var(--ui-danger);
		color: #fff;
	}

	.modal-btn.danger:hover {
		filter: brightness(1.08);
	}
</style>
