/* eslint-disable sonarjs/no-duplicate-string */
/* eslint-disable unicorn/no-for-loop */
import {
    type GridSelection,
    type InnerGridCell,
    type Rectangle,
    CompactSelection,
    GridColumnIcon,
    type Item,
    type CellList,
    GridCellKind,
    type DrawCellCallback,
    isInnerOnlyCell,
    type GridCell,
    type GridMouseCursor,
} from "../data-grid-types.js";
import { CellSet } from "../cell-set.js";
import type { HoverValues } from "../animation-manager.js";
import {
    type MappedGridColumn,
    cellIsSelected,
    cellIsInRange,
    getFreezeTrailingHeight,
    drawLastUpdateUnderlay,
} from "./data-grid-lib.js";
import type { SpriteManager } from "../data-grid-sprites.js";
import { mergeAndRealizeTheme, type FullTheme, type Theme } from "../../../common/styles.js";
import { blend } from "../color-parser.js";
import type { DrawArgs, DrawStateTuple, GetCellRendererCallback, PrepResult } from "../../../cells/cell-types.js";
import type { HoverInfo } from "./draw-grid-arg.js";
import type { EnqueueCallback } from "../use-animation-queue.js";
import type { RenderStateProvider } from "../../../common/render-state-provider.js";
import type { ImageWindowLoader } from "../image-window-loader-interface.js";
import { intersectRect } from "../../../common/math.js";
import type { GridMouseGroupHeaderEventArgs } from "../event-args.js";
import { getSkipPoint, getSpanBounds, walkColumns, walkRowsInCol } from "./data-grid-render.walk.js";

export const loadingCell: InnerGridCell = {
    kind: GridCellKind.Loading,
    allowOverlay: false,
};

export interface GroupDetails {
    readonly name: string;
    readonly icon?: string;
    readonly overrideTheme?: Partial<Theme>;
    readonly iconAlign?: "left" | "center";
    readonly iconSize?: number;
    readonly type?: "icon" | "icon-text";
    readonly actions?: readonly {
        readonly title: string;
        readonly onClick: (e: GridMouseGroupHeaderEventArgs) => void;
        readonly icon: GridColumnIcon | string;
        readonly needHover?: boolean; // 是否悬浮出现
        readonly iconSize?: number;
        readonly iconAlign?: "left" | "right" | "center"; // icon 位置;
        readonly padding?: number;
    }[];
}

export type GroupDetailsCallback = (groupName: string) => GroupDetails;
export type GetRowThemeCallback = (row: number) => Partial<Theme> | undefined;

export interface Highlight {
    readonly color: string;
    readonly range: Rectangle;
    readonly style?: "dashed" | "solid" | "no-outline" | "solid-outline";
    readonly requiresFullRedraw?: boolean;
}

interface RowSpanDrawContentInfo {
    readonly drawContent: boolean;
    readonly rect?: Rectangle;
    readonly clip?: Rectangle;
}

function getRowSpanDrawContentInfo(
    cell: InnerGridCell,
    row: number,
    x: number,
    y: number,
    width: number,
    cellYOffset: number,
    rows: number,
    isSticky: boolean,
    rowHeight: number | undefined,
    getRowHeightSum: (start: number, end: number) => number
): RowSpanDrawContentInfo | undefined {
    const rowSpan = cell.rowSpan ?? 1;
    if (rowSpan <= 1) {
        return undefined;
    }

    const anchorRow = Math.max(0, row - (cell.rowSpanOffset ?? 0));
    const spanEndRow = Math.min(rows, anchorRow + rowSpan);
    const firstVisibleRowInSpan = isSticky ? anchorRow : Math.max(anchorRow, cellYOffset);

    if (row !== firstVisibleRowInSpan) {
        return {
            drawContent: false,
        };
    }

    let hiddenAboveHeight: number;
    let totalHeight: number;
    if (rowHeight !== undefined) {
        hiddenAboveHeight = (firstVisibleRowInSpan - anchorRow) * rowHeight;
        totalHeight = (spanEndRow - anchorRow) * rowHeight;
    } else {
        hiddenAboveHeight = getRowHeightSum(anchorRow, firstVisibleRowInSpan);
        totalHeight = getRowHeightSum(anchorRow, spanEndRow);
    }

    return {
        drawContent: true,
        rect: {
            x,
            y: y - hiddenAboveHeight,
            width,
            height: totalHeight,
        },
        // 只在当前可见的合并块区域内放行默认内容绘制，避免上下视口切换时重复落字
        clip: {
            x,
            y,
            width,
            height: totalHeight - hiddenAboveHeight,
        },
    };
}

function getThemeSourceRow(cell: InnerGridCell, row: number): number {
    return Math.max(0, row - (cell.rowSpanOffset ?? 0));
}

function getThemeSourceCell(
    cell: InnerGridCell,
    col: number,
    row: number,
    getCellContent: (cell: Item) => InnerGridCell
): InnerGridCell {
    const themeSourceRow = getThemeSourceRow(cell, row);
    return themeSourceRow === row ? cell : getCellContent([col, themeSourceRow]);
}

function hoverMatchesCell(hoveredItem: Item | undefined, col: number, row: number, cell: InnerGridCell): boolean {
    if (hoveredItem === undefined || hoveredItem[0] !== col) return false;

    const rowSpan = cell.rowSpan ?? 1;
    if (rowSpan <= 1) {
        return hoveredItem[1] === row;
    }

    const anchorRow = row - (cell.rowSpanOffset ?? 0);
    return hoveredItem[1] >= anchorRow && hoveredItem[1] < anchorRow + rowSpan;
}

function findHoverValueForCell(
    hoverValues: HoverValues,
    col: number,
    row: number,
    cell: InnerGridCell
): HoverValues[number] | undefined {
    for (let i = 0; i < hoverValues.length; i++) {
        const hv = hoverValues[i];
        if (hoverMatchesCell(hv.item, col, row, cell)) {
            return hv;
        }
    }

    return undefined;
}

function intersectRectangle(a: Rectangle, b: Rectangle): Rectangle | undefined {
    const x = Math.max(a.x, b.x);
    const y = Math.max(a.y, b.y);
    const right = Math.min(a.x + a.width, b.x + b.width);
    const bottom = Math.min(a.y + a.height, b.y + b.height);

    if (right <= x || bottom <= y) {
        return undefined;
    }

    return {
        x,
        y,
        width: right - x,
        height: bottom - y,
    };
}

// preppable items:
// - font
// - fillStyle

// Column draw loop prep cycle
// - Prep item
// - Prep sets props
// - Prep returns list of cared about props
// - Draw item
// - Loop may set some items, if present in args list, set undefined
// - Prep next item, giving previous result
// - If next item type is different, de-prep
// - Result per column
export function drawCells(
    ctx: CanvasRenderingContext2D,
    effectiveColumns: readonly MappedGridColumn[],
    allColumns: readonly MappedGridColumn[],
    height: number,
    totalHeaderHeight: number,
    translateX: number,
    translateY: number,
    cellYOffset: number,
    rows: number,
    rowHeight: number | undefined,
    getRowHeight: (row: number) => number,
    getCellContent: (cell: Item) => InnerGridCell,
    getGroupDetails: GroupDetailsCallback,
    getRowThemeOverride: GetRowThemeCallback | undefined,
    disabledRows: CompactSelection,
    drawFocus: boolean,
    freezeTrailingRows: number,
    hasAppendRow: boolean,
    drawRegions: readonly Rectangle[],
    damage: CellSet | undefined,
    selection: GridSelection,
    prelightCells: CellList | undefined,
    highlightRegions: readonly Highlight[] | undefined,
    imageLoader: ImageWindowLoader,
    spriteManager: SpriteManager,
    hoverValues: HoverValues,
    hoverInfo: HoverInfo | undefined,
    drawCellCallback: DrawCellCallback | undefined,
    hyperWrapping: boolean,
    outerTheme: FullTheme,
    enqueue: EnqueueCallback,
    renderStateProvider: RenderStateProvider,
    getCellRenderer: GetCellRendererCallback,
    overrideCursor: (cursor: GridMouseCursor) => void,
    minimumCellWidth: number
): Rectangle[] | undefined {
    let toDraw = damage?.size ?? Number.MAX_SAFE_INTEGER;
    const frameTime = performance.now();
    const hasRangeSelection =
        selection.current !== undefined &&
        (selection.current.range.width > 1 ||
            selection.current.range.height > 1 ||
            selection.current.rangeStack.length > 0);
    let font = outerTheme.baseFontFull;
    ctx.font = font;
    const deprepArg = { ctx };
    const cellIndex: [number, number] = [0, 0];
    const freezeTrailingRowsHeight =
        freezeTrailingRows > 0 ? getFreezeTrailingHeight(rows, freezeTrailingRows, getRowHeight) : 0;
    let result: Rectangle[] | undefined;
    let handledSpans: Set<string> | undefined = undefined;
    const rowHeightSumCache = new Map<string, number>();
    const getRowHeightSum = (start: number, end: number): number => {
        if (start >= end) return 0;

        const key = `${start}:${end}`;
        const cached = rowHeightSumCache.get(key);
        if (cached !== undefined) return cached;

        let sum = 0;
        for (let row = start; row < end; row++) {
            sum += getRowHeight(row);
        }
        rowHeightSumCache.set(key, sum);
        return sum;
    };

    const skipPoint = getSkipPoint(drawRegions);

    walkColumns(
        effectiveColumns,
        cellYOffset,
        translateX,
        translateY,
        totalHeaderHeight,
        (c, drawX, colDrawStartY, clipX, startRow) => {
            const diff = Math.max(0, clipX - drawX);

            const colDrawX = drawX + diff;
            const colDrawY = totalHeaderHeight + 1;
            const colWidth = c.width - diff;
            const colHeight = height - totalHeaderHeight - 1;
            if (drawRegions.length > 0) {
                let found = false;
                for (let i = 0; i < drawRegions.length; i++) {
                    const dr = drawRegions[i];
                    if (intersectRect(colDrawX, colDrawY, colWidth, colHeight, dr.x, dr.y, dr.width, dr.height)) {
                        found = true;
                        break;
                    }
                }
                if (!found) return;
            }

            const reclip = () => {
                ctx.save();
                ctx.beginPath();
                ctx.rect(colDrawX, colDrawY, colWidth, colHeight);
                ctx.clip();
            };

            const colSelected = selection.columns.hasIndex(c.sourceIndex);

            const groupTheme = getGroupDetails(c.group ?? "").overrideTheme;
            const colTheme =
                c.themeOverride === undefined && groupTheme === undefined
                    ? outerTheme
                    : mergeAndRealizeTheme(outerTheme, groupTheme, c.themeOverride);
            const colFont = colTheme.baseFontFull;
            if (colFont !== font) {
                font = colFont;
                ctx.font = colFont;
            }
            reclip();
            let prepResult: PrepResult | undefined = undefined;
            const deferredRowSpanDraws: Array<() => void> = [];

            walkRowsInCol(
                startRow,
                colDrawStartY,
                height,
                rows,
                getRowHeight,
                freezeTrailingRows,
                hasAppendRow,
                skipPoint,
                (drawY, row, rh, isSticky, isTrailingRow) => {
                    if (row < 0) return;

                    cellIndex[0] = c.sourceIndex;
                    cellIndex[1] = row;
                    // if (damage !== undefined && !damage.some(d => d[0] === c.sourceIndex && d[1] === row)) {
                    //     return;
                    // }
                    // if (
                    //     drawRegions.length > 0 &&
                    //     !drawRegions.some(dr => intersectRect(drawX, drawY, c.width, rh, dr.x, dr.y, dr.width, dr.height))
                    // ) {
                    //     return;
                    // }

                    // These are dumb versions of the above. I cannot for the life of believe that this matters but this is
                    // the tightest part of the draw loop and the allocations above actually has a very measurable impact
                    // on performance. For the love of all that is unholy please keep checking this again in the future.
                    // As soon as this doesn't have any impact of note go back to the saner looking code. The smoke test
                    // here is to scroll to the bottom of a test case first, then scroll back up while profiling and see
                    // how many major GC collections you get. These allocate a lot of objects.
                    if (damage !== undefined && !damage.has(cellIndex)) {
                        return;
                    }
                    if (drawRegions.length > 0) {
                        let found = false;
                        for (let i = 0; i < drawRegions.length; i++) {
                            const dr = drawRegions[i];
                            if (intersectRect(drawX, drawY, c.width, rh, dr.x, dr.y, dr.width, dr.height)) {
                                found = true;
                                break;
                            }
                        }
                        if (!found) return;
                    }

                    const rowSelected = selection.rows.hasIndex(row);
                    const rowDisabled = disabledRows.hasIndex(row);

                    const cell: InnerGridCell = row < rows ? getCellContent(cellIndex) : loadingCell;

                    let cellX = drawX;
                    let cellWidth = c.width;
                    let drawingSpan = false;
                    let skipContents = false;
                    if (cell.span !== undefined) {
                        const [startCol, endCol] = cell.span;
                        const spanKey = `${row},${startCol},${endCol},${c.sticky}`; //alloc
                        if (handledSpans === undefined) handledSpans = new Set();
                        if (!handledSpans.has(spanKey)) {
                            const areas = getSpanBounds(cell.span, drawX, drawY, c.width, rh, c, allColumns);
                            const area = c.sticky ? areas[0] : areas[1];
                            if (!c.sticky && areas[0] !== undefined) {
                                skipContents = true;
                            }
                            if (area !== undefined) {
                                cellX = area.x;
                                cellWidth = area.width;
                                handledSpans.add(spanKey);
                                ctx.restore();
                                prepResult = undefined;
                                ctx.save();
                                ctx.beginPath();
                                const d = Math.max(0, clipX - area.x);
                                ctx.rect(area.x + d, drawY, area.width - d, rh);
                                if (result === undefined) {
                                    result = [];
                                }
                                result.push({
                                    x: area.x + d,
                                    y: drawY,
                                    width: area.width - d,
                                    height: rh,
                                });
                                ctx.clip();
                                drawingSpan = true;
                            }
                        } else {
                            toDraw--;
                            return;
                        }
                    }

                    const themeSourceRow = getThemeSourceRow(cell, row);
                    // rowSpan 的背景来源需要跟随锚点单元格，而不是当前物理行
                    // 否则外层如果把斑马纹挂在 cell.themeOverride 上，同一个合并块仍然会被逐行切开
                    const themeSourceCell = getThemeSourceCell(cell, c.sourceIndex, row, getCellContent);
                    const rowTheme = getRowThemeOverride?.(themeSourceRow);
                    const trailingTheme =
                        isTrailingRow && c.trailingRowOptions?.themeOverride !== undefined
                            ? c.trailingRowOptions?.themeOverride
                            : undefined;
                    const theme =
                        themeSourceCell.themeOverride === undefined &&
                        rowTheme === undefined &&
                        trailingTheme === undefined
                            ? colTheme
                            : mergeAndRealizeTheme(colTheme, rowTheme, trailingTheme, themeSourceCell.themeOverride); //alloc

                    ctx.beginPath();

                    const isSelected = cellIsSelected(cellIndex, cell, selection);
                    let accentCount = cellIsInRange(cellIndex, cell, selection, drawFocus);
                    let isColSelected = false;
                    const spanIsHighlighted =
                        cell.span !== undefined &&
                        selection.columns.some(
                            index => cell.span !== undefined && index >= cell.span[0] && index <= cell.span[1] //alloc
                        );
                    if (
                        isSelected &&
                        drawFocus &&
                        !hasRangeSelection &&
                        (cell.allowOverlay === true && cell.readonly === false ? false : !rowSelected)
                    ) {
                        // 绘制focus边框: 单元格选中，但是行没有选中时，不需要填充accentLight背景色
                        // 这里仍然只针对“单格 focus”生效
                        // 如果已经进入 range 选中，当前格也应继续保留背景，否则会出现大块发白、与外框不同步的问题
                        accentCount = 0;
                    } else if (isSelected && drawFocus) {
                        accentCount = Math.max(accentCount, 1);
                    }
                    if (spanIsHighlighted) {
                        accentCount++;
                    }
                    if (!isSelected) {
                        if (rowSelected) accentCount++;
                        if (colSelected && !isTrailingRow) {
                            isColSelected = true;
                            accentCount++;
                        }
                    }

                    if (cell.readonly === false && cell.allowOverlay === true && !isSelected) {
                        /**
                         * 编辑单元格不需要有选中高亮背景
                         * 适用于：
                         * 1. 只有垂直线的表格
                         * 2. 编辑单元格
                         * 3. 单元格允许overlay
                         *
                         */
                        accentCount = 0;
                    }

                    const bgCell =
                        themeSourceCell.kind === GridCellKind.Protected
                            ? theme.bgCellMedium
                            : themeSourceCell.readonly === false
                              ? theme.editBgCell
                              : theme.bgCell;
                    let fill: string | undefined;
                    if (isSticky || bgCell !== outerTheme.bgCell) {
                        fill = blend(bgCell, fill);
                    }

                    if (accentCount > 0 || rowDisabled) {
                        if (rowDisabled) {
                            fill = blend(theme.bgHeaderDisabled, fill);
                        }
                        for (let i = 0; i < accentCount; i++) {
                            fill = isColSelected
                                ? rowSelected
                                    ? blend(theme.bgCellAccent, theme.accentLight)
                                    : blend(theme.bgCellAccent, fill)
                                : cell.readonly === false && cell.allowOverlay === true && isSelected
                                  ? blend(theme.accentMask, fill)
                                  : blend(theme.accentLight, fill);
                        }
                    } else if (prelightCells !== undefined) {
                        for (const pre of prelightCells) {
                            if (pre[0] === c.sourceIndex && pre[1] === row) {
                                fill = blend(theme.bgSearchResult, fill);
                                break;
                            }
                        }
                    }

                    if (highlightRegions !== undefined) {
                        for (let i = 0; i < highlightRegions.length; i++) {
                            const region = highlightRegions[i];
                            const r = region.range;
                            if (
                                region.style !== "solid-outline" &&
                                r.x <= c.sourceIndex &&
                                c.sourceIndex < r.x + r.width &&
                                r.y <= row &&
                                row < r.y + r.height
                            ) {
                                fill = blend(region.color, fill);
                            }
                        }
                    }

                    const rowSpanDrawContentInfo = getRowSpanDrawContentInfo(
                        cell,
                        row,
                        cellX,
                        drawY,
                        cellWidth,
                        cellYOffset,
                        rows,
                        isSticky,
                        rowHeight,
                        getRowHeightSum
                    );
                    let didDamageClip = false;
                    if (damage !== undefined) {
                        // we want to clip each cell individually rather than form a super clip region. The reason for
                        // this is passing too many clip regions to the GPU at once can cause a performance hit. This
                        // allows us to damage a large number of cells at once without issue.
                        const top = drawY + 1;
                        const bottom = isSticky
                            ? top + rh - 1
                            : Math.min(top + rh - 1, height - freezeTrailingRowsHeight);
                        const h = bottom - top;

                        // however, not clipping at all is even better. We want to clip if we are the left most col
                        // or overlapping the bottom clip area.
                        if (h !== rh - 1 || cellX + 1 <= clipX) {
                            didDamageClip = true;
                            ctx.save();
                            ctx.beginPath();
                            ctx.rect(cellX + 1, top, cellWidth - 1, h);
                            ctx.clip();
                        }

                        // we also need to make sure to wipe the contents. Since the fill can do that lets repurpose
                        // that call to avoid an extra draw call.
                        fill = fill === undefined ? theme.bgCell : blend(fill, theme.bgCell);
                    }

                    const isLastColumn = c.sourceIndex === allColumns.length - 1;
                    const isLastRow = row === rows - 1;
                    if (fill !== undefined) {
                        ctx.fillStyle = fill;
                        if (prepResult !== undefined) {
                            prepResult.fillStyle = fill;
                        }
                        if (damage !== undefined) {
                            // this accounts for the fill handle outline being drawn inset on these cells. We do this
                            // because technically the bottom right corner of the outline are on other cells.
                            // “局部重绘”，不是整张网格重画，所以它不能像全量绘制那样把整个 cell 铺满，否则会把已经画好的边框像素擦掉
                            const accentWidth = theme.accentWidth ?? 1;
                            ctx.fillRect(
                                cellX + accentWidth,
                                drawY + accentWidth,
                                cellWidth - (isLastColumn ? accentWidth * 2 : accentWidth + 1),
                                rh - (isLastRow ? accentWidth * 2 : accentWidth + 1)
                            );
                        } else {
                            ctx.fillRect(cellX, drawY, cellWidth, rh);
                        }
                    }

                    if (cell.style === "faded") {
                        ctx.globalAlpha = 0.6;
                    }

                    const hoverValue = findHoverValueForCell(hoverValues, c.sourceIndex, row, cell);

                    if (cellWidth > minimumCellWidth && !skipContents) {
                        const cellFont = theme.baseFontFull;
                        if (cellFont !== font) {
                            ctx.font = cellFont;
                            font = cellFont;
                        }
                        if ((cell.rowSpan ?? 1) > 1 && rowSpanDrawContentInfo?.drawContent === true) {
                            const anchorRow = row - (cell.rowSpanOffset ?? 0);
                            const spanEnd = Math.min(rows, anchorRow + (cell.rowSpan ?? 1));
                            const fullyRowSpanSelected = selection.rows.hasAll([anchorRow, spanEnd]);
                            const rowSpanHasDirectCellSelection =
                                isSelected || cellIsInRange(cellIndex, cell, selection, drawFocus) > 0;
                            const deferredCell = cell;
                            const deferredCol = c.sourceIndex;
                            const deferredRow = row;
                            const deferredX = cellX;
                            const deferredY = drawY;
                            const deferredW = cellWidth;
                            const deferredH = rh;
                            const deferredHighlighted = rowSpanHasDirectCellSelection || fullyRowSpanSelected;
                            const deferredTheme = theme;
                            const deferredFill = fill ?? theme.bgCell;
                            const deferredHoverAmount = hoverValue?.hoverAmount ?? 0;
                            const deferredSourceClip = rowSpanDrawContentInfo.clip;
                            let deferredClip = deferredSourceClip;
                            if (deferredSourceClip !== undefined) {
                                const spanClipOffset = drawingSpan ? Math.max(0, clipX - cellX) : 0;
                                const activeClip = {
                                    x: drawingSpan ? cellX + spanClipOffset : colDrawX,
                                    y: deferredSourceClip.y,
                                    width: drawingSpan ? cellWidth - spanClipOffset : colWidth,
                                    height: deferredSourceClip.height,
                                };
                                deferredClip = intersectRectangle(deferredSourceClip, activeClip);
                            }

                            // 合并块文本/自定义内容放到本列所有小格背景都画完之后再补，
                            // 避免后续 offset 行的背景把已经绘制的内容重新盖掉
                            if (deferredSourceClip === undefined || deferredClip !== undefined) {
                                const deferredOuterClip = deferredClip;
                                const deferredRowSpanInfo =
                                    deferredClip === deferredSourceClip
                                        ? rowSpanDrawContentInfo
                                        : {
                                              ...rowSpanDrawContentInfo,
                                              clip: deferredClip,
                                          };

                                deferredRowSpanDraws.push(() => {
                                    ctx.save();
                                    if (deferredOuterClip !== undefined) {
                                        ctx.beginPath();
                                        ctx.rect(
                                            deferredOuterClip.x,
                                            deferredOuterClip.y,
                                            deferredOuterClip.width,
                                            deferredOuterClip.height
                                        );
                                        ctx.clip();
                                    }

                                    const deferredPrep = drawCell(
                                        ctx,
                                        deferredCell,
                                        deferredCol,
                                        deferredRow,
                                        isLastColumn,
                                        isLastRow,
                                        deferredX,
                                        deferredY,
                                        deferredW,
                                        deferredH,
                                        deferredHighlighted,
                                        deferredTheme,
                                        deferredFill,
                                        imageLoader,
                                        spriteManager,
                                        deferredHoverAmount,
                                        hoverInfo,
                                        hyperWrapping,
                                        frameTime,
                                        drawCellCallback,
                                        undefined,
                                        enqueue,
                                        renderStateProvider,
                                        getCellRenderer,
                                        overrideCursor,
                                        deferredRowSpanInfo
                                    );
                                    deferredPrep?.deprep?.(deprepArg);
                                    ctx.restore();
                                });
                            }
                        } else {
                            prepResult = drawCell(
                                ctx,
                                cell,
                                c.sourceIndex,
                                row,
                                isLastColumn,
                                isLastRow,
                                cellX,
                                drawY,
                                cellWidth,
                                rh,
                                accentCount > 0,
                                theme,
                                fill ?? theme.bgCell,
                                imageLoader,
                                spriteManager,
                                hoverValue?.hoverAmount ?? 0,
                                hoverInfo,
                                hyperWrapping,
                                frameTime,
                                drawCellCallback,
                                prepResult,
                                enqueue,
                                renderStateProvider,
                                getCellRenderer,
                                overrideCursor,
                                rowSpanDrawContentInfo
                            );
                        }
                    }

                    if (didDamageClip) {
                        ctx.restore();
                    }

                    if (cell.style === "faded") {
                        ctx.globalAlpha = 1;
                    }

                    toDraw--;
                    if (drawingSpan) {
                        ctx.restore();
                        prepResult?.deprep?.(deprepArg);
                        prepResult = undefined;
                        reclip();
                        font = colFont;
                        ctx.font = colFont;
                    }

                    return toDraw <= 0;
                }
            );

            ctx.restore();

            for (const drawDeferredRowSpan of deferredRowSpanDraws) {
                drawDeferredRowSpan();
            }

            return toDraw <= 0;
        }
    );

    return result;
}

const allocatedItem: [number, number] = [0, 0];
const reusableRect = { x: 0, y: 0, width: 0, height: 0 };
const drawState: DrawStateTuple = [undefined, () => undefined];

let animationFrameRequested = false;
function animRequest(): void {
    animationFrameRequested = true;
}

export function drawCell(
    ctx: CanvasRenderingContext2D,
    cell: InnerGridCell,
    col: number,
    row: number,
    isLastCol: boolean,
    isLastRow: boolean,
    x: number,
    y: number,
    w: number,
    h: number,
    highlighted: boolean,
    theme: FullTheme,
    finalCellFillColor: string,
    imageLoader: ImageWindowLoader,
    spriteManager: SpriteManager,
    hoverAmount: number,
    hoverInfo: HoverInfo | undefined,
    hyperWrapping: boolean,
    frameTime: number,
    drawCellCallback: DrawCellCallback | undefined,
    lastPrep: PrepResult | undefined,
    enqueue: EnqueueCallback | undefined,
    renderStateProvider: RenderStateProvider,
    getCellRenderer: GetCellRendererCallback,
    overrideCursor: (cursor: GridMouseCursor) => void,
    rowSpanDrawContentInfo?: RowSpanDrawContentInfo
): PrepResult | undefined {
    if (rowSpanDrawContentInfo?.drawContent === false) {
        return lastPrep;
    }

    let hoverX: number | undefined;
    let hoverY: number | undefined;
    if (hoverInfo !== undefined && hoverMatchesCell(hoverInfo[0], col, row, cell)) {
        hoverX = hoverInfo[1][0];
        hoverY = hoverInfo[1][1];
    }
    let result: PrepResult | undefined = undefined;

    allocatedItem[0] = col;
    allocatedItem[1] = row;

    reusableRect.x = x;
    reusableRect.y = y;
    reusableRect.width = w;
    reusableRect.height = h;

    drawState[0] = renderStateProvider.getValue(allocatedItem);
    drawState[1] = (val: any) => renderStateProvider.setValue(allocatedItem, val); //alloc

    animationFrameRequested = false;

    const args: DrawArgs<typeof cell> = {
        //alloc
        ctx,
        theme,
        col,
        row,
        cell,
        rect: reusableRect,
        highlighted,
        cellFillColor: finalCellFillColor,
        hoverAmount,
        frameTime,
        hoverX,
        drawState,
        hoverY,
        imageLoader,
        spriteManager,
        hyperWrapping,
        overrideCursor: hoverX !== undefined ? overrideCursor : undefined,
        requestAnimationFrame: animRequest,
    };
    const drawArgs =
        rowSpanDrawContentInfo?.rect === undefined
            ? args
            : {
                  ...args,
                  rect: rowSpanDrawContentInfo.rect,
              };
    const needsAnim = drawLastUpdateUnderlay(drawArgs, cell.lastUpdated, frameTime, lastPrep, isLastCol, isLastRow);

    const r = getCellRenderer(cell);
    if (r !== undefined) {
        if (lastPrep?.renderer !== r) {
            lastPrep?.deprep?.(args);
            lastPrep = undefined;
        }
        const partialPrepResult = r.drawPrep?.(drawArgs, lastPrep);
        const drawDefaultContent = () => {
            if (rowSpanDrawContentInfo?.clip !== undefined) {
                ctx.save();
                ctx.beginPath();
                ctx.rect(
                    rowSpanDrawContentInfo.clip.x,
                    rowSpanDrawContentInfo.clip.y,
                    rowSpanDrawContentInfo.clip.width,
                    rowSpanDrawContentInfo.clip.height
                );
                ctx.clip();
                r.draw(drawArgs, cell);
                ctx.restore();
                return;
            }

            r.draw(drawArgs, cell);
        };

        if (drawCellCallback !== undefined && !isInnerOnlyCell(args.cell)) {
            // 对 rowSpan 锚点行，把“展开后的真实绘制矩形”透传给 drawCell，
            // 这样外部回调与内核默认内容都基于同一块大单元格绘制
            drawCellCallback(drawArgs as DrawArgs<GridCell>, drawDefaultContent);
        } else {
            drawDefaultContent();
        }
        result =
            partialPrepResult === undefined
                ? undefined
                : {
                      deprep: partialPrepResult?.deprep,
                      fillStyle: partialPrepResult?.fillStyle,
                      font: partialPrepResult?.font,
                      renderer: r,
                  };
    }

    if (needsAnim || animationFrameRequested) enqueue?.(allocatedItem);
    return result;
}
