/* eslint-disable sonarjs/no-duplicate-string */
import * as React from "react";
import { assert, assertNever, maybe } from "../common/support.js";
import clamp from "lodash/clamp.js";
import uniq from "lodash/uniq.js";
import flatten from "lodash/flatten.js";
import makeRange from "lodash/range.js";
import debounce from "lodash/debounce.js";
import {
    type EditableGridCell,
    type GridCell,
    GridCellKind,
    type GridSelection,
    isEditableGridCell,
    type Rectangle,
    isRectangleEqual,
    isReadWriteCell,
    type InnerGridCell,
    InnerGridCellKind,
    CompactSelection,
    type Slice,
    isInnerOnlyCell,
    type ProvideEditorCallback,
    type GridColumn,
    isObjectEditorCallbackResult,
    type Item,
    type MarkerCell,
    type ValidatedGridCell,
    type ImageEditorType,
    type CustomCell,
    BooleanEmpty,
    BooleanIndeterminate,
    type FillHandleDirection,
    type EditListItem,
    type CellActivationBehavior,
    type MarkerFn,
    type CellArray,
    type MarkerMeta,
} from "../internal/data-grid/data-grid-types.js";
import DataGridSearch, { type DataGridSearchProps } from "../internal/data-grid-search/data-grid-search.js";
import { browserIsOSX } from "../common/browser-detect.js";
import {
    getDataEditorTheme,
    makeCSSStyle,
    type FullTheme,
    type Theme,
    ThemeContext,
    mergeAndRealizeTheme,
} from "../common/styles.js";
import type { DataGridRef } from "../internal/data-grid/data-grid.js";
import { getScrollBarWidth, useEventListener, whenDefined } from "../common/utils.js";
import {
    isGroupEqual,
    itemsAreEqual,
    itemIsInRect,
    gridSelectionHasItem,
    getFreezeTrailingHeight,
} from "../internal/data-grid/render/data-grid-lib.js";
import { GroupRename } from "./group-rename.js";
import { measureColumn, useColumnSizer } from "./use-column-sizer.js";
import { isHotkey } from "../common/is-hotkey.js";
import { type SelectionBlending, useSelectionBehavior } from "../internal/data-grid/use-selection-behavior.js";
import { useCellsForSelection } from "./use-cells-for-selection.js";
import {
    unquote,
    expandSelection,
    copyToClipboard,
    toggleBoolean,
    expandSelectionOutlineToCellBounds,
} from "./data-editor-fns.js";
import { DataEditorContainer } from "../internal/data-editor-container/data-grid-container.js";
import { useAutoscroll } from "./use-autoscroll.js";
import type { CustomRenderer, CellRenderer, InternalCellRenderer } from "../cells/cell-types.js";
import { decodeHTML, type CopyBuffer } from "./copy-paste.js";
import { useRemAdjuster } from "./use-rem-adjuster.js";
import { withAlpha } from "../internal/data-grid/color-parser.js";
import { combineRects, getClosestRect, pointInRect } from "../common/math.js";
import {
    type HeaderClickedEventArgs,
    type GroupHeaderClickedEventArgs,
    type CellClickedEventArgs,
    type FillPatternEventArgs,
    type GridMouseEventArgs,
    groupHeaderKind,
    outOfBoundsKind,
    type GridMouseCellEventArgs,
    type GridDragEventArgs,
    mouseEventArgsAreEqual,
    type GridKeyEventArgs,
    type CellActivatedEventArgs,
    type GridMouseFilterHeaderEventArgs,
    filterHeaderKind,
    headerKind,
    type CellContextEventArgs,
} from "../internal/data-grid/event-args.js";
import { type Keybinds, useKeybindingsWithDefaults } from "./data-editor-keybindings.js";
import type { Highlight } from "../internal/data-grid/render/data-grid-render.cells.js";
import { useRowGroupingInner, type RowGroupingOptions } from "./row-grouping.js";
import { useRowGrouping } from "./row-grouping-api.js";
import { useInitialScrollOffset } from "./use-initial-scroll-offset.js";
import type { VisibleRegion } from "./visible-region.js";
import { getMarkerActionBoundsForGroup } from "../internal/data-grid/render/data-grid-render.header.js";

const DataGridOverlayEditor = React.lazy(
    async () => await import("../internal/data-grid-overlay-editor/data-grid-overlay-editor.js")
);

// There must be a better way
let idCounter = 0;

export interface RowMarkerOptions {
    kind: "checkbox" | "number" | "clickable-number" | "checkbox-visible" | "both" | "none";
    checkboxStyle?: "circle" | "square";
    startIndex?: number;
    width?: number;
    theme?: Partial<Theme>;
    headerTheme?: Partial<Theme>;
    headerAlwaysVisible?: boolean;
    headerDisabled?: boolean;
    fns?: MarkerFn[];
    group?: string;
    getTheme?: (row: number) => FullTheme;
}

interface MouseState {
    readonly previousSelection?: GridSelection;
    readonly fillHandle?: boolean;
}

type HoverResolvedGridMouseEventArgs = GridMouseEventArgs & {
    readonly resolvedCell?: InnerGridCell;
};

export type CellRowSelectionBehavior = "single-row" | "row-span";
export type RowSpanBorderBehavior = "default" | "collapse-inner";

type Props = Partial<
    Omit<
        DataGridSearchProps,
        | "accessibilityHeight"
        | "canvasRef"
        | "cellXOffset"
        | "cellYOffset"
        | "className"
        | "clientSize"
        | "columns"
        | "disabledRows"
        | "drawFocusRing"
        | "enableGroups"
        | "firstColAccessible"
        | "firstColSticky"
        | "freezeColumns"
        | "hasAppendRow"
        | "getCellContent"
        | "getCellRenderer"
        | "getCellsForSelection"
        | "getRowThemeOverride"
        | "gridRef"
        | "groupHeaderHeight"
        | "headerHeight"
        | "isFilling"
        | "isFocused"
        | "imageWindowLoader"
        | "lockColumns"
        | "maxColumnWidth"
        | "minColumnWidth"
        | "nonGrowWidth"
        | "onCanvasBlur"
        | "onCanvasFocused"
        | "onCellFocused"
        | "onContextMenu"
        | "onDragEnd"
        | "onMouseDown"
        | "onMouseMove"
        | "onMouseUp"
        | "onVisibleRegionChanged"
        | "rowHeight"
        | "rows"
        | "scrollRef"
        | "searchInputRef"
        | "selectedColumns"
        | "selection"
        | "theme"
        | "translateX"
        | "translateY"
        | "verticalBorder"
        | "horizontalBorder"
    >
>;

type EmitEvents = "copy" | "paste" | "delete" | "fill-right" | "fill-down";

function getSpanStops(cells: readonly (readonly GridCell[])[]): number[] {
    return uniq(
        flatten(
            flatten(cells)
                .filter(c => c.span !== undefined)
                .map(c => makeRange((c.span?.[0] ?? 0) + 1, (c.span?.[1] ?? 0) + 1))
        )
    );
}

function shiftSelection(input: GridSelection, offset: number): GridSelection {
    if (input === undefined || offset === 0 || (input.columns.length === 0 && input.current === undefined))
        return input;

    return {
        current:
            input.current === undefined
                ? undefined
                : {
                      cell: [input.current.cell[0] + offset, input.current.cell[1]],
                      range: {
                          ...input.current.range,
                          x: input.current.range.x + offset,
                      },
                      rangeStack: input.current.rangeStack.map(r => ({
                          ...r,
                          x: r.x + offset,
                      })),
                  },
        rows: input.rows,
        columns: input.columns.offset(offset),
    };
}

function selectionMatches(a: GridSelection | undefined, b: GridSelection | undefined): boolean {
    if (a === b) return true;
    if (a === undefined || b === undefined) return false;
    if (!a.rows.equals(b.rows) || !a.columns.equals(b.columns)) return false;

    const currentA = a.current;
    const currentB = b.current;
    if (currentA === undefined || currentB === undefined) return currentA === currentB;

    return (
        itemsAreEqual(currentA.cell, currentB.cell) &&
        currentA.range.x === currentB.range.x &&
        currentA.range.y === currentB.range.y &&
        currentA.range.width === currentB.range.width &&
        currentA.range.height === currentB.range.height &&
        currentA.rangeStack.length === currentB.rangeStack.length &&
        currentA.rangeStack.every((rangeA, index) => {
            const rangeB = currentB.rangeStack[index];
            return (
                rangeA.x === rangeB.x &&
                rangeA.y === rangeB.y &&
                rangeA.width === rangeB.width &&
                rangeA.height === rangeB.height
            );
        })
    );
}

const maxDenseCopyCells = 100_000;
const maxSparseDenseCopyCells = 10_000;
const maxDenseCopySparsity = 64;

/**
 * @category DataEditor
 */
export interface DataEditorProps extends Props, Pick<DataGridSearchProps, "imageWindowLoader"> {
    /** Emitted whenever the user has requested the deletion of the selection.
     * @group Editing
     */
    readonly onDelete?: (selection: GridSelection) => boolean | GridSelection;
    /** Emitted whenever a cell edit is completed.
     * @group Editing
     */
    readonly onCellEdited?: (cell: Item, newValue: EditableGridCell, eventKey?: string) => void;
    /** Emitted when a cell editor is closed without any edit (e.g. click outside or Enter with no input).
     * `originalValue` is the cell's content at the time the editor was opened, which can be used to
     * distinguish between "cell had no content" and "cell had content but was not modified".
     * @group Editing
     */
    readonly onCellBlur?: (cell: Item, originalValue: GridCell, eventKey?: string) => void;
    /** Emitted whenever a cell mutation is completed and provides all edits inbound as a single batch.
     * @group Editing
     */
    readonly onCellsEdited?: (newValues: readonly EditListItem[], eventKey?: string) => boolean | void;
    /** Emitted whenever a row append operation is requested. Append location can be set in callback.
     * @group Editing
     */
    readonly onRowAppended?: () => Promise<"top" | "bottom" | number | undefined> | void;
    /** Emitted whenever a column append operation is requested. Append location can be set in callback.
     * @group Editing
     */
    readonly onColumnAppended?: () => Promise<"left" | "right" | number | undefined> | void;
    /** Emitted when a column header should show a context menu. Usually right click.
     * @group Events
     */
    readonly onHeaderClicked?: (colIndex: number, event: HeaderClickedEventArgs) => void;
    /** Emitted when a group header is clicked.
     * @group Events
     */
    readonly onGroupHeaderClicked?: (colIndex: number, event: GroupHeaderClickedEventArgs) => void;
    /** Emitted whe the user wishes to rename a group.
     * @group Events
     */
    readonly onGroupHeaderRenamed?: (groupName: string, newVal: string) => void;
    /** Emitted when a cell is clicked.
     * @group Events
     */
    readonly onCellClicked?: (cell: Item, event: CellClickedEventArgs) => void;
    /**
     * 点击已选中行的正文单元格时调用。返回 true 时保留当前行选中结果，不进入后续反选/范围选择逻辑
     * @group Events
     */
    readonly keepRowSelectionOnCellClick?: (args: {
        readonly cell: Item;
        readonly gridCell: GridCell;
        readonly targetRowSlice: readonly [start: number, end: number];
        readonly selectedRows: CompactSelection;
        readonly isSelected: boolean;
        readonly isMultiKey: boolean;
        readonly shiftKey: boolean;
    }) => boolean;
    /** Emitted when a cell is activated, by pressing Enter, Space or double clicking it.
     * @group Events
     */
    readonly onCellActivated?: (cell: Item, event: CellActivatedEventArgs) => void;

    /**
     * Emitted whenever the user initiats a pattern fill using the fill handle. This event provides both
     * a patternSource region and a fillDestination region, and can be prevented.
     * @group Editing
     */
    readonly onFillPattern?: (event: FillPatternEventArgs) => void;

    /** Emitted when editing has finished, regardless of data changing or not.
     * @group Editing
     */
    readonly onFinishedEditing?: (newValue: GridCell | undefined, movement: Item, eventKey?: string) => void;

    /** Emitted editing, regardless of data changing or not.
     * @group Editing
     */
    readonly onCellEditing?: (cell: Item, newValue: GridCell | undefined) => void;

    /** Emitted when a column header should show a context menu. Usually right click.
     * @group Events
     */
    readonly onHeaderContextMenu?: (colIndex: number, event: HeaderClickedEventArgs) => void;
    /** Emitted when a group header should show a context menu. Usually right click.
     * @group Events
     */
    readonly onGroupHeaderContextMenu?: (colIndex: number, event: GroupHeaderClickedEventArgs) => void;
    /** Emitted when a cell should show a context menu. Usually right click.
     * @group Events
     */
    readonly onCellContextMenu?: (cell: Item, event: CellContextEventArgs) => void;
    /** Used for validating cell values during editing.
     * @group Editing
     * @param cell The cell which is being validated.
     * @param newValue The new value being proposed.
     * @param prevValue The previous value before the edit.
     * @returns A return of false indicates the value will not be accepted. A value of
     * true indicates the value will be accepted. Returning a new GridCell will immediately coerce the value to match.
     */
    readonly validateCell?: (
        cell: Item,
        newValue: EditableGridCell,
        prevValue: GridCell
    ) => boolean | ValidatedGridCell;

    /** The columns to display in the data grid.
     * @group Data
     */
    readonly columns: readonly GridColumn[];

    /** Controls the trailing row used to insert new data into the grid.
     * @group Editing
     */
    readonly trailingRowOptions?: {
        /** If the trailing row should be tinted */
        readonly tint?: boolean;
        /** A hint string displayed on hover. Usually something like "New row" */
        readonly hint?: string;
        /** When set to true, the trailing row is always visible. */
        readonly sticky?: boolean;
        /** The icon to use for the cell. Either a GridColumnIcon or a member of the passed headerIcons */
        readonly addIcon?: string;
        /** Overrides the column to focus when a new row is created. */
        readonly targetColumn?: number | GridColumn;
        /** hint 是否显示在marker列 */
        readonly marker?: boolean;
        readonly contentAlign?: "center" | 'left | "right';
    };
    /** Controls the height of the header row
     * @defaultValue 36
     * @group Style
     */
    readonly headerHeight?: number;
    /** Controls the header of the group header row
     * @defaultValue `headerHeight`
     * @group Style
     */
    readonly groupHeaderHeight?: number;

    /**
     * The number of rows in the grid.
     * @group Data
     */
    readonly rows: number;

    /** Determines if row markers should be automatically added to the grid.
     * Interactive row markers allow the user to select a row.
     *
     * - "clickable-number" renders a number that can be clicked to
     *   select the row
     * - "both" causes the row marker to show up as a number but
     *   reveal a checkbox when the marker is hovered.
     *
     * @defaultValue `none`
     * @group Style
     */
    readonly rowMarkers?: RowMarkerOptions["kind"] | RowMarkerOptions;
    /**
     * Sets the width of row markers in pixels, if unset row markers will automatically size.
     * @group Style
     * @deprecated Use `rowMarkers` instead.
     */
    readonly rowMarkerWidth?: number;
    /** Changes the starting index for row markers.
     * @defaultValue 1
     * @group Style
     * @deprecated Use `rowMarkers` instead.
     */
    readonly rowMarkerStartIndex?: number;

    /** Changes the theme of the row marker column
     * @group Style
     * @deprecated Use `rowMarkers` instead.
     */
    readonly rowMarkerTheme?: Partial<Theme>;

    /** Sets the width of the data grid.
     * @group Style
     */
    readonly width?: number | string;
    /** Sets the height of the data grid.
     * @group Style
     */
    readonly height?: number | string;
    /** Custom classname for data grid wrapper.
     * @group Style
     */
    readonly className?: string;

    /** If set to `default`, `gridSelection` will be coerced to always include full spans.
     * @group Selection
     * @defaultValue `default`
     */
    readonly spanRangeBehavior?: "default" | "allowPartial";

    /** Controls which types of selections can exist at the same time in the grid. If selection blending is set to
     * exclusive, the grid will clear other types of selections when the exclusive selection is made. By default row,
     * column, and range selections are exclusive.
     * @group Selection
     * @defaultValue `exclusive`
     * */
    readonly rangeSelectionBlending?: SelectionBlending;
    /** {@inheritDoc rangeSelectionBlending}
     * @group Selection
     */
    readonly columnSelectionBlending?: SelectionBlending;
    /** {@inheritDoc rangeSelectionBlending}
     * @group Selection
     */
    readonly rowSelectionBlending?: SelectionBlending;
    /** Controls if multi-selection is allowed. If disabled, shift/ctrl/command clicking will work as if no modifiers
     * are pressed.
     *
     * When range select is set to cell, only one cell may be selected at a time. When set to rect one one rect at a
     * time. The multi variants allow for multiples of the rect or cell to be selected.
     * @group Selection
     * @defaultValue `rect`
     */
    readonly rangeSelect?: "none" | "cell" | "rect" | "multi-cell" | "multi-rect";
    /** {@inheritDoc rangeSelect}
     * @group Selection
     * @defaultValue `multi`
     */
    readonly columnSelect?: "none" | "single" | "multi";
    /** {@inheritDoc rangeSelect}
     * @group Selection
     * @defaultValue `multi`
     */
    readonly rowSelect?: "none" | "single" | "multi";

    /** Controls how clicking a body cell maps to row selection when row selection is enabled.
     * `single-row` selects only the clicked physical row.
     * `row-span` expands row selection to the full vertical row-span group when the clicked cell defines `rowSpan`.
     * @group Selection
     * @defaultValue `single-row`
     */
    readonly cellRowSelectionBehavior?: CellRowSelectionBehavior;
    /** Controls how horizontal borders behave for vertically merged (`rowSpan`) cells.
     * `default` keeps the existing grid or `horizontalBorder` behavior.
     * `collapse-inner` hides the internal borders inside a rowSpan block and only keeps the final bottom border.
     * @group Selection
     * @defaultValue `default`
     */
    readonly rowSpanBorderBehavior?: RowSpanBorderBehavior;

    /** Controls if range selection is allowed to span columns.
     * @group Selection
     * @defaultValue `true`
     */
    readonly rangeSelectionColumnSpanning?: boolean;

    /** Sets the initial scroll Y offset.
     * @see {@link scrollOffsetX}
     * @group Advanced
     */
    readonly scrollOffsetY?: number;
    /** Sets the initial scroll X offset
     * @see {@link scrollOffsetY}
     * @group Advanced
     */
    readonly scrollOffsetX?: number;

    /** Determins the height of each row.
     * @group Style
     * @defaultValue 34
     */
    readonly rowHeight?: DataGridSearchProps["rowHeight"];
    /** Fires whenever the mouse moves
     * @group Events
     * @param args
     */
    readonly onMouseMove?: DataGridSearchProps["onMouseMove"];

    /**
     * The minimum width a column can be resized to.
     * @defaultValue 50
     * @group Style
     */
    readonly minColumnWidth?: DataGridSearchProps["minColumnWidth"];
    /**
     * The maximum width a column can be resized to.
     * @defaultValue 500
     * @group Style
     */
    readonly maxColumnWidth?: DataGridSearchProps["maxColumnWidth"];
    /**
     * The maximum width a column can be automatically sized to.
     * @defaultValue `maxColumnWidth`
     * @group Style
     */
    readonly maxColumnAutoWidth?: number;

    /**
     * Used to provide an override to the default image editor for the data grid. `provideEditor` may be a better
     * choice for most people.
     * @group Advanced
     * */
    readonly imageEditorOverride?: ImageEditorType;
    /**
     * If specified, it will be used to render Markdown, instead of the default Markdown renderer used by the Grid.
     * You'll want to use this if you need to process your Markdown for security purposes, or if you want to use a
     * renderer with different Markdown features.
     * @group Advanced
     */
    readonly markdownDivCreateNode?: (content: string) => DocumentFragment;

    /**
     * Allows overriding the theme of any row
     * @param row represents the row index of the row, increasing by 1 for every represented row. Collapsed rows are not included.
     * @param groupRow represents the row index of the group row. Only distinct when row grouping enabled.
     * @param contentRow represents the index of the row excluding group headers. Only distinct when row grouping enabled.
     * @returns
     */
    readonly getRowThemeOverride?: (row: number, groupRow: number, contentRow: number) => Partial<Theme> | undefined;

    /** Callback for providing a custom editor for a cell.
     * @group Editing
     */
    readonly provideEditor?: ProvideEditorCallback<GridCell>;
    /**
     * Allows coercion of pasted values.
     * @group Editing
     * @param val The pasted value
     * @param cell The cell being pasted into
     * @returns `undefined` to accept default behavior or a `GridCell` which should be used to represent the pasted value.
     */
    readonly coercePasteValue?: (val: string, cell: GridCell) => GridCell | undefined;

    /**
     * Emitted when the grid selection is cleared.
     * @group Selection
     */
    readonly onSelectionCleared?: () => void;

    /**
     * The current selection of the data grid. Contains all selected cells, ranges, rows, and columns.
     * Used in conjunction with {@link onGridSelectionChange}
     * method to implement a controlled selection.
     * @group Selection
     */
    readonly gridSelection?: GridSelection;
    /**
     * Emitted whenever the grid selection changes. Specifying
     * this function will make the grid’s selection controlled, so
     * so you will need to specify {@link gridSelection} as well. See
     * the "Controlled Selection" example for details.
     *
     * @param newSelection The new gridSelection as created by user input.
     * @group Selection
     */
    readonly onGridSelectionChange?: (newSelection: GridSelection) => void;
    /**
     * Emitted whenever the visible cells change, usually due to scrolling.
     * @group Events
     * @param range An inclusive range of all visible cells. May include cells obscured by UI elements such
     * as headers.
     * @param tx The x transform of the cell region.
     * @param ty The y transform of the cell region.
     * @param extras Contains information about the selected cell and
     * any visible freeze columns.
     */
    readonly onVisibleRegionChanged?: (
        range: Rectangle,
        tx: number,
        ty: number,
        extras: {
            /** The selected item if visible */
            selected?: Item;
            /** A selection of visible freeze columns
             * @deprecated
             */
            freezeRegion?: Rectangle;

            /**
             * All visible freeze regions
             */
            freezeRegions?: readonly Rectangle[];
        }
    ) => void;

    /**
     * The primary callback for getting cell data into the data grid.
     * @group Data
     * @param cell The location of the cell being requested.
     * @returns A valid GridCell to be rendered by the Grid.
     */
    readonly getCellContent: (cell: Item) => GridCell;

    readonly getFilterCellContent?: (col: number) => GridCell;
    readonly getRowMarkerFilterCellContent?: () => GridCell;

    /**
     * The primary callback for getting marker cell data into the data grid.
     * @group Data
     * @param row The location of the row.
     * @returns row data.
     */
    readonly getMarkerContent?: (row: number) => MarkerMeta | undefined;

    /**
     * Determines if row selection requires a modifier key to enable multi-selection or not. In auto mode it adapts to
     * touch or mouse environments automatically, in multi-mode it always acts as if the multi key (Ctrl) is pressed.
     * @group Editing
     * @defaultValue `auto`
     */
    readonly rowSelectionMode?: "auto" | "multi";

    /**
     * Determines if column selection requires a modifier key to enable multi-selection or not. In auto mode it adapts to
     * touch or mouse environments automatically, in multi-mode it always acts as if the multi key (Ctrl) is pressed.
     * @group Editing
     * @defaultValue `auto`
     */
    readonly columnSelectionMode?: "auto" | "multi";

    /**
     * Add table headers to copied data.
     * @group Editing
     * @defaultValue `false`
     */
    readonly copyHeaders?: boolean;

    /**
     * Determins which keybindings are enabled.
     * @group Editing
     */
    readonly keybindings?: Partial<Keybinds>;

    /**
     * Determines if the data editor should immediately begin editing when the user types on a selected cell
     * @group Editing
     */
    readonly editOnType?: boolean;

    /**
     * Used to fetch large amounts of cells at once. Used for copy/paste, if unset copy will not work.
     *
     * `getCellsForSelection` is called when the user copies a selection to the clipboard or the data editor needs to
     * inspect data which may be outside the curently visible range. It must return a two-dimensional array (an array of
     * rows, where each row is an array of cells) of the cells in the selection's rectangle. Note that the rectangle can
     * include cells that are not currently visible.
     *
     * If `true` is passed instead of a callback, the data grid will internally use the `getCellContent` callback to
     * provide a basic implementation of `getCellsForSelection`. This can make it easier to light up more data grid
     * functionality, but may have negative side effects if your data source is not able to handle being queried for
     * data outside the normal window.
     *
     * If `getCellsForSelection` returns a thunk, the data may be loaded asynchronously, however the data grid may be
     * unable to properly react to column spans when performing range selections. Copying large amounts of data out of
     * the grid will depend on the performance of the thunk as well.
     * @group Data
     * @param {Rectangle} selection The range of requested cells
     * @param {AbortSignal} abortSignal A signal indicating the requested cells are no longer needed
     * @returns A row-major collection of cells or an async thunk which returns a row-major collection.
     */
    readonly getCellsForSelection?: DataGridSearchProps["getCellsForSelection"] | true;

    /** The number of columns which should remain in place when scrolling horizontally. The row marker column, if
     * enabled is always frozen and is not included in this count.
     * @defaultValue 0
     * @group Style
     */
    readonly freezeColumns?: DataGridSearchProps["freezeColumns"];

    /**
     * Controls the drawing of the left hand vertical border of a column. If set to a boolean value it controls all
     * borders.
     * @defaultValue `true`
     * @group Style
     */
    readonly verticalBorder?: DataGridSearchProps["verticalBorder"] | boolean;

    readonly horizontalBorder?: DataGridSearchProps["horizontalBorder"] | boolean;

    /**
     * Controls the grouping of rows to be drawn in the grid.
     */
    readonly rowGrouping?: RowGroupingOptions;

    /**
     * Called when data is pasted into the grid. If left undefined, the `DataEditor` will operate in a
     * fallback mode and attempt to paste the text buffer into the current cell assuming the current cell is not
     * readonly and can accept the data type. If `onPaste` is set to false or the function returns false, the grid will
     * simply ignore paste. If `onPaste` evaluates to true the grid will attempt to split the data by tabs and newlines
     * and paste into available cells.
     *
     * The grid will not attempt to add additional rows if more data is pasted then can fit. In that case it is
     * advisable to simply return false from onPaste and handle the paste manually.
     * @group Editing
     */
    readonly onPaste?: ((target: Item, values: readonly (readonly string[])[]) => boolean) | boolean;

    /**
     * The theme used by the data grid to get all color and font information
     * @group Style
     */
    readonly theme?: Partial<Theme>;

    readonly renderers?: readonly InternalCellRenderer<InnerGridCell>[];

    /**
     * An array of custom renderers which can be used to extend the data grid.
     * @group Advanced
     */
    readonly customRenderers?: readonly CustomRenderer<any>[];

    /**
     * Scales most elements in the theme to match rem scaling automatically
     * @defaultValue false
     */
    readonly scaleToRem?: boolean;

    /**
     * Custom predicate function to decide whether the click event occurred outside the grid
     * Especially used when custom editor is opened with the portal and is outside the grid, but there is no possibility
     * to add a class "click-outside-ignore"
     * If this function is supplied and returns false, the click event is ignored
     */
    readonly isOutsideClick?: (e: MouseEvent | TouchEvent) => boolean;

    /**
     * Controls which directions fill is allowed in.
     */
    readonly allowedFillDirections?: FillHandleDirection;

    /**
     * Determines when a cell is considered activated and will emit the `onCellActivated` event. Generally an activated
     * cell will open to edit mode.
     */
    readonly cellActivationBehavior?: CellActivationBehavior;

    /**
     * Controls if focus will trap inside the data grid when doing tab and caret navigation.
     */
    readonly trapFocus?: boolean;

    /**
     * Allows overriding the default amount of bloom (the size growth of the overlay editor)
     */
    readonly editorBloom?: readonly [number, number];

    /**
     * If set to true, the data grid will attempt to scroll to keep the selction in view
     */
    readonly scrollToActiveCell?: boolean;

    readonly drawFocusRing?: boolean | "no-editor";

    /**
     * Allows overriding the default portal element.
     */
    readonly portalElementRef?: React.RefObject<HTMLElement>;

    readonly showFilter?: boolean;

    readonly filterHeight?: number;

    readonly onCopy?: (cells: CellArray, item: Item) => void;
}

type ScrollToFn = (
    col: number | { amount: number; unit: "cell" | "px" },
    row: number | { amount: number; unit: "cell" | "px" },
    dir?: "horizontal" | "vertical" | "both",
    paddingX?: number,
    paddingY?: number,
    options?: {
        hAlign?: "start" | "center" | "end";
        vAlign?: "start" | "center" | "end";
        behavior?: ScrollBehavior;
    }
) => void;

const defaultFilterCell: GridCell = {
    kind: GridCellKind.Text,
    allowOverlay: true,
    data: "",
    displayData: "",
};

const defaultRowMarkerFilterCell: GridCell = {
    kind: GridCellKind.Loading,
    allowOverlay: false,
};

/** @category DataEditor */
export interface DataEditorRef {
    /**
     * Programatically appends a row.
     * @param col The column index to focus in the new row.
     * @returns A promise which waits for the append to complete.
     */
    appendRow: (col: number, openOverlay?: boolean, behavior?: ScrollBehavior) => Promise<void>;
    /**
     * Programatically appends a column.
     * @param row The row index to focus in the new column.
     * @returns A promise which waits for the append to complete.
     */
    appendColumn: (row: number, openOverlay?: boolean) => Promise<void>;
    /**
     * Triggers cells to redraw.
     */
    updateCells: DataGridRef["damage"];
    /**
     * Gets the screen space bounds of the requested item.
     */
    getBounds: DataGridRef["getBounds"];
    /**
     * Triggers the data grid to focus itself or the correct accessibility element.
     */
    focus: DataGridRef["focus"];
    /**
     * Generic API for emitting events as if they had been triggered via user interaction.
     */
    emit: (eventName: EmitEvents) => Promise<void>;
    /**
     * Scrolls to the desired cell or location in the grid.
     */
    scrollTo: ScrollToFn;
    /**
     * Causes the columns in the selection to have their natural size recomputed and re-emitted as a resize event.
     */
    remeasureColumns: (cols: CompactSelection) => void;
    /**
     * Gets the mouse args from pointer event position.
     */
    getMouseArgsForPosition: (
        posX: number,
        posY: number,
        ev?: MouseEvent | TouchEvent
    ) => GridMouseEventArgs | undefined;

    getScrollClientHeight: () => number | undefined;

    getCanvasRect: () => DOMRect | undefined;

    closeEditor: () => void;
    /**
     * Programmatically focus a cell and open it in edit mode.
     * @param col The column index (0-based, excluding row markers).
     * @param row The row index (0-based).
     */
    focusCell: (col: number, row: number) => void;
}

const loadingCell: GridCell = {
    kind: GridCellKind.Loading,
    allowOverlay: false,
};

export const emptyGridSelection: GridSelection = {
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
    current: undefined,
};

const DataEditorImpl: React.ForwardRefRenderFunction<DataEditorRef, DataEditorProps> = (p, forwardedRef) => {
    const [gridSelectionInner, setGridSelectionInner] = React.useState<GridSelection>(emptyGridSelection);

    const [overlay, setOverlay] = React.useState<{
        target: Rectangle;
        content: GridCell;
        theme: FullTheme;
        initialValue: string | undefined;
        cell: Item;
        highlight: boolean;
        forceEditMode: boolean;
        activation: CellActivatedEventArgs;
    }>();
    const searchInputRef = React.useRef<HTMLInputElement | null>(null);
    const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
    const [mouseState, setMouseState] = React.useState<MouseState>();
    const lastSent = React.useRef<[number, number]>();

    const safeWindow = typeof window === "undefined" ? null : window;

    const {
        imageEditorOverride,
        getRowThemeOverride: getRowThemeOverrideIn,
        markdownDivCreateNode,
        width,
        height,
        columns: columnsIn,
        rows: rowsIn,
        getCellContent,
        getMarkerContent,
        getFilterCellContent,
        getRowMarkerFilterCellContent: getRowMarkerFilterCellContentIn,
        onCellClicked,
        keepRowSelectionOnCellClick,
        onCellActivated,
        onFillPattern,
        onCellEditing,
        onFinishedEditing,
        coercePasteValue,
        drawHeader: drawHeaderIn,
        drawCell: drawCellIn,
        editorBloom,
        onHeaderClicked,
        onColumnProposeMove,
        rangeSelectionColumnSpanning = true,
        spanRangeBehavior = "default",
        onGroupHeaderClicked,
        onCellContextMenu,
        className,
        onHeaderContextMenu,
        getCellsForSelection: getCellsForSelectionIn,
        onGroupHeaderContextMenu,
        onGroupHeaderRenamed,
        onCellEdited,
        onCellsEdited,
        onCellBlur,
        onSearchResultsChanged: onSearchResultsChangedIn,
        searchResults,
        onSearchValueChange,
        searchValue,
        onKeyDown: onKeyDownIn,
        onKeyUp: onKeyUpIn,
        keybindings: keybindingsIn,
        editOnType = true,
        onRowAppended,
        onColumnAppended,
        onColumnMoved,
        validateCell: validateCellIn,
        highlightRegions: highlightRegionsIn,
        rangeSelect = "rect",
        columnSelect = "multi",
        rowSelect = "multi",
        cellRowSelectionBehavior = "single-row",
        rowSpanBorderBehavior = "default",
        rangeSelectionBlending = "exclusive",
        columnSelectionBlending = "exclusive",
        rowSelectionBlending = "exclusive",
        onDelete: onDeleteIn,
        onDragStart,
        onMouseMove,
        onPaste,
        copyHeaders = false,
        freezeColumns = 0,
        cellActivationBehavior = "second-click",
        rowSelectionMode = "auto",
        columnSelectionMode = "auto",
        onHeaderMenuClick,
        onHeaderIndicatorClick,
        onFilterClearClick,
        getGroupDetails,
        rowGrouping,
        onSearchClose: onSearchCloseIn,
        onItemHovered,
        onSelectionCleared,
        showSearch: showSearchIn,
        onVisibleRegionChanged,
        gridSelection: gridSelectionOuter,
        onGridSelectionChange,
        minColumnWidth: minColumnWidthIn = 50,
        maxColumnWidth: maxColumnWidthIn = 500,
        maxColumnAutoWidth: maxColumnAutoWidthIn,
        provideEditor,
        trailingRowOptions,
        freezeTrailingRows = 0,
        allowedFillDirections = "orthogonal",
        scrollOffsetX,
        scrollOffsetY,
        verticalBorder,
        horizontalBorder,
        onDragOverCell,
        onDrop,
        onColumnResize: onColumnResizeIn,
        onColumnResizeEnd: onColumnResizeEndIn,
        onColumnResizeStart: onColumnResizeStartIn,
        customRenderers: additionalRenderers,
        fillHandle,
        experimental,
        fixedShadowX,
        fixedShadowY,
        headerIcons,
        imageWindowLoader,
        initialSize,
        isDraggable,
        onDragLeave,
        onRowMoved,
        overscrollX: overscrollXIn,
        overscrollY: overscrollYIn,
        preventDiagonalScrolling,
        rightElement,
        rightElementProps,
        trapFocus = false,
        smoothScrollX,
        smoothScrollY,
        scaleToRem = false,
        rowHeight: rowHeightIn = 34,
        headerHeight: headerHeightIn = 36,
        groupHeaderHeight: groupHeaderHeightIn = headerHeightIn,
        theme: themeIn,
        isOutsideClick,
        renderers,
        resizeIndicator,
        scrollToActiveCell = true,
        drawFocusRing: drawFocusRingIn = true,
        portalElementRef,
        showFilter = false,
        filterHeight = 20,
        onCopy: onCopyOuter,
    } = p;

    const drawFocusRing = drawFocusRingIn === "no-editor" ? overlay === undefined : drawFocusRingIn;

    const rowMarkersObj = typeof p.rowMarkers === "string" ? undefined : p.rowMarkers;

    const rowMarkers = rowMarkersObj?.kind ?? (p.rowMarkers as RowMarkerOptions["kind"]) ?? "none";
    const rowMarkerWidthRaw = rowMarkersObj?.width ?? p.rowMarkerWidth;
    const rowMarkerStartIndex = rowMarkersObj?.startIndex ?? p.rowMarkerStartIndex ?? 1;
    const rowMarkerTheme = rowMarkersObj?.theme ?? p.rowMarkerTheme;
    const headerRowMarkerTheme = rowMarkersObj?.headerTheme;
    const headerRowMarkerAlwaysVisible = rowMarkersObj?.headerAlwaysVisible;
    const headerRowMarkerDisabled = rowSelect !== "multi" || rowMarkersObj?.headerDisabled === true;
    const rowMarkerCheckboxStyle = rowMarkersObj?.checkboxStyle ?? "square";
    const rowMarkerGroup = rowMarkersObj?.group ?? undefined;

    const minColumnWidth = Math.max(minColumnWidthIn, 20);
    const maxColumnWidth = Math.max(maxColumnWidthIn, minColumnWidth);
    const maxColumnAutoWidth = Math.max(maxColumnAutoWidthIn ?? maxColumnWidth, minColumnWidth);

    const keyboardMoveFilterCell = React.useRef(false);

    const docStyle = React.useMemo(() => {
        if (typeof window === "undefined") return { fontSize: "16px" };
        return window.getComputedStyle(document.documentElement);
    }, []);

    const {
        rows,
        rowNumberMapper,
        rowHeight: rowHeightPostGrouping,
        getRowThemeOverride,
    } = useRowGroupingInner(rowGrouping, rowsIn, rowHeightIn, getRowThemeOverrideIn);

    const remSize = React.useMemo(() => Number.parseFloat(docStyle.fontSize), [docStyle]);
    const { rowHeight, headerHeight, groupHeaderHeight, theme, overscrollX, overscrollY } = useRemAdjuster({
        groupHeaderHeight: groupHeaderHeightIn,
        headerHeight: headerHeightIn,
        overscrollX: overscrollXIn,
        overscrollY: overscrollYIn,
        remSize,
        rowHeight: rowHeightPostGrouping,
        scaleToRem,
        theme: themeIn,
    });

    const keybindings = useKeybindingsWithDefaults(keybindingsIn);

    const rowMarkerWidth = rowMarkerWidthRaw ?? (rowsIn > 10_000 ? 48 : rowsIn > 1000 ? 44 : rowsIn > 100 ? 36 : 32);
    const hasRowMarkers = rowMarkers !== "none";
    const rowMarkerOffset = hasRowMarkers ? 1 : 0;
    const showTrailingBlankRow = trailingRowOptions !== undefined;
    const lastRowSticky = trailingRowOptions?.sticky === true;

    const [showSearchInner, setShowSearchInner] = React.useState(false);
    // 负责索引列的 focus ring
    // 索引列点击时我们不会写入 current.cell，否则会污染正文单元格的选中链路
    // 因此单独保存一个 rowMarkerFocus，只给 ring 定位使用
    const [rowMarkerFocus, setRowMarkerFocus] = React.useState<Item | undefined>();
    const showSearch = showSearchIn ?? showSearchInner;

    const onSearchClose = React.useCallback(() => {
        if (onSearchCloseIn !== undefined) {
            onSearchCloseIn();
        } else {
            setShowSearchInner(false);
        }
    }, [onSearchCloseIn]);

    const gridSelectionOuterMangled: GridSelection | undefined = React.useMemo((): GridSelection | undefined => {
        return gridSelectionOuter === undefined ? undefined : shiftSelection(gridSelectionOuter, rowMarkerOffset);
    }, [gridSelectionOuter, rowMarkerOffset]);
    const gridSelectionOuterRef = React.useRef(gridSelectionOuter);
    gridSelectionOuterRef.current = gridSelectionOuter;
    const gridSelection = gridSelectionOuterMangled ?? gridSelectionInner;

    const abortControllerRef = React.useRef() as React.MutableRefObject<AbortController>;
    if (abortControllerRef.current === undefined) abortControllerRef.current = new AbortController();

    React.useEffect(() => () => abortControllerRef?.current.abort(), []);

    const getRowMarkerFilterCellContent = React.useCallback((): GridCell => {
        return getRowMarkerFilterCellContentIn?.() ?? defaultRowMarkerFilterCell;
    }, [getRowMarkerFilterCellContentIn]);

    const getMangledFilterCellContent = React.useCallback(
        (col: number): GridCell => {
            if (col < rowMarkerOffset) {
                return getRowMarkerFilterCellContent();
            }
            return getFilterCellContent?.(col - rowMarkerOffset) ?? defaultFilterCell;
        },
        [getFilterCellContent, getRowMarkerFilterCellContent, rowMarkerOffset]
    );
    const getMangledFilterCellContentForGrid =
        getFilterCellContent === undefined && getRowMarkerFilterCellContentIn === undefined
            ? undefined
            : getMangledFilterCellContent;
    const getRowMarkerFilterCellContentForGrid =
        getRowMarkerFilterCellContentIn === undefined ? undefined : getRowMarkerFilterCellContent;

    const [getCellsForSelection, getCellsForSeletionDirect] = useCellsForSelection(
        getCellsForSelectionIn,
        getCellContent,
        getFilterCellContent,
        getRowMarkerFilterCellContentForGrid,
        rowMarkerOffset,
        abortControllerRef.current,
        rows
    );

    const validateCell = React.useCallback<NonNullable<typeof validateCellIn>>(
        (cell, newValue, prevValue) => {
            if (validateCellIn === undefined) return true;
            const item: Item = [cell[0] - rowMarkerOffset, cell[1]];
            return validateCellIn?.(item, newValue, prevValue);
        },
        [rowMarkerOffset, validateCellIn]
    );

    const expectedExternalGridSelection = React.useRef<GridSelection | undefined>(gridSelectionOuter);
    const expectedExternalGridSelectionFrom = React.useRef<GridSelection | undefined>(gridSelectionOuter);
    const setGridSelection = React.useCallback(
        (newVal: GridSelection, expand: boolean): void => {
            if (expand) {
                newVal = expandSelection(
                    newVal,
                    getCellsForSelection,
                    rowMarkerOffset,
                    spanRangeBehavior,
                    abortControllerRef.current
                );
            }
            if (onGridSelectionChange !== undefined) {
                expectedExternalGridSelection.current = shiftSelection(newVal, -rowMarkerOffset);
                expectedExternalGridSelectionFrom.current = gridSelectionOuterRef.current;
                onGridSelectionChange(expectedExternalGridSelection.current);
            } else {
                setGridSelectionInner(newVal);
            }
        },
        [getCellsForSelection, onGridSelectionChange, rowMarkerOffset, spanRangeBehavior]
    );

    const onColumnResize = whenDefined(
        onColumnResizeIn,
        React.useCallback<NonNullable<typeof onColumnResizeIn>>(
            (_, w, ind, wg) => {
                onColumnResizeIn?.(columnsIn[ind - rowMarkerOffset], w, ind - rowMarkerOffset, wg);
            },
            [onColumnResizeIn, rowMarkerOffset, columnsIn]
        )
    );

    const onColumnResizeEnd = whenDefined(
        onColumnResizeEndIn,
        React.useCallback<NonNullable<typeof onColumnResizeEndIn>>(
            (_, w, ind, wg) => {
                onColumnResizeEndIn?.(columnsIn[ind - rowMarkerOffset], w, ind - rowMarkerOffset, wg);
            },
            [onColumnResizeEndIn, rowMarkerOffset, columnsIn]
        )
    );

    const onColumnResizeStart = whenDefined(
        onColumnResizeStartIn,
        React.useCallback<NonNullable<typeof onColumnResizeStartIn>>(
            (_, w, ind, wg) => {
                onColumnResizeStartIn?.(columnsIn[ind - rowMarkerOffset], w, ind - rowMarkerOffset, wg);
            },
            [onColumnResizeStartIn, rowMarkerOffset, columnsIn]
        )
    );

    const drawHeader = whenDefined(
        drawHeaderIn,
        React.useCallback<NonNullable<typeof drawHeaderIn>>(
            (args, draw) => {
                return drawHeaderIn?.({ ...args, columnIndex: args.columnIndex - rowMarkerOffset }, draw) ?? false;
            },
            [drawHeaderIn, rowMarkerOffset]
        )
    );

    const drawCell = whenDefined(
        drawCellIn,
        React.useCallback<NonNullable<typeof drawCellIn>>(
            (args, draw) => {
                return drawCellIn?.({ ...args, col: args.col - rowMarkerOffset }, draw) ?? false;
            },
            [drawCellIn, rowMarkerOffset]
        )
    );

    const onDelete = React.useCallback<NonNullable<DataEditorProps["onDelete"]>>(
        sel => {
            if (onDeleteIn !== undefined) {
                const result = onDeleteIn(shiftSelection(sel, -rowMarkerOffset));
                if (typeof result === "boolean") {
                    return result;
                }
                return shiftSelection(result, rowMarkerOffset);
            }
            return true;
        },
        [onDeleteIn, rowMarkerOffset]
    );

    const [setCurrent, setSelectedRows, setSelectedColumns, setSelectedRowsAndCell] = useSelectionBehavior(
        gridSelection,
        setGridSelection,
        rangeSelectionBlending,
        columnSelectionBlending,
        rowSelectionBlending,
        rangeSelect,
        rangeSelectionColumnSpanning
    );

    const mergedTheme = React.useMemo(() => {
        return mergeAndRealizeTheme(getDataEditorTheme(), theme);
    }, [theme]);

    const [clientSize, setClientSize] = React.useState<readonly [number, number, number]>([0, 0, 0]);

    const rendererMap = React.useMemo(() => {
        if (renderers === undefined) return {};
        const result: Partial<Record<InnerGridCellKind | GridCellKind, InternalCellRenderer<InnerGridCell>>> = {};
        for (const r of renderers) {
            result[r.kind] = r;
        }
        return result;
    }, [renderers]);

    const getCellRenderer: <T extends InnerGridCell>(cell: T) => CellRenderer<T> | undefined = React.useCallback(
        <T extends InnerGridCell>(cell: T) => {
            if (cell.kind !== GridCellKind.Custom) {
                return rendererMap[cell.kind] as unknown as CellRenderer<T>;
            }
            return additionalRenderers?.find(x => x.isMatch(cell)) as CellRenderer<T>;
        },
        [additionalRenderers, rendererMap]
    );

    // eslint-disable-next-line prefer-const
    let { sizedColumns: columns, nonGrowWidth } = useColumnSizer(
        columnsIn,
        rows,
        getCellsForSeletionDirect,
        clientSize[0] - (rowMarkerOffset === 0 ? 0 : rowMarkerWidth) - clientSize[2],
        minColumnWidth,
        maxColumnAutoWidth,
        mergedTheme,
        getCellRenderer,
        abortControllerRef.current
    );
    if (rowMarkers !== "none") nonGrowWidth += rowMarkerWidth;

    const enableGroups = React.useMemo(() => {
        return columns.some(c => c.group !== undefined);
    }, [columns]);

    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
    const totalHeaderHeight = enableGroups ? headerHeight + groupHeaderHeight : headerHeight;

    const numSelectedRows = gridSelection.rows.length;
    const rowMarkerChecked =
        rowMarkers === "none" ? undefined : numSelectedRows === 0 ? false : numSelectedRows === rows ? true : undefined;

    const mangledCols = React.useMemo(() => {
        if (rowMarkers === "none") return columns;
        return [
            {
                title: "",
                width: rowMarkerWidth,
                icon: undefined,
                hasMenu: false,
                style: "normal" as const,
                themeOverride: rowMarkerTheme,
                rowMarker: rowMarkerCheckboxStyle,
                rowMarkerChecked,
                headerRowMarkerTheme,
                headerRowMarkerAlwaysVisible,
                headerRowMarkerDisabled,
                group: rowMarkerGroup,
            },
            ...columns,
        ];
    }, [
        rowMarkers,
        columns,
        rowMarkerWidth,
        rowMarkerTheme,
        rowMarkerCheckboxStyle,
        rowMarkerChecked,
        headerRowMarkerTheme,
        headerRowMarkerAlwaysVisible,
        headerRowMarkerDisabled,
        rowMarkerGroup,
    ]);

    const visibleRegionRef = React.useRef<VisibleRegion>({
        height: 1,
        width: 1,
        x: 0,
        y: 0,
    });

    const hasJustScrolled = React.useRef(false);

    const { setVisibleRegion, visibleRegion, scrollRef } = useInitialScrollOffset(
        scrollOffsetX,
        scrollOffsetY,
        rowHeight,
        visibleRegionRef,
        () => (hasJustScrolled.current = true)
    );

    visibleRegionRef.current = visibleRegion;

    const cellXOffset = visibleRegion.x + rowMarkerOffset;
    const cellYOffset = visibleRegion.y;

    const gridRef = React.useRef<DataGridRef | null>(null);

    const focus = React.useCallback((immediate?: boolean) => {
        if (immediate === true) {
            gridRef.current?.focus();
        } else {
            window.requestAnimationFrame(() => {
                gridRef.current?.focus();
            });
        }
    }, []);

    const mangledRows = showTrailingBlankRow ? rows + 1 : rows;

    const mangledOnCellsEdited = React.useCallback<NonNullable<typeof onCellsEdited>>(
        (items: readonly EditListItem[], eventKey?: string) => {
            const mangledItems =
                rowMarkerOffset === 0
                    ? items
                    : items.map(x => ({
                          ...x,
                          location: [x.location[0] - rowMarkerOffset, x.location[1]] as const,
                      }));

            const r = onCellsEdited?.(mangledItems, eventKey);

            if (r !== true) {
                for (const i of mangledItems) onCellEdited?.(i.location, i.value, eventKey);
            }

            return r;
        },
        [onCellEdited, onCellsEdited, rowMarkerOffset]
    );

    const [fillHighlightRegion, setFillHighlightRegion] = React.useState<Rectangle | undefined>();

    // this will generally be undefined triggering the memo less often
    const highlightRange =
        gridSelection.current !== undefined &&
        gridSelection.current.range.width * gridSelection.current.range.height > 1
            ? gridSelection.current.range
            : undefined;

    // 索引列点击时会保留正文 current，不把 row-marker 写回外部 gridSelection.current
    // 因此 ring 绘制必须优先消费 rowMarkerFocus，否则会继续沿用旧的正文焦点
    const highlightFocus = drawFocusRing ? (rowMarkerFocus ?? gridSelection.current?.cell) : undefined;
    const highlightFocusCol = highlightFocus?.[0];
    const highlightFocusRow = highlightFocus?.[1];

    React.useEffect(() => {
        // 受控模式下，rowMarkerFocus 代表“索引列单元格当前仍应显示 focus ring”
        // 外部 selection 只要还保留该行的行选中，就继续保留索引列 ring；
        // 真正清空 / 改成其它行 / 改成纯正文 selection 时再清掉，避免把索引列高亮框提前擦掉
        if (gridSelectionOuterMangled === undefined || rowMarkerFocus === undefined) return;

        const markerStillFocused = itemsAreEqual(gridSelectionOuterMangled.current?.cell, rowMarkerFocus);
        const markerRowStillSelected = gridSelectionOuterMangled.rows.hasIndex(rowMarkerFocus[1]);
        const expectedSelection = expectedExternalGridSelection.current;
        const expectedFromSelection = expectedExternalGridSelectionFrom.current;
        const waitingForExpectedSelection =
            expectedSelection !== undefined &&
            selectionMatches(gridSelectionOuter, expectedFromSelection) &&
            !selectionMatches(gridSelectionOuter, expectedSelection) &&
            expectedSelection.rows.hasIndex(rowMarkerFocus[1]);

        if (!markerStillFocused && !markerRowStillSelected && !waitingForExpectedSelection) {
            setRowMarkerFocus(undefined);
        }
    }, [gridSelectionOuter, gridSelectionOuterMangled, rowMarkerFocus]);

    const mangledColsRef = React.useRef(mangledCols);
    mangledColsRef.current = mangledCols;
    const getMangledCellContent = React.useCallback(
        ([col, row]: Item, forceStrict: boolean = false): InnerGridCell => {
            const isTrailing = showTrailingBlankRow && row === mangledRows - 1;
            const isRowMarkerCol = col === 0 && hasRowMarkers;
            if (isRowMarkerCol) {
                if (isTrailing) {
                    if (trailingRowOptions?.marker === true) {
                        const isFirst = col === 0;

                        const maybeFirstColumnHint = isFirst ? (trailingRowOptions?.hint ?? "") : "";
                        const c = mangledColsRef.current[col];

                        if (c?.trailingRowOptions?.disabled === true) {
                            return loadingCell;
                        } else {
                            const hint = c?.trailingRowOptions?.hint ?? maybeFirstColumnHint;
                            const icon = c?.trailingRowOptions?.addIcon ?? trailingRowOptions?.addIcon;
                            const showAddIcon = c?.trailingRowOptions?.showAddIcon;
                            return {
                                kind: InnerGridCellKind.NewRow,
                                hint,
                                allowOverlay: false,
                                icon,
                                showAddIcon,
                                contentAlign: c?.trailingRowOptions?.contentAlign ?? "center",
                            };
                        }
                    }
                    return loadingCell;
                }
                const mappedRow = rowNumberMapper(row);
                if (mappedRow === undefined) return loadingCell;

                const result = {
                    kind: InnerGridCellKind.Marker,
                    allowOverlay: false,
                    checkboxStyle: rowMarkerCheckboxStyle,
                    checked: gridSelection?.rows.hasIndex(row) === true,
                    markerKind: rowMarkers === "clickable-number" ? "number" : rowMarkers,
                    row: rowMarkerStartIndex + mappedRow,
                    drawHandle: onRowMoved !== undefined,
                    cursor: "pointer", // rowMarkers === "clickable-number" ? "pointer" : undefined,
                    functions: rowMarkersObj?.fns,
                    themeOverride: rowMarkersObj?.getTheme?.(mappedRow),
                } as MarkerCell;

                // 通过外部getMarkerContent获取行数据相关的信息
                const markerMeta = getMarkerContent?.(row);

                if (markerMeta !== undefined) {
                    result.meta = markerMeta;
                }

                return result;
            } else if (isTrailing) {
                //If the grid is empty, we will return text
                const isFirst = col === rowMarkerOffset;

                const maybeFirstColumnHint =
                    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
                    isFirst && !trailingRowOptions?.marker ? (trailingRowOptions?.hint ?? "") : "";
                const c = mangledColsRef.current[col];

                if (c?.trailingRowOptions?.disabled === true) {
                    return loadingCell;
                } else {
                    const hint = c?.trailingRowOptions?.hint ?? maybeFirstColumnHint;
                    const icon = c?.trailingRowOptions?.addIcon ?? trailingRowOptions?.addIcon;
                    const showAddIcon = c?.trailingRowOptions?.showAddIcon;
                    return {
                        kind: InnerGridCellKind.NewRow,
                        hint,
                        allowOverlay: false,
                        icon,
                        showAddIcon,
                        contentAlign: c?.trailingRowOptions?.contentAlign ?? c.align,
                    };
                }
            } else {
                const outerCol = col - rowMarkerOffset;

                if (forceStrict || experimental?.strict === true) {
                    const vr = visibleRegionRef.current;
                    const isOutsideMainArea =
                        vr.x > outerCol ||
                        outerCol > vr.x + vr.width ||
                        vr.y > row ||
                        row > vr.y + vr.height ||
                        row >= rowsRef.current;
                    const isSelected = outerCol === vr.extras?.selected?.[0] && row === vr.extras?.selected[1];
                    let isInFreezeArea = false;
                    if (vr.extras?.freezeRegions !== undefined) {
                        for (const fr of vr.extras.freezeRegions) {
                            if (pointInRect(fr, outerCol, row)) {
                                isInFreezeArea = true;
                                break;
                            }
                        }
                    }

                    if (isOutsideMainArea && !isSelected && !isInFreezeArea) {
                        return loadingCell;
                    }
                }
                let result =
                    row === -3 && getMangledFilterCellContentForGrid !== undefined
                        ? getMangledFilterCellContentForGrid(col)
                        : getCellContent([outerCol, row]);
                if (rowMarkerOffset !== 0 && result?.span !== undefined) {
                    result = {
                        ...result,
                        span: [result.span[0] + rowMarkerOffset, result.span[1] + rowMarkerOffset],
                    };
                }
                return result;
            }
        },
        [
            showTrailingBlankRow,
            mangledRows,
            hasRowMarkers,
            rowNumberMapper,
            rowMarkerCheckboxStyle,
            gridSelection?.rows,
            rowMarkers,
            rowMarkerStartIndex,
            onRowMoved,
            rowMarkersObj,
            getMarkerContent,
            trailingRowOptions?.marker,
            trailingRowOptions?.hint,
            trailingRowOptions?.addIcon,
            rowMarkerOffset,
            experimental?.strict,
            getMangledFilterCellContentForGrid,
            getCellContent,
        ]
    );

    const highlightFocusRange = React.useMemo<Rectangle | undefined>(() => {
        if (highlightFocusCol === undefined || highlightFocusRow === undefined) return undefined;
        if (highlightFocusRow < 0 || highlightFocusRow >= mangledRows) return undefined;
        // 索引列没有真实业务 cell，不能向下反查 rowSpan 信息
        if (highlightFocusCol < rowMarkerOffset) {
            return { x: highlightFocusCol, y: highlightFocusRow, width: 1, height: 1 };
        }

        try {
            const cell = getMangledCellContent([highlightFocusCol, highlightFocusRow]);
            const span = cell.span ?? [highlightFocusCol, highlightFocusCol];
            return {
                x: span[0],
                y: highlightFocusRow - (cell.rowSpanOffset ?? 0),
                width: span[1] - span[0] + 1,
                height: cell.rowSpan ?? 1,
            };
        } catch {
            return { x: highlightFocusCol, y: highlightFocusRow, width: 1, height: 1 };
        }
    }, [getMangledCellContent, highlightFocusCol, highlightFocusRow, mangledRows, rowMarkerOffset]);

    const highlightRegions = React.useMemo(() => {
        if (
            (highlightRegionsIn === undefined || highlightRegionsIn.length === 0) &&
            (highlightRange ?? highlightFocusCol ?? highlightFocusRow ?? fillHighlightRegion) === undefined
        )
            return undefined;

        const regions: Highlight[] = [];

        if (highlightRegionsIn !== undefined) {
            for (const r of highlightRegionsIn) {
                const maxWidth = mangledCols.length - r.range.x - rowMarkerOffset;
                if (maxWidth > 0) {
                    regions.push({
                        color: r.color,
                        range: {
                            ...r.range,
                            x: r.range.x + rowMarkerOffset,
                            width: Math.min(maxWidth, r.range.width),
                        },
                        style: r.style,
                        requiresFullRedraw: r.requiresFullRedraw,
                    });
                }
            }
        }

        if (fillHighlightRegion !== undefined) {
            regions.push({
                color: withAlpha(mergedTheme.accentColor, 0),
                range: fillHighlightRegion,
                style: "dashed",
            });
        }

        if (highlightRange !== undefined) {
            // range 选中时不能直接按原始矩形画框
            // 例如拖进一个 rowSpan 中间行时，视觉上仍应包住整个合并块
            const clampedHighlightRange: Rectangle = {
                x: Math.max(0, highlightRange.x),
                y: Math.max(0, highlightRange.y),
                width: Math.max(
                    0,
                    Math.min(mangledCols.length, highlightRange.x + highlightRange.width) -
                        Math.max(0, highlightRange.x)
                ),
                height: Math.max(
                    0,
                    Math.min(mangledRows, highlightRange.y + highlightRange.height) - Math.max(0, highlightRange.y)
                ),
            };
            const expandedOutlineRanges: Rectangle[] = expandSelectionOutlineToCellBounds(
                highlightRange,
                location => getMangledCellContent(location),
                mangledCols.length,
                mangledRows
            );
            const outlineRequiresFullRedraw =
                expandedOutlineRanges.length !== 1 ||
                expandedOutlineRanges[0].x !== clampedHighlightRange.x ||
                expandedOutlineRanges[0].y !== clampedHighlightRange.y ||
                expandedOutlineRanges[0].width !== clampedHighlightRange.width ||
                expandedOutlineRanges[0].height !== clampedHighlightRange.height;

            for (const outlineRange of expandedOutlineRanges) {
                regions.push({
                    color: withAlpha(mergedTheme.accentColor, 0.5),
                    range: outlineRange,
                    style: "solid-outline",
                    requiresFullRedraw: outlineRequiresFullRedraw,
                });
            }
        }

        if (highlightFocusRange !== undefined) {
            // focus ring 与 range outline 分开计算：
            // range 负责“批量选区”，focus 负责“当前焦点格”，两者都需要感知 span/rowSpan
            regions.push({
                color: mergedTheme.accentColor,
                range: highlightFocusRange,
                style: "solid-outline",
                requiresFullRedraw: highlightFocusRange.height > 1,
            });
        }

        return regions.length > 0 ? regions : undefined;
    }, [
        highlightRegionsIn,
        highlightRange,
        highlightFocusCol,
        highlightFocusRow,
        highlightFocusRange,
        fillHighlightRegion,
        getMangledCellContent,
        mangledCols.length,
        mangledRows,
        rowMarkerOffset,
        mergedTheme.accentColor,
    ]);

    const mangledGetGroupDetails = React.useCallback<NonNullable<DataEditorProps["getGroupDetails"]>>(
        group => {
            let result = getGroupDetails?.(group) ?? { name: group };
            if (onGroupHeaderRenamed !== undefined && group !== "") {
                result = {
                    icon: result.icon,
                    name: result.name,
                    overrideTheme: result.overrideTheme,
                    actions: [
                        ...(result.actions ?? []),
                        {
                            title: "Rename",
                            icon: "renameIcon",
                            needHover: true,
                            onClick: e =>
                                setRenameGroup({
                                    group: result.name,
                                    bounds: e.bounds,
                                }),
                        },
                    ],
                };
            }
            return result;
        },
        [getGroupDetails, onGroupHeaderRenamed]
    );

    const setOverlaySimple = React.useCallback(
        (val: Omit<NonNullable<typeof overlay>, "theme">) => {
            const [col, row] = val.cell;
            const column = mangledCols[col];
            const groupTheme =
                column?.group !== undefined ? mangledGetGroupDetails(column.group)?.overrideTheme : undefined;
            const colTheme = column?.themeOverride;
            const rowTheme = getRowThemeOverride?.(row);

            setOverlay({
                ...val,
                theme: mergeAndRealizeTheme(mergedTheme, groupTheme, colTheme, rowTheme, val.content.themeOverride),
            });
        },
        [getRowThemeOverride, mangledCols, mangledGetGroupDetails, mergedTheme]
    );

    const reselect = React.useCallback(
        (bounds: Rectangle, activation: CellActivatedEventArgs, initialValue?: string) => {
            if (gridSelection.current === undefined) return;

            const [col, row] = gridSelection.current.cell;
            const c = getMangledCellContent([col, row]);
            if (c.kind !== GridCellKind.Boolean && c.allowOverlay && c.readonly !== true) {
                let content = c;
                if (initialValue !== undefined) {
                    switch (content.kind) {
                        case GridCellKind.Number: {
                            const d = maybe(() => (initialValue === "-" ? -0 : Number.parseFloat(initialValue)), 0);
                            content = {
                                ...content,
                                data: Number.isNaN(d) ? 0 : d,
                            };
                            break;
                        }
                        case GridCellKind.Text:
                        case GridCellKind.Markdown:
                        case GridCellKind.Uri:
                            content = {
                                ...content,
                                data: initialValue,
                            };
                            break;
                    }
                }

                setOverlaySimple({
                    target: bounds,
                    content,
                    initialValue,
                    cell: [col, row],
                    highlight: initialValue === undefined,
                    forceEditMode: initialValue !== undefined,
                    activation,
                });
            } else if (c.kind === GridCellKind.Boolean && activation.inputType === "keyboard" && c.readonly !== true) {
                mangledOnCellsEdited([
                    {
                        location: gridSelection.current.cell,
                        value: {
                            ...c,
                            data: toggleBoolean(c.data),
                        },
                    },
                ]);
                gridRef.current?.damage([{ cell: gridSelection.current.cell }]);
            }
        },
        [getMangledCellContent, gridSelection, mangledOnCellsEdited, setOverlaySimple]
    );

    const reselectFilter = React.useCallback(
        (bounds: Rectangle, activation: CellActivatedEventArgs, initialValue?: string) => {
            if (gridSelection.current === undefined) return;

            const [col, row] = gridSelection.current.cell;
            const c = getMangledFilterCellContent(col);
            // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
            if (c.kind !== GridCellKind.Boolean && c.allowOverlay) {
                let content = c as any;
                if (initialValue !== undefined) {
                    switch (content.kind) {
                        case GridCellKind.Number: {
                            const d = maybe(() => (initialValue === "-" ? -0 : Number.parseFloat(initialValue)), 0);
                            content = {
                                ...content,
                                data: Number.isNaN(d) ? 0 : d,
                            } as any;
                            break;
                        }
                        case GridCellKind.Text:
                        case GridCellKind.Markdown:
                        case GridCellKind.Uri:
                            content = {
                                ...content,
                                data: initialValue,
                            } as any;
                            break;
                    }
                }

                setOverlaySimple({
                    target: bounds,
                    content,
                    initialValue,
                    cell: [col, row],
                    highlight: initialValue === undefined,
                    forceEditMode: initialValue !== undefined,
                    activation,
                });
            } else if (
                c.kind === GridCellKind.Boolean &&
                activation.inputType === "keyboard" &&
                (c as any).readonly !== true
            ) {
                mangledOnCellsEdited([
                    {
                        location: gridSelection.current.cell,
                        value: {
                            ...c,
                            data: toggleBoolean((c as any).data),
                        } as any,
                    },
                ]);
                gridRef.current?.damage([{ cell: gridSelection.current.cell }]);
            }
        },
        [getMangledFilterCellContent, gridSelection, mangledOnCellsEdited, setOverlaySimple]
    );

    const focusOnRowFromTrailingBlankRow = React.useCallback(
        (col: number, row: number) => {
            const bounds = gridRef.current?.getBounds(col, row);
            if (bounds === undefined || scrollRef.current === null) {
                return false;
            }

            const content = row === -3 ? getMangledFilterCellContent(col) : getMangledCellContent([col, row]);

            if (content.allowOverlay !== true || (content as any).readonly === true) {
                return false;
            }

            setOverlaySimple({
                target: bounds,
                content,
                initialValue: undefined,
                highlight: true,
                cell: [col, row],
                forceEditMode: true,
                activation: { inputType: "keyboard", key: "Enter" },
            });
            return true;
        },
        [getMangledFilterCellContent, getMangledCellContent, scrollRef, setOverlaySimple]
    );

    // 可编辑单元格自动获取焦点;
    const focusCellForEdit = React.useCallback(
        (col: number, row: number) => {
            const bounds = gridRef.current?.getBounds(col, row);
            if (bounds === undefined || scrollRef.current === null) return;

            const content = getMangledCellContent([col, row]);
            if (!content.allowOverlay || (content as any).readonly === true) return;

            setOverlaySimple({
                target: bounds,
                content,
                initialValue: undefined,
                highlight: true,
                cell: [col, row],
                forceEditMode: false,
                activation: { inputType: "programmatic" },
            });
        },
        [getMangledCellContent, scrollRef, setOverlaySimple]
    );

    const scrollTo = React.useCallback<ScrollToFn>(
        (col, row, dir = "both", paddingX = 0, paddingY = 0, options = undefined): void => {
            if (scrollRef.current !== null) {
                const grid = gridRef.current;
                const canvas = canvasRef.current;

                const trueCol = typeof col !== "number" ? (col.unit === "cell" ? col.amount : undefined) : col;
                const trueRow = typeof row !== "number" ? (row.unit === "cell" ? row.amount : undefined) : row;
                const desiredX = typeof col !== "number" && col.unit === "px" ? col.amount : undefined;
                const desiredY = typeof row !== "number" && row.unit === "px" ? row.amount : undefined;
                if (grid !== null && canvas !== null) {
                    let targetRect: Rectangle = {
                        x: 0,
                        y: 0,
                        width: 0,
                        height: 0,
                    };

                    let scrollX = 0;
                    let scrollY = 0;

                    if (trueCol !== undefined || trueRow !== undefined) {
                        targetRect = grid.getBounds((trueCol ?? 0) + rowMarkerOffset, trueRow ?? 0) ?? targetRect;
                        if (targetRect.width === 0 || targetRect.height === 0) return;
                    }

                    const scrollBounds = canvas.getBoundingClientRect();
                    const scale = scrollBounds.width / canvas.offsetWidth;

                    if (desiredX !== undefined) {
                        targetRect = {
                            ...targetRect,
                            x: desiredX - scrollBounds.left - scrollRef.current.scrollLeft,
                            width: 1,
                        };
                    }
                    if (desiredY !== undefined) {
                        targetRect = {
                            ...targetRect,
                            y: desiredY + scrollBounds.top - scrollRef.current.scrollTop,
                            height: 1,
                        };
                    }

                    if (targetRect !== undefined) {
                        const bounds = {
                            x: targetRect.x - paddingX,
                            y: targetRect.y - paddingY,
                            width: targetRect.width + 2 * paddingX,
                            height: targetRect.height + 2 * paddingY,
                        };

                        let frozenWidth = 0;
                        for (let i = 0; i < freezeColumns; i++) {
                            frozenWidth += columns[i].width;
                        }
                        let trailingRowHeight = 0;
                        const freezeTrailingRowsEffective = freezeTrailingRows + (lastRowSticky ? 1 : 0);
                        if (freezeTrailingRowsEffective > 0) {
                            trailingRowHeight = getFreezeTrailingHeight(
                                mangledRows,
                                freezeTrailingRowsEffective,
                                rowHeight
                            );
                        }

                        // scrollBounds is already scaled
                        let sLeft = frozenWidth * scale + scrollBounds.left + rowMarkerOffset * rowMarkerWidth * scale;
                        let sRight = scrollBounds.right;
                        let sTop =
                            scrollBounds.top +
                            (totalHeaderHeight + (showFilter && filterHeight > 0 ? filterHeight : 0)) * scale;
                        let sBottom = scrollBounds.bottom - trailingRowHeight * scale;

                        const minx = targetRect.width + paddingX * 2;
                        switch (options?.hAlign) {
                            case "start":
                                sRight = sLeft + minx;
                                break;
                            case "end":
                                sLeft = sRight - minx;
                                break;
                            case "center":
                                sLeft = Math.floor((sLeft + sRight) / 2) - minx / 2;
                                sRight = sLeft + minx;
                                break;
                        }

                        const miny = targetRect.height + paddingY * 2;
                        switch (options?.vAlign) {
                            case "start":
                                sBottom = sTop + miny;
                                break;
                            case "end":
                                sTop = sBottom - miny;
                                break;
                            case "center":
                                sTop = Math.floor((sTop + sBottom) / 2) - miny / 2;
                                sBottom = sTop + miny;
                                break;
                        }

                        if (sLeft > bounds.x) {
                            scrollX = bounds.x - sLeft;
                        } else if (sRight < bounds.x + bounds.width) {
                            scrollX = bounds.x + bounds.width - sRight;
                        }

                        if (sTop > bounds.y) {
                            scrollY = bounds.y - sTop;
                        } else if (sBottom < bounds.y + bounds.height) {
                            scrollY = bounds.y + bounds.height - sBottom;
                        }

                        if (dir === "vertical" || (typeof col === "number" && col < freezeColumns)) {
                            scrollX = 0;
                        } else if (
                            dir === "horizontal" ||
                            (typeof row === "number" && row >= mangledRows - freezeTrailingRowsEffective)
                        ) {
                            scrollY = 0;
                        }

                        if (scrollX !== 0 || scrollY !== 0) {
                            // Remove scaling as scrollTo method is unaffected by transform scale.
                            if (scale !== 1) {
                                scrollX /= scale;
                                scrollY /= scale;
                            }
                            scrollRef.current.scrollTo({
                                left: scrollX + scrollRef.current.scrollLeft,
                                top: scrollY + scrollRef.current.scrollTop,
                                behavior: options?.behavior ?? "auto",
                            });
                        }
                    }
                }
            }
        },
        [
            rowMarkerOffset,
            freezeTrailingRows,
            showFilter,
            filterHeight,
            lastRowSticky,
            rowMarkerWidth,
            scrollRef,
            totalHeaderHeight,
            freezeColumns,
            columns,
            mangledRows,
            rowHeight,
        ]
    );

    const focusCallback = React.useRef(focusOnRowFromTrailingBlankRow);
    const getCellContentRef = React.useRef(getCellContent);

    focusCallback.current = focusOnRowFromTrailingBlankRow;
    getCellContentRef.current = getCellContent;

    const rowsRef = React.useRef(rows);
    rowsRef.current = rows;

    const colsRef = React.useRef(mangledCols.length);
    colsRef.current = mangledCols.length;

    const appendRow = React.useCallback(
        async (col: number, openOverlay: boolean = true, behavior?: ScrollBehavior): Promise<void> => {
            const c = mangledCols[col];
            if (c?.trailingRowOptions?.disabled === true) {
                return;
            }
            const appendResult = onRowAppended?.();

            let r: "top" | "bottom" | number | undefined = undefined;
            let bottom = true;
            if (appendResult !== undefined) {
                r = await appendResult;
                if (r === "top") bottom = false;
                if (typeof r === "number") bottom = false;
            }

            let backoff = 0;
            const doFocus = () => {
                if (rowsRef.current <= rows) {
                    if (backoff < 500) {
                        window.setTimeout(doFocus, backoff);
                    }
                    backoff = 50 + backoff * 2;
                    return;
                }

                const row = typeof r === "number" ? r : bottom ? rows : 0;
                scrollToRef.current(col - rowMarkerOffset, row, "both", 0, 0, behavior ? { behavior } : undefined);
                setCurrent(
                    {
                        cell: [col, row],
                        range: {
                            x: col,
                            y: row,
                            width: 1,
                            height: 1,
                        },
                    },
                    false,
                    false,
                    "edit"
                );

                const cell = getCellContentRef.current([col - rowMarkerOffset, row]);
                if (cell.allowOverlay && isReadWriteCell(cell) && cell.readonly !== true && openOverlay) {
                    // wait for scroll to have a chance to process
                    window.setTimeout(() => {
                        focusCallback.current(col, row);
                    }, 0);
                }
            };
            // Queue up to allow the consumer to react to the event and let us check if they did
            doFocus();
        },
        [mangledCols, onRowAppended, rowMarkerOffset, rows, setCurrent]
    );

    const appendColumn = React.useCallback(
        async (row: number, openOverlay: boolean = true): Promise<void> => {
            const appendResult = onColumnAppended?.();

            let r: "left" | "right" | number | undefined = undefined;
            let right = true;
            if (appendResult !== undefined) {
                r = await appendResult;
                if (r === "left") right = false;
                if (typeof r === "number") right = false;
            }

            let backoff = 0;
            const doFocus = () => {
                if (colsRef.current <= mangledCols.length) {
                    if (backoff < 500) {
                        window.setTimeout(doFocus, backoff);
                    }
                    backoff = 50 + backoff * 2;
                    return;
                }

                const col = typeof r === "number" ? r : right ? mangledCols.length : 0;
                scrollTo(col - rowMarkerOffset, row);
                setCurrent(
                    {
                        cell: [col, row],
                        range: {
                            x: col,
                            y: row,
                            width: 1,
                            height: 1,
                        },
                    },
                    false,
                    false,
                    "edit"
                );

                const cell = getCellContentRef.current([col - rowMarkerOffset, row]);
                if (cell.allowOverlay && isReadWriteCell(cell) && cell.readonly !== true && openOverlay) {
                    window.setTimeout(() => {
                        focusCallback.current(col, row);
                    }, 0);
                }
            };
            doFocus();
        },
        [mangledCols, onColumnAppended, rowMarkerOffset, scrollTo, setCurrent]
    );

    const getCustomNewRowTargetColumn = React.useCallback(
        (col: number): number | undefined => {
            const customTargetColumn =
                columns[col]?.trailingRowOptions?.targetColumn ?? trailingRowOptions?.targetColumn;

            if (typeof customTargetColumn === "number") {
                const customTargetOffset = hasRowMarkers ? 1 : 0;
                return customTargetColumn + customTargetOffset;
            }

            if (typeof customTargetColumn === "object") {
                const maybeIndex = columnsIn.indexOf(customTargetColumn);
                if (maybeIndex >= 0) {
                    const customTargetOffset = hasRowMarkers ? 1 : 0;
                    return maybeIndex + customTargetOffset;
                }
            }

            return undefined;
        },
        [columns, columnsIn, hasRowMarkers, trailingRowOptions?.targetColumn]
    );

    const lastSelectedRowRef = React.useRef<number>();
    const lastSelectedRowRangeRef = React.useRef<Slice>();
    const coSelectedRowsForCurrentRef = React.useRef<CompactSelection>(CompactSelection.empty());
    const lastSelectedColRef = React.useRef<number>();
    const lastSelectedCurrent = React.useRef<NonNullable<GridSelection["current"]>>();

    const themeForCell = React.useCallback(
        (cell: InnerGridCell, pos: Item): FullTheme => {
            const [col, row] = pos;
            return mergeAndRealizeTheme(
                mergedTheme,
                mangledCols[col]?.themeOverride,
                getRowThemeOverride?.(row),
                cell.themeOverride
            );
        },
        [getRowThemeOverride, mangledCols, mergedTheme]
    );

    const { mapper } = useRowGrouping(rowGrouping, rowsIn);

    const rowGroupingNavBehavior = rowGrouping?.navigationBehavior;

    const getSelectedRowSlice = React.useCallback(
        (location: Item): Slice => {
            const [, row] = location;

            if (cellRowSelectionBehavior !== "row-span") {
                return [row, row + 1];
            }

            try {
                const cell = getMangledCellContent(location);
                const rowSpan = cell.rowSpan ?? 1;

                if (rowSpan <= 1) {
                    return [row, row + 1];
                }

                const anchorRow = row - (cell.rowSpanOffset ?? 0);

                return [clamp(anchorRow, 0, rows), clamp(anchorRow + rowSpan, 0, rows)];
            } catch {
                return [row, row + 1];
            }
        },
        [cellRowSelectionBehavior, getMangledCellContent, rows]
    );

    const getRowSpanRange = React.useCallback(
        (selectionRange: Rectangle): Rectangle => {
            if (selectionRange.y < 0) {
                return selectionRange;
            }

            const expandedRanges = expandSelectionOutlineToCellBounds(
                selectionRange,
                location => getMangledCellContent(location),
                mangledCols.length,
                mangledRows
            );

            return expandedRanges[0] ?? selectionRange;
        },
        [getMangledCellContent, mangledCols.length, mangledRows]
    );

    const getNormalizedCurrentSelection = React.useCallback(
        (current: NonNullable<GridSelection["current"]>): NonNullable<GridSelection["current"]> => {
            const range = getRowSpanRange(current.range);
            const rangeStack = current.rangeStack.map(getRowSpanRange);

            if (
                range === current.range &&
                rangeStack.every((selectionRange, index) => selectionRange === current.rangeStack[index])
            ) {
                return current;
            }

            return {
                ...current,
                range,
                rangeStack,
            };
        },
        [getRowSpanRange]
    );

    const getNormalizedSelection = React.useCallback(
        (selection: GridSelection): GridSelection => {
            if (selection.current === undefined) return selection;

            const current = getNormalizedCurrentSelection(selection.current);
            return current === selection.current
                ? selection
                : {
                      ...selection,
                      current,
                  };
        },
        [getNormalizedCurrentSelection]
    );

    const getMutationRangesForRange = React.useCallback(
        (selectionRange: Rectangle): Rectangle[] => {
            if (selectionRange.y < 0) {
                return [selectionRange];
            }

            const minCol = Math.max(0, selectionRange.x);
            const maxCol = Math.min(mangledCols.length, selectionRange.x + selectionRange.width);
            const minRow = Math.max(0, selectionRange.y);
            const maxRow = Math.min(mangledRows, selectionRange.y + selectionRange.height);
            if (minCol >= maxCol || minRow >= maxRow) {
                return [];
            }

            const unmodifiedRange =
                minCol === selectionRange.x &&
                minRow === selectionRange.y &&
                maxCol - minCol === selectionRange.width &&
                maxRow - minRow === selectionRange.height
                    ? selectionRange
                    : {
                          x: minCol,
                          y: minRow,
                          width: maxCol - minCol,
                          height: maxRow - minRow,
                      };
            const rects = new Map<string, Rectangle>();
            const addRect = (rect: Rectangle) => {
                const x = Math.max(0, rect.x);
                const y = Math.max(0, rect.y);
                const right = Math.min(mangledCols.length, rect.x + rect.width);
                const bottom = Math.min(mangledRows, rect.y + rect.height);
                if (x >= right || y >= bottom) return;
                rects.set(`${x}:${y}:${right - x}:${bottom - y}`, {
                    x,
                    y,
                    width: right - x,
                    height: bottom - y,
                });
            };

            addRect({
                x: minCol,
                y: minRow,
                width: maxCol - minCol,
                height: maxRow - minRow,
            });

            let hasMergedCell = false;
            const visitCell = (col: number, row: number): boolean => {
                const cell = getMangledCellContent([col, row]);
                const span = cell.span ?? [col, col];
                const rowSpan = cell.rowSpan ?? 1;
                const rowSpanOffset = cell.rowSpanOffset ?? 0;
                if (span[0] === span[1] && rowSpan <= 1) return false;

                hasMergedCell = true;
                const expandedRect = {
                    x: span[0],
                    y: row - rowSpanOffset,
                    width: span[1] - span[0] + 1,
                    height: rowSpan,
                };
                addRect(expandedRect);

                return (
                    expandedRect.x < minCol ||
                    expandedRect.y < minRow ||
                    expandedRect.x + expandedRect.width > maxCol ||
                    expandedRect.y + expandedRect.height > maxRow
                );
            };

            let needsFullScan = false;
            for (let col = minCol; col < maxCol; col++) {
                needsFullScan = visitCell(col, minRow) || needsFullScan;
                if (maxRow - minRow > 1) {
                    needsFullScan = visitCell(col, maxRow - 1) || needsFullScan;
                }
            }

            for (let row = minRow + 1; row < maxRow - 1; row++) {
                needsFullScan = visitCell(minCol, row) || needsFullScan;
                if (maxCol - minCol > 1) {
                    needsFullScan = visitCell(maxCol - 1, row) || needsFullScan;
                }
            }

            if (!hasMergedCell) {
                return [unmodifiedRange];
            }

            if (!needsFullScan) {
                return [...rects.values()];
            }

            for (let row = minRow + 1; row < maxRow - 1; row++) {
                if (maxCol - minCol <= 2) continue;
                for (let col = minCol; col < maxCol; col++) {
                    if (col === minCol || col === maxCol - 1) continue;
                    visitCell(col, row);
                }
            }

            return [...rects.values()].sort(
                (a, b) => a.y - b.y || a.x - b.x || b.height - a.height || b.width - a.width
            );
        },
        [getMangledCellContent, mangledCols.length, mangledRows]
    );

    const getMutationCurrentSelection = React.useCallback(
        (current: NonNullable<GridSelection["current"]>): NonNullable<GridSelection["current"]> => {
            const mutationRanges = getMutationRangesForRange(current.range);
            const mutationRangeStack = current.rangeStack.flatMap(getMutationRangesForRange);
            if (
                mutationRanges.length === 1 &&
                mutationRanges[0] === current.range &&
                mutationRangeStack.length === current.rangeStack.length &&
                mutationRangeStack.every((selectionRange, index) => selectionRange === current.rangeStack[index])
            ) {
                return current;
            }

            const [primaryRange = current.range, ...rangeStack] = mutationRanges;
            return {
                ...current,
                range: primaryRange,
                rangeStack: [...rangeStack, ...mutationRangeStack],
            };
        },
        [getMutationRangesForRange]
    );

    const getCopyRangesForCurrent = React.useCallback(
        (current: NonNullable<GridSelection["current"]>): Rectangle[] => {
            const sourceRanges = [current.range, ...current.rangeStack];
            const rects = new Map<string, Rectangle>();
            const addRange = (rect: Rectangle) => {
                rects.set(`${rect.x}:${rect.y}:${rect.width}:${rect.height}`, rect);
            };
            const rangeNeedsMutation = (selectionRange: Rectangle): boolean => {
                if (selectionRange.y < 0) return false;

                const minCol = Math.max(0, selectionRange.x);
                const maxCol = Math.min(mangledCols.length, selectionRange.x + selectionRange.width);
                const minRow = Math.max(0, selectionRange.y);
                const maxRow = Math.min(mangledRows, selectionRange.y + selectionRange.height);
                if (minCol >= maxCol || minRow >= maxRow) return false;

                const rangeContains = (rect: Rectangle) =>
                    selectionRange.x <= rect.x &&
                    selectionRange.y <= rect.y &&
                    selectionRange.x + selectionRange.width >= rect.x + rect.width &&
                    selectionRange.y + selectionRange.height >= rect.y + rect.height;

                const visitCell = (col: number, row: number): boolean => {
                    const cell = getMangledCellContent([col, row]);
                    const span = cell.span ?? [col, col];
                    const rowSpan = cell.rowSpan ?? 1;
                    if (span[0] === span[1] && rowSpan <= 1) return false;

                    const rowSpanOffset = cell.rowSpanOffset ?? 0;
                    return !rangeContains({
                        x: span[0],
                        y: row - rowSpanOffset,
                        width: span[1] - span[0] + 1,
                        height: rowSpan,
                    });
                };

                for (let col = minCol; col < maxCol; col++) {
                    if (visitCell(col, minRow)) return true;
                    if (maxRow - minRow > 1 && visitCell(col, maxRow - 1)) {
                        return true;
                    }
                }

                for (let row = minRow + 1; row < maxRow - 1; row++) {
                    if (visitCell(minCol, row)) return true;
                    if (maxCol - minCol > 1 && visitCell(maxCol - 1, row)) {
                        return true;
                    }
                }

                return false;
            };

            let needsAnyMutation = false;
            for (const selectionRange of sourceRanges) {
                if (!rangeNeedsMutation(selectionRange)) {
                    addRange(selectionRange);
                    continue;
                }

                needsAnyMutation = true;
                for (const mutationRange of getMutationRangesForRange(selectionRange)) {
                    addRange(mutationRange);
                }
            }

            if (!needsAnyMutation) {
                return sourceRanges;
            }

            const sortedRects = [...rects.values()].sort(
                (a, b) => a.y - b.y || a.x - b.x || b.height - a.height || b.width - a.width
            );

            const copyRanges = sortedRects.filter((rect, index) => {
                return !sortedRects.some(
                    (otherRect, otherIndex) =>
                        index !== otherIndex &&
                        otherRect.x <= rect.x &&
                        otherRect.y <= rect.y &&
                        otherRect.x + otherRect.width >= rect.x + rect.width &&
                        otherRect.y + otherRect.height >= rect.y + rect.height
                );
            });

            if (
                copyRanges.length === sourceRanges.length &&
                copyRanges.every((selectionRange, index) => selectionRange === sourceRanges[index])
            ) {
                return sourceRanges;
            }

            return copyRanges;
        },
        [getMangledCellContent, getMutationRangesForRange, mangledCols.length, mangledRows]
    );

    const getMutationSelection = React.useCallback(
        (selection: GridSelection): GridSelection => {
            if (selection.current === undefined) return selection;

            const current = getMutationCurrentSelection(selection.current);
            return current === selection.current
                ? selection
                : {
                      ...selection,
                      current,
                  };
        },
        [getMutationCurrentSelection]
    );

    const getMutationFillRanges = React.useCallback(
        (selectionRange: Rectangle): Rectangle[] => {
            const visualRange = getRowSpanRange(selectionRange);
            const fillRanges = new Map<string, Rectangle>();
            const addRange = (rect: Rectangle) => {
                fillRanges.set(`${rect.x}:${rect.y}:${rect.width}:${rect.height}`, rect);
            };

            addRange(selectionRange);
            for (const mutationRange of getMutationRangesForRange(selectionRange)) {
                if (
                    mutationRange.x === visualRange.x &&
                    mutationRange.y === visualRange.y &&
                    mutationRange.width === visualRange.width &&
                    mutationRange.height === visualRange.height &&
                    !(
                        mutationRange.x === selectionRange.x &&
                        mutationRange.y === selectionRange.y &&
                        mutationRange.width === selectionRange.width &&
                        mutationRange.height === selectionRange.height
                    )
                ) {
                    continue;
                }
                addRange(mutationRange);
            }

            return [...fillRanges.values()].sort(
                (a, b) => a.y - b.y || a.x - b.x || b.height - a.height || b.width - a.width
            );
        },
        [getMutationRangesForRange, getRowSpanRange]
    );

    const handleSelect = React.useCallback(
        (args: GridMouseEventArgs) => {
            const isMultiKey = browserIsOSX.value ? args.metaKey : args.ctrlKey;
            const isMultiRow = isMultiKey && rowSelect === "multi";

            const [col, row] = args.location;
            const selectedColumns = gridSelection.columns;
            const selectedRows = gridSelection.rows;
            // const [cellCol, cellRow] = gridSelection.current?.cell ?? [];

            // eslint-disable-next-line unicorn/prefer-switch
            if (args.kind === "cell") {
                lastSelectedColRef.current = undefined;

                lastMouseSelectLocation.current = [col, row];

                if (col >= rowMarkerOffset && showTrailingBlankRow && row === rows) {
                    const customTargetColumn = getCustomNewRowTargetColumn(col);
                    void appendRow(customTargetColumn ?? col);
                } else {
                    if (
                        (showTrailingBlankRow === true && row === rows) ||
                        // rowMarkers === "number" ||
                        rowSelect === "none"
                    )
                        return;

                    // 行拖拽排序
                    if (onRowMoved !== undefined) {
                        const markerCell = getMangledCellContent(args.location);
                        if (markerCell.kind !== InnerGridCellKind.Marker) {
                            return;
                        }
                        const renderer = getCellRenderer(markerCell);
                        // assert(renderer?.kind === InnerGridCellKind.Marker);
                        const postClick = renderer?.onClick?.({
                            ...args,
                            cell: markerCell,
                            posX: args.localEventX,
                            posY: args.localEventY,
                            bounds: args.bounds,
                            theme: themeForCell(markerCell, args.location),
                            preventDefault: () => undefined,
                        }) as MarkerCell | undefined;
                        if (postClick === undefined || postClick.checked === markerCell.checked) return;
                    }

                    const cell = getMangledCellContent(args.location);
                    const renderer = getCellRenderer(cell);

                    if (renderer?.onSelect !== undefined) {
                        let prevented = false;
                        renderer.onSelect({
                            ...args,
                            cell,
                            posX: args.localEventX,
                            posY: args.localEventY,
                            bounds: args.bounds,
                            preventDefault: (status?: boolean) => {
                                prevented = status === undefined ? true : status;
                            },
                            theme: themeForCell(cell, args.location),
                            gridSelection,
                        });
                        if (prevented) {
                            return;
                        }
                    }

                    if (rowGroupingNavBehavior === "block" && mapper(row).isGroupHeader) {
                        return;
                    }

                    setOverlay(undefined);
                    focus();
                    const targetRowSlice = getSelectedRowSlice(args.location);

                    let selectionCurrentForClick: NonNullable<GridSelection["current"]> | null | undefined;

                    if (col < rowMarkerOffset) {
                        // 点击索引列时，只让行选中生效，不向正文 current 写入一个假单元格
                        // 这样可以复用原有 focus ring 绘制链路，同时避免正文合并块被误判为当前焦点
                        lastSelectedCurrent.current = undefined;
                        selectionCurrentForClick = rowSelectionBlending === "exclusive" ? null : undefined;
                        setRowMarkerFocus([col, row]);
                    } else {
                        // 点击正文单元格时仍保持原生 current 语义，后续复制、编辑、focus 都沿用原链路
                        lastSelectedCurrent.current = {
                            ...gridSelection.current,
                            cell: [col, row],
                            range: { x: col, y: row, width: 1, height: 1 },
                            rangeStack: [],
                        };
                        selectionCurrentForClick = lastSelectedCurrent.current;
                        setRowMarkerFocus(undefined);
                    }

                    const targetSelection = CompactSelection.fromSingleSelection(targetRowSlice);
                    const isSelected = selectedRows.hasAll(targetRowSlice);
                    // 业务侧可在这里复刻普通 Table 的“可编辑单元格不能反选”语义：
                    // 命中已选中行的正文可编辑单元格时，在 Shift/Ctrl/普通点击选区分支之前拦截
                    const keepSelectedRowsOnCellClick =
                        col >= rowMarkerOffset &&
                        isSelected &&
                        keepRowSelectionOnCellClick?.({
                            cell: [col - rowMarkerOffset, row],
                            gridCell: cell as GridCell,
                            targetRowSlice,
                            selectedRows,
                            isSelected,
                            isMultiKey,
                            shiftKey: args.shiftKey,
                        }) === true;
                    // 保留旧行为兼容：readonly === false 仍只作为原有单击保留选中的兜底判断
                    const keepSelectedRowsForSingleCellClick =
                        keepSelectedRowsOnCellClick || (col >= rowMarkerOffset && (cell as any).readonly === false);

                    if (keepSelectedRowsOnCellClick) {
                        // 这里保留 rows 并提前结束行选区计算，避免 Shift 扩选或 Ctrl/普通点击反选
                        const allowMixedForKeepSelection =
                            isMultiRow || args.isTouch || rowSelectionMode === "multi"
                                ? true
                                : rowSelectionBlending === "mixed" && columnSelectionBlending === "mixed";
                        setSelectedRowsAndCell(
                            selectedRows,
                            selectionCurrentForClick,
                            undefined,
                            allowMixedForKeepSelection
                        );
                        coSelectedRowsForCurrentRef.current = selectedRows;
                        return;
                    }

                    const lastHighlightedSlice = lastSelectedRowRangeRef.current;
                    const isRowSpanCell = (cell.rowSpan ?? 1) > 1 || (cell.rowSpanOffset ?? 0) > 0;
                    const shouldUseBodyCurrentSelection =
                        col >= rowMarkerOffset &&
                        rowSelectionMode !== "multi" &&
                        !isMultiRow &&
                        !args.isTouch &&
                        cellRowSelectionBehavior === "row-span" &&
                        isRowSpanCell;

                    if (shouldUseBodyCurrentSelection) {
                        const currentForBodyClick =
                            args.shiftKey && gridSelection.current !== undefined
                                ? {
                                      ...selectionCurrentForClick,
                                      cell: gridSelection.current.cell,
                                      range: combineRects(gridSelection.current.range, {
                                          x: col,
                                          y: row,
                                          width: 1,
                                          height: 1,
                                      }),
                                  }
                                : selectionCurrentForClick;
                        const shouldUpdateBodyRows = isRowSpanCell;
                        let rowsForCurrent = shouldUpdateBodyRows ? targetSelection : undefined;
                        let usedShiftRowRange = false;
                        if (
                            shouldUpdateBodyRows &&
                            cellRowSelectionBehavior === "row-span" &&
                            rowSelect === "multi" &&
                            (args.shiftKey || args.isLongTouch === true) &&
                            lastHighlightedSlice !== undefined &&
                            selectedRows.hasAll(lastHighlightedSlice)
                        ) {
                            rowsForCurrent = CompactSelection.fromSingleSelection([
                                Math.min(lastHighlightedSlice[0], targetRowSlice[0]),
                                Math.max(lastHighlightedSlice[1], targetRowSlice[1]),
                            ]);
                            usedShiftRowRange = true;
                        } else if (
                            shouldUpdateBodyRows &&
                            !args.shiftKey &&
                            isSelected &&
                            selectedRows.equals(targetSelection)
                        ) {
                            const keepRowSelection = keepSelectedRowsForSingleCellClick;
                            rowsForCurrent = keepRowSelection ? targetSelection : CompactSelection.empty();
                        }
                        const shouldToggleBodyRows =
                            !shouldUpdateBodyRows &&
                            !args.shiftKey &&
                            isSelected &&
                            selectedRows.equals(targetSelection);
                        const autoCoSelectedRows = shouldToggleBodyRows
                            ? keepSelectedRowsForSingleCellClick
                                ? targetSelection
                                : CompactSelection.empty()
                            : (rowsForCurrent ?? targetSelection);
                        setCurrent(
                            currentForBodyClick ?? undefined,
                            true,
                            isMultiKey,
                            args.shiftKey ? "keyboard-select" : "click",
                            autoCoSelectedRows
                        );
                        coSelectedRowsForCurrentRef.current = autoCoSelectedRows;
                        if (!usedShiftRowRange) {
                            lastSelectedRowRef.current = targetRowSlice[0];
                            lastSelectedRowRangeRef.current = targetRowSlice;
                        }
                    } else {
                        /**
                         * 行选中逻辑
                         * 摒弃了单独的cell选中逻辑，如需要，找源代码
                         * */
                        if (
                            rowSelect === "multi" &&
                            (args.shiftKey || args.isLongTouch === true) &&
                            lastHighlightedSlice !== undefined &&
                            selectedRows.hasAll(lastHighlightedSlice)
                        ) {
                            const newSlice: Slice = [
                                Math.min(lastHighlightedSlice[0], targetRowSlice[0]),
                                Math.max(lastHighlightedSlice[1], targetRowSlice[1]),
                            ];

                            if (isMultiRow || rowSelectionMode === "multi") {
                                setSelectedRowsAndCell(undefined, selectionCurrentForClick, newSlice, true);
                                coSelectedRowsForCurrentRef.current =
                                    col >= rowMarkerOffset ? selectedRows.add(newSlice) : CompactSelection.empty();
                            } else {
                                setSelectedRowsAndCell(
                                    CompactSelection.fromSingleSelection(newSlice),
                                    selectionCurrentForClick,
                                    undefined,
                                    rowSelectionBlending === "mixed" && columnSelectionBlending === "mixed"
                                );
                                coSelectedRowsForCurrentRef.current =
                                    col >= rowMarkerOffset
                                        ? CompactSelection.fromSingleSelection(newSlice)
                                        : CompactSelection.empty();
                            }
                        } else if (isMultiRow || args.isTouch || rowSelectionMode === "multi") {
                            if (isSelected) {
                                const nextRows = keepSelectedRowsOnCellClick
                                    ? selectedRows
                                    : selectedRows.remove(targetRowSlice);
                                setSelectedRowsAndCell(nextRows, selectionCurrentForClick, undefined, true);
                                coSelectedRowsForCurrentRef.current =
                                    col >= rowMarkerOffset ? nextRows : CompactSelection.empty();
                            } else {
                                setSelectedRowsAndCell(undefined, selectionCurrentForClick, targetRowSlice, true);
                                coSelectedRowsForCurrentRef.current =
                                    col >= rowMarkerOffset
                                        ? selectedRows.add(targetRowSlice)
                                        : CompactSelection.empty();
                                lastSelectedRowRef.current = targetRowSlice[0];
                                lastSelectedRowRangeRef.current = targetRowSlice;
                            }
                        } else if (isSelected && selectedRows.equals(targetSelection)) {
                            // 单选，选中行情况下，仅对可编辑单元格保留同行高亮
                            // 索引列 / Marker 重复点击仍应走“取消当前行选中”，
                            // 否则会把 row-marker 的 toggle 行为吃掉
                            const keepRowSelection = keepSelectedRowsForSingleCellClick;
                            setSelectedRowsAndCell(
                                keepRowSelection ? targetSelection : CompactSelection.empty(),
                                selectionCurrentForClick,
                                undefined,
                                rowSelectionBlending === "mixed" && columnSelectionBlending === "mixed"
                            );
                            coSelectedRowsForCurrentRef.current = keepRowSelection
                                ? col >= rowMarkerOffset
                                    ? targetSelection
                                    : CompactSelection.empty()
                                : CompactSelection.empty();
                        } else {
                            setSelectedRowsAndCell(
                                targetSelection,
                                selectionCurrentForClick,
                                undefined,
                                rowSelectionBlending === "mixed" && columnSelectionBlending === "mixed"
                            );
                            coSelectedRowsForCurrentRef.current =
                                col >= rowMarkerOffset ? targetSelection : CompactSelection.empty();
                            lastSelectedRowRef.current = targetRowSlice[0];
                            lastSelectedRowRangeRef.current = targetRowSlice;
                        }
                    }
                }
            } else if (args.kind === "header") {
                lastMouseSelectLocation.current = [col, row];
                setOverlay(undefined);
                lastSelectedRowRef.current = undefined;
                lastSelectedRowRangeRef.current = undefined;
                coSelectedRowsForCurrentRef.current = CompactSelection.empty();
                lastSelectedColRef.current = undefined;
                setRowMarkerFocus(undefined);

                if (hasRowMarkers && col === 0) {
                    // lastSelectedRowRef.current = undefined;
                    // lastSelectedColRef.current = undefined;
                    // // 以下逻辑暂时不需要，索引列，filter行全选逻辑由外部设置
                    // if (!headerRowMarkerDisabled && rowSelect === "multi") {
                    //     if (selectedRows.length !== rows) {
                    //         setSelectedRows(CompactSelection.fromSingleSelection([0, rows]), undefined, isMultiKey);
                    //     } else {
                    //         setSelectedRows(CompactSelection.empty(), undefined, isMultiKey);
                    //     }
                    //     focus();
                    // }
                } else {
                    const lastCol = lastSelectedColRef.current;
                    if (
                        columnSelect === "multi" &&
                        (args.shiftKey || args.isLongTouch === true) &&
                        lastCol !== undefined &&
                        selectedColumns.hasIndex(lastCol)
                    ) {
                        // Support for selecting a slice of columns:
                        const newSlice: Slice = [Math.min(lastCol, col), Math.max(lastCol, col) + 1];

                        if (isMultiKey || args.isTouch || columnSelectionMode === "multi") {
                            setSelectedColumns(undefined, newSlice, isMultiKey);
                        } else {
                            setSelectedColumns(CompactSelection.fromSingleSelection(newSlice), undefined, isMultiKey);
                        }
                    } else if (
                        columnSelect === "multi" &&
                        (isMultiKey || args.isTouch || columnSelectionMode === "multi")
                    ) {
                        // Support for selecting a single columns additively:
                        if (selectedColumns.hasIndex(col)) {
                            // If the column is already selected, deselect that column:
                            setSelectedColumns(selectedColumns.remove(col), undefined, isMultiKey);
                        } else {
                            setSelectedColumns(undefined, col, isMultiKey);
                        }
                        lastSelectedColRef.current = col;
                    } else if (columnSelect !== "none") {
                        if (selectedColumns.hasIndex(col) && selectedColumns.length === 1) {
                            setSelectedColumns(CompactSelection.empty(), undefined, isMultiKey);
                            lastSelectedColRef.current = undefined;
                        } else {
                            setSelectedColumns(
                                CompactSelection.fromSingleSelection(col),
                                undefined,
                                rowSelectionBlending === "mixed" && columnSelectionBlending === "mixed"
                            );
                        }
                        lastSelectedColRef.current = col;
                    }
                    lastSelectedRowRef.current = undefined;
                    lastSelectedRowRangeRef.current = undefined;
                    setRowMarkerFocus(undefined);

                    focus();
                }
            } else if (args.kind === groupHeaderKind) {
                lastMouseSelectLocation.current = [col, row];
                setRowMarkerFocus(undefined);
                coSelectedRowsForCurrentRef.current = CompactSelection.empty();
            } else if (args.kind === outOfBoundsKind && !args.isMaybeScrollbar && onSelectionCleared !== undefined) {
                // onSelectionCleared !== undefined防止点击空白行，清空选中
                setGridSelection(emptyGridSelection, false);
                setOverlay(undefined);
                focus();
                onSelectionCleared?.();
                lastSelectedRowRef.current = undefined;
                lastSelectedRowRangeRef.current = undefined;
                coSelectedRowsForCurrentRef.current = CompactSelection.empty();
                lastSelectedColRef.current = undefined;
                setRowMarkerFocus(undefined);
            } else if (args.kind === filterHeaderKind) {
                lastSelectedColRef.current = undefined;
                lastMouseSelectLocation.current = [col, row];
                setCurrent(
                    {
                        cell: [col, row],
                        range: { x: col, y: row, width: 1, height: 1 },
                    },
                    true,
                    isMultiKey,
                    "click",
                    selectedRows
                );
                lastSelectedRowRef.current = undefined;
                lastSelectedRowRangeRef.current = undefined;
                coSelectedRowsForCurrentRef.current = selectedRows;
                setRowMarkerFocus(undefined);
                setOverlay(undefined);
                focus();
            }
        },
        [
            rowSelect,
            columnSelect,
            gridSelection,
            onSelectionCleared,
            rowMarkerOffset,
            showTrailingBlankRow,
            rows,
            getMangledCellContent,
            onRowMoved,
            focus,
            rowSelectionMode,
            columnSelectionMode,
            getCellRenderer,
            themeForCell,
            getCustomNewRowTargetColumn,
            appendRow,
            getSelectedRowSlice,
            cellRowSelectionBehavior,
            keepRowSelectionOnCellClick,
            rowGroupingNavBehavior,
            mapper,
            setCurrent,
            setRowMarkerFocus,
            setSelectedRowsAndCell,
            hasRowMarkers,
            setSelectedColumns,
            rowSelectionBlending,
            columnSelectionBlending,
            setGridSelection,
        ]
    );
    const isActivelyDraggingHeader = React.useRef(false);
    const lastMouseSelectLocation = React.useRef<readonly [number, number]>();
    const touchDownArgs = React.useRef(visibleRegion);
    const mouseDownData = React.useRef<{
        time: number;
        button: number;
        location: Item;
    }>();
    const onMouseDown = React.useCallback(
        (args: GridMouseEventArgs) => {
            isPrevented.current = false;
            touchDownArgs.current = visibleRegionRef.current;
            if (args.button !== 0 && args.button !== 1) {
                mouseDownData.current = undefined;
                return;
            }

            const time = performance.now();
            mouseDownData.current = {
                button: args.button,
                time,
                location: args.location,
            };

            if (args?.kind === "header") {
                isActivelyDraggingHeader.current = true;
                const [col, row] = args.location;
                const column = mangledCols[col];
                let prevented = false;
                if (column.customHeaderCell !== undefined) {
                    const r = getCellRenderer(column.customHeaderCell);
                    if (r !== undefined && r.onSelect !== undefined) {
                        r.onSelect?.({
                            ...args,
                            cell: column.customHeaderCell,
                            posX: args.localEventX,
                            posY: args.localEventY,
                            bounds: args.bounds,
                            theme: themeForCell(column.customHeaderCell, args.location),
                            preventDefault: (status?: boolean) => {
                                prevented = status === undefined ? true : status;
                            },
                        });
                    }
                }
                if (prevented) {
                    // 这里修改是因为bug, 点击头部的radio cell(层级)，会触发选中所以当调用onSelect时传入preventDefault方法来阻止默认行为，如果prevented为true,就不进行后续操作，主要是handleSelect
                    lastMouseSelectLocation.current = [col, row];
                    return;
                }
            }

            const fh = args.kind === "cell" && args.isFillHandle;

            if (!fh && args.kind !== "cell" && args.isEdge) return;

            setMouseState({
                previousSelection: fh ? getNormalizedSelection(gridSelection) : gridSelection,
                fillHandle: fh,
            });
            lastMouseSelectLocation.current = undefined;

            if (!args.isTouch && args.button === 0 && !fh) {
                handleSelect(args);
            } else if (!args.isTouch && args.button === 1) {
                lastMouseSelectLocation.current = args.location;
            }
        },
        [getCellRenderer, getNormalizedSelection, gridSelection, handleSelect, mangledCols, themeForCell]
    );

    const [renameGroup, setRenameGroup] = React.useState<{
        group: string;
        bounds: Rectangle;
    }>();

    const handleGroupHeaderSelection = React.useCallback(
        (args: GridMouseEventArgs) => {
            if (args.kind !== groupHeaderKind || columnSelect !== "multi") {
                return;
            }
            const isMultiKey = browserIsOSX.value ? args.metaKey : args.ctrlKey;
            const [col] = args.location;
            const selectedColumns = gridSelection.columns;

            if (col < rowMarkerOffset) return;

            const needle = mangledCols[col];
            let start = col;
            let end = col;
            for (let i = col - 1; i >= rowMarkerOffset; i--) {
                if (!isGroupEqual(needle.group, mangledCols[i].group)) break;
                start--;
            }

            for (let i = col + 1; i < mangledCols.length; i++) {
                if (!isGroupEqual(needle.group, mangledCols[i].group)) break;
                end++;
            }

            focus();

            if (isMultiKey || args.isTouch || columnSelectionMode === "multi") {
                if (selectedColumns.hasAll([start, end + 1])) {
                    let newVal = selectedColumns;
                    for (let index = start; index <= end; index++) {
                        newVal = newVal.remove(index);
                    }
                    setSelectedColumns(newVal, undefined, isMultiKey);
                } else {
                    setSelectedColumns(undefined, [start, end + 1], isMultiKey);
                }
            } else {
                setSelectedColumns(
                    CompactSelection.fromSingleSelection([start, end + 1]),
                    undefined,
                    rowSelectionBlending === "mixed" && columnSelectionBlending === "mixed"
                );
            }
        },
        [
            columnSelect,
            columnSelectionBlending,
            focus,
            gridSelection.columns,
            mangledCols,
            rowMarkerOffset,
            setSelectedColumns,
            columnSelectionMode,
            rowSelectionBlending,
        ]
    );

    const isPrevented = React.useRef(false);

    const normalSizeColumn = React.useCallback(
        async (col: number): Promise<void> => {
            if (getCellsForSelection !== undefined && onColumnResize !== undefined) {
                const start = visibleRegionRef.current.y;
                const end = visibleRegionRef.current.height;
                let cells = getCellsForSelection(
                    {
                        x: col,
                        y: start,
                        width: 1,
                        height: Math.min(end, rows - start),
                    },
                    abortControllerRef.current.signal
                );
                if (typeof cells !== "object") {
                    cells = await cells();
                }
                const inputCol = columns[col - rowMarkerOffset];
                const offscreen = document.createElement("canvas");
                const ctx = offscreen.getContext("2d", { alpha: false });
                if (ctx !== null) {
                    ctx.font = mergedTheme.baseFontFull;
                    const newCol = measureColumn(
                        ctx,
                        mergedTheme,
                        inputCol,
                        0,
                        cells,
                        minColumnWidth,
                        maxColumnWidth,
                        false,
                        getCellRenderer
                    );
                    onColumnResize?.(inputCol, newCol.width, col, newCol.width);
                }
            }
        },
        [
            columns,
            getCellsForSelection,
            maxColumnWidth,
            mergedTheme,
            minColumnWidth,
            onColumnResize,
            rowMarkerOffset,
            rows,
            getCellRenderer,
        ]
    );

    const [scrollDir, setScrollDir] = React.useState<GridMouseEventArgs["scrollEdge"]>();

    const fillPattern = React.useCallback(
        async (previousSelection: GridSelection, currentSelection: GridSelection) => {
            const patternRange =
                previousSelection.current === undefined
                    ? undefined
                    : getNormalizedCurrentSelection(previousSelection.current).range;

            if (
                patternRange === undefined ||
                getCellsForSelection === undefined ||
                currentSelection.current === undefined
            ) {
                return;
            }
            const currentRange = getNormalizedCurrentSelection(currentSelection.current).range;
            const currentRanges = getMutationFillRanges(currentSelection.current.range);

            if (onFillPattern !== undefined) {
                let canceled = false;
                onFillPattern({
                    fillDestination: { ...currentRange, x: currentRange.x - rowMarkerOffset },
                    patternSource: { ...patternRange, x: patternRange.x - rowMarkerOffset },
                    preventDefault: () => (canceled = true),
                });
                if (canceled) return;
            }

            let cells = getCellsForSelection(patternRange, abortControllerRef.current.signal);
            if (typeof cells !== "object") cells = await cells();

            const pattern = cells;

            // loop through all cells in currentSelection.current.range
            const editItemList: EditListItem[] = [];
            const editedCells = new Set<string>();
            for (const fillRange of currentRanges) {
                for (let x = 0; x < fillRange.width; x++) {
                    for (let y = 0; y < fillRange.height; y++) {
                        const cell: Item = [fillRange.x + x, fillRange.y + y];
                        if (itemIsInRect(cell, patternRange)) continue;
                        const key = `${cell[0]}:${cell[1]}`;
                        if (editedCells.has(key)) continue;
                        editedCells.add(key);

                        const patternY =
                            (((cell[1] - currentRange.y) % patternRange.height) + patternRange.height) %
                            patternRange.height;
                        const patternX =
                            (((cell[0] - currentRange.x) % patternRange.width) + patternRange.width) %
                            patternRange.width;
                        const patternCell = pattern[patternY][patternX];
                        if (isInnerOnlyCell(patternCell) || !isReadWriteCell(patternCell)) continue;
                        editItemList.push({
                            location: cell,
                            value: { ...patternCell },
                        });
                    }
                }
            }
            mangledOnCellsEdited(editItemList);

            gridRef.current?.damage(
                editItemList.map(c => ({
                    cell: c.location,
                }))
            );
        },
        [
            getCellsForSelection,
            getMutationFillRanges,
            getNormalizedCurrentSelection,
            mangledOnCellsEdited,
            onFillPattern,
            rowMarkerOffset,
        ]
    );

    const fillRight = React.useCallback(() => {
        if (gridSelection.current === undefined || gridSelection.current.range.width <= 1) return;

        const firstColSelection = {
            ...gridSelection,
            current: {
                ...gridSelection.current,
                range: {
                    ...gridSelection.current.range,
                    width: 1,
                },
            },
        };

        void fillPattern(firstColSelection, gridSelection);
    }, [fillPattern, gridSelection]);

    const fillDown = React.useCallback(() => {
        if (gridSelection.current === undefined || gridSelection.current.range.height <= 1) return;

        const firstRowSelection = {
            ...gridSelection,
            current: {
                ...gridSelection.current,
                range: {
                    ...gridSelection.current.range,
                    height: 1,
                },
            },
        };

        void fillPattern(firstRowSelection, gridSelection);
    }, [fillPattern, gridSelection]);

    const onMouseUp = React.useCallback(
        (args: GridMouseEventArgs, isOutside: boolean, sourceEvent: MouseEvent | TouchEvent) => {
            const mouse = mouseState;
            setMouseState(undefined);
            setFillHighlightRegion(undefined);
            setScrollDir(undefined);
            isActivelyDraggingHeader.current = false;

            if (isOutside) return;

            if (
                mouse?.fillHandle === true &&
                gridSelection.current !== undefined &&
                mouse.previousSelection?.current !== undefined
            ) {
                if (fillHighlightRegion === undefined) return;
                const newRange = {
                    ...gridSelection,
                    current: {
                        ...gridSelection.current,
                        range: combineRects(mouse.previousSelection.current.range, fillHighlightRegion),
                    },
                };
                void fillPattern(mouse.previousSelection, newRange);
                setGridSelection(newRange, true);
                return;
            }

            const [col, row] = args.location;
            const [lastMouseDownCol, lastMouseDownRow] = lastMouseSelectLocation.current ?? [];

            const preventDefault = () => {
                isPrevented.current = true;
            };

            const handleMaybeClick = (a: GridMouseCellEventArgs): boolean => {
                const isValidClick = a.isTouch || (lastMouseDownCol === col && lastMouseDownRow === row);
                if (isValidClick) {
                    onCellClicked?.([col - rowMarkerOffset, row], {
                        ...a,
                        preventDefault,
                    });
                }
                if (a.button === 1) return !isPrevented.current;
                if (!isPrevented.current) {
                    const c = getMangledCellContent(args.location);
                    const r = getCellRenderer(c);

                    if (r !== undefined && r.onClick !== undefined && isValidClick) {
                        const newVal = r.onClick({
                            ...a,
                            cell: c,
                            posX: a.localEventX,
                            posY: a.localEventY,
                            bounds: a.bounds,
                            theme: themeForCell(c, args.location),
                            preventDefault,
                        });
                        if (newVal !== undefined && !isInnerOnlyCell(newVal) && isEditableGridCell(newVal)) {
                            mangledOnCellsEdited([{ location: a.location, value: newVal }]);
                            gridRef.current?.damage([
                                {
                                    cell: a.location,
                                },
                            ]);
                        }
                    }
                    if (isPrevented.current || gridSelection.current === undefined) return false;

                    if (c.kind === InnerGridCellKind.NewRow) {
                        return false;
                    }

                    let shouldActivate = false;
                    switch (c.activationBehaviorOverride ?? cellActivationBehavior) {
                        case "double-click":
                        case "second-click": {
                            if (mouse?.previousSelection?.current?.cell === undefined) break;
                            const [selectedCol, selectedRow] = gridSelection.current.cell;
                            const [prevCol, prevRow] = mouse.previousSelection.current.cell;
                            const isClickOnSelected =
                                col === selectedCol && col === prevCol && row === selectedRow && row === prevRow;
                            shouldActivate =
                                isClickOnSelected &&
                                (a.isDoubleClick === true || cellActivationBehavior === "second-click");
                            break;
                        }
                        case "single-click": {
                            shouldActivate = true;
                            break;
                        }
                    }

                    if (shouldActivate) {
                        const act =
                            a.isDoubleClick === true
                                ? "double-click"
                                : (c.activationBehaviorOverride ?? cellActivationBehavior);
                        const activationEvent: CellActivatedEventArgs = {
                            inputType: "pointer",
                            pointerActivation: act,
                            pointerType: a.isTouch ? "touch" : "mouse",
                        };
                        onCellActivated?.([col - rowMarkerOffset, row], activationEvent);
                        reselect(a.bounds, activationEvent);
                        return true;
                    }
                }
                return false;
            };

            const handleFilterMaybeClick = (a: GridMouseFilterHeaderEventArgs): boolean => {
                if (!isPrevented.current) {
                    const [activeCol] = args.location;
                    const result = getMangledFilterCellContent(activeCol) as any;

                    const r = getCellRenderer(result);

                    if (r !== undefined && r.onClick !== undefined) {
                        const newVal = r.onClick({
                            ...a,
                            cell: result,
                            posX: a.localEventX,
                            posY: a.localEventY,
                            bounds: a.bounds,
                            theme: themeForCell(result, args.location),
                            preventDefault,
                        });
                        if (newVal !== undefined && !isInnerOnlyCell(newVal) && isEditableGridCell(newVal)) {
                            mangledOnCellsEdited([{ location: a.location, value: newVal }]);
                            gridRef.current?.damage([
                                {
                                    cell: a.location,
                                },
                            ]);
                        }
                    }

                    if (isPrevented.current || gridSelection.current === undefined) return false;

                    const [selectedCol, selectedRow] = gridSelection.current.cell;
                    if (col === selectedCol && row === selectedRow) {
                        reselectFilter(a.bounds, {} as CellActivatedEventArgs);
                        return true;
                    }
                }
                return false;
            };

            const clickLocation = args.location[0] - rowMarkerOffset;
            if (args.isTouch) {
                const vr = visibleRegionRef.current;
                const touchVr = touchDownArgs.current;
                if (vr.x !== touchVr.x || vr.y !== touchVr.y) {
                    // we scrolled, abort
                    return;
                }
                // take care of context menus first if long pressed item is already selected
                if (args.isLongTouch === true) {
                    if (args.kind === "cell" && itemsAreEqual(gridSelection.current?.cell, args.location)) {
                        onCellContextMenu?.([clickLocation, args.location[1]], {
                            ...args,
                            preventDefault,
                            sourceEvent,
                        });
                        return;
                    } else if (args.kind === "header" && gridSelection.columns.hasIndex(col)) {
                        onHeaderContextMenu?.(clickLocation, { ...args, preventDefault, sourceEvent });
                        return;
                    } else if (args.kind === groupHeaderKind) {
                        if (clickLocation < 0) {
                            return;
                        }

                        onGroupHeaderContextMenu?.(clickLocation, { ...args, preventDefault, sourceEvent });
                        return;
                    }
                }
                switch (args.kind) {
                    case "cell": {
                        const cellArgs: GridMouseCellEventArgs = args;
                        // cell 点击需要先给 renderer 一个拦截机会；
                        // 只有 renderer 没消费时，才进入统一的选中链路
                        if (!handleMaybeClick(cellArgs)) {
                            handleSelect(cellArgs);
                        }

                        break;
                    }
                    case groupHeaderKind: {
                        onGroupHeaderClicked?.(clickLocation, { ...args, preventDefault, sourceEvent });

                        break;
                    }
                    case headerKind: {
                        // 索引列表头 clickLocation 可能为 -1，这种场景只走选择逻辑，不向外抛业务列点击事件
                        if (clickLocation >= 0) {
                            onHeaderClicked?.(clickLocation, {
                                ...args,
                                preventDefault,
                                sourceEvent,
                            });
                        }
                        handleSelect(args);

                        break;
                    }
                    default: {
                        handleSelect(args);
                    }
                }
                return;
            }

            if (args.kind === headerKind) {
                // if (clickLocation < 0) {
                //     return;
                // }

                if (args.isEdge) {
                    if (args.isDoubleClick === true) {
                        void normalSizeColumn(col);
                    }
                } else if (args.button === 0 && col === lastMouseDownCol && row === lastMouseDownRow) {
                    const column = mangledCols[col];
                    if (column.customHeaderCell !== undefined) {
                        const r = getCellRenderer(column.customHeaderCell);
                        if (r !== undefined && r.onClick !== undefined) {
                            r.onClick({
                                ...args,
                                cell: column.customHeaderCell,
                                posX: args.localEventX,
                                posY: args.localEventY,
                                bounds: args.bounds,
                                theme: themeForCell(column.customHeaderCell, args.location),
                                preventDefault,
                            });
                        }
                    }
                    if (clickLocation >= 0) {
                        onHeaderClicked?.(clickLocation, { ...args, preventDefault, sourceEvent });
                    }
                }
            }

            if (args.kind === groupHeaderKind) {
                if (clickLocation < 0 && rowMarkerGroup !== undefined) {
                    // 索引列
                    const groupDesc = mangledGetGroupDetails(rowMarkerGroup);
                    const box = getMarkerActionBoundsForGroup(
                        args.bounds,
                        groupHeaderHeight,
                        groupDesc?.iconSize,
                        groupDesc?.iconAlign
                    );
                    if (pointInRect(box, args.localEventX + args.bounds.x, args.localEventY)) {
                        onGroupHeaderClicked?.(clickLocation, { ...args, preventDefault, sourceEvent });
                    }
                    return;
                }

                if (args.button === 0 && col === lastMouseDownCol && row === lastMouseDownRow) {
                    onGroupHeaderClicked?.(clickLocation, { ...args, preventDefault, sourceEvent });
                    if (!isPrevented.current) {
                        handleGroupHeaderSelection(args);
                    }
                }
            }

            if (args.kind === filterHeaderKind && args.button === 0) {
                handleFilterMaybeClick(args);
            }

            if ((args.kind === "cell" && args.button === 0) || args.button === 1) {
                handleMaybeClick(args as GridMouseCellEventArgs);
            }

            lastMouseSelectLocation.current = undefined;
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [
            getMangledFilterCellContent,
            mouseState,
            gridSelection,
            rowMarkerOffset,
            fillHighlightRegion,
            fillPattern,
            setGridSelection,
            onCellClicked,
            getMangledCellContent,
            getCellRenderer,
            cellActivationBehavior,
            themeForCell,
            mangledOnCellsEdited,
            onCellActivated,
            reselect,
            onCellContextMenu,
            onHeaderContextMenu,
            onGroupHeaderContextMenu,
            handleSelect,
            onGroupHeaderClicked,
            onHeaderClicked,
            normalSizeColumn,
            handleGroupHeaderSelection,
            reselectFilter,
            defaultFilterCell,
        ]
    );

    const onMouseMoveImpl = React.useCallback(
        (args: GridMouseEventArgs) => {
            const a: GridMouseEventArgs = {
                ...args,
                location: [args.location[0] - rowMarkerOffset, args.location[1]] as any,
            };
            onMouseMove?.(a);

            if (mouseState !== undefined && args.buttons === 0) {
                setMouseState(undefined);
                setFillHighlightRegion(undefined);
                setScrollDir(undefined);
                isActivelyDraggingHeader.current = false;
            }

            setScrollDir(cv => {
                if (isActivelyDraggingHeader.current) return [args.scrollEdge[0], 0];
                if (args.scrollEdge[0] === cv?.[0] && args.scrollEdge[1] === cv[1]) return cv;
                return mouseState === undefined || (mouseDownData.current?.location[0] ?? 0) < rowMarkerOffset
                    ? undefined
                    : args.scrollEdge;
            });
        },
        [mouseState, onMouseMove, rowMarkerOffset]
    );

    const onHeaderMenuClickInner = React.useCallback(
        (col: number, screenPosition: Rectangle) => {
            onHeaderMenuClick?.(col - rowMarkerOffset, screenPosition);
        },
        [onHeaderMenuClick, rowMarkerOffset]
    );

    const onFilterClearClickInner = React.useCallback(
        (col: number, screenPosition: Rectangle) => {
            if (col < rowMarkerOffset) return;
            onFilterClearClick?.(col - rowMarkerOffset, screenPosition);
        },
        [onFilterClearClick, rowMarkerOffset]
    );

    const onHeaderIndicatorClickInner = React.useCallback(
        (col: number, screenPosition: Rectangle) => {
            onHeaderIndicatorClick?.(col - rowMarkerOffset, screenPosition);
        },
        [onHeaderIndicatorClick, rowMarkerOffset]
    );

    const currentCell = gridSelection?.current?.cell;
    const onVisibleRegionChangedImpl = React.useCallback(
        (
            region: Rectangle,
            clientWidth: number,
            clientHeight: number,
            rightElWidth: number,
            tx: number,
            ty: number
        ) => {
            hasJustScrolled.current = false;
            let selected = currentCell;
            if (selected !== undefined) {
                selected = [selected[0] - rowMarkerOffset, selected[1]];
            }

            const freezeRegion =
                freezeColumns === 0
                    ? undefined
                    : {
                          x: 0,
                          y: region.y,
                          width: freezeColumns,
                          height: region.height,
                      };

            const freezeRegions: Rectangle[] = [];
            if (freezeRegion !== undefined) freezeRegions.push(freezeRegion);
            if (freezeTrailingRows > 0) {
                freezeRegions.push({
                    x: region.x - rowMarkerOffset,
                    y: rows - freezeTrailingRows,
                    width: region.width,
                    height: freezeTrailingRows,
                });

                if (freezeColumns > 0) {
                    freezeRegions.push({
                        x: 0,
                        y: rows - freezeTrailingRows,
                        width: freezeColumns,
                        height: freezeTrailingRows,
                    });
                }
            }

            const newRegion = {
                x: region.x - rowMarkerOffset,
                y: region.y,
                width: region.width,
                height: showTrailingBlankRow && region.y + region.height >= rows ? region.height - 1 : region.height,
                tx,
                ty,
                extras: {
                    selected,
                    freezeRegion,
                    freezeRegions,
                },
            };
            visibleRegionRef.current = newRegion;
            setVisibleRegion(newRegion);
            setClientSize([clientWidth, clientHeight, rightElWidth]);
            onVisibleRegionChanged?.(newRegion, newRegion.tx, newRegion.ty, newRegion.extras);
        },
        [
            currentCell,
            rowMarkerOffset,
            showTrailingBlankRow,
            rows,
            freezeColumns,
            freezeTrailingRows,
            setVisibleRegion,
            onVisibleRegionChanged,
        ]
    );

    const onColumnProposeMoveImpl = whenDefined(
        onColumnProposeMove,
        React.useCallback(
            (startIndex: number, endIndex: number) => {
                return onColumnProposeMove?.(startIndex - rowMarkerOffset, endIndex - rowMarkerOffset) !== false;
            },
            [onColumnProposeMove, rowMarkerOffset]
        )
    );

    const onColumnMovedImpl = whenDefined(
        onColumnMoved,
        React.useCallback(
            (startIndex: number, endIndex: number) => {
                onColumnMoved?.(startIndex - rowMarkerOffset, endIndex - rowMarkerOffset);
                if (columnSelect !== "none") {
                    setSelectedColumns(CompactSelection.fromSingleSelection(endIndex), undefined, true);
                }
            },
            [columnSelect, onColumnMoved, rowMarkerOffset, setSelectedColumns]
        )
    );

    const isActivelyDragging = React.useRef(false);
    const onDragStartImpl = React.useCallback(
        (args: GridDragEventArgs) => {
            if (args.location[0] === 0 && rowMarkerOffset > 0) {
                args.preventDefault();
                return;
            }
            onDragStart?.({
                ...args,
                location: [args.location[0] - rowMarkerOffset, args.location[1]] as any,
            });

            if (!args.defaultPrevented()) {
                isActivelyDragging.current = true;
            }
            setMouseState(undefined);
        },
        [onDragStart, rowMarkerOffset]
    );

    const onDragEnd = React.useCallback(() => {
        isActivelyDragging.current = false;
    }, []);

    const rowGroupingSelectionBehavior = rowGrouping?.selectionBehavior;

    const getSelectionRowLimits = React.useCallback(
        (selectedRow: number): readonly [number, number] | undefined => {
            if (rowGroupingSelectionBehavior !== "block-spanning") return undefined;

            const { isGroupHeader, path, groupRows } = mapper(selectedRow);

            if (isGroupHeader) {
                return [selectedRow, selectedRow];
            }

            const groupRowIndex = path[path.length - 1];
            const lowerBounds = selectedRow - groupRowIndex;
            const upperBounds = selectedRow + groupRows - groupRowIndex - 1;

            return [lowerBounds, upperBounds];
        },
        [mapper, rowGroupingSelectionBehavior]
    );

    const hoveredRef = React.useRef<GridMouseEventArgs>();
    const onItemHoveredImpl = React.useCallback(
        (args: GridMouseEventArgs) => {
            // make sure we still have a button down
            // if (mouseEventArgsAreEqual(args, hoveredRef.current)) return;
            const isSameHoverTarget =
                mouseEventArgsAreEqual(args, hoveredRef.current) && !(hasRowMarkers && args.location[0] === 0);
            if (isSameHoverTarget) {
                let needsHoverPosition = false;

                if (args.kind === "cell") {
                    const resolvedCell =
                        (args as HoverResolvedGridMouseEventArgs).resolvedCell ?? getMangledCellContent(args.location);
                    const rendererNeeds = getCellRenderer(resolvedCell)?.needsHoverPosition;
                    needsHoverPosition = rendererNeeds ?? resolvedCell.kind === GridCellKind.Custom;
                }

                const sameLocalPosition =
                    args.kind !== "cell" ||
                    hoveredRef.current?.kind !== "cell" ||
                    (args.localEventX === hoveredRef.current.localEventX &&
                        args.localEventY === hoveredRef.current.localEventY);

                if (!needsHoverPosition || sameLocalPosition) {
                    return;
                }
            }

            hoveredRef.current = args;
            if (mouseDownData?.current?.button !== undefined && mouseDownData.current.button >= 1) return;
            // if (
            //     args.buttons !== 0 &&
            //     mouseState !== undefined &&
            //     mouseDownData.current?.location[0] === 0 &&
            //     args.location[0] === 0 &&
            //     rowMarkerOffset === 1 &&
            //     rowSelect === "multi" &&
            //     mouseState.previousSelection &&
            //     !mouseState.previousSelection.rows.hasIndex(mouseDownData.current.location[1]) &&
            //     gridSelection.rows.hasIndex(mouseDownData.current.location[1])
            // ) {
            //     const start = Math.min(mouseDownData.current.location[1], args.location[1]);
            //     const end = Math.max(mouseDownData.current.location[1], args.location[1]) + 1;
            //     setSelectedRows(CompactSelection.fromSingleSelection([start, end]), undefined, false);
            // }
            if (
                args.buttons !== 0 &&
                mouseState !== undefined &&
                gridSelection.current !== undefined &&
                !isActivelyDragging.current &&
                !isActivelyDraggingHeader.current &&
                (rangeSelect === "rect" || rangeSelect === "multi-rect")
            ) {
                const [selectedCol, selectedRow] = gridSelection.current.cell;
                // eslint-disable-next-line prefer-const
                let [col, row] = args.location;

                if (row < 0) {
                    row = visibleRegionRef.current.y;
                }

                if (mouseState.fillHandle === true && mouseState.previousSelection?.current !== undefined) {
                    const prevRange = mouseState.previousSelection.current.range;
                    row = Math.min(row, showTrailingBlankRow ? rows - 1 : rows);
                    const rect = getClosestRect(prevRange, col, row, allowedFillDirections);
                    setFillHighlightRegion(rect);
                } else {
                    const startedFromLastStickyRow = showTrailingBlankRow && selectedRow === rows;
                    if (startedFromLastStickyRow) return;

                    const landedOnLastStickyRow = showTrailingBlankRow && row === rows;
                    if (landedOnLastStickyRow) {
                        if (args.kind === outOfBoundsKind) row--;
                        else return;
                    }

                    col = Math.max(col, rowMarkerOffset);
                    const clampLimits = getSelectionRowLimits(selectedRow);
                    row = clampLimits === undefined ? row : clamp(row, clampLimits[0], clampLimits[1]);

                    // FIXME: Restrict row based on rowGrouping.selectionBehavior here

                    const deltaX = col - selectedCol;
                    const deltaY = row - selectedRow;

                    const newRange: Rectangle = {
                        x: deltaX >= 0 ? selectedCol : col,
                        y: deltaY >= 0 ? selectedRow : row,
                        width: Math.abs(deltaX) + 1,
                        height: Math.abs(deltaY) + 1,
                    };

                    setCurrent(
                        {
                            ...gridSelection.current,
                            range: newRange,
                        },
                        true,
                        false,
                        "drag"
                    );
                }
            }

            onItemHovered?.({ ...args, location: [args.location[0] - rowMarkerOffset, args.location[1]] as any });
        },
        [
            hasRowMarkers,
            mouseState,
            gridSelection,
            rangeSelect,
            onItemHovered,
            rowMarkerOffset,
            getMangledCellContent,
            getCellRenderer,
            showTrailingBlankRow,
            rows,
            allowedFillDirections,
            getSelectionRowLimits,
            setCurrent,
        ]
    );

    const adjustSelectionOnScroll = React.useCallback(() => {
        const args = hoveredRef.current;
        if (args === undefined) return;
        const [xDir, yDir] = args.scrollEdge;
        let [col, row] = args.location;
        const visible = visibleRegionRef.current;
        if (xDir === -1) {
            col = visible.extras?.freezeRegion?.x ?? visible.x;
        } else if (xDir === 1) {
            col = visible.x + visible.width;
        }
        if (yDir === -1) {
            row = Math.max(0, visible.y);
        } else if (yDir === 1) {
            row = Math.min(rows - 1, visible.y + visible.height);
        }
        col = clamp(col, 0, mangledCols.length - 1);
        row = clamp(row, 0, rows - 1);
        onItemHoveredImpl({
            ...args,
            location: [col, row] as any,
        });
    }, [mangledCols.length, onItemHoveredImpl, rows]);

    useAutoscroll(scrollDir, scrollRef, adjustSelectionOnScroll);

    // 1 === move one
    // 2 === move to end
    const adjustSelection = React.useCallback(
        (direction: [0 | 1 | -1 | 2 | -2, 0 | 1 | -1 | 2 | -2]) => {
            if (gridSelection.current === undefined) return;

            const [x, y] = direction;
            const [col, row] = gridSelection.current.cell;
            const old = gridSelection.current.range;
            let left = old.x;
            let right = old.x + old.width;
            let top = old.y;
            let bottom = old.y + old.height;

            const [minRow, maxRowRaw] = getSelectionRowLimits(row) ?? [0, rows - 1];
            const maxRow = maxRowRaw + 1; // we need an inclusive value

            // take care of vertical first in case new spans come in
            if (y !== 0) {
                switch (y) {
                    case 2: {
                        // go to end
                        bottom = maxRow;
                        top = row;
                        scrollTo(0, bottom, "vertical");

                        break;
                    }
                    case -2: {
                        // go to start
                        top = minRow;
                        bottom = row + 1;
                        scrollTo(0, top, "vertical");

                        break;
                    }
                    case 1: {
                        // motion down
                        if (top < row) {
                            top++;
                            scrollTo(0, top, "vertical");
                        } else {
                            bottom = Math.min(maxRow, bottom + 1);
                            scrollTo(0, bottom, "vertical");
                        }

                        break;
                    }
                    case -1: {
                        // motion up
                        if (bottom > row + 1) {
                            bottom--;
                            scrollTo(0, bottom, "vertical");
                        } else {
                            top = Math.max(minRow, top - 1);
                            scrollTo(0, top, "vertical");
                        }

                        break;
                    }
                    default: {
                        assertNever(y);
                    }
                }
            }

            if (x !== 0) {
                if (x === 2) {
                    right = mangledCols.length;
                    left = col;
                    scrollTo(right - 1 - rowMarkerOffset, 0, "horizontal");
                } else if (x === -2) {
                    left = rowMarkerOffset;
                    right = col + 1;
                    scrollTo(left - rowMarkerOffset, 0, "horizontal");
                } else {
                    let disallowed: number[] = [];
                    if (getCellsForSelection !== undefined) {
                        const cells = getCellsForSelection(
                            {
                                x: left,
                                y: top,
                                width: right - left - rowMarkerOffset,
                                height: bottom - top,
                            },
                            abortControllerRef.current.signal
                        );

                        if (typeof cells === "object") {
                            disallowed = getSpanStops(cells);
                        }
                    }
                    if (x === 1) {
                        // motion right
                        let done = false;
                        if (left < col) {
                            if (disallowed.length > 0) {
                                const target = makeRange(left + 1, col + 1).find(
                                    n => !disallowed.includes(n - rowMarkerOffset)
                                );
                                if (target !== undefined) {
                                    left = target;
                                    done = true;
                                }
                            } else {
                                left++;
                                done = true;
                            }
                            if (done) scrollTo(left, 0, "horizontal");
                        }
                        if (!done) {
                            right = Math.min(mangledCols.length, right + 1);
                            scrollTo(right - 1 - rowMarkerOffset, 0, "horizontal");
                        }
                    } else if (x === -1) {
                        // motion left
                        let done = false;
                        if (right > col + 1) {
                            if (disallowed.length > 0) {
                                const target = makeRange(right - 1, col, -1).find(
                                    n => !disallowed.includes(n - rowMarkerOffset)
                                );
                                if (target !== undefined) {
                                    right = target;
                                    done = true;
                                }
                            } else {
                                right--;
                                done = true;
                            }
                            if (done) scrollTo(right - rowMarkerOffset, 0, "horizontal");
                        }
                        if (!done) {
                            left = Math.max(rowMarkerOffset, left - 1);
                            scrollTo(left - rowMarkerOffset, 0, "horizontal");
                        }
                    } else {
                        assertNever(x);
                    }
                }
            }

            setCurrent(
                {
                    cell: gridSelection.current.cell,
                    range: {
                        x: left,
                        y: top,
                        width: right - left,
                        height: bottom - top,
                    },
                },
                true,
                false,
                "keyboard-select"
            );
        },
        [
            getCellsForSelection,
            getSelectionRowLimits,
            gridSelection,
            mangledCols.length,
            rowMarkerOffset,
            rows,
            scrollTo,
            setCurrent,
        ]
    );

    const scrollToActiveCellRef = React.useRef(scrollToActiveCell);
    scrollToActiveCellRef.current = scrollToActiveCell;

    const updateSelectedCell = React.useCallback(
        (col: number, row: number, fromEditingTrailingRow: boolean, freeMove: boolean): boolean => {
            const rowMax = mangledRows - (fromEditingTrailingRow ? 0 : 1);
            col = clamp(col, 0, columns.length - 1 + rowMarkerOffset);
            row = row === -3 ? -3 : clamp(row, 0, rowMax);

            const curCol = currentCell?.[0];
            const curRow = currentCell?.[1];

            if (col === curCol && row === curRow) return false;

            if (row === -3 && gridSelection.current !== undefined) {
                setGridSelection(
                    {
                        ...gridSelection,
                        current: {
                            ...gridSelection.current,
                            cell: [col, row],
                            range: { x: col, y: row, width: 1, height: 1 },
                        },
                    },
                    false
                );
                coSelectedRowsForCurrentRef.current = CompactSelection.empty();
            } else if (freeMove && gridSelection.current !== undefined) {
                const newStack = [...gridSelection.current.rangeStack];
                if (gridSelection.current.range.width > 1 || gridSelection.current.range.height > 1) {
                    newStack.push(gridSelection.current.range);
                }
                setGridSelection(
                    {
                        ...gridSelection,
                        current: {
                            cell: [col, row],
                            range: { x: col, y: row, width: 1, height: 1 },
                            rangeStack: newStack,
                        },
                    },
                    rowSelectionBlending === "mixed" && columnSelectionBlending === "mixed"
                );
                coSelectedRowsForCurrentRef.current = CompactSelection.empty();
            } else {
                setCurrent(
                    {
                        cell: [col, row],
                        range: { x: col, y: row, width: 1, height: 1 },
                    },
                    true,
                    false,
                    "keyboard-nav"
                );
                coSelectedRowsForCurrentRef.current = CompactSelection.empty();

                const isTrailingRow =
                    row === mangledRows - 1 && showTrailingBlankRow && trailingRowOptions?.sticky === true;

                if (gridSelection.rows.length > 0) {
                    const targetRowSlice = isTrailingRow ? ([row - 1, row] as Slice) : getSelectedRowSlice([col, row]);
                    setSelectedRowsAndCell(
                        CompactSelection.fromSingleSelection(targetRowSlice),
                        lastSelectedCurrent.current
                            ? {
                                  ...lastSelectedCurrent.current,
                                  cell: [col, row],
                                  range: {
                                      ...lastSelectedCurrent.current.range,
                                      x: col,
                                      y: row,
                                  },
                              }
                            : undefined,
                        undefined,
                        rowSelectionBlending === "mixed" && columnSelectionBlending === "mixed"
                    );
                }
            }

            if (lastSent.current !== undefined && lastSent.current[0] === col && lastSent.current[1] === row) {
                lastSent.current = undefined;
            }

            if (scrollToActiveCellRef.current) {
                scrollTo(col - rowMarkerOffset, row);
            }

            return true;
        },
        [
            mangledRows,
            columns.length,
            rowMarkerOffset,
            currentCell,
            gridSelection,
            setGridSelection,
            rowSelectionBlending,
            columnSelectionBlending,
            setCurrent,
            showTrailingBlankRow,
            trailingRowOptions?.sticky,
            getSelectedRowSlice,
            setSelectedRowsAndCell,
            scrollTo,
        ]
    );

    const onEditingIn = React.useCallback(
        (newValue: GridCell | undefined) => {
            if (overlay?.cell !== undefined && newValue !== undefined && isEditableGridCell(newValue)) {
                const item = { location: overlay.cell, value: newValue };
                const mangledItem =
                    rowMarkerOffset === 0
                        ? { ...item }
                        : {
                              ...item,
                              location: [item.location[0] - rowMarkerOffset, item.location[1]] as const,
                          };

                onCellEditing?.(mangledItem.location, mangledItem.value);
            }
        },
        [overlay?.cell, rowMarkerOffset, onCellEditing]
    );

    const onFinishEditing = React.useCallback(
        (newValue: GridCell | undefined, movement: readonly [-1 | 0 | 1, -1 | 0 | 1 | -3], eventKey?: string) => {
            if (overlay?.cell !== undefined && newValue !== undefined && isEditableGridCell(newValue)) {
                mangledOnCellsEdited([{ location: overlay.cell, value: newValue }], eventKey);
                window.requestAnimationFrame(() => {
                    gridRef.current?.damage([
                        {
                            cell: overlay.cell,
                        },
                    ]);
                });
            } else if (overlay?.cell !== undefined && newValue === undefined) {
                onCellBlur?.([overlay.cell[0] - rowMarkerOffset, overlay.cell[1]], overlay.content, eventKey);
            }
            focus(true);
            setOverlay(undefined);

            const [movX, movY] = movement;

            if (gridSelection.current !== undefined && (movX !== 0 || movY !== 0)) {
                if (movY === -3) {
                    // 从第一行往上到filter
                    keyboardMoveFilterCell.current = true;
                    focusOnRowFromTrailingBlankRow(gridSelection.current.cell[0], -3);
                    setGridSelection(
                        {
                            ...gridSelection,
                            current: {
                                ...gridSelection.current,
                                cell: [gridSelection.current.cell[0], -3],
                                range: {
                                    ...gridSelection.current.range,
                                    y: -3,
                                },
                            },
                        },
                        false
                    );
                }

                if (gridSelection.current.cell?.[1] === -3) {
                    const newCol = clamp(gridSelection.current.cell[0] + movX, 0, mangledCols.length - 1);

                    // filter行快捷键
                    if (movX !== 0) {
                        // 水平移动
                        keyboardMoveFilterCell.current = true;
                        window.setTimeout(() => {
                            focusOnRowFromTrailingBlankRow(newCol, -3);
                        }, 0);
                    } else if (movY !== 0) {
                        // 上下移动
                        keyboardMoveFilterCell.current = false;
                    }
                }

                const isEditingLastRow = gridSelection.current.cell[1] === mangledRows - 1 && newValue !== undefined;
                const isEditingLastCol =
                    gridSelection.current.cell[0] === mangledCols.length - 1 && newValue !== undefined;
                let updateSelected = true;
                if (isEditingLastRow && movY === 1 && onRowAppended !== undefined) {
                    updateSelected = false;
                    const col = gridSelection.current.cell[0] + movX;
                    const customTargetColumn = getCustomNewRowTargetColumn(col);
                    void appendRow(customTargetColumn ?? col, false);
                }
                if (isEditingLastCol && movX === 1 && onColumnAppended !== undefined) {
                    updateSelected = false;
                    const row = gridSelection.current.cell[1] + movY;
                    void appendColumn(row, false);
                }
                if (updateSelected) {
                    updateSelectedCell(
                        clamp(gridSelection.current.cell[0] + movX, 0, mangledCols.length - 1),
                        gridSelection.current.cell?.[1] === -3 && keyboardMoveFilterCell.current === true
                            ? -3
                            : clamp(gridSelection.current.cell[1] + movY, 0, mangledRows - 1),
                        isEditingLastRow,
                        false
                    );

                    keyboardMoveFilterCell.current = false;
                }
            }
            onFinishedEditing?.(newValue, movement, eventKey);
        },
        [
            overlay?.cell,
            overlay?.content,
            focus,
            gridSelection,
            onFinishedEditing,
            mangledOnCellsEdited,
            mangledRows,
            updateSelectedCell,
            mangledCols.length,
            appendRow,
            appendColumn,
            onRowAppended,
            onColumnAppended,
            getCustomNewRowTargetColumn,
            setGridSelection,
            focusOnRowFromTrailingBlankRow,
            onCellBlur,
            rowMarkerOffset,
        ]
    );

    const overlayID = React.useMemo(() => {
        return `gdg-overlay-${idCounter++}`;
    }, []);

    const deleteRange = React.useCallback(
        (r: Rectangle, deletedCells?: Set<string>) => {
            focus();
            const editList: EditListItem[] = [];
            for (let x = r.x; x < r.x + r.width; x++) {
                for (let y = r.y; y < r.y + r.height; y++) {
                    const key = `${x}:${y}`;
                    if (deletedCells?.has(key) === true) continue;
                    deletedCells?.add(key);

                    const cellValue = getCellContent([x - rowMarkerOffset, y]);
                    if (!cellValue.allowOverlay && cellValue.kind !== GridCellKind.Boolean) continue;
                    let newVal: InnerGridCell | undefined = undefined;
                    if (cellValue.kind === GridCellKind.Custom) {
                        const toDelete = getCellRenderer(cellValue);
                        const editor = toDelete?.provideEditor?.({
                            ...cellValue,
                            location: [x - rowMarkerOffset, y],
                        });
                        if (toDelete?.onDelete !== undefined) {
                            newVal = toDelete.onDelete(cellValue);
                        } else if (isObjectEditorCallbackResult(editor)) {
                            newVal = editor?.deletedValue?.(cellValue);
                        }
                    } else if (
                        (isEditableGridCell(cellValue) && cellValue.allowOverlay) ||
                        cellValue.kind === GridCellKind.Boolean
                    ) {
                        const toDelete = getCellRenderer(cellValue);
                        newVal = toDelete?.onDelete?.(cellValue);
                    }
                    if (newVal !== undefined && !isInnerOnlyCell(newVal) && isEditableGridCell(newVal)) {
                        editList.push({ location: [x, y], value: newVal });
                    }
                }
            }
            if (editList.length === 0) return;
            mangledOnCellsEdited(editList);
            gridRef.current?.damage(editList.map(x => ({ cell: x.location })));
        },
        [focus, getCellContent, getCellRenderer, mangledOnCellsEdited, rowMarkerOffset]
    );

    const overlayOpen = overlay !== undefined;

    const handleFixedKeybindings = React.useCallback(
        (event: GridKeyEventArgs): boolean => {
            const cancel = () => {
                event.stopPropagation();
                event.preventDefault();
            };

            const details = {
                didMatch: false,
            };

            const { bounds } = event;
            const selectedColumns = gridSelection.columns;
            const selectedRows = gridSelection.rows;

            const keys = keybindings;

            if (!overlayOpen && isHotkey(keys.clear, event, details)) {
                setGridSelection(emptyGridSelection, false);
                setRowMarkerFocus(undefined);
                onSelectionCleared?.();
            } else if (!overlayOpen && isHotkey(keys.selectAll, event, details)) {
                setGridSelection(
                    {
                        columns: CompactSelection.empty(),
                        rows: CompactSelection.empty(),
                        current: {
                            cell: gridSelection.current?.cell ?? [rowMarkerOffset, 0],
                            range: {
                                x: rowMarkerOffset,
                                y: 0,
                                width: columnsIn.length,
                                height: rows,
                            },
                            rangeStack: [],
                        },
                    },
                    false
                );
            } else if (isHotkey(keys.search, event, details)) {
                searchInputRef?.current?.focus({ preventScroll: true });
                setShowSearchInner(true);
            } else if (isHotkey(keys.delete, event, details)) {
                const defaultDeleteSelection = getNormalizedSelection(gridSelection);
                const callbackResult = onDelete?.(defaultDeleteSelection) ?? true;
                if (callbackResult !== false) {
                    const usingDefaultSelection =
                        callbackResult === true || selectionMatches(callbackResult, defaultDeleteSelection);
                    const toDelete = usingDefaultSelection ? getMutationSelection(gridSelection) : callbackResult;
                    const rangeRows =
                        toDelete.current === undefined
                            ? CompactSelection.empty()
                            : [toDelete.current.range, ...toDelete.current.rangeStack].reduce(
                                  (acc, selectionRange) =>
                                      selectionRange.height > 1
                                          ? acc.add([selectionRange.y, selectionRange.y + selectionRange.height])
                                          : acc,
                                  CompactSelection.empty()
                              );
                    const skipCoSelectedRows =
                        usingDefaultSelection &&
                        toDelete.current !== undefined &&
                        rowMarkerFocus === undefined &&
                        toDelete.rows.length > 0 &&
                        (toDelete.rows.equals(coSelectedRowsForCurrentRef.current) ||
                            (rangeRows.length > 0 && toDelete.rows.equals(rangeRows)));

                    // delete order:
                    // 1) primary range
                    // 2) secondary ranges
                    // 3) columns
                    // 4) rows

                    const deletedCells = new Set<string>();
                    if (toDelete.current !== undefined) {
                        deleteRange(toDelete.current.range, deletedCells);
                        for (const r of toDelete.current.rangeStack) {
                            deleteRange(r, deletedCells);
                        }
                    }

                    if (!skipCoSelectedRows) {
                        for (const r of toDelete.rows) {
                            deleteRange(
                                {
                                    x: rowMarkerOffset,
                                    y: r,
                                    width: columnsIn.length,
                                    height: 1,
                                },
                                deletedCells
                            );
                        }
                    }

                    for (const col of toDelete.columns) {
                        deleteRange(
                            {
                                x: col,
                                y: 0,
                                width: 1,
                                height: rows,
                            },
                            deletedCells
                        );
                    }
                }
            }

            if (details.didMatch) {
                cancel();
                return true;
            }

            if (gridSelection.current === undefined) return false;
            let [col, row] = gridSelection.current.cell;
            const [, startRow] = gridSelection.current.cell;
            let freeMove = false;
            let cancelOnlyOnMove = false;

            if (isHotkey(keys.scrollToSelectedCell, event, details)) {
                scrollToRef.current(col - rowMarkerOffset, row);
            } else if (columnSelect !== "none" && isHotkey(keys.selectColumn, event, details)) {
                if (selectedColumns.hasIndex(col)) {
                    setSelectedColumns(selectedColumns.remove(col), undefined, true);
                } else {
                    if (columnSelect === "single") {
                        setSelectedColumns(CompactSelection.fromSingleSelection(col), undefined, true);
                    } else {
                        setSelectedColumns(undefined, col, true);
                    }
                }
            } else if (rowSelect !== "none" && isHotkey(keys.selectRow, event, details)) {
                const targetRowSlice = getSelectedRowSlice([col, row]);

                if (selectedRows.hasAll(targetRowSlice)) {
                    const nextRows = selectedRows.remove(targetRowSlice);
                    setSelectedRows(nextRows, undefined, true);
                    coSelectedRowsForCurrentRef.current = CompactSelection.empty();
                    lastSelectedRowRef.current = undefined;
                    lastSelectedRowRangeRef.current = undefined;
                } else {
                    const nextRows =
                        rowSelect === "single"
                            ? CompactSelection.fromSingleSelection(targetRowSlice)
                            : selectedRows.add(targetRowSlice);
                    if (rowSelect === "single") {
                        setSelectedRows(nextRows, undefined, true);
                    } else {
                        setSelectedRows(undefined, targetRowSlice, true);
                    }
                    coSelectedRowsForCurrentRef.current = CompactSelection.empty();
                    lastSelectedRowRef.current = targetRowSlice[0];
                    lastSelectedRowRangeRef.current = targetRowSlice;
                }
            } else if (!overlayOpen && bounds !== undefined && isHotkey(keys.activateCell, event, details)) {
                if (row === rows && showTrailingBlankRow) {
                    window.setTimeout(() => {
                        const customTargetColumn = getCustomNewRowTargetColumn(col);
                        void appendRow(customTargetColumn ?? col);
                    }, 0);
                } else {
                    const activationEvent: CellActivatedEventArgs = {
                        inputType: "keyboard",
                        key: event.key,
                    };
                    // onCellActivated?.([col - rowMarkerOffset, row], activationEvent);
                    reselect(bounds, activationEvent);
                }
            } else if (gridSelection.current.range.height > 1 && isHotkey(keys.downFill, event, details)) {
                fillDown();
            } else if (gridSelection.current.range.width > 1 && isHotkey(keys.rightFill, event, details)) {
                fillRight();
            } else if (isHotkey(keys.goToNextPage, event, details)) {
                row += Math.max(1, visibleRegionRef.current.height - 4); // partial cell accounting
            } else if (isHotkey(keys.goToPreviousPage, event, details)) {
                row -= Math.max(1, visibleRegionRef.current.height - 4); // partial cell accounting
            } else if (isHotkey(keys.goToFirstCell, event, details)) {
                setOverlay(undefined);
                row = 0;
                col = 0;
            } else if (isHotkey(keys.goToLastCell, event, details)) {
                setOverlay(undefined);
                row = Number.MAX_SAFE_INTEGER;
                col = Number.MAX_SAFE_INTEGER;
            } else if (isHotkey(keys.selectToFirstCell, event, details)) {
                setOverlay(undefined);
                adjustSelection([-2, -2]);
            } else if (isHotkey(keys.selectToLastCell, event, details)) {
                setOverlay(undefined);
                adjustSelection([2, 2]);
            } else if (!overlayOpen) {
                if (isHotkey(keys.goDownCell, event, details)) {
                    row += 1;
                } else if (isHotkey(keys.goUpCell, event, details)) {
                    const before = row;
                    row -= row === 0 && showFilter ? 0 : 1;

                    if (before === 0 && row === 0 && gridSelection.current !== undefined) {
                        focusOnRowFromTrailingBlankRow(gridSelection.current.cell[0], -3);
                        setGridSelection(
                            {
                                ...gridSelection,
                                current: {
                                    ...gridSelection.current,
                                    cell: [gridSelection.current.cell[0], -3],
                                    range: {
                                        ...gridSelection.current.range,
                                        y: -3,
                                    },
                                },
                            },
                            false
                        );
                    }
                } else if (isHotkey(keys.goRightCell, event, details)) {
                    col += 1;
                } else if (isHotkey(keys.goLeftCell, event, details)) {
                    col -= 1;
                } else if (isHotkey(keys.goDownCellRetainSelection, event, details)) {
                    row += 1;
                    freeMove = true;
                } else if (isHotkey(keys.goUpCellRetainSelection, event, details)) {
                    row -= 1;
                    freeMove = true;
                } else if (isHotkey(keys.goRightCellRetainSelection, event, details)) {
                    col += 1;
                    freeMove = true;
                } else if (isHotkey(keys.goLeftCellRetainSelection, event, details)) {
                    col -= 1;
                    freeMove = true;
                } else if (isHotkey(keys.goToLastRow, event, details)) {
                    row = rows - 1;
                } else if (isHotkey(keys.goToFirstRow, event, details)) {
                    row = Number.MIN_SAFE_INTEGER;
                } else if (isHotkey(keys.goToLastColumn, event, details)) {
                    col = Number.MAX_SAFE_INTEGER;
                } else if (isHotkey(keys.goToFirstColumn, event, details)) {
                    col = Number.MIN_SAFE_INTEGER;
                } else if (rangeSelect === "rect" || rangeSelect === "multi-rect") {
                    if (isHotkey(keys.selectGrowDown, event, details)) {
                        adjustSelection([0, 1]);
                    } else if (isHotkey(keys.selectGrowUp, event, details)) {
                        adjustSelection([0, -1]);
                    } else if (isHotkey(keys.selectGrowRight, event, details)) {
                        adjustSelection([1, 0]);
                    } else if (isHotkey(keys.selectGrowLeft, event, details)) {
                        adjustSelection([-1, 0]);
                    } else if (isHotkey(keys.selectToLastRow, event, details)) {
                        adjustSelection([0, 2]);
                    } else if (isHotkey(keys.selectToFirstRow, event, details)) {
                        adjustSelection([0, -2]);
                    } else if (isHotkey(keys.selectToLastColumn, event, details)) {
                        adjustSelection([2, 0]);
                    } else if (isHotkey(keys.selectToFirstColumn, event, details)) {
                        adjustSelection([-2, 0]);
                    }
                }
                cancelOnlyOnMove = details.didMatch;
            } else {
                if (isHotkey(keys.closeOverlay, event, details)) {
                    setOverlay(undefined);
                }

                if (isHotkey(keys.acceptOverlayDown, event, details)) {
                    setOverlay(undefined);
                    row++;
                }

                if (isHotkey(keys.acceptOverlayUp, event, details)) {
                    setOverlay(undefined);
                    row--;
                }

                if (isHotkey(keys.acceptOverlayLeft, event, details)) {
                    setOverlay(undefined);
                    col--;
                }

                if (isHotkey(keys.acceptOverlayRight, event, details)) {
                    setOverlay(undefined);
                    // reselect(bounds, true);
                    col++;
                }
            }
            // #endregion

            const mustRestrictRow = rowGroupingNavBehavior !== undefined && rowGroupingNavBehavior !== "normal";

            if (mustRestrictRow && row !== startRow) {
                const skipUp =
                    rowGroupingNavBehavior === "skip-up" ||
                    rowGroupingNavBehavior === "skip" ||
                    rowGroupingNavBehavior === "block";
                const skipDown =
                    rowGroupingNavBehavior === "skip-down" ||
                    rowGroupingNavBehavior === "skip" ||
                    rowGroupingNavBehavior === "block";
                const didMoveUp = row < startRow;
                if (didMoveUp && skipUp) {
                    while (row >= 0 && mapper(row).isGroupHeader) {
                        row--;
                    }

                    if (row < 0) {
                        row = startRow;
                    }
                } else if (!didMoveUp && skipDown) {
                    while (row < rows && mapper(row).isGroupHeader) {
                        row++;
                    }

                    if (row >= rows) {
                        row = startRow;
                    }
                }
            }

            const moved = updateSelectedCell(col, row, false, freeMove);

            const didMatch = details.didMatch;

            if (didMatch && (moved || !cancelOnlyOnMove || trapFocus)) {
                cancel();
            }

            return didMatch;
        },
        [
            gridSelection,
            keybindings,
            overlayOpen,
            columnSelect,
            rowSelect,
            rowGroupingNavBehavior,
            updateSelectedCell,
            trapFocus,
            setGridSelection,
            onSelectionCleared,
            rowMarkerOffset,
            columnsIn.length,
            rows,
            onDelete,
            deleteRange,
            getNormalizedSelection,
            getMutationSelection,
            rowMarkerFocus,
            setSelectedColumns,
            setSelectedRows,
            setRowMarkerFocus,
            showTrailingBlankRow,
            getCustomNewRowTargetColumn,
            appendRow,
            reselect,
            fillDown,
            fillRight,
            adjustSelection,
            rangeSelect,
            showFilter,
            focusOnRowFromTrailingBlankRow,
            getSelectedRowSlice,
            mapper,
        ]
    );

    const onKeyDown = React.useCallback(
        (event: GridKeyEventArgs) => {
            let cancelled = false;
            if (onKeyDownIn !== undefined) {
                onKeyDownIn({
                    ...event,
                    ...(event.location && {
                        location: [event.location[0] - rowMarkerOffset, event.location[1]] as any,
                    }),
                    cancel: () => {
                        cancelled = true;
                    },
                });
            }

            if (cancelled) return;

            if (handleFixedKeybindings(event)) return;

            if (gridSelection.current === undefined) return;
            const [col, row] = gridSelection.current.cell;
            const vr = visibleRegionRef.current;

            if (
                editOnType &&
                !event.metaKey &&
                !event.ctrlKey &&
                gridSelection.current !== undefined &&
                event.key.length === 1 &&
                /[\p{L}\p{M}\p{N}\p{S}\p{P}]/u.test(event.key) &&
                event.bounds !== undefined &&
                isReadWriteCell(getCellContent([col - rowMarkerOffset, Math.max(0, Math.min(row, rows - 1))]))
            ) {
                if (
                    (!showTrailingBlankRow || row !== rows) &&
                    (vr.y > row || row > vr.y + vr.height || vr.x > col || col > vr.x + vr.width)
                ) {
                    return;
                }
                const activationEvent: CellActivatedEventArgs = {
                    inputType: "keyboard",
                    key: event.key,
                };
                onCellActivated?.([col - rowMarkerOffset, row], activationEvent);
                reselect(event.bounds, activationEvent, event.key);
                event.stopPropagation();
                event.preventDefault();
            }
        },
        [
            editOnType,
            onKeyDownIn,
            handleFixedKeybindings,
            gridSelection,
            getCellContent,
            rowMarkerOffset,
            rows,
            showTrailingBlankRow,
            onCellActivated,
            reselect,
        ]
    );

    const onContextMenu = React.useCallback(
        (args: GridMouseEventArgs, preventDefault: () => void, sourceEvent: MouseEvent) => {
            const adjustedCol = args.location[0] - rowMarkerOffset;
            if (args.kind === "header") {
                onHeaderContextMenu?.(adjustedCol, { ...args, preventDefault, sourceEvent });
            }

            if (args.kind === groupHeaderKind) {
                if (adjustedCol < 0) {
                    return;
                }
                onGroupHeaderContextMenu?.(adjustedCol, { ...args, preventDefault, sourceEvent });
            }

            if (args.kind === "cell") {
                /**
                 * 右键选择功能
                 * 1. 右击选中行、单元格
                 * 2. 如果点击位置已经在当前 selection 内，则保持 selection 不变
                 */
                const [col, row] = args.location;
                lastSelectedColRef.current = undefined;
                lastMouseSelectLocation.current = [col, row];

                const [cellCol, cellRow] = gridSelection.current?.cell ?? [];
                onCellContextMenu?.([adjustedCol, row], {
                    ...args,
                    preventDefault,
                    sourceEvent,
                });

                let selectionCurrentForClick: NonNullable<GridSelection["current"]> | null | undefined;
                if (col < rowMarkerOffset) {
                    lastSelectedCurrent.current = undefined;
                    selectionCurrentForClick = rowSelectionBlending === "exclusive" ? null : undefined;
                    setRowMarkerFocus([col, row]);
                } else {
                    if (cellCol !== col || cellRow !== row) {
                        lastSelectedCurrent.current = {
                            cell: [col, row],
                            range: { x: col, y: row, width: 1, height: 1 },
                            rangeStack: [],
                        };
                    }
                    selectionCurrentForClick = lastSelectedCurrent.current;
                    setRowMarkerFocus(undefined);
                }

                setOverlay(undefined);
                focus();
                const targetRowSlice = getSelectedRowSlice([col, row]);
                const isSelected = gridSelectionHasItem(gridSelection, [col, row]);

                if (!isSelected) {
                    setSelectedRowsAndCell(
                        CompactSelection.fromSingleSelection(targetRowSlice),
                        selectionCurrentForClick,
                        undefined,
                        rowSelectionBlending === "mixed" && columnSelectionBlending === "mixed"
                    );
                    lastSelectedRowRef.current = targetRowSlice[0];
                    lastSelectedRowRangeRef.current = targetRowSlice;
                }

                // if (!gridSelectionHasItem(gridSelection, args.location)) {
                //     updateSelectedCell(col, row, false, false);
                // }
            }
        },
        [
            columnSelectionBlending,
            focus,
            gridSelection,
            onCellContextMenu,
            onGroupHeaderContextMenu,
            onHeaderContextMenu,
            rowMarkerOffset,
            rowSelectionBlending,
            getSelectedRowSlice,
            setSelectedRowsAndCell,
        ]
    );

    const onPasteInternal = React.useCallback(
        async (e?: ClipboardEvent) => {
            if (!keybindings.paste) return;
            function pasteToCell(
                inner: InnerGridCell,
                target: Item,
                rawValue: string | boolean | string[] | number | boolean | BooleanEmpty | BooleanIndeterminate,
                formatted?: string | string[]
            ): EditListItem | undefined {
                const stringifiedRawValue =
                    typeof rawValue === "object" ? (rawValue?.join("\n") ?? "") : (rawValue?.toString() ?? "");

                if (!isInnerOnlyCell(inner) && isReadWriteCell(inner) && inner.readonly !== true) {
                    const coerced = coercePasteValue?.(stringifiedRawValue, inner);
                    if (coerced !== undefined && isEditableGridCell(coerced)) {
                        if (process.env.NODE_ENV !== "production" && coerced.kind !== inner.kind) {
                            // eslint-disable-next-line no-console
                            console.warn("Coercion should not change cell kind.");
                        }
                        return {
                            location: target,
                            value: coerced,
                        };
                    }
                    const r = getCellRenderer(inner);
                    if (r === undefined) return undefined;
                    if (r.kind === GridCellKind.Custom) {
                        assert(inner.kind === GridCellKind.Custom);
                        const newVal = (r as unknown as CustomRenderer<CustomCell<any>>).onPaste?.(
                            stringifiedRawValue,
                            inner.data
                        );
                        if (newVal === undefined) return undefined;
                        return {
                            location: target,
                            value: {
                                ...inner,
                                data: newVal,
                            },
                        };
                    } else {
                        const newVal = r.onPaste?.(stringifiedRawValue, inner, {
                            formatted,
                            formattedString: typeof formatted === "string" ? formatted : formatted?.join("\n"),
                            rawValue,
                        });
                        if (newVal === undefined) return undefined;
                        assert(newVal.kind === inner.kind);
                        return {
                            location: target,
                            value: newVal,
                        };
                    }
                }
                return undefined;
            }

            const selectedColumns = gridSelection.columns;
            const selectedRows = gridSelection.rows;
            const focused =
                scrollRef.current?.contains(document.activeElement) === true ||
                canvasRef.current?.contains(document.activeElement) === true;

            let target: Item | undefined;

            if (gridSelection.current !== undefined) {
                target = [gridSelection.current.range.x, gridSelection.current.range.y];
            } else if (selectedColumns.length === 1) {
                target = [selectedColumns.first() ?? 0, 0];
            } else if (selectedRows.length === 1) {
                target = [rowMarkerOffset, selectedRows.first() ?? 0];
            }

            if (focused && target !== undefined) {
                let data: CopyBuffer | undefined;
                let text: string | undefined;

                const textPlain = "text/plain";
                const textHtml = "text/html";

                if (navigator.clipboard?.read !== undefined) {
                    const clipboardContent = await navigator.clipboard.read();

                    for (const item of clipboardContent) {
                        if (item.types.includes(textHtml)) {
                            const htmlBlob = await item.getType(textHtml);
                            const html = await htmlBlob.text();
                            const decoded = decodeHTML(html);
                            if (decoded !== undefined) {
                                data = decoded;
                                break;
                            }
                        }
                        if (item.types.includes(textPlain)) {
                            // eslint-disable-next-line unicorn/no-await-expression-member
                            text = await (await item.getType(textPlain)).text();
                        }
                    }
                } else if (navigator.clipboard?.readText !== undefined) {
                    text = await navigator.clipboard.readText();
                } else if (e !== undefined && e?.clipboardData !== null) {
                    if (e.clipboardData.types.includes(textHtml)) {
                        const html = e.clipboardData.getData(textHtml);
                        data = decodeHTML(html);
                    }
                    if (data === undefined && e.clipboardData.types.includes(textPlain)) {
                        text = e.clipboardData.getData(textPlain);
                    }
                } else {
                    return; // I didn't want to read that paste value anyway
                }

                const [targetCol, targetRow] = target;

                const editList: EditListItem[] = [];
                do {
                    if (onPaste === undefined) {
                        const cellData = getMangledCellContent(target);
                        const rawValue = text ?? data?.map(r => r.map(cb => cb.rawValue).join("\t")).join("\t") ?? "";
                        const newVal = pasteToCell(cellData, target, rawValue, undefined);
                        if (newVal !== undefined) {
                            editList.push(newVal);
                        }
                        break;
                    }

                    if (data === undefined) {
                        if (text === undefined) return;
                        data = unquote(text);
                    }

                    if (
                        onPaste === false ||
                        (typeof onPaste === "function" &&
                            onPaste?.(
                                [target[0] - rowMarkerOffset, target[1]],
                                data.map(r => r.map(cb => cb.rawValue?.toString() ?? ""))
                            ) !== true)
                    ) {
                        return;
                    }

                    for (const [row, dataRow] of data.entries()) {
                        if (row + targetRow >= rows) break;
                        for (const [col, dataItem] of dataRow.entries()) {
                            const index = [col + targetCol, row + targetRow] as const;
                            const [writeCol, writeRow] = index;
                            if (writeCol >= mangledCols.length) continue;
                            if (writeRow >= mangledRows) continue;
                            const cellData = getMangledCellContent(index);
                            const newVal = pasteToCell(cellData, index, dataItem.rawValue, dataItem.formatted);
                            if (newVal !== undefined) {
                                editList.push(newVal);
                            }
                        }
                    }
                    // eslint-disable-next-line no-constant-condition
                } while (false);

                mangledOnCellsEdited(editList);

                gridRef.current?.damage(
                    editList.map(c => ({
                        cell: c.location,
                    }))
                );
            }
        },
        [
            coercePasteValue,
            getCellRenderer,
            getMangledCellContent,
            gridSelection,
            keybindings.paste,
            scrollRef,
            mangledCols.length,
            mangledOnCellsEdited,
            mangledRows,
            onPaste,
            rowMarkerOffset,
            rows,
        ]
    );

    useEventListener("paste", onPasteInternal, safeWindow, false, true);

    const copySelectionToClipboard = React.useCallback(
        async (selection: GridSelection, e?: ClipboardEvent, normalizeCurrentRange = true) => {
            const emptyCopyCell: GridCell = {
                kind: GridCellKind.Text,
                data: "",
                displayData: "",
                allowOverlay: false,
            };

            const copyToClipboardWithHeaders = (
                cells: readonly (readonly GridCell[])[],
                columnIndexes: readonly number[]
            ) => {
                if (!copyHeaders) {
                    copyToClipboard(cells, columnIndexes, e);
                } else {
                    const headers = columnIndexes.map(index => ({
                        kind: GridCellKind.Text,
                        data: columnsIn[index].title,
                        displayData: columnsIn[index].title,
                        allowOverlay: false,
                    })) as GridCell[];
                    copyToClipboard([headers, ...cells], columnIndexes, e);
                }
            };

            const getBoundsForRanges = (ranges: readonly Rectangle[]): Rectangle | undefined => {
                let left = Number.POSITIVE_INFINITY;
                let top = Number.POSITIVE_INFINITY;
                let right = Number.NEGATIVE_INFINITY;
                let bottom = Number.NEGATIVE_INFINITY;

                for (const selectionRange of ranges) {
                    if (selectionRange.width <= 0 || selectionRange.height <= 0) continue;
                    left = Math.min(left, selectionRange.x);
                    top = Math.min(top, selectionRange.y);
                    right = Math.max(right, selectionRange.x + selectionRange.width);
                    bottom = Math.max(bottom, selectionRange.y + selectionRange.height);
                }

                if (!Number.isFinite(left) || !Number.isFinite(top)) return undefined;

                return {
                    x: left,
                    y: top,
                    width: right - left,
                    height: bottom - top,
                };
            };

            const copyCurrentRangesToClipboard = async (
                current: NonNullable<GridSelection["current"]>,
                copyRanges: readonly Rectangle[],
                cellsForSelection: NonNullable<typeof getCellsForSelection>
            ) => {
                const bounds = getBoundsForRanges(copyRanges);
                if (bounds === undefined) return;

                const maskedCells: GridCell[][] = Array.from({ length: bounds.height }, () =>
                    Array.from({ length: bounds.width }, () => emptyCopyCell)
                );

                for (const selectionRange of copyRanges) {
                    let cells = cellsForSelection(selectionRange, abortControllerRef.current.signal);
                    if (typeof cells !== "object") {
                        cells = await cells();
                    }

                    for (let row = 0; row < selectionRange.height; row++) {
                        const targetRow = selectionRange.y - bounds.y + row;
                        if (targetRow < 0 || targetRow >= bounds.height) continue;

                        for (let col = 0; col < selectionRange.width; col++) {
                            const targetCol = selectionRange.x - bounds.x + col;
                            if (targetCol < 0 || targetCol >= bounds.width) continue;
                            maskedCells[targetRow][targetCol] = cells[row]?.[col] ?? emptyCopyCell;
                        }
                    }
                }

                if (onCopyOuter !== undefined && typeof onCopyOuter === "function") {
                    onCopyOuter(maskedCells, current.cell);
                } else {
                    copyToClipboardWithHeaders(
                        maskedCells,
                        makeRange(bounds.x - rowMarkerOffset, bounds.x + bounds.width - rowMarkerOffset)
                    );
                }
            };

            const copyCompactRangesToClipboard = async (
                current: NonNullable<GridSelection["current"]>,
                copyRanges: readonly Rectangle[],
                cellsForSelection: NonNullable<typeof getCellsForSelection>
            ) => {
                const rowsToCopy: GridCell[][] = [];
                let maxWidth = 0;

                for (const selectionRange of copyRanges) {
                    let cells = cellsForSelection(selectionRange, abortControllerRef.current.signal);
                    if (typeof cells !== "object") {
                        cells = await cells();
                    }

                    for (const row of cells) {
                        const rowCells = [...row];
                        rowsToCopy.push(rowCells);
                        maxWidth = Math.max(maxWidth, rowCells.length);
                    }
                }

                if (rowsToCopy.length === 0) return;

                const cells = rowsToCopy.map(row => {
                    if (row.length >= maxWidth) return row;
                    return [...row, ...Array.from({ length: maxWidth - row.length }, () => emptyCopyCell)];
                });
                if (onCopyOuter !== undefined && typeof onCopyOuter === "function") {
                    onCopyOuter(cells, current.cell);
                } else {
                    copyToClipboardWithHeaders(cells, makeRange(maxWidth));
                }
            };

            if (getCellsForSelection !== undefined) {
                if (selection.current !== undefined) {
                    const sourceRanges = [selection.current.range, ...selection.current.rangeStack];
                    const copyRanges = normalizeCurrentRange
                        ? getCopyRangesForCurrent(selection.current)
                        : sourceRanges;

                    if (
                        copyRanges.length === 1 &&
                        sourceRanges.length === 1 &&
                        isRectangleEqual(copyRanges[0], sourceRanges[0])
                    ) {
                        let thunk = getCellsForSelection(sourceRanges[0], abortControllerRef.current.signal);
                        if (typeof thunk !== "object") {
                            thunk = await thunk();
                        }

                        if (onCopyOuter !== undefined && typeof onCopyOuter === "function") {
                            onCopyOuter(thunk, selection.current.cell);
                        } else {
                            copyToClipboardWithHeaders(
                                thunk,
                                makeRange(
                                    sourceRanges[0].x - rowMarkerOffset,
                                    sourceRanges[0].x + sourceRanges[0].width - rowMarkerOffset
                                )
                            );
                        }
                    } else {
                        const bounds = getBoundsForRanges(copyRanges);
                        const selectedArea = copyRanges.reduce(
                            (sum, selectionRange) => sum + selectionRange.width * selectionRange.height,
                            0
                        );
                        const boundsArea = (bounds?.width ?? 0) * (bounds?.height ?? 0);
                        const canUseDenseCopy =
                            bounds !== undefined &&
                            (boundsArea <= maxDenseCopyCells ||
                                (boundsArea <= maxSparseDenseCopyCells &&
                                    boundsArea <= Math.max(selectedArea, 1) * maxDenseCopySparsity));

                        await (canUseDenseCopy
                            ? copyCurrentRangesToClipboard(selection.current, copyRanges, getCellsForSelection)
                            : copyCompactRangesToClipboard(selection.current, copyRanges, getCellsForSelection));
                    }
                } else if (selection.rows.length > 0) {
                    const toCopy = [...selection.rows];
                    const cells = toCopy.map(rowIndex => {
                        const thunk = getCellsForSelection(
                            {
                                x: rowMarkerOffset,
                                y: rowIndex,
                                width: columnsIn.length,
                                height: 1,
                            },
                            abortControllerRef.current.signal
                        );
                        if (typeof thunk === "object") {
                            return thunk[0];
                        }
                        return thunk().then(v => v[0]);
                    });
                    if (cells.some(x => x instanceof Promise)) {
                        const settled = await Promise.all(cells);
                        copyToClipboardWithHeaders(settled, makeRange(columnsIn.length));
                    } else {
                        copyToClipboardWithHeaders(cells as (readonly GridCell[])[], makeRange(columnsIn.length));
                    }
                } else if (selection.columns.length > 0) {
                    const results: (readonly (readonly GridCell[])[])[] = [];
                    const cols: number[] = [];
                    for (const col of selection.columns) {
                        let thunk = getCellsForSelection(
                            {
                                x: col,
                                y: 0,
                                width: 1,
                                height: rows,
                            },
                            abortControllerRef.current.signal
                        );
                        if (typeof thunk !== "object") {
                            thunk = await thunk();
                        }
                        results.push(thunk);
                        cols.push(col - rowMarkerOffset);
                    }
                    if (results.length === 1) {
                        copyToClipboardWithHeaders(results[0], cols);
                    } else {
                        // FIXME: this is dumb
                        const toCopy = results.reduce((pv, cv) => pv.map((row, index) => [...row, ...cv[index]]));
                        copyToClipboardWithHeaders(toCopy, cols);
                    }
                }
            }
        },
        [getCellsForSelection, getCopyRangesForCurrent, copyHeaders, columnsIn, onCopyOuter, rowMarkerOffset, rows]
    );

    // While this function is async, we deeply prefer not to await if we don't have to. This will lead to unpacking
    // promises in rather awkward ways when possible to avoid awaiting. We have to use fallback copy mechanisms when
    // an await has happened.
    const onCopy = React.useCallback(
        async (e?: ClipboardEvent, ignoreFocus?: boolean) => {
            if (!keybindings.copy) return;
            const focused =
                ignoreFocus === true ||
                scrollRef.current?.contains(document.activeElement) === true ||
                canvasRef.current?.contains(document.activeElement) === true;

            if (!focused) return;
            await copySelectionToClipboard(gridSelection, e);
        },
        [copySelectionToClipboard, gridSelection, keybindings.copy, scrollRef]
    );

    useEventListener("copy", onCopy, safeWindow, false, false);

    const onCut = React.useCallback(
        async (e?: ClipboardEvent) => {
            if (!keybindings.cut) return;
            const focused =
                scrollRef.current?.contains(document.activeElement) === true ||
                canvasRef.current?.contains(document.activeElement) === true;

            if (!focused) return;

            await copySelectionToClipboard(gridSelection, e);

            if (gridSelection.current === undefined) return;
            const normalizedCurrent = getNormalizedCurrentSelection(gridSelection.current);
            const defaultDeleteSelection: GridSelection = {
                current: {
                    cell: gridSelection.current.cell,
                    range: normalizedCurrent.range,
                    rangeStack: normalizedCurrent.rangeStack,
                },
                rows: CompactSelection.empty(),
                columns: CompactSelection.empty(),
            };
            const onDeleteResult = onDelete?.(defaultDeleteSelection);
            if (onDeleteResult === false) return;

            const useDefaultSelection =
                onDeleteResult === true || selectionMatches(onDeleteResult, defaultDeleteSelection);
            const effectiveSelection = useDefaultSelection
                ? {
                      ...defaultDeleteSelection,
                      current: getMutationCurrentSelection(gridSelection.current),
                  }
                : onDeleteResult;

            if (effectiveSelection.current === undefined) return;
            const deletedCells = new Set<string>();
            deleteRange(effectiveSelection.current.range, deletedCells);
            for (const selectionRange of effectiveSelection.current.rangeStack) {
                deleteRange(selectionRange, deletedCells);
            }
        },
        [
            copySelectionToClipboard,
            deleteRange,
            getMutationCurrentSelection,
            getNormalizedCurrentSelection,
            gridSelection,
            keybindings.cut,
            scrollRef,
            onDelete,
        ]
    );

    useEventListener("cut", onCut, safeWindow, false, false);

    const onSearchResultsChanged = React.useCallback(
        (results: readonly Item[], navIndex: number) => {
            if (onSearchResultsChangedIn !== undefined) {
                if (rowMarkerOffset !== 0) {
                    results = results.map(item => [item[0] - rowMarkerOffset, item[1]]);
                }
                onSearchResultsChangedIn(results, navIndex);
                return;
            }
            if (results.length === 0 || navIndex === -1) return;

            const [col, row] = results[navIndex];
            if (lastSent.current !== undefined && lastSent.current[0] === col && lastSent.current[1] === row) {
                return;
            }
            lastSent.current = [col, row];
            updateSelectedCell(col, row, false, false);
        },
        [onSearchResultsChangedIn, rowMarkerOffset, updateSelectedCell]
    );

    // this effects purpose in life is to scroll the newly selected cell into view when and ONLY when that cell
    // is from an external gridSelection change. Also note we want the unmangled out selection because scrollTo
    // expects unmangled indexes
    const [outCol, outRow] = gridSelectionOuter?.current?.cell ?? [];
    const scrollToRef = React.useRef(scrollTo);
    scrollToRef.current = scrollTo;
    React.useLayoutEffect(() => {
        if (
            scrollToActiveCellRef.current &&
            !hasJustScrolled.current &&
            outCol !== undefined &&
            outRow !== undefined &&
            (outCol !== expectedExternalGridSelection.current?.current?.cell[0] ||
                outRow !== expectedExternalGridSelection.current?.current?.cell[1])
        ) {
            scrollToRef.current(outCol, outRow);
        }
        hasJustScrolled.current = false; //only allow skipping a single scroll
    }, [outCol, outRow]);

    const selectionOutOfBounds =
        gridSelection.current !== undefined &&
        (gridSelection.current.cell[0] >= mangledCols.length || gridSelection.current.cell[1] >= mangledRows);
    React.useLayoutEffect(() => {
        if (selectionOutOfBounds) {
            setGridSelection(emptyGridSelection, false);
        }
    }, [selectionOutOfBounds, setGridSelection]);

    const disabledRows = React.useMemo(() => {
        if (showTrailingBlankRow === true && trailingRowOptions?.tint === true) {
            return CompactSelection.fromSingleSelection(mangledRows - 1);
        }
        return CompactSelection.empty();
    }, [mangledRows, showTrailingBlankRow, trailingRowOptions?.tint]);

    const mangledVerticalBorder = React.useCallback(
        (col: number) => {
            return typeof verticalBorder === "boolean"
                ? verticalBorder
                : (verticalBorder?.(col - rowMarkerOffset) ?? true);
        },
        [rowMarkerOffset, verticalBorder]
    );

    /** @type {*}
     * 默认没有水平线
     */
    const mangledHorizontalBorder = React.useCallback(
        (col: number, row: number) => {
            let fallbackCell: InnerGridCell | undefined;
            const baseResult = (() => {
                if (typeof horizontalBorder === "boolean") {
                    return horizontalBorder;
                }

                const customResult = horizontalBorder?.(col, row);
                if (customResult !== undefined) {
                    return customResult;
                }

                if (col - rowMarkerOffset < 0) {
                    return false;
                }

                try {
                    fallbackCell = getMangledCellContent([col, row]);
                    return fallbackCell.readonly === false;
                } catch {
                    return false;
                }
            })();

            if (!baseResult || rowSpanBorderBehavior !== "collapse-inner" || row < 0) {
                return baseResult;
            }

            try {
                // collapse-inner 模式下，合并块内部横线全部折叠掉，
                // 只有落在合并块最后一行时才保留底边，视觉上才能形成一个完整的大单元格
                const cell = fallbackCell ?? getMangledCellContent([col, row]);
                const rowSpan = cell.rowSpan ?? 1;
                const rowSpanOffset = cell.rowSpanOffset ?? 0;
                return rowSpan <= 1 || rowSpanOffset === rowSpan - 1;
            } catch {
                return baseResult;
            }
        },
        [horizontalBorder, rowMarkerOffset, rowSpanBorderBehavior, getMangledCellContent]
    );

    const renameGroupNode = React.useMemo(() => {
        if (renameGroup === undefined || canvasRef.current === null) return null;
        const { bounds, group } = renameGroup;
        const canvasBounds = canvasRef.current.getBoundingClientRect();
        return (
            <GroupRename
                bounds={bounds}
                group={group}
                canvasBounds={canvasBounds}
                onClose={() => setRenameGroup(undefined)}
                onFinish={newVal => {
                    setRenameGroup(undefined);
                    onGroupHeaderRenamed?.(group, newVal);
                }}
            />
        );
    }, [onGroupHeaderRenamed, renameGroup]);

    const mangledFreezeColumns = Math.min(mangledCols.length, freezeColumns + (hasRowMarkers ? 1 : 0));

    React.useImperativeHandle(
        forwardedRef,
        () => ({
            appendRow: (col: number, openOverlay?: boolean) => appendRow(col + rowMarkerOffset, openOverlay),
            appendColumn: (row: number, openOverlay?: boolean) => appendColumn(row, openOverlay),
            updateCells: damageList => {
                if (rowMarkerOffset !== 0) {
                    damageList = damageList.map(x => ({ cell: [x.cell[0] + rowMarkerOffset, x.cell[1]] }));
                }
                return gridRef.current?.damage(damageList);
            },
            getBounds: (col, row) => {
                if (canvasRef?.current === null || scrollRef?.current === null) {
                    return undefined;
                }

                if (col === undefined && row === undefined) {
                    // Return the bounds of the entire scroll area:
                    const rect = canvasRef.current.getBoundingClientRect();
                    const scale = rect.width / scrollRef.current.clientWidth;
                    return {
                        x: rect.x - scrollRef.current.scrollLeft * scale,
                        y: rect.y - scrollRef.current.scrollTop * scale,
                        width: scrollRef.current.scrollWidth * scale,
                        height: scrollRef.current.scrollHeight * scale,
                    };
                }
                return gridRef.current?.getBounds((col ?? 0) + rowMarkerOffset, row);
            },
            focus: () => gridRef.current?.focus(),
            emit: async e => {
                switch (e) {
                    case "delete":
                        onKeyDown({
                            bounds: undefined,
                            cancel: () => undefined,
                            stopPropagation: () => undefined,
                            preventDefault: () => undefined,
                            ctrlKey: false,
                            key: "Delete",
                            keyCode: 46,
                            metaKey: false,
                            shiftKey: false,
                            altKey: false,
                            rawEvent: undefined,
                            location: undefined,
                        });
                        break;
                    case "fill-right":
                        onKeyDown({
                            bounds: undefined,
                            cancel: () => undefined,
                            stopPropagation: () => undefined,
                            preventDefault: () => undefined,
                            ctrlKey: true,
                            key: "r",
                            keyCode: 82,
                            metaKey: false,
                            shiftKey: false,
                            altKey: false,
                            rawEvent: undefined,
                            location: undefined,
                        });
                        break;
                    case "fill-down":
                        onKeyDown({
                            bounds: undefined,
                            cancel: () => undefined,
                            stopPropagation: () => undefined,
                            preventDefault: () => undefined,
                            ctrlKey: true,
                            key: "d",
                            keyCode: 68,
                            metaKey: false,
                            shiftKey: false,
                            altKey: false,
                            rawEvent: undefined,
                            location: undefined,
                        });
                        break;
                    case "copy":
                        await onCopy(undefined, true);
                        break;
                    case "paste":
                        await onPasteInternal();
                        break;
                }
            },
            scrollTo,
            getScrollClientHeight: () => {
                return scrollRef.current?.clientHeight;
            },
            remeasureColumns: cols => {
                for (const col of cols) {
                    void normalSizeColumn(col + rowMarkerOffset);
                }
            },
            getMouseArgsForPosition: (
                posX: number,
                posY: number,
                ev?: MouseEvent | TouchEvent
            ): GridMouseEventArgs | undefined => {
                if (gridRef?.current === null) {
                    return undefined;
                }

                const args = gridRef.current.getMouseArgsForPosition(posX, posY, ev);
                if (args === undefined) {
                    return undefined;
                }

                return {
                    ...args,
                    location: [args.location[0] - rowMarkerOffset, args.location[1]] as any,
                };
            },
            getCanvasRect: () => {
                return canvasRef.current?.getBoundingClientRect();
            },
            closeEditor: () => {
                // 退出编辑态
                setOverlay(undefined);
            },
            focusCell: (col: number, row: number) => {
                const mangledCol = col + rowMarkerOffset;
                setCurrent(
                    {
                        cell: [mangledCol, row],
                        range: { x: mangledCol, y: row, width: 1, height: 1 },
                    },
                    false,
                    false,
                    "edit"
                );
                window.setTimeout(() => {
                    focusCellForEdit(mangledCol, row);
                }, 0);
            },
        }),
        [
            appendRow,
            appendColumn,
            normalSizeColumn,
            scrollRef,
            onCopy,
            onKeyDown,
            onPasteInternal,
            rowMarkerOffset,
            scrollTo,
            setCurrent,
            focusCellForEdit,
        ]
    );

    const [selCol, selRow] = currentCell ?? [];
    const onCellFocused = React.useCallback(
        (cell: Item) => {
            const [col, row] = cell;

            if (row === -1) {
                if (columnSelect !== "none") {
                    setSelectedColumns(CompactSelection.fromSingleSelection(col), undefined, false);
                    focus();
                }
                return;
            }

            if (selCol === col && selRow === row) return;
            setCurrent(
                {
                    cell,
                    range: { x: col, y: row, width: 1, height: 1 },
                },
                true,
                false,
                "keyboard-nav"
            );
            scrollTo(col, row);
        },
        [columnSelect, focus, scrollTo, selCol, selRow, setCurrent, setSelectedColumns]
    );

    const [isFocused, setIsFocused] = React.useState(false);
    const setIsFocusedDebounced = React.useRef(
        debounce((val: boolean) => {
            setIsFocused(val);
        }, 5)
    );

    const onCanvasFocused = React.useCallback(() => {
        setIsFocusedDebounced.current(true);

        // check for mouse state, don't do anything if the user is clicked to focus.
        if (
            gridSelection.current === undefined &&
            gridSelection.columns.length === 0 &&
            gridSelection.rows.length === 0 &&
            mouseState === undefined
        ) {
            setCurrent(
                {
                    cell: [rowMarkerOffset, cellYOffset],
                    range: {
                        x: rowMarkerOffset,
                        y: cellYOffset,
                        width: 1,
                        height: 1,
                    },
                },
                true,
                false,
                "keyboard-select"
            );
        }
    }, [cellYOffset, gridSelection, mouseState, rowMarkerOffset, setCurrent]);

    const onFocusOut = React.useCallback(() => {
        setIsFocusedDebounced.current(false);
    }, []);

    const [idealWidth, idealHeight] = React.useMemo(() => {
        let h: number;
        const scrollbarWidth = experimental?.scrollbarWidthOverride ?? getScrollBarWidth();
        const rowsCountWithTrailingRow = rows + (showTrailingBlankRow ? 1 : 0);
        if (typeof rowHeight === "number") {
            h = totalHeaderHeight + rowsCountWithTrailingRow * rowHeight;
        } else {
            let avg = 0;
            const toAverage = Math.min(rowsCountWithTrailingRow, 10);
            for (let i = 0; i < toAverage; i++) {
                avg += rowHeight(i);
            }
            avg = Math.floor(avg / toAverage);

            h = totalHeaderHeight + rowsCountWithTrailingRow * avg;
        }
        h += scrollbarWidth;

        const w = mangledCols.reduce((acc, x) => x.width + acc, 0) + scrollbarWidth;

        // We need to set a reasonable cap here as some browsers will just ignore huge values
        // rather than treat them as huge values.
        return [`${Math.min(100_000, w)}px`, `${Math.min(100_000, h)}px`];
    }, [mangledCols, experimental?.scrollbarWidthOverride, rowHeight, rows, showTrailingBlankRow, totalHeaderHeight]);

    const cssStyle = React.useMemo(() => {
        return makeCSSStyle(mergedTheme);
    }, [mergedTheme]);

    return (
        <ThemeContext.Provider value={mergedTheme}>
            <DataEditorContainer
                style={cssStyle}
                className={className}
                inWidth={width ?? idealWidth}
                inHeight={height ?? idealHeight}>
                <DataGridSearch
                    showFilter={showFilter}
                    filterHeight={filterHeight}
                    hasRowMarkers={hasRowMarkers}
                    rowMarkerGroup={rowMarkerGroup}
                    fillHandle={fillHandle}
                    drawFocusRing={drawFocusRing}
                    experimental={experimental}
                    fixedShadowX={fixedShadowX}
                    fixedShadowY={fixedShadowY}
                    getRowThemeOverride={getRowThemeOverride}
                    headerIcons={headerIcons}
                    imageWindowLoader={imageWindowLoader}
                    initialSize={initialSize}
                    isDraggable={isDraggable}
                    onDragLeave={onDragLeave}
                    onRowMoved={onRowMoved}
                    overscrollX={overscrollX}
                    overscrollY={overscrollY}
                    preventDiagonalScrolling={preventDiagonalScrolling}
                    rightElement={rightElement}
                    rightElementProps={rightElementProps}
                    smoothScrollX={smoothScrollX}
                    smoothScrollY={smoothScrollY}
                    className={className}
                    enableGroups={enableGroups}
                    onCanvasFocused={onCanvasFocused}
                    onCanvasBlur={onFocusOut}
                    canvasRef={canvasRef}
                    onContextMenu={onContextMenu}
                    theme={mergedTheme}
                    cellXOffset={cellXOffset}
                    cellYOffset={cellYOffset}
                    accessibilityHeight={visibleRegion.height}
                    onDragEnd={onDragEnd}
                    columns={mangledCols}
                    nonGrowWidth={nonGrowWidth}
                    drawHeader={drawHeader}
                    onColumnProposeMove={onColumnProposeMoveImpl}
                    drawCell={drawCell}
                    disabledRows={disabledRows}
                    freezeColumns={mangledFreezeColumns}
                    lockColumns={rowMarkerOffset}
                    firstColAccessible={rowMarkerOffset === 0}
                    getCellContent={getMangledCellContent}
                    minColumnWidth={minColumnWidth}
                    maxColumnWidth={maxColumnWidth}
                    searchInputRef={searchInputRef}
                    showSearch={showSearch}
                    onSearchClose={onSearchClose}
                    highlightRegions={highlightRegions}
                    getCellsForSelection={getCellsForSelection}
                    getGroupDetails={mangledGetGroupDetails}
                    headerHeight={headerHeight}
                    isFocused={isFocused}
                    groupHeaderHeight={enableGroups ? groupHeaderHeight : 0}
                    freezeTrailingRows={
                        freezeTrailingRows + (showTrailingBlankRow && trailingRowOptions?.sticky === true ? 1 : 0)
                    }
                    hasAppendRow={showTrailingBlankRow}
                    onColumnResize={onColumnResize}
                    onColumnResizeEnd={onColumnResizeEnd}
                    onColumnResizeStart={onColumnResizeStart}
                    onCellFocused={onCellFocused}
                    onColumnMoved={onColumnMovedImpl}
                    onDragStart={onDragStartImpl}
                    onHeaderMenuClick={onHeaderMenuClickInner}
                    onHeaderIndicatorClick={onHeaderIndicatorClickInner}
                    onFilterClearClick={onFilterClearClickInner}
                    onItemHovered={onItemHoveredImpl}
                    isFilling={mouseState?.fillHandle === true}
                    onMouseMove={onMouseMoveImpl}
                    onKeyDown={onKeyDown}
                    onKeyUp={onKeyUpIn}
                    onMouseDown={onMouseDown}
                    onMouseUp={onMouseUp}
                    onDragOverCell={onDragOverCell}
                    onDrop={onDrop}
                    onSearchResultsChanged={onSearchResultsChanged}
                    onVisibleRegionChanged={onVisibleRegionChangedImpl}
                    clientSize={clientSize}
                    rowHeight={rowHeight}
                    searchResults={searchResults}
                    searchValue={searchValue}
                    onSearchValueChange={onSearchValueChange}
                    rows={mangledRows}
                    scrollRef={scrollRef}
                    selection={gridSelection}
                    translateX={visibleRegion.tx}
                    translateY={visibleRegion.ty}
                    verticalBorder={mangledVerticalBorder}
                    horizontalBorder={mangledHorizontalBorder}
                    gridRef={gridRef}
                    getCellRenderer={getCellRenderer}
                    resizeIndicator={resizeIndicator}
                    setScrollDir={setScrollDir}
                    getFilterCellContent={getMangledFilterCellContentForGrid}
                    getRowMarkerFilterCellContent={getRowMarkerFilterCellContentForGrid}
                />
                {renameGroupNode}
                {overlay !== undefined && (
                    <React.Suspense fallback={null}>
                        <DataGridOverlayEditor
                            {...overlay}
                            validateCell={validateCell}
                            bloom={editorBloom}
                            id={overlayID}
                            getCellRenderer={getCellRenderer}
                            className={experimental?.isSubGrid === true ? "click-outside-ignore" : undefined}
                            provideEditor={provideEditor}
                            imageEditorOverride={imageEditorOverride}
                            portalElementRef={portalElementRef}
                            onFinishEditing={onFinishEditing}
                            markdownDivCreateNode={markdownDivCreateNode}
                            isOutsideClick={isOutsideClick}
                            customEventTarget={experimental?.eventTarget}
                            onEditing={onEditingIn}
                            gridSelection={gridSelection}
                            // visibleRegion={visibleRegion}
                            // gridRef={gridRef}
                            // rowHeight={rowHeight}
                            // headerHeight={totalHeaderHeight + filterHeight}
                            // canvasBounds={canvasRef.current.getBoundingClientRect()}
                            // column={mangledCols[overlay.cell[0]]}
                            // leftSiblingsWidth={mangledCols.reduce((prev, next, idx) => {
                            //     if (idx < freezeColumns + (hasRowMarkers ? 1 : 0)) {
                            //         prev += next.width;
                            //     }

                            //     return prev;
                            // }, 0)}
                            // minCol={hasRowMarkers ? 1 : 0}
                            // maxCol={hasRowMarkers ? columns.length : columns.length - 1}
                        />
                    </React.Suspense>
                )}
            </DataEditorContainer>
        </ThemeContext.Provider>
    );
};

/**
 * The primary component of Glide Data Grid.
 * @category DataEditor
 * @param {DataEditorProps} props
 */
export const DataEditor = React.forwardRef(DataEditorImpl);
