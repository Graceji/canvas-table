import { drawMarkerRowCell, prepMarkerRowCell } from "../data-grid-lib";
import { InnerGridCellKind, type MarkerCell } from "../data-grid-types";
import type { InternalCellRenderer } from "./cell-types";

export const markerCellRenderer: InternalCellRenderer<MarkerCell> = {
    getAccessibilityString: c => c.row.toString(),
    kind: InnerGridCellKind.Marker,
    needsHover: true,
    needsHoverPosition: false,
    drawPrep: prepMarkerRowCell,
    measure: () => 44,
    draw: a => drawMarkerRowCell(a, a.cell),
    onClick: e => {
        const { bounds, cell, posX: x, posY: y, theme } = e;
        const { width, height } = bounds;

        const centerX = cell.drawHandle ? 7 + (width - 7) / 2 : width / 2;
        const centerY = height / 2;

        const iconSize = 16;
        const iconStart = width / 2 + (width / 2 - theme.cellHorizontalPadding) / 2 - iconSize / 2;

        if (
            x >= iconStart &&
            x <= iconStart + iconSize &&
            y >= (height - iconSize) / 2 &&
            y <= (height - iconSize) / 2 + iconSize
        ) {
            console.log("click icon");
        }

        if (Math.abs(x - centerX) <= 10 && Math.abs(y - centerY) <= 10) {
            return {
                ...cell,
                checked: !cell.checked,
            };
        }
        return undefined;
    },
    onPaste: () => undefined,
};
