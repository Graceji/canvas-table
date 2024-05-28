import { assertNever } from "../../../common/support.js";
import { getSquareWidth, getSquareXPosFromAlign, getSquareBB, pointIsWithinBB } from "../../../common/utils.js";
import type { Theme } from "../../../index.js";
import { roundedRect } from "./data-grid-lib.js";
import { BooleanEmpty, BooleanIndeterminate, type BaseGridCell } from "../data-grid-types.js";

export function drawCheckbox(
    ctx: CanvasRenderingContext2D,
    theme: Theme,
    checked: boolean | BooleanEmpty | BooleanIndeterminate,
    x: number,
    y: number,
    width: number,
    height: number,
    highlighted: boolean,
    hoverX: number = -20,
    hoverY: number = -20,
    maxSize: number = 32,
    alignment: BaseGridCell["contentAlign"] = "center",
    style: "circle" | "square" = "square",
    border: boolean = false
) {
    const centerY = Math.floor(y + height / 2);
    const rectBordRadius = style === "circle" ? 10_000 : theme.roundingRadius ?? 2;
    let checkBoxWidth = getSquareWidth(maxSize, height, theme.cellVerticalPadding);
    let checkBoxHalfWidth = checkBoxWidth / 2;
    const posX = getSquareXPosFromAlign(alignment, x, width, theme.cellHorizontalPadding, checkBoxWidth);
    const bb = getSquareBB(posX, centerY, checkBoxWidth);
    const hovered = pointIsWithinBB(x + hoverX, y + hoverY, bb);

    switch (checked) {
        case true: {
            ctx.beginPath();
            roundedRect(
                ctx,
                posX - checkBoxWidth / 2,
                centerY - checkBoxWidth / 2,
                checkBoxWidth,
                checkBoxWidth,
                rectBordRadius
            );

            if (style === "circle") {
                checkBoxHalfWidth *= 0.8;
                checkBoxWidth *= 0.8;
            }

            ctx.fillStyle = highlighted ? theme.accentColor : theme.checkboxActiveBg;
            ctx.fill();

            ctx.beginPath();
            ctx.moveTo(
                posX - checkBoxHalfWidth + checkBoxWidth / 4.23,
                centerY - checkBoxHalfWidth + checkBoxWidth / 1.97
            );
            ctx.lineTo(
                posX - checkBoxHalfWidth + checkBoxWidth / 2.42,
                centerY - checkBoxHalfWidth + checkBoxWidth / 1.44
            );
            ctx.lineTo(
                posX - checkBoxHalfWidth + checkBoxWidth / 1.29,
                centerY - checkBoxHalfWidth + checkBoxWidth / 3.25
            );

            ctx.strokeStyle = theme.checkboxInnerColor;
            ctx.lineJoin = "miter";
            ctx.lineCap = "butt";
            ctx.lineWidth = 2;
            ctx.stroke();
            break;
        }

        case BooleanEmpty:
        case false: {
            ctx.beginPath();
            roundedRect(
                ctx,
                posX - checkBoxWidth / 2 + 0.5,
                centerY - checkBoxWidth / 2 + 0.5,
                checkBoxWidth - 1,
                checkBoxWidth - 1,
                rectBordRadius
            );

            ctx.fillStyle = hovered ? theme.checkboxActiveBg : theme.checkboxBg;
            ctx.fill();

            if (border === true) {
                ctx.lineWidth = 1;
                ctx.strokeStyle = hovered ? theme.textDark : theme.textMedium;
                ctx.stroke();
            }
            break;
        }

        case BooleanIndeterminate: {
            ctx.beginPath();
            roundedRect(
                ctx,
                posX - checkBoxWidth / 2,
                centerY - checkBoxWidth / 2,
                checkBoxWidth,
                checkBoxWidth,
                rectBordRadius
            );

            ctx.fillStyle = hovered ? theme.checkboxActiveBg : theme.checkboxBg;
            ctx.fill();

            if (!hovered) {
                if (style === "circle") {
                    checkBoxHalfWidth *= 0.8;
                    checkBoxWidth *= 0.8;
                }

                ctx.beginPath();
                ctx.fillStyle = theme.checkboxActiveBg;
                ctx.fillRect(posX - 4, centerY - 4, 8, 8);
                ctx.fill();

                // 原来是横线
                // ctx.moveTo(posX - checkBoxWidth / 3, centerY);
                // ctx.lineTo(posX + checkBoxWidth / 3, centerY);
                // ctx.strokeStyle = theme.bgCell;
                // ctx.lineCap = "round";
                // ctx.lineWidth = 1.9;
                // ctx.stroke();
            }

            break;
        }

        default:
            assertNever(checked);
    }
}
