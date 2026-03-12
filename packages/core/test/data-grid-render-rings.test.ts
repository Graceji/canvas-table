import { describe, expect, test } from "vitest";
import { drawHighlightRings } from "../src/internal/data-grid/render/data-grid.render.rings.js";
import { getDefaultTheme } from "../src/index.js";
import { mergeAndRealizeTheme } from "../src/common/styles.js";
import { withAlpha } from "../src/internal/data-grid/color-parser.js";

describe("data-grid highlight rings", () => {
    test("dedupes nested solid outlines for the same merged block", () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d") as any;
        const theme = mergeAndRealizeTheme(getDefaultTheme());

        ctx.__clearEvents();

        drawHighlightRings(
            ctx,
            200,
            300,
            0,
            0,
            0,
            0,
            [
                {
                    sourceIndex: 0,
                    sticky: false,
                    width: 120,
                    title: "A",
                } as any,
            ],
            0,
            0,
            36,
            0,
            32,
            0,
            10,
            [
                {
                    color: theme.accentColor,
                    range: { x: 0, y: 0, width: 1, height: 3 },
                    style: "solid-outline",
                    requiresFullRedraw: true,
                },
                {
                    color: theme.accentColor,
                    range: { x: 0, y: 0, width: 1, height: 1 },
                    style: "solid-outline",
                    requiresFullRedraw: true,
                },
            ],
            theme
        );

        const strokeRects = ctx.__getEvents().filter((event: any) => event.type === "strokeRect");

        expect(strokeRects).toHaveLength(1);
    });

    test("keeps nested ordinary solid outlines when they are not merged-block redraw outlines", () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d") as any;
        const theme = mergeAndRealizeTheme(getDefaultTheme());

        ctx.__clearEvents();

        drawHighlightRings(
            ctx,
            200,
            300,
            0,
            0,
            0,
            0,
            [
                {
                    sourceIndex: 0,
                    sticky: false,
                    width: 120,
                    title: "A",
                } as any,
            ],
            0,
            0,
            36,
            0,
            32,
            0,
            10,
            [
                {
                    color: theme.accentColor,
                    range: { x: 0, y: 0, width: 1, height: 3 },
                    style: "solid-outline",
                },
                {
                    color: theme.accentColor,
                    range: { x: 0, y: 0, width: 1, height: 1 },
                    style: "solid-outline",
                },
            ],
            theme
        );

        const strokeRects = ctx.__getEvents().filter((event: any) => event.type === "strokeRect");

        expect(strokeRects).toHaveLength(2);
    });

    test("dedupes merged-block redraw outlines even when range and focus colors differ", () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d") as any;
        const theme = mergeAndRealizeTheme(getDefaultTheme());

        ctx.__clearEvents();

        drawHighlightRings(
            ctx,
            200,
            300,
            0,
            0,
            0,
            0,
            [
                {
                    sourceIndex: 0,
                    sticky: false,
                    width: 120,
                    title: "A",
                } as any,
            ],
            0,
            0,
            36,
            0,
            32,
            0,
            10,
            [
                {
                    color: withAlpha(theme.accentColor, 0.5),
                    range: { x: 0, y: 0, width: 1, height: 3 },
                    style: "solid-outline",
                    requiresFullRedraw: true,
                },
                {
                    color: theme.accentColor,
                    range: { x: 0, y: 0, width: 1, height: 3 },
                    style: "solid-outline",
                    requiresFullRedraw: true,
                },
            ],
            theme
        );

        const strokeRects = ctx.__getEvents().filter((event: any) => event.type === "strokeRect");

        expect(strokeRects).toHaveLength(1);
    });
});
