<script lang="ts">
	import {
		CONNECTABLE_TYPES,
		TEXT_EDITABLE_TYPES,
		type BoardElement,
		type DrawingTool,
		type GroupBox,
		type GuideLine,
		type GuideDistance,
		type Point,
		type ResizeHandle
	} from '$lib/board-types';
	import type { Bounds } from '$lib/Type/Bounds.js';
	import { getAnchorPoints, getAnchorPosition, getConnectorPath } from '$lib/connector-geometry';

	/** All 8 resize handle positions (compass directions). */
	const RESIZE_HANDLES: ResizeHandle[] = ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'];

	/** Cursor for a resize handle: matches the resize (drag) direction in screen space after rotation. */
	function getResizeCursor(handle: ResizeHandle, rotationDeg: number): string {
		const rad = (rotationDeg * Math.PI) / 180;
		const cos = Math.cos(rad);
		const sin = Math.sin(rad);
		const rotate = (x: number, y: number) => ({ x: x * cos - y * sin, y: x * sin + y * cos });
		let angleDeg: number;
		switch (handle) {
			case 'n':
			case 's':
				{ const p = rotate(0, 1); angleDeg = (Math.atan2(p.y, p.x) * 180) / Math.PI; break; }
			case 'e':
			case 'w':
				{ const p = rotate(1, 0); angleDeg = (Math.atan2(p.y, p.x) * 180) / Math.PI; break; }
			case 'nw':
			case 'se':
				{ const p = rotate(1, 1); angleDeg = (Math.atan2(p.y, p.x) * 180) / Math.PI; break; }
			default:
				{ const p = rotate(1, -1); angleDeg = (Math.atan2(p.y, p.x) * 180) / Math.PI; break; }
		}
		angleDeg = ((angleDeg % 360) + 360) % 360;
		const step = 45;
		const a = Math.round(angleDeg / step) * step % 360;
		if (a === 0 || a === 180) return 'ew-resize';
		if (a === 90 || a === 270) return 'ns-resize';
		if (a === 45 || a === 225) return 'nwse-resize';
		return 'nesw-resize';
	}

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
		/** Whether the eraser is actively pressed down (erasing right now). */
		isErasing: boolean;
		stageWidth: number;
		stageHeight: number;
		elements: BoardElement[];
		selectedElementIds: string[];
		selectedSingleElement: BoardElement | null;
		editingElementId: string | null;
		marquee: MarqueeRect | null;
		selectedGroupBoxes: GroupBox[];
		/** Combined bounds of selection (elements + strokes) for group resize. */
		selectionBounds: Bounds | null;
		/** Show one selection bbox with resize handles (multi-element or any strokes). */
		showSelectionBbox: boolean;
		/** Rotation (degrees) applied to selection bbox during rotate-group drag. */
		selectionBboxRotation?: number;
		/** Bounds used to draw the selection bbox (frozen during rotate to avoid distortion). */
		selectionBboxBounds?: Bounds | { x: number; y: number; width: number; height: number } | null;
		guideLines: GuideLine[];
		guideDistances: GuideDistance[];
		onPointerDown: (e: PointerEvent) => void;
		onPointerMove: (e: PointerEvent) => void;
		onPointerUp: (e: PointerEvent) => void;
		onPointerLeave?: () => void;
		onDblClickElement: (id: string) => void;
		onBeginResize: (e: PointerEvent, id: string, handle: ResizeHandle) => void;
		onBeginResizeGroup: (e: PointerEvent, handle: ResizeHandle) => void;
		onBeginDragGroup: (e: PointerEvent) => void;
		onBeginRotate: (e: PointerEvent, id: string) => void;
		onBeginRotateGroup: (e: PointerEvent) => void;
		onElementTextChange: (id: string, text: string) => void;
		onElementTextBlur: () => void;
		gridEnabled: boolean;
		gridSize: number;
		/** When true, show connection anchors on all connectable shapes (not on hover). */
		showConnectorAnchors: boolean;
		/** Connector tool: first anchor chosen, show preview to mouse */
		pendingConnector: { startElementId: string; startAnchor: string } | null;
		connectorPreviewEnd: Point | null;
		/** Right-click context menu (e.g. Save to Library). Caller should preventDefault when needed. */
		onContextMenu?: (e: MouseEvent) => void;
		/** When true, show placement cursor (e.g. after picking from library). */
		pendingLibraryPlacement?: boolean;
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
		isErasing,
		stageWidth,
		stageHeight,
		elements,
		selectedElementIds,
		selectedSingleElement,
		editingElementId,
		marquee,
		selectedGroupBoxes,
		selectionBounds = null,
		showSelectionBbox = false,
		selectionBboxRotation = 0,
		selectionBboxBounds = null,
		guideLines,
		guideDistances,
		onPointerDown,
		onPointerMove,
		onPointerUp,
		onPointerLeave,
		onDblClickElement,
		onBeginResize,
		onBeginResizeGroup,
		onBeginDragGroup,
		onBeginRotate,
		onBeginRotateGroup,
		onElementTextChange,
		onElementTextBlur,
		showConnectorAnchors = false,
		pendingConnector = null,
		connectorPreviewEnd = null,
		onContextMenu,
		pendingLibraryPlacement = false
	}: Props = $props();

	/* ── Internal eraser cursor tracking ── */
	let eraserPos = $state<{ x: number; y: number } | null>(null);

	function handlePointerMove(event: PointerEvent) {
		const wrap = wrapRef;
		const rect = wrap?.getBoundingClientRect();
		if (rect) {
			const stageX = event.clientX - rect.left + (wrap?.scrollLeft ?? 0);
			const stageY = event.clientY - rect.top + (wrap?.scrollTop ?? 0);
			if (activeTool === 'eraser' || activeTool === 'eraser-multi') {
				eraserPos = { x: stageX, y: stageY };
			} else {
				eraserPos = null;
			}
		}
		onPointerMove(event);
	}

	function handlePointerLeave() {
		eraserPos = null;
		onPointerLeave?.();
	}

	/* ── Auto-focus action for textarea (preventScroll for tablet: avoid page scroll on focus) ── */
	function autoFocus(node: HTMLTextAreaElement) {
		requestAnimationFrame(() => node.focus({ preventScroll: true }));
	}

	/** Check if an element type supports text editing */
	function supportsText(type: BoardElement['type']): boolean {
		return TEXT_EDITABLE_TYPES.includes(type);
	}
</script>

<section class="stage-wrap scrollbar-theme" bind:this={wrapRef}>
	<section
		class="board-stage"
		class:eraser-active={activeTool === 'eraser' || activeTool === 'eraser-multi'}
		class:cursor-place={pendingLibraryPlacement}
		class:cursor-pen={activeTool === 'pen' && !pendingLibraryPlacement}
		class:cursor-rect={activeTool === 'rect'}
		class:cursor-ellipse={activeTool === 'ellipse'}
		class:cursor-triangle={activeTool === 'triangle'}
		class:cursor-line-h={activeTool === 'line-h'}
		class:cursor-line-v={activeTool === 'line-v'}
		class:cursor-text={activeTool === 'text'}
		class:cursor-image={activeTool === 'image'}
		bind:this={stageRef}
		style={`--theme-bg:${themeBackground};--grid-color:${gridEnabled ? themeGridColor : 'transparent'};--grid-size:${gridSize}px;min-width:${stageWidth}px;min-height:${stageHeight}px;`}
		onpointerdown={onPointerDown}
		onpointermove={handlePointerMove}
		onpointerup={onPointerUp}
		onpointercancel={onPointerUp}
		onpointerleave={handlePointerLeave}
		oncontextmenu={(e) => { e.preventDefault(); onContextMenu?.(e); }}
		role="application"
		aria-label="Drawing board"
	>
		<canvas bind:this={drawCanvas}></canvas>

		<!-- Connector anchors: shown on all connectables when showConnectorAnchors is on -->
		{#if (activeTool === 'select' || activeTool === 'connector') && showConnectorAnchors}
			<div class="connector-anchors" style="width:{stageWidth}px;height:{stageHeight}px;">
				{#each elements.filter((e) => CONNECTABLE_TYPES.includes(e.type)) as connectableEl (connectableEl.id)}
					{#each getAnchorPoints(connectableEl) as anchor (anchor.anchorId)}
						<button
							type="button"
							class="connector-anchor-dot"
							style="left:{anchor.x - 12}px;top:{anchor.y - 12}px;"
							data-element-id={connectableEl.id}
							data-anchor-id={anchor.anchorId}
							title="Connect here"
						><span class="connector-anchor-dot-visual"></span></button>
					{/each}
				{/each}
			</div>
		{/if}

		<!-- Connector lines (SVG layer; hit area per connector for selection) -->
		<svg
			class="connector-layer"
			width={stageWidth}
			height={stageHeight}
			aria-hidden="true"
		>
			{#each elements.filter((e) => e.type === 'connector') as connector (connector.id)}
				{@const pathData = getConnectorPath(connector, elements)}
				{@const hasArrows = (connector.startArrow === 'arrow' || connector.endArrow === 'arrow') && pathData?.arrowAt1 && pathData?.arrowAt2}
				{@const arrowSize = connector.connectorArrowSize ?? 10}
				{@const startMarkerId = connector.startArrow === 'arrow' ? (connector.startArrowDirection && connector.startArrowDirection !== 'auto' ? `arrow-start-${connector.startArrowDirection}-${connector.id}` : `arrow-start-${connector.id}`) : ''}
				{@const endMarkerId = connector.endArrow === 'arrow' ? (connector.endArrowDirection && connector.endArrowDirection !== 'auto' ? `arrow-end-${connector.endArrowDirection}-${connector.id}` : `arrow-end-${connector.id}`) : ''}
				{#if pathData}
					{@const connectorSelected = selectedElementIds.includes(connector.id)}
					{@const connectorStroke = connectorSelected ? '#2563eb' : connector.strokeColor}
					<g class="connector-group" style="color: {connector.strokeColor}">
						{#if hasArrows}
							{@const scale = arrowSize / 10}
							{@const refY = arrowSize * 0.4}
							<defs>
								<marker id="arrow-start-{connector.id}" markerWidth={arrowSize} markerHeight={arrowSize * 0.8} refX={arrowSize} refY={refY} orient="auto" markerUnits="userSpaceOnUse"><polygon points="10 0, 0 4, 10 8" fill={connectorStroke} transform="scale({scale})" /></marker>
								<marker id="arrow-start-n-{connector.id}" markerWidth={arrowSize} markerHeight={arrowSize * 0.8} refX={arrowSize} refY={refY} orient="270" markerUnits="userSpaceOnUse"><polygon points="10 0, 0 4, 10 8" fill={connectorStroke} transform="scale({scale})" /></marker>
								<marker id="arrow-start-s-{connector.id}" markerWidth={arrowSize} markerHeight={arrowSize * 0.8} refX={arrowSize} refY={refY} orient="90" markerUnits="userSpaceOnUse"><polygon points="10 0, 0 4, 10 8" fill={connectorStroke} transform="scale({scale})" /></marker>
								<marker id="arrow-start-e-{connector.id}" markerWidth={arrowSize} markerHeight={arrowSize * 0.8} refX={arrowSize} refY={refY} orient="0" markerUnits="userSpaceOnUse"><polygon points="10 0, 0 4, 10 8" fill={connectorStroke} transform="scale({scale})" /></marker>
								<marker id="arrow-start-w-{connector.id}" markerWidth={arrowSize} markerHeight={arrowSize * 0.8} refX={arrowSize} refY={refY} orient="180" markerUnits="userSpaceOnUse"><polygon points="10 0, 0 4, 10 8" fill={connectorStroke} transform="scale({scale})" /></marker>
								<marker id="arrow-end-{connector.id}" markerWidth={arrowSize} markerHeight={arrowSize * 0.8} refX={0} refY={refY} orient="auto" markerUnits="userSpaceOnUse"><polygon points="0 0, 10 4, 0 8" fill={connectorStroke} transform="scale({scale})" /></marker>
								<marker id="arrow-end-n-{connector.id}" markerWidth={arrowSize} markerHeight={arrowSize * 0.8} refX={0} refY={refY} orient="270" markerUnits="userSpaceOnUse"><polygon points="0 0, 10 4, 0 8" fill={connectorStroke} transform="scale({scale})" /></marker>
								<marker id="arrow-end-s-{connector.id}" markerWidth={arrowSize} markerHeight={arrowSize * 0.8} refX={0} refY={refY} orient="90" markerUnits="userSpaceOnUse"><polygon points="0 0, 10 4, 0 8" fill={connectorStroke} transform="scale({scale})" /></marker>
								<marker id="arrow-end-e-{connector.id}" markerWidth={arrowSize} markerHeight={arrowSize * 0.8} refX={0} refY={refY} orient="0" markerUnits="userSpaceOnUse"><polygon points="0 0, 10 4, 0 8" fill={connectorStroke} transform="scale({scale})" /></marker>
								<marker id="arrow-end-w-{connector.id}" markerWidth={arrowSize} markerHeight={arrowSize * 0.8} refX={0} refY={refY} orient="180" markerUnits="userSpaceOnUse"><polygon points="0 0, 10 4, 0 8" fill={connectorStroke} transform="scale({scale})" /></marker>
							</defs>
						{/if}
						{#if connector.connectorStyle === 'double'}
							<path
								class="connector-path double-line"
								class:selected={selectedElementIds.includes(connector.id)}
								style="--connector-stroke: {connector.strokeColor}"
								d={pathData.path}
								stroke={connector.strokeColor}
								stroke-width={Math.max(1, (connector.borderWidth ?? 2) / 2)}
								stroke-linecap="round"
								stroke-linejoin="round"
								fill="none"
								transform="translate(-1,0)"
							/>
							<path
								class="connector-path double-line"
								class:selected={selectedElementIds.includes(connector.id)}
								style="--connector-stroke: {connector.strokeColor}"
								d={pathData.path}
								stroke={connector.strokeColor}
								stroke-width={Math.max(1, (connector.borderWidth ?? 2) / 2)}
								stroke-linecap="round"
								stroke-linejoin="round"
								fill="none"
								transform="translate(1,0)"
							/>
						{:else}
							<path
								class="connector-path"
								class:selected={selectedElementIds.includes(connector.id)}
								style="--connector-stroke: {connector.strokeColor}"
								d={pathData.path}
								stroke={connector.strokeColor}
								stroke-width={connector.borderWidth ?? 2}
								stroke-linecap="round"
								stroke-linejoin="round"
								fill="none"
								stroke-dasharray={connector.connectorStyle === 'dashed' ? '6 4' : ''}
							></path>
						{/if}
						{#if hasArrows && pathData.arrowAt1 && pathData.arrowAt2}
							{@const a1 = pathData.arrowAt1}
							{@const a2 = pathData.arrowAt2}
							<!-- a1 at 1/7 (near start) = start arrow; a2 at 6/7 (near end) = end arrow. Markers only (no stroke). -->
							{#if connector.connectorStyle === 'double'}
								<path class="connector-arrow-segment" d="M {a1.x} {a1.y} L {pathData.start.x} {pathData.start.y}" stroke="none" fill="none" transform="translate(-1,0)" marker-start={startMarkerId ? `url(#${startMarkerId})` : ''} />
								<path class="connector-arrow-segment" d="M {a1.x} {a1.y} L {pathData.start.x} {pathData.start.y}" stroke="none" fill="none" transform="translate(1,0)" marker-start={startMarkerId ? `url(#${startMarkerId})` : ''} />
								<path class="connector-arrow-segment" d="M {a2.x} {a2.y} L {pathData.end.x} {pathData.end.y}" stroke="none" fill="none" transform="translate(-1,0)" marker-start={endMarkerId ? `url(#${endMarkerId})` : ''} />
								<path class="connector-arrow-segment" d="M {a2.x} {a2.y} L {pathData.end.x} {pathData.end.y}" stroke="none" fill="none" transform="translate(1,0)" marker-start={endMarkerId ? `url(#${endMarkerId})` : ''} />
							{:else}
								<path class="connector-arrow-segment" d="M {a1.x} {a1.y} L {pathData.start.x} {pathData.start.y}" stroke="none" fill="none" marker-start={startMarkerId ? `url(#${startMarkerId})` : ''} />
								<path class="connector-arrow-segment" d="M {a2.x} {a2.y} L {pathData.end.x} {pathData.end.y}" stroke="none" fill="none" marker-start={endMarkerId ? `url(#${endMarkerId})` : ''} />
							{/if}
						{/if}
						<rect
							class="connector-hit"
							data-element-id={connector.id}
							x={pathData.bounds.x}
							y={pathData.bounds.y}
							width={pathData.bounds.width}
							height={pathData.bounds.height}
							fill="transparent"
						/>
						{#if pathData.bendPoint && selectedElementIds.includes(connector.id)}
							<circle
								class="connector-bend-handle"
								data-connector-bend
								data-connector-id={connector.id}
								cx={pathData.bendPoint.x}
								cy={pathData.bendPoint.y}
								r="6"
								fill="#2563eb"
								stroke="#fff"
								stroke-width="2"
							/>
						{/if}
					</g>
				{/if}
			{/each}
		</svg>

		{#each elements as element (element.id)}
			{#if element.type === 'connector'}
				<!-- Connectors rendered in SVG layer above -->
			{:else}
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
						<span>Double-click to select an image file</span>
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
							{element.text || (element.type === 'text' ? 'Double-click to enter text' : '')}
						</div>
					{/if}
				{/if}

			{#if isSingleSelected && !showSelectionBbox}
				<!-- 8-point resize handles (rotation handle is rendered in overlay layer on top); cursor matches rotated edge -->
				{#each RESIZE_HANDLES as handle (handle)}
					<button
						type="button"
						class={`resize-handle handle-${handle}`}
						style="cursor: {getResizeCursor(handle, element.rotation ?? 0)}"
						onpointerdown={(event) => onBeginResize(event, element.id, handle)}
						aria-label={`Resize (${handle})`}
					></button>
				{/each}
			{/if}
			</div>
			{/if}
		{/each}

		<!-- Rotation handle overlay: always on top; position follows element rotation -->
		{#if selectedSingleElement && !showSelectionBbox}
			{@const cx = selectedSingleElement.x + selectedSingleElement.width / 2}
			{@const cy = selectedSingleElement.y + selectedSingleElement.height / 2}
			{@const rad = (selectedSingleElement.rotation ?? 0) * Math.PI / 180}
			{@const dist = 30 + selectedSingleElement.height / 2}
			{@const hx = cx + dist * Math.sin(rad)}
			{@const hy = cy - dist * Math.cos(rad)}
			<div class="rotate-handle-overlay" role="presentation">
				<button
					type="button"
					class="rotate-handle"
					style={`left:${hx - 11}px;top:${hy}px;`}
					onpointerdown={(e) => onBeginRotate(e, selectedSingleElement.id)}
					aria-label="Rotate element"
				>↻</button>
			</div>
		{/if}

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

		{#if showSelectionBbox && (selectionBboxBounds ?? selectionBounds)}
			{@const bbox = selectionBboxBounds ?? selectionBounds}
			{#if bbox}
			<div
				class="selection-bbox"
				style={`left:${bbox.x - 6}px;top:${bbox.y - 6}px;width:${bbox.width + 12}px;height:${bbox.height + 12}px;transform-origin:50% 50%;transform:rotate(${selectionBboxRotation}deg);`}
			>
				<div
					class="selection-bbox-inner"
					style={`width:${bbox.width}px;height:${bbox.height}px;`}
				>
					<!-- Drag area: move entire selection (behind handles so handles get priority) -->
					<div
						class="selection-bbox-drag"
						role="button"
						tabindex="0"
						aria-label="Drag selection"
						onpointerdown={(e) => { e.stopPropagation(); onBeginDragGroup(e); }}
					></div>
					<!-- Rotate selection (above center) -->
					<button
						type="button"
						class="rotate-handle selection-bbox-rotate"
						onpointerdown={(e) => { e.stopPropagation(); onBeginRotateGroup(e); }}
						aria-label="Rotate selection"
					>↻</button>
					{#each RESIZE_HANDLES as handle (handle)}
						<button
							type="button"
							class="resize-handle handle-{handle}"
							style="cursor: {getResizeCursor(handle, selectionBboxRotation ?? 0)}"
							onpointerdown={(e) => onBeginResizeGroup(e, handle)}
							aria-label="Resize selection"
						></button>
					{/each}
				</div>
			</div>
			{/if}
		{/if}

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

		<!-- Eraser cursor: centred on the pointer; style differs by default vs multi mode -->
		{#if (activeTool === 'eraser' || activeTool === 'eraser-multi') && eraserPos}
			<div
				class="eraser-cursor"
				class:active={isErasing}
				class:multi={activeTool === 'eraser-multi'}
				style={`left:${eraserPos.x}px;top:${eraserPos.y}px;width:${eraserSize}px;height:${eraserSize}px;`}
			>
				{#if !isErasing}
					{#if activeTool === 'eraser-multi'}
						<!-- Multi: clear-all / wipe icon -->
						<svg class="eraser-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
							<line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
						</svg>
					{:else}
						<!-- Default: precise eraser icon -->
						<svg class="eraser-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M20 20H7L3 16c-.8-.8-.8-2 0-2.8l10-10c.8-.8 2-.8 2.8 0l5.7 5.7c.8.8.8 2 0 2.8L14 19"/>
						</svg>
					{/if}
				{/if}
			</div>
		{/if}

		<!-- Connector preview line: on top of everything so it’s not hidden by shapes -->
		{#if pendingConnector && connectorPreviewEnd}
			{@const startEl = elements.find((e) => e.id === pendingConnector.startElementId)}
			{#if startEl}
				{@const startPt = getAnchorPosition(startEl, pendingConnector.startAnchor, elements)}
				{#if startPt}
					<svg class="connector-preview-layer" width={stageWidth} height={stageHeight} aria-hidden="true">
						<path
							class="connector-preview"
							d="M {startPt.x} {startPt.y} L {connectorPreviewEnd.x} {connectorPreviewEnd.y}"
							stroke="#2563eb"
							stroke-width="2"
							stroke-dasharray="6 4"
							stroke-linecap="round"
							fill="none"
						/>
					</svg>
				{/if}
			{/if}
		{/if}
	</section>
</section>

<style>
	.stage-wrap {
		position: relative;
		width: 100%;
		height: 100%;
		min-height: 0;
		min-width: 0;
		overflow: auto;
		background: #f8fafc;
	}

	.board-stage {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
		touch-action: manipulation; /* tablet: no double-tap zoom, stable touch for drawing */
		background:
			repeating-linear-gradient(0deg, var(--grid-color) 0 1px, transparent 1px var(--grid-size)),
			repeating-linear-gradient(90deg, var(--grid-color) 0 1px, transparent 1px var(--grid-size)),
			var(--theme-bg);
	}

	.board-stage.eraser-active {
		cursor: none;
	}

	/* Propagate cursor:none to every descendant while eraser is active so child
	   elements (handles, text boxes, etc.) don't show the native cursor and
	   reveal a visual mismatch with the eraser circle. */
	.board-stage.eraser-active * {
		cursor: none !important;
	}

	/* Tool cursors: 32×32, white outline + dark fill for visibility on any background */
	.board-stage.cursor-place {
		cursor: crosshair;
	}
	.board-stage.cursor-pen {
		cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Cpath fill='none' stroke='%23fff' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round' d='M20 4l8 8-14 14h-4l2-4 8-8'/%3E%3Cpath fill='none' stroke='%231e293b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' d='M20 4l8 8-14 14h-4l2-4 8-8'/%3E%3C/svg%3E") 10 28, crosshair;
	}
	.board-stage.cursor-rect {
		cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Crect x='6' y='6' width='20' height='20' rx='2' fill='none' stroke='%23fff' stroke-width='3.5'/%3E%3Crect x='6' y='6' width='20' height='20' rx='2' fill='none' stroke='%231e293b' stroke-width='2'/%3E%3C/svg%3E") 16 16, crosshair;
	}
	.board-stage.cursor-ellipse {
		cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='9' fill='none' stroke='%23fff' stroke-width='3.5'/%3E%3Ccircle cx='16' cy='16' r='9' fill='none' stroke='%231e293b' stroke-width='2'/%3E%3C/svg%3E") 16 16, crosshair;
	}
	.board-stage.cursor-triangle {
		cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Cpath fill='none' stroke='%23fff' stroke-width='3.5' stroke-linejoin='round' d='M16 6L28 26H4z'/%3E%3Cpath fill='none' stroke='%231e293b' stroke-width='2' stroke-linejoin='round' d='M16 6L28 26H4z'/%3E%3C/svg%3E") 16 16, crosshair;
	}
	.board-stage.cursor-line-h {
		cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Cline x1='4' y1='16' x2='28' y2='16' stroke='%23fff' stroke-width='4' stroke-linecap='round'/%3E%3Cline x1='4' y1='16' x2='28' y2='16' stroke='%231e293b' stroke-width='2.5' stroke-linecap='round'/%3E%3C/svg%3E") 16 16, crosshair;
	}
	.board-stage.cursor-line-v {
		cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Cline x1='16' y1='4' x2='16' y2='28' stroke='%23fff' stroke-width='4' stroke-linecap='round'/%3E%3Cline x1='16' y1='4' x2='16' y2='28' stroke='%231e293b' stroke-width='2.5' stroke-linecap='round'/%3E%3C/svg%3E") 16 16, crosshair;
	}
	.board-stage.cursor-text {
		cursor: text;
	}
	.board-stage.cursor-image {
		cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Crect x='4' y='4' width='24' height='24' rx='3' fill='none' stroke='%23fff' stroke-width='3.5'/%3E%3Crect x='4' y='4' width='24' height='24' rx='3' fill='none' stroke='%231e293b' stroke-width='2'/%3E%3Ccircle cx='11' cy='11' r='2.5' fill='none' stroke='%23fff' stroke-width='2'/%3E%3Ccircle cx='11' cy='11' r='2.5' fill='none' stroke='%231e293b' stroke-width='1.2'/%3E%3Cpath d='M4 24l8-8 6 6 8-12 4 14H4z' fill='none' stroke='%23fff' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath d='M4 24l8-8 6 6 8-12 4 14H4z' fill='none' stroke='%231e293b' stroke-width='1.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") 16 16, crosshair;
	}

	canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}

	.connector-layer {
		position: absolute;
		left: 0;
		top: 0;
		pointer-events: none;
	}
	.connector-layer .connector-hit {
		pointer-events: all;
		cursor: pointer;
	}
	.connector-path.selected {
		stroke: #2563eb;
		filter: drop-shadow(0 0 2px rgba(37, 99, 235, 0.6));
	}
	.connector-preview-layer {
		position: absolute;
		left: 0;
		top: 0;
		pointer-events: none;
		z-index: 25;
	}
	.connector-preview {
		pointer-events: none;
	}
	.connector-bend-handle {
		pointer-events: all;
		cursor: move;
	}

	.connector-anchors {
		position: absolute;
		left: 0;
		top: 0;
		pointer-events: none;
		z-index: 15;
	}
	.connector-anchor-dot {
		position: absolute;
		width: 24px;
		height: 24px;
		padding: 0;
		border: none;
		border-radius: 50%;
		background: transparent;
		cursor: crosshair;
		pointer-events: all;
	}
	.connector-anchor-dot-visual {
		position: absolute;
		inset: 6px;
		border-radius: 50%;
		background: #2563eb;
		border: 2px solid #fff;
		box-shadow: 0 0 0 1px #1d4ed8;
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

	/* ── Image ── (overflow: visible so resize/rotate handles are not clipped, same as shapes) */
	.element.image {
		border: var(--border-w) solid var(--stroke);
		background: #f1f5f9;
		overflow: visible;
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
		width: 10px;
		height: 10px;
		border-radius: 2px;
		background: #2563eb;
		border: 2px solid #fff;
		z-index: 6;
		padding: 0;
		/* prevent the handle click from bubbling to the element */
	}

	/* Corner handles */
	.handle-nw { top: -5px;  left: -5px;              cursor: nwse-resize; }
	.handle-ne { top: -5px;  right: -5px;              cursor: nesw-resize; }
	.handle-sw { bottom: -5px; left: -5px;             cursor: nesw-resize; }
	.handle-se { bottom: -5px; right: -5px;            cursor: nwse-resize; }

	/* Edge handles (centred on each side) */
	.handle-n  { top: -5px;    left: calc(50% - 5px); cursor: ns-resize; }
	.handle-s  { bottom: -5px; left: calc(50% - 5px); cursor: ns-resize; }
	.handle-w  { left: -5px;   top: calc(50% - 5px);  cursor: ew-resize; }
	.handle-e  { right: -5px;  top: calc(50% - 5px);  cursor: ew-resize; }

	.rotate-handle-overlay {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 20;
	}
	.rotate-handle-overlay .rotate-handle {
		pointer-events: auto;
	}
	.rotate-handle {
		position: absolute;
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

	/* ── Selection bbox (elements + strokes) with resize handles ── */
	.selection-bbox {
		position: absolute;
		border: 1px dashed #2563eb;
		border-radius: 8px;
		background: rgba(37, 99, 235, 0.06);
		z-index: 3;
		pointer-events: none;
	}
	.selection-bbox-inner {
		position: absolute;
		left: 6px;
		top: 6px;
		pointer-events: auto;
	}
	.selection-bbox-drag {
		position: absolute;
		inset: 0;
		cursor: move;
	}
	.selection-bbox .selection-bbox-rotate {
		top: -30px;
		left: 50%;
		transform: translateX(-50%);
	}
	.selection-bbox .resize-handle {
		position: absolute;
		width: 10px;
		height: 10px;
		border-radius: 2px;
		background: #2563eb;
		border: 2px solid #fff;
		z-index: 6;
		padding: 0;
	}
	.selection-bbox .handle-nw { top: -5px;  left: -5px;              cursor: nwse-resize; }
	.selection-bbox .handle-ne { top: -5px;  right: -5px;             cursor: nesw-resize; }
	.selection-bbox .handle-sw { bottom: -5px; left: -5px;            cursor: nesw-resize; }
	.selection-bbox .handle-se { bottom: -5px; right: -5px;            cursor: nwse-resize; }
	.selection-bbox .handle-n  { top: -5px;    left: calc(50% - 5px); cursor: ns-resize; }
	.selection-bbox .handle-s  { bottom: -5px; left: calc(50% - 5px); cursor: ns-resize; }
	.selection-bbox .handle-w  { left: -5px;   top: calc(50% - 5px);  cursor: ew-resize; }
	.selection-bbox .handle-e  { right: -5px;  top: calc(50% - 5px);  cursor: ew-resize; }

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
		transform: translate(-50%, -50%);
		box-sizing: border-box;
		border-radius: 50%;
		pointer-events: none;
		z-index: 10;

		/* Idle state: soft pink glass eraser */
		background: radial-gradient(
			circle at 38% 36%,
			rgba(255, 210, 210, 0.38) 0%,
			rgba(240, 140, 140, 0.18) 60%,
			rgba(220, 90, 90, 0.08) 100%
		);
		border: 1.5px solid rgba(190, 60, 60, 0.5);
		box-shadow:
			0 0 6px rgba(220, 90, 90, 0.12),
			inset 0 1px 4px rgba(255, 255, 255, 0.35);
		color: rgba(180, 60, 60, 0.45);
		transition: background 0.12s, border-color 0.12s, box-shadow 0.12s;

		display: grid;
		place-items: center;
	}

	/* Inner eraser icon scales to ~40% of the cursor size */
	.eraser-cursor .eraser-icon {
		width: 42%;
		height: 42%;
		opacity: 0.5;
	}

	/* Active state (pointer pressed): more vivid + pulsing glow */
	.eraser-cursor.active {
		background: radial-gradient(
			circle at 38% 36%,
			rgba(255, 180, 180, 0.55) 0%,
			rgba(240, 100, 100, 0.32) 60%,
			rgba(200, 60, 60, 0.18) 100%
		);
		border-color: rgba(200, 50, 50, 0.75);
		box-shadow:
			0 0 12px rgba(220, 70, 70, 0.35),
			inset 0 1px 4px rgba(255, 255, 255, 0.25);
	}

	/* Center crosshair dot – always visible for precision */
	.eraser-cursor::after {
		content: '';
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 3px;
		height: 3px;
		border-radius: 50%;
		background: rgba(190, 50, 50, 0.55);
		transition: background 0.12s;
	}

	.eraser-cursor.active::after {
		background: rgba(200, 40, 40, 0.85);
	}

	/* ── Multi eraser: dashed ring, amber/orange tint, trash icon ── */
	.eraser-cursor.multi {
		background: radial-gradient(
			circle at 38% 36%,
			rgba(255, 220, 160, 0.35) 0%,
			rgba(251, 180, 80, 0.2) 60%,
			rgba(220, 130, 50, 0.08) 100%
		);
		border: 1.5px dashed rgba(200, 120, 40, 0.7);
		box-shadow:
			0 0 8px rgba(245, 158, 11, 0.2),
			inset 0 1px 4px rgba(255, 255, 255, 0.3);
		color: rgba(180, 100, 30, 0.6);
	}
	.eraser-cursor.multi::after {
		background: rgba(200, 120, 40, 0.6);
	}
	.eraser-cursor.multi.active {
		background: radial-gradient(
			circle at 38% 36%,
			rgba(255, 200, 120, 0.5) 0%,
			rgba(251, 160, 60, 0.35) 60%,
			rgba(220, 110, 40, 0.2) 100%
		);
		border-color: rgba(220, 120, 40, 0.9);
		box-shadow: 0 0 14px rgba(245, 158, 11, 0.4);
	}
	.eraser-cursor.multi.active::after {
		background: rgba(220, 100, 30, 0.9);
	}
</style>
