<script lang="ts">
	import { BOARD_THEMES, type BoardData, type ThemeId } from '$lib/board-types';

	interface Props {
		board: BoardData;
		onOpen: (id: string) => void;
		onDelete: (id: string) => void;
	}

	let { board, onOpen, onDelete }: Props = $props();

	const formatDate = (isoDate: string) =>
		new Intl.DateTimeFormat('ko-KR', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit'
		}).format(new Date(isoDate));

	const themeLabel = (themeId: ThemeId) =>
		BOARD_THEMES.find((theme) => theme.id === themeId)?.label ?? themeId;

	const themePreviewBg = (themeId: ThemeId) =>
		BOARD_THEMES.find((theme) => theme.id === themeId)?.background ?? '#ffffff';

	const themeGridColor = (themeId: ThemeId) =>
		BOARD_THEMES.find((theme) => theme.id === themeId)?.gridColor ?? '#e2e8f0';
</script>

<!-- Click anywhere on card to open -->
<div
	class="board-card"
	onclick={() => onOpen(board.id)}
	onkeydown={(e) => e.key === 'Enter' && onOpen(board.id)}
	role="button"
	tabindex="0"
>
	<!-- Thumbnail or grid-pattern fallback -->
	<div class="thumb-area">
		{#if board.thumbnail}
			<img class="thumb-img" src={board.thumbnail} alt="{board.title} 미리보기" />
		{:else}
			<div
				class="thumb-placeholder"
				style={`background:${themePreviewBg(board.themeId)};--grid:${themeGridColor(board.themeId)};`}
			></div>
		{/if}

		<!-- Theme badge, bottom-left -->
		<span class="theme-badge">{themeLabel(board.themeId)}</span>

		<!-- Delete icon, top-right (visible on hover via CSS) -->
		<button
			type="button"
			class="delete-btn"
			title="보드 삭제"
			onclick={(e) => {
				e.stopPropagation();
				onDelete(board.id);
			}}
			aria-label="보드 삭제"
		>
			<!-- prettier-ignore -->
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
		</button>
	</div>

	<!-- Info row -->
	<div class="card-body">
		<h2 title={board.title}>{board.title}</h2>
		<p class="meta">{formatDate(board.updatedAt)}</p>
		<div class="stats">
			<span class="stat">
				<!-- prettier-ignore -->
				<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
				{board.elements.length}
			</span>
			<span class="stat">
				<!-- prettier-ignore -->
				<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/></svg>
				{board.strokes.length}
			</span>
		</div>
	</div>
</div>

<style>
	.board-card {
		background: #fff;
		border-radius: 16px;
		border: 1px solid #e2e8f0;
		overflow: hidden;
		cursor: pointer;
		transition: box-shadow 0.18s, transform 0.12s;
		display: flex;
		flex-direction: column;
		text-align: left;
		outline-offset: 3px;
	}

	.board-card:focus-visible {
		outline: 2px solid #2563eb;
	}

	.board-card:hover {
		box-shadow: 0 6px 20px rgba(15, 23, 42, 0.12);
		transform: translateY(-3px);
	}

	/* ── Thumbnail area ── */
	.thumb-area {
		position: relative;
		width: 100%;
		aspect-ratio: 16 / 9;
		overflow: hidden;
		background: #f1f5f9;
		border-bottom: 1px solid #e2e8f0;
		flex-shrink: 0;
	}

	.thumb-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
		transition: transform 0.25s ease;
	}

	.board-card:hover .thumb-img {
		transform: scale(1.03);
	}

	.thumb-placeholder {
		width: 100%;
		height: 100%;
		background-image:
			repeating-linear-gradient(0deg, var(--grid) 0 1px, transparent 1px 20px),
			repeating-linear-gradient(90deg, var(--grid) 0 1px, transparent 1px 20px);
	}

	/* Theme badge – bottom-left of thumbnail */
	.theme-badge {
		position: absolute;
		bottom: 8px;
		left: 8px;
		padding: 2px 8px;
		border-radius: 6px;
		background: rgba(255, 255, 255, 0.88);
		backdrop-filter: blur(4px);
		font-size: 0.68rem;
		font-weight: 600;
		color: #475569;
		border: 1px solid rgba(0, 0, 0, 0.07);
		pointer-events: none;
	}

	/* Delete button – top-right, hidden until card hover */
	.delete-btn {
		position: absolute;
		top: 8px;
		right: 8px;
		width: 30px;
		height: 30px;
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.92);
		backdrop-filter: blur(4px);
		border: 1px solid rgba(0, 0, 0, 0.1);
		display: grid;
		place-items: center;
		cursor: pointer;
		opacity: 0;
		transform: scale(0.8);
		transition: opacity 0.15s, transform 0.15s, background 0.12s, color 0.12s;
		color: #64748b;
		z-index: 2;
	}

	.board-card:hover .delete-btn {
		opacity: 1;
		transform: scale(1);
	}

	.delete-btn:hover {
		background: #fef2f2 !important;
		color: #dc2626 !important;
		border-color: #fca5a5 !important;
	}

	/* ── Card body ── */
	.card-body {
		padding: 0.75rem 0.9rem 0.7rem;
	}

	.card-body h2 {
		margin: 0 0 0.18rem;
		font-size: 0.95rem;
		font-weight: 600;
		color: #1e293b;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.meta {
		margin: 0;
		font-size: 0.75rem;
		color: #94a3b8;
	}

	.stats {
		display: flex;
		gap: 0.7rem;
		margin-top: 0.4rem;
	}

	.stat {
		display: flex;
		align-items: center;
		gap: 0.28rem;
		font-size: 0.75rem;
		color: #64748b;
	}
</style>
