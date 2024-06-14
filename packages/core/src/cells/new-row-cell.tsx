import { getMiddleCenterBias } from "../internal/data-grid/render/data-grid-lib.js";
import { InnerGridCellKind, type NewRowCell } from "../internal/data-grid/data-grid-types.js";
import type { BaseDrawArgs, InternalCellRenderer } from "./cell-types.js";

export const newRowCellRenderer: InternalCellRenderer<NewRowCell> = {
    getAccessibilityString: () => "",
    kind: InnerGridCellKind.NewRow,
    needsHover: true,
    needsHoverPosition: false,
    measure: () => 200,
    draw: a => drawNewRowCell(a, a.cell.hint, a.cell.showAddIcon, a.cell.icon),
    onPaste: () => undefined,
};

function drawNewRowCell(args: BaseDrawArgs, data: string, showAddIcon: boolean | undefined, icon?: string) {
    const { ctx, rect, hoverAmount, theme, spriteManager, cell } = args;
    const { x, y, width: w, height: h } = rect;
    ctx.beginPath();
    ctx.globalAlpha = hoverAmount;
    ctx.rect(x + 1, y + 1, w, h - 2);
    ctx.fillStyle = theme.bgNewRowHovered;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();

    const alwaysShowIcon = data !== "";

    let textX = 0;

    if (icon !== undefined && icon !== "") {
        const padding = 8;
        const size = h - padding;
        const px = x + padding / 2;
        const py = y + padding / 2;

        spriteManager.drawSprite(icon, "normal", ctx, px, py, size, theme, alwaysShowIcon ? 1 : hoverAmount);
        textX = size;
    } else {
        textX = showAddIcon === true ? 24 : 0;
        const finalLineSize = 12;
        const lineSize = showAddIcon === true ? (alwaysShowIcon ? finalLineSize : hoverAmount * finalLineSize) : 0;
        const xTranslate = alwaysShowIcon ? 0 : (1 - hoverAmount) * finalLineSize * 0.5;

        const padPlus = theme.cellHorizontalPadding + 4;
        if (lineSize > 0) {
            ctx.moveTo(x + padPlus + xTranslate, y + h / 2);
            ctx.lineTo(x + padPlus + xTranslate + lineSize, y + h / 2);
            ctx.moveTo(x + padPlus + xTranslate + lineSize * 0.5, y + h / 2 - lineSize * 0.5);
            ctx.lineTo(x + padPlus + xTranslate + lineSize * 0.5, y + h / 2 + lineSize * 0.5);
            ctx.lineWidth = 2;
            ctx.strokeStyle = theme.bgIconHeader;
            ctx.lineCap = "round";
            ctx.stroke();
        }
    }

    const contentAlign = cell.contentAlign ?? "left";
    ctx.textAlign = contentAlign;
    ctx.fillStyle = theme.textMedium;

    const bias = getMiddleCenterBias(ctx, theme);
    if (contentAlign === "right") {
        ctx.fillText(data, x + w - (theme.cellHorizontalPadding + 0.5), y + h / 2 + bias);
    } else if (contentAlign === "center") {
        ctx.fillText(data, x + w / 2, y + h / 2 + bias);
    } else {
        ctx.fillText(data, textX + x + theme.cellHorizontalPadding + 0.5, y + h / 2 + getMiddleCenterBias(ctx, theme));
    }
    ctx.beginPath();
}
