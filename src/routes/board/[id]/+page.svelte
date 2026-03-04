<script lang="ts">
	import { goto, beforeNavigate } from '$app/navigation';
	import {
		BOARD_THEMES,
		TEXT_EDITABLE_TYPES,
		type AlignMode,
		type BoardData,
		type BoardElement,
		type DistributeMode,
		type DrawingTool,
		type GuideLine,
		type GuideDistance,
		type InteractionState,
		type Point,
		type ResizeHandle,
		type Snapshot,
		type Stroke,
		type TextAlign,
		type TextVerticalAlign,
		type ThemeId,
		CONNECTABLE_TYPES,
		TOOL_ITEMS,
		type ConnectorStyle,
		type ConnectorType,
		type ConnectorArrow,
		type ConnectorArrowDirection
	} from '$lib/board-types';
	import { getConnectorPath, updateConnectorBounds } from '$lib/connector-geometry';
	import { getBoardById, getBoards, upsertBoard } from '$lib/board-storage';
	import {
		getBounds,
		getSnapDelta,
		chooseCloserSnap,
		getGapMatchSnap,
		getDistanceLabels
	} from '$lib/snap-engine';
	import {
		getStrokeBounds,
		getStrokesBounds,
		strokeIntersectsRect,
		strokeIntersectsCircle
	} from '$lib/canvas-renderer';
	import {
		drawThemeBackground,
		drawStroke,
		drawElementToCanvas,
		renderThumbnail,
		loadImages
	} from '$lib/canvas-renderer';
	import { onMount } from 'svelte';
	import { jsPDF } from 'jspdf';
	import toast from 'svelte-hot-french-toast';

	import Topbar from '$lib/component/board/Topbar.svelte';
	import ToolPanel from '$lib/component/board/ToolPanel.svelte';
	import PropertyPanel from '$lib/component/board/PropertyPanel.svelte';
	import BoardStage from '$lib/component/board/BoardStage.svelte';
	import ImportModal from '$lib/component/board/ImportModal.svelte';
	import LibraryModal from '$lib/component/board/LibraryModal.svelte';
	import ShortcutsModal from '$lib/component/board/ShortcutsModal.svelte';
	import SaveLibraryNameModal from '$lib/component/board/SaveLibraryNameModal.svelte';
	import MinimapThumbnail from '$lib/component/board/MinimapThumbnail.svelte';
	import {
		saveLibraryItem,
		type LibraryItem
	} from '$lib/library-storage';

	type PageData = { boardId: string };
	type Axis = 'x' | 'y';

	let { data } = $props<{ data: PageData }>();
	let boardId = $derived(data.boardId);

	/* ── State ── */
	let stageRef = $state<HTMLElement | null>(null);
	let drawCanvas = $state<HTMLCanvasElement | null>(null);
	let stageWrapRef = $state<HTMLElement | null>(null);
	let boardTitle = $state('');
	let themeId = $state<ThemeId>('whiteboard');
	let strokes = $state<Stroke[]>([]);
	let elements = $state<BoardElement[]>([]);
	let activeTool = $state<DrawingTool>('pen');
	let selectedElementIds = $state<string[]>([]);
	let selectedStrokeIds = $state<string[]>([]);
	let editingElementId = $state<string | null>(null);
	/** Image element id when opening file picker from double-click on image (replace image flow). */
	let imageReplaceTargetId = $state<string | null>(null);
	let imageFileInputRef = $state<HTMLInputElement | null>(null);
	let penColor = $state('#111827');
	let fillColor = $state('#ffffff');
	let penSize = $state(3);
	let eraserSize = $state(24);
	let borderWidth = $state(2);
	let fontSize = $state(18);
	let snapThreshold = $state(8);
	let gridEnabled = $state(true);
	let gridSize = $state(32);
	let keepToolActive = $state(false);
	let connectorStyle = $state<ConnectorStyle>('solid');
	let connectorType = $state<ConnectorType>('orthogonal');
	let startArrow = $state<ConnectorArrow>('none');
	let endArrow = $state<ConnectorArrow>('arrow');
	let startArrowDirection = $state<ConnectorArrowDirection>('auto');
	let endArrowDirection = $state<ConnectorArrowDirection>('auto');
	let connectorArrowSize = $state(10);
	/** When true, show line-connection anchor points on all connectable shapes (no hover). */
	let showConnectorAnchors = $state(false);
	/** When connector tool: { startElementId, startAnchor } or null */
	let pendingConnector = $state<{ startElementId: string; startAnchor: string } | null>(null);
	/** Preview end point while drawing connector (start anchor → mouse) */
	let connectorPreviewEnd = $state<Point | null>(null);
	let showImportModal = $state(false);
	let importBoards = $state<BoardData[]>([]);
	let showLibraryModal = $state(false);
	let showShortcutsModal = $state(false);
	/** When set, next board click places this library item at the click position. */
	let pendingLibraryItem = $state<LibraryItem | null>(null);
	/** Context menu position (right-click with selection). */
	let contextMenuAt = $state<{ x: number; y: number } | null>(null);
	/** 'element' = Copy/Delete/Save to Library; 'paste' = Paste on empty area */
	let contextMenuMode = $state<'element' | 'paste' | null>(null);
	/** Stage coords for paste-from-context-menu (when contextMenuMode === 'paste'). */
	let contextMenuPasteAt = $state<Point | null>(null);
	let stageContainerRef = $state<HTMLElement | null>(null);
	let contextMenuRef = $state<HTMLElement | null>(null);
	let showSaveLibraryNameModal = $state(false);
	/** true = unsaved content (strokes/elements/settings) */
	let _contentDirty = $state(false);
	/** title at last load or save (so title change counts as dirty) */
	let _lastSavedTitle = $state('');
	/** true when there are unsaved changes (content or title) */
	const isDirty = $derived(_contentDirty || boardTitle !== _lastSavedTitle);
	/** URL to navigate to after handling the unsaved-changes dialog */
	let _pendingNavUrl = $state<string | null>(null);
	let showUnsavedModal = $state(false);
	let showSavedModal = $state(false);
	let showClearConfirmModal = $state(false);
	let interaction = $state<InteractionState>(null);
	let history = $state<Snapshot[]>([]);
	let historyIndex = $state(-1);
	let stageWidth = $state(1200);
	let stageHeight = $state(700);
	let guideLines = $state<GuideLine[]>([]);
	let guideDistances = $state<GuideDistance[]>([]);
	/** Persisted selection bbox rotation (degrees) so rotate handle stays at rotated position after drag. */
	let selectionBboxRotationPersisted = $state(0);
	/** Persisted bbox dimensions at start of rotate; used to draw bbox after rotation. */
	let selectionBboxBoundsPersisted = $state<{ x: number; y: number; width: number; height: number } | null>(null);

	/* ── Non-reactive live-drawing state (bypasses Svelte reactivity for perf) ── */
	let _livePoints: Point[] = [];
	let _liveColor = '';
	let _liveSize = 0;
	let _committedImageData: ImageData | null = null;
	let _liveRafId = 0;
	let _isLiveDrawing = false;

	/* ── Non-reactive eraser state ── */
	let _prevEraserPt: Point | null = null;

	/* ── Clipboard for copy/paste ── */
	let _clipboard: BoardElement[] = [];

	/* ── Derived ── */
	const currentTheme = $derived(
		BOARD_THEMES.find((theme) => theme.id === themeId) ?? BOARD_THEMES[0]
	);
	const selectedElements = $derived(
		elements.filter((element) => selectedElementIds.includes(element.id))
	);
	const selectedSingleElement = $derived(
		selectedElementIds.length === 1
			? elements.find((element) => element.id === selectedElementIds[0]) ?? null
			: null
	);
	const isTextAlignVisible = $derived(
		selectedElements.some((item) => TEXT_EDITABLE_TYPES.includes(item.type))
	);
	const marquee = $derived(interaction?.kind === 'marquee' ? interaction : null);
	const canUndo = $derived(historyIndex > 0);
	const canRedo = $derived(historyIndex > -1 && historyIndex < history.length - 1);
	const canGroup = $derived(selectedElementIds.length > 1);
	const canUngroup = $derived(selectedElements.some((item) => !!item.groupId));
	const canDistribute = $derived(selectedElementIds.length > 2);
	const selectedGroupBoxes = $derived.by(() => {
		const groupIds = uniq(
			selectedElements
				.map((item) => item.groupId)
				.filter((item): item is string => Boolean(item))
		);
		return groupIds
			.map((groupId) => {
				const groupItems = elements.filter((item) => item.groupId === groupId);
				if (groupItems.length < 2) return null;
				const bounds = getBounds(groupItems);
				return bounds ? { groupId, ...bounds } : null;
			})
			.filter((item): item is NonNullable<typeof item> => Boolean(item));
	});

	/** Combined bounds of selected elements + selected strokes (for group resize). */
	const selectionBounds = $derived.by(() => {
		const elBounds = getBounds(selectedElements);
		const strokeBounds = getStrokesBounds(strokes, selectedStrokeIds);
		if (!elBounds && !strokeBounds) return null;
		if (!elBounds) return strokeBounds;
		if (!strokeBounds) return elBounds;
		const minX = Math.min(elBounds.x, strokeBounds.x);
		const minY = Math.min(elBounds.y, strokeBounds.y);
		const maxX = Math.max(elBounds.right, strokeBounds.right);
		const maxY = Math.max(elBounds.bottom, strokeBounds.bottom);
		return {
			x: minX,
			y: minY,
			right: maxX,
			bottom: maxY,
			width: maxX - minX,
			height: maxY - minY,
			centerX: (minX + maxX) / 2,
			centerY: (minY + maxY) / 2
		};
	});

	/** Show one selection bbox with resize handles (multi-element or any strokes). */
	const showSelectionBbox = $derived(
		selectedStrokeIds.length >= 1 || selectedElementIds.length > 1
	);

	/** Rotation angle (degrees) to apply to selection bbox and its rotate handle. */
	const selectionBboxRotation = $derived(
		interaction?.kind === 'rotate-group'
			? (interaction.originBboxRotation + (interaction.currentDeltaDeg ?? 0))
			: selectionBboxRotationPersisted
	);

	/** Bounds used to draw the selection bbox; frozen during rotate; during drag offset by delta; during resize use live lastNewBounds so bbox shrinks/grows with drag. */
	const selectionBboxBounds = $derived.by(() => {
		if (interaction?.kind === 'rotate-group' && interaction.originBounds) return interaction.originBounds;
		if (interaction?.kind === 'drag-group' && selectionBboxBoundsPersisted) {
			const dx = interaction.currentDx ?? 0;
			const dy = interaction.currentDy ?? 0;
			return {
				x: selectionBboxBoundsPersisted.x + dx,
				y: selectionBboxBoundsPersisted.y + dy,
				width: selectionBboxBoundsPersisted.width,
				height: selectionBboxBoundsPersisted.height
			};
		}
		if (interaction?.kind === 'resize-group' && interaction.lastNewBounds) return interaction.lastNewBounds;
		if (selectionBboxBoundsPersisted) return selectionBboxBoundsPersisted;
		return selectionBounds;
	});

	/* ── Utilities ── */
	const deepClone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
	const uniq = (items: string[]) => [...new Set(items)];

	/** Visual AABB of an element (rotation and connector path). For thumbnail bounds so nothing is clipped. */
	function getElementVisualBounds(
		el: BoardElement,
		allElements: BoardElement[]
	): { minX: number; minY: number; maxX: number; maxY: number } {
		if (el.type === 'connector') {
			const data = getConnectorPath(el, allElements);
			if (data?.bounds)
				return {
					minX: data.bounds.x,
					minY: data.bounds.y,
					maxX: data.bounds.x + data.bounds.width,
					maxY: data.bounds.y + data.bounds.height
				};
		}
		const x = el.x;
		const y = el.y;
		const w = el.width;
		const h = el.height;
		const rot = (el.rotation ?? 0) * (Math.PI / 180);
		const bw = (el.borderWidth ?? 2) / 2;
		const cx = x + w / 2;
		const cy = y + h / 2;
		const cos = Math.cos(rot);
		const sin = Math.sin(rot);
		const corners = [
			[x - bw, y - bw],
			[x + w + bw, y - bw],
			[x + w + bw, y + h + bw],
			[x - bw, y + h + bw]
		].map(([px, py]) => ({
			x: cx + (px - cx) * cos - (py - cy) * sin,
			y: cy + (px - cx) * sin + (py - cy) * cos
		}));
		const minX = Math.min(...corners.map((c) => c.x));
		const minY = Math.min(...corners.map((c) => c.y));
		const maxX = Math.max(...corners.map((c) => c.x));
		const maxY = Math.max(...corners.map((c) => c.y));
		return { minX, minY, maxX, maxY };
	}

	const nextId = () => {
		if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
			return crypto.randomUUID();
		}
		return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
	};

	const getPointFromPointer = (event: PointerEvent): Point => {
		const rect = stageRef?.getBoundingClientRect();
		if (!rect) return { x: 0, y: 0 };
		return { x: event.clientX - rect.left, y: event.clientY - rect.top };
	};

	/* ── History ── */
	const commitSnapshot = () => {
		const snapshot: Snapshot = {
			strokes: deepClone(strokes),
			elements: deepClone(elements),
			themeId,
			stageWidth,
			stageHeight,
			gridEnabled,
			gridSize
		};
		history = [...history.slice(0, historyIndex + 1), snapshot];
		historyIndex = history.length - 1;
		_contentDirty = true;
	};

	const applySnapshot = (snapshot: Snapshot) => {
		/* Restore board dimensions first so the canvas is resized before redraw */
		stageWidth = snapshot.stageWidth;
		stageHeight = snapshot.stageHeight;
		if (drawCanvas) {
			drawCanvas.width = stageWidth;
			drawCanvas.height = stageHeight;
		}
		strokes = deepClone(snapshot.strokes);
		elements = deepClone(snapshot.elements);
		themeId = snapshot.themeId;
		gridEnabled = snapshot.gridEnabled;
		gridSize = snapshot.gridSize;
		selectedElementIds = [];
		selectedStrokeIds = [];
		editingElementId = null;
	};

	const undo = () => {
		if (!canUndo) return;
		historyIndex -= 1;
		applySnapshot(history[historyIndex]);
		toast.success('Undone.');
	};

	const redo = () => {
		if (!canRedo) return;
		historyIndex += 1;
		applySnapshot(history[historyIndex]);
		toast.success('Redone.');
	};

	/* ── Board I/O ── */
	const refreshImportBoards = async () => {
		const all = await getBoards();
		importBoards = all.filter((item) => item.id !== boardId);
	};

	/** Migrate legacy element data (handles old 'line' type, missing rotation/borderWidth) */
	const migrateElement = (el: BoardElement): BoardElement => {
		const raw = el as unknown as Record<string, unknown>;
		const legacyType = raw.type as string;
		return {
			...el,
			rotation: typeof raw.rotation === 'number' ? (raw.rotation as number) : 0,
			borderWidth: typeof raw.borderWidth === 'number' ? (raw.borderWidth as number) : 2,
			textVerticalAlign:
				raw.textVerticalAlign === 'middle' || raw.textVerticalAlign === 'bottom'
					? (raw.textVerticalAlign as TextVerticalAlign)
					: 'top',
			type: legacyType === 'line' ? 'line-h' : el.type
		};
	};

	/** Returns the current inner dimensions of the board's scrollable wrapper. */
	const getViewportSize = () => ({
		w: Math.max(400, Math.floor(stageWrapRef?.clientWidth || 1200)),
		h: Math.max(300, Math.floor(stageWrapRef?.clientHeight || 700))
	});

	const loadBoard = async () => {
		const board = await getBoardById(boardId);
		if (!board) {
			goto('/');
			return;
		}
		boardTitle = board.title;
		themeId = board.themeId;
		const hasSavedSize = board.width != null && board.height != null;
		/* Restore saved canvas size; for new boards use viewport (same as clearBoard) after layout */
		if (hasSavedSize) {
			stageWidth = board.width ?? stageWidth;
			stageHeight = board.height ?? stageHeight;
		} else {
			const vp = getViewportSize();
			stageWidth = vp.w;
			stageHeight = vp.h;
		}
		gridEnabled = board.gridEnabled ?? true;
		gridSize = board.gridSize ?? 32;
		strokes = deepClone(board.strokes).filter((s: Stroke) => s.tool !== 'eraser');
		elements = deepClone(board.elements).map((el: BoardElement) => migrateElement(el));
		selectedElementIds = [];
		selectedStrokeIds = [];
		penColor =
			BOARD_THEMES.find((theme) => theme.id === board.themeId)?.defaultStrokeColor ?? '#111827';
		fillColor =
			BOARD_THEMES.find((theme) => theme.id === board.themeId)?.defaultFillColor ?? '#ffffff';
		history = [];
		historyIndex = -1;
		commitSnapshot();
		_contentDirty = false;
		_lastSavedTitle = board.title;
		await refreshImportBoards();
		/* New board: apply viewport size after layout (same as clearBoard) so no scroll on first paint */
		if (!hasSavedSize) {
			requestAnimationFrame(() => {
				requestAnimationFrame(() => {
					const vp = getViewportSize();
					stageWidth = vp.w;
					stageHeight = vp.h;
					if (drawCanvas) {
						drawCanvas.width = stageWidth;
						drawCanvas.height = stageHeight;
					}
					redrawCanvas();
					commitSnapshot();
				});
			});
		}
		/* Restore saved scroll position so returning to the board shows the same view */
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				const wrap = stageWrapRef;
				if (wrap) {
					try {
						const raw = sessionStorage.getItem(`board-scroll-${boardId}`);
						if (raw) {
							const { x, y } = JSON.parse(raw);
							wrap.scrollLeft = Math.max(0, Number(x) || 0);
							wrap.scrollTop = Math.max(0, Number(y) || 0);
						}
					} catch (_) {}
				}
			});
		});
	};

	const saveBoard = async (silent = false) => {
		const original = await getBoardById(boardId);
		if (!original) return;
		/* Pre-load images so the thumbnail captures them */
		const imageMap = await loadImages(elements);
		const thumbnail = renderThumbnail(
			stageWidth,
			stageHeight,
			currentTheme.background,
			currentTheme.gridColor,
			strokes,
			elements,
			imageMap,
			gridEnabled,
			gridSize
		);
		const savedTitle = boardTitle.trim() || original.title;
		await upsertBoard({
			...original,
			title: savedTitle,
			themeId,
			strokes: deepClone(strokes),
			elements: deepClone(elements),
			thumbnail,
			width: stageWidth,
			height: stageHeight,
			gridEnabled,
			gridSize
		});
		_contentDirty = false;
		_lastSavedTitle = savedTitle;
		await refreshImportBoards();
		if (!silent) showSavedModal = true;
	};

	const openClearConfirmModal = () => {
		showClearConfirmModal = true;
	};

	const closeClearConfirmModal = () => {
		showClearConfirmModal = false;
	};

	const clearBoard = () => {
		const vp = getViewportSize();
		strokes = [];
		elements = [];
		selectedElementIds = [];
		editingElementId = null;
		stageWidth = vp.w;
		stageHeight = vp.h;
		if (drawCanvas) {
			drawCanvas.width = stageWidth;
			drawCanvas.height = stageHeight;
		}
		redrawCanvas();
		/* Reset history so undo/redo cannot go back to pre-clear state */
		history = [];
		historyIndex = -1;
		commitSnapshot();
		showClearConfirmModal = false;
		toast.success('Board cleared.');
	};

	const importBoardContent = (source: BoardData) => {
		themeId = source.themeId;
		strokes = deepClone(source.strokes).filter((s: Stroke) => s.tool !== 'eraser');
		elements = deepClone(source.elements).map((el: BoardElement) => migrateElement(el));
		selectedElementIds = [];
		editingElementId = null;
		showImportModal = false;
		commitSnapshot();
		toast.success('Board content imported.');
	};

	/* ── Element helpers ── */
	const normalizeElement = (element: BoardElement): BoardElement => {
		let { x, y, width, height } = element;
		if (width < 0) {
			x += width;
			width = Math.abs(width);
		}
		if (height < 0) {
			y += height;
			height = Math.abs(height);
		}
		return { ...element, x, y, width, height };
	};

	const collectGroupedIds = (id: string) => {
		const base = elements.find((item) => item.id === id);
		if (!base) return [];
		if (!base.groupId) return [id];
		return elements.filter((item) => item.groupId === base.groupId).map((item) => item.id);
	};

	const expandByGroups = (ids: string[]) => uniq(ids.flatMap((id) => collectGroupedIds(id)));

	const setSelection = (ids: string[]) => {
		selectedElementIds = uniq(ids);
		if (selectedElementIds.length === 0) {
			editingElementId = null;
		}
	};

	const startTextEdit = (id: string) => {
		const element = elements.find((item) => item.id === id);
		if (!element) return;
		if (!TEXT_EDITABLE_TYPES.includes(element.type)) return;
		activeTool = 'select';
		setSelection([id]);
		editingElementId = id;
	};

	/** Double-click on element: image → open file picker (same as Import Image); otherwise start text edit. */
	const handleDblClickElement = (id: string) => {
		const element = elements.find((item) => item.id === id);
		if (!element) return;
		if (element.type === 'image') {
			activeTool = 'select';
			setSelection([id]);
			imageReplaceTargetId = id;
			setTimeout(() => imageFileInputRef?.click(), 0);
			return;
		}
		startTextEdit(id);
	};

	const handleImageReplaceFromFile = (e: Event) => {
		const file = (e.currentTarget as HTMLInputElement).files?.[0];
		const targetId = imageReplaceTargetId;
		imageReplaceTargetId = null;
		(e.currentTarget as HTMLInputElement).value = '';
		if (!file || !targetId) return;
		const reader = new FileReader();
		reader.onload = (ev) => {
			const dataUrl = ev.target?.result as string;
			if (dataUrl) {
				elements = elements.map((item) =>
					item.id === targetId && item.type === 'image' ? { ...item, imageDataUrl: dataUrl } : item
				);
				commitSnapshot();
			}
		};
		reader.readAsDataURL(file);
	};

	const updateElement = (id: string, updater: (item: BoardElement) => BoardElement) => {
		elements = elements.map((item) =>
			item.id === id ? normalizeElement(updater(item)) : item
		);
	};

	const updateSelectedElements = (updater: (item: BoardElement) => BoardElement) => {
		const selected = new Set(selectedElementIds);
		elements = elements.map((item) =>
			selected.has(item.id) ? normalizeElement(updater(item)) : item
		);
	};

	/** Recompute x,y,width,height for all connectors from their start/end anchors */
	const refreshConnectorBounds = () => {
		elements = elements.map((item) =>
			item.type === 'connector' ? updateConnectorBounds(item, elements) : item
		);
	};

	const addElementAt = (type: BoardElement['type'], point: Point) => {
		const isLineH = type === 'line-h';
		const isLineV = type === 'line-v';
		const isLine = isLineH || isLineV;
		const isCircle = type === 'ellipse';
		const isImage = type === 'image';
		const defW = type === 'text' ? 220 : isLineV ? 20 : isCircle ? 160 : isImage ? 200 : 200;
		const defH = type === 'text' ? 80 : isLineH ? 20 : isCircle ? 160 : isImage ? 150 : 140;
		const w = Math.max(10, Math.min(defW, stageWidth));
		const h = Math.max(10, Math.min(defH, stageHeight));
		const x = Math.max(0, Math.min(stageWidth - w, point.x));
		const y = Math.max(0, Math.min(stageHeight - h, point.y));
		const element: BoardElement = {
			id: nextId(),
			type,
			x,
			y,
			width: w,
			height: h,
			rotation: 0,
			strokeColor: penColor,
			fillColor: isLine || type === 'text' || isImage ? 'transparent' : fillColor,
			borderWidth: isImage ? 0 : type === 'text' ? 1 : borderWidth,
			text: '',
			textAlign: 'left',
			textVerticalAlign: 'top',
			fontSize: type === 'text' ? 24 : 18
		};
		elements = [...elements, element];
		setSelection([element.id]);
		if (type === 'text') {
			editingElementId = element.id;
		}
		commitSnapshot();
		/* Auto-switch to select mode after adding (unless keepToolActive) */
		if (!keepToolActive) {
			activeTool = 'select';
		}
	};

	/* ── Sync property panel with selected element ── */
	let _prevSelectedId: string | null = null;
	$effect(() => {
		const el = selectedSingleElement;
		const id = el?.id ?? null;
		if (id && id !== _prevSelectedId) {
			penColor = el!.strokeColor;
			fillColor = el!.fillColor;
			borderWidth = el!.borderWidth ?? 2;
			fontSize = el!.fontSize ?? 18;
			if (el!.type === 'connector') {
				connectorStyle = el!.connectorStyle ?? 'solid';
				connectorType = el!.connectorType ?? 'orthogonal';
				startArrow = el!.startArrow ?? 'none';
				endArrow = el!.endArrow ?? 'arrow';
				startArrowDirection = el!.startArrowDirection ?? 'auto';
				endArrowDirection = el!.endArrowDirection ?? 'auto';
				connectorArrowSize = el!.connectorArrowSize ?? 10;
			}
		}
		_prevSelectedId = id;
	});

	/* ── Apply color/border changes to selected elements ── */
	const handlePenColorChange = (color: string) => {
		penColor = color;
		if (selectedElementIds.length > 0) {
			updateSelectedElements((item) => ({ ...item, strokeColor: color }));
			commitSnapshot();
		}
	};

	const handleFillColorChange = (color: string) => {
		fillColor = color;
		if (selectedElementIds.length > 0) {
			updateSelectedElements((item) => ({ ...item, fillColor: color }));
			commitSnapshot();
		}
	};

	const handleBorderWidthChange = (w: number) => {
		borderWidth = w;
		if (selectedElementIds.length > 0) {
			updateSelectedElements((item) => ({ ...item, borderWidth: w }));
			commitSnapshot();
		}
	};

	const handleConnectorStyleChange = (v: ConnectorStyle) => {
		connectorStyle = v;
		updateSelectedElements((item) =>
			item.type === 'connector' ? { ...item, connectorStyle: v } : item
		);
		if (selectedElementIds.length > 0) commitSnapshot();
	};
	const handleConnectorTypeChange = (v: ConnectorType) => {
		connectorType = v;
		updateSelectedElements((item) =>
			item.type === 'connector' ? { ...item, connectorType: v } : item
		);
		if (selectedElementIds.length > 0) commitSnapshot();
	};
	const handleStartArrowChange = (v: ConnectorArrow) => {
		startArrow = v;
		updateSelectedElements((item) =>
			item.type === 'connector' ? { ...item, startArrow: v } : item
		);
		if (selectedElementIds.length > 0) commitSnapshot();
	};
	const handleEndArrowChange = (v: ConnectorArrow) => {
		endArrow = v;
		updateSelectedElements((item) =>
			item.type === 'connector' ? { ...item, endArrow: v } : item
		);
		if (selectedElementIds.length > 0) commitSnapshot();
	};
	const handleStartArrowDirectionChange = (v: ConnectorArrowDirection) => {
		startArrowDirection = v;
		updateSelectedElements((item) =>
			item.type === 'connector' ? { ...item, startArrowDirection: v } : item
		);
		if (selectedElementIds.length > 0) commitSnapshot();
	};
	const handleEndArrowDirectionChange = (v: ConnectorArrowDirection) => {
		endArrowDirection = v;
		updateSelectedElements((item) =>
			item.type === 'connector' ? { ...item, endArrowDirection: v } : item
		);
		if (selectedElementIds.length > 0) commitSnapshot();
	};
	const handleConnectorArrowSizeChange = (v: number) => {
		connectorArrowSize = v;
		updateSelectedElements((item) =>
			item.type === 'connector' ? { ...item, connectorArrowSize: v } : item
		);
		if (selectedElementIds.length > 0) commitSnapshot();
	};

	/** Connector tool: first click sets start anchor, second click sets end and creates connector */
	const handleConnectorAnchorClick = (elementId: string, anchorId: string) => {
		if (!pendingConnector) {
			pendingConnector = { startElementId: elementId, startAnchor: anchorId };
			return;
		}
		if (pendingConnector.startElementId === elementId && pendingConnector.startAnchor === anchorId) {
			pendingConnector = null;
			return;
		}
		const connector: BoardElement = {
			id: nextId(),
			type: 'connector',
			x: 0,
			y: 0,
			width: 0,
			height: 0,
			rotation: 0,
			strokeColor: penColor,
			fillColor: 'transparent',
			borderWidth,
			text: '',
			textAlign: 'left',
			textVerticalAlign: 'top',
			fontSize: 18,
			startElementId: pendingConnector.startElementId,
			startAnchor: pendingConnector.startAnchor,
			endElementId: elementId,
			endAnchor: anchorId,
			connectorStyle,
			connectorType,
			startArrow,
			endArrow,
			startArrowDirection,
			endArrowDirection,
			connectorArrowSize
		};
		const updated = updateConnectorBounds(connector, elements);
		elements = [...elements, updated];
		setSelection([updated.id]);
		pendingConnector = null;
		commitSnapshot();
		if (!keepToolActive) activeTool = 'select';
	};

	const handleFontSizeChange = (size: number) => {
		fontSize = size;
		if (selectedElementIds.length > 0) {
			updateSelectedElements((item) =>
				['rect', 'ellipse', 'text'].includes(item.type) ? { ...item, fontSize: size } : item
			);
			commitSnapshot();
		}
	};

	/** Called from PropertyPanel when user picks an image file for an image element. */
	const handleImageUpload = (dataUrl: string) => {
		if (selectedElementIds.length === 0) return;
		updateSelectedElements((item) =>
			item.type === 'image' ? { ...item, imageDataUrl: dataUrl } : item
		);
		commitSnapshot();
	};

	/* ── Board expansion ── */
	const expandBoard = (dir: 'top' | 'bottom' | 'left' | 'right', amount: number, commit = true) => {
		if (dir === 'right') {
			stageWidth += amount;
		} else if (dir === 'bottom') {
			stageHeight += amount;
		} else if (dir === 'left') {
			stageWidth += amount;
			/* Shift all elements and strokes right so new space is on the left */
			elements = elements.map((el) => ({ ...el, x: el.x + amount }));
			strokes = strokes.map((s) => ({
				...s,
				points: s.points.map((p) => ({ x: p.x + amount, y: p.y }))
			}));
		} else if (dir === 'top') {
			stageHeight += amount;
			/* Shift all elements and strokes down so new space is at the top */
			elements = elements.map((el) => ({ ...el, y: el.y + amount }));
			strokes = strokes.map((s) => ({
				...s,
				points: s.points.map((p) => ({ x: p.x, y: p.y + amount }))
			}));
		}
		/* Resize the canvas to match */
		if (drawCanvas) {
			drawCanvas.width = stageWidth;
			drawCanvas.height = stageHeight;
		}
		redrawCanvas();
		/* Keep visible area fixed: scroll by expansion amount for top/left so content doesn’t jump */
		const wrap = stageWrapRef;
		const scrollDir = dir === 'top' ? 'top' : dir === 'left' ? 'left' : null;
		if (scrollDir && wrap) {
			requestAnimationFrame(() => {
				if (scrollDir === 'top') wrap.scrollTop += amount;
				if (scrollDir === 'left') wrap.scrollLeft += amount;
			});
		}
		if (commit) commitSnapshot();
	};

	/** Clamp point to current board bounds (so strokes/elements cannot be placed outside). */
	function clampPointToBoard(p: Point): Point {
		return {
			x: Math.max(0, Math.min(stageWidth, p.x)),
			y: Math.max(0, Math.min(stageHeight, p.y))
		};
	}

	/* ── Drawing ── */
	const startDrawing = (point: Point) => {
		const pt = clampPointToBoard(point);
		// Snapshot the current canvas so we can restore it on every RAF frame
		if (drawCanvas) {
			const ctx = drawCanvas.getContext('2d');
			if (ctx) {
				_committedImageData = ctx.getImageData(0, 0, drawCanvas.width, drawCanvas.height);
			}
		}
		_livePoints = [pt];
		_liveColor = penColor;
		_liveSize = penSize;
		_isLiveDrawing = true;
		_drawLiveStroke();
	};

	const pushPointToStroke = (point: Point) => {
		if (!_isLiveDrawing) return;
		_livePoints = [..._livePoints, clampPointToBoard(point)];
		// Batch canvas updates through RAF for smoothest rendering
		if (_liveRafId === 0) {
			_liveRafId = requestAnimationFrame(() => {
				_liveRafId = 0;
				_drawLiveStroke();
			});
		}
	};

	/** Restore the pre-stroke canvas snapshot then draw the in-progress stroke with Bezier smoothing. */
	const _drawLiveStroke = () => {
		if (!drawCanvas || !_committedImageData) return;
		const ctx = drawCanvas.getContext('2d');
		if (!ctx) return;
		ctx.putImageData(_committedImageData, 0, 0);
		_renderSmoothStroke(ctx, _livePoints, _liveColor, _liveSize);
	};

	/** Render a stroke array using quadratic Bezier midpoint smoothing. */
	const _renderSmoothStroke = (
		ctx: CanvasRenderingContext2D,
		pts: Point[],
		color: string,
		size: number
	) => {
		if (pts.length === 0) return;
		ctx.save();
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		ctx.lineWidth = size;
		ctx.strokeStyle = color;
		ctx.fillStyle = color;
		ctx.beginPath();
		if (pts.length === 1) {
			ctx.arc(pts[0].x, pts[0].y, size / 2, 0, Math.PI * 2);
			ctx.fill();
		} else if (pts.length === 2) {
			ctx.moveTo(pts[0].x, pts[0].y);
			ctx.lineTo(pts[1].x, pts[1].y);
			ctx.stroke();
		} else {
			ctx.moveTo(pts[0].x, pts[0].y);
			for (let i = 1; i < pts.length - 1; i++) {
				const midX = (pts[i].x + pts[i + 1].x) / 2;
				const midY = (pts[i].y + pts[i + 1].y) / 2;
				ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
			}
			ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
			ctx.stroke();
		}
		ctx.restore();
	};

	/** Commit the finished live stroke into the reactive strokes state on pointer-up. */
	const commitLiveStroke = () => {
		if (!_isLiveDrawing) return;
		_isLiveDrawing = false;
		if (_liveRafId !== 0) {
			cancelAnimationFrame(_liveRafId);
			_liveRafId = 0;
		}
		_committedImageData = null;
		if (_livePoints.length < 1) return;
		const stroke: Stroke = {
			id: nextId(),
			tool: 'pen',
			color: _liveColor,
			size: _liveSize,
			points: [..._livePoints]
		};
		strokes = [...strokes, stroke];
		_livePoints = [];
		// The $effect on strokes will now fire → redrawCanvas() for a clean committed frame
	};

	/* ── Eraser ── */

	/**
	 * Flatten a stroke's Bezier curve into a dense polyline that follows the
	 * actual rendered path.  This is critical because `drawStroke` uses
	 * quadratic Bezier smoothing where recorded points are *control points*
	 * (the curve does NOT pass through them).  If the eraser operates on the
	 * raw recorded points it causes a visible "shape shift" when control
	 * points are removed.  By flattening first, every point lies ON the
	 * visible curve, so splitting produces segments whose shape is identical
	 * to the original.
	 *
	 * Sampling: ~FLATTEN_PX pixels between consecutive output points.
	 * If the stroke is already denser than this it is returned as-is.
	 */
	const FLATTEN_PX = 3;
	const _flattenBezier = (pts: Point[]): Point[] => {
		if (pts.length <= 2) return pts;

		// Skip if already dense (previously flattened stroke)
		let totalDist = 0;
		for (let i = 1; i < Math.min(pts.length, 30); i++) {
			totalDist += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
		}
		if (totalDist / (Math.min(pts.length, 30) - 1) <= FLATTEN_PX * 1.2) return pts;

		const flat: Point[] = [{ x: pts[0].x, y: pts[0].y }];
		let cx = pts[0].x, cy = pts[0].y;

		for (let i = 1; i < pts.length - 1; i++) {
			const px = pts[i].x, py = pts[i].y;
			const ex = (pts[i].x + pts[i + 1].x) / 2;
			const ey = (pts[i].y + pts[i + 1].y) / 2;
			const d = Math.hypot(px - cx, py - cy) + Math.hypot(ex - px, ey - py);
			const steps = Math.max(1, Math.ceil(d / FLATTEN_PX));
			for (let s = 1; s <= steps; s++) {
				const t = s / steps;
				const u = 1 - t;
				flat.push({
					x: u * u * cx + 2 * u * t * px + t * t * ex,
					y: u * u * cy + 2 * u * t * py + t * t * ey
				});
			}
			cx = ex;
			cy = ey;
		}

		// Final straight segment to pts[n-1]
		const last = pts[pts.length - 1];
		const ld = Math.hypot(last.x - cx, last.y - cy);
		const ls = Math.max(1, Math.ceil(ld / FLATTEN_PX));
		for (let s = 1; s <= ls; s++) {
			const t = s / ls;
			flat.push({ x: cx + (last.x - cx) * t, y: cy + (last.y - cy) * t });
		}
		return flat;
	};

	/**
	 * Shortest distance² from point `c` to segment a→b.
	 * Used only in the fast-rejection phase.
	 */
	const _segDistSq = (a: Point, b: Point, c: Point): number => {
		const dx = b.x - a.x, dy = b.y - a.y;
		const lenSq = dx * dx + dy * dy;
		if (lenSq < 1e-10) return (c.x - a.x) ** 2 + (c.y - a.y) ** 2;
		const t = Math.max(0, Math.min(1, ((c.x - a.x) * dx + (c.y - a.y) * dy) / lenSq));
		const px = a.x + t * dx, py = a.y + t * dy;
		return (px - c.x) ** 2 + (py - c.y) ** 2;
	};

	/**
	 * Find parametric t-values in the open interval (0, 1) where the line
	 * segment a→b crosses the eraser circle boundary.
	 * Returns 0, 1, or 2 values in ascending order.
	 */
	const _circleTs = (a: Point, b: Point, center: Point, r2: number): number[] => {
		const dx = b.x - a.x, dy = b.y - a.y;
		const fx = a.x - center.x, fy = a.y - center.y;
		const A = dx * dx + dy * dy;
		if (A < 1e-10) return [];
		const B = 2 * (fx * dx + fy * dy);
		const C = fx * fx + fy * fy - r2;
		const disc = B * B - 4 * A * C;
		if (disc < 0) return [];
		const sqD = Math.sqrt(disc);
		const ts: number[] = [];
		const t1 = (-B - sqD) / (2 * A);
		const t2 = (-B + sqD) / (2 * A);
		if (t1 > 1e-6 && t1 < 1 - 1e-6) ts.push(t1);
		if (t2 > 1e-6 && t2 < 1 - 1e-6 && Math.abs(t2 - t1) > 1e-6) ts.push(t2);
		return ts;
	};

	/** Linear interpolation between two points. */
	const _lerp = (a: Point, b: Point, t: number): Point => ({
		x: a.x + (b.x - a.x) * t,
		y: a.y + (b.y - a.y) * t
	});

	/**
	 * Remove portions of pen strokes that fall inside the eraser circle.
	 *
	 * KEY INSIGHT — Bezier flattening before splitting:
	 *
	 *   `drawStroke` renders quadratic Bezier curves where recorded points are
	 *   **control points** — the rendered curve does NOT pass through them.
	 *   If the eraser splits on the raw recorded points, removing a control
	 *   point changes the Bezier for adjacent curve segments, causing a visible
	 *   "shape shift" on the remaining strokes.
	 *
	 *   We solve this by FLATTENING the Bezier into a dense polyline (~3 px
	 *   spacing) that follows the actual rendered path.  The eraser then
	 *   operates on these dense on-curve points.  Because consecutive points
	 *   are so close together, the Bezier smoothing applied by `drawStroke`
	 *   when re-rendering the split segments produces a curve that is
	 *   virtually identical to the original — no flinching.
	 *
	 * ALGORITHM — circle–segment intersection with boundary interpolation:
	 *     ① Both outside       — keep (or split if segment crosses the circle).
	 *     ② Both inside        — discard.
	 *     ③ Outside → Inside   — add boundary point, flush run.
	 *     ④ Inside  → Outside  — start new run from boundary point.
	 *
	 * Rules:
	 *   • Only pen strokes (`tool === 'pen'`) are affected.
	 *   • Elements (shapes / text / images) are never touched.
	 *   • The visual eraser circle IS the detection boundary (no hidden margin).
	 */
	const _eraseAtCenter = (inputStrokes: Stroke[], center: Point, eraserRadius: number): Stroke[] => {
		const r2 = eraserRadius * eraserRadius;
		const ptIn = (p: Point) => (p.x - center.x) ** 2 + (p.y - center.y) ** 2 <= r2;
		const result: Stroke[] = [];

		for (const stroke of inputStrokes) {
			// ❶ Only pen strokes are erasable
			if (stroke.tool !== 'pen') { result.push(stroke); continue; }
			const rawPts = stroke.points;
			if (rawPts.length === 0) continue;

			// ❷ Fast rejection using raw points (cheap — avoids flattening)
			let anyHit = false;
			for (let i = 0; i < rawPts.length; i++) {
				if (ptIn(rawPts[i])) { anyHit = true; break; }
				if (i > 0 && _segDistSq(rawPts[i - 1], rawPts[i], center) <= r2) { anyHit = true; break; }
			}
			if (!anyHit) { result.push(stroke); continue; }

			// ❸ Flatten Bezier → dense on-curve polyline (only for hit strokes)
			const pts = _flattenBezier(rawPts);

			// ❹ Walk every segment, building runs of "outside" points with
			//    precise boundary points interpolated at circle crossings.
			const segs: Point[][] = [];
			let seg: Point[] = [];

			// Seed the first point
			if (!ptIn(pts[0])) seg.push(pts[0]);

			for (let i = 1; i < pts.length; i++) {
				const a = pts[i - 1];
				const b = pts[i];
				const aIn = ptIn(a);
				const bIn = ptIn(b);

				if (!aIn && !bIn) {
					// ① Both outside — check if segment passes through the circle
					const ts = _circleTs(a, b, center, r2);
					if (ts.length >= 2) {
						seg.push(_lerp(a, b, ts[0]));
						if (seg.length >= 2) segs.push(seg);
						seg = [_lerp(a, b, ts[1]), b];
					} else {
						seg.push(b);
					}
				} else if (aIn && bIn) {
					// ② Both inside → discard
				} else if (!aIn && bIn) {
					// ③ Outside → Inside
					const ts = _circleTs(a, b, center, r2);
					if (ts.length > 0) seg.push(_lerp(a, b, ts[0]));
					if (seg.length >= 2) segs.push(seg);
					seg = [];
				} else {
					// ④ Inside → Outside
					const ts = _circleTs(a, b, center, r2);
					seg = ts.length > 0 ? [_lerp(a, b, ts[ts.length - 1])] : [];
					seg.push(b);
				}
			}
			if (seg.length >= 2) segs.push(seg);

			// Convert surviving runs back into stroke objects
			for (const s of segs) {
				result.push({ ...stroke, id: nextId(), points: s });
			}
		}

		return result;
	};

	/**
	 * Erase along the path from _prevEraserPt to `point`.
	 *
	 * Intermediate circles are placed at most `radius` px apart, which
	 * guarantees full coverage (every point on the path is within radius
	 * of at least one circle centre).  The cap of 200 prevents lag for
	 * extremely fast mouse jumps while keeping gaps negligible.
	 */
	const eraseAt = (point: Point) => {
		const radius = eraserSize / 2;
		let current = strokes;

		if (_prevEraserPt) {
			const dx = point.x - _prevEraserPt.x;
			const dy = point.y - _prevEraserPt.y;
			const dist = Math.hypot(dx, dy);
			const step = Math.max(2, radius);
			const numSteps = Math.min(Math.ceil(dist / step), 200);
			for (let i = 1; i <= numSteps; i++) {
				const t = i / numSteps;
				const c = { x: _prevEraserPt.x + dx * t, y: _prevEraserPt.y + dy * t };
				current = _eraseAtCenter(current, c, radius);
			}
		} else {
			current = _eraseAtCenter(current, point, radius);
		}

		_prevEraserPt = point;
		strokes = current;

		// Redraw immediately — no $effect frame delay.
		redrawCanvas();
	};

	/** Multi eraser: remove whole strokes and elements/connectors that intersect the circle. */
	const eraseMultiAt = (point: Point) => {
		const radius = eraserSize / 2;
		strokes = strokes.filter(
			(s) => !(s.tool === 'pen' && strokeIntersectsCircle(s, point, radius))
		);
		const r2 = radius * radius;
		elements = elements.filter((el) => {
			const px = Math.max(el.x, Math.min(point.x, el.x + el.width));
			const py = Math.max(el.y, Math.min(point.y, el.y + el.height));
			return (point.x - px) ** 2 + (point.y - py) ** 2 > r2;
		});
		redrawCanvas();
	};

	/* ── Pointer handlers ── */
	const elementAt = (target: EventTarget | null): string | null => {
		const element = (target as HTMLElement | null)?.closest(
			'[data-element-id]'
		) as HTMLElement | null;
		return element?.dataset.elementId ?? null;
	};

	const onStagePointerDown = (event: PointerEvent) => {
		/* Only react to primary (left) button; right-click is for context menu and must not start drag/marquee */
		if (event.button !== 0) return;
		const point = getPointFromPointer(event);
		if (pendingLibraryItem) {
			placeLibraryItemAt(point, pendingLibraryItem);
			pendingLibraryItem = null;
			return;
		}
		const clickedElementId = elementAt(event.target);
		guideLines = [];
		guideDistances = [];

		/* 연결선: 선택 도구에서 도형 호버 시 앵커 클릭으로 연결선 생성 (별도 connector 도구 없음) */
		if (activeTool === 'select' || activeTool === 'connector') {
			const anchorEl = (event.target as HTMLElement).closest?.('[data-anchor-id]');
			if (anchorEl) {
				const elId = anchorEl.getAttribute('data-element-id');
				const anchorId = anchorEl.getAttribute('data-anchor-id');
				if (elId && anchorId) {
					handleConnectorAnchorClick(elId, anchorId);
					return;
				}
			}
			if (pendingConnector && !anchorEl) pendingConnector = null;
			if (activeTool === 'connector') return;
		}

		/* 연결선 꺾임점/컨트롤 핸들 드래그 */
		const bendHandle = (event.target as HTMLElement).closest?.('[data-connector-bend]');
		if (bendHandle) {
			const connectorId = bendHandle.getAttribute('data-connector-id');
			if (connectorId && activeTool === 'select') {
				const conn = elements.find((e) => e.id === connectorId && e.type === 'connector');
				if (conn) {
					const pathData = getConnectorPath(conn, elements);
					const bend = pathData?.bendPoint;
					if (bend && pathData) {
						event.preventDefault();
						const isSelfConnector = conn.startElementId === conn.endElementId;
						const isOrthogonal = !isSelfConnector && conn.connectorType !== 'curved';
						const orthogonalBendVertical =
							isOrthogonal &&
							Math.abs((pathData.end?.x ?? 0) - (pathData.start?.x ?? 0)) <
								Math.abs((pathData.end?.y ?? 0) - (pathData.start?.y ?? 0));
						interaction = {
							kind: 'connector-bend',
							pointerId: event.pointerId,
							connectorId,
							start: point,
							originalBendX: isSelfConnector ? bend.x : (conn.connectorType === 'curved' ? undefined : bend.x),
							originalBendY:
								isSelfConnector ? bend.y : orthogonalBendVertical ? bend.y : (conn.connectorType === 'curved' ? undefined : undefined),
							originalControlX: !isSelfConnector && conn.connectorType === 'curved' ? bend.x : undefined,
							originalControlY: !isSelfConnector && conn.connectorType === 'curved' ? bend.y : undefined,
							orthogonalBendVertical: isOrthogonal ? orthogonalBendVertical : undefined
						};
					}
					return;
				}
			}
		}

		if (editingElementId && clickedElementId === editingElementId) {
			return;
		}
		editingElementId = null;

		/* 도형 클릭 시 펜/지우개여도 선택 모드로 전환하고 해당 도형 선택 */
		if (clickedElementId && (activeTool === 'pen' || activeTool === 'eraser' || activeTool === 'eraser-multi')) {
			activeTool = 'select';
		}

		if (activeTool === 'eraser' || activeTool === 'eraser-multi') {
			_prevEraserPt = null;
			if (activeTool === 'eraser-multi') {
				eraseMultiAt(point);
			} else {
				eraseAt(point);
			}
			interaction = { kind: 'erasing', pointerId: event.pointerId };
			return;
		}

		if (activeTool === 'pen') {
			startDrawing(point);
			interaction = { kind: 'drawing', pointerId: event.pointerId };
			return;
		}

		if (clickedElementId && activeTool !== 'select') {
			activeTool = 'select';
		}

		if (activeTool === 'select') {
			if (clickedElementId) {
				const clickedIds = collectGroupedIds(clickedElementId);
				if (event.shiftKey) {
					const next = [...selectedElementIds];
					const allSelected = clickedIds.every((id) => next.includes(id));
					if (allSelected) {
						setSelection(next.filter((id) => !clickedIds.includes(id)));
					} else {
						setSelection([...next, ...clickedIds]);
					}
					return;
				}

				const dragIds = selectedElementIds.includes(clickedElementId)
					? selectedElementIds
					: expandByGroups(clickedIds);
				setSelection(dragIds);

				const originById = Object.fromEntries(
					dragIds.map((id) => {
						const el = elements.find((item) => item.id === id);
						return [id, { x: el?.x ?? 0, y: el?.y ?? 0 }];
					})
				);
				interaction = {
					kind: 'drag',
					pointerId: event.pointerId,
					start: point,
					elementIds: dragIds,
					originById
				};
				return;
			}

			if (!event.shiftKey) {
				setSelection([]);
				selectedStrokeIds = [];
			}
			interaction = {
				kind: 'marquee',
				pointerId: event.pointerId,
				start: point,
				current: point,
				append: event.shiftKey
			};
			return;
		}

		if (
			activeTool === 'rect' ||
			activeTool === 'ellipse' ||
			activeTool === 'triangle' ||
			activeTool === 'line-h' ||
			activeTool === 'line-v' ||
			activeTool === 'image'
		) {
			addElementAt(activeTool, point);
			return;
		}

		if (activeTool === 'text') {
			addElementAt('text', point);
		}
	};

	const onStagePointerMove = (event: PointerEvent) => {
		const point = getPointFromPointer(event);
		if ((activeTool === 'select' || activeTool === 'connector') && pendingConnector) {
			connectorPreviewEnd = point;
		} else {
			connectorPreviewEnd = null;
		}

		if (!interaction || interaction.pointerId !== event.pointerId) return;
		const currentInteraction = interaction;

		if (currentInteraction.kind === 'drawing') {
			pushPointToStroke(point);
			return;
		}

		if (currentInteraction.kind === 'erasing') {
			if (activeTool === 'eraser-multi') {
				eraseMultiAt(point);
			} else {
				eraseAt(point);
			}
			return;
		}

		if (currentInteraction.kind === 'drag') {
			let dx = point.x - currentInteraction.start.x;
			let dy = point.y - currentInteraction.start.y;
			const selected = new Set(currentInteraction.elementIds);
			const staticElements = elements.filter((item) => !selected.has(item.id));
			const movingElements = elements
				.filter((item) => selected.has(item.id))
				.map((item) => {
					const origin = currentInteraction.originById[item.id];
					return origin
						? { ...item, x: origin.x + dx, y: origin.y + dy, width: item.width, height: item.height }
						: item;
				});
			const movingBounds = getBounds(movingElements);
			if (movingBounds) {
				const staticX = staticElements.flatMap((item) => [
					item.x,
					item.x + item.width / 2,
					item.x + item.width
				]);
				const staticY = staticElements.flatMap((item) => [
					item.y,
					item.y + item.height / 2,
					item.y + item.height
				]);
				const canvasX = [0, stageWidth / 2, stageWidth];
				const canvasY = [0, stageHeight / 2, stageHeight];

				const regularSnapX = getSnapDelta(
					[movingBounds.x, movingBounds.centerX, movingBounds.right],
					[...staticX, ...canvasX],
					snapThreshold
				);
				const regularSnapY = getSnapDelta(
					[movingBounds.y, movingBounds.centerY, movingBounds.bottom],
					[...staticY, ...canvasY],
					snapThreshold
				);
				const gapSnapX = getGapMatchSnap('x', movingBounds, staticElements, snapThreshold);
				const gapSnapY = getGapMatchSnap('y', movingBounds, staticElements, snapThreshold);

				const snapX = chooseCloserSnap(regularSnapX, gapSnapX);
				const snapY = chooseCloserSnap(regularSnapY, gapSnapY);
				const nextGuideLines: GuideLine[] = [];
				if (snapX) {
					dx += snapX.delta;
					nextGuideLines.push({ orientation: 'vertical', value: snapX.line });
				}
				if (snapY) {
					dy += snapY.delta;
					nextGuideLines.push({ orientation: 'horizontal', value: snapY.line });
				}
				guideLines = nextGuideLines;

				if (snapX || snapY) {
					const movedAfterSnap = movingElements.map((item) => ({
						...item,
						x: item.x + (snapX?.delta ?? 0),
						y: item.y + (snapY?.delta ?? 0)
					}));
					const snappedBounds = getBounds(movedAfterSnap);
					guideDistances = snappedBounds
						? getDistanceLabels(snappedBounds, staticElements)
						: [];
				} else {
					guideDistances = [];
				}
			} else {
				guideLines = [];
				guideDistances = [];
			}
			elements = elements.map((item) => {
				if (!selected.has(item.id)) return item;
				const origin = currentInteraction.originById[item.id];
				if (!origin) return item;
				const newX = Math.max(0, Math.min(stageWidth - item.width, origin.x + dx));
				const newY = Math.max(0, Math.min(stageHeight - item.height, origin.y + dy));
				return { ...item, x: newX, y: newY };
			});
			return;
		}

		if (currentInteraction.kind === 'drag-group') {
			let dx = point.x - currentInteraction.start.x;
			let dy = point.y - currentInteraction.start.y;
			const selectedSet = new Set(currentInteraction.elementIds);
			const originById = currentInteraction.originById;
			/* Clamp dx, dy so the whole group stays inside board; use AABB for rotated elements */
			let dxMin = -Infinity, dxMax = Infinity, dyMin = -Infinity, dyMax = Infinity;
			for (const item of elements) {
				if (!selectedSet.has(item.id)) continue;
				const o = originById[item.id];
				if (!o) continue;
				const rot = (item.rotation ?? 0) * (Math.PI / 180);
				const hw = item.width / 2;
				const hh = item.height / 2;
				const aabbHalfW = hw * Math.abs(Math.cos(rot)) + hh * Math.abs(Math.sin(rot));
				const aabbHalfH = hw * Math.abs(Math.sin(rot)) + hh * Math.abs(Math.cos(rot));
				const originCx = o.x + hw;
				const originCy = o.y + hh;
				dxMin = Math.max(dxMin, aabbHalfW - originCx);
				dxMax = Math.min(dxMax, stageWidth - originCx - aabbHalfW);
				dyMin = Math.max(dyMin, aabbHalfH - originCy);
				dyMax = Math.min(dyMax, stageHeight - originCy - aabbHalfH);
			}
			for (const s of currentInteraction.originStrokes) {
				for (const p of s.points) {
					dxMin = Math.max(dxMin, -p.x);
					dxMax = Math.min(dxMax, stageWidth - p.x);
					dyMin = Math.max(dyMin, -p.y);
					dyMax = Math.min(dyMax, stageHeight - p.y);
				}
			}
			dx = Math.max(dxMin, Math.min(dxMax, dx));
			dy = Math.max(dyMin, Math.min(dyMax, dy));
			interaction = { ...currentInteraction, currentDx: dx, currentDy: dy };
			elements = elements.map((item) => {
				if (!selectedSet.has(item.id)) return item;
				const origin = currentInteraction.originById[item.id];
				if (!origin) return item;
				const newX = origin.x + dx;
				const newY = origin.y + dy;
				return { ...item, x: newX, y: newY };
			});
			const originStrokeIds = new Set(currentInteraction.originStrokes.map((s) => s.id));
			strokes = strokes.map((s) => {
				if (!originStrokeIds.has(s.id) || s.tool !== 'pen') return s;
				const orig = currentInteraction.originStrokes.find((o) => o.id === s.id);
				if (!orig) return s;
				return {
					...s,
					points: orig.points.map((p) => ({
						x: Math.max(0, Math.min(stageWidth, p.x + dx)),
						y: Math.max(0, Math.min(stageHeight, p.y + dy))
					}))
				};
			});
			redrawCanvas();
			return;
		}

		if (currentInteraction.kind === 'resize') {
			const dx = point.x - currentInteraction.start.x;
			const dy = point.y - currentInteraction.start.y;
			const { handle, originX, originY, originWidth, originHeight } = currentInteraction;

			// Compute the four edges based on which handle is dragged
			let left = originX;
			let top = originY;
			let right = originX + originWidth;
			let bottom = originY + originHeight;
			if (handle.includes('e')) right = originX + originWidth + dx;
			if (handle.includes('w')) left = originX + dx;
			if (handle.includes('s')) bottom = originY + originHeight + dy;
			if (handle.includes('n')) top = originY + dy;

			// Normalise: support flipping when an edge crosses its opposite
			let newX = Math.min(left, right);
			let newY = Math.min(top, bottom);
			let newW = Math.max(10, Math.abs(right - left));
			let newH = Math.max(10, Math.abs(bottom - top));
			// Clamp to board
			newW = Math.min(newW, stageWidth - newX);
			newH = Math.min(newH, stageHeight - newY);
			newX = Math.max(0, Math.min(stageWidth - newW, newX));
			newY = Math.max(0, Math.min(stageHeight - newH, newY));
			newW = Math.max(10, Math.min(stageWidth - newX, newW));
			newH = Math.max(10, Math.min(stageHeight - newY, newH));

			updateElement(currentInteraction.elementId, (item) => ({
				...item,
				x: newX,
				y: newY,
				width: newW,
				height: newH
			}));
			return;
		}

		if (currentInteraction.kind === 'rotate') {
			const angle =
				Math.atan2(
					point.y - currentInteraction.center.y,
					point.x - currentInteraction.center.x
				) *
					(180 / Math.PI) +
				90;
			const delta = angle - currentInteraction.startAngle;
			let newRotation = currentInteraction.originRotation + delta;
			newRotation = ((newRotation % 360) + 360) % 360;
			updateElement(currentInteraction.elementId, (item) => ({
				...item,
				rotation: Math.round(newRotation * 10) / 10
			}));
			return;
		}

		if (currentInteraction.kind === 'connector-bend') {
			const dx = point.x - currentInteraction.start.x;
			const dy = point.y - currentInteraction.start.y;
			updateElement(currentInteraction.connectorId, (c) => {
				if (c.type !== 'connector') return c;
				if (c.startElementId === c.endElementId) {
					return {
						...c,
						connectorSelfBendX: (currentInteraction.originalBendX ?? 0) + dx,
						connectorSelfBendY: (currentInteraction.originalBendY ?? 0) + dy
					};
				}
				if (c.connectorType === 'curved') {
					return {
						...c,
						connectorControlX: (currentInteraction.originalControlX ?? 0) + dx,
						connectorControlY: (currentInteraction.originalControlY ?? 0) + dy
					};
				}
				if (currentInteraction.orthogonalBendVertical) {
					return {
						...c,
						connectorBendY: (currentInteraction.originalBendY ?? (c.y + c.height / 2)) + dy
					};
				}
				return {
					...c,
					connectorBendX: (currentInteraction.originalBendX ?? 0) + dx
				};
			});
			return;
		}

		if (currentInteraction.kind === 'resize-group') {
			const { handle, originBounds: ob, originBboxRotation: bboxRot, originElements, originStrokes } = currentInteraction;
			const useRotatedResize = bboxRot != null && bboxRot !== 0;
			const angleRad = useRotatedResize ? (bboxRot * Math.PI) / 180 : 0;
			const cos = Math.cos(angleRad);
			const sin = Math.sin(angleRad);
			const oldCx = ob.x + ob.width / 2;
			const oldCy = ob.y + ob.height / 2;
			const w2 = ob.width / 2;
			const h2 = ob.height / 2;

			let newX: number;
			let newY: number;
			let newW: number;
			let newH: number;

			if (useRotatedResize) {
				// Rotated resize: dragged handle moves to pointer; opposite edge/corner stays fixed.
				const dist = (ax: number, ay: number, bx: number, by: number) =>
					Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2);
				const px = point.x;
				const py = point.y;

				if (handle === 'e') {
					const fixX = oldCx - w2 * cos;
					const fixY = oldCy - w2 * sin;
					newW = Math.max(4, dist(fixX, fixY, px, py));
					newH = ob.height;
					const newCx = (fixX + px) / 2;
					const newCy = (fixY + py) / 2;
					newX = newCx - newW / 2;
					newY = newCy - newH / 2;
				} else if (handle === 'w') {
					const fixX = oldCx + w2 * cos;
					const fixY = oldCy + w2 * sin;
					newW = Math.max(4, dist(fixX, fixY, px, py));
					newH = ob.height;
					const newCx = (fixX + px) / 2;
					const newCy = (fixY + py) / 2;
					newX = newCx - newW / 2;
					newY = newCy - newH / 2;
				} else if (handle === 'n') {
					const fixX = oldCx - h2 * sin;
					const fixY = oldCy + h2 * cos;
					newW = ob.width;
					newH = Math.max(4, dist(fixX, fixY, px, py));
					const newCx = (fixX + px) / 2;
					const newCy = (fixY + py) / 2;
					newX = newCx - newW / 2;
					newY = newCy - newH / 2;
				} else if (handle === 's') {
					const fixX = oldCx + h2 * sin;
					const fixY = oldCy - h2 * cos;
					newW = ob.width;
					newH = Math.max(4, dist(fixX, fixY, px, py));
					const newCx = (fixX + px) / 2;
					const newCy = (fixY + py) / 2;
					newX = newCx - newW / 2;
					newY = newCy - newH / 2;
				} else {
					// Corner: fixed = opposite corner; new center = midpoint; new size from center-to-point in local
					let fixX: number, fixY: number;
					if (handle === 'ne') {
						fixX = oldCx - w2 * cos - h2 * sin;
						fixY = oldCy - w2 * sin + h2 * cos;
					} else if (handle === 'sw') {
						fixX = oldCx + w2 * cos + h2 * sin;
						fixY = oldCy + w2 * sin - h2 * cos;
					} else if (handle === 'nw') {
						fixX = oldCx + w2 * cos - h2 * sin;
						fixY = oldCy + w2 * sin + h2 * cos;
					} else {
						fixX = oldCx - w2 * cos + h2 * sin;
						fixY = oldCy - w2 * sin - h2 * cos;
					}
					const newCx = (fixX + px) / 2;
					const newCy = (fixY + py) / 2;
					const dx = px - newCx;
					const dy = py - newCy;
					const localX = dx * cos + dy * sin;
					const localY = -dx * sin + dy * cos;
					if (handle === 'ne') {
						newW = Math.max(4, 2 * localX);
						newH = Math.max(4, -2 * localY);
					} else if (handle === 'sw') {
						newW = Math.max(4, -2 * localX);
						newH = Math.max(4, 2 * localY);
					} else if (handle === 'nw') {
						newW = Math.max(4, -2 * localX);
						newH = Math.max(4, -2 * localY);
					} else {
						newW = Math.max(4, 2 * localX);
						newH = Math.max(4, 2 * localY);
					}
					newX = newCx - newW / 2;
					newY = newCy - newH / 2;
				}
			} else {
				const dx = point.x - currentInteraction.start.x;
				const dy = point.y - currentInteraction.start.y;
				let left = ob.x;
				let top = ob.y;
				let right = ob.x + ob.width;
				let bottom = ob.y + ob.height;
				if (handle.includes('e')) right = ob.x + ob.width + dx;
				if (handle.includes('w')) left = ob.x + dx;
				if (handle.includes('s')) bottom = ob.y + ob.height + dy;
				if (handle.includes('n')) top = ob.y + dy;
				newX = Math.min(left, right);
				newY = Math.min(top, bottom);
				newW = Math.max(4, Math.abs(right - left));
				newH = Math.max(4, Math.abs(bottom - top));
			}

			// Clamp to board
			newW = Math.min(newW, stageWidth - newX);
			newH = Math.min(newH, stageHeight - newY);
			newX = Math.max(0, Math.min(stageWidth - newW, newX));
			newY = Math.max(0, Math.min(stageHeight - newH, newY));
			newW = Math.max(4, Math.min(stageWidth - newX, newW));
			newH = Math.max(4, Math.min(stageHeight - newY, newH));

			const sx = newW / ob.width;
			const sy = newH / ob.height;
			const newCx = newX + newW / 2;
			const newCy = newY + newH / 2;
			const originElIds = new Set(originElements.map((e) => e.id));
			const originStrokeIds = new Set(originStrokes.map((s) => s.id));

			const scalePoint = (px: number, py: number): { x: number; y: number } => {
				if (!useRotatedResize) {
					return {
						x: newX + (px - ob.x) * sx,
						y: newY + (py - ob.y) * sy
					};
				}
				const relX = px - oldCx;
				const relY = py - oldCy;
				const u = ob.width / 2 + relX * cos + relY * sin;
				const v = ob.height / 2 - relX * sin + relY * cos;
				const newU = u * sx;
				const newV = v * sy;
				const newLocalX = newU - newW / 2;
				const newLocalY = newV - newH / 2;
				return {
					x: newCx + newLocalX * cos - newLocalY * sin,
					y: newCy + newLocalX * sin + newLocalY * cos
				};
			};

			elements = elements.map((item) => {
				if (!originElIds.has(item.id)) return item;
				const orig = originElements.find((e) => e.id === item.id);
				if (!orig) return item;
				const pos = scalePoint(orig.x, orig.y);
				return {
					...item,
					x: pos.x,
					y: pos.y,
					width: orig.width * sx,
					height: orig.height * sy
				};
			});
			strokes = strokes.map((s) => {
				if (!originStrokeIds.has(s.id) || s.tool !== 'pen') return s;
				const orig = originStrokes.find((o) => o.id === s.id);
				if (!orig) return s;
				return {
					...s,
					points: orig.points.map((p) => scalePoint(p.x, p.y))
				};
			});
			interaction = { ...currentInteraction, lastNewBounds: { x: newX, y: newY, width: newW, height: newH } };
			redrawCanvas();
			return;
		}

		if (currentInteraction.kind === 'rotate-group') {
			const { center, startAngle, originRotations, originElements, originStrokes } = currentInteraction;
			const angle =
				Math.atan2(point.y - center.y, point.x - center.x) * (180 / Math.PI) + 90;
			const deltaDeg = angle - startAngle;
			interaction = { ...currentInteraction, currentDeltaDeg: deltaDeg };
			const deltaRad = (deltaDeg * Math.PI) / 180;
			const cos = Math.cos(deltaRad);
			const sin = Math.sin(deltaRad);
			const rotatePoint = (px: number, py: number) => ({
				x: center.x + (px - center.x) * cos - (py - center.y) * sin,
				y: center.y + (px - center.x) * sin + (py - center.y) * cos
			});
			/* Rigid-body rotation: rotate each element's center around group center, then set x,y and rotation */
			elements = elements.map((el) => {
				const orig = originElements.find((o) => o.id === el.id);
				const origRot = originRotations[el.id];
				if (orig === undefined || origRot === undefined) return el;
				const origCx = orig.x + orig.width / 2;
				const origCy = orig.y + orig.height / 2;
				const newCenter = rotatePoint(origCx, origCy);
				let newRot = origRot + deltaDeg;
				newRot = ((newRot % 360) + 360) % 360;
				return {
					...el,
					x: newCenter.x - el.width / 2,
					y: newCenter.y - el.height / 2,
					rotation: Math.round(newRot * 10) / 10
				};
			});
			strokes = strokes.map((s) => {
				const orig = originStrokes.find((o) => o.id === s.id);
				if (!orig || s.tool !== 'pen') return s;
				return {
					...s,
					points: orig.points.map((p) => rotatePoint(p.x, p.y))
				};
			});
			redrawCanvas();
			return;
		}

		if (currentInteraction.kind === 'marquee') {
			interaction = { ...currentInteraction, current: point };
		}
	};

	const onStagePointerUp = (event: PointerEvent) => {
		if (!interaction || interaction.pointerId !== event.pointerId) return;

		if (interaction.kind === 'drawing') {
			// Commit the live stroke to reactive state, then snapshot for undo
			commitLiveStroke();
			commitSnapshot();
		} else if (interaction.kind === 'erasing') {
			_prevEraserPt = null; // end sweep session
			commitSnapshot();
		} else if (interaction.kind === 'marquee') {
			const x1 = Math.min(interaction.start.x, interaction.current.x);
			const y1 = Math.min(interaction.start.y, interaction.current.y);
			const x2 = Math.max(interaction.start.x, interaction.current.x);
			const y2 = Math.max(interaction.start.y, interaction.current.y);
			const w = x2 - x1;
			const h = y2 - y1;
			const hits = elements
				.filter(
					(item) =>
						item.x < x2 &&
						item.x + item.width > x1 &&
						item.y < y2 &&
						item.y + item.height > y1
				)
				.map((item) => item.id);
			const expandedHits = expandByGroups(hits);
			setSelection(
				interaction.append ? [...selectedElementIds, ...expandedHits] : expandedHits
			);
			const strokeHits = strokes
				.filter((s) => s.tool === 'pen' && strokeIntersectsRect(s, x1, y1, w, h))
				.map((s) => s.id);
			selectedStrokeIds = interaction.append
				? [...selectedStrokeIds, ...strokeHits]
				: strokeHits;
			if (expandedHits.length > 0 || strokeHits.length > 0) activeTool = 'select';
		} else if (interaction.kind === 'connector-bend') {
			refreshConnectorBounds();
			commitSnapshot();
		} else if (interaction.kind === 'resize-group') {
			if (interaction.lastNewBounds) {
				selectionBboxBoundsPersisted = { ...interaction.lastNewBounds };
			}
			commitSnapshot();
		} else if (interaction.kind === 'rotate-group') {
			selectionBboxRotationPersisted =
				interaction.originBboxRotation + (interaction.currentDeltaDeg ?? 0);
			selectionBboxBoundsPersisted = interaction.originBounds
				? { ...interaction.originBounds }
				: selectionBboxBoundsPersisted;
			refreshConnectorBounds();
			commitSnapshot();
		} else if (interaction.kind === 'drag-group') {
			const point = getPointFromPointer(event);
			const dx = point.x - interaction.start.x;
			const dy = point.y - interaction.start.y;
			if (selectionBboxBoundsPersisted) {
				selectionBboxBoundsPersisted = {
					...selectionBboxBoundsPersisted,
					x: selectionBboxBoundsPersisted.x + dx,
					y: selectionBboxBoundsPersisted.y + dy
				};
			}
			refreshConnectorBounds();
			commitSnapshot();
		} else {
			refreshConnectorBounds();
			commitSnapshot();
		}

		guideLines = [];
		guideDistances = [];
		interaction = null;
	};

	/** End current interaction when pointer leaves the board (drag/pen released outside). */
	const endInteractionOnLeave = () => {
		connectorPreviewEnd = null;
		if (!interaction) return;
		const current = interaction;
		if (current.kind === 'drawing') {
			commitLiveStroke();
			commitSnapshot();
		} else if (current.kind === 'erasing') {
			_prevEraserPt = null;
			commitSnapshot();
		} else if (current.kind === 'marquee') {
			/* Cancel marquee selection when leaving board */
		} else if (
			current.kind === 'connector-bend' ||
			current.kind === 'resize-group' ||
			current.kind === 'rotate-group' ||
			current.kind === 'drag-group' ||
			current.kind === 'drag' ||
			current.kind === 'resize' ||
			current.kind === 'rotate'
		) {
			if (current.kind === 'resize-group' && current.lastNewBounds) {
				selectionBboxBoundsPersisted = { ...current.lastNewBounds };
			}
			if (current.kind === 'rotate-group') {
				selectionBboxRotationPersisted =
					current.originBboxRotation + (current.currentDeltaDeg ?? 0);
				selectionBboxBoundsPersisted = current.originBounds
					? { ...current.originBounds }
					: selectionBboxBoundsPersisted;
			}
			if (current.kind === 'drag-group' && selectionBboxBoundsPersisted && current.currentDx != null && current.currentDy != null) {
				selectionBboxBoundsPersisted = {
					...selectionBboxBoundsPersisted,
					x: selectionBboxBoundsPersisted.x + current.currentDx,
					y: selectionBboxBoundsPersisted.y + current.currentDy
				};
			}
			refreshConnectorBounds();
			commitSnapshot();
		} else {
			refreshConnectorBounds();
			commitSnapshot();
		}
		guideLines = [];
		guideDistances = [];
		interaction = null;
	};

	const beginResize = (event: PointerEvent, elementId: string, handle: ResizeHandle) => {
		if (activeTool !== 'select' || selectedElementIds.length !== 1) return;
		event.stopPropagation();
		const element = elements.find((item) => item.id === elementId);
		if (!element) return;
		const point = getPointFromPointer(event);
		interaction = {
			kind: 'resize',
			pointerId: event.pointerId,
			elementId,
			handle,
			start: point,
			originX: element.x,
			originY: element.y,
			originWidth: element.width,
			originHeight: element.height
		};
	};

	const beginRotate = (event: PointerEvent, elementId: string) => {
		if (activeTool !== 'select' || selectedElementIds.length !== 1) return;
		event.stopPropagation();
		const element = elements.find((item) => item.id === elementId);
		if (!element) return;
		const point = getPointFromPointer(event);
		const center: Point = {
			x: element.x + element.width / 2,
			y: element.y + element.height / 2
		};
		const startAngle =
			Math.atan2(point.y - center.y, point.x - center.x) * (180 / Math.PI) + 90;
		interaction = {
			kind: 'rotate',
			pointerId: event.pointerId,
			elementId,
			center,
			startAngle,
			originRotation: element.rotation
		};
	};

	const beginResizeGroup = (event: PointerEvent, handle: ResizeHandle) => {
		if (activeTool !== 'select' || !selectionBounds) return;
		event.stopPropagation();
		const point = getPointFromPointer(event);
		const selectedSet = new Set(selectedElementIds);
		const strokeSet = new Set(selectedStrokeIds);
		const bbox = selectionBboxBounds ?? selectionBounds;
		const originBounds = { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height };
		const rot = selectionBboxRotationPersisted;
		interaction = {
			kind: 'resize-group',
			pointerId: event.pointerId,
			handle,
			start: point,
			originBounds,
			...(rot !== 0 ? { originBboxRotation: rot } : {}),
			lastNewBounds: { ...originBounds },
			originElements: elements
				.filter((el) => selectedSet.has(el.id))
				.map((el) => ({ id: el.id, x: el.x, y: el.y, width: el.width, height: el.height })),
			originStrokes: strokes
				.filter((s) => strokeSet.has(s.id) && s.tool === 'pen')
				.map((s) => ({ id: s.id, points: s.points.map((p) => ({ x: p.x, y: p.y })) }))
		};
	};

	const beginRotateGroup = (event: PointerEvent) => {
		if (activeTool !== 'select' || !selectionBounds || (selectedElementIds.length === 0 && selectedStrokeIds.length === 0)) return;
		event.stopPropagation();
		const point = getPointFromPointer(event);
		const center: Point = {
			x: selectionBounds.x + selectionBounds.width / 2,
			y: selectionBounds.y + selectionBounds.height / 2
		};
		const startAngle =
			Math.atan2(point.y - center.y, point.x - center.x) * (180 / Math.PI) + 90;
		const originRotations: Record<string, number> = {};
		const originElements: { id: string; x: number; y: number; width: number; height: number }[] = [];
		for (const id of selectedElementIds) {
			const el = elements.find((e) => e.id === id);
			if (el) {
				originRotations[id] = el.rotation ?? 0;
				originElements.push({ id: el.id, x: el.x, y: el.y, width: el.width, height: el.height });
			}
		}
		const strokeSet = new Set(selectedStrokeIds);
		selectionBboxBoundsPersisted = {
			x: selectionBounds.x,
			y: selectionBounds.y,
			width: selectionBounds.width,
			height: selectionBounds.height
		};
		interaction = {
			kind: 'rotate-group',
			pointerId: event.pointerId,
			center,
			startAngle,
			originBounds: {
				x: selectionBounds.x,
				y: selectionBounds.y,
				width: selectionBounds.width,
				height: selectionBounds.height
			},
			originBboxRotation: selectionBboxRotationPersisted,
			originRotations,
			originElements,
			originStrokes: strokes
				.filter((s) => strokeSet.has(s.id) && s.tool === 'pen')
				.map((s) => ({ id: s.id, points: s.points.map((p) => ({ x: p.x, y: p.y })) }))
		};
	};

	const beginDragGroup = (event: PointerEvent) => {
		if (activeTool !== 'select' || (selectedElementIds.length === 0 && selectedStrokeIds.length === 0)) return;
		event.stopPropagation();
		const point = getPointFromPointer(event);
		const originById: Record<string, Point> = {};
		for (const id of selectedElementIds) {
			const el = elements.find((e) => e.id === id);
			if (el) originById[id] = { x: el.x, y: el.y };
		}
		const strokeSet = new Set(selectedStrokeIds);
		interaction = {
			kind: 'drag-group',
			pointerId: event.pointerId,
			start: point,
			elementIds: [...selectedElementIds],
			originById,
			originStrokes: strokes
				.filter((s) => strokeSet.has(s.id) && s.tool === 'pen')
				.map((s) => ({ id: s.id, points: s.points.map((p) => ({ x: p.x, y: p.y })) }))
		};
	};

	/* ── Actions ── */
	const setTextAlign = (align: TextAlign) => {
		if (selectedElementIds.length === 0) return;
		updateSelectedElements((item) =>
			TEXT_EDITABLE_TYPES.includes(item.type) ? { ...item, textAlign: align } : item
		);
		commitSnapshot();
	};

	const setTextVerticalAlign = (align: TextVerticalAlign) => {
		if (selectedElementIds.length === 0) return;
		updateSelectedElements((item) =>
			TEXT_EDITABLE_TYPES.includes(item.type) ? { ...item, textVerticalAlign: align } : item
		);
		commitSnapshot();
	};

	const alignSelected = (mode: AlignMode) => {
		if (selectedElements.length < 2) return;
		const minX = Math.min(...selectedElements.map((item) => item.x));
		const maxX = Math.max(...selectedElements.map((item) => item.x + item.width));
		const minY = Math.min(...selectedElements.map((item) => item.y));
		const maxY = Math.max(...selectedElements.map((item) => item.y + item.height));
		const selected = new Set(selectedElementIds);
		elements = elements.map((item) => {
			if (!selected.has(item.id)) return item;
			if (mode === 'left') return { ...item, x: minX };
			if (mode === 'center') return { ...item, x: minX + (maxX - minX - item.width) / 2 };
			if (mode === 'right') return { ...item, x: maxX - item.width };
			if (mode === 'top') return { ...item, y: minY };
			if (mode === 'middle')
				return { ...item, y: minY + (maxY - minY - item.height) / 2 };
			return { ...item, y: maxY - item.height };
		});
		commitSnapshot();
	};

	const distributeSelected = (mode: DistributeMode) => {
		if (!canDistribute) return;
		const axis: Axis = mode === 'horizontal' ? 'x' : 'y';
		const sizeKey = mode === 'horizontal' ? 'width' : 'height';
		const ordered = [...selectedElements].sort((a, b) => a[axis] - b[axis]);
		const first = ordered[0];
		const last = ordered.at(-1);
		if (!first || !last) return;
		const totalSpan = last[axis] + last[sizeKey] - first[axis];
		const occupied = ordered.reduce((sum, item) => sum + item[sizeKey], 0);
		const gap = (totalSpan - occupied) / (ordered.length - 1);
		if (!Number.isFinite(gap)) return;

		let cursor = first[axis];
		const nextMap = new Map<string, number>();
		ordered.forEach((item, idx) => {
			if (idx === 0) {
				nextMap.set(item.id, first[axis]);
				cursor = first[axis] + item[sizeKey] + gap;
				return;
			}
			nextMap.set(item.id, cursor);
			cursor += item[sizeKey] + gap;
		});

		elements = elements.map((item) => {
			const next = nextMap.get(item.id);
			if (next === undefined) return item;
			return axis === 'x' ? { ...item, x: next } : { ...item, y: next };
		});
		commitSnapshot();
	};

	const groupSelected = () => {
		if (!canGroup) return;
		const groupId = nextId();
		const selected = new Set(selectedElementIds);
		elements = elements.map((item) =>
			selected.has(item.id) ? { ...item, groupId } : item
		);
		commitSnapshot();
	};

	const ungroupSelected = () => {
		if (!canUngroup) return;
		const selected = new Set(selectedElementIds);
		elements = elements.map((item) =>
			selected.has(item.id) ? { ...item, groupId: undefined } : item
		);
		commitSnapshot();
	};

	const deleteSelectedElement = () => {
		const hasElements = selectedElementIds.length > 0;
		const hasStrokes = selectedStrokeIds.length > 0;
		if (!hasElements && !hasStrokes) return;
		const selected = new Set(selectedElementIds);
		const idsToDelete = new Set(selected);
		elements
			.filter(
				(el) =>
					el.type === 'connector' &&
					el.startElementId != null &&
					el.endElementId != null &&
					(selected.has(el.startElementId) || selected.has(el.endElementId))
			)
			.forEach((c) => idsToDelete.add(c.id));
		elements = elements.filter((item) => !idsToDelete.has(item.id));
		const strokeIdsToDelete = new Set(selectedStrokeIds);
		strokes = strokes.filter((s) => !strokeIdsToDelete.has(s.id));
		selectedElementIds = [];
		selectedStrokeIds = [];
		editingElementId = null;
		pendingConnector = null;
		redrawCanvas();
		commitSnapshot();
	};

	const duplicateSelectedElement = () => {
		if (selectedElementIds.length === 0) return;
		const selectedSet = new Set(selectedElementIds);
		const source = elements.filter((item) => selectedSet.has(item.id));
		const groupMap = new Map<string, string>();
		const duplicated = source.map((item) => {
			let nextGroupId: string | undefined;
			if (item.groupId) {
				if (!groupMap.has(item.groupId)) {
					groupMap.set(item.groupId, nextId());
				}
				nextGroupId = groupMap.get(item.groupId);
			}
			return {
				...deepClone(item),
				id: nextId(),
				groupId: nextGroupId,
				x: item.x + 20,
				y: item.y + 20
			};
		});
		elements = [...elements, ...duplicated];
		refreshConnectorBounds();
		setSelection(duplicated.map((item) => item.id));
		commitSnapshot();
	};

	/** Place a library item on the board at the given point (top-left of content bbox at point). */
	function placeLibraryItemAt(placePoint: Point, item: LibraryItem) {
		const { elements: libEls, strokes: libStrokes } = item;
		let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
		for (const el of libEls) {
			minX = Math.min(minX, el.x);
			minY = Math.min(minY, el.y);
			maxX = Math.max(maxX, el.x + el.width);
			maxY = Math.max(maxY, el.y + el.height);
		}
		for (const s of libStrokes) {
			const b = getStrokeBounds(s);
			if (b) {
				minX = Math.min(minX, b.x);
				minY = Math.min(minY, b.y);
				maxX = Math.max(maxX, b.right);
				maxY = Math.max(maxY, b.bottom);
			}
		}
		if (minX === Infinity) return;
		const w = maxX - minX;
		const h = maxY - minY;
		const placeX = Math.max(0, Math.min(stageWidth - w, placePoint.x));
		const placeY = Math.max(0, Math.min(stageHeight - h, placePoint.y));
		const idMap = new Map<string, string>();
		for (const el of libEls) idMap.set(el.id, nextId());
		const newElements: BoardElement[] = libEls.map((el) => ({
			...deepClone(el),
			id: idMap.get(el.id)!,
			x: el.x - minX + placeX,
			y: el.y - minY + placeY,
			startElementId: el.startElementId ? (idMap.get(el.startElementId) ?? el.startElementId) : undefined,
			endElementId: el.endElementId ? (idMap.get(el.endElementId) ?? el.endElementId) : undefined
		}));
		const newStrokes: Stroke[] = libStrokes.map((s) => ({
			...deepClone(s),
			id: nextId(),
			points: s.points.map((p) => ({ x: p.x - minX + placeX, y: p.y - minY + placeY }))
		}));
		elements = [...elements, ...newElements];
		strokes = [...strokes, ...newStrokes];
		setSelection(newElements.map((e) => e.id));
		selectedStrokeIds = newStrokes.map((s) => s.id);
		refreshConnectorBounds();
		redrawCanvas();
		commitSnapshot();
	}

	const handleStageContextMenu = (e: MouseEvent) => {
		e.preventDefault();
		interaction = null;
		const point = getPointFromPointer(e as unknown as PointerEvent);
		/* If right-clicked on an element, select it (and its group) first */
		const el = (e.target as HTMLElement).closest?.('[data-element-id]');
		const elementId = el?.getAttribute('data-element-id') ?? null;
		if (elementId) {
			setSelection(expandByGroups(collectGroupedIds(elementId)));
			activeTool = 'select';
		}
		const hadSelection = selectedElementIds.length > 0 || selectedStrokeIds.length > 0;
		const hasSelection = !!elementId || hadSelection;

		const MENU_W = 180;
		const MENU_H = 160;
		let x = e.clientX;
		let y = e.clientY;
		if (stageWrapRef) {
			const r = stageWrapRef.getBoundingClientRect();
			x = Math.max(r.left, Math.min(x, r.right - MENU_W));
			y = Math.max(r.top, Math.min(y, r.bottom - MENU_H));
		}

		if (hasSelection) {
			/* Show element menu only when right-click is inside selection bounds */
			const bounds = selectionBounds;
			if (hadSelection && !elementId && bounds) {
				const inside =
					point.x >= bounds.x &&
					point.x <= bounds.x + bounds.width &&
					point.y >= bounds.y &&
					point.y <= bounds.y + bounds.height;
				if (!inside) {
					setSelection([]);
					selectedStrokeIds = [];
					/* Show paste menu at this position if clipboard has items */
					if (_clipboard.length > 0) {
						contextMenuAt = { x, y };
						contextMenuMode = 'paste';
						contextMenuPasteAt = { x: point.x, y: point.y };
					}
					return;
				}
			}
			contextMenuAt = { x, y };
			contextMenuMode = 'element';
			contextMenuPasteAt = null;
			return;
		}

		/* Empty area: show paste menu if clipboard has items */
		if (_clipboard.length > 0) {
			contextMenuAt = { x, y };
			contextMenuMode = 'paste';
			contextMenuPasteAt = { x: point.x, y: point.y };
		}
	};

	const openSaveLibraryNameModal = () => {
		contextMenuAt = null;
		contextMenuMode = null;
		contextMenuPasteAt = null;
		showSaveLibraryNameModal = true;
	};

	const handleContextMenuCopy = () => {
		contextMenuAt = null;
		contextMenuMode = null;
		contextMenuPasteAt = null;
		if (selectedElementIds.length > 0) {
			_clipboard = elements.filter((el) => selectedElementIds.includes(el.id)).map((el) => deepClone(el));
			toast.success('Copied.');
		}
	};

	const handleContextMenuDelete = () => {
		contextMenuAt = null;
		contextMenuMode = null;
		contextMenuPasteAt = null;
		deleteSelectedElement();
	};

	/** Paste clipboard at a given stage point (top-left of clipboard bbox at point). Clamps so pasted content stays within board bounds. */
	function pasteAtPoint(at: Point) {
		if (_clipboard.length === 0) return;
		const groupMap = new Map<string, string>();
		for (const orig of _clipboard) {
			if (orig.groupId && !groupMap.has(orig.groupId)) {
				groupMap.set(orig.groupId, nextId());
			}
		}
		let minX = Infinity;
		let minY = Infinity;
		for (const el of _clipboard) {
			minX = Math.min(minX, el.x);
			minY = Math.min(minY, el.y);
		}
		let dx = at.x - minX;
		let dy = at.y - minY;
		let newEls: BoardElement[] = _clipboard.map((el) => ({
			...JSON.parse(JSON.stringify(el)),
			id: nextId(),
			groupId: el.groupId ? groupMap.get(el.groupId) : undefined,
			x: el.x + dx,
			y: el.y + dy
		}));
		// Clamp pasted bbox to board bounds [0,0]..[stageWidth, stageHeight]
		let pastedMinX = Infinity;
		let pastedMinY = Infinity;
		let pastedMaxX = -Infinity;
		let pastedMaxY = -Infinity;
		for (const el of newEls) {
			pastedMinX = Math.min(pastedMinX, el.x);
			pastedMinY = Math.min(pastedMinY, el.y);
			pastedMaxX = Math.max(pastedMaxX, el.x + (el.width ?? 0));
			pastedMaxY = Math.max(pastedMaxY, el.y + (el.height ?? 0));
		}
		let shiftX = Math.max(0, -pastedMinX);
		shiftX = Math.min(shiftX, stageWidth - pastedMaxX);
		let shiftY = Math.max(0, -pastedMinY);
		shiftY = Math.min(shiftY, stageHeight - pastedMaxY);
		newEls = newEls.map((el) => ({ ...el, x: el.x + shiftX, y: el.y + shiftY }));
		elements = [...elements, ...newEls];
		setSelection(newEls.map((e) => e.id));
		commitSnapshot();
	}

	const handleContextMenuPaste = () => {
		const at = contextMenuPasteAt;
		contextMenuAt = null;
		contextMenuMode = null;
		contextMenuPasteAt = null;
		if (at) pasteAtPoint(at);
	};

	/** When context menu is open and user right-clicks on backdrop: close menu, then select/paste under cursor. */
	const handleContextMenuBackdropContextMenu = (e: MouseEvent) => {
		e.preventDefault();
		const x = e.clientX;
		const y = e.clientY;
		contextMenuAt = null;
		contextMenuMode = null;
		contextMenuPasteAt = null;
		requestAnimationFrame(() => {
			const target = document.elementFromPoint(x, y) as HTMLElement | null;
			const wrap = stageWrapRef;
			if (!wrap?.contains(target)) {
				setSelection([]);
				selectedStrokeIds = [];
				return;
			}
			const el = target?.closest?.('[data-element-id]');
			const elementId = el?.getAttribute('data-element-id') ?? null;
			if (elementId) {
				setSelection(expandByGroups(collectGroupedIds(elementId)));
				activeTool = 'select';
				const MENU_W = 180;
				const MENU_H = 160;
				let mx = x;
				let my = y;
				const r = wrap.getBoundingClientRect();
				mx = Math.max(r.left, Math.min(x, r.right - MENU_W));
				my = Math.max(r.top, Math.min(y, r.bottom - MENU_H));
				contextMenuAt = { x: mx, y: my };
				contextMenuMode = 'element';
				contextMenuPasteAt = null;
			} else {
				setSelection([]);
				selectedStrokeIds = [];
				if (_clipboard.length > 0 && wrap) {
					const rect = stageRef?.getBoundingClientRect();
					if (rect) {
						const px = x - rect.left;
						const py = y - rect.top;
						const MENU_W = 180;
						const MENU_H = 60;
						let mx = x;
						let my = y;
						const r = wrap.getBoundingClientRect();
						mx = Math.max(r.left, Math.min(x, r.right - MENU_W));
						my = Math.max(r.top, Math.min(y, r.bottom - MENU_H));
						contextMenuAt = { x: mx, y: my };
						contextMenuMode = 'paste';
						contextMenuPasteAt = { x: px, y: py };
					}
				}
			}
		});
	};

	const handleSaveLibraryWithName = async (name: string) => {
		const elIds = new Set(selectedElementIds);
		const strokeIds = new Set(selectedStrokeIds);
		const toSave = elements.filter((e) => elIds.has(e.id));
		const strokesToSave = strokes.filter((s) => strokeIds.has(s.id));
		let thumbnail: string | undefined;
		const THUMB_PADDING = 24;
		if (toSave.length > 0 || strokesToSave.length > 0) {
			let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
			for (const el of toSave) {
				const b = getElementVisualBounds(el, toSave);
				minX = Math.min(minX, b.minX);
				minY = Math.min(minY, b.minY);
				maxX = Math.max(maxX, b.maxX);
				maxY = Math.max(maxY, b.maxY);
			}
			for (const s of strokesToSave) {
				const b = getStrokeBounds(s);
				if (b) {
					minX = Math.min(minX, b.x);
					minY = Math.min(minY, b.y);
					maxX = Math.max(maxX, b.right);
					maxY = Math.max(maxY, b.bottom);
				}
			}
			if (minX !== Infinity) {
				minX -= THUMB_PADDING;
				minY -= THUMB_PADDING;
				maxX += THUMB_PADDING;
				maxY += THUMB_PADDING;
				const w = Math.max(1, maxX - minX);
				const h = Math.max(1, maxY - minY);
				const shiftedElements = toSave.map((e) => ({ ...e, x: e.x - minX, y: e.y - minY }));
				const shiftedStrokes = strokesToSave.map((s) => ({
					...s,
					points: s.points.map((p) => ({ x: p.x - minX, y: p.y - minY }))
				}));
				const imageMap = await loadImages(shiftedElements);
				thumbnail = renderThumbnail(
					w,
					h,
					currentTheme.background,
					currentTheme.gridColor,
					shiftedStrokes,
					shiftedElements,
					imageMap,
					gridEnabled,
					gridSize
				);
			}
		}
		saveLibraryItem(name, toSave, strokesToSave, thumbnail);
		toast.success('Saved to library.');
		setSelection([]);
		selectedStrokeIds = [];
	};

	const handleInsertFromLibrary = (item: LibraryItem) => {
		showLibraryModal = false;
		pendingLibraryItem = item;
		toast.info('Click on the board to place.');
	};

	/* ── Canvas ── */
	const redrawCanvas = () => {
		if (!drawCanvas) return;
		const ctx = drawCanvas.getContext('2d');
		if (!ctx) return;
		drawThemeBackground(
			ctx,
			stageWidth,
			stageHeight,
			currentTheme.background,
			currentTheme.gridColor,
			gridEnabled,
			gridSize
		);
		strokes.forEach((stroke) => drawStroke(ctx, stroke));
	};

	const downloadPdf = async () => {
		const imageMap = await loadImages(elements);
		const renderCanvas = document.createElement('canvas');
		renderCanvas.width = stageWidth;
		renderCanvas.height = stageHeight;
		const ctx = renderCanvas.getContext('2d');
		if (!ctx) return;
		drawThemeBackground(
			ctx,
			stageWidth,
			stageHeight,
			currentTheme.background,
			currentTheme.gridColor,
			gridEnabled,
			gridSize
		);
		strokes.forEach((stroke) => drawStroke(ctx, stroke));
		elements.forEach((element) => drawElementToCanvas(ctx, element, imageMap, elements));
		const orientation = stageWidth > stageHeight ? 'landscape' : 'portrait';
		const pdf = new jsPDF({ orientation, unit: 'px', format: [stageWidth, stageHeight] });
		pdf.addImage(
			renderCanvas.toDataURL('image/png'),
			'PNG',
			0,
			0,
			stageWidth,
			stageHeight
		);
		pdf.save(`${boardTitle || 'board'}.pdf`);
		toast.success('Exported as PDF.');
	};

	/** Export the full board as a PNG image file. */
	const downloadBoardImage = async () => {
		const imageMap = await loadImages(elements);
		const renderCanvas = document.createElement('canvas');
		renderCanvas.width = stageWidth;
		renderCanvas.height = stageHeight;
		const ctx = renderCanvas.getContext('2d');
		if (!ctx) return;
		drawThemeBackground(ctx, stageWidth, stageHeight, currentTheme.background, currentTheme.gridColor, gridEnabled, gridSize);
		strokes.forEach((stroke) => drawStroke(ctx, stroke));
		elements.forEach((element) => drawElementToCanvas(ctx, element, imageMap, elements));
		renderCanvas.toBlob(
			(blob) => {
				if (!blob) return;
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = `${boardTitle || 'board'}.png`;
				a.click();
				URL.revokeObjectURL(url);
				toast.success('Exported as image.');
			},
			'image/png'
		);
	};

	const applyThemeDefaults = () => {
		penColor = currentTheme.defaultStrokeColor;
		fillColor = currentTheme.defaultFillColor;
	};

	const updateCanvasSize = () => {
		if (!stageRef || !drawCanvas) return;
		const rect = stageRef.getBoundingClientRect();
		const w = Math.max(stageWidth, Math.floor(rect.width));
		const h = Math.max(stageHeight, Math.floor(rect.height));
		stageWidth = w;
		stageHeight = h;
		drawCanvas.width = stageWidth;
		drawCanvas.height = stageHeight;
		redrawCanvas();
	};

	/* ── Stage callbacks forwarded to BoardStage ── */
	const handleElementTextChange = (id: string, text: string) => {
		updateElement(id, (item) => ({ ...item, text }));
	};

	const handleElementTextBlur = () => {
		editingElementId = null;
		commitSnapshot();
	};

	/* ── Effects & lifecycle ── */
	/* ── Unsaved changes guard ── */
	beforeNavigate(({ cancel, to, from }) => {
		if (from?.params?.id && to && stageWrapRef) {
			try {
				sessionStorage.setItem(
					`board-scroll-${from.params.id}`,
					JSON.stringify({ x: stageWrapRef.scrollLeft, y: stageWrapRef.scrollTop })
				);
			} catch (_) {}
		}
		if (!isDirty) return;
		cancel();
		_pendingNavUrl = to?.url.pathname ?? '/';
		showUnsavedModal = true;
	});

	const handleSaveAndLeave = async () => {
		await saveBoard();          // sets isDirty = false → next goto() won't be intercepted
		showUnsavedModal = false;
		if (_pendingNavUrl) goto(_pendingNavUrl);
		_pendingNavUrl = null;
	};

	const handleLeaveWithoutSave = () => {
		_contentDirty = false;
		_lastSavedTitle = boardTitle; // treat current title as "saved" so we don't re-intercept
		showUnsavedModal = false;
		if (_pendingNavUrl) goto(_pendingNavUrl);
		_pendingNavUrl = null;
	};

	const handleCancelLeave = () => {
		showUnsavedModal = false;
		_pendingNavUrl = null;
	};

	$effect(() => {
		redrawCanvas();
	});

	$effect(() => {
		refreshImportBoards();
	});

	onMount(() => {
		loadBoard().then(() => updateCanvasSize());
		const observer = new ResizeObserver(() => {
			updateCanvasSize();
		});
		if (stageRef) observer.observe(stageRef);
		updateCanvasSize();
		const onKeydown = (event: KeyboardEvent) => {
			if (editingElementId) return;
			const mod = event.ctrlKey || event.metaKey;
			const key = event.key.toLowerCase();
			const isInput = (event.target as HTMLElement)?.closest?.('input, textarea, [contenteditable="true"]');
			// 모달이 열려 있으면 보드 키 이벤트 처리 건너뛰기
			const isModalOpen = showSaveLibraryNameModal || showLibraryModal || showImportModal || showShortcutsModal;

			if (mod && key === 's') {
				event.preventDefault();
				saveBoard();
			}
			if (mod && key === 'z') {
				event.preventDefault();
				undo();
			}
			if (mod && key === 'y') {
				event.preventDefault();
				redo();
			}
			if (mod && key === 'c') {
				event.preventDefault();
				if (selectedElementIds.length > 0) {
					const ids = $state.snapshot(selectedElementIds);
					const snap = $state.snapshot(elements);
					_clipboard = snap.filter((el) => ids.includes(el.id));
				}
			}
			if (mod && key === 'v') {
				event.preventDefault();
				if (_clipboard.length > 0) {
					const offset = 20;
					const groupMap = new Map<string, string>();
					for (const orig of _clipboard) {
						if (orig.groupId && !groupMap.has(orig.groupId)) {
							groupMap.set(orig.groupId, nextId());
						}
					}
					const newEls: BoardElement[] = _clipboard.map((el) => ({
						...JSON.parse(JSON.stringify(el)),
						id: nextId(),
						groupId: el.groupId ? groupMap.get(el.groupId) : undefined,
						x: el.x + offset,
						y: el.y + offset
					}));
					elements = [...elements, ...newEls];
					selectedElementIds = newEls.map((el) => el.id);
					_clipboard = _clipboard.map((el) => ({ ...el, x: el.x + offset, y: el.y + offset }));
					commitSnapshot();
				}
			}
			// Delete/Backspace: 입력 필드나 모달이 열려 있으면 처리하지 않음
			if ((event.key === 'Delete' || event.key === 'Backspace') && !isInput && !isModalOpen) {
				deleteSelectedElement();
			}

			/* Tool panel & topbar: only when not typing in input/textarea */
			if (isInput || isModalOpen) return;
			/* Ctrl+Shift+Arrow: expand board in direction */
			if (mod && event.shiftKey) {
				const arrow = event.key;
				if (arrow === 'ArrowUp') {
					event.preventDefault();
					expandBoard('top', 200);
					return;
				}
				if (arrow === 'ArrowDown') {
					event.preventDefault();
					expandBoard('bottom', 200);
					return;
				}
				if (arrow === 'ArrowLeft') {
					event.preventDefault();
					expandBoard('left', 200);
					return;
				}
				if (arrow === 'ArrowRight') {
					event.preventDefault();
					expandBoard('right', 200);
					return;
				}
			}
			if (mod) {
				const num = key >= '0' && key <= '9' ? parseInt(key, 10) : -1;
				if (num >= 0 && num <= 9 && TOOL_ITEMS[num]) {
					event.preventDefault();
					activeTool = TOOL_ITEMS[num].tool;
					return;
				}
				if (event.shiftKey) {
					if (key === 'm') {
						event.preventDefault();
						if (TOOL_ITEMS[10]) activeTool = TOOL_ITEMS[10].tool; // Image
						return;
					}
					if (key === 'p') {
						event.preventDefault();
						downloadPdf();
						return;
					}
					if (key === 'e') {
						event.preventDefault();
						downloadBoardImage();
						return;
					}
					if (key === 'c') {
						event.preventDefault();
						openClearConfirmModal();
						return;
					}
				}
				if (key === 'o') {
					event.preventDefault();
					showImportModal = true;
					return;
				}
				if (key === 'l') {
					event.preventDefault();
					showLibraryModal = true;
					return;
				}
			}
		};
		window.addEventListener('keydown', onKeydown);

		const onBeforeUnload = (e: BeforeUnloadEvent) => {
			if (isDirty) {
				e.preventDefault();
				e.returnValue = '';
			}
		};
		window.addEventListener('beforeunload', onBeforeUnload);

		return () => {
			observer.disconnect();
			window.removeEventListener('keydown', onKeydown);
			window.removeEventListener('beforeunload', onBeforeUnload);
		};
	});

	/* Tablet: prevent page scroll when drawing/dragging on stage so touch stays on board */
	$effect(() => {
		const active = interaction;
		if (!active) return;
		const onTouchMove = (e: TouchEvent) => e.preventDefault();
		document.addEventListener('touchmove', onTouchMove, { passive: false });
		return () => document.removeEventListener('touchmove', onTouchMove);
	});

	/* Close context menu when clicking outside menu and outside stage (e.g. tool/property panel); do not clear selection */
	$effect(() => {
		if (selectedElementIds.length === 0 && selectedStrokeIds.length === 0) {
			selectionBboxRotationPersisted = 0;
			selectionBboxBoundsPersisted = null;
		}
	});

	$effect(() => {
		const at = contextMenuAt;
		if (!at) return;
		const menuEl = contextMenuRef;
		const stageEl = stageContainerRef;
		const onMouseDown = (e: MouseEvent) => {
			const t = e.target as Node | null;
			if (menuEl?.contains(t)) return;
			if (stageEl?.contains(t)) return;
			contextMenuAt = null;
			contextMenuMode = null;
			contextMenuPasteAt = null;
		};
		document.addEventListener('mousedown', onMouseDown, true);
		return () => document.removeEventListener('mousedown', onMouseDown, true);
	});

	/* Auto-save 5 seconds after last change (debounced): re-run on every edit to reset timer */
	$effect(() => {
		if (!isDirty) return;
		/* Depend on values that change when user edits so timer resets each time */
		void history.length;
		void historyIndex;
		void boardTitle;
		const id = setTimeout(() => {
			saveBoard(true);
		}, 1000);
		return () => clearTimeout(id);
	});
</script>

<main class="board-page">
	<Topbar
		bind:boardTitle
		{canUndo}
		{canRedo}
		onGoBack={() => goto('/')}
		onDownloadPdf={downloadPdf}
		onDownloadImage={downloadBoardImage}
		onClear={openClearConfirmModal}
		onShowImport={() => (showImportModal = true)}
		onShowLibrary={() => (showLibraryModal = true)}
		onShowShortcuts={() => (showShortcutsModal = true)}
		onUndo={undo}
		onRedo={redo}
	/>

	<div class="workspace">
		<ToolPanel
			bind:activeTool
			bind:keepToolActive
			bind:showConnectorAnchors
			contextMenuOpen={contextMenuAt !== null}
			onToolChange={(tool) => {
				if (tool !== 'select') {
					selectedElementIds = [];
					editingElementId = null;
					pendingConnector = null;
				}
			}}
		/>

		<div class="stage-container" bind:this={stageContainerRef}>
		<div class="stage-with-expand">
			<div class="expand-corner" aria-hidden="true"></div>
			<button
				type="button"
				class="expand-strip top"
				title="Expand top by 200px"
				onclick={() => expandBoard('top', 200)}
			>
				<span class="expand-strip-icon"><!-- prettier-ignore --><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 6L6 16h12L12 6z"/></svg></span>
			</button>
			<div class="expand-corner" aria-hidden="true"></div>
			<button
				type="button"
				class="expand-strip left"
				title="Expand left by 200px"
				onclick={() => expandBoard('left', 200)}
			>
				<span class="expand-strip-icon"><!-- prettier-ignore --><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 12l8-6v12l-8-6z"/></svg></span>
			</button>
			<div class="stage-center">
		<BoardStage
			bind:stageRef
			bind:drawCanvas
			bind:wrapRef={stageWrapRef}
			themeBackground={currentTheme.background}
			themeGridColor={currentTheme.gridColor}
			{gridEnabled}
			{gridSize}
			{activeTool}
			{eraserSize}
			isErasing={interaction?.kind === 'erasing'}
			{stageWidth}
			{stageHeight}
			{elements}
			{selectedElementIds}
			{selectedSingleElement}
			{editingElementId}
			{marquee}
			{selectedGroupBoxes}
			selectionBounds={selectionBounds}
			showSelectionBbox={showSelectionBbox}
			selectionBboxRotation={selectionBboxRotation}
			selectionBboxBounds={selectionBboxBounds}
			{guideLines}
			{guideDistances}
			onPointerDown={onStagePointerDown}
			onPointerMove={onStagePointerMove}
			onPointerUp={onStagePointerUp}
			onPointerLeave={endInteractionOnLeave}
			onDblClickElement={handleDblClickElement}
			onBeginResize={beginResize}
			onBeginResizeGroup={beginResizeGroup}
			onBeginDragGroup={beginDragGroup}
			onBeginRotate={beginRotate}
			onBeginRotateGroup={beginRotateGroup}
			onElementTextChange={handleElementTextChange}
			onElementTextBlur={handleElementTextBlur}
			showConnectorAnchors={showConnectorAnchors}
			{pendingConnector}
			{connectorPreviewEnd}
			onContextMenu={handleStageContextMenu}
			pendingLibraryPlacement={!!pendingLibraryItem}
		/>
			</div>
			<button
				type="button"
				class="expand-strip right"
				title="Expand right by 200px"
				onclick={() => expandBoard('right', 200)}
			>
				<span class="expand-strip-icon"><!-- prettier-ignore --><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M16 12L8 6v12l8-6z"/></svg></span>
			</button>
			<div class="expand-corner" aria-hidden="true"></div>
			<button
				type="button"
				class="expand-strip bottom"
				title="Expand bottom by 200px"
				onclick={() => expandBoard('bottom', 200)}
			>
				<span class="expand-strip-icon"><!-- prettier-ignore --><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 18L6 8h12l-6 10z"/></svg></span>
			</button>
			<div class="expand-corner" aria-hidden="true"></div>
		</div>
		<!-- Hidden input for "replace image" when double-clicking an image element on the board -->
		<input
			type="file"
			accept="image/*"
			class="hidden-input"
			bind:this={imageFileInputRef}
			onchange={handleImageReplaceFromFile}
			aria-hidden="true"
			tabindex="-1"
		/>
		{#if contextMenuAt}
			<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions a11y_use_role -->
			<div
				class="context-menu-backdrop"
				role="presentation"
				onclick={(e: MouseEvent) => {
					const x = e.clientX;
					const y = e.clientY;
					contextMenuAt = null;
					contextMenuMode = null;
					contextMenuPasteAt = null;
					requestAnimationFrame(() => {
						const target = document.elementFromPoint(x, y) as HTMLElement | null;
						if (stageWrapRef?.contains(target)) {
							const el = target?.closest?.('[data-element-id]');
							const elementId = el?.getAttribute('data-element-id') ?? null;
							if (elementId) {
								setSelection(expandByGroups(collectGroupedIds(elementId)));
								activeTool = 'select';
								return;
							}
						}
						setSelection([]);
						selectedStrokeIds = [];
					});
				}}
				oncontextmenu={handleContextMenuBackdropContextMenu}
			></div>
			<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
			<div
				bind:this={contextMenuRef}
				class="context-menu"
				role="menu"
				tabindex="-1"
				style={`left:${contextMenuAt.x}px;top:${contextMenuAt.y}px;`}
				onclick={(e) => e.stopPropagation()}
				oncontextmenu={(e) => e.stopPropagation()}
			>
				{#if contextMenuMode === 'element'}
					<button type="button" class="context-menu-item" role="menuitem" onclick={handleContextMenuCopy} disabled={selectedElementIds.length === 0}>
						<!-- prettier-ignore -->
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
						Copy
					</button>
					<button type="button" class="context-menu-item" role="menuitem" onclick={handleContextMenuDelete}>
						<!-- prettier-ignore -->
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
						Delete
					</button>
					<button type="button" class="context-menu-item" role="menuitem" onclick={openSaveLibraryNameModal}>
						<!-- prettier-ignore -->
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/><path d="M8 7h8"/><path d="M8 11h8"/></svg>
						Save to Library
					</button>
				{:else if contextMenuMode === 'paste'}
					<button type="button" class="context-menu-item" role="menuitem" onclick={handleContextMenuPaste}>
						<!-- prettier-ignore -->
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
						Paste
					</button>
				{/if}
			</div>
		{/if}
		</div>

		<div class="right-col">
			<div class="right-col-minimap">
				<MinimapThumbnail
					{stageWidth}
					{stageHeight}
					themeBackground={currentTheme.background}
					themeGridColor={currentTheme.gridColor}
					{strokes}
					{elements}
					{stageWrapRef}
				/>
			</div>
			<div class="right-col-properties">
			<PropertyPanel
				bind:penColor
				bind:fillColor
				bind:penSize
				bind:eraserSize
				bind:borderWidth
				bind:fontSize
				bind:snapThreshold
				bind:themeId
				{activeTool}
				{stageWidth}
				{stageHeight}
			{selectedElementIds}
			{selectedElements}
			selectedStrokeCount={selectedStrokeIds.length}
			canDeleteSelection={selectedElementIds.length > 0 || selectedStrokeIds.length > 0}
			{isTextAlignVisible}
			{canGroup}
			{canUngroup}
			{canDistribute}
			onThemeChange={applyThemeDefaults}
			onDuplicate={duplicateSelectedElement}
			onDelete={deleteSelectedElement}
				onGroup={groupSelected}
				onUngroup={ungroupSelected}
				onAlign={alignSelected}
				onDistribute={distributeSelected}
				onTextAlign={setTextAlign}
				onTextVerticalAlign={setTextVerticalAlign}
				onPenColorChange={handlePenColorChange}
				onFillColorChange={handleFillColorChange}
				onBorderWidthChange={handleBorderWidthChange}
				onFontSizeChange={handleFontSizeChange}
			onImageUpload={handleImageUpload}
			onExpandBoard={expandBoard}
			{gridEnabled}
			{gridSize}
			onGridEnabledChange={(v) => { gridEnabled = v; commitSnapshot(); }}
			onGridSizeChange={(v) => { gridSize = v; commitSnapshot(); }}
			connectorStyle={connectorStyle}
			connectorType={connectorType}
			startArrow={startArrow}
			endArrow={endArrow}
			startArrowDirection={startArrowDirection}
			endArrowDirection={endArrowDirection}
			onConnectorStyleChange={handleConnectorStyleChange}
			onConnectorTypeChange={handleConnectorTypeChange}
			onStartArrowChange={handleStartArrowChange}
			onEndArrowChange={handleEndArrowChange}
			onStartArrowDirectionChange={handleStartArrowDirectionChange}
			onEndArrowDirectionChange={handleEndArrowDirectionChange}
			connectorArrowSize={connectorArrowSize}
			onConnectorArrowSizeChange={handleConnectorArrowSizeChange}
		/>
			</div>
		</div>
	</div>
</main>

<ImportModal
	show={showImportModal}
	boards={importBoards}
	onImport={importBoardContent}
	onClose={() => (showImportModal = false)}
/>

<LibraryModal
	show={showLibraryModal}
	onInsert={handleInsertFromLibrary}
	onClose={() => { showLibraryModal = false; pendingLibraryItem = null; }}
/>

<SaveLibraryNameModal
	show={showSaveLibraryNameModal}
	defaultName="Library item"
	onSave={handleSaveLibraryWithName}
	onClose={() => (showSaveLibraryNameModal = false)}
/>

<ShortcutsModal
	show={showShortcutsModal}
	onClose={() => (showShortcutsModal = false)}
/>

{#if showUnsavedModal}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="unsaved-overlay"
		role="dialog"
		aria-modal="true"
		aria-labelledby="unsaved-title"
		onkeydown={(e) => e.key === 'Escape' && handleCancelLeave()}
		tabindex="-1"
	>
		<div class="unsaved-dialog">
			<div class="unsaved-icon">
				<!-- prettier-ignore -->
				<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
			</div>
			<h2 id="unsaved-title">Unsaved Changes</h2>
			<p>You have unsaved changes on this board.<br />If you leave without saving, your changes will be lost.</p>
			<div class="unsaved-actions">
				<button type="button" class="btn-save" onclick={handleSaveAndLeave}>
					<!-- prettier-ignore -->
					<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
					Save &amp; Leave
				</button>
				<button type="button" class="btn-discard" onclick={handleLeaveWithoutSave}>
					<!-- prettier-ignore -->
					<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
					Leave without saving
				</button>
				<button type="button" class="btn-cancel" onclick={handleCancelLeave}>
					<!-- prettier-ignore -->
					<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
					Cancel
				</button>
			</div>
		</div>
	</div>
{/if}

{#if showSavedModal}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="modal-overlay"
		role="dialog"
		aria-modal="true"
		aria-labelledby="saved-modal-title"
		onkeydown={(e) => e.key === 'Escape' && (showSavedModal = false)}
		tabindex="-1"
	>
		<div class="modal-dialog modal-dialog-sm">
			<h2 id="saved-modal-title" class="modal-title">Board saved.</h2>
			<div class="modal-actions modal-actions-single">
				<button type="button" class="modal-btn primary" onclick={() => (showSavedModal = false)}>
					OK
				</button>
			</div>
		</div>
	</div>
{/if}

{#if showClearConfirmModal}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="modal-overlay"
		role="dialog"
		aria-modal="true"
		aria-labelledby="clear-modal-title"
		onkeydown={(e) => e.key === 'Escape' && closeClearConfirmModal()}
		tabindex="-1"
	>
		<div class="modal-dialog">
			<h2 id="clear-modal-title" class="modal-title">Clear the board?</h2>
			<p class="modal-message">All content and board size will be reset.</p>
			<div class="modal-actions">
				<button type="button" class="modal-btn secondary" onclick={closeClearConfirmModal}>
					Cancel
				</button>
				<button type="button" class="modal-btn danger" onclick={clearBoard}>
					Clear
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	:global(body) {
		margin: 0;
		font-family: 'Pretendard', 'Noto Sans KR', system-ui, sans-serif;
		background: #dbe3ef;
	}

	.board-page {
		min-height: 100vh;
		display: grid;
		grid-template-rows: auto 1fr;
	}

	.hidden-input {
		position: absolute;
		width: 0;
		height: 0;
		opacity: 0;
		pointer-events: none;
		overflow: hidden;
	}

	/* Canva-style: left tools, center canvas, right properties */
	.workspace {
		display: grid;
		grid-template-columns: 56px 1fr minmax(240px, 280px);
		height: calc(100vh - 56px);
		gap: 0;
		padding: 0;
		box-sizing: border-box;
		background: #f1f5f9;
	}

	/* Stage takes maximum space; scroll only when content exceeds viewport */
	.stage-container {
		min-height: 0;
		min-width: 0;
		overflow: hidden;
		padding: 0;
		display: flex;
		flex-direction: column;
	}

	/* Expand strips outside board: narrow strips so board area is wider */
	.stage-with-expand {
		flex: 1;
		min-height: 0;
		min-width: 0;
		display: grid;
		grid-template-rows: 14px 1fr 14px;
		grid-template-columns: 14px 1fr 14px;
		gap: 0;
		background: #e2e8f0;
		overflow: hidden;
	}

	.stage-center {
		grid-row: 2;
		grid-column: 2;
		min-height: 0;
		min-width: 0;
		overflow: hidden;
		background: #f1f5f9;
		border: 1px solid #cbd5e1;
		box-sizing: border-box;
	}

	.expand-strip {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		padding: 0;
		border: none;
		background: rgba(255, 255, 255, 0.5);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		transition: background 0.2s, color 0.2s, box-shadow 0.2s;
		overflow: hidden;
	}

	.expand-strip::before {
		content: '';
		position: absolute;
		inset: 0;
		pointer-events: none;
		opacity: 0;
		transition: opacity 0.2s;
	}

	/* 위·아래 버튼: 좌우 방향 그라데이션 (가운데 진함) */
	.expand-strip.top:hover::before,
	.expand-strip.bottom:hover::before {
		opacity: 1;
		background: linear-gradient(
			to right,
			rgba(226, 232, 240, 0.35) 0%,
			rgba(148, 163, 184, 0.85) 50%,
			rgba(226, 232, 240, 0.35) 100%
		);
	}

	.expand-strip.top:active::before,
	.expand-strip.bottom:active::before {
		opacity: 1;
		background: linear-gradient(
			to right,
			rgba(203, 213, 225, 0.5) 0%,
			rgba(100, 116, 139, 0.95) 50%,
			rgba(203, 213, 225, 0.5) 100%
		);
	}

	/* 좌·우 버튼: 상하 방향 그라데이션 (가운데 진함) */
	.expand-strip.left:hover::before,
	.expand-strip.right:hover::before {
		opacity: 1;
		background: linear-gradient(
			to bottom,
			rgba(226, 232, 240, 0.35) 0%,
			rgba(148, 163, 184, 0.85) 50%,
			rgba(226, 232, 240, 0.35) 100%
		);
	}

	.expand-strip.left:active::before,
	.expand-strip.right:active::before {
		opacity: 1;
		background: linear-gradient(
			to bottom,
			rgba(203, 213, 225, 0.5) 0%,
			rgba(100, 116, 139, 0.95) 50%,
			rgba(203, 213, 225, 0.5) 100%
		);
	}

	.expand-strip:hover {
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.expand-strip:active::before {
		opacity: 1;
	}

	.expand-strip-icon {
		position: relative;
		z-index: 1;
		display: grid;
		place-items: center;
		color: rgba(30, 64, 175, 0.6);
		transition: color 0.2s;
	}

	.expand-strip:hover .expand-strip-icon {
		color: #1e3a8a;
	}

	.expand-corner {
		background: rgba(255, 255, 255, 0.5);
		pointer-events: none;
	}
	.expand-corner:nth-child(1) { grid-row: 1; grid-column: 1; }
	.expand-corner:nth-child(3) { grid-row: 1; grid-column: 3; }
	.expand-corner:nth-child(7) { grid-row: 3; grid-column: 1; }
	.expand-corner:nth-child(9) { grid-row: 3; grid-column: 3; }

	.expand-strip.top { grid-row: 1; grid-column: 2; }
	.expand-strip.bottom { grid-row: 3; grid-column: 2; }
	.expand-strip.left { grid-row: 2; grid-column: 1; }
	.expand-strip.right { grid-row: 2; grid-column: 3; }

	.right-col {
		display: flex;
		flex-direction: column;
		gap: 0;
		min-height: 0;
		overflow: hidden;
		background: #fff;
		border-left: 1px solid #e2e8f0;
	}

	.right-col-minimap {
		flex-shrink: 0;
		border-bottom: 1px solid #e2e8f0;
		padding: 0.5rem;
	}

	.right-col-properties {
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	.right-col-properties :global(.property-panel) {
		height: 100%;
		box-sizing: border-box;
	}

	/* ── Unsaved changes modal ── */
	.unsaved-overlay {
		position: fixed;
		inset: 0;
		z-index: 9999;
		background: rgba(15, 23, 42, 0.55);
		backdrop-filter: blur(6px);
		display: grid;
		place-items: center;
	}

	.unsaved-dialog {
		background: #ffffff;
		border-radius: 20px;
		padding: 2rem 2.2rem 1.6rem;
		width: min(420px, 92vw);
		box-shadow:
			0 25px 60px rgba(0, 0, 0, 0.22),
			0 4px 16px rgba(0, 0, 0, 0.12);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.6rem;
		text-align: center;
		animation: unsaved-in 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	@keyframes unsaved-in {
		from { opacity: 0; transform: scale(0.88); }
		to   { opacity: 1; transform: scale(1); }
	}

	.unsaved-icon {
		width: 56px;
		height: 56px;
		border-radius: 50%;
		background: #fef3c7;
		display: grid;
		place-items: center;
		margin-bottom: 0.2rem;
	}

	.unsaved-dialog h2 {
		margin: 0;
		font-size: 1.1rem;
		font-weight: 700;
		color: #1e293b;
	}

	.unsaved-dialog p {
		margin: 0;
		font-size: 0.88rem;
		color: #64748b;
		line-height: 1.6;
	}

	.unsaved-actions {
		display: flex;
		flex-direction: row;
		gap: 0.55rem;
		width: 100%;
		margin-top: 0.6rem;
	}

	.unsaved-actions button {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		padding: 0.65rem 0.5rem;
		border-radius: 10px;
		font-size: 0.82rem;
		font-weight: 600;
		cursor: pointer;
		border: none;
		transition: filter 0.15s, transform 0.1s;
		white-space: nowrap;
	}

	.unsaved-actions button:hover { filter: brightness(0.93); }
	.unsaved-actions button:active { transform: scale(0.97); }

	.btn-save {
		background: #2563eb;
		color: #fff;
	}

	.btn-discard {
		background: #fee2e2;
		color: #dc2626;
	}

	.btn-cancel {
		background: #f1f5f9;
		color: #64748b;
	}

	/* ── Saved / Clear confirm modals ── */
	.modal-overlay {
		position: fixed;
		inset: 0;
		z-index: 9999;
		background: rgba(15, 23, 42, 0.55);
		backdrop-filter: blur(6px);
		display: grid;
		place-items: center;
	}

	.modal-dialog {
		background: #fff;
		border-radius: 20px;
		padding: 2rem 2.2rem;
		width: min(420px, 92vw);
		box-shadow: 0 25px 60px rgba(0, 0, 0, 0.22);
	}

	.modal-dialog-sm {
		padding: 1.5rem 2rem;
		width: min(320px, 92vw);
	}

	.modal-title {
		margin: 0 0 0.5rem;
		font-size: 1.1rem;
		font-weight: 700;
		color: #1e293b;
	}

	.modal-message {
		margin: 0 0 1.5rem;
		font-size: 0.88rem;
		color: #64748b;
		line-height: 1.5;
	}

	.modal-actions {
		display: flex;
		gap: 0.6rem;
		justify-content: flex-end;
	}

	.modal-actions-single {
		justify-content: center;
		margin-top: 0.5rem;
	}

	.modal-btn {
		padding: 0.6rem 1.2rem;
		border-radius: 10px;
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
		border: none;
		transition: filter 0.15s;
	}

	.modal-btn.secondary {
		background: #f1f5f9;
		color: #475569;
	}

	.modal-btn.primary {
		background: #2563eb;
		color: #fff;
	}

	.modal-btn.danger {
		background: #dc2626;
		color: #fff;
	}

	/* ── Context menu (right-click: Save to Library) ── */
	.stage-container {
		position: relative;
	}
	.context-menu-backdrop {
		position: absolute;
		inset: 0;
		z-index: 900;
	}
	.context-menu {
		position: fixed;
		z-index: 901;
		min-width: 160px;
		background: #fff;
		border-radius: 8px;
		box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
		border: 1px solid #e2e8f0;
		padding: 0.35rem;
	}
	.context-menu-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.5rem 0.75rem;
		border: none;
		background: none;
		font-size: 0.875rem;
		color: #334155;
		cursor: pointer;
		border-radius: 6px;
		text-align: left;
	}
	.context-menu-item:hover:not(:disabled) {
		background: #f1f5f9;
	}
	.context-menu-item:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.modal-btn:hover {
		filter: brightness(0.96);
	}

	.modal-btn.primary:hover,
	.modal-btn.danger:hover {
		filter: brightness(1.08);
	}
</style>
