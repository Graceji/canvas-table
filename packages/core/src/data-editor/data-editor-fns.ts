import type { DataGridSearchProps } from "../internal/data-grid-search/data-grid-search.js";
import {
    type GridCell,
    type GridSelection,
    type Rectangle,
    type InnerGridCell,
    type Item,
} from "../internal/data-grid/data-grid-types.js";
import { getCopyBufferContents, type CopyBuffer } from "./copy-paste.js";

export function expandSelection(
    newVal: GridSelection,
    getCellsForSelection: DataGridSearchProps["getCellsForSelection"],
    rowMarkerOffset: number,
    spanRangeBehavior: "allowPartial" | "default",
    abortController: AbortController
): GridSelection {
    const origVal = newVal;
    if (spanRangeBehavior === "allowPartial" || newVal.current === undefined || getCellsForSelection === undefined)
        return newVal;
    let isFilled = false;
    do {
        if (newVal?.current === undefined) break;
        const r: Rectangle = newVal.current?.range;
        const cells: (readonly GridCell[])[] = [];
        if (r.width > 2) {
            const leftCells = getCellsForSelection(
                {
                    x: r.x,
                    y: r.y,
                    width: 1,
                    height: r.height,
                },
                abortController.signal
            );

            if (typeof leftCells === "function") {
                return origVal;
            }

            cells.push(...leftCells);

            const rightCells = getCellsForSelection(
                {
                    x: r.x + r.width - 1,
                    y: r.y,
                    width: 1,
                    height: r.height,
                },
                abortController.signal
            );

            if (typeof rightCells === "function") {
                return origVal;
            }

            cells.push(...rightCells);
        } else {
            const rCells = getCellsForSelection(
                {
                    x: r.x,
                    y: r.y,
                    width: r.width,
                    height: r.height,
                },
                abortController.signal
            );
            if (typeof rCells === "function") {
                return origVal;
            }
            cells.push(...rCells);
        }

        let left = r.x - rowMarkerOffset;
        let right = r.x + r.width - 1 - rowMarkerOffset;
        for (const row of cells) {
            for (const cell of row) {
                if (cell.span === undefined) continue;
                left = Math.min(cell.span[0], left);
                right = Math.max(cell.span[1], right);
            }
        }

        if (left === r.x - rowMarkerOffset && right === r.x + r.width - 1 - rowMarkerOffset) {
            isFilled = true;
        } else {
            newVal = {
                current: {
                    cell: newVal.current.cell ?? [0, 0],
                    range: {
                        x: left + rowMarkerOffset,
                        y: r.y,
                        width: right - left + 1,
                        height: r.height,
                    },
                    rangeStack: newVal.current.rangeStack,
                },
                columns: newVal.columns,
                rows: newVal.rows,
            };
        }
    } while (!isFilled);
    return newVal;
}

// 选区高亮和 focus ring 最终都要落到“真实单元格边界”上
// 对 rowSpan / span 单元格来说，点击命中的只是其中一个逻辑格子，
// 这里的几个 helper 负责把逻辑格子还原成真实绘制边界
function rectsIntersect(a: Rectangle, b: Rectangle): boolean {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function rectContains(a: Rectangle, b: Rectangle): boolean {
    return a.x <= b.x && a.y <= b.y && a.x + a.width >= b.x + b.width && a.y + a.height >= b.y + b.height;
}

function getCellSelectionBounds(cell: InnerGridCell, location: Item): Rectangle {
    const [col, row] = location;
    const span = cell.span ?? [col, col];
    const rowSpan = cell.rowSpan ?? 1;
    const rowSpanOffset = cell.rowSpanOffset ?? 0;

    // rowSpanOffset 表示当前位置距离合并块起始行的偏移量，因此真实 y 需要回退到 anchor row
    return {
        x: span[0],
        y: row - rowSpanOffset,
        width: span[1] - span[0] + 1,
        height: rowSpan,
    };
}

export function expandSelectionOutlineToCellBounds(
    rawRange: Rectangle,
    getCellContent: (location: Item) => InnerGridCell,
    maxCols: number,
    maxRows: number
): Rectangle[] {
    // 先把原始 range 裁到当前网格可见/可用范围内，避免取到无效坐标
    const minCol = Math.max(0, rawRange.x);
    const maxCol = Math.min(maxCols, rawRange.x + rawRange.width);
    const minRow = Math.max(0, rawRange.y);
    const maxRow = Math.min(maxRows, rawRange.y + rawRange.height);

    if (minCol >= maxCol || minRow >= maxRow) {
        return [];
    }

    const clampedRange = {
        x: minCol,
        y: minRow,
        width: maxCol - minCol,
        height: maxRow - minRow,
    };
    const unmodifiedRange =
        clampedRange.x === rawRange.x &&
        clampedRange.y === rawRange.y &&
        clampedRange.width === rawRange.width &&
        clampedRange.height === rawRange.height
            ? rawRange
            : clampedRange;

    let expandedRange = clampedRange;
    let needsExpansion = false;
    const expandToInclude = (range: Rectangle, bounds: Rectangle): Rectangle => {
        const x = Math.max(0, Math.min(range.x, bounds.x));
        const y = Math.max(0, Math.min(range.y, bounds.y));
        const right = Math.min(maxCols, Math.max(range.x + range.width, bounds.x + bounds.width));
        const bottom = Math.min(maxRows, Math.max(range.y + range.height, bounds.y + bounds.height));

        return {
            x,
            y,
            width: right - x,
            height: bottom - y,
        };
    };
    const visitCell = (col: number, row: number, range: Rectangle): Rectangle => {
        const cell = getCellContent([col, row]);
        const bounds = getCellSelectionBounds(cell, [col, row]);

        if (!rectsIntersect(bounds, range)) {
            return range;
        }

        if (!rectContains(range, bounds)) {
            needsExpansion = true;
            return expandToInclude(range, bounds);
        }

        return range;
    };

    let didExpand = false;
    do {
        didExpand = false;
        const scanRange = expandedRange;
        let nextRange = scanRange;
        const scanMinCol = scanRange.x;
        const scanMaxCol = scanRange.x + scanRange.width;
        const scanMinRow = scanRange.y;
        const scanMaxRow = scanRange.y + scanRange.height;

        // 只需要扫描选区边界
        // 内部完全包住的 rowSpan/span 单元格不会改变外轮廓，扫描整个矩形会把选区更新放大成 O(width * height)
        for (let col = scanMinCol; col < scanMaxCol; col++) {
            nextRange = visitCell(col, scanMinRow, nextRange);
            if (scanMaxRow - scanMinRow > 1) {
                nextRange = visitCell(col, scanMaxRow - 1, nextRange);
            }
        }

        for (let row = scanMinRow + 1; row < scanMaxRow - 1; row++) {
            nextRange = visitCell(scanMinCol, row, nextRange);
            if (scanMaxCol - scanMinCol > 1) {
                nextRange = visitCell(scanMaxCol - 1, row, nextRange);
            }
        }

        didExpand =
            nextRange.x !== scanRange.x ||
            nextRange.y !== scanRange.y ||
            nextRange.width !== scanRange.width ||
            nextRange.height !== scanRange.height;
        expandedRange = nextRange;
    } while (didExpand);

    // 边界上的合并块如果仍完整落在选区内，不会改变外轮廓；
    // 如果跨出边界，则把外框扩到合并块真实边界，仍保持 O(width + height) 的边界扫描
    return [needsExpansion ? expandedRange : unmodifiedRange];
}

function descape(s: string): string {
    if (s.startsWith('"') && s.endsWith('"')) {
        s = s.slice(1, -1).replace(/""/g, '"');
    }
    return s;
}

export function unquote(str: string): CopyBuffer {
    const enum State {
        None,
        inString,
        inStringPostQuote,
    }

    const result: string[][] = [];
    let current: string[] = [];

    let start = 0;
    let state = State.None;
    str = str.replace(/\r\n/g, "\n");
    let index = 0;
    for (const char of str) {
        switch (state) {
            case State.None:
                if (char === "\t" || char === "\n") {
                    current.push(str.slice(start, index));
                    start = index + 1;

                    if (char === "\n") {
                        result.push(current);
                        current = [];
                    }
                } else if (char === `"`) {
                    state = State.inString;
                }
                break;
            case State.inString:
                if (char === `"`) {
                    state = State.inStringPostQuote;
                }
                break;
            case State.inStringPostQuote:
                if (char === '"') {
                    state = State.inString;
                } else if (char === "\t" || char === "\n") {
                    current.push(descape(str.slice(start, index)));
                    start = index + 1;

                    if (char === "\n") {
                        result.push(current);
                        current = [];
                    }
                    state = State.None;
                } else {
                    state = State.None;
                }
                break;
        }

        index++;
    }
    if (start < str.length) {
        current.push(descape(str.slice(start, str.length)));
    }
    result.push(current);
    return result.map(r => r.map(c => ({ rawValue: c, formatted: c, format: "string" })));
}

export function copyToClipboard(
    cells: readonly (readonly GridCell[])[],
    columnIndexes: readonly number[],
    e?: ClipboardEvent
) {
    const copyBuffer = getCopyBufferContents(cells, columnIndexes);

    // eslint-disable-next-line unicorn/consistent-function-scoping
    const copyWithWriteText = (s: string) => {
        void window.navigator.clipboard?.writeText(s);
    };

    const copyWithWrite = (s: string, html: string): boolean => {
        if (window.navigator.clipboard?.write === undefined) return false;
        void window.navigator.clipboard.write([
            new ClipboardItem({
                // eslint-disable-next-line sonarjs/no-duplicate-string
                "text/plain": new Blob([s], { type: "text/plain" }),
                "text/html": new Blob([html], {
                    type: "text/html",
                }),
            }),
        ]);
        return true;
    };

    const copyWithClipboardData = (s: string, html: string) => {
        try {
            if (e === undefined || e.clipboardData === null) throw new Error("No clipboard data");

            // This might fail if we had to await the thunk
            e?.clipboardData?.setData("text/plain", s);
            e?.clipboardData?.setData("text/html", html);
        } catch {
            if (!copyWithWrite(s, html)) {
                copyWithWriteText(s);
            }
        }
    };

    if (window.navigator.clipboard?.write !== undefined || e?.clipboardData !== undefined) {
        void copyWithClipboardData(copyBuffer.textPlain, copyBuffer.textHtml);
    } else {
        void copyWithWriteText(copyBuffer.textPlain);
    }

    e?.preventDefault();
}

/**
 * Checkbox behavior:
 *
 * true + click -> unchecked
 * false + click -> checked
 * indeterminate + click -> checked
 * empty + click -> checked
 */
export function toggleBoolean(data: boolean | null | undefined): boolean | null | undefined {
    return data !== true;
}
