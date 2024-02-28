import { getMiddleCenterBias, measureTextCached } from "../internal/data-grid/render/data-grid-lib.js";
import { InnerGridCellKind, type MarkerCell, type MarkerFn } from "../internal/data-grid/data-grid-types.js";
import type { BaseDrawArgs, DrawArgs, InternalCellRenderer, PrepResult } from "./cell-types.js";

export const markerCellRenderer: InternalCellRenderer<MarkerCell> = {
    getAccessibilityString: c => c.row.toString(),
    kind: InnerGridCellKind.Marker,
    needsHover: true,
    needsHoverPosition: true,
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
                let disabled = isOverHeaderMarkerfn?.disabled;

                if (typeof isOverHeaderMarkerfn?.disabled === "function") {
                    disabled = isOverHeaderMarkerfn?.disabled?.(cell.node);
                }

                if (disabled !== true) {
                    isOverHeaderMarkerfn?.onClick?.(cell.node);
                }
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

function drawMarkerRowCell(args: DrawArgs<MarkerCell>, cell: MarkerCell) {
    const { ctx, rect, hoverAmount, theme, spriteManager, hoverX = -100, highlighted } = args;
    const { row: index, markerKind, node, functions, checked, drawHandle } = cell;
    const { x, y, width, height } = rect;
    const text = index.toString();
    const markerFontStyle = theme.markerFontFull;
    const rectHoverX = rect.x + hoverX;

    const textWith = measureTextCached(text, ctx, markerFontStyle).width;

    const drawIndexNumber = (start: number) => {
        if (markerKind === "both" && hoverAmount !== 0) {
            // ctx.globalAlpha = 1 - hoverAmount;
        }
        ctx.fillStyle = highlighted ? theme.markerTextAccent : theme.markerTextLight;
        ctx.font = markerFontStyle;
        ctx.fillText(text, start, y + height / 2 + getMiddleCenterBias(ctx, markerFontStyle));

        if (hoverAmount !== 0) {
            ctx.globalAlpha = 1;
        }
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

    const drawIcon = (item: MarkerFn, size: number, disabled?: boolean) => {
        const { content, start, color } = item;
        const icon = typeof content === "string" ? content : content?.(node);

        const variant = disabled === true ? "disabled" : "normal";

        if (icon !== undefined) {
            const iconSize = size;
            spriteManager.drawSprite(
                icon,
                variant,
                ctx,
                start,
                y + (height - iconSize) / 2,
                iconSize,
                theme,
                1,
                iconSize,
                color
            );
            if (hoverAmount !== 0) {
                ctx.globalAlpha = 1;
            }
        }
    };

    if (functions?.length) {
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

                const disabled =
                    fnItem.disabled === true ||
                    (typeof fnItem.disabled === "function" && fnItem.disabled?.(node) === true);

                // eslint-disable-next-line unicorn/prefer-switch
                if (type === "number") {
                    drawIndexNumber(fnItem.start);
                } else if (type === "checkbox") {
                    // drawCheckbox();
                } else if (type === "expand") {
                    drawExpand(fnItem.start, itemWidth);
                } else {
                    drawIcon(fnItem, itemWidth, disabled);
                }

                // 找出鼠标悬浮的项，修正鼠标悬浮样式
                const isHovered = rectHoverX > fnItem.start && rectHoverX <= fnItem.end;

                if (isHovered) {
                    if (fnItem.type === "number") {
                        args.overrideCursor?.("default");
                    } else if (disabled) {
                        args.overrideCursor?.("not-allowed");
                    }
                }
            });
    } else {
        const checkedboxAlpha = checked ? 1 : markerKind === "checkbox-visible" ? 0.6 + 0.4 * hoverAmount : hoverAmount;
        if (markerKind !== "number" && checkedboxAlpha > 0) {
            ctx.globalAlpha = checkedboxAlpha;
            // const offsetAmount = 7 * (checked ? hoverAmount : 1);
            // drawCheckbox(
            //     ctx,
            //     theme,
            //     checked,
            //     drawHandle ? x + offsetAmount : x,
            //     y,
            //     drawHandle ? width - offsetAmount : width,
            //     height,
            //     true,
            //     undefined,
            //     undefined,
            //     18,
            //     "center",
            //     style
            // );
            if (drawHandle) {
                ctx.globalAlpha = hoverAmount;
                ctx.beginPath();
                for (const xOffset of [3, 6]) {
                    for (const yOffset of [-5, -1, 3]) {
                        ctx.rect(x + xOffset, y + height / 2 + yOffset, 2, 2);
                    }
                }

                ctx.fillStyle = theme.textLight;
                ctx.fill();
                ctx.beginPath();
            }
            ctx.globalAlpha = 1;
        }
        if (markerKind === "number" || (markerKind === "both" && !checked)) {
            const start = x + width / 2;

            drawIndexNumber(start);
        }
    }
}
