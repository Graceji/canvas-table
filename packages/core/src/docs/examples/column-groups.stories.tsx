import React, { useRef, useState } from "react";
import { DataEditorAll as DataEditor } from "../../data-editor-all.js";
import {
    BeautifulWrapper,
    Description,
    PropName,
    useMockDataGenerator,
    defaultProps,
} from "../../data-editor/stories/utils.js";
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

// function swapArrayElements(arr, index1, index2) {
//     // 检查索引是否有效
//     if (index1 < 0 || index1 >= arr.length || index2 < 0 || index2 >= arr.length) {
//         // console.error("Invalid indices provided.");
//         return;
//     }

//     // 交换两个位置的元素
//     const temp = arr[index1];
//     arr[index1] = arr[index2];
//     arr[index2] = temp;

//     return arr;
// }

export const ColumnGroups: React.VFC = () => {
    const { cols, getCellContent, onColumnResize } = useMockDataGenerator(20, true, true);

    const [columns, setColumns] = useState(cols);

    const [expandMap, setExpandMap] = useState({});

    const gridRef = useRef();

    return (
        <DataEditor
            {...defaultProps}
            ref={gridRef}
            getCellContent={getCellContent}
            // onGroupHeaderRenamed={(x, y) => window.alert(`Please rename group ${x} to ${y}`)}
            columns={cols}
            rows={1000}
            freezeColumns={2}
            getGroupDetails={g => {
                return {
                    name: g,
                    // icon: g === "" ? undefined : GridColumnIcon.HeaderCode,
                    collapse: (expandMap as any)[g] ?? false,
                    actions: [
                        {
                            title: "Collapse",
                            // icon: actionIcon,
                            onClick: e => {
                                setExpandMap({
                                    ...expandMap,
                                    // eslint-disable-next-line no-extra-boolean-cast
                                    [g]: !Boolean((expandMap as any)[g]),
                                });
                                setColumns([...columns]);
                                gridRef.current?.updateCells?.([
                                    {
                                        cell: [e.location[0] - 1, e.location[1]],
                                    },
                                ]);
                            },
                        },
                    ],
                } as any;
            }}
            rowMarkers="both"
            rowSelectionBlending="mixed"
            columnSelectionBlending="mixed"
            rangeSelect="none"
            isDraggable={false}
            onColumnMoved={(s, e) => {
                const current = columns[s];
                const target = columns[e];

                if (target.group !== current.group) {
                    current.group = target.group;
                }

                // setColumns(swapArrayElements([...columns], s, e));
            }}
            onDragStart={e => {
                e.setData("text/plain", "Drag data here!");
            }}
            onColumnProposeMove={(start, end) => {
                // const endCol = columns[end - 1];

                // if (endCol.frozen) {
                //     return false;
                // }

                return true;
            }}
            onColumnResize={onColumnResize}
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
