import { cleanup, renderHook } from "@testing-library/react-hooks";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GridCellKind, type GridCell, type Item, type Rectangle } from "../src/index.js";
import { useCellsForSelection } from "../src/data-editor/use-cells-for-selection.js";

const textCell = (data: string): GridCell => ({
    kind: GridCellKind.Text,
    allowOverlay: false,
    data,
    displayData: data,
});

const getCellContent = ([col, row]: Item): GridCell => textCell(`${col},${row}`);

function setupFilterSelection(
    getFilterCellContent: (col: number) => GridCell,
    getRowMarkerFilterCellContent?: () => GridCell
) {
    const abortController = new AbortController();

    return renderHook(() =>
        useCellsForSelection(
            true,
            getCellContent,
            getFilterCellContent,
            getRowMarkerFilterCellContent,
            1,
            abortController,
            100
        )
    );
}

function readSelection(result: ReturnType<typeof setupFilterSelection>["result"], rect: Rectangle): GridCell[][] {
    const [getCellsForSelection] = result.current;
    expect(getCellsForSelection).toBeDefined();

    const cells = getCellsForSelection?.(rect, new AbortController().signal);
    expect(typeof cells).toBe("object");

    return cells as GridCell[][];
}

describe("useCellsForSelection", () => {
    afterEach(async () => {
        await cleanup();
    });

    it("keeps row marker filter content separate from business filter content", () => {
        const getFilterCellContent = vi.fn((col: number): GridCell => textCell(`filter-${col}`));
        const getRowMarkerFilterCellContent = vi.fn((): GridCell => textCell("marker-filter"));
        const { result } = setupFilterSelection(getFilterCellContent, getRowMarkerFilterCellContent);

        const cells = readSelection(result, { x: 0, y: -3, width: 3, height: 1 });

        expect(cells[0].map(cell => (cell.kind === GridCellKind.Text ? cell.data : cell.kind))).toEqual([
            "marker-filter",
            "filter-0",
            "filter-1",
        ]);
        expect(getFilterCellContent.mock.calls.map(([col]) => col)).toEqual([0, 1]);
        expect(getRowMarkerFilterCellContent).toHaveBeenCalledTimes(1);
    });

    it("does not reuse the first business filter cell for row marker selection output", () => {
        const getFilterCellContent = vi.fn((col: number): GridCell => textCell(`filter-${col}`));
        const { result } = setupFilterSelection(getFilterCellContent);

        const cells = readSelection(result, { x: 0, y: -3, width: 3, height: 1 });

        expect(cells[0][0]).toMatchObject({
            kind: GridCellKind.Loading,
            allowOverlay: false,
        });
        expect(cells[0].slice(1).map(cell => (cell.kind === GridCellKind.Text ? cell.data : cell.kind))).toEqual([
            "filter-0",
            "filter-1",
        ]);
        expect(getFilterCellContent.mock.calls.map(([col]) => col)).toEqual([0, 1]);
    });
});
