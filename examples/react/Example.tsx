"use client";

import { useEffect } from "react";
import { initDropdown } from "@plusguard/dropdown";
import "@plusguard/dropdown/index.css";

/* Mount once, high in the tree. Dropdowns rendered later are handled too. */
export function Dropdowns() {
    useEffect(() => initDropdown(), []);
    return null;
}

/* A language switcher. Tailwind styles the open state through `group`. */
export function Example() {
    const languages = ["English", "Türkçe", "Deutsch"];

    return (
        <>
            <Dropdowns />

            {/* Centred under the head, flipped only up or down, kept 12px from the
                screen's edges on phones and 24px from md up. Closes after 40px of the
                user's own scrolling. */}
            <div
                data-pg-dropdown
                data-pg-dropdown-active="false"
                data-pg-dropdown-flip="y"
                data-pg-dropdown-x="center"
                data-pg-dropdown-scroll-threshold={40}
                className="group [--pg-dropdown-edge:12px] md:[--pg-dropdown-edge:24px]"
            >
                <button
                    type="button"
                    data-pg-dropdown-head
                    aria-expanded="false"
                    className="rounded border px-3 py-1.5 group-data-[pg-dropdown-active=true]:bg-neutral-100"
                >
                    Language
                </button>
                <div
                    data-pg-dropdown-body
                    className="max-h-60 rounded border bg-white shadow [--pg-dropdown-offset:0.25rem]"
                >
                    {languages.map((language) => (
                        <a key={language} href="#" className="block px-3 py-2 hover:bg-neutral-100">
                            {language}
                        </a>
                    ))}
                </div>
            </div>
        </>
    );
}

/* Searchable: the field filters the options already on the page. To fetch
   results instead, listen for "pg-dropdown-search" on the container and
   render what comes back as data-pg-dropdown-item options. */
export function SearchExample() {
    const people = ["İlknur Işık", "Irmak Çelik", "Jürgen Müller", "Ingrid Ølstad"];

    return (
        <div
            data-pg-dropdown
            data-pg-dropdown-active="false"
            data-pg-dropdown-flip="y"
            className="group"
        >
            <button
                type="button"
                data-pg-dropdown-head
                aria-expanded="false"
                className="rounded border px-3 py-1.5"
            >
                People
            </button>
            <div
                data-pg-dropdown-body
                className="max-h-72 w-64 rounded border bg-white shadow [--pg-dropdown-offset:0.25rem]"
            >
                <div className="sticky top-0 flex gap-1 border-b bg-white p-2">
                    <input
                        type="search"
                        data-pg-dropdown-search
                        placeholder="Search…"
                        className="min-w-0 flex-1 rounded border px-2 py-1"
                    />
                    <button
                        type="button"
                        data-pg-dropdown-search-case-toggle
                        aria-pressed="false"
                        className="rounded border px-2 aria-pressed:bg-black aria-pressed:text-white"
                    >
                        Aa
                    </button>
                </div>
                {people.map((person) => (
                    <a
                        key={person}
                        href="#"
                        data-pg-dropdown-item
                        className="block px-3 py-2 hover:bg-neutral-100"
                    >
                        {person}
                    </a>
                ))}
                <p data-pg-dropdown-empty hidden className="px-3 py-2 text-neutral-500">
                    No one matches.
                </p>
            </div>
        </div>
    );
}
