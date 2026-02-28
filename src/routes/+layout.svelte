<script lang="ts">
	import { Toaster } from 'svelte-french-toast';
	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
</svelte:head>

{@render children()}
<Toaster />

<style>
	/* Shared scrollbar style (board and all scrollable areas) */
	:global(.scrollbar-theme) {
		scrollbar-width: thin;
		scrollbar-color: #94a3b8 transparent;
	}

	:global(.scrollbar-theme)::-webkit-scrollbar {
		width: 7px;
		height: 7px;
	}

	:global(.scrollbar-theme)::-webkit-scrollbar-track {
		background: transparent;
		border-radius: 99px;
	}

	:global(.scrollbar-theme)::-webkit-scrollbar-thumb {
		background: #94a3b8;
		border-radius: 99px;
		border: 2px solid transparent;
		background-clip: padding-box;
		transition: background 0.2s;
	}

	:global(.scrollbar-theme)::-webkit-scrollbar-thumb:hover {
		background: #64748b;
		border: 2px solid transparent;
		background-clip: padding-box;
	}

	:global(.scrollbar-theme)::-webkit-scrollbar-corner {
		background: transparent;
	}
</style>
