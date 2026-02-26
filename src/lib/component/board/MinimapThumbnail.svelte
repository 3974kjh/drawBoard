<script lang="ts">
	import type { BoardElement, Stroke } from '$lib/board-types';
	import {
		drawThemeBackground,
		drawStroke,
		drawElementToCanvas,
		loadImages
	} from '$lib/canvas-renderer';

	interface Props {
		stageWidth: number;
		stageHeight: number;
		themeBackground: string;
		themeGridColor: string;
		strokes: Stroke[];
		elements: BoardElement[];
		stageWrapRef: HTMLElement | null;
	}

	let {
		stageWidth,
		stageHeight,
		themeBackground,
		themeGridColor,
		strokes,
		elements,
		stageWrapRef
	}: Props = $props();

	/* High DPI factor for sharper canvas rendering */
	const DPR = 2;
	/* Fixed container height in CSS px — never changes */
	const CONTAINER_H = 148;

	let canvas = $state<HTMLCanvasElement | null>(null);
	let containerEl = $state<HTMLElement | null>(null);
	let containerW = $state(232);
	let collapsed = $state(false);
	let imageMap = $state<Map<string, HTMLImageElement>>(new Map());

	/* Scroll / viewport state from stageWrapRef */
	let scrollLeft = $state(0);
	let scrollTop = $state(0);
	let viewportW = $state(800);
	let viewportH = $state(600);

	/* ── Coordinate mapping ──
	 * Scale board to fit inside the fixed container while maintaining aspect ratio.
	 */
	const scale = $derived(Math.min(containerW / stageWidth, CONTAINER_H / stageHeight));
	const boardDisplayW = $derived(stageWidth * scale);
	const boardDisplayH = $derived(stageHeight * scale);
	/* Letterbox offsets to center the board inside the container */
	const boardOffsetX = $derived((containerW - boardDisplayW) / 2);
	const boardOffsetY = $derived((CONTAINER_H - boardDisplayH) / 2);

	/* Viewport rectangle in minimap display coordinates */
	const vpRawLeft = $derived(boardOffsetX + scrollLeft * scale);
	const vpRawTop = $derived(boardOffsetY + scrollTop * scale);
	const vpClampedLeft = $derived(Math.max(boardOffsetX, vpRawLeft));
	const vpClampedTop = $derived(Math.max(boardOffsetY, vpRawTop));
	const vpRight = $derived(Math.min(boardOffsetX + boardDisplayW, vpRawLeft + viewportW * scale));
	const vpBottom = $derived(Math.min(boardOffsetY + boardDisplayH, vpRawTop + viewportH * scale));
	const vpW = $derived(Math.max(0, vpRight - vpClampedLeft));
	const vpH = $derived(Math.max(0, vpBottom - vpClampedTop));
	/* If the board fits entirely in the viewport, no indicator is needed */
	const isFullyVisible = $derived(viewportW >= stageWidth && viewportH >= stageHeight);

	/* ── Track container width via ResizeObserver ── */
	$effect(() => {
		const el = containerEl;
		if (!el) return;
		containerW = el.clientWidth || 232;
		const ro = new ResizeObserver((entries) => {
			const w = entries[0]?.contentRect.width;
			if (w) containerW = Math.round(w);
		});
		ro.observe(el);
		return () => ro.disconnect();
	});

	/* ── Track scroll / viewport state from the board's scrollable wrapper ── */
	$effect(() => {
		const wrap = stageWrapRef;
		if (!wrap) return;
		const update = () => {
			scrollLeft = wrap.scrollLeft;
			scrollTop = wrap.scrollTop;
			viewportW = wrap.clientWidth;
			viewportH = wrap.clientHeight;
		};
		update();
		wrap.addEventListener('scroll', update, { passive: true });
		const ro = new ResizeObserver(update);
		ro.observe(wrap);
		return () => {
			wrap.removeEventListener('scroll', update);
			ro.disconnect();
		};
	});

	/* ── Pre-load images for minimap ── */
	$effect(() => {
		if (elements.some((e) => e.type === 'image' && e.imageDataUrl)) {
			loadImages(elements).then((map) => {
				imageMap = map;
			});
		} else {
			imageMap = new Map();
		}
	});

	/* ── Render minimap canvas at 2× DPR for sharp output ── */
	$effect(() => {
		if (!canvas || collapsed) return;

		const cw = containerW;
		const sc = Math.min(cw / stageWidth, CONTAINER_H / stageHeight);
		const ew = stageWidth * sc;
		const eh = stageHeight * sc;
		const ox = (cw - ew) / 2;
		const oy = (CONTAINER_H - eh) / 2;

		/* Render at 2× resolution, display at CSS size for crisp output */
		canvas.width = cw * DPR;
		canvas.height = CONTAINER_H * DPR;
		canvas.style.width = `${cw}px`;
		canvas.style.height = `${CONTAINER_H}px`;

		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		/* Letterbox background */
		ctx.fillStyle = '#dbe3ef';
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		/* Clip to board area */
		ctx.save();
		ctx.beginPath();
		ctx.rect(ox * DPR, oy * DPR, ew * DPR, eh * DPR);
		ctx.clip();

		ctx.translate(ox * DPR, oy * DPR);
		ctx.scale(sc * DPR, sc * DPR);

		drawThemeBackground(ctx, stageWidth, stageHeight, themeBackground, themeGridColor);
		strokes.forEach((s) => drawStroke(ctx, s));
		elements.forEach((e) => drawElementToCanvas(ctx, e, imageMap));

		ctx.restore();
	});

	/* ── Drag-to-scroll interaction ── */
	let isDragging = $state(false);
	let isHoveringVP = $state(false);
	let isHoveringBoard = $state(false);
	let dragStartMx = 0;
	let dragStartMy = 0;
	let dragStartScrollLeft = 0;
	let dragStartScrollTop = 0;

	function getLocalCoords(e: PointerEvent) {
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		return { mx: e.clientX - rect.left, my: e.clientY - rect.top };
	}

	function miniToBoard(mx: number, my: number) {
		return { bx: (mx - boardOffsetX) / scale, by: (my - boardOffsetY) / scale };
	}

	function handlePointerDown(e: PointerEvent) {
		if (!stageWrapRef) return;
		const { mx, my } = getLocalCoords(e);

		const inBoard =
			mx >= boardOffsetX &&
			mx <= boardOffsetX + boardDisplayW &&
			my >= boardOffsetY &&
			my <= boardOffsetY + boardDisplayH;
		if (!inBoard) return;

		const onVP =
			!isFullyVisible &&
			mx >= vpClampedLeft &&
			mx <= vpClampedLeft + vpW &&
			my >= vpClampedTop &&
			my <= vpClampedTop + vpH;

		if (onVP) {
			/* Drag the viewport rect */
			isDragging = true;
			dragStartMx = mx;
			dragStartMy = my;
			dragStartScrollLeft = stageWrapRef.scrollLeft;
			dragStartScrollTop = stageWrapRef.scrollTop;
			(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		} else {
			/* Click outside the viewport rect → teleport there */
			const { bx, by } = miniToBoard(mx, my);
			const maxX = Math.max(0, stageWidth - viewportW);
			const maxY = Math.max(0, stageHeight - viewportH);
			stageWrapRef.scrollTo({
				left: Math.max(0, Math.min(maxX, bx - viewportW / 2)),
				top: Math.max(0, Math.min(maxY, by - viewportH / 2)),
				behavior: 'smooth'
			});
		}
	}

	function handlePointerMove(e: PointerEvent) {
		const { mx, my } = getLocalCoords(e);

		if (isDragging && stageWrapRef) {
			const maxX = Math.max(0, stageWidth - viewportW);
			const maxY = Math.max(0, stageHeight - viewportH);
			stageWrapRef.scrollLeft = Math.max(
				0,
				Math.min(maxX, dragStartScrollLeft + (mx - dragStartMx) / scale)
			);
			stageWrapRef.scrollTop = Math.max(
				0,
				Math.min(maxY, dragStartScrollTop + (my - dragStartMy) / scale)
			);
			return;
		}

		isHoveringBoard =
			mx >= boardOffsetX &&
			mx <= boardOffsetX + boardDisplayW &&
			my >= boardOffsetY &&
			my <= boardOffsetY + boardDisplayH;

		isHoveringVP =
			isHoveringBoard &&
			!isFullyVisible &&
			mx >= vpClampedLeft &&
			mx <= vpClampedLeft + vpW &&
			my >= vpClampedTop &&
			my <= vpClampedTop + vpH;
	}

	function handlePointerUp() {
		isDragging = false;
	}

	function handlePointerLeave() {
		if (!isDragging) {
			isHoveringVP = false;
			isHoveringBoard = false;
		}
	}
</script>

<div class="minimap">
	<div class="minimap-header">
		<span class="minimap-title">
			<!-- prettier-ignore -->
			<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>
			미니맵
		</span>
		<button
			class="collapse-btn"
			type="button"
			onclick={() => (collapsed = !collapsed)}
			title={collapsed ? '미니맵 펼치기' : '미니맵 접기'}
			aria-label={collapsed ? '미니맵 펼치기' : '미니맵 접기'}
		>
			{#if collapsed}
				<!-- prettier-ignore -->
				<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
			{:else}
				<!-- prettier-ignore -->
				<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
			{/if}
		</button>
	</div>

	{#if !collapsed}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="minimap-body" bind:this={containerEl} style={`height:${CONTAINER_H}px;`}>
			<canvas bind:this={canvas}></canvas>

			{#if !isFullyVisible}
				<div
					class="viewport-rect"
					style={`left:${vpClampedLeft}px;top:${vpClampedTop}px;width:${vpW}px;height:${vpH}px;`}
				></div>
			{/if}

			<!-- Interaction overlay -->
			<div
				class="minimap-hitarea"
				class:in-board={isHoveringBoard && !isHoveringVP && !isDragging}
				class:hovering-vp={isHoveringVP && !isDragging}
				class:dragging={isDragging}
				onpointerdown={handlePointerDown}
				onpointermove={handlePointerMove}
				onpointerup={handlePointerUp}
				onpointercancel={handlePointerUp}
				onpointerleave={handlePointerLeave}
			></div>
		</div>

		<div class="minimap-footer">
			{stageWidth} × {stageHeight} px
		</div>
	{/if}
</div>

<style>
	.minimap {
		background: rgba(255, 255, 255, 0.92);
		backdrop-filter: blur(16px) saturate(160%);
		-webkit-backdrop-filter: blur(16px) saturate(160%);
		border: 1.5px solid #94a3b8;
		border-radius: 14px;
		overflow: hidden;
		box-shadow:
			0 2px 12px rgba(15, 23, 42, 0.1),
			inset 0 1px 0 rgba(255, 255, 255, 0.85);
		flex-shrink: 0;
	}

	/* ── Header ── */
	.minimap-header {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.42rem 0.55rem 0.42rem 0.65rem;
		background: rgba(248, 250, 252, 0.95);
		border-bottom: 1px solid rgba(226, 232, 240, 0.8);
		user-select: none;
	}

	.minimap-title {
		display: flex;
		align-items: center;
		gap: 0.28rem;
		font-size: 0.7rem;
		font-weight: 700;
		color: #374151;
		letter-spacing: 0.01em;
		flex: 1;
	}

	.minimap-title svg {
		color: #6366f1;
		flex-shrink: 0;
	}

	.collapse-btn {
		display: grid;
		place-items: center;
		width: 20px;
		height: 20px;
		border: none;
		background: transparent;
		cursor: pointer;
		border-radius: 5px;
		color: #9ca3af;
		padding: 0;
		transition:
			background 0.15s,
			color 0.15s;
		flex-shrink: 0;
	}

	.collapse-btn:hover {
		background: rgba(0, 0, 0, 0.07);
		color: #374151;
	}

	/* ── Canvas body ── */
	.minimap-body {
		position: relative;
		width: 100%;
		overflow: hidden;
		background: #dbe3ef;
		line-height: 0;
		border-top: 1px solid #94a3b8;
		border-bottom: 1px solid #94a3b8;
	}

	canvas {
		display: block;
		position: absolute;
		top: 0;
		left: 0;
		/* CSS size set dynamically via JS */
	}

	/* ── Viewport indicator rect ── */
	.viewport-rect {
		position: absolute;
		border: 1.5px solid rgba(59, 130, 246, 0.9);
		background: rgba(59, 130, 246, 0.1);
		box-shadow: 0 0 0 0.5px rgba(59, 130, 246, 0.35);
		pointer-events: none;
		z-index: 2;
		border-radius: 1px;
	}

	/* ── Interaction overlay ── */
	.minimap-hitarea {
		position: absolute;
		inset: 0;
		z-index: 3;
		cursor: default;
	}

	.minimap-hitarea.in-board {
		cursor: crosshair;
	}

	.minimap-hitarea.hovering-vp {
		cursor: grab;
	}

	.minimap-hitarea.dragging {
		cursor: grabbing;
	}

	/* ── Footer ── */
	.minimap-footer {
		padding: 0.28rem 0.65rem;
		font-size: 0.6rem;
		color: #94a3b8;
		background: rgba(248, 250, 252, 0.95);
		border-top: 1px solid rgba(226, 232, 240, 0.8);
		text-align: center;
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.04em;
	}
</style>
