import {
    type CustomCell,
    type CustomRenderer,
    GridCellKind,
    type Rectangle,
    drawTextCellInner,
    prepTextCell,
} from "@glideapps/glide-data-grid";

export type TreeNode = {
    pid?: string;
    id: string;
    name: string;
    depth?: number;
    collapsed?: boolean;
    children: TreeNode[];
    isLast?: boolean;
};

interface TreeCellProps {
    readonly kind: "tree-cell";
    readonly node: TreeNode;
    readonly key: keyof TreeNode;
    readonly iconSize?: number;
}

export type TreeCell = CustomCell<TreeCellProps>;

const renderer: CustomRenderer<TreeCell> = {
    kind: GridCellKind.Custom,
    isMatch: (cell: CustomCell): cell is TreeCell => (cell.data as any).kind === "tree-cell",
    drawPrep: prepTextCell,
    draw: (args, cell) => {
        const { ctx, rect, theme, spriteManager, hoverX, hoverY } = args;
        const { y, width, height } = rect;
        const { data } = cell;
        const { node, key, iconSize = theme.markerIconSize } = data;

        if (node !== undefined) {
            const { children, collapsed, depth, pid, isLast } = node;

            const depthOffset = (depth || 0) * 20;

            ctx.save();

            const start = rect.x + theme.cellHorizontalPadding;

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
            } else if (pid !== undefined) {
                // 子元素绘制刻度线
                ctx.fillStyle = "none";
                ctx.lineCap = "round";
                ctx.lineJoin = "round";
                ctx.lineWidth = 1.5;
                ctx.strokeStyle = theme.markLine;
                ctx.beginPath();
                const startX = start + iconSize / 2;

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

            const indent = depthOffset + 20;
            const indentRect: Rectangle = {
                ...rect,
                x: rect.x + indent,
                width: width - indent,
            };

            drawTextCellInner({ ...args, rect: indentRect }, `${node[key] ?? ""}`, cell.contentAlign);
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
