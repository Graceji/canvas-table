import { getMiddleCenterBias, measureTextCached } from "../internal/data-grid/render/data-grid-lib.js";
import { InnerGridCellKind, type MarkerCell, type MarkerFn } from "../internal/data-grid/data-grid-types.js";
import type { BaseDrawArgs, DrawArgs, InternalCellRenderer, PrepResult } from "./cell-types.js";
import { drawCheckbox } from "../internal/data-grid/render/draw-checkbox.js";
import type { SpriteVariant } from "../index.js";

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
        const isOverHeaderMarkerfn = cell.functions?.find?.(
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
    onSelect: args => {
        const { cell, posX: x, posY: y, bounds } = args;

        // 计算边界时应该按照每一项的盒子来计算
        const isOverHeaderMarkerfn = cell.functions?.find?.(
            item => x >= item.start && x <= item.end && y >= 0 && y <= bounds.height
        );

        if (isOverHeaderMarkerfn && isOverHeaderMarkerfn.type !== "number") {
            args.preventDefault(isOverHeaderMarkerfn.type === "checkbox" ? false : true);
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
    const { ctx, rect, hoverAmount, theme, spriteManager, hoverX = -100, highlighted, hoverY } = args;
    const { row: index, markerKind, node, functions, checked, drawHandle, checkboxStyle } = cell;
    const { x, y, width, height } = rect;
    const text = index.toString();
    const markerFontStyle = theme.markerFontFull;
    const rectHoverX = rect.x + hoverX;
    const padding = theme.cellHorizontalPadding;

    const textWith = measureTextCached(text, ctx, markerFontStyle).width;

    const drawIndexNumber = (start: number, textWidth: number) => {
        if (markerKind === "both" && hoverAmount !== 0) {
            // ctx.globalAlpha = 1 - hoverAmount;
        }
        ctx.fillStyle = highlighted ? theme.markerTextAccent : theme.markerTextLight;
        ctx.font = `${hoverAmount > 0 ? "bold " + markerFontStyle : markerFontStyle}`;
        ctx.fillText(
            text,
            start + textWidth / 2,
            y + height / 2 + getMiddleCenterBias(ctx, markerFontStyle),
            textWidth
        );

        if (hoverAmount !== 0) {
            ctx.globalAlpha = 1;
        }
    };

    const drawExpand = (start: number, size: number) => {
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
                const startX = start + size / 2;

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

    const drawIcon = (item: MarkerFn, totalWidth: number, size: number, disabled?: boolean) => {
        const { content, start, color, hoverColor } = item;
        const icon = typeof content === "string" ? content : content?.(node);

        let isHovered = false;
        if (
            hoverX !== undefined &&
            hoverX > item.start &&
            hoverX <= item.end &&
            hoverY !== undefined &&
            hoverY > 0 &&
            hoverY <= rect.height
        ) {
            isHovered = true;
        }

        let variant = "normal" as SpriteVariant;

        if (disabled === true) {
            variant = isHovered ? "disableHovered" : "disabled";
        } else if (isHovered) {
            variant = isHovered ? "hovered" : "normal";
        }

        if (icon !== undefined) {
            const iconSize = isHovered && item.hoverEffect === true ? size + 2 : size;
            spriteManager.drawSprite(
                icon,
                variant,
                ctx,
                start + (totalWidth - iconSize) / 2,
                y + (height - iconSize) / 2,
                iconSize,
                theme,
                1,
                iconSize,
                color,
                undefined,
                hoverColor
            );
            if (hoverAmount !== 0) {
                ctx.globalAlpha = 1;
            }
        }
    };

    if (functions?.length) {
        let startX = x + padding;
        const perWidth = (rect.width - padding * 2) / functions.length;

        functions
            .sort((a, b) => a.order - b.order)
            // eslint-disable-next-line unicorn/no-array-for-each
            .forEach(fnItem => {
                const { spriteCbMap, type, size } = fnItem;
                if (spriteCbMap !== undefined) {
                    // eslint-disable-next-line unicorn/no-array-for-each
                    Object.keys(spriteCbMap).forEach(item => {
                        spriteManager.addAdditionalIcon(item, spriteCbMap[item]);
                    });
                }

                const itemWidth =
                    type === "number" ? textWith : type === "checkbox" ? size ?? 18 : size ?? theme.markerIconSize;

                if (functions.length === 1) {
                    // 居中显示
                    fnItem.start = rect.x + (rect.width - itemWidth) / 2;
                    fnItem.end = fnItem.start + itemWidth;
                } else {
                    fnItem.start = startX;
                    fnItem.end = startX + perWidth;

                    startX = fnItem.end;
                }

                const disabled =
                    fnItem.disabled === true ||
                    (typeof fnItem.disabled === "function" && fnItem.disabled?.(node) === true);

                // 找出鼠标悬浮的项，修正鼠标悬浮样式
                const isHovered = rectHoverX > fnItem.start && rectHoverX <= fnItem.end;

                if (isHovered) {
                    if (fnItem.type === "number") {
                        args.overrideCursor?.("default");
                    } else if (disabled) {
                        args.overrideCursor?.("not-allowed");
                    }
                }

                // eslint-disable-next-line unicorn/prefer-switch
                if (type === "number") {
                    drawIndexNumber(fnItem.start, perWidth);
                } else if (type === "checkbox") {
                    const offsetAmount = 7 * (checked ? hoverAmount : 1);
                    drawCheckbox(
                        ctx,
                        theme,
                        checked,
                        drawHandle ? fnItem.start + offsetAmount : fnItem.start,
                        y,
                        drawHandle ? width - offsetAmount : width,
                        height,
                        false,
                        hoverX,
                        hoverY,
                        18,
                        "left",
                        checkboxStyle
                    );
                } else if (type === "expand") {
                    drawExpand(fnItem.start, itemWidth);
                } else {
                    drawIcon(fnItem, perWidth, itemWidth, disabled);
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
            const start = x + (width - textWith) / 2;

            drawIndexNumber(start, textWith);
        }
    }
}
