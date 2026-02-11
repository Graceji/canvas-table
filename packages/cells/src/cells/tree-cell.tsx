import {
    type CustomCell,
    type CustomRenderer,
    GridCellKind,
    type Item,
    type Rectangle,
    drawTextCellInner,
    getMiddleCenterBias,
    measureTextCached,
    prepTextCell,
} from "@glideapps/glide-data-grid";

interface TreeCellData {
    kind: "tree-cell";
    /** 显示的文本 */
    readonly label: string;
    /** 树深度 (0, 1, 2...) */
    readonly depth: number;
    /** 是否展开 */
    readonly isExpanded: boolean;
    /** 是否是该层级的最后一个节点 (决定是否绘制 L 型连接线，可选) */
    readonly isLastChild?: boolean;
    /** * 只有当显示连接线时才需要知道父级是否有后续节点
     * 如果你不画连接线，这个可以去掉，性能更好
     */
    readonly parentHasNext?: boolean;

    readonly isLeaf?: boolean;

    // --- 样式配置 ---
    readonly iconSize?: number;
    readonly delimiter?: string;
    readonly style?: {
        colors?: string[];
        span?: number | number[];
        padding?: number;
        width?: number[];
    };

    readonly rowKey: string | number;
    readonly canOpen: boolean;
    readonly onClickOpener?: (cell: TreeCell, location: Item) => TreeCell | undefined;
}

export type TreeCell = CustomCell<TreeCellData>;

const depthShift = 20; // 常量提取

const renderer: CustomRenderer<TreeCell> = {
    kind: GridCellKind.Custom,
    isMatch: (cell: CustomCell): cell is TreeCell => (cell.data as any).kind === "tree-cell",
    drawPrep: prepTextCell,
    draw: (args, cell) => {
        const { ctx, rect, theme, spriteManager, hoverX, hoverY, highlighted } = args;
        const { y, width, height } = rect;

        const {
            canOpen,
            label,
            depth,
            isExpanded,
            isLastChild,
            isLeaf,
            iconSize = theme.markerIconSize,
            delimiter,
            style,
        } = cell.data;

        const depthOffset = depth * depthShift;
        const start = rect.x + theme.cellHorizontalPadding / 2 + depthOffset;

        // --- 绘制图标 (Expand/Collapse) ---
        if (canOpen) {
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
            spriteManager.drawSprite(isExpanded ? "collapse" : "expand", "normal", ctx, start, startY, size, theme);
            ctx.restore();

            if (isIconHovered) {
                args.overrideCursor?.("pointer");
            }
        } else if (depth > 0 && isLeaf) {
            // --- 绘制连接线  ---
            ctx.save();
            ctx.fillStyle = "none";
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = theme.markLine;
            ctx.beginPath();

            // 调整线的位置
            const lineX = start + iconSize / 2 - depthShift;

            // 绘制 L 型线
            ctx.moveTo(lineX, y);
            if (isLastChild) {
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

        // --- 绘制文本 ---
        const textIndent = depthOffset + (isLeaf === true ? 0 : 20); // 如果没有子节点，额外缩进一格，或者对齐

        // 性能优化：如果没有 delimiter，直接走原生绘制，性能最高
        if (delimiter === undefined) {
            const indentRect: Rectangle = {
                ...rect,
                x: rect.x + textIndent,
                width: Math.max(0, width - textIndent), // 防止负宽
            };
            drawTextCellInner({ ...args, rect: indentRect }, label, cell.contentAlign);
            return true;
        }

        // --- 复杂文本绘制 (Delimiter) ---
        const splitContents = label.split(delimiter);
        const splitLength = splitContents.length;
        if (splitLength === 0) return true;

        const cellContentWidth = Math.max(0, width - textIndent);
        let startX = rect.x + textIndent;
        let totalWidth = 0;
        const bias = getMiddleCenterBias(ctx, theme);
        const centerY = y + height / 2 + bias;

        for (let i = 0; i < splitLength; i++) {
            const content = splitContents[i];
            // 缓存测量结果
            const textWidth = style?.width?.[i] ?? measureTextCached(content, ctx).width;

            // 裁剪检查：如果超出单元格宽度，停止绘制
            if (totalWidth > cellContentWidth) break;

            const drawWidth = Math.min(textWidth, cellContentWidth - totalWidth);

            if (style?.colors !== undefined && style?.colors?.length > 0) {
                const colorsLength = style.colors.length;
                // 外部传递颜色
                if (splitLength !== colorsLength) {
                    // 分割数与指定colors长度不一致，默认取前一个
                    ctx.fillStyle = i + 1 > colorsLength ? style.colors[i - 1] : style.colors[i];
                } else {
                    ctx.fillStyle = style.colors[i];
                }
            } else {
                ctx.fillStyle = highlighted ? theme.textDarkAccent : theme.textDark;
            }

            // if (style?.colors?.[i]) {
            //   ctx.fillStyle = style.colors[i];
            // } else {
            //   ctx.fillStyle = highlighted ? theme.textDarkAccent : theme.textDark;
            // }

            // 简化对齐逻辑，Tree通常靠左，如果需要 Right/Center 需额外计算
            ctx.fillText(content, startX + theme.cellHorizontalPadding, centerY);

            const padding = style?.padding ?? 4;
            startX += drawWidth + padding;
            totalWidth += drawWidth + padding;
        }

        return true;
    },

    onClick: ({ cell, posX, location }) => {
        const { depth, canOpen, onClickOpener } = cell.data;

        const depthOffset = (depth || 0) * depthShift;

        if (!canOpen || onClickOpener === undefined) return;

        if (posX < depthOffset || posX > depthOffset + 22) return undefined;

        return onClickOpener(cell, location);
    },

    // 防止点击 Icon 时触发选中拖拽
    onSelect: args => {
        const { cell, posX } = args;
        const { depth } = cell.data;
        const depthOffset = depth * depthShift;

        if (posX < depthOffset || posX > depthOffset + 22) {
            args.preventDefault(false);
        } else {
            args.preventDefault();
        }
    },
};

export default renderer;
