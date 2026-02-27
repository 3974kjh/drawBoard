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
		</button>
	{/each}

	<div class="tool-divider"></div>

	<button
		type="button"
		class={`tool-btn lock-btn ${keepToolActive ? 'active' : ''}`}
		onclick={() => (keepToolActive = !keepToolActive)}
		title={keepToolActive
			? 'Tool locked — stays active after placing a shape (click to unlock)'
			: 'Tool unlocked — switches to Select after placing a shape (click to lock)'}
	>
		<span class="icon">
			{#if keepToolActive}
				<!-- prettier-ignore -->
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
			{:else}
				<!-- prettier-ignore -->
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
			{/if}
		</span>
	</button>
</aside>

<style>
	/* Panel width is fixed — buttons fill it and are forced square via height = width */
	.tool-panel {
		width: 48px;
		background: #ffffffd9;
		backdrop-filter: blur(8px);
		border: 1px solid #cbd5e1;
		border-radius: 14px;
		padding: 0.3rem;
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 0.25rem;
	}

	/* width: 100% = fills the 48px panel; height = width makes it a true square */
	.tool-btn {
		width: 100%;
		aspect-ratio: 1 / 1;
		display: grid;
		place-items: center;
		border: 1px solid #cbd5e1;
		background: #fff;
		border-radius: 8px;
		padding: 0;
		cursor: pointer;
		transition: background 0.12s, border-color 0.12s, box-shadow 0.12s;
		color: #1d4ed8;
		line-height: 0;
		overflow: hidden;
	}

	/* Icon wrapper: fixed pixel size so emoji + SVG both render at the same size */
	.tool-btn .icon {
		width: 22px;
		height: 22px;
		display: grid;
		place-items: center;
		line-height: 0;
		font-size: 0.95rem; /* emoji size */
	}

	.tool-btn .icon :global(svg) {
		display: block;
		width: 18px;
		height: 18px;
		flex-shrink: 0;
	}

	.tool-btn:hover {
		background: #eff6ff;
		border-color: #93c5fd;
	}

	.tool-btn.active {
		background: #dbeafe;
		border-color: #2563eb;
		box-shadow: 0 0 0 1.5px #2563eb inset;
		color: #1d4ed8;
	}

	/* ── Divider between tools and lock button ── */
	.tool-divider {
		height: 1px;
		background: #e2e8f0;
		margin: 0.1rem 0.15rem;
		flex-shrink: 0;
	}

	/* ── Lock button specific styling ── */
	.lock-btn {
		color: #64748b;
	}

	.lock-btn.active {
		color: #1d4ed8;
	}
</style>
