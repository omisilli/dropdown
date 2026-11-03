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
 *   data-pg-dropdown-y                  bottom | top — where it opens
 *   data-pg-dropdown-x                  start | end | center — how it lines up
 *   data-pg-dropdown-flip               move it when there is no room:
 *                                         (no value) or "x y"  both axes
 *                                         "y" · "x"            that axis only
 *                                         "none"               never, but placed
 *                                                              like a flip
 *   data-pg-dropdown-scroll-threshold   px the user must scroll to close it
 *
 * Search: put an <input data-pg-dropdown-search> in the body and mark the
 * options data-pg-dropdown-item. Options for it, on the container:
 *   data-pg-dropdown-search-case        insensitive (default) | sensitive
 *   data-pg-dropdown-search-accents     ignore (default) | keep
 *   data-pg-dropdown-search-locale      the language's case rules; default
 *                                       the page's lang
 * A button data-pg-dropdown-search-case-toggle flips case sensitivity, and
 * data-pg-dropdown-empty shows when nothing matches.
 *
 * React: JSX sets the starting value (data-pg-dropdown-active="false") and
 * must not change it afterwards — from then on this file owns it.
 */
const ROOT = "data-pg-dropdown";
const HEAD = "data-pg-dropdown-head";
const BODY = "data-pg-dropdown-body";
const ACTIVE = "data-pg-dropdown-active";
const X = "data-pg-dropdown-x";
const Y = "data-pg-dropdown-y";
const FLIP = "data-pg-dropdown-flip";
const SIDE = "data-pg-dropdown-side";
const ALIGN = "data-pg-dropdown-align";
const THRESHOLD = "data-pg-dropdown-scroll-threshold";
const SEARCH = "data-pg-dropdown-search";
const ITEM = "data-pg-dropdown-item";
const EMPTY = "data-pg-dropdown-empty";
const CASE = "data-pg-dropdown-search-case";
const ACCENTS = "data-pg-dropdown-search-accents";
const LOCALE = "data-pg-dropdown-search-locale";
const CASE_TOGGLE = "data-pg-dropdown-search-case-toggle";
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
        CSS.supports("position-area: bottom") &&
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
function searchOf(root) {
    return root.querySelector(`[${SEARCH}]`);
}
/* Letters that carry no accent mark to strip, but that a reader takes for
   a plain letter anyway: ignoring accents should make "ir" find "Irmak"
   and "olstad" find "Ølstad". */
const BASE_LETTERS = {
    ı: "i",
    ø: "o",
    Ø: "O",
    ł: "l",
    Ł: "L",
    đ: "d",
    Đ: "D",
    ß: "ss",
    æ: "ae",
    Æ: "AE",
    œ: "oe",
    Œ: "OE",
};
/* The language whose case rules apply. A container's
   data-pg-dropdown-search-locale wins; otherwise the nearest lang — the
   page's <html lang>, so a multilingual site needs nothing extra. */
function localeOf(root) {
    return root.getAttribute(LOCALE) || root.closest("[lang]")?.getAttribute("lang") || undefined;
}
/* An option's own language: a lang on the option, or on something between
   it and the container. Lists that mix languages mark each name this way. */
function itemLocaleOf(item, root) {
    const marked = item.closest("[lang]");
    return marked && root.contains(marked)
        ? marked.getAttribute("lang") || undefined
        : localeOf(root);
}
/* Lower case by a language's rules. Language tags use a hyphen (en-US);
   en_US, as some systems write it, is accepted too. A tag the browser does
   not know falls back to its default rules rather than stopping the search
   — toLocaleLowerCase throws on a malformed tag. */
function lowerCase(text, locale) {
    if (!locale)
        return text.toLocaleLowerCase();
    try {
        return text.toLocaleLowerCase(locale.replace(/_/g, "-"));
    }
    catch {
        return text.toLocaleLowerCase();
    }
}
/* Text as the search compares it. Case follows the language's own rules —
   in Turkish İ lowers to i and I to ı — so it is done before accents are
   stripped: "İ" splits into I plus a dot, which must not be lowered alone.
   With accents ignored, the Turkish and English results meet again (ı → i),
   which is why the default handles lists that mix languages. */
function foldText(text, root, locale) {
    let folded = text.normalize("NFC");
    if (root.getAttribute(CASE) !== "sensitive")
        folded = lowerCase(folded, locale);
    if (root.getAttribute(ACCENTS) !== "keep") {
        folded = folded
            .normalize("NFD")
            .replace(/\p{M}/gu, "")
            .replace(/[ıøØłŁđĐßæÆœŒ]/g, (letter) => BASE_LETTERS[letter]);
    }
    return folded;
}
/* Show the options that hold every word of the query, hide the rest. The
   query is read in the container's language, each option in its own. An
   option's own value, if it has one, is searched as well as its text — for
   short forms and other names. */
function filter(root) {
    const input = searchOf(root);
    if (!input)
        return;
    const words = foldText(input.value, root, localeOf(root)).split(/\s+/).filter(Boolean);
    let shown = 0;
    root.querySelectorAll(`[${ITEM}]`).forEach((item) => {
        const text = foldText(`${item.getAttribute(ITEM) ?? ""} ${item.textContent ?? ""}`, root, itemLocaleOf(item, root));
        const match = words.every((word) => text.includes(word));
        item.hidden = !match;
        if (match)
            shown++;
    });
    root.querySelectorAll(`[${EMPTY}]`).forEach((empty) => {
        empty.hidden = shown > 0;
    });
}
/* aria-pressed on the Aa button says whether case now counts. */
function syncCaseToggle(root) {
    const sensitive = root.getAttribute(CASE) === "sensitive";
    root.querySelectorAll(`[${CASE_TOGGLE}]`).forEach((button) => {
        button.setAttribute("aria-pressed", String(sensitive));
    });
}
function isOpen(root) {
    return root.getAttribute(ACTIVE) === "true";
}
function floats(root) {
    return root.hasAttribute(FLIP) && canFloat();
}
/* The container's wishes. A centred body never flips sideways — there is
   no other side — it is pushed back on screen instead. */
function placementOf(root) {
    const y = root.getAttribute(Y) === "top" ? "top" : "bottom";
    const xAttr = root.getAttribute(X);
    const x = xAttr === "end" || xAttr === "center" ? xAttr : "start";
    const flip = (root.getAttribute(FLIP) ?? "").trim().split(/\s+/).filter(Boolean);
    const both = flip.length === 0;
    return {
        y,
        x,
        flipX: (both || flip.includes("x")) && x !== "center",
        flipY: both || flip.includes("y"),
    };
}
/* Where the body ended up, for themes that point an arrow or a shadow. */
function recordSide(root, head, body) {
    const h = head.getBoundingClientRect();
    const b = body.getBoundingClientRect();
    root.setAttribute(SIDE, b.top >= h.top ? "bottom" : "top");
    root.setAttribute(ALIGN, placementOf(root).x === "center"
        ? "center"
        : Math.abs(b.left - h.left) <= Math.abs(b.right - h.right)
            ? "start"
            : "end");
}
/* Lengths from index.css. Registered with @property, so the browser has
   already turned 1rem, a media query's value or calc() into pixels. */
function lengthOf(css, name) {
    return parseFloat(css.getPropertyValue(name)) || 0;
}
/* The inline styles placeFixed writes, and the ones that switch the
   browser's own placement off for a body it could not fit. */
const MEASURED = [
    "top",
    "bottom",
    "left",
    "right",
    "margin-top",
    "margin-bottom",
    "margin-left",
    "margin-right",
    "max-height",
    "position-area",
    "position-try-fallbacks",
    "justify-self",
];
function clearMeasured(body) {
    for (const property of MEASURED)
        body.style.removeProperty(property);
}
/* Does the body stay --pg-dropdown-edge inside the screen? Half a pixel of
   slack for sub-pixel layout. */
function fitsScreen(body) {
    const edge = lengthOf(getComputedStyle(body), "--pg-dropdown-edge") - 0.5;
    const b = body.getBoundingClientRect();
    return (b.top >= edge &&
        b.left >= edge &&
        b.bottom <= innerHeight - edge &&
        b.right <= innerWidth - edge);
}
/* placeFixed — measure, honour the wishes, turn on the allowed axes when
   there is no room, write fixed coordinates. Two callers:
     - browsers without anchor positioning, for every opening;
     - any browser, when the body fits on neither side: CSS cannot both keep
       the preferred side and shrink only when nothing fits.
   Stays --pg-dropdown-edge inside the screen. When the body is taller than
   the room, it goes to the side with more room and its height is capped —
   the list scrolls inside. Nothing is scaled down. */
function placeFixed(root, head, body) {
    clearMeasured(body);
    const s = body.style;
    // The browser's own placement off, so these coordinates are the only ones.
    s.setProperty("position-area", "none");
    s.setProperty("position-try-fallbacks", "none");
    s.setProperty("justify-self", "auto");
    const { x, y, flipX, flipY } = placementOf(root);
    const css = getComputedStyle(body);
    const edge = lengthOf(css, "--pg-dropdown-edge");
    const gap = parseFloat(y === "top" ? css.marginBottom : css.marginTop) || 0;
    const h = head.getBoundingClientRect();
    const height = body.offsetHeight;
    const width = Math.min(body.offsetWidth, innerWidth - 2 * edge);
    // Vertical: the preferred side, the other one if allowed and roomier.
    const roomBelow = innerHeight - h.bottom - gap - edge;
    const roomAbove = h.top - gap - edge;
    let up = y === "top";
    if (flipY && height > (up ? roomAbove : roomBelow)) {
        if ((up ? roomBelow : roomAbove) > (up ? roomAbove : roomBelow))
            up = !up;
    }
    const room = Math.max(0, up ? roomAbove : roomBelow);
    if (height > room)
        s.maxHeight = `${room}px`;
    s.marginTop = up ? "0" : `${gap}px`;
    s.marginBottom = up ? `${gap}px` : "0";
    if (up)
        s.bottom = `${innerHeight - h.top}px`;
    else
        s.top = `${h.bottom}px`;
    // Horizontal: lined up as asked, flipped if allowed, then pushed back on
    // screen if it still sticks out. Margins off — the edge is counted here.
    s.marginLeft = s.marginRight = "0";
    const clamp = (left) => Math.min(Math.max(edge, left), innerWidth - edge - width);
    let align = x;
    let left;
    if (x === "center") {
        left = clamp(h.left + h.width / 2 - width / 2);
    }
    else {
        const startLeft = h.left;
        const endLeft = h.right - width;
        // How far a left position would stick out past the edges.
        const overflow = (l) => Math.max(0, edge - l) + Math.max(0, l + width - (innerWidth - edge));
        const asked = align === "end" ? endLeft : startLeft;
        const other = align === "end" ? startLeft : endLeft;
        // Flip when the other side sticks out less — not only when it fits
        // outright: a head inside the edge zone fits neither way, and the
        // body should still lean the way it overflows least.
        if (flipX && overflow(asked) > 0 && overflow(other) < overflow(asked)) {
            align = align === "end" ? "start" : "end";
        }
        left = clamp(align === "end" ? endLeft : startLeft);
    }
    s.left = `${left}px`;
    root.setAttribute(SIDE, up ? "top" : "bottom");
    root.setAttribute(ALIGN, align);
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
    /* Bodies the browser could not fit, placed by measuring this time. */
    const measured = new WeakSet();
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
            // The browser placed it. If it still does not fit — too tall
            // for either side, too wide — measure it instead, this time.
            requestAnimationFrame(() => {
                if (fitsScreen(body))
                    recordSide(root, head, body);
                else {
                    measured.add(body);
                    placeFixed(root, head, body);
                }
            });
        }
        else {
            body.showPopover();
            placeFixed(root, head, body);
        }
    };
    const sink = (root) => {
        const body = bodyOf(root);
        if (!body?.hasAttribute("popover"))
            return;
        if (body.matches(":popover-open"))
            body.hidePopover();
        // Next opening starts over: the browser places it again if it can.
        if (canAnchor())
            clearMeasured(body);
        measured.delete(body);
    };
    const setOpen = (root, open) => {
        if (isOpen(root) === open)
            return;
        root.setAttribute(ACTIVE, String(open));
        const head = headOf(root);
        head?.setAttribute("aria-expanded", String(open));
        const input = searchOf(root);
        if (open) {
            opened = { root, y: scrollY, userScrolled: false };
            syncCaseToggle(root);
            float(root);
            // A searchable list opens ready to type into. A frame later: the
            // press that opened it would otherwise hand focus straight back to
            // the head (focusing on mousedown is the browser's default).
            if (input)
                requestAnimationFrame(() => input.focus({ preventScroll: true }));
            return;
        }
        if (opened?.root === root)
            opened = null;
        sink(root);
        // The next opening starts with the whole list.
        if (input && input.value) {
            input.value = "";
            filter(root);
        }
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
        // The Aa button: flip case sensitivity, filter again, and hand focus
        // back to the search field so typing carries on.
        if (target?.closest(`[${CASE_TOGGLE}]`)) {
            const sensitive = root.getAttribute(CASE) === "sensitive";
            root.setAttribute(CASE, sensitive ? "insensitive" : "sensitive");
            syncCaseToggle(root);
            filter(root);
            searchOf(root)?.focus({ preventScroll: true });
            return;
        }
        // Something chosen in the body: close. Matters for client-side
        // navigation, where the page does not reload behind the link.
        if (target?.closest(`[${BODY}] a[href], [${BODY}] button`))
            setOpen(root, false);
    };
    /* Typing in the search field. The event lets an app fetch results of
       its own for the same query; dropdown only filters what is on the page. */
    const onInput = (event) => {
        if (live !== self)
            return;
        const input = event.target?.closest(`[${SEARCH}]`);
        const root = input?.closest(`[${ROOT}]`);
        if (!input || !root)
            return;
        filter(root);
        root.dispatchEvent(new CustomEvent("pg-dropdown-search", {
            bubbles: true,
            detail: { query: input.value },
        }));
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
        if (!opened || !floats(opened.root))
            return;
        const head = headOf(opened.root);
        const body = bodyOf(opened.root);
        if (head && body && (!canAnchor() || measured.has(body))) {
            placeFixed(opened.root, head, body);
        }
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
    document.addEventListener("input", onInput);
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
        document.removeEventListener("input", onInput);
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onResize);
        if (live === self)
            live = null;
    };
}
