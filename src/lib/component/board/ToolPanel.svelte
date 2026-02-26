<script lang="ts">
	import { TOOL_ITEMS, type DrawingTool } from '$lib/board-types';

	interface Props {
		activeTool: DrawingTool;
	}

	let { activeTool = $bindable('pen') }: Props = $props();
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
		/* SVG children fill the cell */
		line-height: 0;
	}

	.tool-btn .icon :global(svg) {
		display: block;
	}

	.tool-btn.active {
		border-color: #2563eb;
		box-shadow: 0 0 0 1px #2563eb inset;
	}
</style>
