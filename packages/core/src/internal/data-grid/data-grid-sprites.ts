import type { Theme } from "../../common/styles.js";
import type { SpriteProps } from "../../common/utils.js";
import { type HeaderIconMap } from "./sprites.js";

/**
 * A known icon identifier
 *
 * @category Columns
 */
export type HeaderIcon = keyof HeaderIconMap;

/**
 * A method that produces an SVG array from
 * an SVG icon configuration.
 *
 * @category Columns
 */
export type Sprite = (props: SpriteProps) => string;

/**
 * A method that maps from icon names to functions
 * that return SVG strings.
 *
 * @category Columns
 */
export type SpriteMap = Record<string | HeaderIcon, Sprite>;

/** @category Columns */
export type SpriteVariant = "normal" | "selected" | "special" | "hovered" | "disabled" | "disableHovered";

function getColors(
    variant: SpriteVariant,
    theme: Theme,
    fgColorOuter?: string,
    bgColorOuter?: string,
    fgHoverColorOuter?: string,
    bgHoverColorOuter?: string
): readonly [string, string] {
    // eslint-disable-next-line unicorn/prefer-switch
    if (variant === "normal") {
        return [bgColorOuter ?? theme.bgIconHeader, fgColorOuter ?? theme.fgIconHeader];
    } else if (variant === "selected") {
        return ["white", theme.accentColor];
    } else if (variant === "hovered") {
        return [bgHoverColorOuter ?? theme.bgIconHeaderHovered, fgHoverColorOuter ?? theme.fgIconHeaderHovered];
    } else if (variant === "disabled") {
        return [theme.bgIconDisabled, theme.fgIconDisabled];
    } else if (variant === "disableHovered") {
        return [theme.bgIconDisableHovered, theme.fgIconDisableHovered];
    } else {
        return [theme.accentColor, theme.bgHeader];
    }
}

/** @category Columns */
export class SpriteManager {
    private spriteMap: Map<string, HTMLCanvasElement> = new Map();
    private headerIcons: SpriteMap;
    private inFlight = 0;
    private icons: SpriteMap = {};

    constructor(
        headerIcons: SpriteMap | undefined,
        private onSettled: () => void
    ) {
        this.headerIcons = headerIcons ?? {};
    }

    addAdditionalIcon(sprite: string, spriteCb: Sprite) {
        if (this.icons[sprite] === undefined) {
            this.icons[sprite] = spriteCb;
        }
        return this.icons[sprite];
    }

    overrideSprite(sprite: string, spriteCb: Sprite) {
        if (this.icons[sprite] !== undefined) {
            this.icons[sprite] = spriteCb;
        }
    }

    public drawSprite(
        sprite: HeaderIcon | string,
        variant: SpriteVariant,
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        size: number,
        theme: Theme,
        alpha: number = 1,
        height?: number,
        fgColorOuter?: string,
        bgColorOuter?: string,
        fgHoverColorOuter?: string,
        bgHoverColorOuter?: string
    ) {
        const [bgColor, fgColor] = getColors(
            variant,
            theme,
            fgColorOuter,
            bgColorOuter,
            fgHoverColorOuter,
            bgHoverColorOuter
        );
        const rSize = size * Math.ceil(window.devicePixelRatio);
        const vSize =
            height !== undefined && typeof height === "number" ? height * Math.ceil(window.devicePixelRatio) : rSize;
        const key = `${bgColor}_${fgColor}_${rSize}_${sprite}`;

        let spriteCanvas = this.spriteMap.get(key);
        if (spriteCanvas === undefined) {
            const spriteCb = this.headerIcons[sprite] ?? this.icons[sprite];

            if (spriteCb === undefined) return;

            spriteCanvas = document.createElement("canvas");
            const spriteCtx = spriteCanvas.getContext("2d");

            if (spriteCtx === null) return;

            const imgSource = new Image();
            imgSource.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
                spriteCb({ fgColor: fgColor, bgColor: bgColor })
            )}`;
            this.spriteMap.set(key, spriteCanvas);
            const promise: Promise<void> | undefined = imgSource.decode();

            if (promise === undefined) return;

            this.inFlight++;
            promise
                .then(() => {
                    spriteCtx.drawImage(imgSource, 0, 0, rSize, vSize);
                })
                .finally(() => {
                    this.inFlight--;
                    if (this.inFlight === 0) {
                        this.onSettled();
                    }
                });
        } else {
            if (alpha < 1) {
                ctx.globalAlpha = alpha;
            }
            ctx.drawImage(
                spriteCanvas,
                0,
                0,
                rSize,
                vSize,
                x,
                y,
                size,
                height !== undefined && typeof height === "number" ? height : size
            );
            if (alpha < 1) {
                ctx.globalAlpha = 1;
            }
        }
    }
}
