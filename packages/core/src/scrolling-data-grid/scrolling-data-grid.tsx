import * as React from "react";
import { styled } from "@linaria/react";
import DataGridDnd, { type DataGridDndProps } from "../data-grid-dnd/data-grid-dnd";
import type { Rectangle } from "../data-grid/data-grid-types";
import { InfiniteScroller } from "./infinite-scroller";
import clamp from "lodash/clamp.js";

type Props = Omit<DataGridDndProps, "width" | "height" | "eventTargetRef">;

export interface ScrollingDataGridProps extends Props {
    readonly className: string | undefined;
    readonly onVisibleRegionChanged:
        | ((
              range: Rectangle,
              clientWidth: number,
              clientHeight: number,
              rightElWidth: number,
              tx: number,
              ty: number
          ) => void)
        | undefined;
    /**
     * Causes the grid to scroll to the end when flipped to true
     * @deprecated Use {@link DataEditorRef.scrollTo} instead
     * @group Deprecated
     */
    readonly scrollToEnd: boolean | undefined;
    readonly scrollRef: React.MutableRefObject<HTMLDivElement | null> | undefined;

    /**
     * The overscroll properties are used to allow the grid to scroll past the logical end of the content by a fixed
     * number of pixels. This is useful particularly on the X axis if you allow for resizing columns as it can make
     * resizing the final column significantly easier.
     *
     * @group Advanced
     */
    readonly overscrollX: number | undefined;
    /** {@inheritDoc overscrollX}
     * @group Advanced
     */
    readonly overscrollY: number | undefined;
    /**
     * Provides an initial size for the grid which can prevent a flicker on load if the initial size is known prior to
     * layout.
     *
     * @group Advanced
     */
    readonly initialSize: readonly [width: number, height: number] | undefined;
    /**
     * Set to true to prevent any diagonal scrolling.
     * @group Advanced
     */
    readonly preventDiagonalScrolling: boolean | undefined;

    /**
     * If `rightElementProps.sticky` is set to true the right element will be visible at all times, otherwise the user
     * will need to scroll to the end to reveal it.
     *
     * If `rightElementProps.fill` is set, the right elements container will fill to consume all remaining space (if
     * any) at the end of the grid. This does not play nice with growing columns.
     *
     * @group Advanced
     */
    readonly rightElementProps:
        | {
              readonly sticky?: boolean;
              readonly fill?: boolean;
          }
        | undefined;
    /**
     * The right element is a DOM node which can be inserted at the end of the horizontal scroll region. This can be
     * used to create a right handle panel, make a big add button, or display messages.
     * @group Advanced
     */
    readonly rightElement: React.ReactNode | undefined;
    /**
     * Enables/disables the interactive minimap.
     * @defaultValue false
     * @group Advanced
     */
    readonly showMinimap: boolean | undefined;
    readonly clientSize: readonly [number, number];
}

const MinimapStyle = styled.div`
    position: absolute;
    right: 44px;
    bottom: 44px;
    background-color: var(--gdg-bg-cell);
    background: linear-gradient(var(--gdg-bg-cell), var(--gdg-bg-cell-medium));
    border-radius: 4px;
    z-index: 1;
    box-shadow:
        0 0 0 1px var(--gdg-border-color),
        0 2px 5px rgba(0, 0, 0, 0.08);

    overflow: hidden;

    .header {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        height: 4px;
        background-color: var(--gdg-bg-header);
        box-shadow: 0 0 0 1px var(--gdg-border-color);
    }

    .locationMarker {
        position: absolute;

        border: 1px solid var(--gdg-accent-color);
        background-color: var(--gdg-accent-light);
    }
`;

const GridScroller: React.FunctionComponent<ScrollingDataGridProps> = p => {
    const {
        hasRowMarkers,
        columns,
        rows,
        rowHeight,
        headerHeight,
        groupHeaderHeight,
        enableGroups,
        freezeColumns,
        experimental,
        clientSize,
        className,
        onVisibleRegionChanged,
        scrollToEnd,
        scrollRef,
        preventDiagonalScrolling,
        rightElement,
        rightElementProps,
        overscrollX,
        overscrollY,
        showMinimap = false,
        initialSize,
        smoothScrollX = false,
        smoothScrollY = false,
        isDraggable,
        verticalOnly,
        rowMarkerWidth,
        filterHeight,
        showFilter,
    } = p;
    const { paddingRight, paddingBottom } = experimental ?? {};

    const [clientWidth, clientHeight] = clientSize;
    const last = React.useRef<Rectangle | undefined>();
    const lastX = React.useRef<number | undefined>();
    const lastY = React.useRef<number | undefined>();
    const lastSize = React.useRef<readonly [number, number] | undefined>();

    const width = React.useMemo(() => {
        let r = Math.max(0, overscrollX ?? 0);
        for (const c of columns) {
            r += c.width;
        }
        return r;
    }, [columns, overscrollX]);

    const totalHeaderHeight = showFilter ? headerHeight + filterHeight : headerHeight;

    let height = enableGroups ? totalHeaderHeight + groupHeaderHeight : totalHeaderHeight;
    if (typeof rowHeight === "number") {
        height += rows * rowHeight;
    } else {
        for (let r = 0; r < rows; r++) {
            height += rowHeight(r);
        }
    }
    if (overscrollY !== undefined) {
        height += overscrollY;
    }

    const lastArgs = React.useRef<Rectangle & { paddingRight: number }>();

    const processArgs = React.useCallback(() => {
        if (lastArgs.current === undefined) return;
        const args = { ...lastArgs.current };

        let x = 0;
        let tx = args.x < 0 ? -args.x : 0;
        let cellRight = 0;
        let cellX = 0;

        args.x = args.x < 0 ? 0 : args.x;

        let stickyColWidth = 0;
        for (let i = 0; i < freezeColumns; i++) {
            stickyColWidth += columns[i].width;
        }

        for (const c of columns) {
            const cx = x - stickyColWidth;
            if (args.x >= cx + c.width) {
                x += c.width;
                cellX++;
                cellRight++;
            } else if (args.x > cx) {
                x += c.width;
                if (smoothScrollX) {
                    tx += cx - args.x;
                } else {
                    cellX++;
                }
                cellRight++;
            } else if (args.x + args.width > cx) {
                x += c.width;
                cellRight++;
            } else {
                break;
            }
        }

        let ty = 0;
        let cellY = 0;
        let cellBottom = 0;
        if (typeof rowHeight === "number") {
            if (smoothScrollY) {
                cellY = Math.floor(args.y / rowHeight);
                ty = cellY * rowHeight - args.y;
            } else {
                cellY = Math.ceil(args.y / rowHeight);
            }
            cellBottom = Math.ceil(args.height / rowHeight) + cellY;
            if (ty < 0) cellBottom++;
        } else {
            let y = 0;
            for (let row = 0; row < rows; row++) {
                const rh = rowHeight(row);
                const cy = y + (smoothScrollY ? 0 : rh / 2);
                if (args.y >= y + rh) {
                    y += rh;
                    cellY++;
                    cellBottom++;
                } else if (args.y > cy) {
                    y += rh;
                    if (smoothScrollY) {
                        ty += cy - args.y;
                    } else {
                        cellY++;
                    }
                    cellBottom++;
                } else if (args.y + args.height > rh / 2 + y) {
                    y += rh;
                    cellBottom++;
                } else {
                    break;
                }
            }
        }

        const rect: Rectangle = {
            x: cellX,
            y: cellY,
            width: cellRight - cellX,
            height: cellBottom - cellY,
        };

        const oldRect = last.current;

        if (
            oldRect === undefined ||
            oldRect.y !== rect.y ||
            oldRect.x !== rect.x ||
            oldRect.height !== rect.height ||
            oldRect.width !== rect.width ||
            lastX.current !== tx ||
            lastY.current !== ty ||
            args.width !== lastSize.current?.[0] ||
            args.height !== lastSize.current?.[1]
        ) {
            onVisibleRegionChanged?.(
                {
                    x: cellX,
                    y: cellY,
                    width: cellRight - cellX,
                    height: cellBottom - cellY,
                },
                args.width,
                args.height,
                args.paddingRight ?? 0,
                tx,
                ty
            );
            last.current = rect;
            lastX.current = tx;
            lastY.current = ty;
            lastSize.current = [args.width, args.height];
        }
    }, [columns, rowHeight, rows, onVisibleRegionChanged, freezeColumns, smoothScrollX, smoothScrollY]);

    const onScrollUpdate = React.useCallback(
        (args: Rectangle & { paddingRight: number }) => {
            lastArgs.current = args;
            processArgs();
        },
        [processArgs]
    );

    React.useEffect(() => {
        processArgs();
    }, [processArgs]);

    const scroller = scrollRef?.current ?? undefined;
    const aspect = clamp(width / height, 2 / 3, 1.5);
    const maxSize = 200;
    const w = aspect > 1 ? maxSize : Math.ceil(maxSize * aspect);
    const h = aspect > 1 ? Math.ceil(maxSize / aspect) : maxSize;
    const hRatio = w / width;
    const vRatio = h / height;
    const vWidth = Math.min(clientWidth * Math.max(hRatio, 0.01), w);
    const vHeight = Math.min(clientHeight * Math.max(vRatio, 0.01), h);
    const left = ((scroller?.scrollLeft ?? 0) / (width - clientWidth)) * (w - vWidth);
    const top = ((scroller?.scrollTop ?? 0) / (height - clientHeight)) * (h - vHeight);

    const minimap: React.ReactNode = React.useMemo(() => {
        if (!showMinimap || vWidth === 0 || vHeight === 0) return undefined;

        const handleMouse = (e: React.MouseEvent) => {
            if (scroller === undefined) return;
            const bounds = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - bounds.x - vWidth / 2;
            const y = e.clientY - bounds.y - vHeight / 2;

            const newScrollLeft = (width - scroller.clientWidth) * (x / (w - vWidth));
            const newScrollTop = (height - scroller.clientHeight) * (y / (h - vHeight));

            scroller.scrollTo({
                left: newScrollLeft,
                top: newScrollTop,
                behavior: e.type === "mousemove" ? "auto" : "smooth",
            });
        };

        return (
            <MinimapStyle
                style={{ width: w, height: h }}
                data-testid="minimap-container"
                onMouseMove={e => {
                    if (e.buttons !== 1) return;
                    handleMouse(e);
                }}
                onClick={handleMouse}>
                <div className="header" />
                <div
                    className="locationMarker"
                    onDragStart={e => e.preventDefault()}
                    style={{
                        left,
                        top,
                        width: vWidth,
                        height: vHeight,
                        borderRadius: Math.min(vWidth, vHeight * 0.2, 9),
                    }}></div>
            </MinimapStyle>
        );
    }, [h, height, left, scroller, showMinimap, top, vHeight, vWidth, w, width]);

    return (
        <InfiniteScroller
            scrollRef={scrollRef}
            minimap={minimap}
            className={className}
            preventDiagonalScrolling={preventDiagonalScrolling}
            draggable={isDraggable === true || typeof isDraggable === "string"}
            scrollWidth={width + (paddingRight ?? 0)}
            scrollHeight={height + (paddingBottom ?? 0)}
            clientHeight={clientHeight}
            rightElement={rightElement}
            paddingBottom={paddingBottom}
            paddingRight={paddingRight}
            rightElementProps={rightElementProps}
            update={onScrollUpdate}
            initialSize={initialSize}
            scrollToEnd={scrollToEnd}>
            <DataGridDnd
                rowMarkerWidth={rowMarkerWidth}
                hasRowMarkers={hasRowMarkers}
                eventTargetRef={scrollRef}
                width={clientWidth}
                height={clientHeight}
                accessibilityHeight={p.accessibilityHeight}
                canvasRef={p.canvasRef}
                cellXOffset={p.cellXOffset}
                cellYOffset={p.cellYOffset}
                columns={p.columns}
                disabledRows={p.disabledRows}
                enableGroups={p.enableGroups}
                fillHandle={p.fillHandle}
                firstColAccessible={p.firstColAccessible}
                fixedShadowX={p.fixedShadowX}
                fixedShadowY={p.fixedShadowY}
                freezeColumns={p.freezeColumns}
                getCellContent={p.getCellContent}
                getCellRenderer={p.getCellRenderer}
                getGroupDetails={p.getGroupDetails}
                getRowThemeOverride={p.getRowThemeOverride}
                groupHeaderHeight={p.groupHeaderHeight}
                headerHeight={p.headerHeight}
                highlightRegions={p.highlightRegions}
                imageWindowLoader={p.imageWindowLoader}
                isFilling={p.isFilling}
                isFocused={p.isFocused}
                lockColumns={p.lockColumns}
                maxColumnWidth={p.maxColumnWidth}
                minColumnWidth={p.minColumnWidth}
                onHeaderMenuClick={p.onHeaderMenuClick}
                onMouseMove={p.onMouseMove}
                prelightCells={p.prelightCells}
                rowHeight={p.rowHeight}
                rows={p.rows}
                selection={p.selection}
                theme={p.theme}
                trailingRowType={p.trailingRowType}
                translateX={p.translateX}
                translateY={p.translateY}
                verticalBorder={p.verticalBorder}
                drawCustomCell={p.drawCustomCell}
                drawFocusRing={p.drawFocusRing}
                drawHeader={p.drawHeader}
                experimental={p.experimental}
                gridRef={p.gridRef}
                headerIcons={p.headerIcons}
                isDraggable={p.isDraggable}
                onCanvasBlur={p.onCanvasBlur}
                onCanvasFocused={p.onCanvasFocused}
                onCellFocused={p.onCellFocused}
                onColumnMoved={p.onColumnMoved}
                onColumnResize={p.onColumnResize}
                onColumnResizeEnd={p.onColumnResizeEnd}
                onColumnResizeStart={p.onColumnResizeStart}
                onContextMenu={p.onContextMenu}
                onDragEnd={p.onDragEnd}
                onDragLeave={p.onDragLeave}
                onDragOverCell={p.onDragOverCell}
                onDragStart={p.onDragStart}
                onDrop={p.onDrop}
                onItemHovered={p.onItemHovered}
                onKeyDown={p.onKeyDown}
                onKeyUp={p.onKeyUp}
                onMouseDown={p.onMouseDown}
                onMouseUp={p.onMouseUp}
                onRowMoved={p.onRowMoved}
                smoothScrollX={p.smoothScrollX}
                smoothScrollY={p.smoothScrollY}
                verticalOnly={verticalOnly}
                showFilter={p.showFilter}
                filterHeight={p.filterHeight}
                getFilterCellContent={p.getFilterCellContent}
                showAccent={p.showAccent}
            />
        </InfiniteScroller>
    );
};

export default GridScroller;
