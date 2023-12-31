/* eslint-disable react/display-name */
import * as React from "react";
import BubblesOverlayEditor from "../../data-grid-overlay-editor/private/bubbles-overlay-editor";
import { drawBubbles } from "../data-grid-lib";
import { GridCellKind, type BubbleCell } from "../data-grid-types";
import type { InternalCellRenderer } from "./cell-types";
import { makeAccessibilityStringForArray } from "../../common/utils";

export const bubbleCellRenderer: InternalCellRenderer<BubbleCell> = {
    getAccessibilityString: c => makeAccessibilityStringForArray(c.data),
    kind: GridCellKind.Bubble,
    needsHover: false,
    useLabel: false,
    needsHoverPosition: false,
    measure: (ctx, cell, t) =>
        cell.data.reduce((acc, data) => ctx.measureText(data).width + acc + 20, 0) + 2 * t.cellHorizontalPadding - 4,
    draw: a => drawBubbles(a, a.cell.data),
    provideEditor: () => p => {
        const { value } = p;
        return <BubblesOverlayEditor bubbles={value.data} />;
    },
    onPaste: () => undefined,
};
