<script lang="ts">
	interface Props {
		boardTitle: string;
		canUndo: boolean;
		canRedo: boolean;
		onGoBack: () => void;
		onSave: () => void;
		onDownloadPdf: () => void;
		onDownloadImage: () => void;
		onClear: () => void;
		onShowImport: () => void;
		onUndo: () => void;
		onRedo: () => void;
	}

	let {
		boardTitle = $bindable(''),
		canUndo,
		canRedo,
		onGoBack,
		onSave,
		onDownloadPdf,
		onDownloadImage,
		onClear,
		onShowImport,
		onUndo,
		onRedo
	}: Props = $props();
</script>

<header class="topbar">
	<div class="topbar-left">
		<button type="button" class="icon-btn" onclick={onGoBack} title="홈으로 돌아가기">
			<!-- prettier-ignore -->
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
		</button>
		<input bind:value={boardTitle} class="title-input" placeholder="보드 제목" />
	</div>

	<div class="topbar-right">
		<button type="button" class="icon-btn" onclick={onSave} title="보드 저장 (Ctrl+S)">
			<!-- prettier-ignore -->
			<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
		</button>
		<button type="button" class="icon-btn" onclick={onDownloadPdf} title="PDF로 내보내기">
			<!-- prettier-ignore -->
			<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="9" y2="17"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="15" y1="15" x2="15" y2="17"/></svg>
		</button>
		<button type="button" class="icon-btn" onclick={onDownloadImage} title="이미지로 내보내기 (PNG)">
			<!-- prettier-ignore -->
			<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
		</button>
		<button type="button" class="icon-btn" onclick={onShowImport} title="다른 보드 불러오기">
			<!-- prettier-ignore -->
			<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><polyline points="9 14 12 11 15 14"/></svg>
		</button>

		<div class="separator"></div>

		<button type="button" class="icon-btn danger" onclick={onClear} title="보드 전체 초기화">
			<!-- prettier-ignore -->
			<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg>
		</button>

		<div class="separator"></div>

		<button type="button" class="icon-btn" onclick={onUndo} disabled={!canUndo} title="실행 취소 (Ctrl+Z)">
			<!-- prettier-ignore -->
			<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>
		</button>
		<button type="button" class="icon-btn" onclick={onRedo} disabled={!canRedo} title="다시 실행 (Ctrl+Y)">
			<!-- prettier-ignore -->
			<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.49-3.5"/></svg>
		</button>
	</div>
</header>

<style>
	.topbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.7rem;
		padding: 0.6rem 1rem;
		border-bottom: 1px solid #cbd5e1;
		background: #fff;
		box-shadow: 0 1px 4px rgba(15, 23, 42, 0.06);
	}

	.topbar-left,
	.topbar-right {
		display: flex;
		gap: 0.35rem;
		align-items: center;
	}

	.title-input {
		min-width: 200px;
		border: 1px solid #e2e8f0;
		border-radius: 10px;
		padding: 0.42rem 0.65rem;
		font-size: 0.9rem;
		font-weight: 500;
		color: #1e293b;
		background: #f8fafc;
		outline: none;
		transition: border-color 0.15s, box-shadow 0.15s;
	}

	.title-input:focus {
		border-color: #93c5fd;
		box-shadow: 0 0 0 3px rgba(147, 197, 253, 0.3);
		background: #fff;
	}

	.icon-btn {
		width: 36px;
		height: 36px;
		padding: 0;
		display: grid;
		place-items: center;
		border: 1px solid #e2e8f0;
		background: #fff;
		border-radius: 10px;
		cursor: pointer;
		color: #475569;
		transition:
			background 0.15s,
			border-color 0.15s,
			color 0.15s,
			box-shadow 0.15s;
		flex-shrink: 0;
	}

	.icon-btn:hover:not(:disabled) {
		background: #f1f5f9;
		border-color: #94a3b8;
		color: #1e293b;
	}

	.icon-btn:disabled {
		opacity: 0.32;
		cursor: default;
	}

	.icon-btn.danger:hover:not(:disabled) {
		background: #fee2e2;
		border-color: #fca5a5;
		color: #dc2626;
	}

	.separator {
		width: 1px;
		height: 22px;
		background: #e2e8f0;
		margin: 0 0.1rem;
		flex-shrink: 0;
	}
</style>
