import React from "react";
import { DataEditorAll as DataEditor } from "../../data-editor-all.js";
import {
    BeautifulWrapper,
    Description,
    MoreInfo,
    PropName,
    useMockDataGenerator,
    defaultProps,
    clearCell,
} from "../../data-editor/stories/utils.js";
import { GridCellKind, type FillHandleDirection } from "../../internal/data-grid/data-grid-types.js";
import { SimpleThemeWrapper } from "../../stories/story-utils.js";

const customCursorSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
    <circle cx="10" cy="10" r="2.25" fill="#0f172a" stroke="#ffffff" stroke-width="1.5" />
    <path
        d="M10 1.75v5.25M10 13v5.25M1.75 10h5.25M13 10h5.25"
        stroke="#0f172a"
        stroke-linecap="round"
        stroke-width="2.5"
    />
    <path
        d="M10 1.75v5.25M10 13v5.25M1.75 10h5.25M13 10h5.25"
        stroke="#ffffff"
        stroke-linecap="round"
        stroke-width="1.25"
    />
</svg>
`.trim();

const customCursor = `url("data:image/svg+xml,${encodeURIComponent(customCursorSvg)}") 10 10, crosshair`;

export default {
    title: "Glide-Data-Grid/DataEditor Demos",

    decorators: [
        (Story: React.ComponentType) => (
            <SimpleThemeWrapper>
                <BeautifulWrapper
                    title="Fill handle"
                    description={
                        <>
                            <Description>Fill handles can be used to downfill data with the mouse.</Description>
                            <MoreInfo>
                                Just click and drag, the top row will be copied down. Enable using the{" "}
                                <PropName>fillHandle</PropName> prop. The <PropName>cursor</PropName> option accepts
                                full CSS cursor declarations, including image cursors such as{" "}
                                <code>{'url("/cursors/fill.cur") 7 7, crosshair'}</code>.
                            </MoreInfo>
                        </>
                    }>
                    <Story />
                </BeautifulWrapper>
            </SimpleThemeWrapper>
        ),
    ],
    argTypes: {
        fillHandleEnabled: { control: "boolean", name: "fillHandle enabled" },
        shape: { control: { type: "inline-radio" }, options: ["square", "circle"], name: "shape" },
        size: { control: { type: "number" }, name: "size" },
        offsetX: { control: { type: "number" }, name: "offsetX" },
        offsetY: { control: { type: "number" }, name: "offsetY" },
        outline: { control: { type: "number" }, name: "outline" },
        cursor: { control: { type: "text" }, name: "cursor" },
        allowedFillDirections: {
            control: { type: "inline-radio" },
            options: ["horizontal", "vertical", "orthogonal", "any"],
            name: "allowedFillDirections",
        },
    },
    args: {
        fillHandleEnabled: true,
        shape: "square",
        size: 4,
        offsetX: -2,
        offsetY: -2,
        outline: 0,
        cursor: "crosshair",
        allowedFillDirections: "orthogonal",
    },
};

export const FillHandle: React.VFC<{
    fillHandleEnabled: boolean;
    shape: "square" | "circle";
    size: number;
    offsetX: number;
    offsetY: number;
    outline: number;
    cursor: string;
    allowedFillDirections: FillHandleDirection;
}> = ({ fillHandleEnabled, shape, size, offsetX, offsetY, outline, cursor, allowedFillDirections }) => {
    const { cols, getCellContent, setCellValueRaw, setCellValue } = useMockDataGenerator(60, false);

    const [numRows, setNumRows] = React.useState(50);

    const getCellContentMangled = React.useCallback<typeof getCellContent>(
        i => {
            let val = getCellContent(i);
            if (i[0] === 1 && val.kind === GridCellKind.Text) {
                val = {
                    ...val,
                    readonly: true,
                };
            }

            return val;
        },
        [getCellContent]
    );

    const onRowAppended = React.useCallback(() => {
        const newRow = numRows;
        for (let c = 0; c < 6; c++) {
            const cell = getCellContent([c, newRow]);
            setCellValueRaw([c, newRow], clearCell(cell));
        }
        setNumRows(cv => cv + 1);
    }, [getCellContent, numRows, setCellValueRaw]);

    return (
        <DataEditor
            {...defaultProps}
            showFilter
            filterHeight={30}
            getCellContent={getCellContentMangled}
            columns={cols}
            rowMarkers={"both"}
            onPaste={true}
            fillHandle={fillHandleEnabled ? { shape, size, offsetX, offsetY, outline, cursor } : false}
            allowedFillDirections={allowedFillDirections}
            keybindings={{ downFill: true, rightFill: true }}
            onCellEdited={setCellValue}
            trailingRowOptions={{
                sticky: true,
                tint: true,
                hint: "New row...",
            }}
            rows={12}
            onRowAppended={onRowAppended}
        />
    );
};

export const CustomCursorFillHandle: React.VFC<React.ComponentProps<typeof FillHandle>> = props => {
    return <FillHandle {...props} />;
};

(CustomCursorFillHandle as any).args = {
    fillHandleEnabled: true,
    shape: "square",
    size: 6,
    offsetX: -2,
    offsetY: -2,
    outline: 1,
    cursor: customCursor,
    allowedFillDirections: "orthogonal",
};

(CustomCursorFillHandle as any).storyName = "Fill handle with custom image cursor";
