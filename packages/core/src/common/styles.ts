import React from "react";
import { blend } from "../internal/data-grid/color-parser.js";

// theme variable precidence

/** @category Theme */
export function makeCSSStyle(theme: Theme): Record<string, string> {
    return {
        "--gdg-accent-color": theme.accentColor,
        "--gdg-accent-fg": theme.accentFg,
        "--gdg-accent-light": theme.accentLight,
        "--gdg-text-dark": theme.textDark,
        "--gdg-text-medium": theme.textMedium,
        "--gdg-text-light": theme.textLight,
        "--gdg-text-bubble": theme.textBubble,
        "--gdg-bg-icon-header": theme.bgIconHeader,
        "--gdg-fg-icon-header": theme.fgIconHeader,
        "--gdg-text-header": theme.textHeader,
        "--gdg-text-group-header": theme.textGroupHeader ?? theme.textHeader,
        "--gdg-text-header-selected": theme.textHeaderSelected,
        "--gdg-bg-cell": theme.bgCell,
        "--gdg-bg-cell-medium": theme.bgCellMedium,
        "--gdg-bg-header": theme.bgHeader,
        "--gdg-bg-header-has-focus": theme.bgHeaderHasFocus,
        "--gdg-bg-header-hovered": theme.bgHeaderHovered,
        "--gdg-bg-bubble": theme.bgBubble,
        "--gdg-bg-bubble-selected": theme.bgBubbleSelected,
        "--gdg-bg-search-result": theme.bgSearchResult,
        "--gdg-border-color": theme.borderColor,
        "--gdg-horizontal-border-color": theme.horizontalBorderColor ?? theme.borderColor,
        "--gdg-drilldown-border": theme.drilldownBorder,
        "--gdg-link-color": theme.linkColor,
        "--gdg-cell-horizontal-padding": `${theme.cellHorizontalPadding}px`,
        "--gdg-cell-vertical-padding": `${theme.cellVerticalPadding}px`,
        "--gdg-header-font-style": theme.headerFontStyle,
        "--gdg-base-font-style": theme.baseFontStyle,
        "--gdg-marker-font-style": theme.markerFontStyle,
        "--gdg-font-family": theme.fontFamily,
        "--gdg-editor-font-size": theme.editorFontSize,
        ...(theme.resizeIndicatorColor === undefined
            ? {}
            : { "--gdg-resize-indicator-color": theme.resizeIndicatorColor }),
        ...(theme.headerBottomBorderColor === undefined
            ? {}
            : { "--gdg-header-bottom-border-color": theme.headerBottomBorderColor }),
        ...(theme.roundingRadius === undefined ? {} : { "--gdg-rounding-radius": `${theme.roundingRadius}px` }),
    };
}

/** @category Theme */
export interface Theme {
    accentColor: string;
    accentWidth: number;
    accentFg: string;
    accentLight: string;
    textDark: string;
    textDarkAccent: string;
    textMedium: string;
    textLight: string;
    textBubble: string;
    bgIconHeader: string;
    fgIconHeader: string;
    bgIconDisabled: string;
    fgIconDisabled: string;
    bgIconHeaderHovered: string;
    fgIconHeaderHovered: string;
    textHeader: string;
    textGroupHeader?: string;
    textHeaderSelected: string;
    bgCell: string;
    bgCellMedium: string;
    bgHeader: string;
    bgHeaderDisabled: string;
    bgHeaderHasFocus: string;
    bgHeaderHovered: string;
    bgNewRowHovered: string;
    bgBubble: string;
    bgBubbleSelected: string;
    bgSearchResult: string;
    borderColor: string;
    groupHorizontalBorderColor: string;
    drilldownBorder: string;
    linkColor: string;
    cellHorizontalPadding: number;
    cellVerticalPadding: number;
    headerFontStyle: string;
    filterFontStyle: string;
    headerIconSize: number;
    markerIconSize: number;
    baseFontStyle: string;
    markerFontStyle: string;
    fontFamily: string;
    editorFontSize: string;
    lineWidth: number;
    lineHeight: number;
    resizeIndicatorColor?: string;
    horizontalBorderColor?: string;
    headerBottomBorderColor?: string;
    roundingRadius?: number;
    filterHeaderBg?: string;
    markLine: string;
    markerTextLight: string;
    markerTextAccent: string;
    emptyTextLight: string;
    emptyText: string;
    groupIconColor?: string;
    groupIconHover?: string;
}

const dataEditorBaseTheme: Theme = {
    lineWidth: 1,
    accentWidth: 1,
    accentColor: "#4F5DFF",
    accentFg: "#FFFFFF",
    accentLight: "rgba(62, 116, 253, 0.1)",
    emptyTextLight: " #7b7d80",
    emptyText: "暂无数据",

    textDark: "#313139",
    textDarkAccent: "#FFAE3D",
    textMedium: "#737383",
    textLight: "#B2B2C0",
    textBubble: "#313139",
    markerTextLight: "#B2B2C0",
    markerTextAccent: "#FFAE3D",

    bgIconHeader: "#737383",
    fgIconHeader: "#FFFFFF",
    bgIconDisabled: "#737383",
    fgIconDisabled: "#FFFFFF",
    bgIconHeaderHovered: "#000000",
    fgIconHeaderHovered: "#f3f4ef",
    textHeader: "#313139",
    textGroupHeader: "#313139BB",
    textHeaderSelected: "#FFFFFF",

    bgCell: "#FFFFFF",
    bgCellMedium: "#FAFAFB",
    bgHeader: "#F7F7F8",
    bgHeaderDisabled: "#F7F7F8",
    bgHeaderHasFocus: "#E9E9EB",
    bgHeaderHovered: "#EFEFF1",
    bgNewRowHovered: "#EFEFF1",

    bgBubble: "#EDEDF3",
    bgBubbleSelected: "#FFFFFF",

    bgSearchResult: "#fff9e3",

    borderColor: "rgba(115, 116, 131, 0.16)",
    groupHorizontalBorderColor: "rgba(115, 116, 131, 0.16)",
    drilldownBorder: "rgba(0, 0, 0, 0)",

    linkColor: "#353fb5",

    cellHorizontalPadding: 3,
    cellVerticalPadding: 3,

    headerIconSize: 18,
    markerIconSize: 18,

    headerFontStyle: "400 14px",
    filterFontStyle: "500 13px",
    baseFontStyle: "13px",
    markerFontStyle: "13px",
    fontFamily:
        "Inter, Roboto, -apple-system, BlinkMacSystemFont, avenir next, avenir, segoe ui, helvetica neue, helvetica, Ubuntu, noto, arial, sans-serif",
    editorFontSize: "13px",
    lineHeight: 1.4, //unitless scaler depends on your font
    markLine: "#313139",
    groupIconColor: "rgba(255, 255, 255, 0.87)",
    groupIconHover: "#FFB042",
};

export interface FullTheme extends Theme {
    headerFontFull: string;
    baseFontFull: string;
    markerFontFull: string;
}

/** @category Theme */
export function getDataEditorTheme(): Theme {
    return dataEditorBaseTheme;
}

/** @category Theme */
export const ThemeContext = React.createContext<Theme>(dataEditorBaseTheme);
/** @category Hooks */
export function useTheme(): Theme {
    return React.useContext(ThemeContext);
}

export function mergeAndRealizeTheme(theme: Theme, ...overlays: Partial<Theme | undefined>[]): FullTheme {
    const merged: any = { ...theme };

    for (const overlay of overlays) {
        if (overlay !== undefined) {
            for (const key in overlay) {
                // eslint-disable-next-line no-prototype-builtins
                if (overlay.hasOwnProperty(key)) {
                    if (key === "bgCell") {
                        merged[key] = blend(overlay[key] as string, merged[key]);
                    } else {
                        merged[key] = (overlay as any)[key];
                    }
                }
            }
        }
    }

    if (
        merged.headerFontFull === undefined ||
        theme.fontFamily !== merged.fontFamily ||
        theme.headerFontStyle !== merged.headerFontStyle
    ) {
        merged.headerFontFull = `${merged.headerFontStyle} ${merged.fontFamily}`;
    }

    if (
        merged.baseFontFull === undefined ||
        theme.fontFamily !== merged.fontFamily ||
        theme.baseFontStyle !== merged.baseFontStyle
    ) {
        merged.baseFontFull = `${merged.baseFontStyle} ${merged.fontFamily}`;
    }

    if (
        merged.markerFontFull === undefined ||
        theme.fontFamily !== merged.fontFamily ||
        theme.markerFontStyle !== merged.markerFontStyle
    ) {
        merged.markerFontFull = `${merged.markerFontStyle} ${merged.fontFamily}`;
    }

    return merged;
}
