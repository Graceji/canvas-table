import {
    type CustomCell,
    type CustomRenderer,
    GridCellKind,
    type Rectangle,
    drawTextCell,
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
}

export type TreeCell = CustomCell<TreeCellProps>;

const renderer: CustomRenderer<TreeCell> = {
    kind: GridCellKind.Custom,
    isMatch: (cell: CustomCell): cell is TreeCell => (cell.data as any).kind === "tree-cell",
    draw: (args, cell) => {
        const { ctx, rect, theme } = args;
        const { x, y, width, height } = rect;
        const { data } = cell;
        const { node } = data;
        const { children, collapsed, depth, name } = node;

        const depthOffset = (depth || 0) * 20;

        ctx.save();

        if (children?.length) {
            ctx.fillStyle = "none";
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = theme.textDark;
            ctx.beginPath();
            if (collapsed) {
                ctx.moveTo(x + depthOffset + 8, y + height / 2 - 4);
                ctx.lineTo(x + depthOffset + 8, y + height / 2 + 4);
                ctx.lineTo(x + depthOffset + 14, y + height / 2);
            } else {
                ctx.moveTo(x + depthOffset + 15, y + height / 2 - 3);
                ctx.lineTo(x + depthOffset + 7, y + height / 2 - 3);
                ctx.lineTo(x + depthOffset + 11, y + height / 2 + 3);
            }
            ctx.closePath();
            ctx.stroke();
        }

        ctx.restore();

        const indent = depthOffset + 20;
        const indentRect: Rectangle = {
            ...rect,
            x: rect.x + indent,
            width: width - indent,
        };

        drawTextCell({ ...args, rect: indentRect }, name, cell.contentAlign);

        return true;
    },
    onClick: ({ cell, posX, preventDefault }) => {
        const { node } = cell.data;
        const { depth } = node;

        const depthOffset = (depth || 0) * 20;

        if (posX < depthOffset || posX > depthOffset + 22) return;

        preventDefault();

        node.collapsed = !node.collapsed;

        return cell;
    },
    provideEditor: undefined,
};

export default renderer;
