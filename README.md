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
npm install github:omisilli/dropdown#v1.0.0
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
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/omisilli/dropdown@v1.0.0/index.css" />

<script type="module">
    import { initDropdown } from "https://cdn.jsdelivr.net/gh/omisilli/dropdown@v1.0.0/dist/index.js";

    initDropdown();
</script>
```

Pin the version (`@v1.0.0`) on a live site. A pinned URL never changes;
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
- **the page scrolling**, like a native `<select>`

One is open at a time: opening another closes the first. Pressing inside
the body — its scrollbar, the space between links — keeps it open.

It does not lock the page. Scrolling the body's own list does not close it
or move the page (`overscroll-behavior: contain` in `index.css`).

It reacts to `pointerdown`, not `click`: during momentum scrolling a
browser can drop the click, while `pointerdown` fires the moment the
pointer goes down. Keyboard presses on the head (Enter, Space) arrive as a
click and are handled too.

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
