import React from "react";
import { DataEditorAll as DataEditor, type DataEditorAllProps } from "../../data-editor-all.js";
import {
    BeautifulWrapper,
    Description,
    PropName,
    useMockDataGenerator,
    defaultProps,
} from "../../data-editor/stories/utils.js";
import { SimpleThemeWrapper } from "../../stories/story-utils.js";
import { GridCellKind, type Item, type DrawCellCallback } from "../../internal/data-grid/data-grid-types.js";
import { type RowGroupingOptions } from "../../data-editor/row-grouping.js";
import { useRowGrouping } from "../../data-editor/row-grouping-api.js";
import _ from "lodash";

export default {
    title: "Glide-Data-Grid/DataEditor Demos",

    decorators: [
        (Story: React.ComponentType) => (
            <SimpleThemeWrapper>
                <BeautifulWrapper
                    title="Row Grouping"
                    description={
                        <Description>
                            The <PropName>rowGrouping</PropName> prop can be used to group and even fold rows.
                        </Description>
                    }>
                    <Story />
                </BeautifulWrapper>
            </SimpleThemeWrapper>
        ),
    ],
};

export const RowGrouping: React.VFC<any> = (p: { freezeColumns: number }) => {
    const { cols, getCellContent } = useMockDataGenerator(100);
    const rows = 100_000;

    const [rowGrouping, setRowGrouping] = React.useState<RowGroupingOptions>(() => ({
        groups: [
            {
                headerIndex: 10,
                isCollapsed: true,
                subGroups: [
                    {
                        headerIndex: 15,
                        isCollapsed: false,
                    },
                    {
                        headerIndex: 20,
                        isCollapsed: false,
                    },
                ],
            },
            {
                headerIndex: 30,
                isCollapsed: false,
            },
            ...Array.from({ length: 100 }, (_value, i): RowGroupingOptions["groups"][number] => {
                return {
                    headerIndex: (rows / 100) * i,
                    isCollapsed: false,
                };
            }),
        ],
        height: 55,
        navigationBehavior: "block",
        selectionBehavior: "block-spanning",
        themeOverride: {
            bgCell: "rgba(0, 100, 255, 0.1)",
        },
    }));

    const { mapper, getRowGroupingForPath, updateRowGroupingByPath } = useRowGrouping(rowGrouping, rows);

    const onCellClicked = React.useCallback(
        (item: Item) => {
            const { path, isGroupHeader } = mapper(item);

            if (isGroupHeader && item[0] === 0) {
                const group = getRowGroupingForPath(rowGrouping.groups, path);

                setRowGrouping(prev => {
                    const result: RowGroupingOptions = {
                        ...prev,
                        groups: updateRowGroupingByPath(prev.groups, path, { isCollapsed: !group.isCollapsed }),
                    };

                    return result;
                });
            }
        },
        [getRowGroupingForPath, mapper, rowGrouping.groups, updateRowGroupingByPath]
    );

    const getCellContentMangled = React.useCallback<DataEditorAllProps["getCellContent"]>(
        item => {
            const { path, isGroupHeader, originalIndex } = mapper(item);
            if (item[0] === 0) {
                return {
                    kind: GridCellKind.Text,
                    data: `Row ${JSON.stringify(path)}`,
                    displayData: `Row ${JSON.stringify(path)}`,
                    allowOverlay: false,
                };
            } else if (isGroupHeader) {
                return {
                    kind: GridCellKind.Loading,
                    allowOverlay: false,
                    // span: [1, cols.length - 1],
                };
            }

            return getCellContent(originalIndex);
        },
        [getCellContent, mapper]
    );

    return (
        <DataEditor
            {...defaultProps}
            rowGrouping={rowGrouping}
            height="100%"
            rowMarkers="both"
            freezeColumns={p.freezeColumns}
            getRowThemeOverride={(_row, groupRow, _contentRow) => {
                if (groupRow % 2 === 0) {
                    return {
                        bgCell: "rgba(0, 0, 0, 0.1)",
                    };
                }
                return undefined;
            }}
            onCellClicked={onCellClicked}
            getCellContent={getCellContentMangled}
            columns={cols}
            // verticalBorder={false}
            rows={rows}
        />
    );
};

// ---------------------------------------------------------------------------
// RowSpan story: row-grouping + drawCell 实现纵向跨行合并效果，支持动态新增行
// ---------------------------------------------------------------------------

// 模拟数据结构：每个大组内有若干子组，每个子组有若干数据行
interface SubGroup {
    name: string; // 子组名称，如"权益组合A1"
    rows: string[]; // 子组内的数据行，如["分仓1","分仓2","分仓3"]
}

interface Group {
    name: string; // 大组名称，如"资管行业配置"
    subGroups: SubGroup[];
}

const INITIAL_GROUPS: Group[] = [
    {
        name: "资管行业配置",
        subGroups: [
            { name: "权益组合A1", rows: ["分仓1", "分仓2", "分仓3"] },
            { name: "权益组合A2", rows: ["分仓4", "分仓5"] },
        ],
    },
    {
        name: "固收行业配置",
        subGroups: [
            { name: "债券组合B1", rows: ["分仓6", "分仓7"] },
            { name: "债券组合B2", rows: ["分仓8", "分仓9", "分仓10"] },
        ],
    },
];

// 将数据展开为扁平行列表，每行记录其所属 group/subGroup 索引和在各自组内的偏移
interface FlatRow {
    groupIndex: number;
    subGroupIndex: number;
    rowInSubGroup: number; // 在子组内的第几行（0-based）
    rowInGroup: number; // 在大组内的第几行（0-based）
    subGroupSize: number; // 子组共有几行
    groupSize: number; // 大组共有几行
    groupName: string;
    subGroupName: string;
    dataLabel: string;
    /** 是否是子组最后一行（用于绘制"+"按钮） */
    isLastInSubGroup: boolean;
}

function buildFlatRows(groups: Group[]): FlatRow[] {
    const result: FlatRow[] = [];
    for (const [gi, g] of groups.entries()) {
        const groupSize = g.subGroups.reduce((s, sg) => s + sg.rows.length, 0);
        let rowInGroup = 0;
        for (const [si, sg] of g.subGroups.entries()) {
            for (const [ri, dataLabel] of sg.rows.entries()) {
                result.push({
                    groupIndex: gi,
                    subGroupIndex: si,
                    rowInSubGroup: ri,
                    rowInGroup,
                    subGroupSize: sg.rows.length,
                    groupSize,
                    groupName: g.name,
                    subGroupName: sg.name,
                    dataLabel,
                    isLastInSubGroup: ri === sg.rows.length - 1,
                });
                rowInGroup++;
            }
        }
    }
    return result;
}

const COLUMNS = [
    { title: "大组", width: 120 },
    { title: "子组", width: 120 },
    { title: "分仓", width: 100 },
    { title: "市值(万)", width: 120 },
    { title: "占比(%)", width: 100 },
    { title: "收益率(%)", width: 110 },
];

const ROW_HEIGHT = 36;
// "+"按钮的尺寸与位置参数
const ADD_BTN_SIZE = 16;
const ADD_BTN_MARGIN = 6; // 距右边距

export const RowSpanGrouping: React.VFC = () => {
    const [groups, setGroups] = React.useState<Group[]>(INITIAL_GROUPS);
    const flatRows = React.useMemo(() => buildFlatRows(groups), [groups]);
    const totalRows = flatRows.length;

    const [colSizes, setColSizes] = React.useState<Record<number, number>>({});
    const columns = React.useMemo(() => COLUMNS.map((c, i) => ({ ...c, width: colSizes[i] ?? c.width })), [colSizes]);
    const onColumnResize = React.useCallback((_col: any, newSize: number, colIndex: number) => {
        setColSizes(prev => ({ ...prev, [colIndex]: newSize }));
    }, []);

    // 新增行：在指定 group/subGroup 末尾追加一行
    const addRow = React.useCallback((groupIndex: number, subGroupIndex: number) => {
        setGroups(prev => {
            return prev.map((g, gi) => {
                if (gi !== groupIndex) return g;
                return {
                    ...g,
                    subGroups: g.subGroups.map((sg, si) => {
                        if (si !== subGroupIndex) return sg;
                        const newLabel = `分仓${prev.reduce((s, gg) => s + gg.subGroups.reduce((ss, ssg) => ss + ssg.rows.length, 0), 0) + 1}`;
                        return { ...sg, rows: [...sg.rows, newLabel] };
                    }),
                };
            });
        });
    }, []);

    const getCellContent = React.useCallback<DataEditorAllProps["getCellContent"]>(
        ([col, row]) => {
            const flat = flatRows[row];
            if (flat === undefined) return { kind: GridCellKind.Loading, allowOverlay: false };

            switch (col) {
                case 0:
                    return {
                        kind: GridCellKind.Text,
                        data: flat.groupName,
                        displayData: flat.groupName,
                        allowOverlay: false,
                        rowSpan: flat.groupSize,
                        rowSpanOffset: flat.rowInGroup,
                    };
                case 1:
                    return {
                        kind: GridCellKind.Text,
                        data: flat.subGroupName,
                        displayData: flat.subGroupName,
                        allowOverlay: false,
                        rowSpan: flat.subGroupSize,
                        rowSpanOffset: flat.rowInSubGroup,
                    };
                case 2:
                    return {
                        kind: GridCellKind.Text,
                        data: flat.dataLabel,
                        displayData: flat.dataLabel,
                        allowOverlay: false,
                    };
                default: {
                    const val = ((row * 7 + col * 13) % 100).toFixed(2);
                    return {
                        kind: GridCellKind.Text,
                        data: val,
                        displayData: val,
                        allowOverlay: false,
                    };
                }
            }
        },
        [flatRows]
    );

    // 绘制"+"按钮辅助函数
    const drawAddButton = React.useCallback(
        (ctx: CanvasRenderingContext2D, rect: { x: number; y: number; width: number; height: number }, theme: any) => {
            const bx = rect.x + rect.width - ADD_BTN_SIZE - ADD_BTN_MARGIN;
            const by = rect.y + (rect.height - ADD_BTN_SIZE) / 2;

            // 圆形背景
            ctx.beginPath();
            ctx.arc(bx + ADD_BTN_SIZE / 2, by + ADD_BTN_SIZE / 2, ADD_BTN_SIZE / 2, 0, Math.PI * 2);
            ctx.fillStyle = theme.accentColor;
            ctx.fill();

            // "+"符号
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 1.5;
            const cx = bx + ADD_BTN_SIZE / 2;
            const cy = by + ADD_BTN_SIZE / 2;
            const half = 4;
            ctx.beginPath();
            ctx.moveTo(cx - half, cy);
            ctx.lineTo(cx + half, cy);
            ctx.moveTo(cx, cy - half);
            ctx.lineTo(cx, cy + half);
            ctx.stroke();
        },
        []
    );

    // drawCell：col=0/1 实现 row span 绘制；col=1 最后一行绘制"+"按钮
    const drawCell = React.useCallback<DrawCellCallback>(
        (args, drawContent) => {
            const { ctx, rect, col, row, theme, highlighted } = args;
            if (col > 1) {
                drawContent();
                return;
            }

            const flat = flatRows[row];
            if (flat === undefined) {
                drawContent();
                return;
            }

            const isGroupCol = col === 0;
            const spanSize = isGroupCol ? flat.groupSize : flat.subGroupSize;
            const offsetInSpan = isGroupCol ? flat.rowInGroup : flat.rowInSubGroup;
            const label = isGroupCol ? flat.groupName : flat.subGroupName;

            // 合并区域起始行的 y 坐标
            const spanStartY = rect.y - offsetInSpan * ROW_HEIGHT;
            const totalHeight = spanSize * ROW_HEIGHT;

            ctx.save();

            // clip 到当前行
            ctx.beginPath();
            ctx.rect(rect.x, rect.y, rect.width, rect.height);
            ctx.clip();

            // 背景色
            ctx.fillStyle = highlighted ? theme.accentLight : theme.bgCell;
            ctx.fillRect(rect.x + 1, rect.y, rect.width - 1, rect.height);

            // 居中文字（在整个合并区域内垂直居中）
            ctx.fillStyle = theme.textDark;
            ctx.font = `${theme.baseFontStyle} ${theme.fontFamily}`;
            ctx.textBaseline = "middle";
            ctx.textAlign = "left";
            const textY = spanStartY + totalHeight / 2;
            // 子组列最后一行预留"+"按钮空间
            const textMaxWidth = !isGroupCol && flat.isLastInSubGroup
                ? rect.width - ADD_BTN_SIZE - ADD_BTN_MARGIN * 2 - 8
                : rect.width - 16;
            ctx.fillText(label, rect.x + 8, textY, textMaxWidth);

            // 最后一行：底部边框
            const isLastInSpan = offsetInSpan === spanSize - 1;
            if (isLastInSpan) {
                ctx.strokeStyle = theme.borderColor;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(rect.x, rect.y + rect.height - 0.5);
                ctx.lineTo(rect.x + rect.width, rect.y + rect.height - 0.5);
                ctx.stroke();
            }

            // 子组列：最后一行绘制"+"按钮
            if (!isGroupCol && flat.isLastInSubGroup) {
                drawAddButton(ctx, rect, theme);
            }

            ctx.restore();
        },
        [flatRows, drawAddButton]
    );

    // 点击"+"按钮时新增行
    const onCellClicked = React.useCallback(
        ([col, row]: Item) => {
            if (col !== 1) return;
            const flat = flatRows[row];
            if (flat === undefined || !flat.isLastInSubGroup) return;
            addRow(flat.groupIndex, flat.subGroupIndex);
        },
        [flatRows, addRow]
    );

    return (
        <DataEditor
            {...defaultProps}
            getCellContent={getCellContent}
            columns={columns}
            rows={totalRows}
            rowHeight={ROW_HEIGHT}
            drawCell={drawCell}
            onCellClicked={onCellClicked}
            onColumnResize={onColumnResize}
            rowMarkers={{
                kind: "number",
                width: 100,
            }}
        />
    );
};
