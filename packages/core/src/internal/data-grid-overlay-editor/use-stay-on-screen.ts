import * as React from "react";

function useRefState(): [HTMLElement | undefined, React.RefCallback<HTMLElement | null>] {
    const [refState, setRefState] = React.useState<HTMLElement | null>();
    return [refState ?? undefined, setRefState];
}

interface StayOnScreen {
    ref: React.RefCallback<HTMLElement | null>;
    style: React.CSSProperties;
}

// props
// {
//     rowHeight,
//     headerHeight,
//     canvasBounds,
//     visibleRegion,
//     target,
//     cell,
//     gridRef,
//     column,
//     leftSiblingsWidth,
// }
export function useStayOnScreen(): StayOnScreen {
    const [ref, setRef] = useRefState();
    const [xOffset, setXOffset] = React.useState(0);
    const [isIntersecting, setIsIntersecting] = React.useState(true);

    React.useLayoutEffect(() => {
        if (ref === undefined) return;
        if (!("IntersectionObserver" in window)) return;

        const observer = new IntersectionObserver(
            ents => {
                if (ents.length === 0) return;
                setIsIntersecting(ents[0].isIntersecting);
            },
            { threshold: 1 }
        );
        observer.observe(ref);

        return () => observer.disconnect();
    }, [ref]);

    React.useEffect(() => {
        if (isIntersecting || ref === undefined) return;

        let rafHandle: number | undefined;
        const fn = () => {
            const { right: refRight } = ref.getBoundingClientRect();

            setXOffset(cv => Math.min(cv + window.innerWidth - refRight - 10, 0));
            rafHandle = requestAnimationFrame(fn);
        };

        rafHandle = requestAnimationFrame(fn);
        return () => {
            if (rafHandle !== undefined) {
                cancelAnimationFrame(rafHandle);
            }
        };
    }, [ref, isIntersecting]);

    // 以下代码为尝试滚动时，动态修改dom节点位置，
    // 但是由于横向滚动时，若有冻结列，在向左滚动时，在没有完全滚出可视区域时，由于opacity为0，会一直无法进行编辑，因此弃用
    // React.useEffect(() => {
    //     let rafId: number;
    //     const newRect = gridRef.current?.getBounds(...cell);

    //     const loop = () => {
    //         if (target === undefined) return;
    //         if (newRect !== undefined && ref !== undefined) {
    //             ref.style.left = `${newRect.x}px`;
    //             ref.style.top = `${newRect.y}px`;

    //             const option1 = canvasBounds.x + leftSiblingsWidth > newRect.x;
    //             const option2 = newRect.x + newRect.width > canvasBounds.x + canvasBounds.width;

    //             ref.style.opacity =
    //                 canvasBounds.y + headerHeight > newRect.y + rowHeight ||
    //                 canvasBounds.x + leftSiblingsWidth > newRect.x ||
    //                 newRect.x + newRect.width > canvasBounds.x + canvasBounds.width
    //                     ? "0"
    //                     : "1";
    //         }
    //         rafId = requestAnimationFrame(loop);
    //     };

    //     if (target !== undefined) {
    //         loop();
    //     }

    //     return () => {
    //         cancelAnimationFrame(rafId);
    //     };
    // }, [
    //     visibleRegion,
    //     target,
    //     ref,
    //     gridRef,
    //     cell,
    //     canvasBounds.x,
    //     canvasBounds.width,
    //     canvasBounds.y,
    //     leftSiblingsWidth,
    //     headerHeight,
    //     rowHeight,
    // ]);

    const style = React.useMemo(() => {
        return { transform: `translateX(${xOffset}px)` };
    }, [xOffset]);

    return {
        ref: setRef,
        style,
    };
}
