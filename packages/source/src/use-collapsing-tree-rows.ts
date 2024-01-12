import type { TreeNode } from "@glideapps/glide-data-grid-cells/src/cells/tree-cell";
import React from "react";

const names = ["Alfa", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot"];

const createNode = (name: string, children: TreeNode[] = []): TreeNode => ({
    id: name,
    name,
    children,
});

const flattenTree = (tree: TreeNode): TreeNode[] => {
    const _visit = (node: TreeNode, depth: number = 0) => {
        node.depth = depth;
        flattened.push(node);
        if (node.collapsed === true) return;
        node.children.forEach(child => {
            _visit(child, depth + 1);
        });
    };

    const flattened: TreeNode[] = [];

    _visit(tree);

    return flattened;
};

export function createSampleTree(): TreeNode {
    const root = createNode("Root");

    names.forEach((nameX, idx) => {
        const nodeX = createNode(nameX);
        nodeX.pid = root.id;
        nodeX.isLast = idx === names.length - 1;
        root.children.push(nodeX);
        names.forEach((nameY, subIdx) => {
            const nameXY = `${nameX} ${nameY}`;
            const nodeY = createNode(nameXY);
            nodeY.pid = nodeX.id;
            nodeY.isLast = subIdx === names.length - 1;
            nodeY.collapsed = true;
            nodeX.children.push(nodeY);
            names.forEach((nameZ, idz) => {
                const nameXYZ = `${nameX} ${nameY} ${nameZ}`;
                const nodeZ = createNode(nameXYZ);
                nodeZ.pid = nodeY.id;
                nodeZ.isLast = idz === names.length - 1;
                nodeY.children.push(nodeZ);
            });
        });
    });

    return root;
}

export function useCollapsingTreeRows(tree: TreeNode): TreeNode[] {
    return React.useMemo(() => flattenTree(tree), [tree]);
}
