<script lang="ts">
	import { TOOL_ITEMS, type DrawingTool } from '$lib/board-types';

	interface Props {
		activeTool: DrawingTool;
		keepToolActive: boolean;
	}

	let { activeTool = $bindable('pen'), keepToolActive = $bindable(false) }: Props = $props();
</script>

<aside class="tool-panel">
	{#each TOOL_ITEMS as item}
		<button
			type="button"
			class={`tool-btn ${activeTool === item.tool ? 'active' : ''}`}
			onclick={() => (activeTool = item.tool)}
			title={item.label}
		>
			<span class="icon">{@html item.icon}</span>
			<span>{item.label}</span>
		</button>
	{/each}

	<div class="tool-divider"></div>

	<button
		type="button"
		class={`tool-btn lock-btn ${keepToolActive ? 'active' : ''}`}
		onclick={() => (keepToolActive = !keepToolActive)}
		title={keepToolActive
			? '도구 고정 중 — 도형 추가 후 도구가 유지됩니다 (클릭하여 해제)'
			: '도구 고정 해제 — 도형 추가 후 선택 도구로 전환됩니다 (클릭하여 고정)'}
	>
		<span class="icon">
			{#if keepToolActive}
				<!-- prettier-ignore -->
				<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
			{:else}
				<!-- prettier-ignore -->
				<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
			{/if}
		</span>
		<span>고정</span>
	</button>
</aside>

<style>
	.tool-panel {
		background: #ffffffd9;
		backdrop-filter: blur(8px);
		border: 1px solid #cbd5e1;
		border-radius: 16px;
		padding: 0.55rem;
		display: grid;
		align-content: start;
		gap: 0.45rem;
	}

	.tool-btn {
		display: grid;
		justify-items: center;
		gap: 0.25rem;
		border: 1px solid #cbd5e1;
		background: #fff;
		border-radius: 12px;
		padding: 0.45rem 0.3rem;
		font-size: 0.74rem;
		cursor: pointer;
		transition: background 0.12s, border-color 0.12s;
	}

	.tool-btn .icon {
		width: 28px;
		height: 28px;
		border-radius: 8px;
		background: #eff6ff;
		color: #1d4ed8;
		display: grid;
		place-items: center;
		font-size: 0.72rem;
		font-weight: 700;
		line-height: 0;
	}

	.tool-btn .icon :global(svg) {
		display: block;
	}

	.tool-btn.active {
		border-color: #2563eb;
		box-shadow: 0 0 0 1px #2563eb inset;
	}

	/* ── Divider between tools and lock button ── */
	.tool-divider {
		height: 1px;
		background: #e2e8f0;
		margin: 0.1rem 0.2rem;
	}

	/* ── Lock button specific styling ── */
	.lock-btn .icon {
		background: #f1f5f9;
		color: #64748b;
	}

	.lock-btn.active .icon {
		background: #dbeafe;
		color: #1d4ed8;
	}
</style>
