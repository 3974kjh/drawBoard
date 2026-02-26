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
		<button type="button" onclick={onGoBack}>보드 목록</button>
		<input bind:value={boardTitle} class="title-input" />
	</div>
	<div class="topbar-right">
		<button type="button" onclick={onSave}>저장</button>
		<button type="button" onclick={onDownloadPdf}>PDF</button>
		<button type="button" onclick={onDownloadImage}>이미지</button>
		<button type="button" onclick={onClear}>초기화</button>
		<button type="button" onclick={onShowImport}>불러오기</button>
		<button type="button" onclick={onUndo} disabled={!canUndo}>Undo</button>
		<button type="button" onclick={onRedo} disabled={!canRedo}>Redo</button>
	</div>
</header>

<style>
	.topbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.7rem;
		padding: 0.8rem 1rem;
		border-bottom: 1px solid #cbd5e1;
		background: #fff;
	}

	.topbar-left,
	.topbar-right {
		display: flex;
		gap: 0.45rem;
		align-items: center;
		flex-wrap: wrap;
	}

	.title-input {
		min-width: 220px;
		border: 1px solid #cbd5e1;
		border-radius: 10px;
		padding: 0.45rem 0.6rem;
	}

	.topbar button {
		border: 1px solid #cbd5e1;
		background: #fff;
		border-radius: 10px;
		padding: 0.45rem 0.7rem;
		cursor: pointer;
	}
</style>
