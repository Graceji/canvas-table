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
import {
    CompactSelection,
    GridCellKind,
    type GridSelection,
    type Item,
    type DrawCellCallback,
    type Slice,
} from "../../internal/data-grid/data-grid-types.js";
import type { Theme } from "../../common/styles.js";
import { emptyGridSelection } from "../../data-editor/data-editor.js";
import { type RowGroupingOptions } from "../../data-editor/row-grouping.js";
import { useRowGrouping } from "../../data-editor/row-grouping-api.js";

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
// RowSpan story: 用“账户组 -> 子组合 -> 划入账户 -> 划出规则”的四层结构
// 演示复制、加规则、筛选、排序，以及基于当前可视结果重新计算 rowSpan
// ---------------------------------------------------------------------------

const ALL_OPTION = "全部";
const COMMON_SECURITY_SCOPE = "平安银行, 宁德时代, 招商银行";

type RuleType = "金额" | "比例";
type RuleMethod = "前二十大" | "限定证券" | typeof ALL_OPTION;
type SortDirection = "asc" | "desc";
type SortKey = "source-order" | "account-name" | "config-sell-amount" | "entry-amount" | "rule-amount" | "rule-type";
type MergeLevel = "group" | "sub-group" | "entry" | "rule";

const DEFAULT_SORT_KEY: SortKey = "source-order";

interface TransferRule {
    id: string;
    type: RuleType;
    method: RuleMethod;
    securityScope: string;
    transferRatio: number | null;
    transferAmount: number | null;
}

interface TransferInAccount {
    id: string;
    portfolioName: string;
    manager: string;
    transferAmount: number;
    splitRatio: number;
    rules: TransferRule[];
}

interface DemoSubGroup {
    id: string;
    portfolioName: string;
    holdingValue: number;
    sellAmount: number;
    sellRatio: number;
    transferInAccounts: TransferInAccount[];
}

interface AllocationGroup {
    id: string;
    accountName: string;
    configPortfolioName: string;
    manager: string;
    holdingValue: number;
    sellAmount: number;
    sellRatio: number;
    subGroups: DemoSubGroup[];
}

interface VisibleRow {
    rowId: string;
    sourceOrder: number;
    viewIndex: number;
    accountName: string;
    configPortfolioName: string;
    configManager: string;
    configHoldingValue: number;
    configSellAmount: number;
    configSellRatio: number;
    subGroupName: string;
    subHoldingValue: number;
    subSellAmount: number;
    subSellRatio: number;
    entryName: string;
    entryManager: string;
    entryAmount: number;
    entryRatio: number;
    ruleType: RuleType;
    ruleMethod: RuleMethod;
    securityScope: string;
    ruleRatio: number | null;
    ruleAmount: number | null;
    groupId: string;
    subGroupId: string;
    entryId: string;
    ruleId: string;
    groupIndex: number;
    subGroupIndex: number;
    entryIndex: number;
    ruleIndex: number;
    groupPath: string;
    subGroupPath: string;
    entryPath: string;
    rulePath: string;
    groupSpan: number;
    groupOffset: number;
    subGroupSpan: number;
    subGroupOffset: number;
    entrySpan: number;
    entryOffset: number;
}

interface DemoFilters {
    query: string;
    manager: string;
    ruleType: RuleType | typeof ALL_OPTION;
}

interface SortState {
    key: SortKey;
    direction: SortDirection;
}

interface DemoColumnDef {
    id: string;
    title: string;
    width: number;
    group?: string;
    mergeLevel: MergeLevel;
    sortableKey?: SortKey;
    align?: "left" | "right" | "center";
}

function makeHeaderTheme(options: {
    bgHeader: string;
    textHeader: string;
    bgGroupHeader?: string;
    textGroupHeader?: string;
}): Partial<Theme> {
    return {
        bgHeader: options.bgHeader,
        bgHeaderHovered: options.bgHeader,
        bgHeaderAccent: options.bgHeader,
        bgHeaderHasFocus: options.bgHeader,
        textHeader: options.textHeader,
        textHeaderSelected: options.textHeader,
        bgGroupHeader: options.bgGroupHeader ?? options.bgHeader,
        bgGroupHeaderHovered: options.bgGroupHeader ?? options.bgHeader,
        textGroupHeader: options.textGroupHeader ?? options.textHeader,
        headerBorderColor: "#1c1c1c",
        headerHorizontalBorderColor: "#1c1c1c",
        headerBottomBorderColor: "#1c1c1c",
    };
}

interface SelectionMapping {
    viewRowIndex: number;
    ruleId: string;
    entryId: string;
    subGroupId: string;
    groupId: string;
    accountName: string;
    subGroupName: string;
    entryName: string;
    ruleType: RuleType;
    sourcePath: string;
}

function makeRule(
    id: string,
    type: RuleType,
    method: RuleMethod,
    securityScope: string,
    transferRatio: number | null,
    transferAmount: number | null
): TransferRule {
    return {
        id,
        type,
        method,
        securityScope,
        transferRatio,
        transferAmount,
    };
}

function makeTransferInAccount(
    id: string,
    portfolioName: string,
    manager: string,
    transferAmount: number,
    splitRatio: number,
    rules: TransferRule[]
): TransferInAccount {
    return {
        id,
        portfolioName,
        manager,
        transferAmount,
        splitRatio,
        rules,
    };
}

function makeSubGroup(
    id: string,
    portfolioName: string,
    holdingValue: number,
    sellAmount: number,
    sellRatio: number,
    transferInAccounts: TransferInAccount[]
): DemoSubGroup {
    return {
        id,
        portfolioName,
        holdingValue,
        sellAmount,
        sellRatio,
        transferInAccounts,
    };
}

function makeAllocationGroup(
    id: string,
    accountName: string,
    configPortfolioName: string,
    manager: string,
    holdingValue: number,
    sellAmount: number,
    sellRatio: number,
    subGroups: DemoSubGroup[]
): AllocationGroup {
    return {
        id,
        accountName,
        configPortfolioName,
        manager,
        holdingValue,
        sellAmount,
        sellRatio,
        subGroups,
    };
}

function createInitialAllocationGroups(): AllocationGroup[] {
    return [
        makeAllocationGroup("group-asset-1", "资管行业配置", "权益1", "夏志豪", 6_432_000, 525_479, 8.17, [
            makeSubGroup("sub-asset-1-a", "权益沪深1", 6_000_000, 422_360, 7.04, [
                makeTransferInAccount("entry-asset-1-a", "权益组合A", "刘忠卫", 372_360, 88.16, [
                    makeRule("rule-asset-1-a-1", "金额", "前二十大", "腾讯控股, 宁德时代, 药明康德", 20, 348_904),
                    makeRule("rule-asset-1-a-2", "比例", "限定证券", COMMON_SECURITY_SCOPE, 12, 23_456),
                ]),
            ]),
            makeSubGroup("sub-asset-1-b", "权益港股通1", 432_000, 103_119, 23.87, [
                makeTransferInAccount("entry-asset-1-b-0", "权益组合C", "刘忠卫", 50_000, 10, [
                    makeRule("rule-asset-1-b-0", "金额", "限定证券", COMMON_SECURITY_SCOPE, 10, 50_000),
                ]),
                makeTransferInAccount("entry-asset-1-b-1", "权益组合B1", "林已", 53_119, 2.29, [
                    makeRule("rule-asset-1-b-1", "比例", "限定证券", COMMON_SECURITY_SCOPE, 100, 9876),
                ]),
                makeTransferInAccount("entry-asset-1-b-2", "权益港股通C1", "林已", 50_000, 10, [
                    makeRule("rule-asset-1-b-2", "金额", ALL_OPTION, ALL_OPTION, 10, 43_243),
                    makeRule("rule-asset-1-b-3", "比例", ALL_OPTION, ALL_OPTION, 10, 43_243),
                ]),
            ]),
            makeSubGroup("sub-asset-1-c", "权益组合A3", 3_432_432, 34_321, 1, [
                makeTransferInAccount("entry-asset-1-c-1", "权益港股通A3", "吉茹定", 100_000, 10, [
                    makeRule("rule-asset-1-c-1", "金额", ALL_OPTION, ALL_OPTION, 10, 34_321),
                ]),
            ]),
        ]),
        makeAllocationGroup("group-asset-2", "资管行业配置2", "权益5", "李中冰", 1_000_000_000, 1000, 8.17, [
            makeSubGroup("sub-asset-2-a", "权益港股通1", 1_000_000_000, 500_000_000, 23.87, [
                makeTransferInAccount("entry-asset-2-a-1", "权益港股通B", "林已", 500_000_000, 10, [
                    makeRule("rule-asset-2-a-1", "金额", ALL_OPTION, ALL_OPTION, 10, 500_000_000),
                ]),
                makeTransferInAccount("entry-asset-2-a-2", "权益港股通C", "张林", 500_000_000, 10, [
                    makeRule("rule-asset-2-a-2", "金额", ALL_OPTION, ALL_OPTION, 10, 500_000_000),
                ]),
            ]),
        ]),
        makeAllocationGroup("group-asset-3", "资管行业配置3", "权益6", "黄文隆", 6_432_000, 6_432_000, 100, [
            makeSubGroup("sub-asset-3-a", "权益沪深1", 6_432_000, 6_432_000, 100, [
                makeTransferInAccount("entry-asset-3-a-1", "权益港股通C", "张林", 6_432_000, 100, [
                    makeRule("rule-asset-3-a-1", "金额", ALL_OPTION, ALL_OPTION, 100, 6_432_000),
                ]),
            ]),
        ]),
        makeAllocationGroup("group-asset-4", "资管行业配置4", "权益7", "谢彦文", 1_000_000_000, 1_000_000_000, 100, [
            makeSubGroup("sub-asset-4-a", "权益沪深1", 1_000_000_000, 1_000_000_000, 100, [
                makeTransferInAccount("entry-asset-4-a-1", "权益港股通C", "张林", 1_000_000_000, 100, [
                    makeRule("rule-asset-4-a-1", "金额", ALL_OPTION, ALL_OPTION, 100, 1_000_000_000),
                ]),
                makeTransferInAccount("entry-asset-4-a-2", "权益港股通B", "张林", 600, 10, [
                    makeRule("rule-asset-4-a-2", "金额", ALL_OPTION, ALL_OPTION, 10, 600),
                ]),
            ]),
        ]),
        makeAllocationGroup("group-asset-5", "资管行业配置5", "权益8", "傅智翔", 6_000_000, 6_000_000, 100, [
            makeSubGroup("sub-asset-5-a", "权益沪深1", 6_000_000, 6_000_000, 7.04, [
                makeTransferInAccount("entry-asset-5-a-1", "权益港股通C", "张林", 1200, 20, [
                    makeRule("rule-asset-5-a-1", "金额", ALL_OPTION, ALL_OPTION, 20, 1200),
                ]),
                makeTransferInAccount("entry-asset-5-a-2", "权益港股通D", "张林", 1800, 30, [
                    makeRule("rule-asset-5-a-2", "金额", ALL_OPTION, ALL_OPTION, 30, 1800),
                ]),
                makeTransferInAccount("entry-asset-5-a-3", "权益港股通E", "张林", 1200, 20, [
                    makeRule("rule-asset-5-a-3", "金额", ALL_OPTION, ALL_OPTION, 20, 1200),
                ]),
                makeTransferInAccount("entry-asset-5-a-4", "权益港股通F", "张林", 1200, 20, [
                    makeRule("rule-asset-5-a-4", "金额", ALL_OPTION, ALL_OPTION, 20, 1200),
                ]),
            ]),
        ]),
    ];
}

const ROW_HEIGHT = 38;
const ENTRY_ACTION_ICON_SIZE = 16;
const RULE_ACTION_ICON_SIZE = 14;
const ACTION_GAP = 6;
const ZH_COLLATOR = new Intl.Collator("zh-CN");
const GROUP_HEADER_THEMES: Record<string, Partial<Theme>> = {
    配置组合: makeHeaderTheme({
        bgHeader: "#f7a62a",
        textHeader: "#2d2200",
        bgGroupHeader: "#395428",
        textGroupHeader: "#eef7df",
    }),
    子组合: makeHeaderTheme({
        bgHeader: "#f7a62a",
        textHeader: "#2d2200",
        bgGroupHeader: "#5b1f1b",
        textGroupHeader: "#ffe9df",
    }),
    划入账户: makeHeaderTheme({
        bgHeader: "#f7a62a",
        textHeader: "#2d2200",
        bgGroupHeader: "#6d2018",
        textGroupHeader: "#ffe9df",
    }),
    划出规则: makeHeaderTheme({
        bgHeader: "#c9f5c6",
        textHeader: "#234b25",
        bgGroupHeader: "#23241f",
        textGroupHeader: "#eef7df",
    }),
};
const COLUMN_HEADER_THEMES: Record<string, Partial<Theme>> = {
    accountName: makeHeaderTheme({
        bgHeader: "#232323",
        textHeader: "#f3f4ef",
    }),
    entryAction: makeHeaderTheme({
        bgHeader: "#2a2a2a",
        textHeader: "#f3f4ef",
        bgGroupHeader: "#5b1f1b",
        textGroupHeader: "#ffe9df",
    }),
    ruleAction: makeHeaderTheme({
        bgHeader: "#2a2a2a",
        textHeader: "#f3f4ef",
        bgGroupHeader: "#23241f",
        textGroupHeader: "#eef7df",
    }),
};

const BASE_COLUMNS: DemoColumnDef[] = [
    { id: "accountName", title: "账户名称", width: 140, mergeLevel: "group", sortableKey: "account-name" },
    { id: "configPortfolioName", title: "配置组合", width: 108, group: "配置组合", mergeLevel: "group" },
    { id: "configManager", title: "投资经理", width: 92, group: "配置组合", mergeLevel: "group" },
    { id: "configHoldingValue", title: "持仓市值", width: 118, group: "配置组合", mergeLevel: "group", align: "right" },
    {
        id: "configSellAmount",
        title: "划出金额",
        width: 118,
        group: "配置组合",
        mergeLevel: "group",
        align: "right",
        sortableKey: "config-sell-amount",
    },
    { id: "configSellRatio", title: "划出比例%", width: 96, group: "配置组合", mergeLevel: "group", align: "right" },
    { id: "subGroupName", title: "划出组合", width: 118, group: "子组合", mergeLevel: "sub-group" },
    { id: "subHoldingValue", title: "持仓市值", width: 118, group: "子组合", mergeLevel: "sub-group", align: "right" },
    { id: "subSellAmount", title: "划出金额", width: 118, group: "子组合", mergeLevel: "sub-group", align: "right" },
    { id: "subSellRatio", title: "划出比例%", width: 96, group: "子组合", mergeLevel: "sub-group", align: "right" },
    { id: "entryAction", title: "操作", width: 72, group: "子组合", mergeLevel: "entry" },
    { id: "entryName", title: "划入组合", width: 126, group: "划入账户", mergeLevel: "entry" },
    { id: "entryManager", title: "投资经理", width: 92, group: "划入账户", mergeLevel: "entry" },
    {
        id: "entryAmount",
        title: "组合划入金额",
        width: 128,
        group: "划入账户",
        mergeLevel: "entry",
        align: "right",
        sortableKey: "entry-amount",
    },
    { id: "entryRatio", title: "分仓比例", width: 96, group: "划入账户", mergeLevel: "entry", align: "right" },
    { id: "ruleAction", title: "操作", width: 70, group: "划出规则", mergeLevel: "rule" },
    { id: "ruleType", title: "类型", width: 72, group: "划出规则", mergeLevel: "rule", sortableKey: "rule-type" },
    { id: "ruleMethod", title: "划转方式", width: 94, group: "划出规则", mergeLevel: "rule" },
    { id: "securityScope", title: "划转证券范围", width: 164, group: "划出规则", mergeLevel: "rule" },
    { id: "ruleRatio", title: "划转比例%", width: 96, group: "划出规则", mergeLevel: "rule", align: "right" },
    {
        id: "ruleAmount",
        title: "划转金额",
        width: 120,
        group: "划出规则",
        mergeLevel: "rule",
        align: "right",
        sortableKey: "rule-amount",
    },
];

const SORT_LABELS: Record<SortKey, string> = {
    [DEFAULT_SORT_KEY]: "原始顺序",
    "account-name": "账户名称",
    "config-sell-amount": "配置划出金额",
    "entry-amount": "组合划入金额",
    "rule-amount": "划转金额",
    "rule-type": "规则类型",
};

function countRuleRows(groups: readonly AllocationGroup[]): number {
    return groups.reduce(
        (sum, group) =>
            sum +
            group.subGroups.reduce(
                (subGroupSum, subGroup) =>
                    subGroupSum +
                    subGroup.transferInAccounts.reduce((entrySum, entry) => entrySum + entry.rules.length, 0),
                0
            ),
        0
    );
}

function formatNumber(value: number): string {
    return value.toLocaleString("zh-CN", {
        minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
        maximumFractionDigits: 2,
    });
}

function formatNullableNumber(value: number | null): string {
    return value === null ? "-" : formatNumber(value);
}

function getColumnByIndex(col: number): DemoColumnDef | undefined {
    if (col < 0) return undefined;
    return BASE_COLUMNS[col];
}

function getMergeInfo(row: VisibleRow, mergeLevel: MergeLevel): { span: number; offset: number } {
    switch (mergeLevel) {
        case "group":
            return {
                span: row.groupSpan,
                offset: row.groupOffset,
            };
        case "sub-group":
            return {
                span: row.subGroupSpan,
                offset: row.subGroupOffset,
            };
        case "entry":
            return {
                span: row.entrySpan,
                offset: row.entryOffset,
            };
        case "rule":
            return {
                span: 1,
                offset: 0,
            };
    }
}

function applyContiguousSpan(
    rows: VisibleRow[],
    getKey: (row: VisibleRow) => string,
    apply: (row: VisibleRow, span: number, offset: number) => void
) {
    let start = 0;
    while (start < rows.length) {
        const key = getKey(rows[start]);
        let end = start + 1;
        while (end < rows.length && getKey(rows[end]) === key) {
            end++;
        }

        const span = end - start;
        for (let index = start; index < end; index++) {
            apply(rows[index], span, index - start);
        }

        start = end;
    }
}

function compareSortValue(left: VisibleRow, right: VisibleRow, sortKey: SortKey): number {
    switch (sortKey) {
        case "account-name":
            return ZH_COLLATOR.compare(left.accountName, right.accountName);
        case "config-sell-amount":
            return left.configSellAmount - right.configSellAmount;
        case "entry-amount":
            return left.entryAmount - right.entryAmount;
        case "rule-amount":
            return (left.ruleAmount ?? -1) - (right.ruleAmount ?? -1);
        case "rule-type":
            return ZH_COLLATOR.compare(left.ruleType, right.ruleType);
        case DEFAULT_SORT_KEY:
            return left.sourceOrder - right.sourceOrder;
    }
}

function buildVisibleRows(
    groups: readonly AllocationGroup[],
    filters: DemoFilters,
    sortState: SortState
): VisibleRow[] {
    const searchQuery = filters.query.trim().toLowerCase();
    const flattenedRows: Array<
        Omit<
            VisibleRow,
            "viewIndex" | "groupSpan" | "groupOffset" | "subGroupSpan" | "subGroupOffset" | "entrySpan" | "entryOffset"
        > & { searchText: string }
    > = [];

    let sourceOrder = 0;
    for (const [groupIndex, group] of groups.entries()) {
        for (const [subGroupIndex, subGroup] of group.subGroups.entries()) {
            for (const [entryIndex, entry] of subGroup.transferInAccounts.entries()) {
                for (const [ruleIndex, rule] of entry.rules.entries()) {
                    const groupPath = `groups[${groupIndex}]`;
                    const subGroupPath = `${groupPath}.subGroups[${subGroupIndex}]`;
                    const entryPath = `${subGroupPath}.transferInAccounts[${entryIndex}]`;
                    const rulePath = `${entryPath}.rules[${ruleIndex}]`;
                    const searchText = [
                        group.accountName,
                        group.configPortfolioName,
                        group.manager,
                        subGroup.portfolioName,
                        entry.portfolioName,
                        entry.manager,
                        rule.type,
                        rule.method,
                        rule.securityScope,
                    ]
                        .join("|")
                        .toLowerCase();

                    flattenedRows.push({
                        rowId: rule.id,
                        sourceOrder: sourceOrder++,
                        accountName: group.accountName,
                        configPortfolioName: group.configPortfolioName,
                        configManager: group.manager,
                        configHoldingValue: group.holdingValue,
                        configSellAmount: group.sellAmount,
                        configSellRatio: group.sellRatio,
                        subGroupName: subGroup.portfolioName,
                        subHoldingValue: subGroup.holdingValue,
                        subSellAmount: subGroup.sellAmount,
                        subSellRatio: subGroup.sellRatio,
                        entryName: entry.portfolioName,
                        entryManager: entry.manager,
                        entryAmount: entry.transferAmount,
                        entryRatio: entry.splitRatio,
                        ruleType: rule.type,
                        ruleMethod: rule.method,
                        securityScope: rule.securityScope,
                        ruleRatio: rule.transferRatio,
                        ruleAmount: rule.transferAmount,
                        groupId: group.id,
                        subGroupId: subGroup.id,
                        entryId: entry.id,
                        ruleId: rule.id,
                        groupIndex,
                        subGroupIndex,
                        entryIndex,
                        ruleIndex,
                        groupPath,
                        subGroupPath,
                        entryPath,
                        rulePath,
                        searchText,
                    });
                }
            }
        }
    }

    const filteredRows = flattenedRows.filter(row => {
        if (searchQuery !== "" && !row.searchText.includes(searchQuery)) {
            return false;
        }

        if (
            filters.manager !== "全部" &&
            row.configManager !== filters.manager &&
            row.entryManager !== filters.manager
        ) {
            return false;
        }

        return filters.ruleType === ALL_OPTION || row.ruleType === filters.ruleType;
    });

    const sortedRows = [...filteredRows]
        .map((row, index) => ({
            row,
            index,
        }))
        .sort((left, right) => {
            const compared = compareSortValue(left.row as VisibleRow, right.row as VisibleRow, sortState.key);
            if (compared !== 0) {
                return sortState.direction === "asc" ? compared : -compared;
            }

            return left.index - right.index;
        })
        .map(item => item.row);

    const visibleRows: VisibleRow[] = sortedRows.map((row, viewIndex) => ({
        ...row,
        viewIndex,
        groupSpan: 1,
        groupOffset: 0,
        subGroupSpan: 1,
        subGroupOffset: 0,
        entrySpan: 1,
        entryOffset: 0,
    }));

    applyContiguousSpan(
        visibleRows,
        row => row.groupId,
        (row, span, offset) => {
            row.groupSpan = span;
            row.groupOffset = offset;
        }
    );

    applyContiguousSpan(
        visibleRows,
        row => row.subGroupId,
        (row, span, offset) => {
            row.subGroupSpan = span;
            row.subGroupOffset = offset;
        }
    );

    applyContiguousSpan(
        visibleRows,
        row => row.entryId,
        (row, span, offset) => {
            row.entrySpan = span;
            row.entryOffset = offset;
        }
    );

    return visibleRows;
}

function getDisplayValue(row: VisibleRow, columnId: string): string {
    switch (columnId) {
        case "accountName":
            return row.accountName;
        case "configPortfolioName":
            return row.configPortfolioName;
        case "configManager":
            return row.configManager;
        case "configHoldingValue":
            return formatNumber(row.configHoldingValue);
        case "configSellAmount":
            return formatNumber(row.configSellAmount);
        case "configSellRatio":
            return formatNumber(row.configSellRatio);
        case "subGroupName":
            return row.subGroupName;
        case "subHoldingValue":
            return formatNumber(row.subHoldingValue);
        case "subSellAmount":
            return formatNumber(row.subSellAmount);
        case "subSellRatio":
            return formatNumber(row.subSellRatio);
        case "entryName":
            return row.entryName;
        case "entryManager":
            return row.entryManager;
        case "entryAmount":
            return formatNumber(row.entryAmount);
        case "entryRatio":
            return formatNumber(row.entryRatio);
        case "ruleType":
            return row.ruleType;
        case "ruleMethod":
            return row.ruleMethod;
        case "securityScope":
            return row.securityScope;
        case "ruleRatio":
            return formatNullableNumber(row.ruleRatio);
        case "ruleAmount":
            return formatNullableNumber(row.ruleAmount);
        default:
            return "";
    }
}

function getRowSelectionSlice(
    visibleRows: readonly VisibleRow[],
    location: Item,
    behavior: NonNullable<DataEditorAllProps["cellRowSelectionBehavior"]>
): Slice {
    const [col, row] = location;
    const visibleRow = visibleRows[row];
    const column = getColumnByIndex(col);

    if (visibleRow === undefined || behavior !== "row-span" || column === undefined) {
        return [row, row + 1];
    }

    const { span, offset } = getMergeInfo(visibleRow, column.mergeLevel);
    return [row - offset, row - offset + span];
}

function normalizeGridSelection(
    selection: GridSelection,
    prevRows: readonly VisibleRow[],
    nextRows: readonly VisibleRow[],
    behavior: NonNullable<DataEditorAllProps["cellRowSelectionBehavior"]>
): GridSelection {
    if (nextRows.length === 0) {
        return emptyGridSelection;
    }

    const nextIndexById = new Map(nextRows.map((row, index) => [row.ruleId, index]));
    const remapRowIndex = (rowIndex: number): number | undefined => {
        const rowId = prevRows[rowIndex]?.ruleId;
        return rowId === undefined ? undefined : nextIndexById.get(rowId);
    };

    let nextSelectionRows = CompactSelection.empty();
    for (const rowIndex of selection.rows) {
        const nextRowIndex = remapRowIndex(rowIndex);
        if (nextRowIndex !== undefined) {
            nextSelectionRows = nextSelectionRows.add(nextRowIndex);
        }
    }

    if (selection.current === undefined) {
        return {
            ...selection,
            rows: nextSelectionRows,
        };
    }

    const [col, row] = selection.current.cell;
    const mappedRow = remapRowIndex(row);
    const fallbackRow = Math.min(row, nextRows.length - 1);
    const nextCurrentRow = mappedRow ?? nextSelectionRows.first() ?? fallbackRow;

    if (nextCurrentRow < 0) {
        return emptyGridSelection;
    }

    const nextCell: Item = [col, nextCurrentRow];
    const nextRowSlice = getRowSelectionSlice(nextRows, nextCell, behavior);
    const mergedRows =
        nextSelectionRows.length === 0 || nextSelectionRows.hasAll(nextRowSlice)
            ? nextSelectionRows.length === 0
                ? CompactSelection.fromSingleSelection(nextRowSlice)
                : nextSelectionRows
            : nextSelectionRows.add(nextRowSlice);

    return {
        ...selection,
        current: {
            ...selection.current,
            cell: nextCell,
            range: {
                x: col,
                y: nextCurrentRow,
                width: 1,
                height: 1,
            },
            rangeStack: [],
        },
        rows: mergedRows,
    };
}

function normalizeInteractiveSelection(
    selection: GridSelection,
    _visibleRows: readonly VisibleRow[],
    _behavior: NonNullable<DataEditorAllProps["cellRowSelectionBehavior"]>
): GridSelection {
    // rowSpan 点击联动与再次点击取消选中已经由 DataEditor 内核处理
    // story 这里如果再根据 current 反推 rows，会把“取消选中”的结果重新补回去
    return selection;
}

function pruneEmptyGroups(groups: readonly AllocationGroup[]): AllocationGroup[] {
    return groups.flatMap(group => {
        const nextSubGroups = group.subGroups.flatMap(subGroup => {
            const nextEntries = subGroup.transferInAccounts.filter(entry => entry.rules.length > 0);
            if (nextEntries.length === 0) {
                return [];
            }

            return [
                {
                    ...subGroup,
                    transferInAccounts: nextEntries,
                },
            ];
        });

        if (nextSubGroups.length === 0) {
            return [];
        }

        return [
            {
                ...group,
                subGroups: nextSubGroups,
            },
        ];
    });
}

function createCopiedEntry(
    source: TransferInAccount,
    _siblings: readonly TransferInAccount[],
    nextId: (prefix: string) => string
): TransferInAccount {
    return {
        ...source,
        id: nextId("entry"),
        rules: source.rules.map(rule => ({
            ...rule,
            id: nextId("rule"),
        })),
    };
}

function duplicateEntryById(
    groups: readonly AllocationGroup[],
    entryId: string,
    nextId: (prefix: string) => string
): AllocationGroup[] {
    return groups.map(group => ({
        ...group,
        subGroups: group.subGroups.map(subGroup => {
            const entryIndex = subGroup.transferInAccounts.findIndex(entry => entry.id === entryId);
            if (entryIndex === -1) {
                return subGroup;
            }

            const copiedEntry = createCopiedEntry(
                subGroup.transferInAccounts[entryIndex],
                subGroup.transferInAccounts,
                nextId
            );
            return {
                ...subGroup,
                transferInAccounts: [
                    ...subGroup.transferInAccounts.slice(0, entryIndex + 1),
                    copiedEntry,
                    ...subGroup.transferInAccounts.slice(entryIndex + 1),
                ],
            };
        }),
    }));
}

function createCopiedRule(
    source: TransferRule,
    _siblingCount: number,
    nextId: (prefix: string) => string
): TransferRule {
    return {
        ...source,
        id: nextId("rule"),
    };
}

function duplicateRuleById(
    groups: readonly AllocationGroup[],
    ruleId: string,
    nextId: (prefix: string) => string
): AllocationGroup[] {
    return groups.map(group => ({
        ...group,
        subGroups: group.subGroups.map(subGroup => ({
            ...subGroup,
            transferInAccounts: subGroup.transferInAccounts.map(entry => {
                const ruleIndex = entry.rules.findIndex(rule => rule.id === ruleId);
                if (ruleIndex === -1) {
                    return entry;
                }

                const copiedRule = createCopiedRule(entry.rules[ruleIndex], entry.rules.length, nextId);
                return {
                    ...entry,
                    rules: [...entry.rules.slice(0, ruleIndex + 1), copiedRule, ...entry.rules.slice(ruleIndex + 1)],
                };
            }),
        })),
    }));
}

function removeEntryById(groups: readonly AllocationGroup[], entryId: string): AllocationGroup[] {
    return pruneEmptyGroups(
        groups.map(group => ({
            ...group,
            subGroups: group.subGroups.map(subGroup => ({
                ...subGroup,
                transferInAccounts: subGroup.transferInAccounts.filter(entry => entry.id !== entryId),
            })),
        }))
    );
}

function removeRuleById(groups: readonly AllocationGroup[], ruleId: string): AllocationGroup[] {
    return pruneEmptyGroups(
        groups.map(group => ({
            ...group,
            subGroups: group.subGroups.map(subGroup => ({
                ...subGroup,
                transferInAccounts: subGroup.transferInAccounts.map(entry => ({
                    ...entry,
                    rules: entry.rules.filter(rule => rule.id !== ruleId),
                })),
            })),
        }))
    );
}

function removeRuleSet(groups: readonly AllocationGroup[], ruleIds: ReadonlySet<string>): AllocationGroup[] {
    return pruneEmptyGroups(
        groups.map(group => ({
            ...group,
            subGroups: group.subGroups.map(subGroup => ({
                ...subGroup,
                transferInAccounts: subGroup.transferInAccounts.map(entry => ({
                    ...entry,
                    rules: entry.rules.filter(rule => !ruleIds.has(rule.id)),
                })),
            })),
        }))
    );
}

function getInlineButtonBounds(width: number, height: number, size: number, count: number) {
    const totalWidth = size * count + ACTION_GAP * (count - 1);
    const startX = (width - totalWidth) / 2;
    const y = (height - size) / 2;

    return Array.from({ length: count }, (_value, index) => ({
        x: startX + index * (size + ACTION_GAP),
        y,
        width: size,
        height: size,
    }));
}

function isPointInBounds(
    x: number,
    y: number,
    bounds: { x: number; y: number; width: number; height: number }
): boolean {
    return x >= bounds.x && x <= bounds.x + bounds.width && y >= bounds.y && y <= bounds.y + bounds.height;
}

function drawIconButton(
    ctx: CanvasRenderingContext2D,
    rect: { x: number; y: number; width: number; height: number },
    bounds: { x: number; y: number; width: number; height: number },
    fill: string,
    stroke: string,
    drawGlyph: (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) => void,
    glyphColor: string
) {
    const x = rect.x + bounds.x;
    const y = rect.y + bounds.y;

    ctx.save();
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.fillRect(x, y, bounds.width, bounds.height);
    ctx.strokeRect(x + 0.5, y + 0.5, bounds.width - 1, bounds.height - 1);
    drawGlyph(ctx, x, y, bounds.width, glyphColor);
    ctx.restore();
}

function drawCopyGlyph(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.25;
    ctx.strokeRect(x + size * 0.34, y + size * 0.22, size * 0.38, size * 0.42);
    ctx.strokeRect(x + size * 0.2, y + size * 0.34, size * 0.38, size * 0.42);
    ctx.restore();
}

function drawPlusGlyph(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    const midX = x + size / 2;
    const midY = y + size / 2;
    ctx.beginPath();
    ctx.moveTo(midX, y + size * 0.24);
    ctx.lineTo(midX, y + size * 0.76);
    ctx.moveTo(x + size * 0.24, midY);
    ctx.lineTo(x + size * 0.76, midY);
    ctx.stroke();
    ctx.restore();
}

function drawTrashGlyph(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x + size * 0.28, y + size * 0.3);
    ctx.lineTo(x + size * 0.72, y + size * 0.3);
    ctx.moveTo(x + size * 0.36, y + size * 0.24);
    ctx.lineTo(x + size * 0.64, y + size * 0.24);
    ctx.moveTo(x + size * 0.4, y + size * 0.2);
    ctx.lineTo(x + size * 0.6, y + size * 0.2);
    ctx.stroke();
    ctx.strokeRect(x + size * 0.32, y + size * 0.3, size * 0.36, size * 0.42);
    ctx.beginPath();
    ctx.moveTo(x + size * 0.45, y + size * 0.38);
    ctx.lineTo(x + size * 0.45, y + size * 0.62);
    ctx.moveTo(x + size * 0.55, y + size * 0.38);
    ctx.lineTo(x + size * 0.55, y + size * 0.62);
    ctx.stroke();
    ctx.restore();
}

function buildSelectionMappings(selection: GridSelection, visibleRows: readonly VisibleRow[]): SelectionMapping[] {
    return selection.rows
        .toArray()
        .map(rowIndex => {
            const row = visibleRows[rowIndex];
            if (row === undefined) {
                return undefined;
            }

            return {
                viewRowIndex: rowIndex,
                ruleId: row.ruleId,
                entryId: row.entryId,
                subGroupId: row.subGroupId,
                groupId: row.groupId,
                accountName: row.accountName,
                subGroupName: row.subGroupName,
                entryName: row.entryName,
                ruleType: row.ruleType,
                sourcePath: row.rulePath,
            };
        })
        .filter((item): item is SelectionMapping => item !== undefined);
}

function getCurrentCellMapping(selection: GridSelection, visibleRows: readonly VisibleRow[]) {
    if (selection.current === undefined) {
        return undefined;
    }

    const [col, row] = selection.current.cell;
    const activeRow = col < 0 ? (selection.rows.first() ?? row) : row;
    const visibleRow = visibleRows[activeRow];
    const column = getColumnByIndex(col);
    if (visibleRow === undefined) {
        return undefined;
    }

    const sourcePath =
        column?.mergeLevel === "group"
            ? visibleRow.groupPath
            : column?.mergeLevel === "sub-group"
              ? visibleRow.subGroupPath
              : column?.mergeLevel === "entry"
                ? visibleRow.entryPath
                : visibleRow.rulePath;

    return {
        cell: [col, row] as Item,
        column: column?.id ?? "row-marker",
        sourcePath,
        accountName: visibleRow.accountName,
        subGroupName: visibleRow.subGroupName,
        entryName: visibleRow.entryName,
        ruleId: visibleRow.ruleId,
    };
}

function getSelectionScope(
    _selection: GridSelection,
    visibleRows: readonly VisibleRow[],
    selectedMappings: readonly SelectionMapping[]
) {
    if (selectedMappings.length === 0) {
        return undefined;
    }

    const [first] = selectedMappings;
    const sameGroup = selectedMappings.every(item => item.groupId === first.groupId);
    const sameSubGroup = selectedMappings.every(item => item.subGroupId === first.subGroupId);
    const sameEntry = selectedMappings.every(item => item.entryId === first.entryId);

    if (sameGroup) {
        const totalGroupRows = visibleRows.filter(row => row.groupId === first.groupId).length;
        if (selectedMappings.length === totalGroupRows) {
            return {
                type: "账户组",
                label: first.accountName,
                rowCount: selectedMappings.length,
            };
        }
    }

    if (sameSubGroup) {
        const totalSubGroupRows = visibleRows.filter(row => row.subGroupId === first.subGroupId).length;
        if (selectedMappings.length === totalSubGroupRows) {
            return {
                type: "子组合",
                label: first.subGroupName,
                rowCount: selectedMappings.length,
            };
        }
    }

    if (sameEntry) {
        const totalEntryRows = visibleRows.filter(row => row.entryId === first.entryId).length;
        if (selectedMappings.length === totalEntryRows) {
            return {
                type: "划入账户",
                label: first.entryName,
                rowCount: selectedMappings.length,
            };
        }
    }

    return {
        type: "规则",
        label: `${first.entryName} / ${first.ruleType}`,
        rowCount: selectedMappings.length,
    };
}

export const RowSpanGrouping: React.VFC = () => {
    const [groups, setGroups] = React.useState<AllocationGroup[]>(() => createInitialAllocationGroups());
    const [filters, setFilters] = React.useState<DemoFilters>({
        query: "",
        manager: ALL_OPTION,
        ruleType: ALL_OPTION,
    });
    const [sortState, setSortState] = React.useState<SortState>({
        key: DEFAULT_SORT_KEY,
        direction: "asc",
    });
    const [rowSelectionBehavior, setRowSelectionBehavior] =
        React.useState<NonNullable<DataEditorAllProps["cellRowSelectionBehavior"]>>("row-span");
    const deferredQuery = React.useDeferredValue(filters.query);
    const viewFilters = React.useMemo(
        () => ({
            query: deferredQuery,
            manager: filters.manager,
            ruleType: filters.ruleType,
        }),
        [deferredQuery, filters.manager, filters.ruleType]
    );
    const visibleRows = React.useMemo(
        () => buildVisibleRows(groups, viewFilters, sortState),
        [groups, viewFilters, sortState]
    );
    const totalRows = visibleRows.length;
    const [gridSelection, setGridSelection] = React.useState<GridSelection>(emptyGridSelection);
    const previousVisibleRowsRef = React.useRef(visibleRows);
    const nextIdRef = React.useRef(countRuleRows(createInitialAllocationGroups()) + 1);

    const [colSizes, setColSizes] = React.useState<Record<number, number>>({});
    const columns = React.useMemo(
        () =>
            BASE_COLUMNS.map((column, index) => {
                const isActiveSort = column.sortableKey !== undefined && column.sortableKey === sortState.key;
                const suffix = isActiveSort ? (sortState.direction === "asc" ? " ↑" : " ↓") : "";
                return {
                    id: column.id,
                    title: `${column.title}${suffix}`,
                    width: colSizes[index] ?? column.width,
                    group: column.group,
                    themeOverride: COLUMN_HEADER_THEMES[column.id],
                };
            }),
        [colSizes, sortState]
    );
    const onColumnResize = React.useCallback((_col: any, newSize: number, colIndex: number) => {
        setColSizes(prev => ({ ...prev, [colIndex]: newSize }));
    }, []);
    const getGroupDetails = React.useCallback<NonNullable<DataEditorAllProps["getGroupDetails"]>>(group => {
        return {
            name: group,
            overrideTheme: GROUP_HEADER_THEMES[group],
        };
    }, []);

    const selectedRowMappings = React.useMemo(
        () => buildSelectionMappings(gridSelection, visibleRows),
        [gridSelection, visibleRows]
    );
    const currentCellMapping = React.useMemo(
        () => getCurrentCellMapping(gridSelection, visibleRows),
        [gridSelection, visibleRows]
    );
    const selectedRuleIds = React.useMemo(
        () => new Set(selectedRowMappings.map(row => row.ruleId)),
        [selectedRowMappings]
    );
    const selectedScope = React.useMemo(
        () => getSelectionScope(gridSelection, visibleRows, selectedRowMappings),
        [gridSelection, selectedRowMappings, visibleRows]
    );

    const managerOptions = React.useMemo(() => {
        const managers = new Set<string>();
        for (const group of groups) {
            managers.add(group.manager);
            for (const subGroup of group.subGroups) {
                for (const entry of subGroup.transferInAccounts) {
                    managers.add(entry.manager);
                }
            }
        }

        return [ALL_OPTION, ...[...managers].sort((left, right) => ZH_COLLATOR.compare(left, right))];
    }, [groups]);

    React.useEffect(() => {
        const previousRows = previousVisibleRowsRef.current;
        if (previousRows === visibleRows) return;

        setGridSelection(prev => normalizeGridSelection(prev, previousRows, visibleRows, rowSelectionBehavior));
        previousVisibleRowsRef.current = visibleRows;
    }, [visibleRows, rowSelectionBehavior]);

    const onGridSelectionChange = React.useCallback(
        (nextSelection: GridSelection) => {
            setGridSelection(normalizeInteractiveSelection(nextSelection, visibleRows, rowSelectionBehavior));
        },
        [rowSelectionBehavior, visibleRows]
    );

    const createNextId = React.useCallback((prefix: string) => `${prefix}-${nextIdRef.current++}`, []);

    const duplicateEntry = React.useCallback(
        (entryId: string) => {
            setGroups(prev => duplicateEntryById(prev, entryId, createNextId));
        },
        [createNextId]
    );

    const duplicateRule = React.useCallback(
        (ruleId: string) => {
            setGroups(prev => duplicateRuleById(prev, ruleId, createNextId));
        },
        [createNextId]
    );

    const removeEntry = React.useCallback((entryId: string) => {
        setGroups(prev => removeEntryById(prev, entryId));
    }, []);

    const removeRule = React.useCallback((ruleId: string) => {
        setGroups(prev => removeRuleById(prev, ruleId));
    }, []);

    const removeSelectedRules = React.useCallback(() => {
        if (selectedRuleIds.size === 0) {
            return;
        }

        setGroups(prev => removeRuleSet(prev, selectedRuleIds));
    }, [selectedRuleIds]);

    const resetDemo = React.useCallback(() => {
        setGroups(createInitialAllocationGroups());
        setFilters({
            query: "",
            manager: ALL_OPTION,
            ruleType: ALL_OPTION,
        });
        setSortState({
            key: DEFAULT_SORT_KEY,
            direction: "asc",
        });
        setRowSelectionBehavior("row-span");
        setGridSelection(emptyGridSelection);
    }, []);

    const getCellContent = React.useCallback<DataEditorAllProps["getCellContent"]>(
        ([col, row]) => {
            const visibleRow = visibleRows[row];
            const column = getColumnByIndex(col);
            if (visibleRow === undefined || column === undefined) {
                return { kind: GridCellKind.Loading, allowOverlay: false };
            }

            const displayValue = getDisplayValue(visibleRow, column.id);
            const { span, offset } = getMergeInfo(visibleRow, column.mergeLevel);
            const rowSpan = span > 1 ? span : undefined;
            const rowSpanOffset = span > 1 ? offset : undefined;

            return {
                kind: GridCellKind.Text,
                data: displayValue,
                displayData: displayValue,
                allowOverlay: false,
                copyData: displayValue,
                contentAlign: column.align,
                cursor: column.id === "entryAction" || column.id === "ruleAction" ? "pointer" : undefined,
                rowSpan,
                rowSpanOffset,
            };
        },
        [visibleRows]
    );

    const drawCell = React.useCallback<DrawCellCallback>(
        (args, drawContent) => {
            const extendedArgs = args as any;
            const { ctx, rect, col, row } = extendedArgs;
            const visibleRow = visibleRows[row];
            const column = getColumnByIndex(col);

            if (visibleRow === undefined || column === undefined) {
                drawContent();
                return;
            }

            if (column.id === "entryAction") {
                if (visibleRow.entryOffset !== 0) {
                    return;
                }

                const [copyBounds, deleteBounds] = getInlineButtonBounds(
                    rect.width,
                    rect.height,
                    ENTRY_ACTION_ICON_SIZE,
                    2
                );
                drawIconButton(ctx, rect, copyBounds, "#173a5b", "#77c5ff", drawCopyGlyph, "#d5efff");
                drawIconButton(ctx, rect, deleteBounds, "#43212a", "#ff7b88", drawTrashGlyph, "#ffd5da");
                return;
            }

            if (column.id === "ruleAction") {
                const [addBounds, deleteBounds] = getInlineButtonBounds(
                    rect.width,
                    rect.height,
                    RULE_ACTION_ICON_SIZE,
                    2
                );
                drawIconButton(ctx, rect, addBounds, "#173d2b", "#6ee7a2", drawPlusGlyph, "#ddffe9");
                drawIconButton(ctx, rect, deleteBounds, "#43212a", "#ff7b88", drawTrashGlyph, "#ffd5da");
                return;
            }

            drawContent();
        },
        [visibleRows]
    );

    const onCellClicked = React.useCallback<NonNullable<DataEditorAllProps["onCellClicked"]>>(
        ([col, row], event) => {
            const visibleRow = visibleRows[row];
            const column = getColumnByIndex(col);
            if (visibleRow === undefined || column === undefined) return;

            if (column.id === "entryAction") {
                if (visibleRow.entryOffset !== 0) {
                    return;
                }

                const [copyBounds, deleteBounds] = getInlineButtonBounds(
                    event.bounds.width,
                    event.bounds.height,
                    ENTRY_ACTION_ICON_SIZE,
                    2
                );

                if (isPointInBounds(event.localEventX, event.localEventY, copyBounds)) {
                    duplicateEntry(visibleRow.entryId);
                } else if (isPointInBounds(event.localEventX, event.localEventY, deleteBounds)) {
                    removeEntry(visibleRow.entryId);
                }
                return;
            }

            if (column.id === "ruleAction") {
                const [addBounds, deleteBounds] = getInlineButtonBounds(
                    event.bounds.width,
                    event.bounds.height,
                    RULE_ACTION_ICON_SIZE,
                    2
                );

                if (isPointInBounds(event.localEventX, event.localEventY, addBounds)) {
                    duplicateRule(visibleRow.ruleId);
                } else if (isPointInBounds(event.localEventX, event.localEventY, deleteBounds)) {
                    removeRule(visibleRow.ruleId);
                }
            }
        },
        [duplicateEntry, duplicateRule, removeEntry, removeRule, visibleRows]
    );

    const onHeaderClicked = React.useCallback<NonNullable<DataEditorAllProps["onHeaderClicked"]>>(colIndex => {
        const column = getColumnByIndex(colIndex);
        if (column?.sortableKey === undefined) {
            return;
        }

        setSortState(prev => {
            if (prev.key === column.sortableKey) {
                return {
                    key: column.sortableKey,
                    direction: prev.direction === "asc" ? "desc" : "asc",
                };
            }

            return {
                key: column.sortableKey,
                direction: "asc",
            };
        });
    }, []);

    return (
        <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <input
                    value={filters.query}
                    onChange={event => setFilters(prev => ({ ...prev, query: event.target.value }))}
                    placeholder="筛选账户、组合、证券范围"
                    style={{ width: 260 }}
                />
                <select
                    value={filters.manager}
                    onChange={event => setFilters(prev => ({ ...prev, manager: event.target.value }))}>
                    {managerOptions.map(option => (
                        <option key={option} value={option}>
                            {option === ALL_OPTION ? "全部经理" : option}
                        </option>
                    ))}
                </select>
                <select
                    value={filters.ruleType}
                    onChange={event =>
                        setFilters(prev => ({ ...prev, ruleType: event.target.value as DemoFilters["ruleType"] }))
                    }>
                    {[ALL_OPTION, "金额", "比例"].map(option => (
                        <option key={option} value={option}>
                            {option === ALL_OPTION ? "全部规则类型" : option}
                        </option>
                    ))}
                </select>
                <label style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                    <span>选择方式</span>
                    <select
                        value={rowSelectionBehavior}
                        onChange={event =>
                            setRowSelectionBehavior(
                                event.target.value as NonNullable<DataEditorAllProps["cellRowSelectionBehavior"]>
                            )
                        }>
                        <option value="row-span">合并单元格联动选中</option>
                        <option value="single-row">仅选中当前行</option>
                    </select>
                </label>
                <button type="button" onClick={removeSelectedRules} disabled={selectedRuleIds.size === 0}>
                    删除映射规则
                </button>
                <button type="button" onClick={resetDemo}>
                    重置 Demo
                </button>
                <div style={{ fontSize: 13, color: "#ccc" }}>
                    {selectedScope === undefined
                        ? "点击表头可排序；筛选后 rowSpan 会按当前可视结果重算；点击第一个操作列的复制图标会新增图中类似的划入账户数据"
                        : `当前选中${selectedScope.type}「${selectedScope.label}」，映射到 ${selectedScope.rowCount} 条真实规则`}
                </div>
            </div>

            <div
                style={{
                    display: "flex",
                    gap: 16,
                    alignItems: "center",
                    fontSize: 13,
                    flexWrap: "wrap",
                    color: "#ccc",
                }}>
                <span>排序字段：{SORT_LABELS[sortState.key]}</span>
                <span>排序方向：{sortState.direction === "asc" ? "升序" : "降序"}</span>
                <span>原始规则数：{countRuleRows(groups)}</span>
                <span>当前可视规则数：{visibleRows.length}</span>
                <span>{filters.query !== deferredQuery ? "筛选结果刷新中" : "视图映射已同步"}</span>
            </div>

            <DataEditor
                {...defaultProps}
                height={520}
                getCellContent={getCellContent}
                columns={columns}
                getGroupDetails={getGroupDetails}
                rows={totalRows}
                rowHeight={ROW_HEIGHT}
                drawCell={drawCell}
                onCellClicked={onCellClicked}
                onHeaderClicked={onHeaderClicked}
                onColumnResize={onColumnResize}
                gridSelection={gridSelection}
                onGridSelectionChange={onGridSelectionChange}
                columnSelect="none"
                cellRowSelectionBehavior={rowSelectionBehavior}
                rowSpanBorderBehavior="collapse-inner"
                freezeColumns={1}
                groupHeaderHeight={30}
                headerHeight={38}
                rowMarkers={{
                    kind: "number",
                    width: 56,
                    headerTheme: makeHeaderTheme({
                        bgHeader: "#232323",
                        textHeader: "#f3f4ef",
                    }),
                }}
                horizontalBorder={true}
            />
            <div
                style={{
                    border: "1px solid #d7dce5",
                    borderRadius: 8,
                    background: "#f8fafc",
                    padding: 12,
                    fontFamily: "monospace",
                    fontSize: 12,
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                }}>
                {[
                    "可视行 -> 真实路径映射",
                    `gridSelection.rows -> [${gridSelection.rows.toArray().join(", ")}]`,
                    currentCellMapping === undefined
                        ? "current.cell -> undefined"
                        : `current.cell -> ${JSON.stringify(currentCellMapping)}`,
                    `activeSort -> ${JSON.stringify(sortState)}`,
                    `filters -> ${JSON.stringify(viewFilters)}`,
                    `mappedRows -> ${JSON.stringify(selectedRowMappings, null, 2)}`,
                ].join("\n")}
            </div>
        </div>
    );
};
