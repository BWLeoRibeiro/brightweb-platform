"use client";

import { useEffect, useId, useRef, useState, type InputHTMLAttributes, type KeyboardEvent } from "react";
import { defaultCountries, parseCountry, usePhoneInput } from "react-international-phone";
import type { CountryIso2 } from "react-international-phone";

import { cn } from "../lib/utils";

interface PhoneInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "defaultValue" | "onChange" | "type" | "value"> {
  value: string;
  onChange: (e164: string) => void;
  defaultCountry?: CountryIso2;
  className?: string;
}

const PREFERRED_COUNTRIES: CountryIso2[] = ["pt", "es", "gb", "fr", "de", "br", "us"];
const allCountries = defaultCountries.map((country) => parseCountry(country));
const preferredCountries = PREFERRED_COUNTRIES.map((iso) => allCountries.find((country) => country.iso2 === iso)).filter(Boolean);
const remainingCountries = allCountries.filter((country) => !PREFERRED_COUNTRIES.includes(country.iso2));
const orderedCountries = [...preferredCountries, ...remainingCountries] as ReturnType<typeof parseCountry>[];

function flagEmoji(iso2: string) {
  return iso2.toUpperCase().split("").map((character) => String.fromCodePoint(0x1f1e6 - 0x41 + character.charCodeAt(0))).join("");
}

export function PhoneInput({ value, onChange, defaultCountry = "pt", disabled = false, className, placeholder = "912 345 678", ...inputProps }: PhoneInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const countryListId = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const { inputValue, handlePhoneValueChange, country, setCountry } = usePhoneInput({
    defaultCountry,
    value,
    forceDialCode: true,
    onChange: ({ phone }) => onChange(phone),
    inputRef,
  });

  useEffect(() => {
    if (!open) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node) && !triggerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [open]);

  useEffect(() => {
    if (open) optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const filteredCountries = search
    ? orderedCountries.filter((candidate) => candidate.name.toLowerCase().includes(search.toLowerCase()) || `+${candidate.dialCode}`.includes(search))
    : orderedCountries;

  const closePicker = (restoreFocus = false) => {
    setOpen(false);
    setSearch("");
    if (restoreFocus) triggerRef.current?.focus();
  };

  const openPicker = (direction: "first" | "last" | "selected" = "selected") => {
    const selectedIndex = orderedCountries.findIndex((candidate) => candidate.iso2 === country.iso2);
    setSearch("");
    setActiveIndex(direction === "first" ? 0 : direction === "last" ? orderedCountries.length - 1 : Math.max(0, selectedIndex));
    setOpen(true);
  };

  const selectCountry = (index: number) => {
    const candidate = filteredCountries[index];
    if (!candidate) return;
    setCountry(candidate.iso2);
    setOpen(false);
    setSearch("");
    inputRef.current?.focus();
  };

  const handlePickerKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closePicker(true);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) => filteredCountries.length === 0
        ? 0
        : (current + direction + filteredCountries.length) % filteredCountries.length);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      selectCountry(activeIndex);
    }
  };

  return (
    <div className={cn("relative flex items-center", className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => open ? closePicker() : openPicker()}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            openPicker(event.key === "ArrowDown" ? "first" : "last");
          } else if (event.key === "Escape" && open) {
            event.preventDefault();
            closePicker(true);
          }
        }}
        className="flex h-7 items-center gap-1 border-0 bg-transparent pr-1.5 text-sm disabled:pointer-events-none disabled:opacity-100"
        aria-controls={countryListId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Choose country code"
      >
        <span className="text-base leading-none">{flagEmoji(country.iso2)}</span>
        <svg className="size-2.5 text-foreground/40" viewBox="0 0 10 6" fill="none" aria-hidden>
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <div ref={dropdownRef} className="absolute left-0 top-full z-50 mt-1.5 w-56 rounded-[var(--radius-card)] border border-[color:var(--hairline-strong)] bg-popover text-popover-foreground shadow-[var(--shadow-phone-dropdown)]">
          <div className="border-b border-[color:var(--hairline)] px-2.5 py-2">
            <input
              autoFocus
              role="combobox"
              aria-autocomplete="list"
              aria-controls={countryListId}
              aria-expanded="true"
              aria-label="Search countries"
              aria-activedescendant={filteredCountries[activeIndex] ? `${countryListId}-${filteredCountries[activeIndex].iso2}` : undefined}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handlePickerKeyDown}
              placeholder="Search…"
              className="w-full border-0 bg-transparent text-ui-meta text-foreground outline-none placeholder:text-foreground-muted-accessible"
            />
          </div>
          <div id={countryListId} role="listbox" aria-label="Country calling codes" className="max-h-48 overflow-y-auto rounded-b-[var(--radius-card)] p-1">
            {filteredCountries.map((candidate, index) => (
              <button
                key={candidate.iso2}
                id={`${countryListId}-${candidate.iso2}`}
                ref={(node) => { optionRefs.current[index] = node; }}
                type="button"
                role="option"
                aria-selected={country.iso2 === candidate.iso2}
                tabIndex={-1}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectCountry(index)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-[var(--radius)] px-2 py-1 text-left transition-colors hover:bg-[color:var(--elevate-2)]",
                  (country.iso2 === candidate.iso2 || activeIndex === index) && "bg-[color:var(--elevate-3)] text-[color:var(--brand-accent)]",
                )}
              >
                <span className="text-sm leading-none">{flagEmoji(candidate.iso2)}</span>
                <span className="flex-1 truncate text-ui-label normal-case tracking-normal text-foreground">{candidate.name}</span>
                <span className="shrink-0 text-ui-micro text-foreground-muted-accessible">+{candidate.dialCode}</span>
              </button>
            ))}
            {filteredCountries.length === 0 ? <p className="px-2 py-2 text-ui-meta text-foreground-muted-accessible">No results</p> : null}
          </div>
        </div>
      ) : null}

      <span className="h-4 w-px shrink-0 bg-foreground/15" />
      <input {...inputProps} ref={inputRef} value={inputValue} onChange={handlePhoneValueChange} disabled={disabled} placeholder={placeholder} type="tel" className="h-7 flex-1 border-0 bg-transparent pl-2 text-sm text-foreground outline-none placeholder:text-foreground-muted-accessible disabled:pointer-events-none disabled:opacity-100" />
    </div>
  );
}

export type { PhoneInputProps };
