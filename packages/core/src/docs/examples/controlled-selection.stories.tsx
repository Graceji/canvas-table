import React from "react";
import { DataEditorAll as DataEditor } from "../../data-editor-all.js";
import {
    BeautifulWrapper,
    Description,
    PropName,
    useMockDataGenerator,
    defaultProps,
} from "../../data-editor/stories/utils.js";
import type { GridSelection } from "../../internal/data-grid/data-grid-types.js";
import { CompactSelection } from "../../internal/data-grid/data-grid-types.js";
import { SimpleThemeWrapper } from "../../stories/story-utils.js";

export default {
    title: "Glide-Data-Grid/DataEditor Demos",

    decorators: [
        (Story: React.ComponentType) => (
            <SimpleThemeWrapper>
                <Story />
            </SimpleThemeWrapper>
        ),
    ],
};

export const ControlledSelection: React.VFC = () => {
    const { cols, getCellContent } = useMockDataGenerator(30, true, true);

    const [selection, setSelection] = React.useState<GridSelection>({
        columns: CompactSelection.empty(),
        rows: CompactSelection.empty(),
    });

    const onSelectionChange = (newSel: GridSelection) => {
        setSelection(newSel);
        // let newRows = CompactSelection.empty();
        // if (newSel.current !== undefined) {
        //     const newSelection: Slice = [newSel.current.range.y, newSel.current.range.y + newSel.current.range.height];
        //     // eslint-disable-next-line unicorn/prefer-ternary
        //     if (selection.rows.hasAll(newSelection)) {
        //         newRows = newRows.remove(newSelection);
        //     } else {
        //         newRows = newRows.add([newSel.current.range.y, newSel.current.range.y + newSel.current.range.height]);
        //     }
        // }
        // for (const b of newSel.current?.rangeStack ?? []) {
        //     newRows = newRows.add([b.y, b.y + b.height]);
        // }
        // setSelection({
        //     ...newSel,
        //     rows: newRows,
        // });
    };

    return (
        <BeautifulWrapper
            title="Controlled Selection"
            description={
                <Description>
                    The selection of the grid can be controlled via <PropName>GridSelection</PropName> and{" "}
                    <PropName>onGridSelectionChange</PropName>.
                    <input
                        type="range"
                        min={0}
                        max={29}
                        value={selection.current?.cell[0] ?? 0}
                        onChange={e => {
                            const newCol = e.target.valueAsNumber;
                            setSelection(cv => ({
                                ...cv,
                                current: {
                                    cell: [newCol, cv.current?.cell[1] ?? 0],
                                    range: {
                                        x: newCol,
                                        y: cv.current?.cell[1] ?? 0,
                                        width: 1,
                                        height: 1,
                                    },
                                    rangeStack: [],
                                },
                            }));
                        }}
                    />
                    <input
                        type="range"
                        min={0}
                        max={99}
                        value={selection.current?.cell[1] ?? 0}
                        onChange={e => {
                            const newRow = e.target.valueAsNumber;

                            setSelection(cv => ({
                                ...cv,
                                current: {
                                    cell: [cv.current?.cell[0] ?? 0, newRow],
                                    range: {
                                        x: cv.current?.cell[0] ?? 0,
                                        y: newRow,
                                        width: 1,
                                        height: 1,
                                    },
                                    rangeStack: [],
                                },
                            }));
                        }}
                    />
                </Description>
            }>
            <DataEditor
                {...defaultProps}
                getCellContent={getCellContent}
                gridSelection={selection}
                rangeSelect="none"
                onGridSelectionChange={onSelectionChange}
                // onGridSelectionChange={setSelection}
                columns={cols}
                rows={100}
                rowMarkers="both"
            />
        </BeautifulWrapper>
    );
};
