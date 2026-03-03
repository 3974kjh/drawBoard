<script lang="ts">
	interface Props {
		show: boolean;
		defaultName: string;
		onSave: (name: string) => void;
		onClose: () => void;
	}

	let { show, defaultName = 'Library item', onSave, onClose }: Props = $props();

	let name = $state('');

	$effect(() => {
		if (show) name = defaultName;
	});

	function handleSubmit() {
		const trimmed = name.trim();
		if (trimmed) {
			onSave(trimmed);
			onClose();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
		if (e.key === 'Enter') handleSubmit();
	}
</script>

{#if show}
	<div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="save-library-title">
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div class="backdrop-close" role="button" tabindex="-1" onclick={onClose}></div>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="modal-box" role="group" onkeydown={handleKeydown}>
			<h2 id="save-library-title">Save to Library</h2>
			<p class="modal-desc">Enter a name for this library item.</p>
			<input
				type="text"
				bind:value={name}
				placeholder="Item name"
				class="name-input"
				aria-label="Library item name"
			/>
			<div class="modal-actions">
				<button type="button" class="btn-secondary" onclick={onClose}>Cancel</button>
				<button type="button" class="btn-primary" onclick={handleSubmit} disabled={!name.trim()}>
					Save
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(15, 23, 42, 0.4);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1001;
	}
	.backdrop-close {
		position: absolute;
		inset: 0;
	}
	.modal-box {
		position: relative;
		background: #fff;
		border-radius: 12px;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
		padding: 1.25rem 1.5rem;
		width: 90%;
		max-width: 360px;
	}
	.modal-box h2 {
		margin: 0 0 0.35rem 0;
		font-size: 1.1rem;
		font-weight: 600;
		color: #1e293b;
	}
	.modal-desc {
		margin: 0 0 1rem 0;
		font-size: 0.85rem;
		color: #64748b;
	}
	.name-input {
		width: 100%;
		box-sizing: border-box;
		padding: 0.5rem 0.75rem;
		font-size: 0.9rem;
		border: 1px solid #cbd5e1;
		border-radius: 8px;
		margin-bottom: 1rem;
	}
	.name-input:focus {
		outline: none;
		border-color: #2563eb;
		box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
	}
	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}
	.btn-secondary {
		padding: 0.45rem 1rem;
		font-size: 0.85rem;
		border: 1px solid #cbd5e1;
		background: #fff;
		border-radius: 8px;
		cursor: pointer;
		color: #475569;
	}
	.btn-secondary:hover {
		background: #f8fafc;
	}
	.btn-primary {
		padding: 0.45rem 1rem;
		font-size: 0.85rem;
		border: none;
		background: #2563eb;
		color: #fff;
		border-radius: 8px;
		cursor: pointer;
	}
	.btn-primary:hover:not(:disabled) {
		background: #1d4ed8;
	}
	.btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
