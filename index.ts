/*
 * dropdown — a head that opens a body, from markup.
 *
 *   <div data-pg-dropdown data-pg-dropdown-active="false">
 *       <button data-pg-dropdown-head aria-expanded="false">English</button>
 *       <div data-pg-dropdown-body>…</div>
 *   </div>
 *
 * State lives in ONE attribute on the container,
 * data-pg-dropdown-active="true|false". The old code wrote qua-active on
 * the head and on the body separately; style both from the container now.
 *
 * Head and body are found inside the container. The old code took the
 * body as the head's next sibling, so anything placed between them broke it.
 *
 * Closes on: the head again, a press outside, a link or button chosen in
 * the body, Escape, focus leaving it, and the page scrolling. One open at
 * a time. It does not lock the page — the old lock, the close-on-scroll
 * and the close-on-wheel fought each other and needed a 300ms guard.
 *
 * React: JSX sets the starting value (data-pg-dropdown-active="false") and
 * must not change it afterwards — from then on this file owns it.
 */

const ROOT = "data-pg-dropdown";
const HEAD = "data-pg-dropdown-head";
const BODY = "data-pg-dropdown-body";
const ACTIVE = "data-pg-dropdown-active";

function rootsOf(): HTMLElement[] {
    return Array.from(document.querySelectorAll<HTMLElement>(`[${ROOT}]`));
}

function headOf(root: HTMLElement): HTMLElement | null {
    return root.querySelector<HTMLElement>(`[${HEAD}]`);
}

function isOpen(root: HTMLElement): boolean {
    return root.getAttribute(ACTIVE) === "true";
}

/* Only the newest call answers events — a late cleanup from an older one
   (React remounting) cannot switch it off. Same rule as targetFunctions. */
let live: object | null = null;

/* Start listening; returns the cleanup for a React effect. */
export function initDropdown(): () => void {
    if (typeof document === "undefined") return () => {};

    const self = {};
    live = self;

    const setOpen = (root: HTMLElement, open: boolean): void => {
        if (isOpen(root) === open) return;
        root.setAttribute(ACTIVE, String(open));

        const head = headOf(root);
        head?.setAttribute("aria-expanded", String(open));

        // Closing with focus inside the body: hand focus back to the head
        // rather than let it fall to <body>.
        if (
            !open &&
            head &&
            root.contains(document.activeElement) &&
            document.activeElement !== head
        ) {
            head.focus({ preventScroll: true });
        }
    };

    const closeAll = (except?: HTMLElement | null): void => {
        for (const root of rootsOf()) if (root !== except) setOpen(root, false);
    };

    const toggle = (root: HTMLElement): void => {
        closeAll(root);
        setOpen(root, !isOpen(root));
    };

    /* pointerdown, not click — kept from the old code: during momentum
       scrolling the browser can drop the mousedown → mouseup → click chain,
       pointerdown fires as soon as the finger or button goes down. */
    const onPointerDown = (event: PointerEvent): void => {
        if (live !== self) return;
        const target = event.target as Element | null;
        const root = target?.closest<HTMLElement>(`[${ROOT}]`) ?? null;

        if (root && target?.closest(`[${HEAD}]`)) {
            toggle(root);
            return;
        }

        // Inside a body — its scrollbar, the gap between links — stays open.
        // The old code closed here, so dragging the list's scrollbar shut it.
        closeAll(root);
    };

    const onClick = (event: MouseEvent): void => {
        if (live !== self) return;
        const target = event.target as Element | null;
        const root = target?.closest<HTMLElement>(`[${ROOT}]`);
        if (!root) return;

        // A keyboard press on the head (Enter, Space) fires click with no
        // pointerdown before it; detail is 0 for those.
        if (event.detail === 0 && target?.closest(`[${HEAD}]`)) {
            toggle(root);
            return;
        }

        // Something chosen in the body: close. Matters for client-side
        // navigation, where the page does not reload behind the link.
        if (target?.closest(`[${BODY}] a[href], [${BODY}] button`)) setOpen(root, false);
    };

    const onKeydown = (event: KeyboardEvent): void => {
        if (live !== self || event.key !== "Escape") return;
        const open = rootsOf().find(isOpen);
        if (!open) return;

        event.preventDefault();
        setOpen(open, false);
        headOf(open)?.focus({ preventScroll: true });
    };

    /* Tabbing past the last link closes it, so a keyboard user does not
       leave an open list behind. */
    const onFocusOut = (event: FocusEvent): void => {
        if (live !== self) return;
        const root = (event.target as Element | null)?.closest<HTMLElement>(`[${ROOT}]`);
        const next = event.relatedTarget as Node | null;
        if (root && isOpen(root) && next && !root.contains(next)) setOpen(root, false);
    };

    /* The page scrolling closes it — like a native <select>. Scrolling the
       body's own list does not reach here: an element's scroll event does
       not bubble to window.

       Except while focus is inside a body: tabbing to a link the list has
       not shown yet makes the browser scroll it into view, which can nudge
       the page a few pixels — that is not the user scrolling away. */
    const onScroll = (): void => {
        if (live !== self) return;
        if (document.activeElement?.closest(`[${BODY}]`)) return;
        closeAll();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKeydown);
    document.addEventListener("focusout", onFocusOut);
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
        document.removeEventListener("pointerdown", onPointerDown);
        document.removeEventListener("click", onClick);
        document.removeEventListener("keydown", onKeydown);
        document.removeEventListener("focusout", onFocusOut);
        window.removeEventListener("scroll", onScroll);
        if (live === self) live = null;
    };
}
