/* eslint-disable no-console */
import React from "react";
import { DataEditorAll as DataEditor } from "../../data-editor-all.js";
import {
    BeautifulWrapper,
    Description,
    MoreInfo,
    useMockDataGenerator,
    defaultProps,
} from "../../data-editor/stories/utils.js";
import { SimpleThemeWrapper } from "../../stories/story-utils.js";
import { CompactSelection } from "../../index.js";

export default {
    title: "Glide-Data-Grid/DataEditor Demos",

    decorators: [
        (Story: React.ComponentType) => (
            <SimpleThemeWrapper>
                <BeautifulWrapper
                    title="Obscured Data Grid"
                    description={
                        <>
                            <Description>The data grid should respect being obscured by other elements</Description>
                            <MoreInfo>This is mostly a test area because its hard to test with unit tests.</MoreInfo>
                        </>
                    }>
                    <Story />
                    <div
                        style={{
                            position: "absolute",
                            top: 0,
                            left: "50%",
                            width: "50%",
                            height: "100%",
                            background: "rgba(0,0,0,0.5)",
                            zIndex: 100,
                        }}
                    />
                </BeautifulWrapper>
            </SimpleThemeWrapper>
        ),
    ],
};

export const ObscuredDataGrid: React.VFC = () => {
    const { cols, getCellContent, setCellValue } = useMockDataGenerator(60, false);
    const [selection, setSelection] = React.useState<GridSelection>({
        columns: CompactSelection.empty(),
        rows: CompactSelection.empty(),
    });

    return (
        <DataEditor
            {...defaultProps}
            getCellContent={getCellContent}
            // onItemHovered={x => console.log("onItemHovered", x)}
            // onCellClicked={x => console.log("onCellClicked", x)}
            // onHeaderClicked={x => console.log("onHeaderClicked", x)}
            onCellContextMenu={x => {
                setSelection({
                    ...selection,
                    rows: CompactSelection.fromSingleSelection([x[1], x[1 + 1]]),
                });
            }}
            onHeaderContextMenu={(x, event) => {
                event.preventDefault();
            }}
            gridSelection={selection}
            onGridSelectionChange={setSelection}
            columns={cols}
            rowMarkers={"both"}
            onPaste={true} // we want to allow paste to just call onCellEdited
            onCellEdited={setCellValue} // Sets the mock cell content
            trailingRowOptions={{
                // How to get the trailing row to look right
                sticky: true,
                tint: true,
                hint: "New row...",
            }}
            rows={10_000}
        />
    );
};
