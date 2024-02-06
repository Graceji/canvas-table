import { getMiddleCenterBias } from "../internal/data-grid/render/data-grid-lib.js";
import { InnerGridCellKind, type MarkerCell } from "../internal/data-grid/data-grid-types.js";
import type { BaseDrawArgs, InternalCellRenderer, PrepResult } from "./cell-types.js";

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

        if (isOverHeaderMarkerfn !== undefined && isOverHeaderMarkerfn.type !== "number") {
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
    onSelect(args) {
        const { cell, posX: x, posY: y, bounds } = args;

        // 计算边界时应该按照每一项的盒子来计算
        const isOverHeaderMarkerfn = cell.functions.find(
            item => x >= item.start && x <= item.end && y >= 0 && y <= bounds.height
        );

        if (isOverHeaderMarkerfn && isOverHeaderMarkerfn.type !== "number") {
            args.preventDefault();
        } else {
            args.preventDefault(false);
        }
    },
};

function prepMarkerRowCell(args: BaseDrawArgs, lastPrep: PrepResult | undefined): Partial<PrepResult> {
    const { ctx, theme } = args;
    const newFont = theme.markerFontFull;
    const result: Partial<PrepResult> = lastPrep ?? {};
    if (result?.font !== newFont) {
        ctx.font = newFont;
        result.font = newFont;
    }
    result.deprep = deprepMarkerRowCell;
    ctx.textAlign = "center";
    return result;
}

function deprepMarkerRowCell(args: Pick<BaseDrawArgs, "ctx">) {
    const { ctx } = args;
    ctx.textAlign = "start";
}

function drawMarkerRowCell(args: BaseDrawArgs, cell: MarkerCell) {
    const { ctx, rect, hoverAmount, theme, spriteManager } = args;
    const { row: index, markerKind, node, functions } = cell;
    const { x, y, height } = rect;
    const text = index.toString();
    const fontStyle = `${theme.markerFontStyle} ${theme.fontFamily}`;

    ctx.font = fontStyle;
    const textWith = ctx.measureText(text).width;

    const drawIndexNumber = (start: number) => {
        if (markerKind === "both" && hoverAmount !== 0) {
            ctx.globalAlpha = 1 - hoverAmount;
        }
        ctx.fillStyle = theme.markerTextLight;
        ctx.font = fontStyle;
        ctx.fillText(text, start, y + height / 2 + getMiddleCenterBias(ctx, fontStyle));
    };

    const drawExpand = (start: number, size: number) => {
        spriteManager.addAdditionalIcon(
            "expand",
            () =>
                `<svg t="1706168073752" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="9232" width="16" height="16"><path d="M34.133333 1015.466667c-14.165333 0-25.6-11.434667-25.6-25.6V34.133333C8.533333 19.968 19.968 8.533333 34.133333 8.533333h955.733334c14.165333 0 25.6 11.434667 25.6 25.6v955.733334c0 14.165333-11.434667 25.6-25.6 25.6H34.133333z" fill="#9A9A9A" p-id="9233"></path><path d="M989.866667 17.066667c9.386667 0 17.066667 7.68 17.066666 17.066666v955.733334c0 9.386667-7.68 17.066667-17.066666 17.066666H34.133333c-9.386667 0-17.066667-7.68-17.066666-17.066666V34.133333c0-9.386667 7.68-17.066667 17.066666-17.066666h955.733334m0-17.066667H34.133333C15.36 0 0 15.36 0 34.133333v955.733334c0 18.773333 15.36 34.133333 34.133333 34.133333h955.733334c18.773333 0 34.133333-15.36 34.133333-34.133333V34.133333c0-18.773333-15.36-34.133333-34.133333-34.133333z" fill="#9A9A9A" p-id="9234"></path><path d="M836.266667 631.466667H187.733333c-18.773333 0-34.133333-15.36-34.133333-34.133334V426.666667c0-18.773333 15.36-34.133333 34.133333-34.133334h648.533334c18.773333 0 34.133333 15.36 34.133333 34.133334v170.666666c0 18.773333-15.36 34.133333-34.133333 34.133334z" fill="#000000" p-id="9235"></path><path d="M631.466667 187.733333v648.533334c0 18.773333-15.36 34.133333-34.133334 34.133333H426.666667c-18.773333 0-34.133333-15.36-34.133334-34.133333V187.733333c0-18.773333 15.36-34.133333 34.133334-34.133333h170.666666c18.773333 0 34.133333 15.36 34.133334 34.133333z" fill="#000000" p-id="9236"></path></svg>`
        );
        spriteManager.addAdditionalIcon(
            "collapse",
            () =>
                `<svg t="1706168144037" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="9429" width="16" height="16"><path d="M34.133333 1015.466667c-14.165333 0-25.6-11.434667-25.6-25.6V34.133333C8.533333 19.968 19.968 8.533333 34.133333 8.533333h955.733334c14.165333 0 25.6 11.434667 25.6 25.6v955.733334c0 14.165333-11.434667 25.6-25.6 25.6H34.133333z" fill="#9A9A9A" p-id="9430"></path><path d="M989.866667 17.066667c9.386667 0 17.066667 7.68 17.066666 17.066666v955.733334c0 9.386667-7.68 17.066667-17.066666 17.066666H34.133333c-9.386667 0-17.066667-7.68-17.066666-17.066666V34.133333c0-9.386667 7.68-17.066667 17.066666-17.066666h955.733334m0-17.066667H34.133333C15.36 0 0 15.36 0 34.133333v955.733334c0 18.773333 15.36 34.133333 34.133333 34.133333h955.733334c18.773333 0 34.133333-15.36 34.133333-34.133333V34.133333c0-18.773333-15.36-34.133333-34.133333-34.133333z" fill="#9A9A9A" p-id="9431"></path><path d="M836.266667 631.466667H187.733333c-18.773333 0-34.133333-15.36-34.133333-34.133334V426.666667c0-18.773333 15.36-34.133333 34.133333-34.133334h648.533334c18.773333 0 34.133333 15.36 34.133333 34.133334v170.666666c0 18.773333-15.36 34.133333-34.133333 34.133334z" fill="#000000" p-id="9432"></path></svg>`
        );
        if (node !== undefined) {
            const { children, collapsed, pid, isLast } = node;

            ctx.save();

            if (children?.length) {
                // 父元素，绘制expand icon
                const startY = rect.y + (rect.height - size) / 2;

                spriteManager.drawSprite(
                    collapsed === true ? "expand" : "collapse",
                    "normal",
                    ctx,
                    start,
                    startY,
                    size,
                    theme
                );
            } else if (pid !== undefined) {
                // 子元素绘制刻度线
                ctx.fillStyle = "none";
                ctx.lineCap = "round";
                ctx.lineJoin = "round";
                ctx.lineWidth = 1.5;
                ctx.strokeStyle = theme.markLine;
                ctx.beginPath();
                const startX = x + theme.cellHorizontalPadding + size / 2;

                if (isLast === true) {
                    ctx.moveTo(startX, y);
                    ctx.lineTo(startX, y + height / 2);
                    ctx.lineTo(startX + 6, y + height / 2);
                } else {
                    ctx.moveTo(startX, y);
                    ctx.lineTo(startX, y + height);
                    ctx.moveTo(startX, y + height / 2);
                    ctx.lineTo(startX + 6, y + height / 2);
                }

                ctx.stroke();
            }

            ctx.restore();

            return true;
        }
    };

    const drawIcon = (content: string | ((node: any) => string) | undefined, start: number, size: number) => {
        const icon = typeof content === "string" ? content : content?.(node);

        if (icon !== undefined) {
            const iconSize = size;
            spriteManager.drawSprite(icon, "normal", ctx, start, y + (height - iconSize) / 2, iconSize, theme, 1);
            if (hoverAmount !== 0) {
                ctx.globalAlpha = 1;
            }
        }
    };

    let startX = x + theme.cellHorizontalPadding;
    const contentTotalWidth = functions.reduce((prev, next) => {
        const { type, size } = next;
        const itemWidth =
            type === "number" ? textWith : type === "checkbox" ? size ?? 20 : size ?? theme.markerIconSize;
        prev += itemWidth;
        return prev;
    }, 0);
    const padding = Math.floor(
        (rect.width - theme.cellHorizontalPadding * 2 - contentTotalWidth) / (functions.length - 1)
    );

    functions
        .sort((a, b) => a.order - b.order)
        // eslint-disable-next-line unicorn/no-array-for-each
        .forEach((fnItem, idx) => {
            const { spriteCbMap, type, size } = fnItem;
            if (spriteCbMap !== undefined) {
                // eslint-disable-next-line unicorn/no-array-for-each
                Object.keys(spriteCbMap).forEach(item => {
                    spriteManager.addAdditionalIcon(item, spriteCbMap[item]);
                });
            }

            const itemWidth =
                type === "number" ? textWith : type === "checkbox" ? size ?? 20 : size ?? theme.markerIconSize;

            if (functions.length === 1) {
                // 居中显示
                fnItem.start = rect.x + rect.width / 2;
                fnItem.end = fnItem.start + itemWidth;
            } else if (functions.length === 2 && functions.some(item => item.type === "number")) {
                // 数字居中，其余靠右显示
                if (type === "number") {
                    fnItem.start = rect.x + rect.width / 2;
                    fnItem.end = fnItem.start + textWith;
                } else {
                    fnItem.start = rect.width - theme.cellHorizontalPadding - itemWidth;
                    fnItem.end = fnItem.start + itemWidth;
                }
            } else if (functions.length === 3) {
                if (idx === functions.length - 1) {
                    fnItem.start = rect.x + rect.width - itemWidth - theme.cellHorizontalPadding;
                    fnItem.end = fnItem.start + itemWidth;
                } else if (type === "number") {
                    // 数字居中
                    fnItem.start = rect.x + rect.width / 2;
                    fnItem.end = fnItem.start + textWith;
                } else {
                    fnItem.start = startX;
                    fnItem.end = startX + itemWidth;
                }
            } else {
                // 平分区域
                // 索引数字长度很长时，如何处理？应该要设置一个最大宽度，设置为rect宽度的60%
                fnItem.start = startX;
                fnItem.end = startX + itemWidth;
                startX = fnItem.end + padding;
            }

            // eslint-disable-next-line unicorn/prefer-switch
            if (type === "number") {
                drawIndexNumber(fnItem.start);
            } else if (type === "checkbox") {
                // drawCheckbox();
            } else if (type === "expand") {
                drawExpand(fnItem.start, itemWidth);
            } else {
                drawIcon(fnItem.content, fnItem.start, itemWidth);
            }
        });
}
