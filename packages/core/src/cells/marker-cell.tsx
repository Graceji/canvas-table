import { getMiddleCenterBias, measureTextCached } from "../internal/data-grid/render/data-grid-lib.js";
import { InnerGridCellKind, type MarkerCell, type MarkerFn } from "../internal/data-grid/data-grid-types.js";
import type { BaseDrawArgs, DrawArgs, InternalCellRenderer, PrepResult } from "./cell-types.js";
import { drawCheckbox } from "../internal/data-grid/render/draw-checkbox.js";
import type { SpriteVariant } from "../index.js";

interface FullMarkerFn extends MarkerFn {
    start: number;
    end: number;
}

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

        if (cell.functions?.length === 0) return undefined;

        const meta = cell.meta;

        // 计算边界时应该按照每一项的盒子来计算
        const isOverHeaderMarkerfn = cell.functions.find(
            item => x >= (item as FullMarkerFn).start && x <= (item as FullMarkerFn).end && y >= 0 && y <= bounds.height
        );

        if (isOverHeaderMarkerfn !== undefined && isOverHeaderMarkerfn.type !== "number") {
            let disabled = isOverHeaderMarkerfn?.disabled;

            if (typeof isOverHeaderMarkerfn?.disabled === "function") {
                disabled = isOverHeaderMarkerfn?.disabled?.(meta?.node);
            }

            if (disabled !== true) {
                isOverHeaderMarkerfn?.onClick?.(meta?.node);
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
            item => x >= (item as FullMarkerFn).start && x <= (item as FullMarkerFn).end && y >= 0 && y <= bounds.height
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
    const { row: index, markerKind, functions, checked, drawHandle, checkboxStyle, meta } = cell;
    const { x, y, width, height } = rect;
    const text = index.toString();
    const markerFontStyle = theme.markerFontFull;
    const rectHoverX = rect.x + hoverX;
    const padding = theme.cellHorizontalPadding;

    const textWith = measureTextCached(text, ctx, markerFontStyle).width;

    const drawIndexNumber = (start: number, textWidth: number, color?: string, accentColor?: string) => {
        if (markerKind === "both" && hoverAmount !== 0) {
            // ctx.globalAlpha = 1 - hoverAmount;
        }
        ctx.fillStyle = highlighted ? (accentColor ?? theme.markerTextAccent) : (color ?? theme.markerTextLight);
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

    const drawExpand = (item: MarkerFn, iconSize: number) => {
        const { start } = item as FullMarkerFn;

        if (meta !== undefined) {
            const { canOpen, isExpanded, isLeaf, depth, isLast } = meta;
            // --- 绘制图标 (Expand/Collapse) ---
            if (canOpen === true) {
                // 计算鼠标是否悬停在图标上 (用于高亮或交互提示)
                let isIconHovered = false;
                if (
                    hoverX !== undefined &&
                    hoverX + rect.x > start &&
                    hoverX + rect.x <= start + iconSize &&
                    hoverY !== undefined &&
                    hoverY > theme.cellVerticalPadding &&
                    hoverY <= rect.height - theme.cellVerticalPadding
                ) {
                    isIconHovered = true;
                }

                const size = isIconHovered ? iconSize + 2 : iconSize;
                const startY = rect.y + (rect.height - size) / 2;

                ctx.save();
                spriteManager.drawSprite(
                    isExpanded === true ? "collapse" : "expand",
                    "normal",
                    ctx,
                    start,
                    startY,
                    size,
                    theme
                );
                ctx.restore();

                if (isIconHovered) {
                    args.overrideCursor?.("pointer");
                }
            } else if (depth !== undefined && depth > 0 && isLeaf === true) {
                // --- 绘制连接线  ---
                ctx.save();
                ctx.fillStyle = "none";
                ctx.lineCap = "round";
                ctx.lineJoin = "round";
                ctx.lineWidth = 1.5;
                ctx.strokeStyle = theme.markLine;
                ctx.beginPath();

                // 调整线的位置
                const lineX = start + iconSize / 2;

                // 绘制 L 型线
                ctx.moveTo(lineX, y);
                if (isLast === true) {
                    ctx.lineTo(lineX, y + height / 2); // 到底部中间
                } else {
                    ctx.lineTo(lineX, y + height); // 到底部
                }
                // 横向短线
                ctx.moveTo(lineX, y + height / 2);
                ctx.lineTo(lineX + 6, y + height / 2);

                ctx.stroke();
                ctx.restore();
            }
        }
    };

    const drawIcon = (item: MarkerFn, totalWidth: number, size: number, disabled?: boolean) => {
        const { content, start, end, color, hoverColor, selectedColor, selected } = item as FullMarkerFn;
        const icon = typeof content === "string" ? content : content?.(meta?.node);

        let isHovered = false;
        if (
            hoverX !== undefined &&
            hoverX > start &&
            hoverX <= end &&
            hoverY !== undefined &&
            hoverY > 0 &&
            hoverY <= rect.height
        ) {
            isHovered = true;
        }

        let variant = "normal" as SpriteVariant;

        if (disabled === true) {
            variant = isHovered ? "disableHovered" : "disabled";
        } else if ((typeof selected === "boolean" ? selected === true : selected?.(meta?.node)) ?? false) {
            variant = "selected";
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
                typeof color === "string" ? color : color?.(meta?.node),
                undefined,
                typeof hoverColor === "string" ? hoverColor : hoverColor?.(meta?.node),
                undefined,
                typeof selectedColor === "string"
                    ? selectedColor
                    : typeof color === "string"
                      ? color
                      : color?.(meta?.node, "selected")
            );
            if (hoverAmount !== 0) {
                ctx.globalAlpha = 1;
            }
        }
    };

    if (functions?.length) {
        const visibleFunctions = functions.filter(fn => {
            if (fn.visible === undefined) return true;
            if (typeof fn.visible === "function") {
                return fn.visible(meta?.node);
            }
            return fn.visible;
        });

        // 如果所有功能都不可见，直接返回
        if (visibleFunctions.length === 0) {
            return;
        }

        let startX = x + padding;

        const perWidth = (rect.width - padding * 2) / functions.length;

        visibleFunctions
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
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
                    type === "number"
                        ? textWith
                        : type === "checkbox"
                          ? (size ?? theme.checkboxMaxSize)
                          : (size ?? theme.markerIconSize);

                if (visibleFunctions.length === 1) {
                    // 居中显示
                    (fnItem as FullMarkerFn).start = rect.x + (rect.width - itemWidth) / 2;
                    (fnItem as FullMarkerFn).end = (fnItem as FullMarkerFn).start + itemWidth;
                } else {
                    (fnItem as FullMarkerFn).start = startX;
                    (fnItem as FullMarkerFn).end = startX + perWidth;

                    startX = (fnItem as FullMarkerFn).end;
                }

                const disabled =
                    fnItem.disabled === true ||
                    (typeof fnItem.disabled === "function" && fnItem.disabled?.(meta?.node) === true);

                // 找出鼠标悬浮的项，修正鼠标悬浮样式
                const isHovered =
                    rectHoverX > (fnItem as FullMarkerFn).start && rectHoverX <= (fnItem as FullMarkerFn).end;

                if (isHovered) {
                    if (fnItem.type === "number") {
                        args.overrideCursor?.("default");
                    } else if (disabled) {
                        args.overrideCursor?.("not-allowed");
                    }
                }

                // eslint-disable-next-line unicorn/prefer-switch
                if (type === "number") {
                    drawIndexNumber(
                        (fnItem as FullMarkerFn).start,
                        perWidth,
                        typeof fnItem.color === "string" ? fnItem.color : fnItem.color?.(meta?.node),
                        typeof fnItem.hoverColor === "string" ? fnItem.hoverColor : fnItem.hoverColor?.(meta?.node)
                    );
                } else if (type === "checkbox") {
                    const offsetAmount = 7 * (checked ? hoverAmount : 1);
                    drawCheckbox(
                        ctx,
                        theme,
                        checked,
                        drawHandle ? (fnItem as FullMarkerFn).start + offsetAmount : (fnItem as FullMarkerFn).start,
                        y,
                        drawHandle ? width - offsetAmount : width,
                        height,
                        false, // 源码为true
                        hoverX,
                        hoverY,
                        theme.checkboxMaxSize,
                        "left", // 源码为center
                        checkboxStyle
                    );
                } else if (type === "expand") {
                    drawExpand(fnItem, itemWidth);
                } else {
                    drawIcon(fnItem, perWidth, itemWidth, disabled);
                }
            });
    } else {
        const start = x + (width - textWith) / 2;

        drawIndexNumber(start, textWith);
    }
}
