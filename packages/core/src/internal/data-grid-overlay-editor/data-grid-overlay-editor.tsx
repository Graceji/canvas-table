import * as React from "react";
import { createPortal } from "react-dom";
import ClickOutsideContainer from "../click-outside-container/click-outside-container.js";
import { makeCSSStyle, type Theme, ThemeContext } from "../../common/styles.js";
import type { GetCellRendererCallback } from "../../cells/cell-types.js";
import {
    type EditableGridCell,
    type GridCell,
    isEditableGridCell,
    isInnerOnlyCell,
    isObjectEditorCallbackResult,
    type Item,
    type ProvideEditorCallback,
    type ProvideEditorCallbackResult,
    type Rectangle,
    type ValidatedGridCell,
    type GridSelection,
} from "../data-grid/data-grid-types.js";

import type { CellActivatedEventArgs } from "../data-grid/event-args.js";
import { DataGridOverlayEditorStyle } from "./data-grid-overlay-editor-style.js";
import type { OverlayImageEditorProps } from "./private/image-overlay-editor.js";
import { useStayOnScreen } from "./use-stay-on-screen.js";

type ImageEditorType = React.ComponentType<OverlayImageEditorProps>;

interface DataGridOverlayEditorProps {
    readonly target: Rectangle;
    readonly cell: Item;
    readonly content: GridCell;
    readonly className?: string;
    readonly id: string;
    readonly initialValue?: string;
    readonly bloom?: readonly [number, number];
    readonly theme: Theme;
    readonly onFinishEditing: (
        newCell: GridCell | undefined,
        movement: readonly [-1 | 0 | 1, -1 | 0 | 1 | -3],
        eventKey?: string
    ) => void;
    readonly onEditing: (newCell: GridCell | undefined) => void;
    readonly forceEditMode: boolean;
    readonly highlight: boolean;
    readonly portalElementRef?: React.RefObject<HTMLElement>;
    readonly imageEditorOverride?: ImageEditorType;
    readonly getCellRenderer: GetCellRendererCallback;
    readonly markdownDivCreateNode?: (content: string) => DocumentFragment;
    readonly provideEditor?: ProvideEditorCallback<GridCell>;
    readonly activation: CellActivatedEventArgs;
    readonly validateCell?: (
        cell: Item,
        newValue: EditableGridCell,
        prevValue: GridCell
    ) => boolean | ValidatedGridCell;
    readonly isOutsideClick?: (e: MouseEvent | TouchEvent) => boolean;
    readonly customEventTarget?: HTMLElement | Window | Document;
    readonly gridSelection?: GridSelection;
    // readonly visibleRegion: VisibleRegion;
    // readonly minCol: number;
    // readonly maxCol: number;
}

const DataGridOverlayEditor: React.FunctionComponent<DataGridOverlayEditorProps> = p => {
    const {
        target,
        content,
        onFinishEditing: onFinishEditingIn,
        onEditing: onEditingIn,
        forceEditMode,
        initialValue,
        imageEditorOverride,
        markdownDivCreateNode,
        highlight,
        className,
        theme,
        id,
        cell,
        bloom,
        portalElementRef,
        validateCell,
        getCellRenderer,
        provideEditor,
        isOutsideClick,
        customEventTarget,
        activation,
        gridSelection,
        // visibleRegion,
        // gridRef,
        // canvasBounds,
        // headerHeight,
        // rowHeight,
        // column,
        // leftSiblingsWidth,
        // minCol,
        // maxCol,
    } = p;

    const [tempValue, setTempValueRaw] = React.useState<GridCell | undefined>(forceEditMode ? content : undefined);
    const lastValueRef = React.useRef(tempValue ?? content);
    lastValueRef.current = tempValue ?? content;

    const [isValid, setIsValid] = React.useState(() => {
        if (validateCell === undefined) return true;
        return !(isEditableGridCell(content) && validateCell?.(cell, content, lastValueRef.current) === false);
    });

    const onFinishEditing = React.useCallback<typeof onFinishEditingIn>(
        (newCell, movement, eventKey) => {
            onFinishEditingIn(isValid ? newCell : undefined, movement, eventKey);
        },
        [isValid, onFinishEditingIn]
    );

    const setTempValue = React.useCallback(
        (newVal: GridCell | undefined) => {
            if (validateCell !== undefined && newVal !== undefined && isEditableGridCell(newVal)) {
                const validResult = validateCell(cell, newVal, lastValueRef.current);
                if (validResult === false) {
                    setIsValid(false);
                } else if (typeof validResult === "object") {
                    newVal = validResult;
                    setIsValid(true);
                } else {
                    setIsValid(true);
                }
            }
            setTempValueRaw(newVal);
            onEditingIn(newVal);
        },
        [cell, validateCell, onEditingIn]
    );

    const finished = React.useRef(false);
    const customMotion = React.useRef<[-1 | 0 | 1, -1 | 0 | 1 | -3] | undefined>(undefined);

    const onClickOutside = React.useCallback(() => {
        onFinishEditing(tempValue, [0, 0]);
        finished.current = true;
    }, [tempValue, onFinishEditing]);

    const onEditorFinished = React.useCallback(
        (newValue: GridCell | undefined, movement?: readonly [-1 | 0 | 1, -1 | 0 | 1], eventKey?: string) => {
            onFinishEditing(newValue, movement ?? customMotion.current ?? [0, 0], eventKey);
            finished.current = true;
        },
        [onFinishEditing]
    );

    const targetValue = tempValue ?? content;

    const [editorProvider, useLabel] = React.useMemo((): [ProvideEditorCallbackResult<GridCell>, boolean] | [] => {
        if (isInnerOnlyCell(content)) return [];
        const cellWithLocation = { ...content, location: cell, activation } as GridCell & {
            location: Item;
            activation: CellActivatedEventArgs;
        };
        const external = provideEditor?.(cellWithLocation);
        if (external !== undefined) return [external, false];
        return [getCellRenderer(content)?.provideEditor?.(cellWithLocation), false];
    }, [cell, content, getCellRenderer, provideEditor, activation]);

    /** @type {*}
        选中行功能

        左右选择 不更新选中行

        上下选择 在可视行范围内上下选中行，边界条件与上方功能结合

        遇到合计行行为,选中单元格
     */
    const onKeyDown = React.useCallback(
        async (event: React.KeyboardEvent) => {
            let save = false;
            if (event.key === "Escape") {
                event.stopPropagation();
                event.preventDefault();
                customMotion.current = [0, 0];
            } else if (
                event.key === "Enter" &&
                // The shift key is reserved for multi-line editing
                // to allow inserting new lines without closing the editor.
                !event.shiftKey
            ) {
                event.stopPropagation();
                event.preventDefault();
                customMotion.current = [0, 1];
                save = true;
            } else if (event.key === "Tab") {
                event.stopPropagation();
                event.preventDefault();
                customMotion.current = [event.shiftKey ? -1 : 1, 0];
                save = true;
            } else {
                switch (event.key) {
                    // case "ArrowRight":
                    // case "ArrowLeft": {
                    //     event.stopPropagation();
                    //     event.preventDefault();
                    //     save = true;

                    //     if (editorProvider?.preventArrow === "horizontal") {
                    //         break;
                    //     }

                    //     if (
                    //         gridSelection !== undefined &&
                    //         gridSelection.current !== undefined &&
                    //         gridSelection.current.cell?.[1] === -3 &&
                    //         ((event.key === "ArrowRight" && gridSelection.current.cell[0] === maxCol) ||
                    //             (event.key === "ArrowLeft" && gridSelection.current.cell[0] === minCol))
                    //     ) {
                    //         // 涉及过滤行的单元格选择逻辑
                    //         // 左右选择
                    //         // 有索引列 最小1 没有索引列 最小0
                    //         // 有索引列 最大len 没有索引列 最大len -1
                    //         break;
                    //     }

                    //     customMotion.current = [event.key === "ArrowRight" ? 1 : -1, 0];

                    //     break;
                    // }
                    case "ArrowUp":
                    case "ArrowDown": {
                        event.stopPropagation();
                        event.preventDefault();
                        save = true;

                        if (editorProvider?.preventArrow === "vertical") {
                            break;
                        }

                        if (
                            gridSelection !== undefined &&
                            gridSelection.current !== undefined &&
                            gridSelection.current.cell?.[1] === -3
                        ) {
                            // 上下选择: 当前为过滤行，往上没有反应; 往下选中正下方单元格
                            if (event.key === "ArrowDown") {
                                customMotion.current = [0, 1];
                            }

                            break;
                        }

                        if (
                            gridSelection !== undefined &&
                            gridSelection.current !== undefined &&
                            gridSelection.current.cell?.[1] === 0 &&
                            event.key === "ArrowUp"
                        ) {
                            // 当前为第一行: 往上 进入正上方过滤行单元格编辑态; 往下 选中正下方单元格
                            customMotion.current = [0, -3];
                            break;
                        }

                        customMotion.current = [0, event.key === "ArrowDown" ? 1 : -1];
                        break;
                    }
                    default:
                        break;
                }
            }

            window.setTimeout(() => {
                if (!finished.current && customMotion.current !== undefined) {
                    // 这里将tempValue改成了lastValueRef.current， 是为了需求：批量编辑框enter不输入时清空。
                    // 在input cell中的onPressEnter调用onChange方法，先更新了tempValue, 但是这里拿不到更新后的值，导致外面不会调用onCellEdited
                    onFinishEditing(save ? lastValueRef.current : undefined, customMotion.current, event.key);
                    finished.current = true;
                }
            }, 0);
        },
        [gridSelection, onFinishEditing, editorProvider]
    );

    const { ref, style: stayOnScreenStyle } = useStayOnScreen();

    let pad = true;
    let editor: React.ReactNode;
    let style = true;
    let styleOverride: React.CSSProperties | undefined;

    if (editorProvider !== undefined) {
        pad = editorProvider.disablePadding !== true;
        style = editorProvider.disableStyling !== true;
        const isObjectEditor = isObjectEditorCallbackResult(editorProvider);
        if (isObjectEditor) {
            styleOverride = editorProvider.styleOverride;
        }
        const CustomEditor = isObjectEditor ? editorProvider.editor : editorProvider;
        editor = (
            <CustomEditor
                portalElementRef={portalElementRef}
                isHighlighted={highlight}
                activation={activation}
                onChange={setTempValue}
                value={targetValue}
                initialValue={initialValue}
                onFinishedEditing={onEditorFinished}
                validatedSelection={isEditableGridCell(targetValue) ? targetValue.selectionRange : undefined}
                forceEditMode={forceEditMode}
                target={target}
                imageEditorOverride={imageEditorOverride}
                markdownDivCreateNode={markdownDivCreateNode}
                isValid={isValid}
                theme={theme}
            />
        );
    }

    styleOverride = { ...styleOverride, ...stayOnScreenStyle };

    // Consider imperatively creating and adding the element to the dom?
    const portalElement = portalElementRef?.current ?? document.getElementById("portal");
    if (portalElement === null) {
        // eslint-disable-next-line no-console
        console.error(
            'Cannot open Data Grid overlay editor, because portal not found. Please, either provide a portalElementRef or add `<div id="portal" />` as the last child of your `<body>`.'
        );
        return null;
    }

    let classWrap = style ? "gdg-style" : "gdg-unstyle";
    if (!isValid) {
        classWrap += " gdg-invalid";
    }

    if (pad) {
        classWrap += " gdg-pad";
    }

    const bloomX = bloom?.[0] ?? 1;
    const bloomY = bloom?.[1] ?? 1;

    return createPortal(
        <ThemeContext.Provider value={theme}>
            <ClickOutsideContainer
                style={makeCSSStyle(theme)}
                className={className}
                onClickOutside={onClickOutside}
                isOutsideClick={isOutsideClick}
                customEventTarget={customEventTarget}>
                <DataGridOverlayEditorStyle
                    ref={ref}
                    id={id}
                    className={classWrap}
                    style={styleOverride}
                    as={useLabel === true ? "label" : undefined}
                    targetX={target.x + (cell?.[1] < 0 ? 0 : 1.5) - bloomX}
                    targetY={target.y + (cell?.[1] < 0 ? 0 : 1.5) - bloomY}
                    targetWidth={target.width - (cell?.[1] < 0 ? 0 : 3) + bloomX * 2}
                    targetHeight={target.height - (cell?.[1] < 0 ? 0 : 3) + bloomY * 2}>
                    <div className="gdg-clip-region" onKeyDown={onKeyDown}>
                        {editor}
                    </div>
                </DataGridOverlayEditorStyle>
            </ClickOutsideContainer>
        </ThemeContext.Provider>,
        portalElement
    );
};

export default DataGridOverlayEditor;
