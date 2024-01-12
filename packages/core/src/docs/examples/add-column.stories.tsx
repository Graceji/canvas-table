import React, { useState } from "react";
import { DataEditorAll as DataEditor } from "../../data-editor-all.js";
import {
    BeautifulWrapper,
    Description,
    MoreInfo,
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
                    title="Add and remove columns"
                    description={
                        <>
                            <Description>You can add and remove columns at your disposal</Description>
                            <MoreInfo>Use the story&apos;s controls to change the number of columns</MoreInfo>
                        </>
                    }>
                    <Story />
                </BeautifulWrapper>
            </SimpleThemeWrapper>
        ),
    ],
};

interface AddColumnsProps {
    columnsCount: number;
}

const iconHead = `<svg width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg">`;

export const AddColumns: React.FC<AddColumnsProps> = p => {
    const { cols, getCellContent } = useMockDataGenerator(p.columnsCount);
    const [filterValue, setFilterValue] = useState("filter");

    const getFilterCellContent = (col: number): GridCell => {
        if (col !== 0) {
            return {
                kind: GridCellKind.Text,
                data: filterValue,
                displayData: filterValue,
                allowOverlay: true,
            };
        }

        return null;
    };

    return (
        <DataEditor
            {...defaultProps}
            headerIcons={{
                newOrder: () =>
                    `<svg t="1703830894638" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="8974" width="16" height="16"><path d="M512 957.952c-246.272 0-445.952-199.68-445.952-445.952S265.728 66.048 512 66.048 957.952 265.728 957.952 512 758.272 957.952 512 957.952zM764.416 363.52c0-54.784-44.544-98.816-99.328-98.816h-296.96c-54.784 0-99.328 44.544-99.328 98.816v296.96c0 54.784 44.544 99.328 99.328 99.328H665.6c54.784 0 99.328-44.544 99.328-99.328l-0.512-296.96z m-99.328 346.624h-296.96c-27.136 0-49.664-22.016-49.664-49.664V363.52c0-27.136 22.016-49.664 49.664-49.664H665.6c27.648 0 49.664 22.016 49.664 49.664v296.96c-0.512 27.648-22.528 49.664-50.176 49.664z m-24.576-297.472H392.704c-13.824 0-24.576 11.264-24.576 24.576s11.264 24.576 24.576 24.576h247.808c13.824 0 24.576-11.264 24.576-24.576 0-13.312-10.752-24.576-24.576-24.576z m0 99.328H392.704c-13.824 0-24.576 11.264-24.576 24.576 0 13.824 11.264 24.576 24.576 24.576h247.808c13.824 0 24.576-11.264 24.576-24.576C665.6 523.264 654.336 512 640.512 512z" p-id="8975"></path></svg>`,
                actionOrder: () =>
                    `<svg t="1703830921941" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="9168" width="16" height="16"><path d="M511.914 63.99c-247.012 0-447.925 200.912-447.925 447.924s200.913 447.925 447.925 447.925 447.925-200.913 447.925-447.925S758.926 63.989 511.914 63.989z m159.285 511.913H480.263c-17.717 0-32.166-14.449-32.166-32.166V289.156c0-17.718 14.277-31.995 31.994-31.995s31.995 14.277 31.995 31.995v222.93h159.285c17.718 0 31.995 14.277 31.995 31.995s-14.45 31.822-32.167 31.822z" p-id="9169"></path></svg>`,
                workingOrder: () => `
                <svg t="1703829257834" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="19861" width="16" height="16"><path d="M512 63.5C264.3 63.5 63.5 264.3 63.5 512S264.3 960.5 512 960.5 960.5 759.7 960.5 512 759.7 63.5 512 63.5zM198 509.6h87.6c0-136.3 102.3-243.4 233.7-238.5 43.8 0 82.8 14.6 121.7 34.1L597.2 349c-24.4-9.8-53.6-19.5-82.8-19.5-92.5 0-170.4 77.9-170.4 180.1h87.6L314.8 631.3 198 509.6z m540.3-0.1c0 131.4-102.2 243.4-228.8 243.4-43.8 0-82.8-19.4-121.7-38.9l43.8-43.8c24.4 9.8 53.6 19.5 82.8 19.5 92.5 0 170.4-77.9 170.4-180.1h-92.5l116.9-121.7L826 509.5h-87.7z" p-id="19862"></path></svg>`,
                completeOrder: () =>
                    `<svg t="1703830970222" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="9362" width="16" height="16"><path d="M512 65.983C266.08 65.983 65.983 266.08 65.983 512c0 245.952 200.065 446.017 446.017 446.017S958.017 757.952 958.017 512c0-245.92-200.065-446.017-446.017-446.017z m215.231 372.45L471.008 697.438c-0.064 0.064-0.193 0.096-0.257 0.193-0.096 0.063-0.096 0.192-0.192 0.256-2.05 1.984-4.576 3.2-6.945 4.545-1.183 0.672-2.143 1.696-3.392 2.176-3.84 1.536-7.904 2.336-11.967 2.336-4.096 0-8.225-0.8-12.097-2.4-1.28-0.543-2.303-1.632-3.52-2.303-2.368-1.344-4.831-2.529-6.88-4.545-0.064-0.063-0.097-0.192-0.16-0.256-0.064-0.096-0.193-0.096-0.256-0.193L299.325 567.745c-12.32-12.673-12.033-32.928 0.64-45.248 12.673-12.288 32.895-12.064 45.248 0.64l103.263 106.112 233.28-235.84c12.417-12.576 32.705-12.703 45.248-0.256 12.516 12.448 12.644 32.703 0.227 45.28z" p-id="9363"></path></svg>`,
                cancelOrder: () =>
                    `<svg t="1703831014587" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="9556" width="16" height="16"><path d="M175.616 220.672C22.528 395.776 30.72 662.016 196.096 827.904c167.424 167.424 431.616 173.568 607.232 20.48L175.616 220.672zM849.408 803.84c151.552-175.104 144.896-441.344-22.528-607.232C659.968 29.184 395.264 23.04 220.16 174.08l629.248 629.76z" p-id="9557"></path></svg>`,
            }}
            rowMarkers="number-icon"
            rowMarkerWidth={75}
            getCellContent={getCellContent}
            // onCellEdited={(cell, newValue) => {
            //     if (newValue.kind === "marker") {
            //         console.log(cell, newValue);

            //         return;
            //     }
            //     setFilterValue(newValue.data);
            // }}
            getFilterCellContent={getFilterCellContent}
            experimental={{ strict: true }}
            columns={cols}
            rows={10_000}
            showFilter
            theme={{
                filterHeaderBg: "orange",
            }}
            customRenderers={allCells}
            drawCell={args => {
                const isRowMarkerCol = args.row === -3 && args.isRowMarkerCol;

                // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
                if (!isRowMarkerCol) return false;

                // draw
                return true;
            }}
        />
    );
};
(AddColumns as any).args = {
    columnsCount: 10,
};
(AddColumns as any).argTypes = {
    columnsCount: {
        control: {
            type: "range",
            min: 2,
            max: 200,
        },
    },
};
