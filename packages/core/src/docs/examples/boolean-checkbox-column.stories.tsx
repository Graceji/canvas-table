import React from "react";
import { DataEditorAll as DataEditor } from "../../data-editor-all.js";
import { BeautifulWrapper, Description, PropName, defaultProps } from "../../data-editor/stories/utils.js";
import {
    BooleanIndeterminate,
    GridCellKind,
    GridColumnIcon,
    type GridCell,
    type GridColumn,
    type Item,
} from "../../index.js";
import { SimpleThemeWrapper } from "../../stories/story-utils.js";

type DemoRow = {
    readonly symbol: string;
    readonly excluded: boolean;
    readonly locked: boolean;
};

const columns: GridColumn[] = [
    {
        title: "Symbol",
        width: 160,
        icon: GridColumnIcon.HeaderString,
    },
    {
        title: "Exclude",
        width: 96,
        icon: GridColumnIcon.HeaderBoolean,
    },
    {
        title: "Readonly",
        width: 96,
        icon: GridColumnIcon.HeaderBoolean,
    },
];

const initialRows: DemoRow[] = [
    { symbol: "688200.SH", excluded: false, locked: true },
    { symbol: "688617.SH", excluded: true, locked: false },
    { symbol: "300750.SZ", excluded: false, locked: true },
    { symbol: "511880.SH", excluded: true, locked: false },
    { symbol: "184801.SZ", excluded: false, locked: true },
];

const rowHeight = 34;

export default {
    title: "Glide-Data-Grid/DataEditor Demos",
    decorators: [
        (Story: React.ComponentType) => (
            <SimpleThemeWrapper>
                <BeautifulWrapper
                    title="Boolean Checkbox Column"
                    description={
                        <Description>
                            Return <PropName>GridCellKind.Boolean</PropName> from <PropName>getCellContent</PropName> to
                            render a checkbox column. The same cell kind can also be returned from{" "}
                            <PropName>getFilterCellContent</PropName>.
                        </Description>
                    }>
                    <Story />
                </BeautifulWrapper>
            </SimpleThemeWrapper>
        ),
    ],
};

export const BooleanCheckboxColumn: React.VFC = () => {
    const [rows, setRows] = React.useState(initialRows);

    const excludedHeaderValue = React.useMemo(() => {
        if (rows.length === 0) return false;

        const excludedCount = rows.filter(row => row.excluded).length;
        if (excludedCount === 0) return false;
        if (excludedCount === rows.length) return true;
        return BooleanIndeterminate;
    }, [rows]);

    const getCellContent = React.useCallback(
        ([col, row]: Item): GridCell => {
            const rowData = rows[row];
            if (rowData === undefined) {
                return {
                    kind: GridCellKind.Loading,
                    allowOverlay: false,
                };
            }

            switch (col) {
                case 0:
                    return {
                        kind: GridCellKind.Text,
                        data: rowData.symbol,
                        displayData: rowData.symbol,
                        allowOverlay: false,
                    };
                case 1:
                    return {
                        kind: GridCellKind.Boolean,
                        data: rowData.excluded,
                        allowOverlay: false,
                        readonly: false,
                        contentAlign: "center",
                    };
                case 2:
                    return {
                        kind: GridCellKind.Boolean,
                        data: rowData.locked,
                        allowOverlay: false,
                        readonly: true,
                        contentAlign: "center",
                    };
                default:
                    return {
                        kind: GridCellKind.Text,
                        data: "",
                        displayData: "",
                        allowOverlay: false,
                    };
            }
        },
        [rows]
    );

    const getFilterCellContent = React.useCallback(
        (col: number): GridCell => {
            if (col === 1) {
                return {
                    kind: GridCellKind.Boolean,
                    data: excludedHeaderValue,
                    allowOverlay: false,
                    readonly: false,
                    contentAlign: "center",
                };
            }

            return {
                kind: GridCellKind.Text,
                data: "",
                displayData: "",
                allowOverlay: false,
            };
        },
        [excludedHeaderValue]
    );

    const onCellEdited = React.useCallback((cell: Item, newValue: GridCell) => {
        if (newValue.kind !== GridCellKind.Boolean) return;

        const [col, row] = cell;
        if (row === -3 && col === 1) {
            setRows(currentRows => currentRows.map(rowData => ({ ...rowData, excluded: newValue.data === true })));
            return;
        }

        if (col !== 1 || row < 0) return;

        setRows(currentRows =>
            currentRows.map((rowData, rowIndex) =>
                rowIndex === row
                    ? {
                          ...rowData,
                          excluded: newValue.data === true,
                      }
                    : rowData
            )
        );
    }, []);

    return (
        <DataEditor
            {...defaultProps}
            columns={columns}
            rows={rows.length}
            getCellContent={getCellContent}
            getFilterCellContent={getFilterCellContent}
            onCellEdited={onCellEdited}
            height="100%"
            rowHeight={rowHeight}
            filterHeight={rowHeight}
            showFilter
            rowMarkers="number"
        />
    );
};

BooleanCheckboxColumn.displayName = "BooleanCheckboxColumn";
