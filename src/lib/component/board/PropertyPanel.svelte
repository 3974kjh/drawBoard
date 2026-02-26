<script lang="ts">
	import {
		BOARD_THEMES,
		type AlignMode,
		type BoardElement,
		type DistributeMode,
		type DrawingTool,
		type TextAlign,
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
		keepToolActive: boolean;
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
		onPenColorChange: (color: string) => void;
		onFillColorChange: (color: string) => void;
		onBorderWidthChange: (w: number) => void;
		onFontSizeChange: (size: number) => void;
		onImageUpload: (dataUrl: string) => void;
		onExpandBoard: (dir: 'top' | 'bottom' | 'left' | 'right', amount: number) => void;
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
		keepToolActive = $bindable(false),
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
		onPenColorChange,
		onFillColorChange,
		onBorderWidthChange,
		onFontSizeChange,
		onImageUpload,
		onExpandBoard
	}: Props = $props();

	const singleElement = $derived(
		selectedElementIds.length === 1
			? selectedElements.find((el) => el.id === selectedElementIds[0])
			: null
	);

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

<aside class="property-panel">
	<!-- ─── Color section ─── -->
	<div class="section">
		<div class="section-title">
			<!-- prettier-ignore -->
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
			색상
		</div>
		<div class="color-row">
			<button
				type="button"
				class="swatch"
				title="선(Stroke) 색상"
				style="background:{penColor}"
				onclick={() => strokeColorRef?.click()}
			></button>
			<span class="color-label">선</span>
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
				title="채우기(Fill) 색상"
				style="background:{fillColor};{fillColor === 'transparent' ? 'background-image:linear-gradient(45deg,#ccc 25%,transparent 25%,transparent 75%,#ccc 75%),linear-gradient(45deg,#ccc 25%,transparent 25%,transparent 75%,#ccc 75%);background-size:8px 8px;background-position:0 0,4px 4px;' : ''}"
				onclick={() => fillColorRef?.click()}
			></button>
			<span class="color-label">채우기</span>
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
			테두리 <span class="badge">{borderWidth}px</span>
		</div>
		<input
			type="range"
			min="0"
			max="12"
			bind:value={borderWidth}
			oninput={() => onBorderWidthChange(borderWidth)}
		/>
		{#if singleElement?.type === 'text'}
			<p class="hint-note">0으로 설정하면 점선 테두리가 숨겨집니다</p>
		{/if}
	</div>

	<!-- ─── Font size (text-editable elements only) ─── -->
	{#if singleElement && TEXT_TYPES.includes(singleElement.type)}
		<div class="section">
			<div class="section-title">
				<!-- prettier-ignore -->
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
				폰트 크기 <span class="badge">{fontSize}px</span>
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
				이미지
			</div>
			<button type="button" class="upload-btn" onclick={() => imageFileRef?.click()}>
				<!-- prettier-ignore -->
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
				이미지 불러오기
			</button>
			{#if singleElement.imageDataUrl}
				<p class="hint-note">✓ 이미지가 로드되었습니다</p>
			{:else}
				<p class="hint-note">위 버튼으로 이미지를 선택하세요</p>
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
			펜 크기 <span class="badge">{penSize}px</span>
		</div>
		<input type="range" min="1" max="20" bind:value={penSize} />
	</div>

	{#if activeTool === 'eraser'}
		<div class="section">
			<div class="section-title">
				<!-- prettier-ignore -->
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20H7L3 16c-.8-.8-.8-2 0-2.8l10-10c.8-.8 2-.8 2.8 0l5.7 5.7c.8.8.8 2 0 2.8L14 19"/></svg>
				지우개 <span class="badge">{eraserSize}px</span>
			</div>
			<input type="range" min="8" max="80" bind:value={eraserSize} />
			<p class="hint">🧹 드래그하여 펜 선 지우기</p>
		</div>
	{/if}

	<!-- ─── Snap ─── -->
	<div class="section">
		<div class="section-title">
			<!-- prettier-ignore -->
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 3H3v18h18V3z"/><path d="M12 3v18"/><path d="M3 12h18"/></svg>
			스냅 <span class="badge">{snapThreshold}px</span>
		</div>
		<input type="range" min="1" max="24" bind:value={snapThreshold} />
	</div>

	<!-- ─── Theme ─── -->
	<div class="section">
		<div class="section-title">
			<!-- prettier-ignore -->
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
			테마
		</div>
		<select bind:value={themeId} onchange={onThemeChange}>
			{#each BOARD_THEMES as theme}
				<option value={theme.id}>{theme.label}</option>
			{/each}
		</select>
	</div>

	<div class="divider"></div>

	<!-- ─── Tool lock ─── -->
	<label class="toggle-row" title="활성화하면 도형 추가 후 같은 도구를 유지합니다">
		<input type="checkbox" bind:checked={keepToolActive} />
		<!-- prettier-ignore -->
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
		도구 고정
	</label>

	<div class="divider"></div>

	<!-- ─── Selection info ─── -->
	<p class="selection-info">
		선택: {selectedElementIds.length}개
		<span class="hint-inline">(Shift+클릭 다중선택)</span>
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
			title="선택 요소 복제 (Duplicate)"
			onclick={onDuplicate}
			disabled={selectedElementIds.length === 0}
		>
			<!-- prettier-ignore -->
			<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
		</button>
		<button
			type="button"
			title="선택 요소 삭제 (Delete)"
			onclick={onDelete}
			disabled={selectedElementIds.length === 0}
		>
			<!-- prettier-ignore -->
			<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
		</button>
		<button type="button" title="그룹 만들기 (Group)" onclick={onGroup} disabled={!canGroup}>
			<!-- prettier-ignore -->
			<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="8" height="8" rx="1"/><rect x="14" y="14" width="8" height="8" rx="1"/><path d="M6 14v-4h4"/><path d="M18 10v4h-4"/></svg>
		</button>
		<button
			type="button"
			title="그룹 해제 (Ungroup)"
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
			<div class="section-title small">정렬</div>
			<div class="action-grid six">
				<button type="button" title="좌측 정렬" onclick={() => onAlign('left')}>
					<!-- prettier-ignore -->
					<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="2" x2="4" y2="22"/><rect x="8" y="6" width="12" height="4" rx="1"/><rect x="8" y="14" width="8" height="4" rx="1"/></svg>
				</button>
				<button type="button" title="가운데 정렬 (수평)" onclick={() => onAlign('center')}>
					<!-- prettier-ignore -->
					<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="2" x2="12" y2="22"/><rect x="4" y="6" width="16" height="4" rx="1"/><rect x="6" y="14" width="12" height="4" rx="1"/></svg>
				</button>
				<button type="button" title="우측 정렬" onclick={() => onAlign('right')}>
					<!-- prettier-ignore -->
					<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="20" y1="2" x2="20" y2="22"/><rect x="4" y="6" width="12" height="4" rx="1"/><rect x="8" y="14" width="8" height="4" rx="1"/></svg>
				</button>
				<button type="button" title="상단 정렬" onclick={() => onAlign('top')}>
					<!-- prettier-ignore -->
					<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="2" y1="4" x2="22" y2="4"/><rect x="6" y="8" width="4" height="12" rx="1"/><rect x="14" y="8" width="4" height="8" rx="1"/></svg>
				</button>
				<button type="button" title="가운데 정렬 (수직)" onclick={() => onAlign('middle')}>
					<!-- prettier-ignore -->
					<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="2" y1="12" x2="22" y2="12"/><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="6" width="4" height="12" rx="1"/></svg>
				</button>
				<button type="button" title="하단 정렬" onclick={() => onAlign('bottom')}>
					<!-- prettier-ignore -->
					<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="2" y1="20" x2="22" y2="20"/><rect x="6" y="4" width="4" height="12" rx="1"/><rect x="14" y="8" width="4" height="8" rx="1"/></svg>
				</button>
			</div>
		</div>
	{/if}

	<!-- ─── Distribute ─── -->
	{#if canDistribute}
		<div class="sub-section">
			<div class="section-title small">간격 분배</div>
			<div class="action-grid">
				<button type="button" title="가로 균등 분배" onclick={() => onDistribute('horizontal')}>
					<!-- prettier-ignore -->
					<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="5" width="4" height="14" rx="1"/><rect x="10" y="7" width="4" height="10" rx="1"/><rect x="16" y="5" width="4" height="14" rx="1"/></svg>
				</button>
				<button type="button" title="세로 균등 분배" onclick={() => onDistribute('vertical')}>
					<!-- prettier-ignore -->
					<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="4" width="14" height="4" rx="1"/><rect x="7" y="10" width="10" height="4" rx="1"/><rect x="5" y="16" width="14" height="4" rx="1"/></svg>
				</button>
			</div>
		</div>
	{/if}

	<!-- ─── Text align ─── -->
	{#if isTextAlignVisible}
		<div class="sub-section">
			<div class="section-title small">텍스트 정렬</div>
			<div class="text-align-row">
				<button type="button" title="왼쪽 정렬" onclick={() => onTextAlign('left')}>
					<!-- prettier-ignore -->
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>
				</button>
				<button type="button" title="가운데 정렬" onclick={() => onTextAlign('center')}>
					<!-- prettier-ignore -->
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
				</button>
				<button type="button" title="오른쪽 정렬" onclick={() => onTextAlign('right')}>
					<!-- prettier-ignore -->
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg>
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
			보드 크기
		</div>
		<div class="size-display">
			<span>{stageWidth} × {stageHeight}</span>
		</div>
		<div class="expand-grid">
			<button type="button" title="위로 200px 확장" onclick={() => onExpandBoard('top', 200)}>
				<!-- prettier-ignore -->
				<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>
			</button>
			<button
				type="button"
				title="아래로 200px 확장"
				onclick={() => onExpandBoard('bottom', 200)}
			>
				<!-- prettier-ignore -->
				<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/></svg>
			</button>
			<button
				type="button"
				title="왼쪽으로 200px 확장"
				onclick={() => onExpandBoard('left', 200)}
			>
				<!-- prettier-ignore -->
				<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5"/><path d="M12 5l-7 7 7 7"/></svg>
			</button>
			<button
				type="button"
				title="오른쪽으로 200px 확장"
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

	/* ─── Toggle row ─── */
	.toggle-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.78rem;
		font-weight: 500;
		cursor: pointer;
		color: #475569;
	}

	.toggle-row input[type='checkbox'] {
		accent-color: #2563eb;
		width: 15px;
		height: 15px;
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
</style>
