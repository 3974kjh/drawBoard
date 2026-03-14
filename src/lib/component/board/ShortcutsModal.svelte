<script lang="ts">
	import { TOOL_ITEMS } from '$lib/Enum';

	interface Props {
		show: boolean;
		onClose: () => void;
	}

	let { show, onClose }: Props = $props();

	const sections: { title: string; shortcuts: { keys: string; desc: string }[] }[] = [
		{
			title: 'General',
			shortcuts: [
				{ keys: 'Ctrl + S', desc: 'Save board' },
				{ keys: 'Ctrl + Z', desc: 'Undo' },
				{ keys: 'Ctrl + Y', desc: 'Redo' },
				{ keys: 'Ctrl + C', desc: 'Copy selection' },
				{ keys: 'Ctrl + V', desc: 'Paste' },
				{ keys: 'Delete / Backspace', desc: 'Delete selection' }
			]
		},
		{
			title: 'Tools',
			shortcuts: [
				...TOOL_ITEMS.slice(0, 10).map((item, i) => ({
					keys: `Ctrl + ${i}`,
					desc: item.label
				})),
				{ keys: 'Ctrl + Shift + M', desc: TOOL_ITEMS[10]?.label ?? 'Image' }
			]
		},
		{
			title: 'Top bar',
			shortcuts: [
				{ keys: 'Ctrl + O', desc: 'Import board' },
				{ keys: 'Ctrl + L', desc: 'Library' },
				{ keys: 'Ctrl + Shift + P', desc: 'Export as PDF' },
				{ keys: 'Ctrl + Shift + E', desc: 'Export as image (PNG)' },
				{ keys: 'Ctrl + Shift + C', desc: 'Clear board' }
			]
		},
		{
			title: 'Board',
			shortcuts: [
				{ keys: 'Ctrl + Shift + ↑', desc: 'Expand board up' },
				{ keys: 'Ctrl + Shift + ↓', desc: 'Expand board down' },
				{ keys: 'Ctrl + Shift + ←', desc: 'Expand board left' },
				{ keys: 'Ctrl + Shift + →', desc: 'Expand board right' }
			]
		}
	];
</script>

{#if show}
	<div class="modal-backdrop">
		<!-- svelte-ignore a11y_interactive_supports_focus -->
		<div
			class="backdrop-close"
			role="button"
			aria-label="Close shortcuts"
			onclick={onClose}
			onkeydown={(e) => e.key === 'Escape' && onClose()}
		></div>

		<div class="shortcuts-modal" role="dialog" aria-modal="true" aria-labelledby="shortcuts-title" tabindex="-1">
			<div class="modal-header">
				<div class="modal-title-wrap">
					<!-- question mark icon -->
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="12" cy="12" r="10"/>
						<path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
						<line x1="12" y1="17" x2="12.01" y2="17"/>
					</svg>
					<h2 id="shortcuts-title">Keyboard shortcuts</h2>
				</div>
				<p class="modal-desc">Use these shortcuts while the board is focused (not while typing in a text field).</p>
			</div>

			<div class="shortcuts-body">
				{#each sections as section}
					<section class="shortcut-section">
						<h3 class="section-title">{section.title}</h3>
						<dl class="shortcut-list">
							{#each section.shortcuts as { keys, desc }}
								<div class="shortcut-row">
									<dt class="keys"><kbd>{keys}</kbd></dt>
									<dd class="desc">{desc}</dd>
								</div>
							{/each}
						</dl>
					</section>
				{/each}
			</div>

			<div class="modal-footer">
				<button type="button" class="btn-close" onclick={onClose}>Close</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		display: grid;
		place-items: center;
		background: var(--ui-overlay);
		backdrop-filter: blur(3px);
		z-index: 100;
	}

	.backdrop-close {
		position: absolute;
		inset: 0;
		border: none;
		background: transparent;
		cursor: default;
	}

	.shortcuts-modal {
		position: relative;
		z-index: 1;
		width: min(480px, calc(100vw - 2rem));
		max-height: calc(100vh - 4rem);
		background: var(--ui-surface);
		border-radius: 20px;
		box-shadow: 0 20px 60px rgba(15, 23, 42, 0.2);
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.modal-header {
		padding: 1.25rem 1.4rem 0.9rem;
		border-bottom: 1px solid #f1f5f9;
	}

	.modal-title-wrap {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--ui-text-secondary);
		margin-bottom: 0.3rem;
	}

	.modal-title-wrap h2 {
		margin: 0;
		font-size: 1.05rem;
		font-weight: 700;
	}

	.modal-desc {
		margin: 0;
		font-size: 0.8rem;
		color: var(--ui-text-muted);
	}

	.shortcuts-body {
		overflow-y: auto;
		flex: 1;
		padding: 1rem 1.4rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.shortcut-section {
		margin: 0;
	}

	.section-title {
		margin: 0 0 0.5rem 0;
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--ui-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.shortcut-list {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		margin: 0;
	}

	.shortcut-row {
		display: grid;
		grid-template-columns: auto 1fr;
		align-items: center;
		gap: 0.75rem;
		margin: 0;
	}

	.keys {
		margin: 0;
	}

	.keys kbd {
		display: inline-block;
		padding: 0.25rem 0.5rem;
		font-size: 0.75rem;
		font-family: ui-monospace, monospace;
		background: var(--ui-surface-alt);
		border: 1px solid #e2e8f0;
		border-radius: 6px;
		color: var(--ui-text-secondary);
		box-shadow: 0 1px 0 #e2e8f0;
	}

	.desc {
		margin: 0;
		font-size: 0.875rem;
		color: var(--ui-text-muted);
	}

	.modal-footer {
		padding: 0.9rem 1.4rem;
		border-top: 1px solid #f1f5f9;
	}

	.btn-close {
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--ui-text-muted);
		background: var(--ui-surface-alt);
		border: 1px solid #e2e8f0;
		border-radius: 10px;
		cursor: pointer;
		transition: background 0.15s, border-color 0.15s;
	}

	.btn-close:hover {
		background: var(--ui-border);
		border-color: var(--ui-border-strong);
	}
</style>
