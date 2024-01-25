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
        const { bounds, cell, posX: x, posY: y } = e;

        // 计算边界时应该按照每一项的盒子来计算
        const isOverHeaderMarkerfn = cell.functions.find(
            item => x >= item.start && x <= item.end && y >= 0 && y <= bounds.height
        );

        if (isOverHeaderMarkerfn && isOverHeaderMarkerfn.type !== "number") {
            if (isOverHeaderMarkerfn.type === "expand" && cell?.node !== undefined) {
                const { node } = cell;

                // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
                node.collapsed = !node.collapsed;
            } else {
                isOverHeaderMarkerfn?.onClick?.(cell.node);
            }

            return cell;
        }

        return undefined;
    },
    onPaste: () => undefined,
};
