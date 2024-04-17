import type { GetCellRendererCallback, PrepResult } from "../../../cells/cell-types.js";
import { intersectRect, pointInRect } from "../../../common/math.js";
import type { RenderStateProvider } from "../../../common/render-state-provider.js";
import { mergeAndRealizeTheme, type FullTheme } from "../../../common/styles.js";
import { direction } from "../../../common/utils.js";
import type { HoverValues } from "../animation-manager.js";
import type { CellSet } from "../cell-set.js";
import { withAlpha } from "../color-parser.js";
import type { SpriteManager, SpriteVariant } from "../data-grid-sprites.js";
import {
    type DrawHeaderCallback,
    type Rectangle,
    GridColumnMenuIcon,
    type GridSelection,
    type DrawCellCallback,
    type InnerGridCell,
    type Item,
    GridCellKind,
} from "../data-grid-types.js";
import type { ImageWindowLoader } from "../image-window-loader-interface.js";
import {
    drawMenuDots,
    getMiddleCenterBias,
    roundedPoly,
    type MappedGridColumn,
    measureTextCached,
    getMeasuredTextCache,
} from "./data-grid-lib.js";
import { drawCell, loadingCell, type GroupDetails, type GroupDetailsCallback } from "./data-grid-render.cells.js";
import { walkColumns, walkGroups } from "./data-grid-render.walk.js";
import { drawCheckbox } from "./draw-checkbox.js";
import type { DragAndDropState, HoverInfo } from "./draw-grid-arg.js";

export function drawGridHeaders(
    ctx: CanvasRenderingContext2D,
    effectiveCols: readonly MappedGridColumn[],
    allColumns: readonly MappedGridColumn[],
    enableGroups: boolean,
    hovered: HoverInfo | undefined,
    width: number,
    translateX: number,
    headerHeight: number,
    groupHeaderHeight: number,
    filterHeight: number,
    dragAndDropState: DragAndDropState | undefined,
    isResizing: boolean,
    selection: GridSelection,
    outerTheme: FullTheme,
    spriteManager: SpriteManager,
    hoverValues: HoverValues,
    verticalBorder: (col: number) => boolean,
    getGroupDetails: GroupDetailsCallback,
    damage: CellSet | undefined,
    drawHeaderCallback: DrawHeaderCallback | undefined,
    touchMode: boolean,
    drawCellCallback: DrawCellCallback | undefined,
    imageLoader: ImageWindowLoader,
    hyperWrapping: boolean,
    enqueue: (item: Item) => void,
    renderStateProvider: RenderStateProvider,
    overrideCursor: (cursor: React.CSSProperties["cursor"]) => void,
    getFilterCellRenderer: GetCellRendererCallback,
    getFilterCellContent: (cell: number) => InnerGridCell,
    showFilter: boolean,
    hasRowMarkers?: boolean,
    rowMarkerWidth?: number,
    showAccent?: boolean
) {
    const totalHeaderHeight = headerHeight + groupHeaderHeight;
    if (totalHeaderHeight <= 0) return;

    ctx.fillStyle = outerTheme.bgHeader;
    ctx.fillRect(0, 0, width, totalHeaderHeight);

    if (showFilter === true && filterHeight > 0) {
        ctx.fillStyle = outerTheme.filterHeaderBg ?? outerTheme.bgHeader;
        ctx.fillRect(hasRowMarkers === true ? rowMarkerWidth ?? 0 : 0, totalHeaderHeight, width, filterHeight);
    }

    const frameTime = performance.now();
    const hCol = hovered?.[0]?.[0];
    const hRow = hovered?.[0]?.[1];
    const hPosX = hovered?.[1]?.[0];
    const hPosY = hovered?.[1]?.[1];

    const font = outerTheme.headerFontFull;
    // Assinging the context font too much can be expensive, it can be worth it to minimze this
    ctx.font = font;

    walkColumns(effectiveCols, 0, translateX, 0, totalHeaderHeight, (c, x, _y, clipX) => {
        if (damage !== undefined && !(damage.has([c.sourceIndex, -1]) || damage.has([c.sourceIndex, -3]))) return;
        const diff = Math.max(0, clipX - x);
        ctx.save();
        ctx.beginPath();

        if (c.group === undefined) {
            ctx.rect(x + diff, 0, c.width - diff, totalHeaderHeight);
        } else {
            ctx.rect(x + diff, groupHeaderHeight, c.width - diff, headerHeight + filterHeight);
        }
        ctx.clip();

        const groupTheme = getGroupDetails(c.group ?? "").overrideTheme;
        const theme =
            c.themeOverride === undefined && groupTheme === undefined
                ? outerTheme
                : mergeAndRealizeTheme(outerTheme, groupTheme, c.themeOverride);

        if (theme.bgHeader !== outerTheme.bgHeader) {
            ctx.fillStyle = theme.bgHeader;
            ctx.fill();
        }

        if (theme !== outerTheme) {
            ctx.font = theme.baseFontFull;
        }
        const selected = selection.columns.hasIndex(c.sourceIndex);
        const noHover = dragAndDropState !== undefined || isResizing;
        const hoveredBoolean = !noHover && hRow === -1 && hCol === c.sourceIndex;

        const filterHoveredBoolean = !noHover && hRow === -3 && hCol === c.sourceIndex;

        const hover = noHover
            ? 0
            : hoverValues.find(s => s.item[0] === c.sourceIndex && s.item[1] === -1)?.hoverAmount ?? 0;

        const hasSelectedCell = selection?.current !== undefined && selection.current.cell[0] === c.sourceIndex;

        const bgFillStyle = selected ? theme.accentColor : hasSelectedCell ? theme.bgHeaderHasFocus : theme.bgHeader;

        const y = enableGroups ? groupHeaderHeight : 0;
        const xOffset = c.sourceIndex === 0 ? 0 : 1;

        if (selected && showAccent === true) {
            ctx.fillStyle = bgFillStyle;
            if (c.group === undefined) {
                ctx.rect(x + xOffset, 0, c.width - xOffset, totalHeaderHeight);
            } else {
                ctx.rect(x + xOffset, y, c.width - xOffset, headerHeight);
            }
        } else if (hasSelectedCell || hover > 0) {
            ctx.beginPath();
            if (c.group === undefined) {
                ctx.rect(x + xOffset, 0, c.width - xOffset, totalHeaderHeight);
            } else {
                ctx.rect(x + xOffset, y, c.width - xOffset, headerHeight);
            }
            if (hasSelectedCell) {
                ctx.fillStyle = theme.bgHeaderHasFocus;
                ctx.fill();
            }
            if (hover > 0) {
                ctx.globalAlpha = hover;
                ctx.fillStyle = theme.bgHeaderHovered;
                ctx.fill();
                ctx.globalAlpha = 1;
            }
        }

        if (filterHeight > 0) {
            // 绘制filter cell
            // 先获取内容
            const f = `${theme.filterFontStyle} ${theme.fontFamily}`;
            if (font !== f) {
                ctx.font = f;
            }

            drawFilterCell(
                ctx,
                allColumns,
                x,
                _y,
                filterHeight,
                c,
                selected,
                theme,
                filterHoveredBoolean,
                filterHoveredBoolean ? hPosX : undefined,
                filterHoveredBoolean ? hPosY : undefined,
                drawCellCallback,
                spriteManager,
                imageLoader,
                hoverValues,
                hovered,
                hyperWrapping,
                enqueue,
                frameTime,
                renderStateProvider,
                overrideCursor,
                getFilterCellRenderer,
                getFilterCellContent
            );
        }

        const f = `${theme.headerFontStyle} ${theme.fontFamily}`;
        if (font !== f) {
            ctx.font = f;
        }

        drawHeader(
            ctx,
            x,
            y,
            c.width,
            headerHeight,
            c,
            selected,
            theme,
            hoveredBoolean,
            hoveredBoolean ? hPosX : undefined,
            hoveredBoolean ? hPosY : undefined,
            hasSelectedCell,
            hovered,
            hover,
            spriteManager,
            drawHeaderCallback,
            touchMode
        );

        ctx.restore();
    });

    if (enableGroups) {
        drawGroups(
            ctx,
            effectiveCols,
            width,
            translateX,
            groupHeaderHeight,
            hovered,
            outerTheme,
            spriteManager,
            hoverValues,
            verticalBorder,
            getGroupDetails,
            damage
        );
    }
}

export function drawGroups(
    ctx: CanvasRenderingContext2D,
    effectiveCols: readonly MappedGridColumn[],
    width: number,
    translateX: number,
    groupHeaderHeight: number,
    hovered: HoverInfo | undefined,
    theme: FullTheme,
    spriteManager: SpriteManager,
    _hoverValues: HoverValues,
    verticalBorder: (col: number) => boolean,
    getGroupDetails: GroupDetailsCallback,
    damage: CellSet | undefined
) {
    const xPad = 8;
    const [hCol, hRow] = hovered?.[0] ?? [];

    let finalX = 0;
    walkGroups(effectiveCols, width, translateX, groupHeaderHeight, (span, groupName, x, y, w, h) => {
        if (
            damage !== undefined &&
            !damage.hasItemInRectangle({
                x: span[0],
                y: -2,
                width: span[1] - span[0] + 1,
                height: 1,
            })
        )
            return;
        ctx.save();
        ctx.beginPath();
        if (effectiveCols[span[0]]?.group !== undefined) {
            ctx.rect(x, y, w, h);
        }
        ctx.clip();

        const group = getGroupDetails(groupName);
        const groupTheme =
            group?.overrideTheme === undefined ? theme : mergeAndRealizeTheme(theme, group.overrideTheme);
        const isHovered = hRow === -2 && hCol !== undefined && hCol >= span[0] && hCol <= span[1];
        const fillColor = isHovered ? groupTheme.bgHeaderHovered : groupTheme.bgHeader;
        if (fillColor !== theme.bgHeader) {
            ctx.fillStyle = fillColor;
            ctx.fill();
        }

        ctx.fillStyle = groupTheme.textGroupHeader ?? groupTheme.textHeader;
        if (group !== undefined) {
            let drawX = x;
            if (group.icon !== undefined) {
                spriteManager.drawSprite(
                    group.icon,
                    "normal",
                    ctx,
                    drawX + xPad,
                    (groupHeaderHeight - 20) / 2,
                    20,
                    groupTheme
                );
                drawX += 26;
            }
            ctx.fillText(
                group.name,
                drawX + xPad,
                groupHeaderHeight / 2 + getMiddleCenterBias(ctx, theme.headerFontFull)
            );

            if (group.actions !== undefined && isHovered) {
                const actionBoxes = getActionBoundsForGroup({ x, y, width: w, height: h }, group.actions);

                ctx.beginPath();
                const fadeStartX = actionBoxes[0].x - 10;
                const fadeWidth = x + w - fadeStartX;
                ctx.rect(fadeStartX, 0, fadeWidth, groupHeaderHeight);
                const grad = ctx.createLinearGradient(fadeStartX, 0, fadeStartX + fadeWidth, 0);
                const trans = withAlpha(fillColor, 0);
                grad.addColorStop(0, trans);
                grad.addColorStop(10 / fadeWidth, fillColor);
                grad.addColorStop(1, fillColor);
                ctx.fillStyle = grad;

                ctx.fill();

                ctx.globalAlpha = 0.6;

                // eslint-disable-next-line prefer-const
                const [mouseX, mouseY] = hovered?.[1] ?? [-1, -1];
                for (let i = 0; i < group.actions.length; i++) {
                    const action = group.actions[i];
                    const box = actionBoxes[i];
                    const actionHovered = pointInRect(box, mouseX + x, mouseY);
                    if (actionHovered) {
                        ctx.globalAlpha = 1;
                    }
                    spriteManager.drawSprite(
                        action.icon,
                        "normal",
                        ctx,
                        box.x + box.width / 2 - 10,
                        box.y + box.height / 2 - 10,
                        20,
                        groupTheme
                    );
                    if (actionHovered) {
                        ctx.globalAlpha = 0.6;
                    }
                }

                ctx.globalAlpha = 1;
            }
        }

        if (x !== 0 && verticalBorder(span[0])) {
            ctx.beginPath();
            ctx.moveTo(x + 0.5, 0);
            ctx.lineTo(x + 0.5, groupHeaderHeight);
            ctx.strokeStyle = theme.borderColor;
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        ctx.restore();

        finalX = x + w;

        if (group !== undefined && group.name !== "") {
            ctx.beginPath();
            ctx.moveTo(x, groupHeaderHeight - 0.5);
            ctx.lineTo(finalX, groupHeaderHeight - 0.5);
            ctx.strokeStyle = theme.borderColor;
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    });

    // ctx.beginPath();
    // ctx.moveTo(finalX + 0.5, 0);
    // ctx.lineTo(finalX + 0.5, groupHeaderHeight);

    // ctx.moveTo(0, groupHeaderHeight + 0.5);
    // ctx.lineTo(width, groupHeaderHeight + 0.5);
    // ctx.strokeStyle = theme.borderColor;
    // ctx.lineWidth = 1;
    // ctx.stroke();
}

const menuButtonSize = 30;
function getHeaderMenuBounds(x: number, y: number, width: number, height: number, isRtl: boolean): Rectangle {
    if (isRtl) return { x, y, width: menuButtonSize, height: Math.min(menuButtonSize, height) };
    return {
        x: x + width - menuButtonSize, // right align
        y: Math.max(y, y + height / 2 - menuButtonSize / 2), // center vertically
        width: menuButtonSize,
        height: Math.min(menuButtonSize, height),
    };
}

const filterActionButtonSize = 13;
function getFilterActionBounds(
    x: number,
    y: number,
    width: number,
    height: number,
    padding: number,
    isRtl: boolean
): Rectangle {
    const buttonWidth = filterActionButtonSize + padding;
    if (isRtl) return { x, y, width: filterActionButtonSize, height: Math.min(buttonWidth, height) };
    return {
        x: x + width - buttonWidth, // right align
        y: Math.max(y, y + height / 2 - buttonWidth / 2), // center vertically
        width: buttonWidth,
        height: Math.min(buttonWidth, height),
    };
}

export function getActionBoundsForGroup(
    box: Rectangle,
    actions: NonNullable<GroupDetails["actions"]>
): readonly Rectangle[] {
    const result: Rectangle[] = [];
    let x = box.x + box.width - 26 * actions.length;
    const y = box.y + box.height / 2 - 13;
    const height = 26;
    const width = 26;
    for (let i = 0; i < actions.length; i++) {
        result.push({
            x,
            y,
            width,
            height,
        });
        x += 26;
    }
    return result;
}

type Mutable<T> = {
    -readonly [P in keyof T]: T[P];
};

interface HeaderLayout {
    readonly textBounds: Rectangle | undefined;
    readonly iconBounds: Rectangle | undefined;
    readonly iconOverlayBounds: Rectangle | undefined;
    readonly indicatorIconBounds: Rectangle | undefined;
    readonly menuBounds: Rectangle | undefined;
    readonly filterBounds: Rectangle | undefined;
}

function flipHorizontal(
    toFlip: Mutable<Rectangle> | undefined,
    mirrorX: number,
    isRTL: boolean
): Mutable<Rectangle> | undefined {
    if (!isRTL || toFlip === undefined) return toFlip;
    toFlip.x = mirrorX - (toFlip.x - mirrorX) - toFlip.width;
    return toFlip;
}

export function computeHeaderLayout(
    ctx: CanvasRenderingContext2D | undefined,
    c: MappedGridColumn,
    x: number,
    y: number,
    width: number,
    height: number,
    theme: FullTheme,
    isRTL: boolean
): HeaderLayout {
    const xPad = theme.cellHorizontalPadding;
    const headerIconSize = theme.headerIconSize;
    const menuBounds = getHeaderMenuBounds(x, y, width, height, false);
    const filterBounds = getFilterActionBounds(x, y, width, height, theme.cellHorizontalPadding * 2, false);

    let drawX = x + xPad;
    const iconBounds =
        c.icon === undefined
            ? undefined
            : {
                  x: drawX,
                  y: y + (height - headerIconSize) / 2,
                  width: headerIconSize,
                  height: headerIconSize,
              };

    const iconOverlayBounds =
        iconBounds === undefined || c.overlayIcon === undefined
            ? undefined
            : {
                  x: iconBounds.x + 9,
                  y: iconBounds.y + 6,
                  width: 18,
                  height: 18,
              };

    if (iconBounds !== undefined) {
        drawX += Math.ceil(headerIconSize * 1.3);
    }

    const textBounds = {
        x: drawX,
        y: y,
        width: width - drawX,
        height: height,
    };

    let indicatorIconBounds: Rectangle | undefined = undefined;
    if (c.indicatorIcon !== undefined) {
        const textWidth =
            ctx === undefined
                ? getMeasuredTextCache(c.title, theme.headerFontFull)?.width ?? 0
                : measureTextCached(c.title, ctx, theme.headerFontFull).width;
        textBounds.width = textWidth;
        drawX += textWidth + xPad;
        indicatorIconBounds = {
            x: drawX,
            y: y + (height - headerIconSize) / 2,
            width: headerIconSize,
            height: headerIconSize,
        };
    }

    const mirrorPoint = x + width / 2;

    return {
        menuBounds: flipHorizontal(menuBounds, mirrorPoint, isRTL),
        filterBounds: flipHorizontal(filterBounds, mirrorPoint, isRTL),
        iconBounds: flipHorizontal(iconBounds, mirrorPoint, isRTL),
        iconOverlayBounds: flipHorizontal(iconOverlayBounds, mirrorPoint, isRTL),
        textBounds: flipHorizontal(textBounds, mirrorPoint, isRTL),
        indicatorIconBounds: flipHorizontal(indicatorIconBounds, mirrorPoint, isRTL),
    };
}

function drawHeaderInner(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    c: MappedGridColumn,
    selected: boolean,
    theme: FullTheme,
    isHovered: boolean,
    posX: number | undefined,
    posY: number | undefined,
    hoverAmount: number,
    spriteManager: SpriteManager,
    touchMode: boolean,
    isRtl: boolean,
    headerLayout: HeaderLayout
) {
    if (c.rowMarker !== undefined && c.headerRowMarkerDisabled !== true) {
        const checked = c.rowMarkerChecked;
        if (checked !== true && c.headerRowMarkerAlwaysVisible !== true) {
            ctx.globalAlpha = hoverAmount;
        }
        const markerTheme =
            c.headerRowMarkerTheme !== undefined ? mergeAndRealizeTheme(theme, c.headerRowMarkerTheme) : theme;
        drawCheckbox(
            ctx,
            markerTheme,
            checked,
            x,
            y,
            width,
            height,
            false,
            undefined,
            undefined,
            18,
            "center",
            c.rowMarker
        );
        if (checked !== true && c.headerRowMarkerAlwaysVisible !== true) {
            ctx.globalAlpha = 1;
        }
        return;
    }

    const fillStyle = selected ? theme.textHeaderSelected : theme.textHeader;

    const shouldDrawMenu =
        c.hasMenu === true && (isHovered || (touchMode && selected)) && headerLayout.menuBounds !== undefined;

    if (c.icon !== undefined && headerLayout.iconBounds !== undefined) {
        let variant: SpriteVariant = selected ? "selected" : "normal";
        if (c.style === "highlight") {
            variant = selected ? "selected" : "special";
        }
        spriteManager.drawSprite(
            c.icon,
            variant,
            ctx,
            headerLayout.iconBounds.x,
            headerLayout.iconBounds.y,
            headerLayout.iconBounds.width,
            theme
        );

        if (c.overlayIcon !== undefined && headerLayout.iconOverlayBounds !== undefined) {
            spriteManager.drawSprite(
                c.overlayIcon,
                selected ? "selected" : "special",
                ctx,
                headerLayout.iconOverlayBounds.x,
                headerLayout.iconOverlayBounds.y,
                headerLayout.iconOverlayBounds.width,
                theme
            );
        }
    }

    if (shouldDrawMenu && width > 35) {
        const fadeWidth = 35;
        const fadeStart = isRtl ? fadeWidth : width - fadeWidth;
        const fadeEnd = isRtl ? fadeWidth * 0.7 : width - fadeWidth * 0.7;

        const fadeStartPercent = fadeStart / width;
        const fadeEndPercent = fadeEnd / width;

        const grad = ctx.createLinearGradient(x, 0, x + width, 0);
        const trans = withAlpha(fillStyle, 0);

        grad.addColorStop(isRtl ? 1 : 0, fillStyle);
        grad.addColorStop(fadeStartPercent, fillStyle);
        grad.addColorStop(fadeEndPercent, trans);
        grad.addColorStop(isRtl ? 0 : 1, trans);
        ctx.fillStyle = grad;
    } else {
        ctx.fillStyle = fillStyle;
    }

    if (isRtl) {
        ctx.textAlign = "right";
    }
    if (headerLayout.textBounds !== undefined) {
        ctx.fillText(
            c.title,
            isRtl ? headerLayout.textBounds.x + headerLayout.textBounds.width : headerLayout.textBounds.x,
            y + height / 2 + getMiddleCenterBias(ctx, theme.headerFontFull)
        );
    }
    if (isRtl) {
        ctx.textAlign = "left";
    }

    if (
        c.indicatorIcon !== undefined &&
        headerLayout.indicatorIconBounds !== undefined &&
        (!shouldDrawMenu ||
            !intersectRect(
                headerLayout.menuBounds.x,
                headerLayout.menuBounds.y,
                headerLayout.menuBounds.width,
                headerLayout.menuBounds.height,
                headerLayout.indicatorIconBounds.x,
                headerLayout.indicatorIconBounds.y,
                headerLayout.indicatorIconBounds.width,
                headerLayout.indicatorIconBounds.height
            ))
    ) {
        let variant: SpriteVariant = selected ? "selected" : "normal";
        if (c.style === "highlight") {
            variant = selected ? "selected" : "special";
        }
        spriteManager.drawSprite(
            c.indicatorIcon,
            variant,
            ctx,
            headerLayout.indicatorIconBounds.x,
            headerLayout.indicatorIconBounds.y,
            headerLayout.indicatorIconBounds.width,
            theme
        );
    }

    if (shouldDrawMenu && headerLayout.menuBounds !== undefined) {
        const menuBounds = headerLayout.menuBounds;

        const hovered = posX !== undefined && posY !== undefined && pointInRect(menuBounds, posX + x, posY + y);

        if (!hovered) {
            ctx.globalAlpha = 0.7;
        }

        if (c.menuIcon === undefined || c.menuIcon === GridColumnMenuIcon.Triangle) {
            // Draw the default triangle menu icon:
            ctx.beginPath();
            const triangleX = menuBounds.x + menuBounds.width / 2 - 5.5;
            const triangleY = menuBounds.y + menuBounds.height / 2 - 3;
            roundedPoly(
                ctx,
                [
                    {
                        x: triangleX,
                        y: triangleY,
                    },
                    {
                        x: triangleX + 11,
                        y: triangleY,
                    },
                    {
                        x: triangleX + 5.5,
                        y: triangleY + 6,
                    },
                ],
                1
            );
            ctx.fillStyle = fillStyle;
            ctx.fill();
        } else if (c.menuIcon === GridColumnMenuIcon.Dots) {
            // Draw the three dots menu icon:
            ctx.beginPath();
            const dotsX = menuBounds.x + menuBounds.width / 2;
            const dotsY = menuBounds.y + menuBounds.height / 2;
            drawMenuDots(ctx, dotsX, dotsY);
            ctx.fillStyle = fillStyle;
            ctx.fill();
        } else {
            // Assume that the user has specified a valid sprite image as header icon:
            const iconX = menuBounds.x + (menuBounds.width - theme.headerIconSize) / 2;
            const iconY = menuBounds.y + (menuBounds.height - theme.headerIconSize) / 2;
            spriteManager.drawSprite(c.menuIcon, "normal", ctx, iconX, iconY, theme.headerIconSize, theme);
        }

        if (!hovered) {
            ctx.globalAlpha = 1;
        }
    }
}

export function drawFilterCell(
    ctx: CanvasRenderingContext2D,
    allColumns: readonly MappedGridColumn[],
    x: number,
    y: number,
    filterHeight: number,
    c: MappedGridColumn,
    selected: boolean,
    theme: FullTheme,
    isHovered: boolean,
    posX: number | undefined,
    posY: number | undefined,
    drawCellCallback: DrawCellCallback | undefined,
    spriteManager: SpriteManager,
    imageLoader: ImageWindowLoader,
    hoverValues: HoverValues,
    hoverInfo: HoverInfo | undefined,
    hyperWrapping: boolean,
    enqueue: (item: Item) => void,
    frameTime: number,
    renderStateProvider: RenderStateProvider,
    overrideCursor: (cursor: React.CSSProperties["cursor"]) => void,
    getFilterCellRenderer: GetCellRendererCallback,
    getFilterCellContent?: (cell: number) => InnerGridCell
) {
    let prepResult: PrepResult | undefined = undefined;
    const isRtl = direction(c.title) === "rtl";
    const filterCell = getFilterCellContent?.(c.sourceIndex) ?? loadingCell;
    const fillStyle = selected ? theme.textHeaderSelected : theme.textHeader;
    ctx.fillStyle = fillStyle;
    const isLastColumn = c.sourceIndex === allColumns.length - 1;

    let hoverValue: HoverValues[number] | undefined;
    for (const hv of hoverValues) {
        if (hv.item[0] === c.sourceIndex && hv.item[1] === -3) {
            hoverValue = hv;
            break;
        }
    }

    const filterLayout = computeHeaderLayout(ctx, c, x, y, c.width, filterHeight, theme, isRtl);
    const shouldDrawMenu =
        isHovered &&
        filterLayout.filterBounds !== undefined &&
        filterCell?.kind === GridCellKind.Custom &&
        (Array.isArray((filterCell.data as any)?.displayData)
            ? (filterCell.data as any)?.displayData.length > 0
            : // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
              !!(filterCell.data as any)?.displayData);

    if (shouldDrawMenu) {
        const filterBounds = filterLayout.filterBounds;
        const hovered = posX !== undefined && posY !== undefined && pointInRect(filterBounds, posX + x, posY + y);

        if (!hovered) {
            ctx.globalAlpha = 0.7;
        }

        if (hovered) {
            overrideCursor("pointer");
        }

        const startX = x + c.width - 13 - theme.cellHorizontalPadding * 2;
        const startY = y + (filterHeight - 13) / 2;
        spriteManager.drawSprite("clearIcon", "normal", ctx, startX, startY, 13, theme);

        if (!hovered) {
            ctx.globalAlpha = 1;
        }
    }

    prepResult = drawCell(
        ctx,
        filterCell,
        c.sourceIndex,
        -3,
        isLastColumn,
        false,
        x,
        y,
        c.width,
        filterHeight,
        false, // accentCount > 0,
        theme,
        "", // fill ?? theme.bgCell,
        imageLoader,
        spriteManager,
        hoverValue?.hoverAmount ?? 0,
        hoverInfo,
        hyperWrapping,
        frameTime,
        drawCellCallback,
        prepResult,
        enqueue,
        renderStateProvider,
        getFilterCellRenderer,
        overrideCursor
    );
}

export function drawHeader(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    c: MappedGridColumn,
    selected: boolean,
    theme: FullTheme,
    isHovered: boolean,
    posX: number | undefined,
    posY: number | undefined,
    hasSelectedCell: boolean,
    hoverInfo: HoverInfo | undefined,
    hoverAmount: number,
    spriteManager: SpriteManager,
    drawHeaderCallback: DrawHeaderCallback | undefined,
    touchMode: boolean
) {
    const isRtl = direction(c.title) === "rtl";
    const headerLayout = computeHeaderLayout(ctx, c, x, y, width, height, theme, isRtl);

    let hoverX: number | undefined;
    let hoverY: number | undefined;
    if (hoverInfo !== undefined && hoverInfo[0][0] === c.sourceIndex && hoverInfo[0][1] === -1) {
        hoverX = hoverInfo[1][0];
        hoverY = hoverInfo[1][1];
    }

    if (drawHeaderCallback !== undefined) {
        drawHeaderCallback(
            {
                ctx,
                theme,
                rect: { x, y, width, height },
                column: c,
                columnIndex: c.sourceIndex,
                isSelected: selected,
                hoverAmount,
                isHovered,
                hasSelectedCell,
                spriteManager,
                menuBounds: headerLayout?.menuBounds ?? { x: 0, y: 0, height: 0, width: 0 },
                hoverX,
                hoverY,
            },
            () =>
                drawHeaderInner(
                    ctx,
                    x,
                    y,
                    width,
                    height,
                    c,
                    selected,
                    theme,
                    isHovered,
                    posX,
                    posY,
                    hoverAmount,
                    spriteManager,
                    touchMode,
                    isRtl,
                    headerLayout
                )
        );
    } else {
        drawHeaderInner(
            ctx,
            x,
            y,
            width,
            height,
            c,
            selected,
            theme,
            isHovered,
            posX,
            posY,
            hoverAmount,
            spriteManager,
            touchMode,
            isRtl,
            headerLayout
        );
    }
}
