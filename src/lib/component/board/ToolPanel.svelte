<script lang="ts">
	// 1. import
	import { TOOL_ITEMS } from '$lib/Enum';
	import type { DrawingTool } from '$lib/Type';
	import { selectTool } from './ToolPanelCore';
	import { locale, t } from '$lib/i18n';

	const toolLabelKey: Record<string, string> = {
		select: 'tool.select',
		pen: 'tool.pen',
		eraser: 'tool.eraser',
		'eraser-multi': 'tool.eraserMulti',
		rect: 'tool.rect',
		ellipse: 'tool.ellipse',
		triangle: 'tool.triangle',
		'line-h': 'tool.lineH',
		'line-v': 'tool.lineV',
		text: 'tool.text',
		image: 'tool.image'
	};
	const getToolTitle = (tFn: (key: string) => string, item: (typeof TOOL_ITEMS)[0], i: number) =>
		tFn(toolLabelKey[item.tool] ?? 'tool.select') + (i < 10 ? ` (Ctrl+${i})` : ' (Ctrl+Shift+M)');

	// 2. props
	interface Props {
		activeTool: DrawingTool;
		keepToolActive: boolean;
		/** When true, show connection anchors on all connectable shapes. */
		showConnectorAnchors?: boolean;
		/** When true, show the select tool as active (e.g. while context menu is open). */
		contextMenuOpen?: boolean;
		onToolChange?: (tool: DrawingTool) => void;
	}
	let { activeTool = $bindable('pen'), keepToolActive = $bindable(false), showConnectorAnchors = $bindable(false), contextMenuOpen = false, onToolChange }: Props = $props();

	// 8. HTML 이벤트에 바인딩하는 함수
	const handleToolClick = (tool: DrawingTool) => {
		activeTool = selectTool(activeTool, tool, onToolChange);
	};
	const handleLockClick = () => {
		keepToolActive = !keepToolActive;
	};
</script>

<aside class="tool-panel">
	<span class="sr-only" aria-hidden="true">{$locale}</span>
	{#each TOOL_ITEMS as item, i}
		<button
			type="button"
			class={`tool-btn ${(contextMenuOpen ? item.tool === 'select' : activeTool === item.tool) ? 'active' : ''}`}
			onclick={() => handleToolClick(item.tool)}
			title={getToolTitle($t, item, i)}
		>
			<span class="icon">{@html item.icon}</span>
		</button>
	{/each}

	<div class="tool-divider"></div>

	{#if activeTool === 'select' || activeTool === 'connector' || contextMenuOpen}
		<button
			type="button"
			class={`tool-btn ${showConnectorAnchors ? 'active' : ''}`}
			onclick={() => (showConnectorAnchors = !showConnectorAnchors)}
			title={showConnectorAnchors ? $t('tool.hideAnchors') : $t('tool.showAnchors')}
		>
			<span class="icon">
				<!-- link / anchor points icon -->
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
			</span>
		</button>
	{/if}

	<button
		type="button"
		class={`tool-btn lock-btn ${keepToolActive ? 'active' : ''}`}
		onclick={handleLockClick}
		title={keepToolActive ? $t('tool.lockTitle') : $t('tool.unlockTitle')}
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
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.tool-panel {
		width: 48px;
		background: var(--ui-glass-bg);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		border: 1px solid var(--ui-border-strong);
		border-top: none;
		padding: 0.3rem 0.5rem 0.3rem 0.3rem;
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 0.25rem;
	}

	.tool-btn {
		width: 100%;
		aspect-ratio: 1 / 1;
		display: grid;
		place-items: center;
		border: 1px solid var(--ui-border);
		background: var(--ui-surface);
		padding: 0;
		cursor: pointer;
		transition: background 0.12s, border-color 0.12s, box-shadow 0.12s;
		color: var(--ui-accent);
		line-height: 0;
		overflow: hidden;
	}

	.tool-btn .icon {
		width: 22px;
		height: 22px;
		display: grid;
		place-items: center;
		line-height: 0;
		font-size: 0.95rem;
	}

	.tool-btn .icon :global(svg) {
		display: block;
		width: 18px;
		height: 18px;
		flex-shrink: 0;
	}

	.tool-btn:hover {
		background: var(--ui-accent-muted);
		border-color: var(--ui-accent-soft);
	}

	.tool-btn.active {
		background: var(--ui-accent-muted);
		border-color: var(--ui-accent);
		box-shadow: 0 0 0 1.5px var(--ui-accent) inset;
		color: var(--ui-accent);
	}

	.tool-divider {
		height: 1px;
		background: var(--ui-border);
		margin: 0.1rem 0.15rem;
		flex-shrink: 0;
	}

	.lock-btn {
		color: var(--ui-text-muted);
	}

	.lock-btn.active {
		color: var(--ui-accent);
	}
</style>
