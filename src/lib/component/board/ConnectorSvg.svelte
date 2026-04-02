<script lang="ts">
	import type { BoardElement } from '$lib/board-types';
	import { getConnectorPath } from '$lib/connector-geometry';

	interface Props {
		connector: BoardElement;
		elements: BoardElement[];
		selectedElementIds: string[];
		stageWidth: number;
		stageHeight: number;
	}

	let { connector, elements, selectedElementIds, stageWidth, stageHeight }: Props = $props();

	const pathData = $derived(getConnectorPath(connector, elements));
	const hasArrows = $derived(
		(connector.startArrow === 'arrow' || connector.endArrow === 'arrow') &&
			!!pathData?.arrowAt1 &&
			!!pathData?.arrowAt2
	);
	const arrowSize = $derived(connector.connectorArrowSize ?? 10);
	const startMarkerId = $derived(
		connector.startArrow === 'arrow'
			? connector.startArrowDirection && connector.startArrowDirection !== 'auto'
				? `arrow-start-${connector.startArrowDirection}-${connector.id}`
				: `arrow-start-${connector.id}`
			: ''
	);
	const endMarkerId = $derived(
		connector.endArrow === 'arrow'
			? connector.endArrowDirection && connector.endArrowDirection !== 'auto'
				? `arrow-end-${connector.endArrowDirection}-${connector.id}`
				: `arrow-end-${connector.id}`
			: ''
	);
	const connectorSelected = $derived(selectedElementIds.includes(connector.id));
	const connectorStroke = $derived(connectorSelected ? '#2563eb' : connector.strokeColor);
	const scale = $derived(arrowSize / 10);
	const refY = $derived(arrowSize * 0.4);
</script>

<svg class="connector-layer" width={stageWidth} height={stageHeight} aria-hidden="true">
	{#if pathData}
		<g class="connector-group" style="color: {connector.strokeColor}">
			{#if hasArrows}
				<defs>
					<marker
						id="arrow-start-{connector.id}"
						markerWidth={arrowSize}
						markerHeight={arrowSize * 0.8}
						refX={arrowSize}
						refY={refY}
						orient="auto"
						markerUnits="userSpaceOnUse"
						><polygon points="10 0, 0 4, 10 8" fill={connectorStroke} transform="scale({scale})" /></marker
					>
					<marker
						id="arrow-start-n-{connector.id}"
						markerWidth={arrowSize}
						markerHeight={arrowSize * 0.8}
						refX={arrowSize}
						refY={refY}
						orient="270"
						markerUnits="userSpaceOnUse"
						><polygon points="10 0, 0 4, 10 8" fill={connectorStroke} transform="scale({scale})" /></marker
					>
					<marker
						id="arrow-start-s-{connector.id}"
						markerWidth={arrowSize}
						markerHeight={arrowSize * 0.8}
						refX={arrowSize}
						refY={refY}
						orient="90"
						markerUnits="userSpaceOnUse"
						><polygon points="10 0, 0 4, 10 8" fill={connectorStroke} transform="scale({scale})" /></marker
					>
					<marker
						id="arrow-start-e-{connector.id}"
						markerWidth={arrowSize}
						markerHeight={arrowSize * 0.8}
						refX={arrowSize}
						refY={refY}
						orient="0"
						markerUnits="userSpaceOnUse"
						><polygon points="10 0, 0 4, 10 8" fill={connectorStroke} transform="scale({scale})" /></marker
					>
					<marker
						id="arrow-start-w-{connector.id}"
						markerWidth={arrowSize}
						markerHeight={arrowSize * 0.8}
						refX={arrowSize}
						refY={refY}
						orient="180"
						markerUnits="userSpaceOnUse"
						><polygon points="10 0, 0 4, 10 8" fill={connectorStroke} transform="scale({scale})" /></marker
					>
					<marker
						id="arrow-end-{connector.id}"
						markerWidth={arrowSize}
						markerHeight={arrowSize * 0.8}
						refX={0}
						refY={refY}
						orient="auto"
						markerUnits="userSpaceOnUse"
						><polygon points="0 0, 10 4, 0 8" fill={connectorStroke} transform="scale({scale})" /></marker
					>
					<marker
						id="arrow-end-n-{connector.id}"
						markerWidth={arrowSize}
						markerHeight={arrowSize * 0.8}
						refX={0}
						refY={refY}
						orient="270"
						markerUnits="userSpaceOnUse"
						><polygon points="0 0, 10 4, 0 8" fill={connectorStroke} transform="scale({scale})" /></marker
					>
					<marker
						id="arrow-end-s-{connector.id}"
						markerWidth={arrowSize}
						markerHeight={arrowSize * 0.8}
						refX={0}
						refY={refY}
						orient="90"
						markerUnits="userSpaceOnUse"
						><polygon points="0 0, 10 4, 0 8" fill={connectorStroke} transform="scale({scale})" /></marker
					>
					<marker
						id="arrow-end-e-{connector.id}"
						markerWidth={arrowSize}
						markerHeight={arrowSize * 0.8}
						refX={0}
						refY={refY}
						orient="0"
						markerUnits="userSpaceOnUse"
						><polygon points="0 0, 10 4, 0 8" fill={connectorStroke} transform="scale({scale})" /></marker
					>
					<marker
						id="arrow-end-w-{connector.id}"
						markerWidth={arrowSize}
						markerHeight={arrowSize * 0.8}
						refX={0}
						refY={refY}
						orient="180"
						markerUnits="userSpaceOnUse"
						><polygon points="0 0, 10 4, 0 8" fill={connectorStroke} transform="scale({scale})" /></marker
					>
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
				{#if connector.connectorStyle === 'double'}
					<path
						class="connector-arrow-segment"
						d="M {pathData.arrowAt1.x} {pathData.arrowAt1.y} L {pathData.start.x} {pathData.start.y}"
						stroke="none"
						fill="none"
						transform="translate(-1,0)"
						marker-start={startMarkerId ? `url(#${startMarkerId})` : ''}
					/>
					<path
						class="connector-arrow-segment"
						d="M {pathData.arrowAt1.x} {pathData.arrowAt1.y} L {pathData.start.x} {pathData.start.y}"
						stroke="none"
						fill="none"
						transform="translate(1,0)"
						marker-start={startMarkerId ? `url(#${startMarkerId})` : ''}
					/>
					<path
						class="connector-arrow-segment"
						d="M {pathData.arrowAt2.x} {pathData.arrowAt2.y} L {pathData.end.x} {pathData.end.y}"
						stroke="none"
						fill="none"
						transform="translate(-1,0)"
						marker-start={endMarkerId ? `url(#${endMarkerId})` : ''}
					/>
					<path
						class="connector-arrow-segment"
						d="M {pathData.arrowAt2.x} {pathData.arrowAt2.y} L {pathData.end.x} {pathData.end.y}"
						stroke="none"
						fill="none"
						transform="translate(1,0)"
						marker-start={endMarkerId ? `url(#${endMarkerId})` : ''}
					/>
				{:else}
					<path
						class="connector-arrow-segment"
						d="M {pathData.arrowAt1.x} {pathData.arrowAt1.y} L {pathData.start.x} {pathData.start.y}"
						stroke="none"
						fill="none"
						marker-start={startMarkerId ? `url(#${startMarkerId})` : ''}
					/>
					<path
						class="connector-arrow-segment"
						d="M {pathData.arrowAt2.x} {pathData.arrowAt2.y} L {pathData.end.x} {pathData.end.y}"
						stroke="none"
						fill="none"
						marker-start={endMarkerId ? `url(#${endMarkerId})` : ''}
					/>
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
</svg>
