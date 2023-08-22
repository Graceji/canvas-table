import {
    type CustomCell,
    type CustomRenderer,
    GridCellKind,
    type Rectangle,
    drawTextCellInner,
    prepTextCell,
    measureTextCached,
    getMiddleCenterBias,
} from "@glideapps/glide-data-grid";

export type TreeNode = {
    pid?: string;
    id: string;
    name: string;
    depth?: number;
    collapsed?: boolean;
    children: TreeNode[];
    isLast?: boolean;
    isLeaf?: boolean;
};

interface TreeCellProps {
    readonly kind: "tree-cell";
    readonly node: TreeNode;
    readonly key: keyof TreeNode;
    readonly iconSize?: number;
    readonly delimiter?: string;
    /**
     * 文本分割样式信息
     * colors - 颜色分组
     * span - 分割的列数 12栅格
     *
     * @type {({ colors?: string[]; span?: number | number[] })}
     * @memberof TreeCellProps
     */
    readonly style?: { colors?: string[]; span?: number | number[]; padding?: number; width?: number[] };
}

export type TreeCell = CustomCell<TreeCellProps>;

const renderer: CustomRenderer<TreeCell> = {
    kind: GridCellKind.Custom,
    isMatch: (cell: CustomCell): cell is TreeCell => (cell.data as any).kind === "tree-cell",
    drawPrep: prepTextCell,
    draw: (args, cell) => {
        const { ctx, rect, theme, spriteManager, hoverX, hoverY, highlighted } = args;
        const { y, width, height } = rect;
        const { data } = cell;
        const { node, key, iconSize = theme.markerIconSize, delimiter, style } = data;

        if (node !== undefined) {
            const { children, collapsed, depth, pid, isLast } = node;

            const depthOffset = (depth || 0) * 20;

            ctx.save();

            const start = rect.x + theme.cellHorizontalPadding / 2 + depthOffset;

            let isHovered = false;
            if (
                hoverX !== undefined &&
                hoverX + rect.x > start &&
                hoverX + rect.x <= start + iconSize &&
                hoverY !== undefined &&
                hoverY > theme.cellVerticalPadding &&
                hoverY <= rect.height - theme.cellVerticalPadding
            ) {
                isHovered = true;
            }

            const size = isHovered ? iconSize + 2 : iconSize;

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
                if (isHovered) {
                    args.overrideCursor?.("pointer");
                }
            } else if (pid !== undefined && node.isLeaf) {
                // 需考虑兄弟节点是树形结构的情况
                // 子元素绘制刻度线
                ctx.fillStyle = "none";
                ctx.lineCap = "round";
                ctx.lineJoin = "round";
                ctx.lineWidth = 1.5;
                ctx.strokeStyle = theme.markLine;
                ctx.beginPath();
                const startX = start + iconSize / 2 - 20;

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

            const indent = depthOffset + (node.isLeaf === true ? 0 : 20);

            if (delimiter !== undefined) {
                // 需分割绘制
                const splitContents = `${node[key] ?? ""}`.split(delimiter);
                if (splitContents.length) {
                    // const fontStyle = theme.baseFontFull;
                    // const fontSize = extractFontSizeNumber(fontStyle) ?? 13;

                    const cellContentWidth = width - indent;

                    // let newWidth = new Array(splitContents.length).fill(
                    //     Math.round(cellContentWidth / splitContents.length)
                    // );
                    // if (style !== undefined) {
                    //     if (Array.isArray(style.span)) {
                    //         newWidth = style.span.map(item => Math.round(cellContentWidth * (item / 12)));
                    //     } else if (typeof style?.span === "number") {
                    //         newWidth = new Array(splitContents.length).fill(
                    //             Math.round(cellContentWidth * (style.span / 12))
                    //         );
                    //     } else if (Array.isArray(style.width)) {
                    //         newWidth = style.width;
                    //     } else if (typeof style?.width === "number") {
                    //         newWidth = new Array(splitContents.length).fill(style.width);
                    //     }
                    // }

                    let startX = rect.x + indent;
                    let totalWidth = 0;
                    for (let i = 0; i < splitContents.length; i++) {
                        const content = splitContents[i];
                        const textWidth = style?.width?.[i] ?? measureTextCached(content, ctx).width;

                        const newRect = {
                            ...rect,
                            x: startX,
                            width: totalWidth <= cellContentWidth ? textWidth : cellContentWidth - totalWidth,
                        };

                        if (style !== undefined && Array.isArray(style?.colors)) {
                            ctx.fillStyle =
                                style.colors[i] ?? (highlighted === true ? theme.textDarkAccent : theme.textDark);
                        }
                        const { height: h, width: w, x } = newRect;
                        const bias = getMiddleCenterBias(ctx, theme);
                        if (cell.contentAlign === "right") {
                            ctx.fillText(content, x + w - (theme.cellHorizontalPadding + 0.5), y + h / 2 + bias);
                        } else if (cell.contentAlign === "center") {
                            ctx.fillText(content, x + w / 2, y + h / 2 + bias);
                        } else {
                            ctx.fillText(content, x + theme.cellHorizontalPadding + 0.5, y + h / 2 + bias);
                        }
                        startX = startX + w + (style?.padding ?? 4);
                        totalWidth += textWidth;
                    }
                }
            } else {
                const indentRect: Rectangle = {
                    ...rect,
                    x: rect.x + indent,
                    width: width - indent,
                };
                drawTextCellInner({ ...args, rect: indentRect }, `${node[key] ?? ""}`, cell.contentAlign);
            }
        }

        return true;
    },
    onClick: ({ cell, posX, preventDefault }) => {
        const { node } = cell.data;
        const { depth } = node;

        const depthOffset = (depth || 0) * 20;

        if (posX < depthOffset || posX > depthOffset + 22) return undefined;

        preventDefault();

        node.collapsed = !node.collapsed;

        return cell;
    },
    provideEditor: undefined,
    onSelect: args => {
        const { cell, posX } = args;
        const { node } = cell.data;
        const { depth } = node;

        const depthOffset = (depth || 0) * 20;

        if (posX < depthOffset || posX > depthOffset + 22) {
            args.preventDefault(false);
        } else {
            args.preventDefault();
        }
    },
};

export default renderer;
