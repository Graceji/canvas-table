import * as React from "react";
import type { FullTheme } from "../../common/styles.js";
import {
    computeBounds,
    getColumnIndexForX,
    getEffectiveColumns,
    getEffectiveCurrentRange,
    getFreezeTrailingHeight,
    getRowIndexForY,
    getStickyWidth,
    rectBottomRight,
    useMappedColumns,
} from "./render/data-grid-lib.js";
import {
    GridCellKind,
    type Rectangle,
    type GridSelection,
    type InnerGridCell,
    InnerGridCellKind,
    CompactSelection,
    type Item,
    type DrawHeaderCallback,
    isReadWriteCell,
    isInnerOnlyCell,
    booleanCellIsEditable,
    type InnerGridColumn,
    type DrawCellCallback,
    type FillHandle,
    type GridMouseCursor,
    DEFAULT_FILL_HANDLE,
} from "./data-grid-types.js";
import { CellSet } from "./cell-set.js";
import { SpriteManager, type SpriteMap } from "./data-grid-sprites.js";
import { direction, getScrollBarWidth, useDebouncedMemo, useEventListener } from "../../common/utils.js";
import clamp from "lodash/clamp.js";
import makeRange from "lodash/range.js";
import { drawGrid } from "./render/data-grid-render.js";
import { type BlitData } from "./render/data-grid-render.blit.js";
import { AnimationManager, type StepCallback } from "./animation-manager.js";
import { RenderStateProvider, packColRowToNumber } from "../../common/render-state-provider.js";
import { browserIsFirefox, browserIsSafari } from "../../common/browser-detect.js";
import { type EnqueueCallback, useAnimationQueue } from "./use-animation-queue.js";
import { assert } from "../../common/support.js";
import type { CellRenderer, GetCellRendererCallback } from "../../cells/cell-types.js";
import type { DrawGridArg } from "./render/draw-grid-arg.js";
import type { ImageWindowLoader } from "./image-window-loader-interface.js";
import {
    type GridMouseEventArgs,
    type GridKeyEventArgs,
    type GridDragEventArgs,
    OutOfBoundsRegionAxis,
    outOfBoundsKind,
    groupHeaderKind,
    headerKind,
    mouseEventArgsAreEqual,
    filterHeaderKind,
} from "./event-args.js";
import { pointInRect } from "../../common/math.js";
import {
    type GroupDetailsCallback,
    type GetRowThemeCallback,
    type Highlight,
    drawCell,
} from "./render/data-grid-render.cells.js";
import {
    getActionBoundsForGroup,
    drawHeader,
    computeHeaderLayout,
    getFilterActionBounds,
    flipHorizontal,
} from "./render/data-grid-render.header.js";

export interface DataGridProps {
    readonly width: number;
    readonly height: number;

    readonly showFilter: boolean;
    readonly filterHeight: number;

    readonly cellXOffset: number;
    readonly cellYOffset: number;

    readonly translateX: number | undefined;
    readonly translateY: number | undefined;

    readonly accessibilityHeight: number;

    readonly freezeColumns: number;
    readonly freezeTrailingRows: number;
    readonly hasAppendRow: boolean;
    readonly firstColAccessible: boolean;

    /**
     * Enables or disables the overlay shadow when scrolling horizontally
     * @group Style
     */
    readonly fixedShadowX: boolean | undefined;
    /**
     * Enables or disables the overlay shadow when scrolling vertical
     * @group Style
     */
    readonly fixedShadowY: boolean | undefined;

    readonly allowResize: boolean | undefined;
    readonly isResizing: boolean;
    readonly resizeColumn: number | undefined;
    readonly isDragging: boolean;
    readonly isFilling: boolean;
    readonly isFocused: boolean;

    readonly columns: readonly InnerGridColumn[];
    /**
     * The number of rows in the grid.
     * @group Data
     */
    readonly rows: number;

    readonly headerHeight: number;
    readonly groupHeaderHeight: number;
    readonly enableGroups: boolean;
    readonly rowHeight: number | ((index: number) => number);

    readonly canvasRef: React.MutableRefObject<HTMLCanvasElement | null> | undefined;

    readonly eventTargetRef: React.MutableRefObject<HTMLDivElement | null> | undefined;

    readonly getCellContent: (cell: Item, forceStrict?: boolean) => InnerGridCell;
    readonly getFilterCellContent?: (col: number) => InnerGridCell;
    readonly getRowMarkerFilterCellContent?: () => InnerGridCell;

    /**
     * Provides additional details about groups to extend group functionality.
     * @group Data
     */
    readonly getGroupDetails: GroupDetailsCallback | undefined;
    /**
     * Provides per row theme overrides.
     * @group Style
     */
    readonly getRowThemeOverride: GetRowThemeCallback | undefined;
    /**
     * Emitted when a header menu disclosure indicator is clicked.
     * @group Events
     */
    readonly onHeaderMenuClick: ((col: number, screenPosition: Rectangle) => void) | undefined;

    /**
     * Emitted when a filter clear icon is clicked.
     * @group Events
     */
    readonly onFilterClearClick: ((col: number, screenPosition: Rectangle) => void) | undefined;

    /**
     * Emitted when a header indicator icon is clicked.
     * @group Events
     */
    readonly onHeaderIndicatorClick: ((col: number, screenPosition: Rectangle) => void) | undefined;

    readonly selection: GridSelection;
    readonly prelightCells: readonly Item[] | undefined;
    /**
     * Highlight regions provide hints to users about relations between cells and selections.
     * @group Selection
     */
    readonly highlightRegions: readonly Highlight[] | undefined;

    /**
     * Enabled/disables the fill handle.
     * @defaultValue false
     * @group Editing
     */
    readonly fillHandle: FillHandle | undefined;

    readonly disabledRows: CompactSelection | undefined;
    /**
     * Allows passing a custom image window loader.
     * @group Advanced
     */
    readonly imageWindowLoader: ImageWindowLoader;

    /**
     * Emitted when an item is hovered.
     * @group Events
     */
    readonly onItemHovered: (args: GridMouseEventArgs) => void;
    readonly onMouseMove: (args: GridMouseEventArgs) => void;
    readonly onMouseDown: (args: GridMouseEventArgs) => void;
    readonly onMouseUp: (args: GridMouseEventArgs, isOutside: boolean, sourceEvent: MouseEvent | TouchEvent) => void;
    readonly onContextMenu: (args: GridMouseEventArgs, preventDefault: () => void, sourceEvent: MouseEvent) => void;

    readonly onCanvasFocused: () => void;
    readonly onCanvasBlur: () => void;
    readonly onCellFocused: (args: Item) => void;

    readonly onMouseMoveRaw: (event: MouseEvent) => void;

    /**
     * Emitted when the canvas receives a key down event.
     * @group Events
     */
    readonly onKeyDown: (event: GridKeyEventArgs) => void;
    /**
     * Emitted when the canvas receives a key up event.
     * @group Events
     */
    readonly onKeyUp: ((event: GridKeyEventArgs) => void) | undefined;

    readonly verticalBorder: (col: number) => boolean;

    readonly horizontalBorder: (col: number, row: number) => boolean;

    /**
     * Determines what can be dragged using HTML drag and drop
     * @defaultValue false
     * @group Drag and Drop
     */
    readonly isDraggable: boolean | "cell" | "header" | undefined;
    /**
     * If `isDraggable` is set, the grid becomes HTML draggable, and `onDragStart` will be called when dragging starts.
     * You can use this to build a UI where the user can drag the Grid around.
     * @group Drag and Drop
     */
    readonly onDragStart: (args: GridDragEventArgs) => void;
    readonly onDragEnd: () => void;

    /** @group Drag and Drop */
    readonly onDragOverCell: ((cell: Item, dataTransfer: DataTransfer | null) => void) | undefined;
    /** @group Drag and Drop */
    readonly onDragLeave: (() => void) | undefined;

    /**
     * Called when a HTML Drag and Drop event is ended on the data grid.
     * @group Drag and Drop
     */
    readonly onDrop: ((cell: Item, dataTransfer: DataTransfer | null) => void) | undefined;

    /**
     * Overrides the rendering of a header. The grid will call this for every header it needs to render. Header
     * rendering is not as well optimized because they do not redraw as often, but very heavy drawing methods can
     * negatively impact horizontal scrolling performance.
     *
     * It is possible to return `false` after rendering just a background and the regular foreground rendering
     * will happen.
     * @group Drawing
     * @returns `false` if default header rendering should still happen, `true` to cancel rendering.
     */
    readonly drawHeader: DrawHeaderCallback | undefined;

    readonly drawCell: DrawCellCallback | undefined;

    /**
     * Controls the drawing of the focus ring.
     * @defaultValue true
     * @group Style
     */
    readonly drawFocusRing: boolean;

    readonly dragAndDropState:
        | {
              src: number;
              dest: number;
          }
        | undefined;

    /**
     * Experimental features
     * @group Advanced
     * @experimental
     */
    readonly experimental:
        | {
              readonly disableAccessibilityTree?: boolean;
              readonly disableMinimumCellWidth?: boolean;
              readonly paddingRight?: number;
              readonly paddingBottom?: number;
              readonly enableFirefoxRescaling?: boolean;
              readonly enableSafariRescaling?: boolean;
              readonly kineticScrollPerfHack?: boolean;
              readonly isSubGrid?: boolean;
              readonly strict?: boolean;
              readonly scrollbarWidthOverride?: number;
              readonly hyperWrapping?: boolean;
              readonly renderStrategy?: "single-buffer" | "double-buffer" | "direct";
              /**
               * Allows providing a custom event target for event listeners.
               * If not provided, the grid will use the window as the event target.
               */
              readonly eventTarget?: HTMLElement | Window | Document;
          }
        | undefined;

    /**
     * Additional header icons for use by `GridColumn`.
     *
     * Providing custom header icons to the data grid must be done with a somewhat non-standard mechanism to allow
     * theming and scaling. The `headerIcons` property takes a dictionary which maps icon names to functions which can
     * take a foreground and background color and returns back a string representation of an svg. The svg should contain
     * a header similar to this `<svg width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">` and
     * interpolate the fg/bg colors into the string.
     *
     * We recognize this process is not fantastic from a graphics workflow standpoint, improvements are very welcome
     * here.
     *
     * @group Style
     */
    readonly headerIcons: SpriteMap | undefined;

    /** Controls smooth scrolling in the data grid. If smooth scrolling is not enabled the grid will always be cell
     * aligned.
     * @defaultValue `false`
     * @group Style
     */
    readonly smoothScrollX: boolean | undefined;
    /** Controls smooth scrolling in the data grid. If smooth scrolling is not enabled the grid will always be cell
     * aligned.
     * @defaultValue `false`
     * @group Style
     */
    readonly smoothScrollY: boolean | undefined;

    readonly theme: FullTheme;

    readonly getCellRenderer: <T extends InnerGridCell>(cell: T) => CellRenderer<T> | undefined;

    /**
     * Controls the resize indicator behavior.
     *
     * - `full` will show the resize indicator on the full height.
     * - `header` will show the resize indicator only on the header.
     * - `none` will not show the resize indicator.
     *
     * @defaultValue "full"
     * @group Style
     */
    readonly resizeIndicator: "full" | "header" | "none" | undefined;
    readonly hasRowMarkers?: boolean;

    readonly dragCursor?: "move" | "not-allowed";

    readonly rowMarkerGroup?: string;
}

type ResolvedGridMouseEventArgs = GridMouseEventArgs & {
    readonly resolvedCell?: InnerGridCell;
};

type DamageUpdateList = readonly {
    cell: Item;
    // newValue: GridCell,
}[];

export interface DataGridRef {
    focus: () => void;
    getBounds: (col?: number, row?: number) => Rectangle | undefined;
    damage: (cells: DamageUpdateList) => void;
    getMouseArgsForPosition: (
        posX: number,
        posY: number,
        ev?: MouseEvent | TouchEvent
    ) => GridMouseEventArgs | undefined;
}

const getRowData = (cell: InnerGridCell, getCellRenderer?: GetCellRendererCallback) => {
    if (cell.kind === GridCellKind.Custom) return cell.copyData;
    const r = getCellRenderer?.(cell);
    return r?.getAccessibilityString(cell) ?? "";
};

const DataGrid: React.ForwardRefRenderFunction<DataGridRef, DataGridProps> = (p, forwardedRef) => {
    const {
        width,
        height,
        accessibilityHeight,
        columns,
        cellXOffset: cellXOffsetReal,
        cellYOffset,
        headerHeight,
        fillHandle = false,
        groupHeaderHeight,
        rowHeight,
        rows,
        getCellContent,
        getRowThemeOverride,
        onHeaderMenuClick,
        onFilterClearClick,
        onHeaderIndicatorClick,
        enableGroups,
        isFilling,
        onCanvasFocused,
        onCanvasBlur,
        isFocused,
        selection,
        freezeColumns,
        onContextMenu,
        freezeTrailingRows,
        fixedShadowX = true,
        fixedShadowY = true,
        drawFocusRing,
        onMouseDown,
        onMouseUp,
        onMouseMoveRaw,
        onMouseMove,
        onItemHovered,
        dragAndDropState,
        firstColAccessible,
        onKeyDown,
        onKeyUp,
        highlightRegions,
        canvasRef,
        onDragStart,
        onDragEnd,
        eventTargetRef,
        isResizing,
        resizeColumn: resizeCol,
        isDragging,
        isDraggable = false,
        allowResize,
        disabledRows,
        hasAppendRow,
        getGroupDetails,
        theme,
        prelightCells,
        headerIcons,
        verticalBorder,
        horizontalBorder,
        drawCell: drawCellCallback,
        drawHeader: drawHeaderCallback,
        onCellFocused,
        onDragOverCell,
        onDrop,
        onDragLeave,
        imageWindowLoader,
        smoothScrollX = false,
        smoothScrollY = false,
        experimental,
        getCellRenderer,
        resizeIndicator = "full",
        showFilter,
        filterHeight,
        getFilterCellContent,
        getRowMarkerFilterCellContent,
        hasRowMarkers,
        dragCursor,
        rowMarkerGroup,
    } = p;
    const translateX = p.translateX ?? 0;
    const translateY = p.translateY ?? 0;
    const cellXOffset = Math.max(freezeColumns, Math.min(columns.length - 1, cellXOffsetReal));

    const ref = React.useRef<HTMLCanvasElement | null>(null);
    const windowEventTargetRef = React.useRef<HTMLElement | Window | Document>(experimental?.eventTarget ?? window);
    const windowEventTarget = windowEventTargetRef.current;

    const imageLoader = imageWindowLoader;
    const damageRegion = React.useRef<CellSet | undefined>();
    const [scrolling, setScrolling] = React.useState<boolean>(false);
    const hoverValues = React.useRef<readonly { item: Item; hoverAmount: number }[]>([]);
    const lastBlitData = React.useRef<BlitData | undefined>();
    const [hoveredItemInfo, setHoveredItemInfo] = React.useState<[Item, readonly [number, number]] | undefined>();
    const [hoveredOnEdge, setHoveredOnEdge] = React.useState<boolean>();
    const overlayRef = React.useRef<HTMLCanvasElement | null>(null);
    const [drawCursorOverride, setDrawCursorOverride] = React.useState<GridMouseCursor | undefined>();

    const [lastWasTouch, setLastWasTouch] = React.useState(false);
    const lastWasTouchRef = React.useRef(lastWasTouch);
    lastWasTouchRef.current = lastWasTouch;

    const spriteManager = React.useMemo(
        () =>
            new SpriteManager(headerIcons, () => {
                lastArgsRef.current = undefined;
                lastDrawRef.current();
            }),
        [headerIcons]
    );
    const totalHeaderHeight =
        (enableGroups ? groupHeaderHeight + headerHeight : headerHeight) + (showFilter ? filterHeight : 0);
    const fillHandleOptions = React.useMemo(() => {
        if (fillHandle === false || fillHandle === undefined) return undefined;
        return typeof fillHandle === "object" ? { ...DEFAULT_FILL_HANDLE, ...fillHandle } : DEFAULT_FILL_HANDLE;
    }, [fillHandle]);

    const scrollingStopRef = React.useRef(-1);
    const enableFirefoxRescaling = (experimental?.enableFirefoxRescaling ?? false) && browserIsFirefox.value;
    const enableSafariRescaling = (experimental?.enableSafariRescaling ?? false) && browserIsSafari.value;
    React.useLayoutEffect(() => {
        if (window.devicePixelRatio === 1 || (!enableFirefoxRescaling && !enableSafariRescaling)) return;
        // We don't want to go into scroll mode for a single repaint
        if (scrollingStopRef.current !== -1) {
            setScrolling(true);
        }
        window.clearTimeout(scrollingStopRef.current);
        scrollingStopRef.current = window.setTimeout(() => {
            setScrolling(false);
            scrollingStopRef.current = -1;
        }, 200);
    }, [cellYOffset, cellXOffset, translateX, translateY, enableFirefoxRescaling, enableSafariRescaling]);

    const mappedColumns = useMappedColumns(columns, freezeColumns);
    // damage redraw 只会局部重绘，因此这里先缓存当前真正会参与绘制的列范围，
    // 后面可以快速判断某个 damage 是否会影响到屏幕中的 merged cell / outline
    const visibleDamageColumns = React.useMemo(
        () =>
            new Set(
                getEffectiveColumns(mappedColumns, cellXOffset, width, dragAndDropState, translateX).map(
                    x => x.sourceIndex
                )
            ),
        [mappedColumns, cellXOffset, width, dragAndDropState, translateX]
    );
    const freezeTrailingRowsHeight = React.useMemo(
        () => (freezeTrailingRows > 0 ? getFreezeTrailingHeight(rows, freezeTrailingRows, rowHeight) : 0),
        [freezeTrailingRows, rowHeight, rows]
    );
    const lastScrollableDamageRow = React.useMemo(() => {
        const scrollableRows = rows - freezeTrailingRows;
        if (scrollableRows <= 0) return undefined;

        const scrollableBottomY = height - freezeTrailingRowsHeight - 1;
        if (scrollableBottomY < 0) return undefined;

        const row = getRowIndexForY(
            scrollableBottomY,
            height,
            enableGroups,
            headerHeight,
            groupHeaderHeight,
            showFilter ? filterHeight : 0,
            scrollableRows,
            rowHeight,
            cellYOffset,
            translateY,
            0
        );

        if (row === undefined || row < 0) return undefined;
        return Math.min(row, scrollableRows - 1);
    }, [
        cellYOffset,
        enableGroups,
        filterHeight,
        freezeTrailingRows,
        freezeTrailingRowsHeight,
        groupHeaderHeight,
        headerHeight,
        height,
        rowHeight,
        rows,
        showFilter,
        translateY,
    ]);
    // 屏幕内存在跨多行 outline 时，滚动 blit 仍需要禁用；但局部 damage
    // 只有真正命中这些 outline 范围时才需要升级成全量重绘
    const visibleMultiRowOutlineRanges = React.useMemo<readonly Rectangle[]>(() => {
        if (highlightRegions === undefined || highlightRegions.length === 0) return [];

        const freezeStart = rows - freezeTrailingRows;
        const visibleStartRow = cellYOffset;
        const visibleEndRow = lastScrollableDamageRow ?? cellYOffset - 1;
        const result: Rectangle[] = [];

        for (const region of highlightRegions) {
            if (region.style !== "solid-outline" || region.requiresFullRedraw !== true) continue;

            const regionStartCol = region.range.x;
            const regionEndCol = region.range.x + region.range.width - 1;
            let intersectsVisibleCols = false;
            for (const col of visibleDamageColumns) {
                if (col >= regionStartCol && col <= regionEndCol) {
                    intersectsVisibleCols = true;
                    break;
                }
            }

            if (!intersectsVisibleCols) continue;

            const regionStartRow = region.range.y;
            const regionEndRow = region.range.y + region.range.height - 1;
            const intersectsScrollableRows =
                regionEndRow >= visibleStartRow &&
                lastScrollableDamageRow !== undefined &&
                regionStartRow <= visibleEndRow;
            const intersectsFrozenTrailingRows =
                freezeTrailingRows > 0 && regionEndRow >= freezeStart && regionStartRow < rows;

            if (intersectsScrollableRows || intersectsFrozenTrailingRows) {
                result.push(region.range);
            }
        }

        return result;
    }, [highlightRegions, rows, freezeTrailingRows, cellYOffset, lastScrollableDamageRow, visibleDamageColumns]);
    const hasVisibleMultiRowOutlineHighlight = visibleMultiRowOutlineRanges.length > 0;
    const visibleRowSpanRanges = React.useMemo(() => {
        if (rows <= 0) return [];

        const freezeStart = rows - freezeTrailingRows;
        const firstVisibleRow = Math.max(0, cellYOffset);
        const lastScrollableRow =
            lastScrollableDamageRow === undefined ? undefined : Math.min(freezeStart - 1, lastScrollableDamageRow);
        const rowCandidates = new Set<number>();
        if (lastScrollableRow !== undefined && firstVisibleRow <= lastScrollableRow) {
            rowCandidates.add(firstVisibleRow);
            rowCandidates.add(lastScrollableRow);
        }
        if (freezeTrailingRows > 0 && freezeStart < rows) {
            rowCandidates.add(Math.max(0, freezeStart));
            rowCandidates.add(rows - 1);
        }

        const result: Array<{ col: number; anchorRow: number; spanEnd: number }> = [];
        for (const col of visibleDamageColumns) {
            for (const row of rowCandidates) {
                try {
                    const cell = getCellContent([col, row], true);
                    const rowSpan = cell.rowSpan ?? 1;
                    const rowSpanOffset = cell.rowSpanOffset ?? 0;
                    if (rowSpan <= 1 && rowSpanOffset <= 0) continue;

                    const anchorRow = clamp(row - rowSpanOffset, 0, rows - 1);
                    const spanEnd = Math.min(rows, anchorRow + rowSpan);
                    const intersectsScrollableRows =
                        lastScrollableRow !== undefined && spanEnd > firstVisibleRow && anchorRow <= lastScrollableRow;
                    const intersectsFrozenTrailingRows =
                        freezeTrailingRows > 0 && spanEnd > freezeStart && anchorRow < rows;

                    if (intersectsScrollableRows || intersectsFrozenTrailingRows) {
                        result.push({ col, anchorRow, spanEnd });
                    }
                } catch {
                    // Ignore content providers that cannot serve the sampled boundary cell.
                }
            }
        }

        return result;
    }, [cellYOffset, freezeTrailingRows, getCellContent, lastScrollableDamageRow, rows, visibleDamageColumns]);
    const stickyX = React.useMemo(
        () => (fixedShadowX ? getStickyWidth(mappedColumns, dragAndDropState) : 0),
        [mappedColumns, dragAndDropState, fixedShadowX]
    );

    // row: -1 === columnHeader, -2 === groupHeader, -3 === filterHeader
    const getBoundsForItem = React.useCallback(
        (canvas: HTMLCanvasElement, col: number, row: number): Rectangle | undefined => {
            const rect = canvas.getBoundingClientRect();

            if (col >= mappedColumns.length || row >= rows) {
                return undefined;
            }

            const scale = rect.width / width;

            const result = computeBounds(
                col,
                row,
                width,
                height,
                groupHeaderHeight,
                totalHeaderHeight,
                showFilter ? filterHeight : 0,
                cellXOffset,
                cellYOffset,
                translateX,
                translateY,
                rows,
                freezeColumns,
                freezeTrailingRows,
                mappedColumns,
                rowHeight
            );

            if (scale !== 1) {
                result.x *= scale;
                result.y *= scale;
                result.width *= scale;
                result.height *= scale;
            }

            result.x += rect.x;
            result.y += rect.y;

            return result;
        },
        [
            mappedColumns,
            rows,
            width,
            height,
            groupHeaderHeight,
            totalHeaderHeight,
            showFilter,
            filterHeight,
            cellXOffset,
            cellYOffset,
            translateX,
            translateY,
            freezeColumns,
            freezeTrailingRows,
            rowHeight,
        ]
    );

    const getBoundsForBodyCell = React.useCallback(
        (canvas: HTMLCanvasElement, col: number, row: number, cell?: InnerGridCell): Rectangle | undefined => {
            const baseBounds = getBoundsForItem(canvas, col, row);
            if (baseBounds === undefined || col < 0 || row < 0 || row >= rows) {
                return baseBounds;
            }

            try {
                const resolvedCell = cell ?? getCellContent([col, row]);
                const colSpan = resolvedCell.span ?? [col, col];
                const rowSpan = resolvedCell.rowSpan ?? 1;
                if (rowSpan <= 1 && colSpan[0] === colSpan[1]) {
                    return baseBounds;
                }

                const firstCol = clamp(colSpan[0], 0, mappedColumns.length - 1);
                const lastCol = clamp(colSpan[1], firstCol, mappedColumns.length - 1);
                const anchorRow = clamp(row - (resolvedCell.rowSpanOffset ?? 0), 0, rows - 1);
                const lastRow = clamp(anchorRow + rowSpan - 1, anchorRow, rows - 1);
                const topLeftBounds = getBoundsForItem(canvas, firstCol, anchorRow);
                const bottomRightBounds = getBoundsForItem(canvas, lastCol, lastRow);

                if (topLeftBounds === undefined || bottomRightBounds === undefined) {
                    return baseBounds;
                }

                return {
                    ...baseBounds,
                    x: topLeftBounds.x,
                    y: topLeftBounds.y,
                    width: bottomRightBounds.x + bottomRightBounds.width - topLeftBounds.x,
                    height: bottomRightBounds.y + bottomRightBounds.height - topLeftBounds.y,
                };
            } catch {
                return baseBounds;
            }
        },
        [getBoundsForItem, getCellContent, mappedColumns.length, rows]
    );

    const getMouseArgsForPosition = React.useCallback(
        (
            canvas: HTMLCanvasElement,
            posX: number,
            posY: number,
            ev?: PointerEvent | MouseEvent | TouchEvent
        ): ResolvedGridMouseEventArgs => {
            const rect = canvas.getBoundingClientRect();
            const scale = rect.width / width;
            const x = (posX - rect.left) / scale;
            const y = (posY - rect.top) / scale;
            const edgeDetectionBuffer = 5;

            const effectiveCols = getEffectiveColumns(mappedColumns, cellXOffset, width, undefined, translateX);

            let button = 0;
            let buttons = 0;

            const isMouse =
                (typeof PointerEvent !== "undefined" && ev instanceof PointerEvent && ev.pointerType === "mouse") ||
                (typeof MouseEvent !== "undefined" && ev instanceof MouseEvent);

            const isTouch =
                (typeof PointerEvent !== "undefined" && ev instanceof PointerEvent && ev.pointerType === "touch") ||
                (typeof TouchEvent !== "undefined" && ev instanceof TouchEvent);

            if (isMouse) {
                button = ev.button;
                buttons = ev.buttons;
            }

            // -1 === off right edge
            const col = getColumnIndexForX(x, effectiveCols, translateX);

            // -1: header or above
            // undefined: offbottom
            const row = getRowIndexForY(
                y,
                height,
                enableGroups && mappedColumns?.[col]?.group !== undefined,
                headerHeight,
                groupHeaderHeight,
                showFilter ? filterHeight : 0,
                rows,
                rowHeight,
                cellYOffset,
                translateY,
                freezeTrailingRows
            );

            const shiftKey = ev?.shiftKey === true;
            const ctrlKey = ev?.ctrlKey === true;
            const metaKey = ev?.metaKey === true;

            const scrollEdge: GridMouseEventArgs["scrollEdge"] = [
                x < 0 ? -1 : width < x ? 1 : 0,
                y < totalHeaderHeight ? -1 : height < y ? 1 : 0,
            ];

            let result: ResolvedGridMouseEventArgs;
            if (col === -1 || y < 0 || x < 0 || row === undefined || x > width || y > height) {
                const horizontal = x > width ? 1 : x < 0 ? -1 : 0;
                const vertical = y > height ? 1 : y < 0 ? -1 : 0;

                let innerHorizontal: OutOfBoundsRegionAxis = horizontal * 2;
                let innerVertical: OutOfBoundsRegionAxis = vertical * 2;
                if (horizontal === 0)
                    innerHorizontal = col === -1 ? OutOfBoundsRegionAxis.EndPadding : OutOfBoundsRegionAxis.Center;
                if (vertical === 0)
                    innerVertical = row === undefined ? OutOfBoundsRegionAxis.EndPadding : OutOfBoundsRegionAxis.Center;

                let isEdge = false;
                if (col === -1 && row === -1) {
                    const b = getBoundsForItem(canvas, mappedColumns.length - 1, -1);
                    assert(b !== undefined);
                    isEdge = posX < b.x + b.width + edgeDetectionBuffer;
                }

                // This is used to ensure that clicking on the scrollbar doesn't unset the selection.
                // Unfortunately this doesn't work for overlay scrollbars because they are just a broken interaction
                // by design.
                const isMaybeScrollbar =
                    (x > width && x < width + getScrollBarWidth()) || (y > height && y < height + getScrollBarWidth());

                result = {
                    kind: outOfBoundsKind,
                    location: [col !== -1 ? col : x < 0 ? 0 : mappedColumns.length - 1, row ?? rows - 1],
                    region: [innerHorizontal, innerVertical],
                    shiftKey,
                    ctrlKey,
                    metaKey,
                    isEdge,
                    isTouch,
                    button,
                    buttons,
                    scrollEdge,
                    isMaybeScrollbar,
                };
            } else if (row <= -1) {
                // 头部区域
                let bounds = getBoundsForItem(canvas, col, row);
                assert(bounds !== undefined);
                let isEdge = bounds !== undefined && bounds.x + bounds.width - posX <= edgeDetectionBuffer;

                const previousCol = col - 1;
                if (posX - bounds.x <= edgeDetectionBuffer && previousCol >= 0) {
                    isEdge = true;
                    bounds = getBoundsForItem(canvas, previousCol, row);
                    assert(bounds !== undefined);
                    result = {
                        kind:
                            enableGroups && row === -2
                                ? groupHeaderKind
                                : showFilter && row === -3
                                  ? filterHeaderKind
                                  : headerKind,
                        location: [previousCol, row] as any,
                        bounds: bounds,
                        group: mappedColumns[previousCol].group ?? "",
                        isEdge,
                        shiftKey,
                        ctrlKey,
                        metaKey,
                        isTouch,
                        localEventX: posX - bounds.x,
                        localEventY: posY - bounds.y,
                        button,
                        buttons,
                        scrollEdge,
                    };
                } else {
                    result = {
                        kind:
                            enableGroups && row === -2
                                ? groupHeaderKind
                                : showFilter && row === -3
                                  ? filterHeaderKind
                                  : headerKind,
                        group: mappedColumns[col].group ?? "",
                        location: [col, row] as any,
                        bounds: bounds,
                        isEdge,
                        shiftKey,
                        ctrlKey,
                        metaKey,
                        isTouch,
                        localEventX: posX - bounds.x,
                        localEventY: posY - bounds.y,
                        button,
                        buttons,
                        scrollEdge,
                    };
                }
            } else {
                let resolvedCell: InnerGridCell | undefined;
                try {
                    resolvedCell = getCellContent([col, row]);
                } catch {
                    resolvedCell = undefined;
                }

                const bounds = getBoundsForBodyCell(canvas, col, row, resolvedCell);
                assert(bounds !== undefined);
                const isEdge = bounds !== undefined && bounds.x + bounds.width - posX < edgeDetectionBuffer;

                let isFillHandle = false;
                if (fillHandleOptions !== undefined && selection.current !== undefined) {
                    const fillHandleClickSize = fillHandleOptions.size;
                    const half = fillHandleClickSize / 2;

                    const effectiveCurrentRange = getEffectiveCurrentRange(selection.current, getCellContent, rows);
                    const fillHandleLocation = rectBottomRight(effectiveCurrentRange);
                    const selectedCell = getCellContent(selection.current.cell);
                    const useMergedFillBounds =
                        (selectedCell.rowSpan ?? 1) > 1 ||
                        (selectedCell.rowSpanOffset ?? 0) > 0 ||
                        selectedCell.span !== undefined;
                    const fillBounds = useMergedFillBounds
                        ? getBoundsForBodyCell(canvas, fillHandleLocation[0], fillHandleLocation[1])
                        : getBoundsForItem(canvas, fillHandleLocation[0], fillHandleLocation[1]);

                    if (fillBounds !== undefined) {
                        // Handle center sits exactly on the bottom-right corner of the cell.
                        // Offset by half pixel to align with grid lines.
                        const centerX = fillBounds.x + fillBounds.width + fillHandleOptions.offsetX - half + 0.5;
                        const centerY = fillBounds.y + fillBounds.height + fillHandleOptions.offsetY - half + 0.5;

                        // Check if posX and posY are within fillHandleClickSize from handleLogicalCenter
                        isFillHandle =
                            Math.abs(centerX - posX) < fillHandleClickSize &&
                            Math.abs(centerY - posY) < fillHandleClickSize;
                    }
                }

                result = {
                    kind: "cell",
                    location: [col, row],
                    bounds: bounds,
                    isEdge,
                    shiftKey,
                    ctrlKey,
                    isFillHandle,
                    metaKey,
                    isTouch,
                    localEventX: posX - bounds.x,
                    localEventY: posY - bounds.y,
                    button,
                    buttons,
                    scrollEdge,
                    resolvedCell,
                };
            }
            return result;
        },
        [
            width,
            mappedColumns,
            cellXOffset,
            translateX,
            height,
            enableGroups,
            headerHeight,
            groupHeaderHeight,
            rows,
            rowHeight,
            cellYOffset,
            translateY,
            freezeTrailingRows,
            getBoundsForItem,
            getBoundsForBodyCell,
            getCellContent,
            fillHandleOptions,
            selection,
            totalHeaderHeight,
            showFilter,
            filterHeight,
        ]
    );

    const [hoveredItem] = hoveredItemInfo ?? [];

    const enqueueRef = React.useRef<EnqueueCallback>(() => {
        // do nothing
    });
    const hoverInfoRef = React.useRef(hoveredItemInfo);
    hoverInfoRef.current = hoveredItemInfo;

    const [bufferACtx, bufferBCtx] = React.useMemo(() => {
        const a = document.createElement("canvas");
        const b = document.createElement("canvas");
        a.style["display"] = "none";
        a.style["opacity"] = "0";
        a.style["position"] = "fixed";
        b.style["display"] = "none";
        b.style["opacity"] = "0";
        b.style["position"] = "fixed";
        return [a.getContext("2d", { alpha: false }), b.getContext("2d", { alpha: false })];
    }, []);

    React.useLayoutEffect(() => {
        if (bufferACtx === null || bufferBCtx === null) return;
        document.documentElement.append(bufferACtx.canvas);
        document.documentElement.append(bufferBCtx.canvas);
        return () => {
            bufferACtx.canvas.remove();
            bufferBCtx.canvas.remove();
        };
    }, [bufferACtx, bufferBCtx]);

    const renderStateProvider = React.useMemo(() => new RenderStateProvider(), []);

    const maxDPR = enableFirefoxRescaling && scrolling ? 1 : enableSafariRescaling && scrolling ? 2 : 5;
    const minimumCellWidth = experimental?.disableMinimumCellWidth === true ? 1 : 10;
    const lastArgsRef = React.useRef<DrawGridArg>();

    const canvasCtx = React.useRef<CanvasRenderingContext2D | null>(null);
    const overlayCtx = React.useRef<CanvasRenderingContext2D | null>(null);

    const draw = React.useCallback(() => {
        const canvas = ref.current;
        const overlay = overlayRef.current;
        if (canvas === null || overlay === null) return;

        if (canvasCtx.current === null) {
            canvasCtx.current = canvas.getContext("2d", { alpha: false });
            canvas.width = 0;
            canvas.height = 0;
        }

        if (overlayCtx.current === null) {
            overlayCtx.current = overlay.getContext("2d", { alpha: false });
            overlay.width = 0;
            overlay.height = 0;
        }

        if (canvasCtx.current === null || overlayCtx.current === null || bufferACtx === null || bufferBCtx === null) {
            return;
        }

        let didOverride = false;
        const overrideCursor = (cursor: GridMouseCursor) => {
            didOverride = true;
            setDrawCursorOverride(cursor);
        };

        const last = lastArgsRef.current;
        const current = {
            headerCanvasCtx: overlayCtx.current,
            canvasCtx: canvasCtx.current,
            bufferACtx,
            bufferBCtx,
            width,
            height,
            showFilter,
            filterHeight,
            cellXOffset,
            cellYOffset,
            translateX: Math.round(translateX),
            translateY: Math.round(translateY),
            mappedColumns,
            enableGroups,
            freezeColumns,
            dragAndDropState,
            theme,
            headerHeight,
            groupHeaderHeight,
            disabledRows: disabledRows ?? CompactSelection.empty(),
            rowHeight,
            verticalBorder,
            horizontalBorder,
            isResizing,
            resizeCol,
            isFocused,
            selection,
            fillHandle,
            drawCellCallback,
            hasAppendRow,
            overrideCursor,
            maxScaleFactor: maxDPR,
            freezeTrailingRows,
            rows,
            drawFocus: drawFocusRing,
            getCellContent,
            getFilterCellContent,
            getRowMarkerFilterCellContent,
            getGroupDetails: getGroupDetails ?? (name => ({ name })),
            getRowThemeOverride,
            drawHeaderCallback,
            prelightCells,
            highlightRegions,
            imageLoader,
            lastBlitData,
            damage: damageRegion.current,
            hoverValues: hoverValues.current,
            hoverInfo: hoverInfoRef.current,
            spriteManager,
            scrolling,
            hyperWrapping: experimental?.hyperWrapping ?? false,
            touchMode: lastWasTouch,
            enqueue: enqueueRef.current,
            renderStateProvider,
            renderStrategy: experimental?.renderStrategy ?? (browserIsSafari.value ? "double-buffer" : "single-buffer"),
            disableBlit: hasVisibleMultiRowOutlineHighlight,
            getCellRenderer,
            minimumCellWidth,
            resizeIndicator,
            hasRowMarkers,
            rowMarkerGroup,
        } as DrawGridArg;

        // This confusing bit of code due to some poor design. Long story short, the damage property is only used
        // with what is effectively the "last args" for the last normal draw anyway. We don't want the drawing code
        // to look at this and go "shit dawg, nothing changed" so we force it to draw frash, but the damage restricts
        // the draw anyway.
        //
        // Dear future Jason, I'm sorry. It was expedient, it worked, and had almost zero perf overhead. THe universe
        // basically made me do it. What choice did I have?
        if (current.damage === undefined) {
            lastArgsRef.current = current as any;
            drawGrid(current, last);
        } else {
            drawGrid(current, undefined);
        }

        // don't reset on damage events
        if (!didOverride && (current.damage === undefined || current.damage.has(hoverInfoRef?.current?.[0]))) {
            setDrawCursorOverride(undefined);
        }
    }, [
        bufferACtx,
        bufferBCtx,
        width,
        height,
        showFilter,
        filterHeight,
        cellXOffset,
        cellYOffset,
        translateX,
        translateY,
        mappedColumns,
        enableGroups,
        freezeColumns,
        dragAndDropState,
        theme,
        headerHeight,
        groupHeaderHeight,
        disabledRows,
        rowHeight,
        verticalBorder,
        horizontalBorder,
        isResizing,
        resizeCol,
        isFocused,
        selection,
        fillHandle,
        drawCellCallback,
        hasAppendRow,
        maxDPR,
        freezeTrailingRows,
        rows,
        drawFocusRing,
        getCellContent,
        getFilterCellContent,
        getRowMarkerFilterCellContent,
        hasRowMarkers,
        getGroupDetails,
        getRowThemeOverride,
        drawHeaderCallback,
        prelightCells,
        highlightRegions,
        hasVisibleMultiRowOutlineHighlight,
        imageLoader,
        spriteManager,
        scrolling,
        experimental?.hyperWrapping,
        experimental?.renderStrategy,
        lastWasTouch,
        renderStateProvider,
        getCellRenderer,
        minimumCellWidth,
        resizeIndicator,
        rowMarkerGroup,
    ]);

    const lastDrawRef = React.useRef(draw);
    React.useLayoutEffect(() => {
        draw();
        lastDrawRef.current = draw;
    }, [draw]);

    React.useLayoutEffect(() => {
        const fn = async () => {
            if (document?.fonts?.ready === undefined) return;
            await document.fonts.ready;
            lastArgsRef.current = undefined;
            lastDrawRef.current();
        };
        void fn();
    }, []);

    const shouldForceFullRedrawForDamage = React.useCallback(
        (locations: CellSet) => {
            for (const cell of locations.values()) {
                const [col, row] = cell;
                if (!visibleDamageColumns.has(col)) continue;
                if (row < 0 || row >= rows) continue;

                const freezeStart = rows - freezeTrailingRows;
                const isStickyTrailingRow = freezeTrailingRows > 0 && row >= freezeStart;
                const isVisibleRow =
                    isStickyTrailingRow ||
                    (row >= cellYOffset && lastScrollableDamageRow !== undefined && row <= lastScrollableDamageRow);

                if (!isVisibleRow) {
                    for (const range of visibleRowSpanRanges) {
                        if (range.col === col && row >= range.anchorRow && row < range.spanEnd) {
                            return true;
                        }
                    }
                }

                for (const range of visibleMultiRowOutlineRanges) {
                    if (
                        col >= range.x &&
                        col < range.x + range.width &&
                        row >= range.y &&
                        row < range.y + range.height
                    ) {
                        return true;
                    }
                }

                if (!isVisibleRow) continue;

                const content = getCellContent(cell, true);
                const rowSpan = content.rowSpan ?? 1;
                const rowSpanOffset = content.rowSpanOffset ?? 0;
                // 只要 damage 命中了 rowSpan 任意一行，就不能只擦当前小格子
                // 否则背景、高亮和边框会与真实合并块边界不同步
                if (rowSpan > 1 || rowSpanOffset > 0) {
                    const anchorRow = clamp(row - rowSpanOffset, 0, rows - 1);
                    const spanEnd = Math.min(rows, anchorRow + rowSpan);
                    const intersectsScrollableRows =
                        lastScrollableDamageRow !== undefined &&
                        spanEnd > cellYOffset &&
                        anchorRow <= lastScrollableDamageRow;
                    const intersectsFrozenTrailingRows =
                        freezeTrailingRows > 0 && spanEnd > freezeStart && anchorRow < rows;

                    if (intersectsScrollableRows || intersectsFrozenTrailingRows) {
                        return true;
                    }
                }
            }

            return false;
        },
        [
            cellYOffset,
            freezeTrailingRows,
            getCellContent,
            lastScrollableDamageRow,
            rows,
            visibleDamageColumns,
            visibleMultiRowOutlineRanges,
            visibleRowSpanRanges,
        ]
    );

    const drawWithDamage = React.useCallback(
        (locations: CellSet) => {
            // merged cell / merged outline 命中时退化成全量重绘，
            // 其它普通场景仍保留原来的高性能局部 damage
            if (shouldForceFullRedrawForDamage(locations)) {
                damageRegion.current = undefined;
                lastArgsRef.current = undefined;
                lastDrawRef.current();
                return;
            }

            damageRegion.current = locations;
            lastDrawRef.current();
            damageRegion.current = undefined;
        },
        [shouldForceFullRedrawForDamage]
    );

    const damageInternal = React.useCallback(
        (locations: CellSet) => {
            drawWithDamage(locations);
        },
        [drawWithDamage]
    );

    const enqueue = useAnimationQueue(damageInternal);
    enqueueRef.current = enqueue;

    const damage = React.useCallback(
        (cells: DamageUpdateList) => {
            damageInternal(new CellSet(cells.map(x => x.cell)));
        },
        [damageInternal]
    );

    imageLoader.setCallback(damageInternal);

    const [overFill, setOverFill] = React.useState(false);

    const [hCol, hRow] = hoveredItem ?? [];
    const headerHovered =
        hCol !== undefined &&
        hRow === -1 &&
        hCol >= 0 &&
        hCol < mappedColumns.length &&
        mappedColumns[hCol].headerRowMarkerDisabled !== true;
    const groupHeaderHovered = hCol !== undefined && hRow === -2;
    const filterHovered = hCol !== undefined && hRow === -3;

    let clickableInnerCellHovered = false;
    let editableBoolHovered = false;
    let cursorOverride: GridMouseCursor | undefined = drawCursorOverride;
    if (cursorOverride === undefined && hCol !== undefined && hRow !== undefined && hRow > -1 && hRow < rows) {
        const cell = getCellContent([hCol, hRow], true);
        clickableInnerCellHovered =
            cell.kind === InnerGridCellKind.NewRow ||
            (cell.kind === InnerGridCellKind.Marker && cell.markerKind !== "number");
        editableBoolHovered = cell.kind === GridCellKind.Boolean && booleanCellIsEditable(cell);
        cursorOverride = cell.cursor;
    }
    const canDrag = hoveredOnEdge ?? false;
    const cursor = isDragging
        ? (dragCursor ?? "move")
        : canDrag || isResizing
          ? "col-resize"
          : overFill || isFilling
            ? (fillHandleOptions?.cursor ?? "crosshair")
            : cursorOverride !== undefined
              ? cursorOverride
              : headerHovered || clickableInnerCellHovered || editableBoolHovered || groupHeaderHovered
                ? "pointer"
                : filterHovered
                  ? hasRowMarkers === true && hCol === 0
                      ? "pointer"
                      : "text"
                  : "default";
    const style = React.useMemo<React.CSSProperties>(
        () => ({
            // width,
            // height,
            contain: "strict",
            display: "block",
            cursor: cursor as React.CSSProperties["cursor"],
        }),
        [cursor]
    );

    const styleCursor = style.cursor ?? "default";
    const lastSetCursor = React.useRef<GridMouseCursor>(styleCursor);
    const target = eventTargetRef?.current;
    if (target !== null && target !== undefined && lastSetCursor.current !== styleCursor) {
        // because we have an event target we need to set its cursor instead.
        target.style.cursor = lastSetCursor.current = styleCursor;
    }

    const groupHeaderActionForEvent = React.useCallback(
        (group: string, bounds: Rectangle, localEventX: number, localEventY: number) => {
            if (getGroupDetails === undefined) return undefined;
            const groupDesc = getGroupDetails(group);
            if (groupDesc.actions !== undefined) {
                const boxes = getActionBoundsForGroup(bounds, groupDesc.actions);
                for (const [i, box] of boxes.entries()) {
                    if (pointInRect(box, localEventX + bounds.x, localEventY + box.y)) {
                        return groupDesc.actions[i];
                    }
                }
            }
            return undefined;
        },
        [getGroupDetails]
    );

    const isOverHeaderElement = React.useCallback(
        (
            canvas: HTMLCanvasElement,
            col: number,
            clientX: number,
            clientY: number
        ):
            | {
                  area: "menu" | "indicator" | "filter";
                  bounds: Rectangle;
              }
            | undefined => {
            const header = mappedColumns[col];

            if (!isDragging && !isResizing && !(hoveredOnEdge ?? false)) {
                const headerBounds = getBoundsForItem(canvas, col, -1);
                assert(headerBounds !== undefined);
                const headerLayout = computeHeaderLayout(
                    undefined,
                    header,
                    headerBounds.x,
                    headerBounds.y,
                    headerBounds.width,
                    headerBounds.height,
                    theme,
                    direction(header.title) === "rtl"
                );
                if (
                    header.hasMenu === true &&
                    headerLayout.menuBounds !== undefined &&
                    pointInRect(headerLayout.menuBounds, clientX, clientY)
                ) {
                    return {
                        area: "menu",
                        bounds: headerLayout.menuBounds,
                    };
                } else if (
                    header.indicatorIcon !== undefined &&
                    headerLayout.indicatorIconBounds !== undefined &&
                    pointInRect(headerLayout.indicatorIconBounds, clientX, clientY)
                ) {
                    return {
                        area: "indicator",
                        bounds: headerLayout.indicatorIconBounds,
                    };
                }
            }

            return undefined;
        },
        [mappedColumns, isDragging, isResizing, hoveredOnEdge, getBoundsForItem, theme]
    );

    const isOverFilterElement = React.useCallback(
        (canvas: HTMLCanvasElement, col: number, clientX: number, clientY: number) => {
            if (!isDragging && !isResizing && !(hoveredOnEdge ?? false) && showFilter) {
                const filterBounds = getBoundsForItem(canvas, col, -3);
                assert(filterBounds !== undefined);

                const filterLayout = {
                    actionBounds: flipHorizontal(
                        getFilterActionBounds(
                            filterBounds.x,
                            filterBounds.y,
                            filterBounds.width,
                            filterBounds.height,
                            theme.cellHorizontalPadding * 2,
                            false
                        ),
                        filterBounds.x + filterBounds.width / 2,
                        false
                    ),
                };

                const filterCell =
                    col === 0 && hasRowMarkers === true
                        ? getRowMarkerFilterCellContent?.()
                        : getFilterCellContent?.(col);

                if (
                    filterLayout.actionBounds !== undefined &&
                    pointInRect(filterLayout.actionBounds, clientX, clientY) &&
                    filterCell?.kind === GridCellKind.Custom &&
                    (Array.isArray((filterCell.data as any)?.displayData)
                        ? (filterCell.data as any)?.displayData.length > 0
                        : // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
                          !!(filterCell.data as any)?.displayData)
                ) {
                    return {
                        area: "filter",
                        bounds: filterLayout.actionBounds,
                    };
                }
            }
            return undefined;
        },
        [
            getBoundsForItem,
            getFilterCellContent,
            getRowMarkerFilterCellContent,
            hasRowMarkers,
            hoveredOnEdge,
            isDragging,
            isResizing,
            showFilter,
            theme.cellHorizontalPadding,
        ]
    );

    const downTime = React.useRef(0);
    const downPosition = React.useRef<Item>();
    const mouseDown = React.useRef(false);
    const onPointerDown = React.useCallback(
        (ev: MouseEvent | TouchEvent) => {
            const canvas = ref.current;
            const eventTarget = eventTargetRef?.current;
            if (canvas === null || (ev.target !== canvas && ev.target !== eventTarget)) return;
            mouseDown.current = true;

            // const clientX = ev.clientX;
            // const clientY = ev.clientY;
            let clientX: number;
            let clientY: number;
            if (ev instanceof MouseEvent) {
                clientX = ev.clientX;
                clientY = ev.clientY;
            } else {
                clientX = ev.touches[0].clientX;
                clientY = ev.touches[0].clientY;
            }

            if (ev.target === eventTarget && eventTarget !== null) {
                const bounds = eventTarget.getBoundingClientRect();
                if (clientX > bounds.right || clientY > bounds.bottom) return;
            }

            const args = getMouseArgsForPosition(canvas, clientX, clientY, ev);
            downPosition.current = args.location;

            if (args.isTouch) {
                downTime.current = Date.now();
            }
            if (lastWasTouchRef.current !== args.isTouch) {
                setLastWasTouch(args.isTouch);
            }

            if (
                args.kind === headerKind &&
                isOverHeaderElement(canvas, args.location[0], clientX, clientY) !== undefined
            ) {
                return;
            } else if (
                args.kind === filterHeaderKind &&
                isOverFilterElement(canvas, args.location[0], clientX, clientY) !== undefined
            ) {
                return;
            } else if (args.kind === groupHeaderKind) {
                const action = groupHeaderActionForEvent(args.group, args.bounds, args.localEventX, args.localEventY);
                if (action !== undefined) {
                    return;
                }
            }

            onMouseDown?.(args);
            if (
                !args.isTouch &&
                isDraggable !== true &&
                isDraggable !== args.kind &&
                args.button < 3 &&
                args.button !== 1
            ) {
                // preventing default in touch events stops scroll
                ev.preventDefault();
            }
        },
        [
            eventTargetRef,
            getMouseArgsForPosition,
            isOverHeaderElement,
            isOverFilterElement,
            onMouseDown,
            isDraggable,
            groupHeaderActionForEvent,
        ]
    );
    // useEventListener("pointerdown", onPointerDown, windowEventTarget, false);
    useEventListener("touchstart", onPointerDown, windowEventTarget, false);
    useEventListener("mousedown", onPointerDown, windowEventTarget, false);

    const lastUpTime = React.useRef(0);

    const onPointerUp = React.useCallback(
        (ev: PointerEvent | MouseEvent | TouchEvent) => {
            const lastUpTimeValue = lastUpTime.current;
            lastUpTime.current = Date.now();
            const canvas = ref.current;
            mouseDown.current = false;
            if (onMouseUp === undefined || canvas === null) return;
            const eventTarget = eventTargetRef?.current;

            const isOutside = ev.target !== canvas && ev.target !== eventTarget;
            // const clientX = ev.clientX;
            // const clientY = ev.clientY;
            let clientX: number;
            let clientY: number;
            let canCancel = true;
            if (ev instanceof MouseEvent) {
                clientX = ev.clientX;
                clientY = ev.clientY;
                canCancel = ev.button < 3;
                if ((ev as any).pointerType === "touch") {
                    return;
                }
            } else {
                clientX = ev.changedTouches[0].clientX;
                clientY = ev.changedTouches[0].clientY;
            }
            // const canCancel = ev.pointerType === "mouse" ? ev.button < 3 : true;

            let args = getMouseArgsForPosition(canvas, clientX, clientY, ev);

            if (args.isTouch && downTime.current !== 0 && Date.now() - downTime.current > 500) {
                args = {
                    ...args,
                    isLongTouch: true,
                };
            }

            if (lastUpTimeValue !== 0 && Date.now() - lastUpTimeValue < (args.isTouch ? 1000 : 500)) {
                args = {
                    ...args,
                    isDoubleClick: true,
                };
            }

            if (lastWasTouchRef.current !== args.isTouch) {
                setLastWasTouch(args.isTouch);
            }

            if (!isOutside && ev.cancelable && canCancel) {
                ev.preventDefault();
            }

            const [col] = args.location;
            const headerBounds = isOverHeaderElement(canvas, col, clientX, clientY);
            if (args.kind === headerKind && headerBounds !== undefined) {
                if (args.button !== 0 || downPosition.current?.[0] !== col || downPosition.current?.[1] !== -1) {
                    // force outside so that click will not process
                    onMouseUp(args, true, ev);
                }
                return;
            } else if (args.kind === filterHeaderKind) {
                const filterBounds = isOverFilterElement(canvas, col, clientX, clientY);

                if (filterBounds !== undefined) {
                    if (args.button !== 0 || downPosition.current?.[0] !== col || downPosition.current?.[1] !== -3) {
                        // force outside so that click will not process
                        onMouseUp(args, true, ev);
                    }
                    return;
                }
            } else if (args.kind === groupHeaderKind) {
                const action = groupHeaderActionForEvent(args.group, args.bounds, args.localEventX, args.localEventY);
                if (action !== undefined) {
                    if (args.button === 0) {
                        action.onClick?.(args);
                    }
                    return;
                }
            }

            onMouseUp(args, isOutside, ev);
        },
        [
            onMouseUp,
            eventTargetRef,
            getMouseArgsForPosition,
            isOverHeaderElement,
            isOverFilterElement,
            groupHeaderActionForEvent,
        ]
    );
    // useEventListener("pointerup", onPointerUp, windowEventTarget, false);
    useEventListener("mouseup", onPointerUp, windowEventTarget, false);
    useEventListener("touchend", onPointerUp, windowEventTarget, false);

    const onClickImpl = React.useCallback(
        (ev: MouseEvent | TouchEvent) => {
            const canvas = ref.current;
            if (canvas === null) return;
            const eventTarget = eventTargetRef?.current;

            const isOutside = ev.target !== canvas && ev.target !== eventTarget;

            let clientX: number;
            let clientY: number;
            let canCancel = true;
            if (ev instanceof MouseEvent) {
                clientX = ev.clientX;
                clientY = ev.clientY;
                canCancel = ev.button < 3;
            } else {
                clientX = ev.changedTouches[0].clientX;
                clientY = ev.changedTouches[0].clientY;
            }

            const args = getMouseArgsForPosition(canvas, clientX, clientY, ev);

            if (lastWasTouchRef.current !== args.isTouch) {
                setLastWasTouch(args.isTouch);
            }

            if (!isOutside && ev.cancelable && canCancel) {
                ev.preventDefault();
            }

            const [col] = args.location;
            // eslint-disable-next-line unicorn/prefer-switch
            if (args.kind === headerKind) {
                const headerBounds = isOverHeaderElement(canvas, col, clientX, clientY);
                if (
                    headerBounds !== undefined &&
                    args.button === 0 &&
                    downPosition.current?.[0] === col &&
                    downPosition.current?.[1] === -1
                ) {
                    if (headerBounds.area === "menu") {
                        onHeaderMenuClick?.(col, headerBounds.bounds);
                    } else if (headerBounds.area === "indicator") {
                        onHeaderIndicatorClick?.(col, headerBounds.bounds);
                    }
                }
            } else if (args.kind === filterHeaderKind) {
                const filterBounds = isOverFilterElement(canvas, col, clientX, clientY);

                if (
                    filterBounds !== undefined &&
                    args.button === 0 &&
                    downPosition.current?.[0] === col &&
                    downPosition.current?.[1] === -3 &&
                    filterBounds.area === "filter"
                ) {
                    onFilterClearClick?.(col, filterBounds.bounds);
                }
            }
        },
        [
            eventTargetRef,
            getMouseArgsForPosition,
            isOverHeaderElement,
            onHeaderMenuClick,
            onHeaderIndicatorClick,
            isOverFilterElement,
            onFilterClearClick,
        ]
    );
    useEventListener("click", onClickImpl, windowEventTarget, false);

    const onContextMenuImpl = React.useCallback(
        (ev: MouseEvent) => {
            const canvas = ref.current;
            const eventTarget = eventTargetRef?.current;
            if (canvas === null || (ev.target !== canvas && ev.target !== eventTarget) || onContextMenu === undefined)
                return;
            const args = getMouseArgsForPosition(canvas, ev.clientX, ev.clientY, ev);
            onContextMenu(
                args,
                () => {
                    if (ev.cancelable) ev.preventDefault();
                },
                ev
            );
        },
        [eventTargetRef, getMouseArgsForPosition, onContextMenu]
    );
    useEventListener("contextmenu", onContextMenuImpl, eventTargetRef?.current ?? null, false);

    const onAnimationFrame = React.useCallback<StepCallback>(
        values => {
            hoverValues.current = values;
            // hover 动画也复用同一套 damage 策略，避免 hover 时再次把合并块边缘擦坏
            drawWithDamage(new CellSet(values.map(x => x.item)));
        },
        [drawWithDamage]
    );

    const animManagerValue = React.useMemo(() => new AnimationManager(onAnimationFrame), [onAnimationFrame]);
    const animationManager = React.useRef(animManagerValue);
    animationManager.current = animManagerValue;
    React.useLayoutEffect(() => {
        const am = animationManager.current;
        if (hoveredItem === undefined || hoveredItem[1] < 0) {
            am.setHovered(hoveredItem);
            return;
        }
        const cell = getCellContent(hoveredItem as [number, number], true);
        const r = getCellRenderer(cell);
        const cellNeedsHover =
            (r === undefined && cell.kind === GridCellKind.Custom) ||
            (r?.needsHover !== undefined && (typeof r.needsHover === "boolean" ? r.needsHover : r.needsHover(cell)));
        am.setHovered(cellNeedsHover ? hoveredItem : undefined);
    }, [getCellContent, getCellRenderer, hoveredItem]);

    const hoveredRef = React.useRef<GridMouseEventArgs>();
    const onPointerMove = React.useCallback(
        (ev: MouseEvent) => {
            const canvas = ref.current;
            if (canvas === null) return;

            const eventTarget = eventTargetRef?.current;
            const isIndirect = ev.target !== canvas && ev.target !== eventTarget;

            const args = getMouseArgsForPosition(canvas, ev.clientX, ev.clientY, ev);
            if (args.kind !== "out-of-bounds" && isIndirect && !mouseDown.current && !args.isTouch) {
                // we are obscured by something else, so we want to not register events if we are not doing anything
                // important already
                return;
            }

            // the point here is not to trigger re-renders every time the mouse moves over a cell
            // that doesn't care about the mouse positon.
            const maybeSetHoveredInfo = (newVal: typeof hoveredItemInfo, needPosition: boolean) => {
                setHoveredItemInfo(cv => {
                    if (cv === newVal) return cv;
                    if (
                        cv?.[0][0] === newVal?.[0][0] &&
                        cv?.[0][1] === newVal?.[0][1] &&
                        ((cv?.[1][0] === newVal?.[1][0] && cv?.[1][1] === newVal?.[1][1]) || !needPosition)
                    ) {
                        return cv;
                    }
                    return newVal;
                });
            };

            if (!mouseEventArgsAreEqual(args, hoveredRef.current)) {
                setDrawCursorOverride(undefined);
                onItemHovered?.(args);
                maybeSetHoveredInfo(
                    args.kind === outOfBoundsKind ? undefined : [args.location, [args.localEventX, args.localEventY]],
                    true
                );
                hoveredRef.current = args;
            } else if (
                args.kind === "cell" ||
                args.kind === headerKind ||
                args.kind === groupHeaderKind ||
                args.kind === filterHeaderKind
            ) {
                let needsDamageCell = false;
                let needsHoverPosition = true;
                let shouldRefireHover = false;

                if (args.kind === "cell") {
                    const toCheck = args.resolvedCell ?? getCellContent(args.location);
                    const rendererNeeds = getCellRenderer(toCheck)?.needsHoverPosition;
                    // custom cells we will assume need the position if they don't explicitly say they don't, everything
                    // else we will assume doesn't need it.
                    needsHoverPosition = rendererNeeds ?? toCheck.kind === GridCellKind.Custom;
                    needsDamageCell = needsHoverPosition;

                    const sameLocalPosition =
                        hoveredRef.current?.kind === "cell" &&
                        hoveredRef.current.localEventX === args.localEventX &&
                        hoveredRef.current.localEventY === args.localEventY;
                    shouldRefireHover =
                        needsHoverPosition && !sameLocalPosition && !(hasRowMarkers === true && args.location[0] === 0);
                } else {
                    needsDamageCell = true;
                }

                const newInfo: typeof hoverInfoRef.current = [args.location, [args.localEventX, args.localEventY]];
                maybeSetHoveredInfo(newInfo, needsHoverPosition);
                hoverInfoRef.current = newInfo;
                hoveredRef.current = args;
                if (shouldRefireHover) {
                    setDrawCursorOverride(undefined);
                    onItemHovered?.(args);
                }
                if (needsDamageCell) {
                    damageInternal(new CellSet([args.location]));
                }
            }

            if ((hasRowMarkers === true && args.location[0] === 0) || args.kind === "group-header") {
                onItemHovered?.(args);
            }

            const notRowMarkerCol = args.location[0] >= (firstColAccessible ? 0 : 1);
            setHoveredOnEdge(
                (args.kind === headerKind || args.kind === filterHeaderKind) &&
                    args.isEdge &&
                    notRowMarkerCol &&
                    allowResize === true &&
                    columns?.[args.location[0]]?.resizable === true
            );

            setOverFill(args.kind === "cell" && args.isFillHandle);

            onMouseMoveRaw?.(ev);
            onMouseMove(args);
        },
        [
            eventTargetRef,
            getMouseArgsForPosition,
            hasRowMarkers,
            firstColAccessible,
            allowResize,
            columns,
            onMouseMoveRaw,
            onMouseMove,
            onItemHovered,
            getCellContent,
            getCellRenderer,
            damageInternal,
        ]
    );
    useEventListener("pointermove", onPointerMove, windowEventTarget, true);

    const onKeyDownImpl = React.useCallback(
        (event: React.KeyboardEvent<HTMLCanvasElement>) => {
            const canvas = ref.current;
            if (canvas === null) return;

            let bounds: Rectangle | undefined;
            let location: Item | undefined = undefined;
            if (selection.current !== undefined) {
                bounds = getBoundsForBodyCell(canvas, selection.current.cell[0], selection.current.cell[1]);
                location = selection.current.cell;
            }

            onKeyDown?.({
                bounds,
                stopPropagation: () => event.stopPropagation(),
                preventDefault: () => event.preventDefault(),
                cancel: () => undefined,
                ctrlKey: event.ctrlKey,
                metaKey: event.metaKey,
                shiftKey: event.shiftKey,
                altKey: event.altKey,
                key: event.key,
                keyCode: event.keyCode,
                rawEvent: event,
                location,
            });
        },
        [onKeyDown, selection, getBoundsForBodyCell]
    );

    const onKeyUpImpl = React.useCallback(
        (event: React.KeyboardEvent<HTMLCanvasElement>) => {
            const canvas = ref.current;
            if (canvas === null) return;

            let bounds: Rectangle | undefined;
            let location: Item | undefined = undefined;
            if (selection.current !== undefined) {
                bounds = getBoundsForBodyCell(canvas, selection.current.cell[0], selection.current.cell[1]);
                location = selection.current.cell;
            }

            onKeyUp?.({
                bounds,
                stopPropagation: () => event.stopPropagation(),
                preventDefault: () => event.preventDefault(),
                cancel: () => undefined,
                ctrlKey: event.ctrlKey,
                metaKey: event.metaKey,
                shiftKey: event.shiftKey,
                altKey: event.altKey,
                key: event.key,
                keyCode: event.keyCode,
                rawEvent: event,
                location,
            });
        },
        [onKeyUp, selection, getBoundsForBodyCell]
    );

    const refImpl = React.useCallback(
        (instance: HTMLCanvasElement | null) => {
            ref.current = instance;
            if (canvasRef !== undefined) {
                canvasRef.current = instance;
            }

            if (experimental?.eventTarget) {
                windowEventTargetRef.current = experimental.eventTarget;
            } else if (instance === null) {
                windowEventTargetRef.current = window;
            } else {
                const docRoot = instance.getRootNode();

                if (docRoot === document) windowEventTargetRef.current = window;
                windowEventTargetRef.current = docRoot as any;
            }
        },
        [canvasRef, experimental?.eventTarget]
    );

    const onDragStartImpl = React.useCallback(
        (event: DragEvent) => {
            const canvas = ref.current;
            if (canvas === null || isDraggable === false || isResizing) {
                event.preventDefault();
                return;
            }

            let dragMime: string | undefined;
            let dragData: string | undefined;

            const args = getMouseArgsForPosition(canvas, event.clientX, event.clientY);

            if (isDraggable !== true && args.kind !== isDraggable) {
                event.preventDefault();
                return;
            }

            const setData = (mime: string, payload: string) => {
                dragMime = mime;
                dragData = payload;
            };

            let dragImage: Element | undefined;
            let dragImageX: number | undefined;
            let dragImageY: number | undefined;
            const setDragImage = (image: Element, x: number, y: number) => {
                dragImage = image;
                dragImageX = x;
                dragImageY = y;
            };

            let prevented = false;

            onDragStart?.({
                ...args,
                setData,
                setDragImage,
                preventDefault: () => (prevented = true),
                defaultPrevented: () => prevented,
            });
            if (!prevented && dragMime !== undefined && dragData !== undefined && event.dataTransfer !== null) {
                event.dataTransfer.setData(dragMime, dragData);
                event.dataTransfer.effectAllowed = "copyLink";

                if (dragImage !== undefined && dragImageX !== undefined && dragImageY !== undefined) {
                    event.dataTransfer.setDragImage(dragImage, dragImageX, dragImageY);
                } else {
                    const [col, row] = args.location;
                    if (row !== undefined) {
                        const offscreen = document.createElement("canvas");
                        const boundsForDragTarget = getBoundsForItem(canvas, col, row);

                        assert(boundsForDragTarget !== undefined);
                        const dpr = Math.ceil(window.devicePixelRatio ?? 1);
                        offscreen.width = boundsForDragTarget.width * dpr;
                        offscreen.height = boundsForDragTarget.height * dpr;

                        const ctx = offscreen.getContext("2d");
                        if (ctx !== null) {
                            ctx.scale(dpr, dpr);
                            ctx.textBaseline = "middle";
                            if (row === -1) {
                                ctx.font = theme.headerFontFull;
                                ctx.fillStyle = theme.bgHeader;
                                ctx.fillRect(0, 0, offscreen.width, offscreen.height);
                                drawHeader(
                                    ctx,
                                    0,
                                    0,
                                    boundsForDragTarget.width,
                                    boundsForDragTarget.height,
                                    mappedColumns[col],
                                    false,
                                    theme,
                                    false,
                                    undefined,
                                    undefined,
                                    false,
                                    0,
                                    spriteManager,
                                    drawHeaderCallback,
                                    false
                                );
                            } else {
                                ctx.font = theme.baseFontFull;
                                ctx.fillStyle = theme.bgCell;
                                ctx.fillRect(0, 0, offscreen.width, offscreen.height);
                                drawCell(
                                    ctx,
                                    getCellContent([col, row]),
                                    0,
                                    row,
                                    false,
                                    false,
                                    0,
                                    0,
                                    boundsForDragTarget.width,
                                    boundsForDragTarget.height,
                                    false,
                                    theme,
                                    theme.bgCell,
                                    imageLoader,
                                    spriteManager,
                                    1,
                                    undefined,
                                    false,
                                    0,
                                    undefined,
                                    undefined,
                                    undefined,
                                    renderStateProvider,
                                    getCellRenderer,
                                    () => undefined
                                );
                            }
                        }

                        offscreen.style.left = "-100%";
                        offscreen.style.position = "absolute";
                        offscreen.style.width = `${boundsForDragTarget.width}px`;
                        offscreen.style.height = `${boundsForDragTarget.height}px`;

                        document.body.append(offscreen);

                        event.dataTransfer.setDragImage(
                            offscreen,
                            boundsForDragTarget.width / 2,
                            boundsForDragTarget.height / 2
                        );

                        window.setTimeout(() => {
                            offscreen.remove();
                        }, 0);
                    }
                }
            } else {
                event.preventDefault();
            }
        },
        [
            isDraggable,
            isResizing,
            getMouseArgsForPosition,
            onDragStart,
            getBoundsForItem,
            theme,
            mappedColumns,
            spriteManager,
            drawHeaderCallback,
            getCellContent,
            imageLoader,
            renderStateProvider,
            getCellRenderer,
        ]
    );
    useEventListener("dragstart", onDragStartImpl, eventTargetRef?.current ?? null, false, false);

    const activeDropTarget = React.useRef<Item | undefined>();

    const onDragOverImpl = React.useCallback(
        (event: DragEvent) => {
            const canvas = ref.current;
            if (onDrop !== undefined) {
                // Need to preventDefault to allow drop
                event.preventDefault();
            }

            if (canvas === null || onDragOverCell === undefined) {
                return;
            }

            const args = getMouseArgsForPosition(canvas, event.clientX, event.clientY);

            const [rawCol, row] = args.location;
            const col = rawCol - (firstColAccessible ? 0 : 1);
            const [activeCol, activeRow] = activeDropTarget.current ?? [];

            if (activeCol !== col || activeRow !== row) {
                activeDropTarget.current = [col, row];
                onDragOverCell([col, row], event.dataTransfer);
            }
        },
        [firstColAccessible, getMouseArgsForPosition, onDragOverCell, onDrop]
    );
    useEventListener("dragover", onDragOverImpl, eventTargetRef?.current ?? null, false, false);

    const onDragEndImpl = React.useCallback(() => {
        activeDropTarget.current = undefined;
        onDragEnd?.();
    }, [onDragEnd]);
    useEventListener("dragend", onDragEndImpl, eventTargetRef?.current ?? null, false, false);

    const onDropImpl = React.useCallback(
        (event: DragEvent) => {
            const canvas = ref.current;
            if (canvas === null || onDrop === undefined) {
                return;
            }

            // Default can mess up sometimes.
            event.preventDefault();

            const args = getMouseArgsForPosition(canvas, event.clientX, event.clientY);

            const [rawCol, row] = args.location;
            const col = rawCol - (firstColAccessible ? 0 : 1);

            onDrop([col, row], event.dataTransfer);
        },
        [firstColAccessible, getMouseArgsForPosition, onDrop]
    );
    useEventListener("drop", onDropImpl, eventTargetRef?.current ?? null, false, false);

    const onDragLeaveImpl = React.useCallback(() => {
        onDragLeave?.();
    }, [onDragLeave]);
    useEventListener("dragleave", onDragLeaveImpl, eventTargetRef?.current ?? null, false, false);

    const selectionRef = React.useRef(selection);
    selectionRef.current = selection;
    const focusRef = React.useRef<HTMLElement | null>(null);
    const focusElement = React.useCallback(
        (el: HTMLElement | null) => {
            // We don't want to steal the focus if we don't currently own the focus.
            if (ref.current === null || !ref.current.contains(document.activeElement)) return;
            if (el === null && selectionRef.current.current !== undefined) {
                canvasRef?.current?.focus({
                    preventScroll: true,
                });
            } else if (el !== null) {
                el.focus({
                    preventScroll: true,
                });
            }
            focusRef.current = el;
        },
        [canvasRef]
    );

    React.useImperativeHandle(
        forwardedRef,
        () => ({
            focus: () => {
                const el = focusRef.current;
                // The element in the ref may have been removed however our callback method ref
                // won't see the removal so bad things happen. Checking to see if the element is
                // no longer attached is enough to resolve the problem. In the future this
                // should be replaced with something much more robust.
                if (el === null || !document.contains(el)) {
                    canvasRef?.current?.focus({
                        preventScroll: true,
                    });
                } else {
                    el.focus({
                        preventScroll: true,
                    });
                }
            },
            getBounds: (col?: number, row?: number) => {
                if (canvasRef === undefined || canvasRef.current === null) {
                    return undefined;
                }

                const resolvedCol = col ?? 0;
                const resolvedRow = row ?? -1;
                return resolvedRow >= 0
                    ? getBoundsForBodyCell(canvasRef.current, resolvedCol, resolvedRow)
                    : getBoundsForItem(canvasRef.current, resolvedCol, resolvedRow);
            },
            damage,
            getMouseArgsForPosition: (posX: number, posY: number, ev?: MouseEvent | TouchEvent) => {
                if (canvasRef === undefined || canvasRef.current === null) {
                    return undefined;
                }

                return getMouseArgsForPosition(canvasRef.current, posX, posY, ev);
            },
        }),
        [canvasRef, damage, getBoundsForBodyCell, getBoundsForItem, getMouseArgsForPosition]
    );

    const lastFocusedSubdomNode = React.useRef<Item>();

    const accessibilityTree = useDebouncedMemo(
        () => {
            if (width < 50 || experimental?.disableAccessibilityTree === true) return null;
            let effectiveCols = getEffectiveColumns(mappedColumns, cellXOffset, width, dragAndDropState, translateX);
            const colOffset = firstColAccessible ? 0 : -1;
            if (!firstColAccessible && effectiveCols[0]?.sourceIndex === 0) {
                effectiveCols = effectiveCols.slice(1);
            }

            const [fCol, fRow] = selection.current?.cell ?? [];
            const range = selection.current?.range;

            const visibleCols = effectiveCols.map(c => c.sourceIndex);
            const visibleRows = makeRange(cellYOffset, Math.min(rows, cellYOffset + accessibilityHeight));

            // Maintain focus within grid if we own it but focused cell is outside visible viewport
            // and not rendered.
            if (
                fCol !== undefined &&
                fRow !== undefined &&
                !(visibleCols.includes(fCol) && visibleRows.includes(fRow))
            ) {
                focusElement(null);
            }

            return (
                <table
                    key="access-tree"
                    role="grid"
                    aria-rowcount={rows + 1}
                    aria-multiselectable="true"
                    aria-colcount={mappedColumns.length + colOffset}>
                    <thead role="rowgroup">
                        <tr role="row" aria-rowindex={1}>
                            {effectiveCols.map(c => (
                                <th
                                    role="columnheader"
                                    aria-selected={selection.columns.hasIndex(c.sourceIndex)}
                                    aria-colindex={c.sourceIndex + 1 + colOffset}
                                    tabIndex={-1}
                                    onFocus={e => {
                                        if (e.target === focusRef.current) return;
                                        return onCellFocused?.([c.sourceIndex, -1]);
                                    }}
                                    key={c.sourceIndex}>
                                    {c.title}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody role="rowgroup">
                        {visibleRows.map(row => (
                            <tr
                                role="row"
                                aria-selected={selection.rows.hasIndex(row)}
                                key={row}
                                aria-rowindex={row + 2}>
                                {effectiveCols.map(c => {
                                    const col = c.sourceIndex;
                                    const key = packColRowToNumber(col, row);
                                    const focused = fCol === col && fRow === row;
                                    const selected =
                                        range !== undefined &&
                                        col >= range.x &&
                                        col < range.x + range.width &&
                                        row >= range.y &&
                                        row < range.y + range.height;
                                    const id = `glide-cell-${col}-${row}`;
                                    const location: Item = [col, row];
                                    const cellContent = getCellContent(location, true);
                                    return (
                                        <td
                                            key={key}
                                            role="gridcell"
                                            aria-colindex={col + 1 + colOffset}
                                            aria-selected={selected}
                                            aria-readonly={
                                                isInnerOnlyCell(cellContent) || !isReadWriteCell(cellContent)
                                            }
                                            id={id}
                                            data-testid={id}
                                            onClick={() => {
                                                const canvas = canvasRef?.current;
                                                if (canvas === null || canvas === undefined) return;
                                                return onKeyDown?.({
                                                    bounds: getBoundsForBodyCell(canvas, col, row),
                                                    cancel: () => undefined,
                                                    preventDefault: () => undefined,
                                                    stopPropagation: () => undefined,
                                                    ctrlKey: false,
                                                    key: "Enter",
                                                    keyCode: 13,
                                                    metaKey: false,
                                                    shiftKey: false,
                                                    altKey: false,
                                                    rawEvent: undefined,
                                                    location,
                                                });
                                            }}
                                            onFocusCapture={e => {
                                                if (
                                                    e.target === focusRef.current ||
                                                    (lastFocusedSubdomNode.current?.[0] === col &&
                                                        lastFocusedSubdomNode.current?.[1] === row)
                                                )
                                                    return;
                                                lastFocusedSubdomNode.current = location;
                                                return onCellFocused?.(location);
                                            }}
                                            ref={focused ? focusElement : undefined}
                                            tabIndex={-1}>
                                            {getRowData(cellContent, getCellRenderer)}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            );
        },
        [
            width,
            mappedColumns,
            cellXOffset,
            dragAndDropState,
            translateX,
            rows,
            cellYOffset,
            accessibilityHeight,
            selection,
            focusElement,
            getCellContent,
            canvasRef,
            onKeyDown,
            getBoundsForBodyCell,
            onCellFocused,
        ],
        200
    );

    const opacityX =
        freezeColumns === 0 || !fixedShadowX ? 0 : cellXOffset > freezeColumns ? 1 : clamp(-translateX / 100, 0, 1);

    const absoluteOffsetY = -cellYOffset * 32 + translateY;
    const opacityY = !fixedShadowY ? 0 : clamp(-absoluteOffsetY / 100, 0, 1);

    const stickyShadow = React.useMemo(() => {
        if (!opacityX && !opacityY) {
            return null;
        }

        const styleX: React.CSSProperties = {
            position: "absolute",
            top: 0,
            left: stickyX,
            width: width - stickyX,
            height: height,
            opacity: opacityX,
            pointerEvents: "none",
            transition: !smoothScrollX ? "opacity 0.2s" : undefined,
            boxShadow: "inset 13px 0 10px -13px rgba(0, 0, 0, 0.2)",
        };

        const styleY: React.CSSProperties = {
            position: "absolute",
            top: totalHeaderHeight,
            left: 0,
            width: width,
            height: height,
            opacity: opacityY,
            pointerEvents: "none",
            transition: !smoothScrollY ? "opacity 0.2s" : undefined,
            boxShadow: "inset 0 13px 10px -13px rgba(0, 0, 0, 0.2)",
        };

        return (
            <>
                {opacityX > 0 && <div id="shadow-x" style={styleX} />}
                {opacityY > 0 && <div id="shadow-y" style={styleY} />}
            </>
        );
    }, [opacityX, opacityY, stickyX, width, smoothScrollX, totalHeaderHeight, height, smoothScrollY]);

    const overlayStyle = React.useMemo<React.CSSProperties>(
        () => ({
            position: "absolute",
            top: 0,
            left: 0,
        }),
        []
    );

    return (
        <>
            <canvas
                data-testid="data-grid-canvas"
                tabIndex={0}
                onKeyDown={onKeyDownImpl}
                onKeyUp={onKeyUpImpl}
                onFocus={onCanvasFocused}
                onBlur={onCanvasBlur}
                ref={refImpl}
                style={style}>
                {accessibilityTree}
            </canvas>
            <canvas ref={overlayRef} style={overlayStyle} />
            {stickyShadow}
        </>
    );
};

export default React.memo(React.forwardRef(DataGrid));
