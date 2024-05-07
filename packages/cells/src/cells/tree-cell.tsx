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
    readonly key: keyof TreeNode;
    readonly iconSize?: number;
}

export type TreeCell = CustomCell<TreeCellProps>;

const renderer: CustomRenderer<TreeCell> = {
    kind: GridCellKind.Custom,
    isMatch: (cell: CustomCell): cell is TreeCell => (cell.data as any).kind === "tree-cell",
    draw: (args, cell) => {
        const { ctx, rect, theme, spriteManager } = args;
        const { y, width, height } = rect;
        const { data } = cell;
        const { node, key, iconSize = theme.markerIconSize } = data;

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
            const { children, collapsed, depth, pid, isLast } = node;

            const depthOffset = (depth || 0) * 20;

            ctx.save();

            const start = rect.x + theme.cellHorizontalPadding;

            if (children?.length) {
                // 父元素，绘制expand icon
                const startY = rect.y + (rect.height - iconSize) / 2;
                spriteManager.drawSprite(
                    collapsed === true ? "expand" : "collapse",
                    "normal",
                    ctx,
                    start,
                    startY,
                    iconSize,
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

            drawTextCell({ ...args, rect: indentRect }, `${node[key] ?? ""}`, cell.contentAlign);
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
