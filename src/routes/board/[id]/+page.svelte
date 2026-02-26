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

	type PageData = { boardId: string };
	type Axis = 'x' | 'y';

	let { data } = $props<{ data: PageData }>();
	let boardId = $derived(data.boardId);

	/* ── State ── */
	let stageRef = $state<HTMLElement | null>(null);
	let drawCanvas = $state<HTMLCanvasElement | null>(null);
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
			themeId
		};
		history = [...history.slice(0, historyIndex + 1), snapshot];
		historyIndex = history.length - 1;
		isDirty = true;
	};

	const applySnapshot = (snapshot: Snapshot) => {
		strokes = deepClone(snapshot.strokes);
		elements = deepClone(snapshot.elements);
		themeId = snapshot.themeId;
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

	const loadBoard = () => {
		const board = getBoardById(boardId);
		if (!board) {
			goto('/');
			return;
		}
		boardTitle = board.title;
		themeId = board.themeId;
		/* Restore saved canvas size (fall back to defaults) */
		stageWidth = board.width ?? 1200;
		stageHeight = board.height ?? 700;
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
			imageMap
		);
		upsertBoard({
			...original,
			title: boardTitle.trim() || original.title,
			themeId,
			strokes: deepClone(strokes),
			elements: deepClone(elements),
			thumbnail,
			width: stageWidth,
			height: stageHeight
		});
		isDirty = false;
		refreshImportBoards();
		alert('보드가 저장되었습니다.');
	};

	const clearBoard = () => {
		if (!confirm('보드를 초기화할까요?')) return;
		strokes = [];
		elements = [];
		selectedElementIds = [];
		editingElementId = null;
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
		const stroke: Stroke = {
			id: nextId(),
			tool: 'pen',
			color: penColor,
			size: penSize,
			points: [point]
		};
		strokes = [...strokes, stroke];
	};

	const pushPointToStroke = (point: Point) => {
		const last = strokes.at(-1);
		if (!last) return;
		last.points = [...last.points, point];
		strokes = [...strokes.slice(0, -1), last];
	};

	/* ── Eraser ── */
	const isInsideEraser = (p: Point, center: Point, radius: number): boolean => {
		const dx = p.x - center.x;
		const dy = p.y - center.y;
		return dx * dx + dy * dy <= radius * radius;
	};

	const eraseAt = (point: Point) => {
		const radius = eraserSize / 2;
		const nextStrokes: Stroke[] = [];

		for (const stroke of strokes) {
			if (stroke.tool === 'eraser') continue;

			const segments: Point[][] = [];
			let current: Point[] = [];

			for (const p of stroke.points) {
				if (!isInsideEraser(p, point, radius)) {
					current.push(p);
				} else {
					if (current.length >= 2) segments.push(current);
					current = [];
				}
			}
			if (current.length >= 2) segments.push(current);

			if (segments.length === 0) continue;

			if (segments.length === 1 && segments[0].length === stroke.points.length) {
				nextStrokes.push(stroke);
			} else {
				for (const seg of segments) {
					nextStrokes.push({ ...stroke, id: nextId(), points: seg });
				}
			}
		}

		strokes = nextStrokes;
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
			const dw = point.x - currentInteraction.start.x;
			const dh = point.y - currentInteraction.start.y;
			updateElement(currentInteraction.elementId, (item) => ({
				...item,
				width: Math.max(28, currentInteraction.originWidth + dw),
				height: Math.max(24, currentInteraction.originHeight + dh)
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
		if (interaction.kind === 'marquee') {
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

	const beginResize = (event: PointerEvent, elementId: string) => {
		if (activeTool !== 'select' || selectedElementIds.length !== 1) return;
		event.stopPropagation();
		const element = elements.find((item) => item.id === elementId);
		if (!element) return;
		const point = getPointFromPointer(event);
		interaction = {
			kind: 'resize',
			pointerId: event.pointerId,
			elementId,
			start: point,
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
			currentTheme.gridColor
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
			currentTheme.gridColor
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
		drawThemeBackground(ctx, stageWidth, stageHeight, currentTheme.background, currentTheme.gridColor);
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
		<ToolPanel bind:activeTool />

		<BoardStage
			bind:stageRef
			bind:drawCanvas
			themeBackground={currentTheme.background}
			themeGridColor={currentTheme.gridColor}
			{activeTool}
			{eraserSize}
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

		<PropertyPanel
			bind:penColor
			bind:fillColor
			bind:penSize
			bind:eraserSize
			bind:borderWidth
			bind:fontSize
			bind:snapThreshold
			bind:themeId
			bind:keepToolActive
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
		/>
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
			<h2 id="unsaved-title">저장되지 않은 변경사항</h2>
			<p>보드에 저장되지 않은 내용이 있습니다.<br />저장하지 않고 나가면 변경사항이 사라집니다.</p>
			<div class="unsaved-actions">
				<button type="button" class="btn-save" onclick={handleSaveAndLeave}>
					<!-- prettier-ignore -->
					<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
					저장하고 나가기
				</button>
				<button type="button" class="btn-discard" onclick={handleLeaveWithoutSave}>
					<!-- prettier-ignore -->
					<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
					저장 없이 나가기
				</button>
				<button type="button" class="btn-cancel" onclick={handleCancelLeave}>
					<!-- prettier-ignore -->
					<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
					취소
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
		grid-template-columns: 92px 1fr 260px;
		height: calc(100vh - 68px);
		gap: 0.7rem;
		padding: 0.7rem;
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
</style>
