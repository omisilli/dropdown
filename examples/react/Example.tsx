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

            {/* data-pg-dropdown-flip: opens upwards or leftwards when there is no room. */}
            <div
                data-pg-dropdown
                data-pg-dropdown-active="false"
                data-pg-dropdown-flip
                data-pg-dropdown-scroll-threshold={40}
                className="group"
            >
                <button
                    type="button"
                    data-pg-dropdown-head
                    aria-expanded="false"
                    className="rounded border px-3 py-1.5 group-data-[pg-dropdown-active=true]:bg-neutral-100"
                >
                    Language
                </button>
                <div data-pg-dropdown-body className="mt-1 max-h-60 rounded border bg-white shadow">
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
