"use client";

import type { ReactNode } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { SheetSection } from "../shared/app-sheet";
import {
  sheetDatePickerButtonClassName,
  sheetEditControlClassName,
  sheetFieldLabelClassName,
} from "../shared/sheet-section";
import { cn } from "../utils";
import { Button } from "@brightweblabs/ui";
import { Calendar } from "@brightweblabs/ui";
import { Field, FieldContent, FieldGroup, FieldLabel } from "@brightweblabs/ui";
import { Popover, PopoverContent, PopoverTrigger } from "@brightweblabs/ui";

function parseIsoDate(value: string) {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function toIsoDate(value?: Date) {
  if (!value) return "";
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function FormSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <SheetSection title={title} editing>
      <FieldGroup className="gap-0 px-0 py-1">{children}</FieldGroup>
    </SheetSection>
  );
}

export function SelectField({
  id,
  label,
  value,
  onChange,
  children,
  className,
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Field className={className ?? "gap-1.5 px-4 py-2"}>
      <FieldLabel className={sheetFieldLabelClassName}>{label}</FieldLabel>
      <FieldContent>
        <select
          id={id}
          className={cn(sheetEditControlClassName, "text-foreground outline-none")}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {children}
        </select>
      </FieldContent>
    </Field>
  );
}

export function DateField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const parsedValue = parseIsoDate(value);

  return (
    <Field className="gap-1.5 px-4 py-2">
      <FieldLabel className={sheetFieldLabelClassName}>{label}</FieldLabel>
      <FieldContent>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              id={id}
              type="button"
              variant="ghost"
              className={cn(
                sheetDatePickerButtonClassName,
                parsedValue ? "text-foreground" : "text-foreground/45",
              )}
            >
              <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
              {parsedValue ? format(parsedValue, "dd/MM/yyyy") : "Selecionar data"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              captionLayout="dropdown"
              className="rounded-lg border"
              selected={parsedValue}
              onSelect={(date) => onChange(toIsoDate(date))}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </FieldContent>
    </Field>
  );
}
