/* eslint-disable sonarjs/no-duplicate-string */
/* eslint-disable unicorn/no-for-loop */
import { type Rectangle } from "../data-grid-types.js";
import { CellSet } from "../cell-set.js";
import { getEffectiveColumns, type MappedGridColumn, rectBottomRight } from "./data-grid-lib.js";
import { blend } from "../color-parser.js";
import { assert } from "../../../common/support.js";
import type { DrawGridArg } from "./draw-grid-arg.js";
import { walkColumns, walkGroups, walkRowsInCol } from "./data-grid-render.walk.js";
import { drawCells } from "./data-grid-render.cells.js";
import { drawGridHeaders } from "./data-grid-render.header.js";
import { drawGridLines, overdrawStickyBoundaries, drawBlanks, drawExtraRowThemes } from "./data-grid-render.lines.js";
import { blitLastFrame, blitResizedCol, computeCanBlit } from "./data-grid-render.blit.js";
import { drawHighlightRings, drawFillHandle, drawColumnResizeOutline } from "./data-grid.render.rings.js";

// Future optimization opportunities
// - Create a cache of a buffer used to render the full view of a partially displayed column so that when
//   scrolling horizontally you can simply blit the pre-drawn column instead of continually paying the draw
//   cost as it slides into view.
// - The same as above but for partially displayed rows
// - Blit headers on horizontal scroll
// - Use webworker to load images, helpful with lots of large images
// - Retain mode for drawing cells. Instead of drawing cells as we come across them, first build a data
//   structure which contains all operations to perform, then sort them all by "prep" requirement, then do
//   all like operations at once.

function clipHeaderDamage(
    ctx: CanvasRenderingContext2D,
    effectiveColumns: readonly MappedGridColumn[],
    width: number,
    groupHeaderHeight: number,
    totalHeaderHeight: number,
    translateX: number,
    translateY: number,
    cellYOffset: number,
    damage: CellSet | undefined
): void {
    if (damage === undefined || damage.size === 0) return;

    ctx.beginPath();

    walkGroups(effectiveColumns, width, translateX, groupHeaderHeight, (span, _group, x, y, w, h) => {
        const hasItemInSpan = damage.hasItemInRectangle({
            x: span[0],
            y: -2,
            width: span[1] - span[0] + 1,
            height: 1,
        });
        if (hasItemInSpan) {
            ctx.rect(x, y, w, h);
        }
    });

    walkColumns(
        effectiveColumns,
        cellYOffset,
        translateX,
        translateY,
        totalHeaderHeight,
        (c, drawX, _colDrawY, clipX) => {
            const diff = Math.max(0, clipX - drawX);

            const finalX = drawX + diff + 1;
            const finalWidth = c.width - diff - 1;
            if (damage.has([c.sourceIndex, -1]) || damage.has([c.sourceIndex, -3])) {
                ctx.rect(
                    finalX,
                    c.group === undefined ? 0 : groupHeaderHeight,
                    finalWidth,
                    totalHeaderHeight // totalHeaderHeight - groupHeaderHeight
                );
            }
        }
    );
    ctx.clip();
}

function getLastRow(
    effectiveColumns: readonly MappedGridColumn[],
    height: number,
    totalHeaderHeight: number,
    translateX: number,
    translateY: number,
    cellYOffset: number,
    rows: number,
    getRowHeight: (row: number) => number,
    freezeTrailingRows: number,
    hasAppendRow: boolean
): number {
    let result = 0;
    walkColumns(
        effectiveColumns,
        cellYOffset,
        translateX,
        translateY,
        totalHeaderHeight,
        (_c, __drawX, colDrawY, _clipX, startRow) => {
            walkRowsInCol(
                startRow,
                colDrawY,
                height,
                rows,
                getRowHeight,
                freezeTrailingRows,
                hasAppendRow,
                undefined,
                (_drawY, row, _rh, isSticky) => {
                    if (!isSticky) {
                        result = Math.max(row, result);
                    }
                }
            );

            return true;
        }
    );
    return result;
}

export function drawGrid(arg: DrawGridArg, lastArg: DrawGridArg | undefined) {
    const {
        canvasCtx,
        headerCanvasCtx,
        width,
        height,
        cellXOffset,
        cellYOffset,
        translateX,
        translateY,
        mappedColumns,
        enableGroups,
        freezeColumns,
        dragAndDropState,
        theme,
        drawFocus,
        headerHeight,
        groupHeaderHeight,
        disabledRows,
        rowHeight,
        verticalBorder,
        horizontalBorder,
        overrideCursor,
        isResizing,
        selection,
        fillHandle,
        freezeTrailingRows,
        rows,
        getCellContent,
        getGroupDetails,
        getRowThemeOverride,
        drawHeaderCallback,
        prelightCells,
        drawCellCallback,
        highlightRegions,
        resizeCol,
        imageLoader,
        lastBlitData,
        hoverValues,
        hyperWrapping,
        hoverInfo,
        spriteManager,
        maxScaleFactor,
        hasAppendRow,
        touchMode,
        enqueue,
        renderStateProvider,
        getCellRenderer,
        renderStrategy,
        bufferACtx,
        bufferBCtx,
        damage,
        minimumCellWidth,
        resizeIndicator,
        filterHeight,
        showFilter,
        getFilterCellContent,
        showAccent,
        dragCol,
    } = arg;
    if (width === 0 || height === 0) return;
    const doubleBuffer = renderStrategy === "double-buffer";
    const dpr = Math.min(maxScaleFactor, Math.ceil(window.devicePixelRatio ?? 1));

    // if we are double buffering we need to make sure we can blit. If we can't we need to redraw the whole thing
    const canBlit = renderStrategy !== "direct" && computeCanBlit(arg, lastArg);

    const canvas = canvasCtx.canvas;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;

        canvas.style.width = width + "px";
        canvas.style.height = height + "px";
    }

    const overlayCanvas = headerCanvasCtx.canvas;
    const totalHeaderHeight =
        (enableGroups ? groupHeaderHeight + headerHeight : headerHeight) + (showFilter ? filterHeight : 0);
    const overlayHeight = totalHeaderHeight + 0; // border
    if (overlayCanvas.width !== width * dpr || overlayCanvas.height !== overlayHeight * dpr) {
        overlayCanvas.width = width * dpr;
        overlayCanvas.height = overlayHeight * dpr;

        overlayCanvas.style.width = width + "px";
        overlayCanvas.style.height = overlayHeight + "px";
    }

    const bufferA = bufferACtx.canvas;
    const bufferB = bufferBCtx.canvas;

    if (doubleBuffer && (bufferA.width !== width * dpr || bufferA.height !== height * dpr)) {
        bufferA.width = width * dpr;
        bufferA.height = height * dpr;
        if (lastBlitData.current !== undefined) lastBlitData.current.aBufferScroll = undefined;
    }

    if (doubleBuffer && (bufferB.width !== width * dpr || bufferB.height !== height * dpr)) {
        bufferB.width = width * dpr;
        bufferB.height = height * dpr;
        if (lastBlitData.current !== undefined) lastBlitData.current.bBufferScroll = undefined;
    }

    const last = lastBlitData.current;
    if (
        canBlit === true &&
        cellXOffset === last?.cellXOffset &&
        cellYOffset === last?.cellYOffset &&
        translateX === last?.translateX &&
        translateY === last?.translateY
    )
        return;

    let mainCtx: CanvasRenderingContext2D | null = null;
    if (doubleBuffer) {
        mainCtx = canvasCtx;
    }
    const overlayCtx = headerCanvasCtx;
    let targetCtx: CanvasRenderingContext2D;
    if (!doubleBuffer) {
        targetCtx = canvasCtx;
    } else if (damage !== undefined) {
        targetCtx = last?.lastBuffer === "b" ? bufferBCtx : bufferACtx;
    } else {
        targetCtx = last?.lastBuffer === "b" ? bufferACtx : bufferBCtx;
    }
    const targetBuffer = targetCtx.canvas;
    const blitSource = doubleBuffer ? (targetBuffer === bufferA ? bufferB : bufferA) : canvas;

    const getRowHeight = typeof rowHeight === "number" ? () => rowHeight : rowHeight;

    overlayCtx.save();
    targetCtx.save();

    overlayCtx.beginPath();
    targetCtx.beginPath();

    overlayCtx.textBaseline = "middle";
    targetCtx.textBaseline = "middle";

    if (dpr !== 1) {
        overlayCtx.scale(dpr, dpr);
        targetCtx.scale(dpr, dpr);
    }

    const effectiveCols = getEffectiveColumns(mappedColumns, cellXOffset, width, dragAndDropState, translateX);

    let drawRegions: Rectangle[] = [];

    const mustDrawFocusOnHeader = drawFocus && selection.current?.cell[1] === cellYOffset && translateY === 0;
    let mustDrawHighlightRingsOnHeader = false;
    if (highlightRegions !== undefined) {
        for (const r of highlightRegions) {
            if (r.style !== "no-outline" && r.range.y === cellYOffset && translateY === 0) {
                mustDrawHighlightRingsOnHeader = true;
                break;
            }
        }
    }
    const drawHeaderTexture = () => {
        drawGridHeaders(
            overlayCtx,
            effectiveCols,
            mappedColumns,
            enableGroups,
            hoverInfo,
            width,
            translateX,
            headerHeight,
            groupHeaderHeight,
            showFilter ? filterHeight : 0,
            dragAndDropState,
            isResizing,
            selection,
            theme,
            spriteManager,
            hoverValues,
            verticalBorder,
            getGroupDetails,
            damage,
            drawHeaderCallback,
            touchMode,
            drawCellCallback,
            imageLoader,
            hyperWrapping,
            enqueue,
            renderStateProvider,
            overrideCursor,
            getCellRenderer,
            getFilterCellContent,
            showAccent,
            dragCol
        );

        drawGridLines(
            overlayCtx,
            effectiveCols,
            cellYOffset,
            translateX,
            translateY,
            width,
            height,
            undefined,
            undefined,
            groupHeaderHeight,
            totalHeaderHeight,
            getRowHeight,
            getRowThemeOverride,
            verticalBorder,
            horizontalBorder,
            freezeTrailingRows,
            rows,
            theme,
            true,
            true
        );

        // overlayCtx.beginPath();
        // overlayCtx.moveTo(0, overlayHeight - 0.5);
        // overlayCtx.lineTo(width, overlayHeight - 0.5);
        // overlayCtx.strokeStyle = blend(
        //     theme.headerBottomBorderColor ?? theme.horizontalBorderColor ?? theme.borderColor,
        //     theme.bgHeader
        // );
        // overlayCtx.stroke();

        if (mustDrawHighlightRingsOnHeader) {
            drawHighlightRings(
                overlayCtx,
                width,
                height,
                cellXOffset,
                cellYOffset,
                translateX,
                translateY,
                mappedColumns,
                freezeColumns,
                showFilter ? filterHeight : 0,
                headerHeight,
                groupHeaderHeight,
                rowHeight,
                freezeTrailingRows,
                rows,
                highlightRegions,
                theme
            );
        }

        if (mustDrawFocusOnHeader) {
            drawFillHandle(
                overlayCtx,
                width,
                height,
                cellYOffset,
                translateX,
                translateY,
                effectiveCols,
                mappedColumns,
                theme,
                totalHeaderHeight,
                selection,
                getRowHeight,
                getCellContent,
                freezeTrailingRows,
                hasAppendRow,
                fillHandle,
                rows
            );
        }
    };

    // handle damage updates by directly drawing to the target to avoid large blits
    if (damage !== undefined) {
        const viewRegionWidth = effectiveCols[effectiveCols.length - 1].sourceIndex + 1;
        const damageInView = damage.hasItemInRegion([
            {
                x: cellXOffset,
                y: -3,
                width: viewRegionWidth,
                height: 3,
            },
            {
                x: cellXOffset,
                y: cellYOffset,
                width: viewRegionWidth,
                height: 300,
            },
            {
                x: 0,
                y: cellYOffset,
                width: freezeColumns,
                height: 300,
            },
            {
                x: 0,
                y: -3,
                width: freezeColumns,
                height: 3,
            },
            {
                x: cellXOffset,
                y: rows - freezeTrailingRows,
                width: viewRegionWidth,
                height: freezeTrailingRows,
                when: freezeTrailingRows > 0,
            },
        ]);

        const doDamage = (ctx: CanvasRenderingContext2D) => {
            drawCells(
                ctx,
                effectiveCols,
                mappedColumns,
                height,
                totalHeaderHeight,
                translateX,
                translateY,
                cellYOffset,
                rows,
                getRowHeight,
                getCellContent,
                getGroupDetails,
                getRowThemeOverride,
                disabledRows,
                drawFocus,
                freezeTrailingRows,
                hasAppendRow,
                drawRegions,
                damage,
                selection,
                prelightCells,
                highlightRegions,
                imageLoader,
                spriteManager,
                hoverValues,
                hoverInfo,
                drawCellCallback,
                hyperWrapping,
                theme,
                enqueue,
                renderStateProvider,
                getCellRenderer,
                overrideCursor,
                minimumCellWidth,
                showAccent
            );

            const selectionCurrent = selection.current;

            if (
                fillHandle &&
                drawFocus &&
                selectionCurrent !== undefined &&
                damage.has(rectBottomRight(selectionCurrent.range))
            ) {
                drawFillHandle(
                    ctx,
                    width,
                    height,
                    cellYOffset,
                    translateX,
                    translateY,
                    effectiveCols,
                    mappedColumns,
                    theme,
                    totalHeaderHeight,
                    selection,
                    getRowHeight,
                    getCellContent,
                    freezeTrailingRows,
                    hasAppendRow,
                    fillHandle,
                    rows
                );
            }
        };

        if (damageInView) {
            if (rows > (freezeTrailingRows > 0 ? freezeTrailingRows : 0)) {
                doDamage(targetCtx);
            }
            if (mainCtx !== null) {
                mainCtx.save();
                mainCtx.scale(dpr, dpr);
                mainCtx.textBaseline = "middle";
                doDamage(mainCtx);
                mainCtx.restore();
            }

            const doHeaders = damage.hasHeader();
            if (doHeaders) {
                clipHeaderDamage(
                    overlayCtx,
                    effectiveCols,
                    width,
                    groupHeaderHeight,
                    totalHeaderHeight,
                    translateX,
                    translateY,
                    cellYOffset,
                    damage
                );
                drawHeaderTexture();
            }
        }

        targetCtx.restore();
        overlayCtx.restore();

        return;
    }

    if (
        canBlit !== true ||
        cellXOffset !== last?.cellXOffset ||
        translateX !== last?.translateX ||
        mustDrawFocusOnHeader !== last?.mustDrawFocusOnHeader ||
        mustDrawHighlightRingsOnHeader !== last?.mustDrawHighlightRingsOnHeader
    ) {
        drawHeaderTexture();
    }

    if (canBlit === true) {
        assert(blitSource !== undefined && last !== undefined);
        const { regions } = blitLastFrame(
            targetCtx,
            blitSource,
            blitSource === bufferA ? last.aBufferScroll : last.bBufferScroll,
            blitSource === bufferA ? last.bBufferScroll : last.aBufferScroll,
            last,
            cellXOffset,
            cellYOffset,
            translateX,
            translateY,
            freezeTrailingRows,
            width,
            height,
            rows,
            totalHeaderHeight,
            dpr,
            mappedColumns,
            effectiveCols,
            rowHeight,
            doubleBuffer
        );
        drawRegions = regions;
    } else if (canBlit !== false) {
        assert(last !== undefined);
        const resizedCol = canBlit;
        drawRegions = blitResizedCol(
            last,
            cellXOffset,
            cellYOffset,
            translateX,
            translateY,
            width,
            height,
            totalHeaderHeight,
            effectiveCols,
            resizedCol
        );
    }

    const scrollX = last !== undefined && (cellXOffset !== last.cellXOffset || translateX !== last.translateX);
    const scrollY = last !== undefined && (cellYOffset !== last.cellYOffset || translateY !== last.translateY);

    if (rows > (freezeTrailingRows > 0 ? freezeTrailingRows : 0)) {
        overdrawStickyBoundaries(
            targetCtx,
            effectiveCols,
            // width,
            height,
            freezeTrailingRows,
            rows,
            verticalBorder,
            getRowHeight,
            theme
        );
        const highlightRedraw = drawHighlightRings(
            targetCtx,
            width,
            height,
            cellXOffset,
            cellYOffset,
            translateX,
            translateY,
            mappedColumns,
            freezeColumns,
            showFilter ? filterHeight : 0,
            headerHeight,
            groupHeaderHeight,
            rowHeight,
            freezeTrailingRows,
            rows,
            highlightRegions,
            theme
        );
        // the overdraw may have nuked out our focus ring right edge.
        const focusRedraw = drawFocus
            ? drawFillHandle(
                  targetCtx,
                  width,
                  height,
                  cellYOffset,
                  translateX,
                  translateY,
                  effectiveCols,
                  mappedColumns,
                  theme,
                  totalHeaderHeight,
                  selection,
                  getRowHeight,
                  getCellContent,
                  freezeTrailingRows,
                  hasAppendRow,
                  fillHandle,
                  rows
              )
            : undefined;

        targetCtx.fillStyle = theme.bgCell;
        if (drawRegions.length > 0) {
            targetCtx.beginPath();
            for (const r of drawRegions) {
                targetCtx.rect(r.x, r.y, r.width, r.height);
            }
            targetCtx.clip();
            targetCtx.fill();
            targetCtx.beginPath();
        } else {
            targetCtx.fillRect(0, 0, width, height);
        }
        const spans = drawCells(
            targetCtx,
            effectiveCols,
            mappedColumns,
            height,
            totalHeaderHeight,
            translateX,
            translateY,
            cellYOffset,
            rows,
            getRowHeight,
            getCellContent,
            getGroupDetails,
            getRowThemeOverride,
            disabledRows,
            drawFocus,
            freezeTrailingRows,
            hasAppendRow,
            drawRegions,
            damage,
            selection,
            prelightCells,
            highlightRegions,
            imageLoader,
            spriteManager,
            hoverValues,
            hoverInfo,
            drawCellCallback,
            hyperWrapping,
            theme,
            enqueue,
            renderStateProvider,
            getCellRenderer,
            overrideCursor,
            minimumCellWidth,
            showAccent
        );
        drawBlanks(
            targetCtx,
            effectiveCols,
            mappedColumns,
            width,
            height,
            totalHeaderHeight,
            translateX,
            translateY,
            cellYOffset,
            rows,
            getRowHeight,
            getRowThemeOverride,
            selection.rows,
            disabledRows,
            freezeTrailingRows,
            hasAppendRow,
            drawRegions,
            damage,
            theme
        );

        drawExtraRowThemes(
            targetCtx,
            effectiveCols,
            cellYOffset,
            translateX,
            translateY,
            width,
            height,
            drawRegions,
            totalHeaderHeight,
            getRowHeight,
            getRowThemeOverride,
            verticalBorder,
            freezeTrailingRows,
            rows,
            theme
        );

        drawGridLines(
            targetCtx,
            effectiveCols,
            cellYOffset,
            translateX,
            translateY,
            width,
            height,
            drawRegions,
            spans,
            groupHeaderHeight,
            totalHeaderHeight,
            getRowHeight,
            getRowThemeOverride,
            verticalBorder,
            horizontalBorder,
            freezeTrailingRows,
            rows,
            theme
        );

        highlightRedraw?.();
        focusRedraw?.();

        if (isResizing && resizeIndicator !== "none") {
            walkColumns(effectiveCols, 0, translateX, 0, totalHeaderHeight, (c, x) => {
                if (c.sourceIndex === resizeCol) {
                    drawColumnResizeOutline(
                        overlayCtx,
                        x + c.width,
                        0,
                        totalHeaderHeight + 1,
                        blend(theme.resizeIndicatorColor ?? theme.accentLight, theme.bgHeader)
                    );
                    if (resizeIndicator === "full") {
                        drawColumnResizeOutline(
                            targetCtx,
                            x + c.width,
                            totalHeaderHeight,
                            height,
                            blend(theme.resizeIndicatorColor ?? theme.accentLight, theme.bgCell)
                        );
                    }
                    return true;
                }
                return false;
            });
        }

        if (mainCtx !== null) {
            mainCtx.fillStyle = theme.bgCell;
            mainCtx.fillRect(0, 0, width, height);
            mainCtx.drawImage(targetCtx.canvas, 0, 0);
        }

        const lastRowDrawn = getLastRow(
            effectiveCols,
            height,
            totalHeaderHeight,
            translateX,
            translateY,
            cellYOffset,
            rows,
            getRowHeight,
            freezeTrailingRows,
            hasAppendRow
        );

        imageLoader?.setWindow(
            {
                x: cellXOffset,
                y: cellYOffset,
                width: effectiveCols.length,
                height: lastRowDrawn - cellYOffset,
            },
            freezeColumns,
            Array.from({ length: freezeTrailingRows }, (_, i) => rows - 1 - i)
        );

        lastBlitData.current = {
            cellXOffset,
            cellYOffset,
            translateX,
            translateY,
            mustDrawFocusOnHeader,
            mustDrawHighlightRingsOnHeader,
            lastBuffer: doubleBuffer ? (targetBuffer === bufferA ? "a" : "b") : undefined,
            aBufferScroll: targetBuffer === bufferA ? [scrollX, scrollY] : last?.aBufferScroll,
            bBufferScroll: targetBuffer === bufferB ? [scrollX, scrollY] : last?.bBufferScroll,
        };
    } else {
        targetCtx.fillStyle = theme.bgCell;
        targetCtx.fillRect(0, 0, width, height);

        spriteManager.addAdditionalIcon("noData", () => {
            return `<svg class="ant-empty-img-simple" width="64" height="41" viewBox="0 0 64 41" xmlns="http://www.w3.org/2000/svg"><g transform="translate(0 1)" fill="none" fill-rule="evenodd"><ellipse fill="#232323" class="ant-empty-img-simple-ellipse" cx="32" cy="33" rx="32" ry="7"></ellipse><g class="ant-empty-img-simple-g" fill-rule="nonzero"><path stroke="#7b7d80" d="M55 12.76L44.854 1.258C44.367.474 43.656 0 42.907 0H21.093c-.749 0-1.46.474-1.947 1.257L9 12.761V22h46v-9.24z"></path><path fill="#232323" stroke="#7b7d80" d="M41.613 15.931c0-1.605.994-2.93 2.227-2.931H55v18.137C55 33.26 53.68 35 52.05 35h-40.1C10.32 35 9 33.259 9 31.137V13h11.16c1.233 0 2.227 1.323 2.227 2.928v.022c0 1.605 1.005 2.901 2.237 2.901h14.752c1.232 0 2.237-1.308 2.237-2.913v-.007z" class="ant-empty-img-simple-path"></path></g></g></svg>`;
        });
        spriteManager.drawSprite("noData", "normal", targetCtx, width / 2 - 32, height / 2 - 20.5, 64, theme, 1, 41);

        targetCtx.fillStyle = theme.emptyTextLight;
        targetCtx.font = `13px ${theme.fontFamily}`;
        const textWidth = targetCtx.measureText(theme.emptyText).width;
        targetCtx.fillText(theme.emptyText, width / 2 - textWidth / 2, height / 2 + 41);

        lastBlitData.current = {
            cellXOffset: 1,
            cellYOffset: 1,
            translateX: 1,
            translateY: 1,
            mustDrawFocusOnHeader,
            mustDrawHighlightRingsOnHeader,
            lastBuffer: doubleBuffer ? (targetBuffer === bufferA ? "a" : "b") : undefined,
            aBufferScroll: targetBuffer === bufferA ? [scrollX, scrollY] : last?.aBufferScroll,
            bBufferScroll: targetBuffer === bufferB ? [scrollX, scrollY] : last?.bBufferScroll,
        };
    }

    targetCtx.restore();
    overlayCtx.restore();
}
