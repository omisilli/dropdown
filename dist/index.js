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
 * the body, Escape, focus leaving it, and a scroll the user starts. One open
 * at a time. It does not lock the page — the old lock, the close-on-scroll
 * and the close-on-wheel fought each other and needed a 300ms guard.
 *
 * Options on the container:
 *   data-pg-dropdown-flip               open where there is room (see float)
 *   data-pg-dropdown-scroll-threshold   px the user must scroll to close it
 *
 * React: JSX sets the starting value (data-pg-dropdown-active="false") and
 * must not change it afterwards — from then on this file owns it.
 */
const ROOT = "data-pg-dropdown";
const HEAD = "data-pg-dropdown-head";
const BODY = "data-pg-dropdown-body";
const ACTIVE = "data-pg-dropdown-active";
const FLIP = "data-pg-dropdown-flip";
const SIDE = "data-pg-dropdown-side";
const ALIGN = "data-pg-dropdown-align";
const THRESHOLD = "data-pg-dropdown-scroll-threshold";
/* Keys that scroll the page — unless focus is in a field or on a control,
   where they type or press instead. */
const SCROLL_KEYS = new Set(["PageDown", "PageUp", "Home", "End", "ArrowDown", "ArrowUp", " "]);
const CONTROLS = "input, textarea, select, button, [contenteditable]";
/* Flipping lifts the body into the top layer as a popover, so no ancestor
   can clip it (overflow: hidden) or trap it (transform, backdrop-filter).
   Without the Popover API the body stays where it is and does not flip. */
function canFloat() {
    return typeof HTMLElement !== "undefined" && "showPopover" in HTMLElement.prototype;
}
/* With anchor positioning the browser places and flips the body itself.
   Without it, placeFixed() does the same by measuring. Once every browser
   in use has it, delete placeFixed() and the calls marked with it. */
function canAnchor() {
    return (typeof CSS !== "undefined" &&
        CSS.supports("anchor-name: --a") &&
        CSS.supports("position-try-fallbacks: flip-block"));
}
function rootsOf() {
    return Array.from(document.querySelectorAll(`[${ROOT}]`));
}
function headOf(root) {
    return root.querySelector(`[${HEAD}]`);
}
function bodyOf(root) {
    return root.querySelector(`[${BODY}]`);
}
function isOpen(root) {
    return root.getAttribute(ACTIVE) === "true";
}
function floats(root) {
    return root.hasAttribute(FLIP) && canFloat();
}
/* Where the body ended up, for themes that point an arrow or a shadow. */
function recordSide(root, head, body) {
    const h = head.getBoundingClientRect();
    const b = body.getBoundingClientRect();
    root.setAttribute(SIDE, b.top >= h.top ? "bottom" : "top");
    root.setAttribute(ALIGN, Math.abs(b.left - h.left) <= Math.abs(b.right - h.right) ? "start" : "end");
}
/* placeFixed — fallback for browsers without anchor positioning: measure,
   pick the side with room, write fixed coordinates. Margins swap with the
   side, as the browser's own flip-block / flip-inline would do. */
function placeFixed(root, head, body) {
    const s = body.style;
    s.top = s.bottom = s.left = s.right = s.margin = "";
    const css = getComputedStyle(body);
    const h = head.getBoundingClientRect();
    const height = body.offsetHeight + parseFloat(css.marginTop);
    const width = body.offsetWidth + parseFloat(css.marginLeft);
    const roomBelow = innerHeight - h.bottom;
    const up = height > roomBelow && h.top > roomBelow;
    const end = h.left + width > innerWidth && h.right - width >= 0;
    if (up) {
        s.bottom = `${innerHeight - h.top}px`;
        s.marginBottom = css.marginTop;
        s.marginTop = "0";
    }
    else {
        s.top = `${h.bottom}px`;
    }
    if (end) {
        s.right = `${innerWidth - h.right}px`;
        s.marginRight = css.marginLeft;
        s.marginLeft = "0";
    }
    else {
        s.left = `${h.left}px`;
    }
    root.setAttribute(SIDE, up ? "top" : "bottom");
    root.setAttribute(ALIGN, end ? "end" : "start");
}
let anchors = 0;
/* Only the newest call answers events — a late cleanup from an older one
   (React remounting) cannot switch it off. Same rule as targetFunctions. */
let live = null;
/* Start listening; returns the cleanup for a React effect. */
export function initDropdown() {
    if (typeof document === "undefined")
        return () => { };
    const self = {};
    live = self;
    /* The open dropdown, where the page was when it opened, and whether the
       user has started a scroll since. Only a scroll the user started closes
       it: momentum still running from before (a smooth-scroll library, a
       phone's fling), the address bar folding away, or the browser scrolling
       a focused link into view do not. The old code tried a 300ms guard. */
    let opened = null;
    const float = (root) => {
        const head = headOf(root);
        const body = bodyOf(root);
        if (!head || !body || !floats(root))
            return;
        body.setAttribute("popover", "manual");
        if (canAnchor()) {
            // Each head gets its own anchor name, so several dropdowns on a
            // page never anchor to each other's heads.
            const name = head.style.getPropertyValue("anchor-name") || `--pg-dropdown-${++anchors}`;
            head.style.setProperty("anchor-name", name);
            body.style.setProperty("position-anchor", name);
            body.showPopover();
            requestAnimationFrame(() => recordSide(root, head, body));
        }
        else {
            body.showPopover();
            placeFixed(root, head, body);
        }
    };
    const sink = (root) => {
        const body = bodyOf(root);
        if (body?.hasAttribute("popover") && body.matches(":popover-open"))
            body.hidePopover();
    };
    const setOpen = (root, open) => {
        if (isOpen(root) === open)
            return;
        root.setAttribute(ACTIVE, String(open));
        const head = headOf(root);
        head?.setAttribute("aria-expanded", String(open));
        if (open) {
            opened = { root, y: scrollY, userScrolled: false };
            float(root);
            return;
        }
        if (opened?.root === root)
            opened = null;
        sink(root);
        // Closing with focus inside the body: hand focus back to the head
        // rather than let it fall to <body>.
        if (head && root.contains(document.activeElement) && document.activeElement !== head) {
            head.focus({ preventScroll: true });
        }
    };
    const closeAll = (except) => {
        for (const root of rootsOf())
            if (root !== except)
                setOpen(root, false);
    };
    const toggle = (root) => {
        closeAll(root);
        setOpen(root, !isOpen(root));
    };
    /* pointerdown, not click — kept from the old code: during momentum
       scrolling the browser can drop the mousedown → mouseup → click chain,
       pointerdown fires as soon as the finger or button goes down. */
    const onPointerDown = (event) => {
        if (live !== self)
            return;
        const target = event.target;
        const root = target?.closest(`[${ROOT}]`) ?? null;
        if (root && target?.closest(`[${HEAD}]`)) {
            toggle(root);
            return;
        }
        // Inside a body — its scrollbar, the gap between links — stays open.
        // The old code closed here, so dragging the list's scrollbar shut it.
        closeAll(root);
    };
    const onClick = (event) => {
        if (live !== self)
            return;
        const target = event.target;
        const root = target?.closest(`[${ROOT}]`);
        if (!root)
            return;
        // A keyboard press on the head (Enter, Space) fires click with no
        // pointerdown before it; detail is 0 for those.
        if (event.detail === 0 && target?.closest(`[${HEAD}]`)) {
            toggle(root);
            return;
        }
        // Something chosen in the body: close. Matters for client-side
        // navigation, where the page does not reload behind the link.
        if (target?.closest(`[${BODY}] a[href], [${BODY}] button`))
            setOpen(root, false);
    };
    /* A scroll the user starts: wheel or finger outside the body, or a
       scrolling key outside a field or control. Inside the body it scrolls
       the list, not the page. */
    const markUserScroll = (target) => {
        if (!opened || bodyOf(opened.root)?.contains(target))
            return;
        opened.userScrolled = true;
    };
    const onWheel = (event) => {
        if (live === self)
            markUserScroll(event.target);
    };
    const onTouchMove = (event) => {
        if (live === self)
            markUserScroll(event.target);
    };
    const onKeydown = (event) => {
        if (live !== self)
            return;
        if (SCROLL_KEYS.has(event.key) && !event.target?.closest(CONTROLS)) {
            markUserScroll(event.target);
            return;
        }
        if (event.key !== "Escape")
            return;
        const open = rootsOf().find(isOpen);
        if (!open)
            return;
        event.preventDefault();
        setOpen(open, false);
        headOf(open)?.focus({ preventScroll: true });
    };
    /* Tabbing past the last link closes it, so a keyboard user does not
       leave an open list behind. */
    const onFocusOut = (event) => {
        if (live !== self)
            return;
        const root = event.target?.closest(`[${ROOT}]`);
        const next = event.relatedTarget;
        if (root && isOpen(root) && next && !root.contains(next))
            setOpen(root, false);
    };
    /* placeFixed: a measured body stays next to its head while the page
       still moves, and when the window is resized. Never closes on resize —
       phones resize when the address bar moves. */
    const replace = () => {
        if (!opened || !floats(opened.root) || canAnchor())
            return;
        const head = headOf(opened.root);
        const body = bodyOf(opened.root);
        if (head && body)
            placeFixed(opened.root, head, body);
    };
    /* The page scrolling closes it — like a native <select> — but only a
       scroll the user started, and only past the threshold (default 0).
       Scrolling the body's own list does not reach here: an element's scroll
       event does not bubble to window. */
    const onScroll = () => {
        if (live !== self || !opened)
            return;
        const { root, y, userScrolled } = opened;
        if (userScrolled) {
            const threshold = Number(root.getAttribute(THRESHOLD)) || 0;
            if (Math.abs(scrollY - y) > threshold) {
                setOpen(root, false);
                return;
            }
        }
        replace();
    };
    const onResize = () => {
        if (live === self)
            replace();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKeydown);
    document.addEventListener("focusout", onFocusOut);
    document.addEventListener("wheel", onWheel, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    // Markup that starts open (data-pg-dropdown-active="true").
    const startOpen = rootsOf().find(isOpen);
    if (startOpen) {
        opened = { root: startOpen, y: scrollY, userScrolled: false };
        float(startOpen);
    }
    return () => {
        document.removeEventListener("pointerdown", onPointerDown);
        document.removeEventListener("click", onClick);
        document.removeEventListener("keydown", onKeydown);
        document.removeEventListener("focusout", onFocusOut);
        document.removeEventListener("wheel", onWheel);
        document.removeEventListener("touchmove", onTouchMove);
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onResize);
        if (live === self)
            live = null;
    };
}
