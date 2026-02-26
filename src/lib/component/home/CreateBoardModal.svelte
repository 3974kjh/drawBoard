<script lang="ts">
	import { BOARD_THEMES, type ThemeId } from '$lib/board-types';

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
		<button class="backdrop-close" type="button" aria-label="모달 닫기" onclick={onClose}></button>
		<div class="modal" role="dialog" aria-modal="true" tabindex="-1">
			<div class="modal-header">
				<h2>새 보드 만들기</h2>
				<button type="button" class="close-x" onclick={onClose} aria-label="닫기">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
				</button>
			</div>

			<label class="field-label" for="board-title">보드 이름</label>
			<input id="board-title" class="field-input" bind:value={boardTitle} placeholder="보드 이름을 입력하세요" />

			<p class="theme-title">테마 선택</p>
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
				<button type="button" class="btn-ghost" onclick={onClose}>취소</button>
				<button type="button" class="btn-solid" onclick={onCreate}>생성</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(15, 23, 42, 0.4);
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
		background: #fff;
		width: min(560px, 100%);
		border-radius: 20px;
		padding: 1.5rem;
		box-shadow: 0 20px 60px rgba(15, 23, 42, 0.18);
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
		background: #f1f5f9;
		border-radius: 8px;
		cursor: pointer;
		color: #64748b;
		transition: background 0.12s;
	}

	.close-x:hover {
		background: #e2e8f0;
		color: #334155;
	}

	.field-label {
		display: block;
		font-size: 0.85rem;
		font-weight: 600;
		margin-bottom: 0.4rem;
		color: #334155;
	}

	.field-input {
		width: 100%;
		box-sizing: border-box;
		border-radius: 10px;
		border: 1px solid #cbd5e1;
		padding: 0.65rem 0.85rem;
		font-size: 0.92rem;
		outline: none;
		transition: border-color 0.15s, box-shadow 0.15s;
	}

	.field-input:focus {
		border-color: #2563eb;
		box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
	}

	.theme-title {
		margin: 1.2rem 0 0.5rem;
		font-weight: 600;
		font-size: 0.85rem;
		color: #334155;
	}

	.theme-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.65rem;
	}

	.theme-btn {
		border: 2px solid #e2e8f0;
		border-radius: 14px;
		padding: 0;
		background: #fff;
		cursor: pointer;
		text-align: center;
		overflow: hidden;
		transition: border-color 0.15s, box-shadow 0.15s;
	}

	.theme-btn.active {
		border-color: #2563eb;
		box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.18);
	}

	.theme-btn:hover:not(.active) {
		border-color: #94a3b8;
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
		color: #475569;
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
		background: #f1f5f9;
		color: #475569;
	}

	.btn-ghost:hover {
		background: #e2e8f0;
	}

	.btn-solid {
		background: #2563eb;
		color: #fff;
	}

	.btn-solid:hover {
		background: #1d4ed8;
	}
</style>
