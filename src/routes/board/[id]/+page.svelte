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
		type ThemeId
	} from '$lib/board-types';
	import { getBoardById, getBoards, upsertBoard } from '$lib/board-storage';
	import {
		getBounds,
		getSnapDelta,
		chooseCloserSnap,
		getGapMatchSnap,
		getDistanceLabels
	} from '$lib/snap-engine';
	import {
		drawThemeBackground,
		drawStroke,
		drawElementToCanvas,
		renderThumbnail,
		loadImages
	} from '$lib/canvas-renderer';
	import { onMount } from 'svelte';
	import { jsPDF } from 'jspdf';

	import Topbar from '$lib/component/board/Topbar.svelte';
	import ToolPanel from '$lib/component/board/ToolPanel.svelte';
	import PropertyPanel from '$lib/component/board/PropertyPanel.svelte';
	import BoardStage from '$lib/component/board/BoardStage.svelte';
	import ImportModal from '$lib/component/board/ImportModal.svelte';
	import MinimapThumbnail from '$lib/component/board/MinimapThumbnail.svelte';

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
	let editingElementId = $state<string | null>(null);
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
	let showImportModal = $state(false);
	let importBoards = $state<BoardData[]>([]);
	/** true = unsaved changes exist */
	let isDirty = $state(false);
	/** URL to navigate to after handling the unsaved-changes dialog */
	let _pendingNavUrl = $state<string | null>(null);
	let showUnsavedModal = $state(false);
	let interaction = $state<InteractionState>(null);
	let history = $state<Snapshot[]>([]);
	let historyIndex = $state(-1);
	let stageWidth = $state(1200);
	let stageHeight = $state(700);
	let guideLines = $state<GuideLine[]>([]);
	let guideDistances = $state<GuideDistance[]>([]);

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

	/* ── Utilities ── */
	const deepClone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
	const uniq = (items: string[]) => [...new Set(items)];

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
		isDirty = true;
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
		editingElementId = null;
	};

	const undo = () => {
		if (!canUndo) return;
		historyIndex -= 1;
		applySnapshot(history[historyIndex]);
	};

	const redo = () => {
		if (!canRedo) return;
		historyIndex += 1;
		applySnapshot(history[historyIndex]);
	};

	/* ── Board I/O ── */
	const refreshImportBoards = () => {
		importBoards = getBoards().filter((item) => item.id !== boardId);
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

	const loadBoard = () => {
		const board = getBoardById(boardId);
		if (!board) {
			goto('/');
			return;
		}
		boardTitle = board.title;
		themeId = board.themeId;
		/* Restore saved canvas size; fall back to viewport dimensions for new boards */
		const vp = getViewportSize();
		stageWidth = board.width ?? vp.w;
		stageHeight = board.height ?? vp.h;
		gridEnabled = board.gridEnabled ?? true;
		gridSize = board.gridSize ?? 32;
		strokes = deepClone(board.strokes).filter((s: Stroke) => s.tool !== 'eraser');
		elements = deepClone(board.elements).map((el: BoardElement) => migrateElement(el));
		selectedElementIds = [];
		penColor =
			BOARD_THEMES.find((theme) => theme.id === board.themeId)?.defaultStrokeColor ?? '#111827';
		fillColor =
			BOARD_THEMES.find((theme) => theme.id === board.themeId)?.defaultFillColor ?? '#ffffff';
		history = [];
		historyIndex = -1;
		commitSnapshot();
		isDirty = false; // initial load is not a user change
		refreshImportBoards();
	};

	const saveBoard = async () => {
		const original = getBoardById(boardId);
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
		upsertBoard({
			...original,
			title: boardTitle.trim() || original.title,
			themeId,
			strokes: deepClone(strokes),
			elements: deepClone(elements),
			thumbnail,
			width: stageWidth,
			height: stageHeight,
			gridEnabled,
			gridSize
		});
		isDirty = false;
		refreshImportBoards();
		alert('Board saved.');
	};

	const clearBoard = () => {
		if (!confirm('Clear the board?\nAll content and board size will be reset.')) return;
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
	};

	const importBoardContent = (source: BoardData) => {
		themeId = source.themeId;
		strokes = deepClone(source.strokes).filter((s: Stroke) => s.tool !== 'eraser');
		elements = deepClone(source.elements).map((el: BoardElement) => migrateElement(el));
		selectedElementIds = [];
		editingElementId = null;
		showImportModal = false;
		commitSnapshot();
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

	const addElementAt = (type: BoardElement['type'], point: Point) => {
		const isLineH = type === 'line-h';
		const isLineV = type === 'line-v';
		const isLine = isLineH || isLineV;
		const isCircle = type === 'ellipse';
		const isImage = type === 'image';
		const element: BoardElement = {
			id: nextId(),
			type,
			x: point.x,
			y: point.y,
			width: type === 'text' ? 220 : isLineV ? 20 : isCircle ? 160 : isImage ? 200 : 200,
			height: type === 'text' ? 80 : isLineH ? 20 : isCircle ? 160 : isImage ? 150 : 140,
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
		const id = selectedSingleElement?.id ?? null;
		if (id && id !== _prevSelectedId) {
			penColor = selectedSingleElement!.strokeColor;
			fillColor = selectedSingleElement!.fillColor;
			borderWidth = selectedSingleElement!.borderWidth ?? 2;
			fontSize = selectedSingleElement!.fontSize ?? 18;
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
	const expandBoard = (dir: 'top' | 'bottom' | 'left' | 'right', amount: number) => {
		if (dir === 'right') {
			stageWidth += amount;
		} else if (dir === 'bottom') {
			stageHeight += amount;
		} else if (dir === 'left') {
			stageWidth += amount;
			/* Shift all elements and strokes right */
			elements = elements.map((el) => ({ ...el, x: el.x + amount }));
			strokes = strokes.map((s) => ({
				...s,
				points: s.points.map((p) => ({ x: p.x + amount, y: p.y }))
			}));
		} else if (dir === 'top') {
			stageHeight += amount;
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
		commitSnapshot();
	};

	/* ── Drawing ── */
	const startDrawing = (point: Point) => {
		// Snapshot the current canvas so we can restore it on every RAF frame
		if (drawCanvas) {
			const ctx = drawCanvas.getContext('2d');
			if (ctx) {
				_committedImageData = ctx.getImageData(0, 0, drawCanvas.width, drawCanvas.height);
			}
		}
		_livePoints = [point];
		_liveColor = penColor;
		_liveSize = penSize;
		_isLiveDrawing = true;
		_drawLiveStroke();
	};

	const pushPointToStroke = (point: Point) => {
		if (!_isLiveDrawing) return;
		_livePoints = [..._livePoints, point];
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

	/* ── Pointer handlers ── */
	const elementAt = (target: EventTarget | null): string | null => {
		const element = (target as HTMLElement | null)?.closest(
			'[data-element-id]'
		) as HTMLElement | null;
		return element?.dataset.elementId ?? null;
	};

	const onStagePointerDown = (event: PointerEvent) => {
		const point = getPointFromPointer(event);
		const clickedElementId = elementAt(event.target);
		guideLines = [];
		guideDistances = [];

		if (editingElementId && clickedElementId === editingElementId) {
			return;
		}
		editingElementId = null;

		if (activeTool === 'eraser') {
			_prevEraserPt = null; // fresh sweep for each new press
			eraseAt(point);
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
		if (!interaction || interaction.pointerId !== event.pointerId) return;
		const currentInteraction = interaction;
		const point = getPointFromPointer(event);

		if (currentInteraction.kind === 'drawing') {
			pushPointToStroke(point);
			return;
		}

		if (currentInteraction.kind === 'erasing') {
			eraseAt(point);
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
				return { ...item, x: origin.x + dx, y: origin.y + dy };
			});
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
			const newX = Math.min(left, right);
			const newY = Math.min(top, bottom);
			const newW = Math.max(10, Math.abs(right - left));
			const newH = Math.max(10, Math.abs(bottom - top));

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
		} else {
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
		if (selectedElementIds.length === 0) return;
		const selected = new Set(selectedElementIds);
		elements = elements.filter((item) => !selected.has(item.id));
		selectedElementIds = [];
		editingElementId = null;
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
		setSelection(duplicated.map((item) => item.id));
		commitSnapshot();
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
		elements.forEach((element) => drawElementToCanvas(ctx, element, imageMap));
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
		elements.forEach((element) => drawElementToCanvas(ctx, element, imageMap));
		renderCanvas.toBlob(
			(blob) => {
				if (!blob) return;
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = `${boardTitle || 'board'}.png`;
				a.click();
				URL.revokeObjectURL(url);
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
	beforeNavigate(({ cancel, to }) => {
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
		isDirty = false;            // clear flag so beforeNavigate doesn't re-intercept
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
		loadBoard();
		const observer = new ResizeObserver(() => {
			updateCanvasSize();
		});
		if (stageRef) observer.observe(stageRef);
		updateCanvasSize();
		const onKeydown = (event: KeyboardEvent) => {
			if (editingElementId) return;
			if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
				event.preventDefault();
				saveBoard();
			}
			if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
				event.preventDefault();
				undo();
			}
			if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
				event.preventDefault();
				redo();
			}
			if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
				event.preventDefault();
				if (selectedElementIds.length > 0) {
					const ids = $state.snapshot(selectedElementIds);
					const snap = $state.snapshot(elements);
					_clipboard = snap.filter((el) => ids.includes(el.id));
				}
			}
			if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') {
				event.preventDefault();
				if (_clipboard.length > 0) {
					const offset = 20;
					// Build group ID mapping first
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
					// Shift clipboard so next paste offsets further
					_clipboard = _clipboard.map((el) => ({ ...el, x: el.x + offset, y: el.y + offset }));
					commitSnapshot();
				}
			}
			if (event.key === 'Delete') {
				deleteSelectedElement();
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
</script>

<main class="board-page">
	<Topbar
		bind:boardTitle
		{canUndo}
		{canRedo}
		onGoBack={() => goto('/')}
		onSave={saveBoard}
		onDownloadPdf={downloadPdf}
		onDownloadImage={downloadBoardImage}
		onClear={clearBoard}
		onShowImport={() => (showImportModal = true)}
		onUndo={undo}
		onRedo={redo}
	/>

	<div class="workspace">
		<ToolPanel bind:activeTool bind:keepToolActive />

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
			{guideLines}
			{guideDistances}
			onPointerDown={onStagePointerDown}
			onPointerMove={onStagePointerMove}
			onPointerUp={onStagePointerUp}
			onDblClickElement={startTextEdit}
			onBeginResize={beginResize}
			onBeginRotate={beginRotate}
			onElementTextChange={handleElementTextChange}
			onElementTextBlur={handleElementTextBlur}
			onExpandBoard={expandBoard}
		/>

		<div class="right-col">
			<MinimapThumbnail
				{stageWidth}
				{stageHeight}
				themeBackground={currentTheme.background}
				themeGridColor={currentTheme.gridColor}
				{strokes}
				{elements}
				{stageWrapRef}
			/>

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
		/>
		</div>
	</div>
</main>

<ImportModal
	show={showImportModal}
	boards={importBoards}
	onImport={importBoardContent}
	onClose={() => (showImportModal = false)}
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

	.workspace {
		display: grid;
		grid-template-columns: auto 1fr 260px;
		height: calc(100vh - 68px);
		gap: 0.7rem;
		padding: 0.7rem;
		box-sizing: border-box;
	}

	.right-col {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-height: 0;
		overflow: hidden;
	}

	.right-col :global(.property-panel) {
		flex: 1;
		min-height: 0;
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
</style>
