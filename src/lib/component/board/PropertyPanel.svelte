<script lang="ts">
	import {
		BOARD_THEMES,
		type AlignMode,
		type BoardElement,
		type ConnectorArrow,
		type ConnectorArrowDirection,
		type ConnectorStyle,
		type ConnectorType,
		type DistributeMode,
		type DrawingTool,
		type TextAlign,
		type TextVerticalAlign,
		type ThemeId
	} from '$lib/board-types';

	interface Props {
		penColor: string;
		fillColor: string;
		penSize: number;
		eraserSize: number;
		borderWidth: number;
		fontSize: number;
		snapThreshold: number;
		themeId: ThemeId;
		activeTool: DrawingTool;
		stageWidth: number;
		stageHeight: number;
		selectedElementIds: string[];
		selectedElements: BoardElement[];
		isTextAlignVisible: boolean;
		canGroup: boolean;
		canUngroup: boolean;
		canDistribute: boolean;
		onThemeChange: () => void;
		onDuplicate: () => void;
		onDelete: () => void;
		onGroup: () => void;
		onUngroup: () => void;
		onAlign: (mode: AlignMode) => void;
		onDistribute: (mode: DistributeMode) => void;
		onTextAlign: (align: TextAlign) => void;
		onTextVerticalAlign: (align: TextVerticalAlign) => void;
		onPenColorChange: (color: string) => void;
		onFillColorChange: (color: string) => void;
		onBorderWidthChange: (w: number) => void;
		onFontSizeChange: (size: number) => void;
		onImageUpload: (dataUrl: string) => void;
		onExpandBoard: (dir: 'top' | 'bottom' | 'left' | 'right', amount: number) => void;
		gridEnabled: boolean;
		gridSize: number;
		onGridEnabledChange: (v: boolean) => void;
		onGridSizeChange: (v: number) => void;
		connectorStyle: ConnectorStyle;
		connectorType: ConnectorType;
		startArrow: ConnectorArrow;
		endArrow: ConnectorArrow;
		startArrowDirection: ConnectorArrowDirection;
		endArrowDirection: ConnectorArrowDirection;
		onConnectorStyleChange: (v: ConnectorStyle) => void;
		onConnectorTypeChange: (v: ConnectorType) => void;
		onStartArrowChange: (v: ConnectorArrow) => void;
		onEndArrowChange: (v: ConnectorArrow) => void;
		onStartArrowDirectionChange: (v: ConnectorArrowDirection) => void;
		onEndArrowDirectionChange: (v: ConnectorArrowDirection) => void;
		connectorArrowSize: number;
		onConnectorArrowSizeChange: (v: number) => void;
	}

	let {
		penColor = $bindable('#111827'),
		fillColor = $bindable('#ffffff'),
		penSize = $bindable(3),
		eraserSize = $bindable(24),
		borderWidth = $bindable(2),
		fontSize = $bindable(18),
		snapThreshold = $bindable(8),
		themeId = $bindable<ThemeId>('whiteboard'),
		activeTool,
		stageWidth,
		stageHeight,
		selectedElementIds,
		selectedElements,
		isTextAlignVisible,
		canGroup,
		canUngroup,
		canDistribute,
		onThemeChange,
		onDuplicate,
		onDelete,
		onGroup,
		onUngroup,
		onAlign,
		onDistribute,
		onTextAlign,
		onTextVerticalAlign,
		onPenColorChange,
		onFillColorChange,
		onBorderWidthChange,
		onFontSizeChange,
		onImageUpload,
		onExpandBoard,
		gridEnabled,
		gridSize,
		onGridEnabledChange,
		onGridSizeChange,
		connectorStyle = 'solid',
		connectorType = 'orthogonal',
		startArrow = 'none',
		endArrow = 'arrow',
		startArrowDirection = 'auto',
		endArrowDirection = 'auto',
		onConnectorStyleChange,
		onConnectorTypeChange,
		onStartArrowChange,
		onEndArrowChange,
		onStartArrowDirectionChange,
		onEndArrowDirectionChange,
		connectorArrowSize = 10,
		onConnectorArrowSizeChange
	}: Props = $props();

	const singleElement = $derived(
		selectedElementIds.length === 1
			? selectedElements.find((el) => el.id === selectedElementIds[0])
			: null
	);

	const showConnectorSection = $derived(singleElement?.type === 'connector');

	/* Hidden input refs for custom color swatches */
	let strokeColorRef = $state<HTMLInputElement | null>(null);
	let fillColorRef = $state<HTMLInputElement | null>(null);
	let imageFileRef = $state<HTMLInputElement | null>(null);

	const TEXT_TYPES = ['rect', 'ellipse', 'text'];

	const handleImageFileChange = (e: Event) => {
		const file = (e.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = (ev) => {
			const result = ev.target?.result as string;
			if (result) onImageUpload(result);
		};
		reader.readAsDataURL(file);
		/* Reset the input so the same file can be re-selected */
		(e.currentTarget as HTMLInputElement).value = '';
	};
</script>

<aside class="property-panel scrollbar-theme">
	<!-- ─── Color section ─── -->
	<div class="section">
		<div class="section-title">
			<!-- prettier-ignore -->
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
			Color
		</div>
		<div class="color-row">
			<button
				type="button"
				class="swatch"
				title="Stroke color"
				style="background:{penColor}"
				onclick={() => strokeColorRef?.click()}
			></button>
			<span class="color-label">Stroke</span>
			<input
				type="color"
				class="hidden-color"
				bind:this={strokeColorRef}
				value={penColor}
				oninput={(e) => {
					const v = (e.currentTarget as HTMLInputElement).value;
					penColor = v;
					onPenColorChange(v);
				}}
			/>

			<button
				type="button"
				class="swatch"
				title="Fill color"
				style="background:{fillColor};{fillColor === 'transparent' ? 'background-image:linear-gradient(45deg,#ccc 25%,transparent 25%,transparent 75%,#ccc 75%),linear-gradient(45deg,#ccc 25%,transparent 25%,transparent 75%,#ccc 75%);background-size:8px 8px;background-position:0 0,4px 4px;' : ''}"
				onclick={() => fillColorRef?.click()}
			></button>
			<span class="color-label">Fill</span>
			<input
				type="color"
				class="hidden-color"
				bind:this={fillColorRef}
				value={fillColor === 'transparent' ? '#ffffff' : fillColor}
				oninput={(e) => {
					const v = (e.currentTarget as HTMLInputElement).value;
					fillColor = v;
					onFillColorChange(v);
				}}
			/>
		</div>
	</div>

	<!-- ─── Border width ─── -->
	<div class="section">
		<div class="section-title">
			<!-- prettier-ignore -->
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
			Border <span class="badge">{borderWidth}px</span>
		</div>
		<input
			type="range"
			min="0"
			max="12"
			bind:value={borderWidth}
			oninput={() => onBorderWidthChange(borderWidth)}
		/>
		{#if singleElement?.type === 'text'}
			<p class="hint-note">Set to 0 to hide the text border</p>
		{/if}
		{#if singleElement?.type === 'connector'}
			<p class="hint-note">Line weight</p>
		{/if}
	</div>

	<!-- ─── Connector: style, type, arrows ─── -->
	{#if showConnectorSection}
		<div class="section">
			<div class="section-title">
				<!-- Line style icon -->
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
				Line style
			</div>
			<div class="connector-options">
				<label class="connector-option-row">
					<span class="connector-option-label">Style</span>
					<select
						class="connector-option-select"
						value={connectorStyle}
						onchange={(e) => onConnectorStyleChange((e.currentTarget as HTMLSelectElement).value as ConnectorStyle)}
					>
						<option value="solid">Solid</option>
						<option value="dashed">Dashed</option>
						<option value="double">Double</option>
					</select>
				</label>
				<label class="connector-option-row">
					<span class="connector-option-label">Arrow size</span>
					<div class="connector-option-right">
						<input
							type="range"
							class="connector-option-range"
							min="6"
							max="24"
							step="1"
							value={connectorArrowSize}
							oninput={(e) => onConnectorArrowSizeChange(Number((e.currentTarget as HTMLInputElement).value))}
						/>
						<span class="connector-option-badge">{connectorArrowSize}</span>
					</div>
				</label>
				<label class="connector-option-row">
					<span class="connector-option-label">
						<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 4 12 12 22 12 12 20 12 12 2"/></svg>
						Start arrow
					</span>
					<select
						class="connector-option-select"
						value={startArrow}
						onchange={(e) => onStartArrowChange((e.currentTarget as HTMLSelectElement).value as ConnectorArrow)}
					>
						<option value="none">None</option>
						<option value="arrow">Arrow</option>
					</select>
				</label>
				{#if startArrow === 'arrow'}
					<label class="connector-option-row connector-option-row-indent">
						<span class="connector-option-label">Direction</span>
						<select
							class="connector-option-select"
							value={startArrowDirection}
							onchange={(e) => onStartArrowDirectionChange((e.currentTarget as HTMLSelectElement).value as ConnectorArrowDirection)}
						>
							<option value="auto">Auto</option>
							<option value="n">North</option>
							<option value="s">South</option>
							<option value="e">East</option>
							<option value="w">West</option>
						</select>
					</label>
				{/if}
				<label class="connector-option-row">
					<span class="connector-option-label">
						<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 20 12 12 22 12 12 4 12 12 2"/></svg>
						End arrow
					</span>
					<select
						class="connector-option-select"
						value={endArrow}
						onchange={(e) => onEndArrowChange((e.currentTarget as HTMLSelectElement).value as ConnectorArrow)}
					>
						<option value="none">None</option>
						<option value="arrow">Arrow</option>
					</select>
				</label>
				{#if endArrow === 'arrow'}
					<label class="connector-option-row connector-option-row-indent">
						<span class="connector-option-label">Direction</span>
						<select
							class="connector-option-select"
							value={endArrowDirection}
							onchange={(e) => onEndArrowDirectionChange((e.currentTarget as HTMLSelectElement).value as ConnectorArrowDirection)}
						>
							<option value="auto">Auto</option>
							<option value="n">North</option>
							<option value="s">South</option>
							<option value="e">East</option>
							<option value="w">West</option>
						</select>
					</label>
				{/if}
			</div>
		</div>
	{/if}

	<!-- ─── Font size (text-editable elements only) ─── -->
	{#if singleElement && TEXT_TYPES.includes(singleElement.type)}
		<div class="section">
			<div class="section-title">
				<!-- prettier-ignore -->
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
				Font Size <span class="badge">{fontSize}px</span>
			</div>
			<input
				type="range"
				min="8"
				max="96"
				step="1"
				bind:value={fontSize}
				oninput={() => onFontSizeChange(fontSize)}
			/>
			<div class="font-size-presets">
				{#each [12, 16, 24, 36, 48] as preset}
					<button
						type="button"
						class="preset-btn {fontSize === preset ? 'active' : ''}"
						onclick={() => { fontSize = preset; onFontSizeChange(preset); }}
					>{preset}</button>
				{/each}
			</div>
		</div>
	{/if}

	<!-- ─── Image upload (image elements only) ─── -->
	{#if singleElement?.type === 'image'}
		<div class="section">
			<div class="section-title">
				<!-- prettier-ignore -->
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
				Image
			</div>
			<button type="button" class="upload-btn" onclick={() => imageFileRef?.click()}>
				<!-- prettier-ignore -->
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
				Import Image
			</button>
			{#if singleElement.imageDataUrl}
				<p class="hint-note">✓ Image loaded</p>
			{:else}
				<p class="hint-note">Select an image using the button above</p>
			{/if}
			<input
				type="file"
				accept="image/*"
				bind:this={imageFileRef}
				class="hidden-color"
				onchange={handleImageFileChange}
			/>
		</div>
	{/if}

	<!-- ─── Pen / Eraser ─── -->
	<div class="section">
		<div class="section-title">
			<!-- prettier-ignore -->
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/></svg>
			Pen Size <span class="badge">{penSize}px</span>
		</div>
		<input type="range" min="1" max="20" bind:value={penSize} />
	</div>

	{#if activeTool === 'eraser'}
		<div class="section">
			<div class="section-title">
				<!-- prettier-ignore -->
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20H7L3 16c-.8-.8-.8-2 0-2.8l10-10c.8-.8 2-.8 2.8 0l5.7 5.7c.8.8.8 2 0 2.8L14 19"/></svg>
		Eraser <span class="badge">{eraserSize}px</span>
		</div>
		<input type="range" min="8" max="80" bind:value={eraserSize} />
		<p class="hint">Drag to erase pen strokes</p>
		</div>
	{/if}

	<!-- ─── Snap ─── -->
	<div class="section">
		<div class="section-title">
			<!-- prettier-ignore -->
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 3H3v18h18V3z"/><path d="M12 3v18"/><path d="M3 12h18"/></svg>
			Snap Threshold <span class="badge">{snapThreshold}px</span>
		</div>
		<input type="range" min="1" max="24" bind:value={snapThreshold} />
		<p class="hint-note">Sensitivity for snapping to guides and elements</p>
	</div>

	<!-- ─── Theme ─── -->
	<div class="section">
		<div class="section-title">
			<!-- prettier-ignore -->
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
			Theme
		</div>
		<select bind:value={themeId} onchange={onThemeChange}>
			{#each BOARD_THEMES as theme}
				<option value={theme.id}>{theme.label}</option>
			{/each}
		</select>
	</div>

	<!-- ─── Grid ─── -->
	<div class="section">
		<div class="section-title">
			<!-- prettier-ignore -->
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
			Grid
		</div>
		<label class="grid-toggle-row">
			<span>Show Grid</span>
			<button
				type="button"
				class="toggle-btn"
				class:active={gridEnabled}
				onclick={() => onGridEnabledChange(!gridEnabled)}
				title={gridEnabled ? 'Hide Grid' : 'Show Grid'}
			>
				<span class="toggle-knob"></span>
			</button>
		</label>
		{#if gridEnabled}
			<div class="grid-size-row">
				<span class="grid-size-label">Spacing <strong>{gridSize}px</strong></span>
				<input
					type="range"
					min="8"
					max="96"
					step="8"
					value={gridSize}
					oninput={(e) => onGridSizeChange(Number(e.currentTarget.value))}
					onchange={(e) => onGridSizeChange(Number(e.currentTarget.value))}
				/>
				<div class="grid-presets">
					<button type="button" class:active={gridSize === 16} onclick={() => onGridSizeChange(16)}>Small</button>
					<button type="button" class:active={gridSize === 32} onclick={() => onGridSizeChange(32)}>Medium</button>
					<button type="button" class:active={gridSize === 64} onclick={() => onGridSizeChange(64)}>Large</button>
				</div>
			</div>
		{/if}
	</div>

	<div class="divider"></div>

	<!-- ─── Selection info ─── -->
	<p class="selection-info">
		Selected: {selectedElementIds.length} item{selectedElementIds.length !== 1 ? 's' : ''}
		<span class="hint-inline">(Shift+Click to multi-select)</span>
	</p>

	{#if singleElement}
		<div class="element-info">
			<span class="badge">{singleElement.type}</span>
			{#if singleElement.rotation !== 0}
				<span class="badge rot">↻ {Math.round(singleElement.rotation)}°</span>
			{/if}
		</div>
	{/if}

	<!-- ─── Action buttons ─── -->
	<div class="action-grid">
		<button
			type="button"
			title="Duplicate selected"
			onclick={onDuplicate}
			disabled={selectedElementIds.length === 0}
		>
			<!-- prettier-ignore -->
			<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
		</button>
		<button
			type="button"
			title="Delete selected"
			onclick={onDelete}
			disabled={selectedElementIds.length === 0}
		>
			<!-- prettier-ignore -->
			<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
		</button>
		<button type="button" title="Group" onclick={onGroup} disabled={!canGroup}>
			<!-- prettier-ignore -->
			<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="8" height="8" rx="1"/><rect x="14" y="14" width="8" height="8" rx="1"/><path d="M6 14v-4h4"/><path d="M18 10v4h-4"/></svg>
		</button>
		<button
			type="button"
			title="Ungroup"
			onclick={onUngroup}
			disabled={!canUngroup}
		>
			<!-- prettier-ignore -->
			<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="8" height="8" rx="1"/><rect x="14" y="14" width="8" height="8" rx="1"/><path d="M7 14l-1 1"/><path d="M17 10l1-1"/></svg>
		</button>
	</div>

	<!-- ─── Align (multi-select) ─── -->
	{#if selectedElementIds.length > 1}
		<div class="sub-section">
		<div class="section-title small">Align</div>
		<div class="action-grid six">
			<button type="button" title="Align Left" onclick={() => onAlign('left')}>
				<!-- prettier-ignore -->
				<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="2" x2="4" y2="22"/><rect x="8" y="6" width="12" height="4" rx="1"/><rect x="8" y="14" width="8" height="4" rx="1"/></svg>
			</button>
			<button type="button" title="Align Center (Horizontal)" onclick={() => onAlign('center')}>
				<!-- prettier-ignore -->
				<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="2" x2="12" y2="22"/><rect x="4" y="6" width="16" height="4" rx="1"/><rect x="6" y="14" width="12" height="4" rx="1"/></svg>
			</button>
			<button type="button" title="Align Right" onclick={() => onAlign('right')}>
				<!-- prettier-ignore -->
				<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="20" y1="2" x2="20" y2="22"/><rect x="4" y="6" width="12" height="4" rx="1"/><rect x="8" y="14" width="8" height="4" rx="1"/></svg>
			</button>
			<button type="button" title="Align Top" onclick={() => onAlign('top')}>
				<!-- prettier-ignore -->
				<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="2" y1="4" x2="22" y2="4"/><rect x="6" y="8" width="4" height="12" rx="1"/><rect x="14" y="8" width="4" height="8" rx="1"/></svg>
			</button>
			<button type="button" title="Align Middle (Vertical)" onclick={() => onAlign('middle')}>
				<!-- prettier-ignore -->
				<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="2" y1="12" x2="22" y2="12"/><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="6" width="4" height="12" rx="1"/></svg>
			</button>
			<button type="button" title="Align Bottom" onclick={() => onAlign('bottom')}>
				<!-- prettier-ignore -->
				<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="2" y1="20" x2="22" y2="20"/><rect x="6" y="4" width="4" height="12" rx="1"/><rect x="14" y="8" width="4" height="8" rx="1"/></svg>
			</button>
		</div>
		</div>
	{/if}

	<!-- ─── Distribute ─── -->
	{#if canDistribute}
		<div class="sub-section">
		<div class="section-title small">Distribute</div>
		<div class="action-grid">
			<button type="button" title="Distribute Horizontally" onclick={() => onDistribute('horizontal')}>
				<!-- prettier-ignore -->
				<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="5" width="4" height="14" rx="1"/><rect x="10" y="7" width="4" height="10" rx="1"/><rect x="16" y="5" width="4" height="14" rx="1"/></svg>
			</button>
			<button type="button" title="Distribute Vertically" onclick={() => onDistribute('vertical')}>
				<!-- prettier-ignore -->
				<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="4" width="14" height="4" rx="1"/><rect x="7" y="10" width="10" height="4" rx="1"/><rect x="5" y="16" width="14" height="4" rx="1"/></svg>
			</button>
		</div>
		</div>
	{/if}

	<!-- ─── Text align ─── -->
	{#if isTextAlignVisible}
		<div class="sub-section">
		<div class="section-title small">Text Horizontal Align</div>
		<div class="text-align-row">
			<button type="button" title="Align Left" onclick={() => onTextAlign('left')}>
				<!-- prettier-ignore -->
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>
			</button>
			<button type="button" title="Align Center" onclick={() => onTextAlign('center')}>
				<!-- prettier-ignore -->
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
			</button>
			<button type="button" title="Align Right" onclick={() => onTextAlign('right')}>
				<!-- prettier-ignore -->
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg>
			</button>
		</div>
	</div>
	<div class="sub-section">
		<div class="section-title small">Text Vertical Align</div>
		<div class="text-align-row">
			<button type="button" title="Align Top" onclick={() => onTextVerticalAlign('top')}>
				<!-- prettier-ignore -->
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="4" x2="21" y2="4"/><rect x="7" y="7" width="10" height="10" rx="1"/></svg>
			</button>
			<button type="button" title="Align Middle" onclick={() => onTextVerticalAlign('middle')}>
				<!-- prettier-ignore -->
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="12" x2="21" y2="12"/><rect x="7" y="7" width="10" height="10" rx="1"/></svg>
			</button>
			<button type="button" title="Align Bottom" onclick={() => onTextVerticalAlign('bottom')}>
				<!-- prettier-ignore -->
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="20" x2="21" y2="20"/><rect x="7" y="7" width="10" height="10" rx="1"/></svg>
			</button>
		</div>
	</div>
	{/if}

	<div class="divider"></div>

	<!-- ─── Board size ─── -->
	<div class="section">
		<div class="section-title">
			<!-- prettier-ignore -->
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>
			Board Size
		</div>
		<div class="size-display">
			<span>{stageWidth} × {stageHeight}</span>
		</div>
		<div class="expand-grid">
			<button type="button" title="Expand Top by 200px" onclick={() => onExpandBoard('top', 200)}>
				<!-- prettier-ignore -->
				<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>
			</button>
			<button
				type="button"
				title="Expand Bottom by 200px"
				onclick={() => onExpandBoard('bottom', 200)}
			>
				<!-- prettier-ignore -->
				<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/></svg>
			</button>
			<button
				type="button"
				title="Expand Left by 200px"
				onclick={() => onExpandBoard('left', 200)}
			>
				<!-- prettier-ignore -->
				<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5"/><path d="M12 5l-7 7 7 7"/></svg>
			</button>
			<button
				type="button"
				title="Expand Right by 200px"
				onclick={() => onExpandBoard('right', 200)}
			>
				<!-- prettier-ignore -->
				<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
			</button>
		</div>
	</div>
</aside>

<style>
	.property-panel {
		background: #ffffffd9;
		backdrop-filter: blur(8px);
		border: 1px solid #cbd5e1;
		border-radius: 16px;
		padding: 0.6rem;
		overflow-y: auto;
		font-size: 0.8rem;
	}

	.section {
		margin-bottom: 0.55rem;
	}

	.sub-section {
		margin-top: 0.55rem;
	}

	.section-title {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-weight: 600;
		font-size: 0.78rem;
		margin-bottom: 0.35rem;
		color: #334155;
	}

	.section-title.small {
		font-size: 0.73rem;
		color: #475569;
	}

	/* ─── Color swatch row ─── */
	.color-row {
		display: grid;
		grid-template-columns: 28px auto 28px auto;
		gap: 0.35rem;
		align-items: center;
	}

	.swatch {
		width: 28px;
		height: 28px;
		border-radius: 8px;
		border: 2px solid #cbd5e1;
		cursor: pointer;
		transition:
			border-color 0.15s,
			box-shadow 0.15s;
		padding: 0;
	}

	.swatch:hover {
		border-color: #2563eb;
		box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
	}

	.hidden-color {
		position: absolute;
		width: 0;
		height: 0;
		overflow: hidden;
		opacity: 0;
		pointer-events: none;
	}

	.color-label {
		font-size: 0.72rem;
		color: #64748b;
	}

	/* ─── Inputs ─── */
	.property-panel input[type='range'] {
		width: 100%;
		accent-color: #2563eb;
	}

	.property-panel select {
		width: 100%;
		border: 1px solid #cbd5e1;
		border-radius: 8px;
		padding: 0.35rem 0.5rem;
		background: #fff;
		font-size: 0.8rem;
	}

	/* ─── Badge ─── */
	.badge {
		display: inline-block;
		margin-left: 0.25rem;
		padding: 0 0.4rem;
		border-radius: 999px;
		background: #eff6ff;
		color: #1d4ed8;
		font-size: 0.68rem;
		font-weight: 600;
	}

	.badge.rot {
		background: #fef3c7;
		color: #b45309;
	}

	/* ─── Divider ─── */
	.divider {
		height: 1px;
		background: #e2e8f0;
		margin: 0.55rem 0;
	}

	/* ─── Selection info ─── */
	.selection-info {
		font-size: 0.73rem;
		color: #64748b;
		margin: 0 0 0.3rem;
	}

	.hint-inline {
		color: #94a3b8;
		font-size: 0.65rem;
	}

	.element-info {
		display: flex;
		gap: 0.3rem;
		margin-bottom: 0.4rem;
	}

	/* ─── Action grids ─── */
	.action-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.3rem;
	}

	.action-grid.six {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}

	.action-grid button {
		display: grid;
		place-items: center;
		padding: 0.4rem;
		border: 1px solid #cbd5e1;
		border-radius: 8px;
		background: #fff;
		cursor: pointer;
		color: #475569;
		transition:
			background 0.12s,
			border-color 0.12s;
	}

	.action-grid button:hover:not(:disabled) {
		background: #eff6ff;
		border-color: #93c5fd;
		color: #2563eb;
	}

	.action-grid button:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	/* ─── Text align row ─── */
	.text-align-row {
		display: flex;
		gap: 0.3rem;
	}

	.text-align-row button {
		flex: 1;
		display: grid;
		place-items: center;
		padding: 0.4rem;
		border: 1px solid #cbd5e1;
		border-radius: 8px;
		background: #fff;
		cursor: pointer;
		color: #475569;
		transition:
			background 0.12s,
			border-color 0.12s;
	}

	.text-align-row button:hover {
		background: #eff6ff;
		border-color: #93c5fd;
		color: #2563eb;
	}


	/* ─── Board size ─── */
	.size-display {
		text-align: center;
		font-size: 0.75rem;
		color: #64748b;
		margin-bottom: 0.35rem;
		font-weight: 500;
	}

	.expand-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.25rem;
	}

	.expand-grid button {
		display: grid;
		place-items: center;
		padding: 0.35rem;
		border: 1px solid #cbd5e1;
		border-radius: 8px;
		background: #fff;
		cursor: pointer;
		color: #475569;
		transition:
			background 0.12s,
			border-color 0.12s;
	}

	.expand-grid button:hover {
		background: #eff6ff;
		border-color: #93c5fd;
		color: #2563eb;
	}

	/* ─── Hint ─── */
	.hint {
		font-size: 0.7rem;
		color: #ef4444;
		margin: 0.25rem 0 0;
		font-weight: 500;
	}

	.connector-options {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.connector-option-row {
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.8rem;
		min-height: 1.75rem;
	}
	.connector-option-label {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		min-width: 0;
	}
	.connector-option-select {
		width: 7.5rem;
		font-size: 0.75rem;
		padding: 0.25rem 0.4rem;
		border: 1px solid #cbd5e1;
		border-radius: 6px;
		background: #fff;
	}
	.connector-option-right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.connector-option-range {
		width: 5rem;
		accent-color: #2563eb;
	}
	.connector-option-badge {
		font-size: 0.75rem;
		min-width: 1.5rem;
		text-align: right;
		color: #64748b;
	}
	.connector-option-row-indent {
		padding-left: 1.25rem;
	}

	.hint-note {
		font-size: 0.68rem;
		color: #64748b;
		margin: 0.2rem 0 0;
	}

	/* ─── Font size presets ─── */
	.font-size-presets {
		display: flex;
		gap: 0.25rem;
		margin-top: 0.3rem;
	}

	.preset-btn {
		flex: 1;
		padding: 0.25rem 0;
		font-size: 0.65rem;
		font-weight: 600;
		border: 1px solid #cbd5e1;
		border-radius: 6px;
		background: #fff;
		cursor: pointer;
		color: #475569;
		transition: background 0.12s, border-color 0.12s;
	}

	.preset-btn:hover {
		background: #eff6ff;
		border-color: #93c5fd;
		color: #2563eb;
	}

	.preset-btn.active {
		background: #2563eb;
		border-color: #2563eb;
		color: #fff;
	}

	/* ─── Image upload button ─── */
	.upload-btn {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		padding: 0.45rem 0.6rem;
		font-size: 0.78rem;
		font-weight: 600;
		border: 1px dashed #93c5fd;
		border-radius: 8px;
		background: #eff6ff;
		color: #2563eb;
		cursor: pointer;
		transition: background 0.12s, border-color 0.12s;
	}

	.upload-btn:hover {
		background: #dbeafe;
		border-color: #2563eb;
	}

	/* ─── Grid toggle ─── */
	.grid-toggle-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 0.78rem;
		color: #374151;
		margin-bottom: 0.5rem;
		cursor: pointer;
	}

	.toggle-btn {
		position: relative;
		width: 34px;
		height: 18px;
		border-radius: 999px;
		border: none;
		background: #cbd5e1;
		cursor: pointer;
		padding: 0;
		transition: background 0.18s;
		flex-shrink: 0;
	}

	.toggle-btn.active {
		background: #2563eb;
	}

	.toggle-knob {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: #fff;
		transition: transform 0.18s;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
	}

	.toggle-btn.active .toggle-knob {
		transform: translateX(16px);
	}

	/* ─── Grid size ─── */
	.grid-size-row {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.grid-size-label {
		font-size: 0.74rem;
		color: #64748b;
	}

	.grid-size-label strong {
		color: #1e293b;
		font-weight: 600;
	}

	.grid-size-row input[type='range'] {
		width: 100%;
		accent-color: #2563eb;
	}

	.grid-presets {
		display: flex;
		gap: 0.25rem;
	}

	.grid-presets button {
		flex: 1;
		padding: 0.25rem 0;
		font-size: 0.68rem;
		font-weight: 600;
		border: 1px solid #e2e8f0;
		border-radius: 6px;
		background: #fff;
		color: #64748b;
		cursor: pointer;
		transition: background 0.12s, border-color 0.12s, color 0.12s;
	}

	.grid-presets button:hover {
		background: #f1f5f9;
		border-color: #94a3b8;
	}

	.grid-presets button.active {
		background: #2563eb;
		border-color: #2563eb;
		color: #fff;
	}
</style>
