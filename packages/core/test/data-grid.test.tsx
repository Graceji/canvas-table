import * as React from "react";
import { render, fireEvent, screen, cleanup } from "@testing-library/react";
import DataGrid, { type DataGridProps, type DataGridRef } from "../src/internal/data-grid/data-grid.js";
import { CompactSelection, GridCellKind, type CustomCell } from "../src/internal/data-grid/data-grid-types.js";
import { getDefaultTheme } from "../src/index.js";
import { AllCellRenderers } from "../src/cells/index.js";
import { vi, expect, describe, test, beforeEach, afterEach } from "vitest";
import ImageWindowLoaderImpl from "../src/common/image-window-loader.js";
import { mergeAndRealizeTheme } from "../src/common/styles.js";
import { standardBeforeEach } from "./test-utils.js";

const basicProps: DataGridProps = {
    cellXOffset: 0,
    cellYOffset: 0,
    headerIcons: undefined,
    isDraggable: undefined,
    onCanvasBlur: () => undefined,
    onCanvasFocused: () => undefined,
    onCellFocused: () => undefined,
    onContextMenu: () => undefined,
    onDragEnd: () => undefined,
    onDragLeave: () => undefined,
    onDragOverCell: () => undefined,
    onDragStart: () => undefined,
    onDrop: () => undefined,
    onHeaderIndicatorClick: () => undefined,
    onItemHovered: () => undefined,
    onKeyDown: () => undefined,
    onKeyUp: () => undefined,
    onMouseDown: () => undefined,
    onMouseMoveRaw: () => undefined,
    onMouseUp: () => undefined,
    smoothScrollX: undefined,
    smoothScrollY: undefined,
    allowResize: undefined,
    canvasRef: undefined,
    disabledRows: undefined,
    eventTargetRef: undefined,
    fillHandle: undefined,
    fixedShadowX: undefined,
    fixedShadowY: undefined,
    getGroupDetails: undefined,
    getRowThemeOverride: undefined,
    highlightRegions: undefined,
    imageWindowLoader: new ImageWindowLoaderImpl(),
    onHeaderMenuClick: undefined,
    prelightCells: undefined,
    translateX: undefined,
    translateY: undefined,
    dragAndDropState: undefined,
    drawFocusRing: true,
    drawHeader: undefined,
    drawCell: undefined,
    isFocused: true,
    experimental: undefined,
    columns: [
        {
            title: "A",
            width: 150,
        },
        {
            title: "B",
            width: 160,
        },
        {
            title: "C",
            width: 170,
        },
        {
            title: "D",
            width: 180,
        },
        {
            title: "E",
            width: 190,
        },
    ],
    isFilling: false,
    enableGroups: false,
    theme: mergeAndRealizeTheme(getDefaultTheme()),
    freezeColumns: 0,
    selection: {
        current: undefined,
        rows: CompactSelection.empty(),
        columns: CompactSelection.empty(),
    },
    firstColAccessible: true,
    onMouseMove: () => undefined,
    getCellContent: cell => ({
        kind: GridCellKind.Text,
        allowOverlay: false,
        data: `${cell[0]},${cell[1]}`,
        displayData: `${cell[0]},${cell[1]}`,
    }),
    groupHeaderHeight: 0,
    headerHeight: 36,
    accessibilityHeight: 50,
    height: 1000,
    width: 1000,
    isDragging: false,
    isResizing: false,
    resizeColumn: undefined,
    freezeTrailingRows: 0,
    hasAppendRow: false,
    rowHeight: 32,
    rows: 1000,
    verticalBorder: () => true,
    horizontalBorder: () => true,
    getCellRenderer: cell => {
        if (cell.kind === GridCellKind.Custom) return undefined;
        return AllCellRenderers.find(x => x.kind === cell.kind) as any;
    },
    resizeIndicator: "full",
};

const customHoverCell: CustomCell = {
    kind: GridCellKind.Custom,
    allowOverlay: false,
    data: {},
    copyData: "",
};

const customHoverRenderer = {
    kind: GridCellKind.Custom,
    isMatch: (cell: CustomCell): cell is CustomCell => cell.kind === GridCellKind.Custom,
    draw: () => undefined,
    needsHoverPosition: true,
};

const rowSpanCellContent: DataGridProps["getCellContent"] = cell => {
    if (cell[0] === 0 && cell[1] < 3) {
        return {
            kind: GridCellKind.Text,
            allowOverlay: false,
            data: "Group A",
            displayData: "Group A",
            rowSpan: 3,
            rowSpanOffset: cell[1],
        };
    }

    return {
        kind: GridCellKind.Text,
        allowOverlay: false,
        data: `${cell[0]},${cell[1]}`,
        displayData: `${cell[0]},${cell[1]}`,
    };
};

const expectedRowSpanBounds = {
    x: 0,
    y: 36,
    width: 151,
    height: 97,
};

const spanAndRowSpanCellContent: DataGridProps["getCellContent"] = cell => {
    if ((cell[0] === 1 || cell[0] === 2) && cell[1] >= 1 && cell[1] < 4) {
        return {
            kind: GridCellKind.Text,
            allowOverlay: false,
            data: "Merged",
            displayData: "Merged",
            span: [1, 2],
            rowSpan: 3,
            rowSpanOffset: cell[1] - 1,
        };
    }

    return {
        kind: GridCellKind.Text,
        allowOverlay: false,
        data: `${cell[0]},${cell[1]}`,
        displayData: `${cell[0]},${cell[1]}`,
    };
};

const expectedSpanAndRowSpanBounds = {
    x: 150,
    y: 68,
    width: 331,
    height: 97,
};

const dataGridCanvasId = "data-grid-canvas";
describe("data-grid", () => {
    beforeEach(() => {
        standardBeforeEach();

        Element.prototype.getBoundingClientRect = () => ({
            bottom: 1000,
            height: 1000,
            left: 0,
            right: 1000,
            top: 0,
            width: 1000,
            x: 0,
            y: 0,
            toJSON: () => "",
        });
        Image.prototype.decode = vi.fn();
    });

    afterEach(() => {
        cleanup();
    });

    test("Emits mouse down", () => {
        const spy = vi.fn();
        render(<DataGrid {...basicProps} onMouseDown={spy} />);

        fireEvent.pointerDown(screen.getByTestId(dataGridCanvasId), {
            clientX: 300, // Col B
            clientY: 36 + 32 + 16, // Row 1 (0 indexed)
        });

        fireEvent.pointerUp(screen.getByTestId(dataGridCanvasId), {
            clientX: 300, // Col B
            clientY: 36 + 32 + 16, // Row 1 (0 indexed)
        });

        fireEvent.click(screen.getByTestId(dataGridCanvasId), {
            clientX: 300, // Col B
            clientY: 36 + 32 + 16, // Row 1 (0 indexed)
        });

        expect(spy).toHaveBeenCalled();
        expect(spy).toHaveBeenCalledWith(
            expect.objectContaining({
                location: [1, 1],
                kind: "cell",
            })
        );
    });

    test("OOB mouse down", () => {
        const spy = vi.fn();
        render(<DataGrid {...basicProps} onMouseDown={spy} />);

        fireEvent.pointerDown(screen.getByTestId(dataGridCanvasId), {
            clientX: 990, // Col B
            clientY: 36 + 32 + 16, // Row 1 (0 indexed)
        });

        expect(spy).toHaveBeenCalled();
        expect(spy).toHaveBeenCalledWith(
            expect.objectContaining({
                kind: "out-of-bounds",
            })
        );
    });

    test("Emits mouse up", () => {
        const spy = vi.fn();
        render(<DataGrid {...basicProps} onMouseUp={spy} />);

        fireEvent.pointerDown(screen.getByTestId(dataGridCanvasId), {
            clientX: 300, // Col B
            clientY: 36 + 32 * 5 + 16, // Row 5 (0 indexed)
        });

        fireEvent.pointerUp(screen.getByTestId(dataGridCanvasId), {
            clientX: 300, // Col B
            clientY: 36 + 32 * 5 + 16, // Row 5 (0 indexed)
        });

        fireEvent.click(screen.getByTestId(dataGridCanvasId), {
            clientX: 300, // Col B
            clientY: 36 + 32 * 5 + 16, // Row 5 (0 indexed)
        });

        expect(spy).toHaveBeenCalledWith(
            expect.objectContaining({
                location: [1, 5],
                kind: "cell",
                localEventX: 150,
                localEventY: 16,
            }),
            false
        );
    });

    test("Does not emit mousedown/up over header menu", () => {
        const downSpy = vi.fn();
        const upSpy = vi.fn();

        render(
            <DataGrid
                {...basicProps}
                columns={basicProps.columns.map(c => ({ ...c, hasMenu: true }))}
                onMouseUp={upSpy}
                onMouseDown={downSpy}
            />
        );

        const el = screen.getByTestId(dataGridCanvasId);
        fireEvent.pointerDown(el, {
            clientX: 140,
            clientY: 18,
        });

        fireEvent.pointerUp(el, {
            clientX: 140,
            clientY: 18,
        });

        expect(downSpy).not.toBeCalled();
        expect(upSpy).not.toBeCalled();
    });

    test("Cell hovered", () => {
        const spy = vi.fn();

        render(<DataGrid {...basicProps} onItemHovered={spy} />);

        const el = screen.getByTestId(dataGridCanvasId);
        fireEvent.pointerMove(el, {
            clientX: 350, // Col C
            clientY: 36 + 32 * 5 + 16, // Row 5 (0 indexed)
        });

        expect(spy).toBeCalledWith(
            expect.objectContaining({
                kind: "cell",
                location: [2, 5],
            })
        );
    });

    test("Cell hover refires within same hover-position cell when local position changes", () => {
        const spy = vi.fn();

        render(
            <DataGrid
                {...basicProps}
                getCellContent={() => customHoverCell}
                getCellRenderer={cell =>
                    cell.kind === GridCellKind.Custom ? (customHoverRenderer as any) : basicProps.getCellRenderer(cell)
                }
                onItemHovered={spy}
            />
        );

        const el = screen.getByTestId(dataGridCanvasId);
        fireEvent.pointerMove(el, {
            clientX: 350,
            clientY: 36 + 32 * 5 + 16,
        });

        fireEvent.pointerMove(el, {
            clientX: 351,
            clientY: 36 + 32 * 5 + 16,
        });

        expect(spy).toHaveBeenCalledTimes(2);
        expect(spy.mock.calls[1][0]).toEqual(
            expect.objectContaining({
                kind: "cell",
                location: [2, 5],
            })
        );
        expect(spy.mock.calls[1][0].localEventX).not.toBe(spy.mock.calls[0][0].localEventX);
    });

    test("Cell hover does not refire within same non-hover-position cell", () => {
        const spy = vi.fn();

        render(<DataGrid {...basicProps} onItemHovered={spy} />);

        const el = screen.getByTestId(dataGridCanvasId);
        fireEvent.pointerMove(el, {
            clientX: 350,
            clientY: 36 + 32 * 5 + 16,
        });

        fireEvent.pointerMove(el, {
            clientX: 351,
            clientY: 36 + 32 * 5 + 16,
        });

        expect(spy).toHaveBeenCalledTimes(1);
    });

    test("Cell is not hovered when target is not data grid", () => {
        const spy = vi.fn();

        render(
            <>
                <DataGrid {...basicProps} onItemHovered={spy} />
                <div
                    data-testid="outside-element"
                    style={{
                        position: "absolute",
                        width: "100vh",
                        height: "100vh",
                    }}
                />
            </>
        );

        const outsideElement = screen.getByTestId("outside-element");
        fireEvent.pointerMove(outsideElement, {
            clientX: 350, // Col C
            clientY: 36 + 32 * 5 + 16, // Row 5 (0 indexed)
        });

        expect(spy).not.toHaveBeenCalled();
    });

    test("Header hovered", () => {
        const spy = vi.fn();

        render(<DataGrid {...basicProps} onItemHovered={spy} />);

        const el = screen.getByTestId(dataGridCanvasId);
        fireEvent.pointerMove(el, {
            clientX: 350, // Col C
            clientY: 16, // Header
        });

        expect(spy).toBeCalledWith(
            expect.objectContaining({
                kind: "header",
                location: [2, -1],
            })
        );
    });

    test("Header hovered when scrolled", () => {
        const spy = vi.fn();

        render(
            <DataGrid {...basicProps} groupHeaderHeight={32} enableGroups={true} cellYOffset={10} onItemHovered={spy} />
        );

        const el = screen.getByTestId(dataGridCanvasId);
        fireEvent.pointerMove(el, {
            clientX: 350, // Col C
            clientY: 46, // Header
        });

        expect(spy).toBeCalledWith(
            expect.objectContaining({
                kind: "header",
                location: [2, -1],
            })
        );
    });

    test("Group header hovered", () => {
        const spy = vi.fn();

        render(<DataGrid {...basicProps} onItemHovered={spy} enableGroups={true} groupHeaderHeight={28} />);

        const el = screen.getByTestId(dataGridCanvasId);
        fireEvent.pointerMove(el, {
            clientX: 350, // Col C
            clientY: 14, // Header
        });

        expect(spy).toBeCalledWith(
            expect.objectContaining({
                kind: "group-header",
                location: [2, -2],
            })
        );
    });

    test("Simple damage", () => {
        const spy = vi.fn(basicProps.getCellContent);
        const ref = React.createRef<DataGridRef>();

        render(<DataGrid ref={ref} {...basicProps} getCellContent={spy} enableGroups={true} groupHeaderHeight={28} />);

        spy.mockClear();
        expect(spy).not.toBeCalled();
        ref.current?.damage([{ cell: [1, 1] }]);
        expect(spy).toBeCalled();
    });

    test("Row-span damage falls back to a full redraw", () => {
        const spy = vi.fn((cell: readonly [number, number]) => {
            if (cell[0] === 0 && cell[1] < 3) {
                return {
                    kind: GridCellKind.Text,
                    allowOverlay: false,
                    data: "Group A",
                    displayData: "Group A",
                    rowSpan: 3,
                    rowSpanOffset: cell[1],
                };
            }

            return {
                kind: GridCellKind.Text,
                allowOverlay: false,
                data: `${cell[0]},${cell[1]}`,
                displayData: `${cell[0]},${cell[1]}`,
            };
        });
        const ref = React.createRef<DataGridRef>();

        render(<DataGrid ref={ref} {...basicProps} getCellContent={spy} enableGroups={true} groupHeaderHeight={28} />);

        spy.mockClear();
        expect(spy).not.toBeCalled();
        ref.current?.damage([{ cell: [0, 1] }]);

        expect(spy.mock.calls.length).toBeGreaterThan(2);
    });

    test("Row-span mouse events expose merged bounds", () => {
        const ref = React.createRef<DataGridRef>();
        const canvasRef = React.createRef<HTMLCanvasElement>() as React.MutableRefObject<HTMLCanvasElement | null>;

        render(<DataGrid ref={ref} {...basicProps} canvasRef={canvasRef} getCellContent={rowSpanCellContent} />);

        const args = ref.current?.getMouseArgsForPosition(75, 36 + 32 + 16);
        expect(args).toEqual(
            expect.objectContaining({
                kind: "cell",
                location: [0, 1],
                bounds: expectedRowSpanBounds,
                localEventX: 75,
                localEventY: 48,
            })
        );
    });

    test("Row-span and column-span mouse events expose full merged bounds", () => {
        const ref = React.createRef<DataGridRef>();
        const canvasRef = React.createRef<HTMLCanvasElement>() as React.MutableRefObject<HTMLCanvasElement | null>;

        render(<DataGrid ref={ref} {...basicProps} canvasRef={canvasRef} getCellContent={spanAndRowSpanCellContent} />);

        const args = ref.current?.getMouseArgsForPosition(200, 68 + 32 + 16);
        expect(args).toEqual(
            expect.objectContaining({
                kind: "cell",
                location: [1, 2],
                bounds: expectedSpanAndRowSpanBounds,
                localEventX: 50,
                localEventY: 48,
            })
        );
    });

    test("Row-span key events expose merged bounds", () => {
        const spy = vi.fn();

        render(
            <DataGrid
                {...basicProps}
                getCellContent={rowSpanCellContent}
                selection={{
                    columns: CompactSelection.empty(),
                    rows: CompactSelection.empty(),
                    current: {
                        cell: [0, 1],
                        range: { x: 0, y: 1, width: 1, height: 1 },
                        rangeStack: [],
                    },
                }}
                onKeyDown={spy}
            />
        );

        fireEvent.keyDown(screen.getByTestId(dataGridCanvasId), {
            key: "Enter",
        });

        expect(spy).toHaveBeenCalledWith(
            expect.objectContaining({
                location: [0, 1],
                bounds: expectedRowSpanBounds,
            })
        );
    });

    test("Row-span fill handle hit testing uses merged bounds", () => {
        const ref = React.createRef<DataGridRef>();
        const canvasRef = React.createRef<HTMLCanvasElement>() as React.MutableRefObject<HTMLCanvasElement | null>;

        render(
            <DataGrid
                ref={ref}
                {...basicProps}
                canvasRef={canvasRef}
                getCellContent={rowSpanCellContent}
                fillHandle={true}
                selection={{
                    columns: CompactSelection.empty(),
                    rows: CompactSelection.empty(),
                    current: {
                        cell: [0, 1],
                        range: { x: 0, y: 1, width: 1, height: 1 },
                        rangeStack: [],
                    },
                }}
            />
        );

        const args = ref.current?.getMouseArgsForPosition(148, 130);
        expect(args).toEqual(
            expect.objectContaining({
                kind: "cell",
                location: [0, 2],
                isFillHandle: true,
            })
        );
    });

    test("Ordinary range fill handle hit testing still uses range bottom-right", () => {
        const ref = React.createRef<DataGridRef>();
        const canvasRef = React.createRef<HTMLCanvasElement>() as React.MutableRefObject<HTMLCanvasElement | null>;

        render(
            <DataGrid
                ref={ref}
                {...basicProps}
                canvasRef={canvasRef}
                fillHandle={true}
                selection={{
                    columns: CompactSelection.empty(),
                    rows: CompactSelection.empty(),
                    current: {
                        cell: [0, 0],
                        range: { x: 0, y: 0, width: 2, height: 3 },
                        rangeStack: [],
                    },
                }}
            />
        );

        const args = ref.current?.getMouseArgsForPosition(308, 130);
        expect(args).toEqual(
            expect.objectContaining({
                kind: "cell",
                location: [1, 2],
                isFillHandle: true,
            })
        );
    });

    test("Row-span and column-span fill handle hit testing uses full merged bounds", () => {
        const ref = React.createRef<DataGridRef>();
        const canvasRef = React.createRef<HTMLCanvasElement>() as React.MutableRefObject<HTMLCanvasElement | null>;

        render(
            <DataGrid
                ref={ref}
                {...basicProps}
                canvasRef={canvasRef}
                getCellContent={spanAndRowSpanCellContent}
                fillHandle={true}
                selection={{
                    columns: CompactSelection.empty(),
                    rows: CompactSelection.empty(),
                    current: {
                        cell: [1, 1],
                        range: { x: 1, y: 1, width: 1, height: 1 },
                        rangeStack: [],
                    },
                }}
            />
        );

        const args = ref.current?.getMouseArgsForPosition(478, 162);
        expect(args).toEqual(
            expect.objectContaining({
                kind: "cell",
                location: [2, 3],
                isFillHandle: true,
            })
        );
    });

    test("Ordinary multi-row outline highlights keep damage localized", () => {
        const spy = vi.fn(basicProps.getCellContent);
        const ref = React.createRef<DataGridRef>();

        render(
            <DataGrid
                ref={ref}
                {...basicProps}
                getCellContent={spy}
                highlightRegions={[
                    {
                        color: basicProps.theme.accentColor,
                        range: { x: 0, y: 0, width: 1, height: 3 },
                        style: "solid-outline",
                    },
                ]}
            />
        );

        spy.mockClear();
        expect(spy).not.toBeCalled();
        ref.current?.damage([{ cell: [2, 2] }]);

        expect(spy.mock.calls.length).toBeLessThan(10);
    });

    test("Row-span-expanded outline highlights only fall back to a full redraw when damage intersects the outline", () => {
        const spy = vi.fn(basicProps.getCellContent);
        const ref = React.createRef<DataGridRef>();

        render(
            <DataGrid
                ref={ref}
                {...basicProps}
                getCellContent={spy}
                highlightRegions={[
                    {
                        color: basicProps.theme.accentColor,
                        range: { x: 0, y: 0, width: 1, height: 3 },
                        style: "solid-outline",
                        requiresFullRedraw: true,
                    },
                ]}
            />
        );

        spy.mockClear();
        expect(spy).not.toBeCalled();
        ref.current?.damage([{ cell: [0, 2] }]);

        expect(spy.mock.calls.length).toBeGreaterThan(2);

        spy.mockClear();
        ref.current?.damage([{ cell: [2, 2] }]);

        expect(spy.mock.calls.length).toBeLessThan(10);
    });

    test("Row-span damage redraws when an offscreen anchor overlaps the visible rows", () => {
        const spy = vi.fn(([col, row]) => {
            if (col === 0 && row < 100) {
                return {
                    kind: GridCellKind.Text,
                    allowOverlay: false,
                    data: "Group A",
                    displayData: "Group A",
                    rowSpan: 100,
                    rowSpanOffset: row,
                };
            }

            return {
                kind: GridCellKind.Text,
                allowOverlay: false,
                data: `${col},${row}`,
                displayData: `${col},${row}`,
            };
        });
        const ref = React.createRef<DataGridRef>();

        render(<DataGrid ref={ref} {...basicProps} getCellContent={spy} cellYOffset={50} />);

        spy.mockClear();
        ref.current?.damage([{ cell: [0, 0] }]);

        expect(spy.mock.calls.length).toBeGreaterThan(2);
    });

    test("Row-span damage below the scrollable viewport does not redraw with frozen trailing rows", () => {
        const spy = vi.fn(([col, row]) => {
            if (col === 0 && row >= 900 && row < 910) {
                return {
                    kind: GridCellKind.Text,
                    allowOverlay: false,
                    data: "Far group",
                    displayData: "Far group",
                    rowSpan: 10,
                    rowSpanOffset: row - 900,
                };
            }

            return {
                kind: GridCellKind.Text,
                allowOverlay: false,
                data: `${col},${row}`,
                displayData: `${col},${row}`,
            };
        });
        const ref = React.createRef<DataGridRef>();

        render(
            <DataGrid
                ref={ref}
                {...basicProps}
                getCellContent={spy}
                cellYOffset={50}
                freezeTrailingRows={1}
            />
        );

        spy.mockClear();
        ref.current?.damage([{ cell: [0, 900] }]);

        expect(spy.mock.calls.length).toBeLessThan(10);
    });

    test("Offscreen row-span outlines do not disable localized damage with frozen trailing rows", () => {
        const spy = vi.fn(basicProps.getCellContent);
        const ref = React.createRef<DataGridRef>();

        render(
            <DataGrid
                ref={ref}
                {...basicProps}
                getCellContent={spy}
                cellYOffset={50}
                freezeTrailingRows={1}
                highlightRegions={[
                    {
                        color: basicProps.theme.accentColor,
                        range: { x: 0, y: 900, width: 1, height: 10 },
                        style: "solid-outline",
                        requiresFullRedraw: true,
                    },
                ]}
            />
        );

        spy.mockClear();
        ref.current?.damage([{ cell: [0, 60] }]);

        expect(spy.mock.calls.length).toBeLessThan(10);
    });

    test("Out of bounds damage", () => {
        const spy = vi.fn(basicProps.getCellContent);
        const ref = React.createRef<DataGridRef>();

        render(<DataGrid ref={ref} {...basicProps} getCellContent={spy} enableGroups={true} groupHeaderHeight={28} />);

        spy.mockClear();
        expect(spy).not.toBeCalled();
        ref.current?.damage([{ cell: [1, 900] }]);
        expect(spy).not.toBeCalled();
    });

    test("Freeze column simple check", () => {
        const spy = vi.fn();
        render(<DataGrid {...basicProps} freezeColumns={1} cellXOffset={3} onMouseUp={spy} />);

        fireEvent.pointerDown(screen.getByTestId(dataGridCanvasId), {
            clientX: 50, // Col A
            clientY: 36 + 32 * 5 + 16, // Row 5 (0 indexed)
        });

        fireEvent.pointerUp(screen.getByTestId(dataGridCanvasId), {
            clientX: 50, // Col A
            clientY: 36 + 32 * 5 + 16, // Row 5 (0 indexed)
        });

        fireEvent.click(screen.getByTestId(dataGridCanvasId), {
            clientX: 50, // Col A
            clientY: 36 + 32 * 5 + 16, // Row 5 (0 indexed)
        });

        expect(spy).toHaveBeenCalledWith(
            expect.objectContaining({
                location: [0, 5],
                kind: "cell",
                localEventX: 50,
                localEventY: 16,
            }),
            false
        );
    });
});
