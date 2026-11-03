# dropdown

A head that opens a body — straight from markup. One script, one
stylesheet, no dependencies, framework-agnostic.

```html
<div data-pg-dropdown data-pg-dropdown-active="false">
    <button data-pg-dropdown-head aria-expanded="false">English</button>
    <div data-pg-dropdown-body>
        <a href="/tr">Türkçe</a>
        <a href="/de">Deutsch</a>
    </div>
</div>
```

```sh
npm install github:omisilli/dropdown#v1.2.0
```

```ts
import { initDropdown } from "@plusguard/dropdown";
import "@plusguard/dropdown/index.css";

initDropdown();
```

Or from CSS, which lets you pick the cascade layer:

```css
@import "@plusguard/dropdown/index.css" layer(components);
```

### Without a build step

Load both halves straight from jsDelivr — no install, and the page works
when opened by double-clicking:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/omisilli/dropdown@v1.2.0/index.css" />

<script type="module">
    import { initDropdown } from "https://cdn.jsdelivr.net/gh/omisilli/dropdown@v1.2.0/dist/index.js";

    initDropdown();
</script>
```

Pin the version (`@v1.2.0`) on a live site. A pinned URL never changes;
`@1` follows the newest 1.x release.

## Files

| File              | For                                                              |
| ----------------- | ---------------------------------------------------------------- |
| `index.ts`        | TypeScript source — import it directly in a TS / bundler project |
| `index.css`       | The CSS half: where the body sits, when it shows, how it scrolls |
| `dist/index.js`   | Compiled ES module — plain HTML, no build step                   |
| `dist/index.d.ts` | Types for `dist/index.js`                                        |

Importing `dist/index.js` from your own files? Serve the page over HTTP —
browsers block module imports on `file://`.

`dist/` is committed. After editing `index.ts`, rebuild it:

```sh
npx -p typescript tsc index.ts --outDir dist --declaration --target es2020 --module es2020 --lib dom,es2020 --strict
```

## Attributes

| Attribute                 | On        | Meaning                                                |
| ------------------------- | --------- | ------------------------------------------------------ |
| `data-pg-dropdown`        | container | Holds one head and one body, in any order or depth     |
| `data-pg-dropdown-head`   | head      | Opens and closes the body. Use a `<button>`            |
| `data-pg-dropdown-body`   | body      | What opens                                             |
| `data-pg-dropdown-active` | container | `"true"` or `"false"` — the state, written by dropdown |

Options, on the container:

| Attribute                           | Values                      | Meaning                                                    |
| ----------------------------------- | --------------------------- | ---------------------------------------------------------- |
| `data-pg-dropdown-y`                | `bottom` · `top`            | Where it opens. Default `bottom`                           |
| `data-pg-dropdown-x`                | `start` · `end` · `center`  | How it lines up with the head. Default `start`             |
| `data-pg-dropdown-flip`             | (none) · `x` · `y` · `none` | Move it when there is no room — see [Flipping](#flipping)  |
| `data-pg-dropdown-scroll-threshold` | pixels                      | How far the user must scroll before it closes. Default `0` |

Written by dropdown when it flips, for themes that point an arrow or a
shadow:

| Attribute                | Values                     |
| ------------------------ | -------------------------- |
| `data-pg-dropdown-side`  | `bottom` · `top`           |
| `data-pg-dropdown-align` | `start` · `end` · `center` |

Every attribute starts with `data-pg-dropdown`, so none of them can collide
with another library's names.

Style the open state from the container — head and body both:

```css
[data-pg-dropdown-active="true"] [data-pg-dropdown-head] {
    background: #eee;
}
```

With Tailwind, put `group` on the container:
`group-data-[pg-dropdown-active=true]:bg-neutral-100`.

## Behaviour

It opens on a press of the head, and closes on:

- the head again
- a press anywhere outside it
- a link or button chosen inside the body
- **Escape** — focus goes back to the head
- **focus leaving it** — tabbing past the last link
- **a scroll the user starts**, like a native `<select>` — past
  `data-pg-dropdown-scroll-threshold` pixels if set

One is open at a time: opening another closes the first. Pressing inside
the body — its scrollbar, the space between links — keeps it open.

It does not lock the page. Scrolling the body's own list does not close it
or move the page (`overscroll-behavior: contain` in `index.css`).

Only a scroll the **user** starts closes it — a wheel or a finger outside
the body, or a scrolling key (Page Down, arrows, space) outside a field.
The page moving on its own does not: momentum still running from before
(a phone's fling, a smooth-scrolling library), the address bar folding
away on a phone, or the browser scrolling a focused link into view.

It reacts to `pointerdown`, not `click`: during momentum scrolling a
browser can drop the click, while `pointerdown` fires the moment the
pointer goes down. Keyboard presses on the head (Enter, Space) arrive as a
click and are handled too.

## Placing

`data-pg-dropdown-y` and `data-pg-dropdown-x` say where the body goes: below
or above the head, and lined up with its start, its end or its centre.

```html
<!-- above the head, lined up with its right edge -->
<div
    data-pg-dropdown
    data-pg-dropdown-active="false"
    data-pg-dropdown-y="top"
    data-pg-dropdown-x="end"
></div>
```

For the gap between head and body, set `--pg-dropdown-offset` on the body.
It lands on the side facing the head, whichever way the body opens:

```css
[data-pg-dropdown-body] {
    --pg-dropdown-offset: 0.5rem;
}
```

A plain `margin-top` still works for a body that only ever opens downwards.

## Flipping

`data-pg-dropdown-flip` moves the body when there is no room where it was
asked to go.

| Value      | Moves it                                               |
| ---------- | ------------------------------------------------------ |
| (no value) | On both axes: up or down, left or right                |
| `y`        | Only up or down — its `x` stays as it is               |
| `x`        | Only left or right — its `y` stays as it is            |
| `none`     | Never — but it still floats above everything, as below |

A centred body (`data-pg-dropdown-x="center"`) is never flipped sideways —
there is no other side. At the edge of the screen it is pushed back on
instead.

```html
<!-- centred under the head, flipped only up or down -->
<div
    data-pg-dropdown
    data-pg-dropdown-active="false"
    data-pg-dropdown-flip="y"
    data-pg-dropdown-x="center"
></div>
```

The body becomes a popover in the browser's top layer, placed against the
viewport. No parent can clip it (`overflow: hidden`) or trap it
(`transform`, `backdrop-filter` — a blurred sticky header, for one).

- **Where the browser has CSS anchor positioning** (Chrome and Edge 125,
  Safari 26, Firefox 147), it places and flips the body itself.
- **Elsewhere** dropdown measures the room on opening, places the body with
  fixed coordinates, and keeps it next to its head if the page moves.
- **Without the Popover API** (browsers before 2024) the body stays where it
  is and opens downwards, as without the attribute.

The gap (`--pg-dropdown-offset`) flips with the body.

`data-pg-dropdown-side` and `data-pg-dropdown-align` report where it went.

## CSS

`index.css` only places and shows the body: `position: absolute` below the
head, hidden unless the container is active, its own scroll. Colours,
borders, fonts and the exact offset are yours — set a `max-height` on the
body to make a long list scroll.

With a smooth-scrolling library that hijacks the wheel (Lenis), mark the
body so the library leaves it alone — for Lenis, `data-lenis-prevent`.

## Accessibility

- The head is a `<button>`: it takes focus and opens with Enter or Space.
- **`aria-expanded`** on the head is kept in sync. Write the starting
  `aria-expanded="false"` in your markup.
- **Escape** closes it and returns focus to the head. Closing with focus
  inside the body also returns focus to the head.

This is a disclosure — a button that shows a list of links — not an ARIA
menu: arrow keys are not handled, Tab moves through the links.

## React

Call `initDropdown` once, in an effect — it returns its own cleanup:

```tsx
useEffect(() => initDropdown(), []);
```

JSX sets the starting value (`data-pg-dropdown-active="false"`) and must not
change it afterwards; from then on dropdown owns it. One listener on
`document` handles every dropdown, including ones rendered later. If
`initDropdown` is called again before the first cleanup runs (React
remounting in development), only the newest call answers.

See [`examples/react/Example.tsx`](examples/react/Example.tsx). A plain HTML
version is in [`examples/static/index.html`](examples/static/index.html).
