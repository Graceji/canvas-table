import React, { useState } from "react";
import { DataEditorAll as DataEditor } from "../../data-editor-all.js";
import {
    BeautifulWrapper,
    Description,
    PropName,
    useMockDataGenerator,
    defaultProps,
} from "../../data-editor/stories/utils.js";
import { GridColumnIcon } from "../../internal/data-grid/data-grid-types.js";
import { SimpleThemeWrapper } from "../../stories/story-utils.js";

export default {
    title: "Glide-Data-Grid/DataEditor Demos",

    decorators: [
        (Story: React.ComponentType) => (
            <SimpleThemeWrapper>
                <BeautifulWrapper
                    title="Column Grouping"
                    description={
                        <Description>
                            Columns in the data grid may be grouped by setting their <PropName>group</PropName>{" "}
                            property.
                        </Description>
                    }>
                    <Story />
                </BeautifulWrapper>
            </SimpleThemeWrapper>
        ),
    ],
};

function swapArrayElements(arr, index1, index2) {
    // 检查索引是否有效
    if (index1 < 0 || index1 >= arr.length || index2 < 0 || index2 >= arr.length) {
        // console.error("Invalid indices provided.");
        return;
    }

    // 交换两个位置的元素
    const temp = arr[index1];
    arr[index1] = arr[index2];
    arr[index2] = temp;

    return arr;
}

export const ColumnGroups: React.VFC = () => {
    const { cols, getCellContent } = useMockDataGenerator(20, true, true);

    const [columns, setColumns] = useState(cols);

    return (
        <DataEditor
            {...defaultProps}
            getCellContent={getCellContent}
            onGroupHeaderRenamed={(x, y) => window.alert(`Please rename group ${x} to ${y}`)}
            columns={columns}
            rows={1000}
            getGroupDetails={g => ({
                name: g,
                icon: g === "" ? undefined : GridColumnIcon.HeaderCode,
            })}
            rowMarkers="both"
            isDraggable={false}
            onColumnMoved={(s, e) => {
                const current = columns[s];
                const target = columns[e];

                if (current.group !== target.group && current.group !== undefined) {
                    current.group = target.group;
                }

                setColumns(swapArrayElements([...columns], s, e));
                // if (current.group !== undefined) {
                // }
            }}
            onDragStart={e => {
                e.setData("text/plain", "Drag data here!");
            }}
        />
    );
};

(ColumnGroups as any).argTypes = {
    isDraggable: {
        control: { type: "select" },
        options: [true, false, "cell", "header"],
    },
};
(ColumnGroups as any).args = {
    isDraggable: false,
};
