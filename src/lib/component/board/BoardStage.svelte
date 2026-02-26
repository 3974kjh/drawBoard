<script lang="ts">
	import {
		TEXT_EDITABLE_TYPES,
		type BoardElement,
		type DrawingTool,
		type GroupBox,
		type GuideLine,
		type GuideDistance,
		type Point
	} from '$lib/board-types';

	interface MarqueeRect {
		start: Point;
		current: Point;
	}

	interface Props {
		stageRef: HTMLElement | null;
		drawCanvas: HTMLCanvasElement | null;
		wrapRef: HTMLElement | null;
		themeBackground: string;
		themeGridColor: string;
		activeTool: DrawingTool;
		eraserSize: number;
		stageWidth: number;
		stageHeight: number;
		elements: BoardElement[];
		selectedElementIds: string[];
		selectedSingleElement: BoardElement | null;
		editingElementId: string | null;
		marquee: MarqueeRect | null;
		selectedGroupBoxes: GroupBox[];
		guideLines: GuideLine[];
		guideDistances: GuideDistance[];
		onPointerDown: (e: PointerEvent) => void;
		onPointerMove: (e: PointerEvent) => void;
		onPointerUp: (e: PointerEvent) => void;
		onDblClickElement: (id: string) => void;
		onBeginResize: (e: PointerEvent, id: string) => void;
		onBeginRotate: (e: PointerEvent, id: string) => void;
		onElementTextChange: (id: string, text: string) => void;
		onElementTextBlur: () => void;
		onExpandBoard: (dir: 'top' | 'bottom' | 'left' | 'right', amount: number) => void;
		gridEnabled: boolean;
		gridSize: number;
	}

	let {
		stageRef = $bindable(null),
		drawCanvas = $bindable(null),
		wrapRef = $bindable(null),
		themeBackground,
		themeGridColor,
		gridEnabled,
		gridSize,
		activeTool,
		eraserSize,
		stageWidth,
		stageHeight,
		elements,
		selectedElementIds,
		selectedSingleElement,
		editingElementId,
		marquee,
		selectedGroupBoxes,
		guideLines,
		guideDistances,
		onPointerDown,
		onPointerMove,
		onPointerUp,
		onDblClickElement,
		onBeginResize,
		onBeginRotate,
		onElementTextChange,
		onElementTextBlur,
		onExpandBoard
	}: Props = $props();

	/* ── Internal eraser cursor tracking ── */
	let eraserPos = $state<{ x: number; y: number } | null>(null);

	/* ── Edge hover for expand buttons (visible-viewport coords) ── */
	let hoverEdge = $state<'top' | 'bottom' | 'left' | 'right' | null>(null);

	const EDGE_ZONE = 36; // px from visible edge that activates the expand button

	/* ── Scroll / viewport state for visible-edge detection ── */
	let _scrollLeft = $state(0);
	let _scrollTop = $state(0);
	let _viewportW = $state(0);
	let _viewportH = $state(0);

	const _visCenterX = $derived(_scrollLeft + _viewportW / 2);
	const _visCenterY = $derived(_scrollTop + _viewportH / 2);

	$effect(() => {
		const el = wrapRef;
		if (!el) return;
		const update = () => {
			_scrollLeft = el.scrollLeft;
			_scrollTop = el.scrollTop;
			_viewportW = el.clientWidth;
			_viewportH = el.clientHeight;
		};
		update();
		el.addEventListener('scroll', update, { passive: true });
		const ro = new ResizeObserver(update);
		ro.observe(el);
		return () => {
			el.removeEventListener('scroll', update);
			ro.disconnect();
		};
	});

	function handlePointerMove(event: PointerEvent) {
		const rect = stageRef?.getBoundingClientRect();
		if (rect) {
			const bx = event.clientX - rect.left;
			const by = event.clientY - rect.top;

			if (activeTool === 'eraser') {
				eraserPos = { x: bx, y: by };
			} else {
				eraserPos = null;
			}

			/* Determine which VISIBLE VIEWPORT edge (if any) the pointer is near */
			if (by < _scrollTop + EDGE_ZONE) hoverEdge = 'top';
			else if (by > _scrollTop + _viewportH - EDGE_ZONE) hoverEdge = 'bottom';
			else if (bx < _scrollLeft + EDGE_ZONE) hoverEdge = 'left';
			else if (bx > _scrollLeft + _viewportW - EDGE_ZONE) hoverEdge = 'right';
			else hoverEdge = null;
		}
		onPointerMove(event);
	}

	function handlePointerLeave() {
		eraserPos = null;
		hoverEdge = null;
	}

	/* ── Auto-focus action for textarea ── */
	function autoFocus(node: HTMLTextAreaElement) {
		requestAnimationFrame(() => node.focus());
	}

	/** Check if an element type supports text editing */
	function supportsText(type: BoardElement['type']): boolean {
		return TEXT_EDITABLE_TYPES.includes(type);
	}
</script>

<section class="stage-wrap" bind:this={wrapRef}>
	<section
		class="board-stage"
		class:eraser-active={activeTool === 'eraser'}
		bind:this={stageRef}
		style={`--theme-bg:${themeBackground};--grid-color:${gridEnabled ? themeGridColor : 'transparent'};--grid-size:${gridSize}px;min-width:${stageWidth}px;min-height:${stageHeight}px;`}
		onpointerdown={onPointerDown}
		onpointermove={handlePointerMove}
		onpointerup={onPointerUp}
		onpointercancel={onPointerUp}
		onpointerleave={handlePointerLeave}
		role="application"
		aria-label="드로잉 보드"
	>
		<!-- Edge expand buttons – centered on the VISIBLE viewport edge, not the board edge -->
		{#if hoverEdge === 'top'}
			<button
				type="button"
				class="expand-btn top"
				style={`top:${_scrollTop}px;left:${_visCenterX}px;`}
				onclick={() => onExpandBoard('top', 200)}
				title="위로 200px 확장"
			>
				<!-- prettier-ignore -->
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>
			</button>
		{/if}
		{#if hoverEdge === 'bottom'}
			<button
				type="button"
				class="expand-btn bottom"
				style={`top:${Math.min(stageHeight, _scrollTop + _viewportH) - 26}px;left:${_visCenterX}px;`}
				onclick={() => onExpandBoard('bottom', 200)}
				title="아래로 200px 확장"
			>
				<!-- prettier-ignore -->
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/></svg>
			</button>
		{/if}
		{#if hoverEdge === 'left'}
			<button
				type="button"
				class="expand-btn left"
				style={`left:${_scrollLeft}px;top:${_visCenterY}px;`}
				onclick={() => onExpandBoard('left', 200)}
				title="왼쪽으로 200px 확장"
			>
				<!-- prettier-ignore -->
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5"/><path d="M12 5l-7 7 7 7"/></svg>
			</button>
		{/if}
		{#if hoverEdge === 'right'}
			<button
				type="button"
				class="expand-btn right"
				style={`left:${Math.min(stageWidth, _scrollLeft + _viewportW) - 26}px;top:${_visCenterY}px;`}
				onclick={() => onExpandBoard('right', 200)}
				title="오른쪽으로 200px 확장"
			>
				<!-- prettier-ignore -->
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
			</button>
		{/if}
		<canvas bind:this={drawCanvas}></canvas>

		{#each elements as element (element.id)}
			{@const isSelected = selectedElementIds.includes(element.id)}
			{@const isSingleSelected =
				selectedSingleElement && selectedSingleElement.id === element.id}
			{@const isEditing = editingElementId === element.id}
			{@const hasText = supportsText(element.type)}
			{@const bw = element.borderWidth ?? 2}
			<div
				class={`element ${isSelected ? 'selected' : ''} ${element.type}`}
				data-element-id={element.id}
				style={`left:${element.x}px;top:${element.y}px;width:${element.width}px;height:${element.height}px;--fill:${element.fillColor};--stroke:${element.strokeColor};--border-w:${bw}px;text-align:${element.textAlign};--text-valign:${element.textVerticalAlign === 'middle' ? 'center' : element.textVerticalAlign === 'bottom' ? 'flex-end' : 'flex-start'};transform:rotate(${element.rotation}deg);transform-origin:center center;`}
				ondblclick={() => onDblClickElement(element.id)}
				role="button"
				tabindex="0"
			>
				<!-- Triangle uses inline SVG for proper border on all edges -->
				{#if element.type === 'triangle'}
					<svg
						class="shape-svg"
						viewBox="0 0 {element.width} {element.height}"
						preserveAspectRatio="none"
					>
						<polygon
							points="{element.width / 2},{ bw / 2} {element.width - bw / 2},{element.height - bw / 2} {bw / 2},{element.height - bw / 2}"
							fill={element.fillColor}
							stroke={element.strokeColor}
							stroke-width={bw}
							stroke-linejoin="round"
						/>
					</svg>
				{/if}

			<!-- Ellipse uses inline SVG for perfect rendering -->
			{#if element.type === 'ellipse'}
				<svg class="shape-svg" viewBox="0 0 {element.width} {element.height}">
					<ellipse
						cx={element.width / 2}
						cy={element.height / 2}
						rx={Math.max(4, element.width / 2 - bw / 2)}
						ry={Math.max(4, element.height / 2 - bw / 2)}
						fill={element.fillColor}
						stroke={element.strokeColor}
						stroke-width={bw}
					/>
				</svg>
			{/if}

			<!-- Image element -->
			{#if element.type === 'image'}
				{#if element.imageDataUrl}
					<img src={element.imageDataUrl} alt="" class="image-fill" />
				{:else}
					<div class="image-placeholder">
						<!-- prettier-ignore -->
						<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
						<span>속성 패널에서 이미지 선택</span>
					</div>
				{/if}
			{/if}

			{#if hasText}
					{#if isEditing}
						<textarea
							class="text-editor"
							value={element.text}
							oninput={(event) =>
								onElementTextChange(
									element.id,
									(event.currentTarget as HTMLTextAreaElement).value
								)}
							onblur={onElementTextBlur}
							onpointerdown={(e) => e.stopPropagation()}
							use:autoFocus
						></textarea>
					{:else}
						<div class="text-view" style={`font-size:${element.fontSize}px;`}>
							{element.text || (element.type === 'text' ? '더블클릭해 텍스트 입력' : '')}
						</div>
					{/if}
				{/if}

				{#if isSingleSelected}
					<!-- Rotation handle -->
					<button
						type="button"
						class="rotate-handle"
						onpointerdown={(event) => onBeginRotate(event, element.id)}
						aria-label="요소 회전"
					>↻</button>
					<!-- Resize handle -->
					<button
						type="button"
						class="resize-handle"
						onpointerdown={(event) => onBeginResize(event, element.id)}
						aria-label="요소 크기 조절"
					></button>
				{/if}
			</div>
		{/each}

		{#if marquee}
			<div
				class="marquee"
				style={`left:${Math.min(marquee.start.x, marquee.current.x)}px;top:${Math.min(marquee.start.y, marquee.current.y)}px;width:${Math.abs(marquee.current.x - marquee.start.x)}px;height:${Math.abs(marquee.current.y - marquee.start.y)}px;`}
			></div>
		{/if}

		{#each selectedGroupBoxes as box (box.groupId)}
			<div
				class="group-bbox"
				style={`left:${box.x - 6}px;top:${box.y - 6}px;width:${box.width + 12}px;height:${box.height + 12}px;`}
			>
				<span>Group</span>
			</div>
		{/each}

		{#each guideLines as line, idx (`${line.orientation}-${line.value}-${idx}`)}
			<div
				class={`guide-line ${line.orientation}`}
				style={line.orientation === 'vertical'
					? `left:${line.value}px;`
					: `top:${line.value}px;`}
			></div>
		{/each}

		{#each guideDistances as label, idx (`${label.x}-${label.y}-${idx}`)}
			<div class="guide-distance" style={`left:${label.x}px;top:${label.y}px;`}>
				{label.text}
			</div>
		{/each}

		<!-- Eraser cursor -->
		{#if activeTool === 'eraser' && eraserPos}
			<div
				class="eraser-cursor"
				style={`left:${eraserPos.x - eraserSize / 2}px;top:${eraserPos.y - eraserSize / 2}px;width:${eraserSize}px;height:${eraserSize}px;`}
			></div>
		{/if}
	</section>
</section>

<style>
	.stage-wrap {
		position: relative;
		overflow: auto;
		border: 1px solid #cbd5e1;
		background: #f8fafc;
		/* Firefox */
		scrollbar-width: thin;
		scrollbar-color: #94a3b8 transparent;
	}

	/* Webkit (Chrome, Safari, Edge) */
	.stage-wrap::-webkit-scrollbar {
		width: 7px;
		height: 7px;
	}

	.stage-wrap::-webkit-scrollbar-track {
		background: transparent;
		border-radius: 99px;
	}

	.stage-wrap::-webkit-scrollbar-thumb {
		background: #94a3b8;
		border-radius: 99px;
		border: 2px solid transparent;
		background-clip: padding-box;
		transition: background 0.2s;
	}

	.stage-wrap::-webkit-scrollbar-thumb:hover {
		background: #64748b;
		border: 2px solid transparent;
		background-clip: padding-box;
	}

	.stage-wrap::-webkit-scrollbar-corner {
		background: transparent;
	}

	.board-stage {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
		background:
			repeating-linear-gradient(0deg, var(--grid-color) 0 1px, transparent 1px var(--grid-size)),
			repeating-linear-gradient(90deg, var(--grid-color) 0 1px, transparent 1px var(--grid-size)),
			var(--theme-bg);
	}

	.board-stage.eraser-active {
		cursor: none;
	}

	canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}

	/* ── Expand buttons – glassmorphism ── */
	.expand-btn {
		position: absolute;
		z-index: 20;
		display: grid;
		place-items: center;
		/* glass base */
		background: rgba(255, 255, 255, 0.22);
		backdrop-filter: blur(10px) saturate(160%);
		-webkit-backdrop-filter: blur(10px) saturate(160%);
		border: 1px solid rgba(255, 255, 255, 0.45);
		color: rgba(30, 64, 175, 0.95);
		cursor: pointer;
		padding: 0;
		box-shadow:
			0 2px 12px rgba(37, 99, 235, 0.18),
			inset 0 1px 0 rgba(255, 255, 255, 0.6);
		transition:
			background 0.18s,
			box-shadow 0.18s,
			transform 0.12s;
	}

	.expand-btn:hover {
		background: rgba(219, 234, 254, 0.65);
		box-shadow:
			0 4px 20px rgba(37, 99, 235, 0.28),
			inset 0 1px 0 rgba(255, 255, 255, 0.7);
		color: #1d4ed8;
	}

	.expand-btn svg {
		filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.15));
	}

	.expand-btn.top {
		transform: translateX(-50%);
		width: 88px;
		height: 26px;
		border-top: none;
		border-radius: 0 0 14px 14px;
	}

	.expand-btn.top:hover {
		filter: brightness(0.93);
	}

	.expand-btn.bottom {
		transform: translateX(-50%);
		width: 88px;
		height: 26px;
		border-bottom: none;
		border-radius: 14px 14px 0 0;
	}

	.expand-btn.bottom:hover {
		filter: brightness(0.93);
	}

	.expand-btn.left {
		transform: translateY(-50%);
		width: 26px;
		height: 88px;
		border-left: none;
		border-radius: 0 14px 14px 0;
	}

	.expand-btn.left:hover {
		filter: brightness(0.93);
	}

	.expand-btn.right {
		transform: translateY(-50%);
		width: 26px;
		height: 88px;
		border-right: none;
		border-radius: 14px 0 0 14px;
	}

	.expand-btn.right:hover {
		filter: brightness(0.93);
	}

	/* ── Elements ── */
	.element {
		position: absolute;
		box-sizing: border-box;
		display: grid;
		place-items: center;
		cursor: move;
		overflow: visible;
	}

	/* Default rect rendering via CSS */
	.element.rect {
		border: var(--border-w) solid var(--stroke);
		background: var(--fill);
	}

	/* Ellipse – rendered with inline SVG, container is transparent */
	.element.ellipse {
		border: none;
		background: transparent;
	}

	/* Triangle – rendered with inline SVG, container is transparent */
	.element.triangle {
		border: none;
		background: transparent;
	}

	/* Inline SVG fills the element */
	.shape-svg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}

	/* ── Horizontal line ── */
	.element.line-h {
		border: none;
		background: transparent;
	}

	.element.line-h::before {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		top: 50%;
		height: 0;
		border-top: var(--border-w) solid var(--stroke);
	}

	/* ── Vertical line ── */
	.element.line-v {
		border: none;
		background: transparent;
	}

	.element.line-v::before {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		left: 50%;
		width: 0;
		border-left: var(--border-w) solid var(--stroke);
	}

	/* ── Text ── borderWidth controls visibility; 0 = no border */
	.element.text {
		border-style: dashed;
		border-color: var(--stroke);
		border-width: var(--border-w);
		background: transparent;
	}

	/* ── Image ── */
	.element.image {
		border: var(--border-w) solid var(--stroke);
		background: #f1f5f9;
		overflow: hidden;
	}

	.image-fill {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: contain;
		display: block;
		pointer-events: none;
	}

	.image-placeholder {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.3rem;
		color: #94a3b8;
		font-size: 0.8rem;
		pointer-events: none;
	}

	.element.selected {
		outline: 2px dashed #2563eb;
		outline-offset: 2px;
	}

	.text-view {
		width: 100%;
		height: 100%;
		padding: 0.5rem;
		box-sizing: border-box;
		color: var(--stroke);
		white-space: pre-wrap;
		pointer-events: none;
		z-index: 1;
		display: flex;
		flex-direction: column;
		justify-content: var(--text-valign, flex-start);
	}

	.text-editor {
		width: 100%;
		height: 100%;
		resize: none;
		border: none;
		background: transparent;
		padding: 0.5rem;
		box-sizing: border-box;
		outline: none;
		color: var(--stroke);
		font: inherit;
		z-index: 2;
	}

	/* ── Handles ── */
	.resize-handle {
		position: absolute;
		right: -6px;
		bottom: -6px;
		width: 12px;
		height: 12px;
		border-radius: 3px;
		background: #2563eb;
		border: 2px solid #fff;
		cursor: nwse-resize;
		z-index: 6;
	}

	.rotate-handle {
		position: absolute;
		top: -30px;
		left: 50%;
		transform: translateX(-50%);
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: #2563eb;
		border: 2px solid #fff;
		color: #fff;
		font-size: 12px;
		line-height: 1;
		cursor: grab;
		display: grid;
		place-items: center;
		z-index: 6;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
	}

	.rotate-handle:active {
		cursor: grabbing;
	}

	/* ── Marquee ── */
	.marquee {
		position: absolute;
		border: 1px dashed #1d4ed8;
		background: rgba(59, 130, 246, 0.12);
	}

	/* ── Group bounding box ── */
	.group-bbox {
		position: absolute;
		border: 1px dashed #9333ea;
		border-radius: 10px;
		background: rgba(147, 51, 234, 0.06);
		pointer-events: none;
		z-index: 3;
	}

	.group-bbox span {
		position: absolute;
		top: -18px;
		left: 0;
		font-size: 0.65rem;
		color: #7e22ce;
		background: rgba(255, 255, 255, 0.9);
		padding: 1px 6px;
		border-radius: 999px;
		border: 1px solid #e9d5ff;
	}

	/* ── Guide lines ── */
	.guide-line {
		position: absolute;
		background: rgba(14, 165, 233, 0.9);
		pointer-events: none;
		z-index: 4;
	}

	.guide-line.vertical {
		top: 0;
		bottom: 0;
		width: 1px;
	}

	.guide-line.horizontal {
		left: 0;
		right: 0;
		height: 1px;
	}

	.guide-distance {
		position: absolute;
		transform: translate(-50%, -50%);
		padding: 2px 6px;
		border-radius: 999px;
		background: rgba(2, 132, 199, 0.95);
		color: #fff;
		font-size: 0.68rem;
		font-weight: 600;
		letter-spacing: 0.01em;
		pointer-events: none;
		z-index: 5;
		box-shadow: 0 1px 2px rgba(15, 23, 42, 0.35);
	}

	/* ── Eraser cursor ── */
	.eraser-cursor {
		position: absolute;
		border: 2px dashed rgba(239, 68, 68, 0.85);
		border-radius: 50%;
		pointer-events: none;
		z-index: 10;
		box-shadow: 0 0 0 1px rgba(239, 68, 68, 0.25);
	}
</style>
