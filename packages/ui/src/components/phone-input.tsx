"use client";

import { useEffect, useRef, useState } from "react";
import { defaultCountries, parseCountry, usePhoneInput } from "react-international-phone";
import type { CountryIso2 } from "react-international-phone";

import { cn } from "../lib/utils";

interface PhoneInputProps {
  value: string;
  onChange: (e164: string) => void;
  onBlur?: () => void;
  defaultCountry?: CountryIso2;
  disabled?: boolean;
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

export function PhoneInput({ value, onChange, onBlur, defaultCountry = "pt", disabled = false, className }: PhoneInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

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

  const filteredCountries = search
    ? orderedCountries.filter((candidate) => candidate.name.toLowerCase().includes(search.toLowerCase()) || `+${candidate.dialCode}`.includes(search))
    : orderedCountries;

  return (
    <div className={cn("relative flex items-center", className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className="flex h-7 items-center gap-1 border-0 bg-transparent pr-1.5 text-sm disabled:pointer-events-none disabled:opacity-100"
        aria-expanded={open}
        aria-label="Choose country code"
      >
        <span className="text-base leading-none">{flagEmoji(country.iso2)}</span>
        <svg className="size-2.5 text-foreground/40" viewBox="0 0 10 6" fill="none" aria-hidden>
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <div ref={dropdownRef} className="absolute left-0 top-full z-50 mt-1.5 w-56 rounded-[var(--radius-card)] border border-[color:var(--hairline-strong)] bg-popover text-popover-foreground shadow-[0_12px_28px_var(--elevate-3)]">
          <div className="border-b border-[color:var(--hairline)] px-2.5 py-2">
            <input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search…" className="w-full border-0 bg-transparent text-ui-meta text-foreground outline-none placeholder:text-foreground/40" />
          </div>
          <div className="max-h-48 overflow-y-auto rounded-b-[var(--radius-card)] p-1">
            {filteredCountries.map((candidate) => (
              <button
                key={candidate.iso2}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setCountry(candidate.iso2);
                  setOpen(false);
                  setSearch("");
                  inputRef.current?.focus();
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-[var(--radius)] px-2 py-1 text-left transition-colors hover:bg-[color:var(--elevate-2)]",
                  country.iso2 === candidate.iso2 && "bg-[color:var(--elevate-3)] text-[color:var(--brand-accent)]",
                )}
              >
                <span className="text-sm leading-none">{flagEmoji(candidate.iso2)}</span>
                <span className="flex-1 truncate text-ui-label normal-case tracking-normal text-foreground">{candidate.name}</span>
                <span className="shrink-0 text-ui-micro text-foreground/40">+{candidate.dialCode}</span>
              </button>
            ))}
            {filteredCountries.length === 0 ? <p className="px-2 py-2 text-ui-meta text-foreground/45">No results</p> : null}
          </div>
        </div>
      ) : null}

      <span className="h-4 w-px shrink-0 bg-foreground/15" />
      <input ref={inputRef} value={inputValue} onChange={handlePhoneValueChange} onBlur={onBlur} disabled={disabled} placeholder="912 345 678" type="tel" className="h-7 flex-1 border-0 bg-transparent pl-2 text-sm text-foreground outline-none placeholder:text-foreground/35 disabled:pointer-events-none disabled:opacity-100" />
    </div>
  );
}

export type { PhoneInputProps };
