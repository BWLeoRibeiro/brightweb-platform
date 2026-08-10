"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";

import { cn } from "../lib/utils";

const Select = SelectPrimitive.Root;
const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;
const EMPTY_SELECT_VALUE = "__brightweb_empty_select_value__";

export type SelectControlOption = {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
};

export type SelectControlProps = {
  id?: string;
  name?: string;
  value: string;
  options: readonly SelectControlOption[];
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  contentClassName?: string;
  "aria-label"?: string;
};

export type StyledSelectChangeEvent = {
  target: { value: string };
  currentTarget: { value: string };
};

export type StyledSelectProps = Omit<SelectControlProps, "options" | "onValueChange" | "placeholder"> & {
  children: React.ReactNode;
  onChange?: (event: StyledSelectChangeEvent) => void;
};

function SelectTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        "flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-[color:var(--sheet-edit-control-border,var(--border))] bg-[color:var(--card)] px-2.5 text-left text-body text-foreground shadow-none outline-none transition-[border-color,box-shadow,background-color] placeholder:text-foreground/45 focus:border-[color:var(--accent)] focus:ring-[3px] focus:ring-[color:var(--project-ui-color-10,var(--ring))] disabled:cursor-not-allowed disabled:opacity-55 [&>span]:min-w-0 [&>span]:truncate",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="size-4 shrink-0 text-foreground/55 transition-transform duration-150 data-[state=open]:rotate-180" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectContent({
  className,
  children,
  position = "popper",
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        position={position}
        sideOffset={sideOffset}
        className={cn(
          "relative z-[1400] max-h-[min(20rem,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-hairline bg-popover text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          className,
        )}
        {...props}
      >
        <SelectPrimitive.ScrollUpButton className="flex h-7 cursor-default items-center justify-center bg-popover text-foreground/60">
          <ChevronUp className="size-4" />
        </SelectPrimitive.ScrollUpButton>
        <SelectPrimitive.Viewport className="p-1.5">{children}</SelectPrimitive.Viewport>
        <SelectPrimitive.ScrollDownButton className="flex h-7 cursor-default items-center justify-center bg-popover text-foreground/60">
          <ChevronDown className="size-4" />
        </SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

function SelectLabel({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      className={cn("px-2.5 py-1.5 text-label font-semibold text-muted-foreground", className)}
      {...props}
    />
  );
}

function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex min-h-9 w-full cursor-default select-none items-center rounded-lg py-2 pl-2.5 pr-9 text-body text-foreground outline-none transition-colors focus:bg-accent/12 data-[disabled]:pointer-events-none data-[disabled]:opacity-45 data-[state=checked]:bg-accent/10 data-[state=checked]:font-semibold",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <span className="absolute right-2.5 flex size-4 items-center justify-center text-accent">
        <SelectPrimitive.ItemIndicator>
          <Check className="size-4 stroke-[2.5]" />
        </SelectPrimitive.ItemIndicator>
      </span>
    </SelectPrimitive.Item>
  );
}

function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return <SelectPrimitive.Separator className={cn("my-1 h-px bg-border", className)} {...props} />;
}

function SelectControl({
  id,
  name,
  value,
  options,
  onValueChange,
  placeholder,
  disabled,
  required,
  className,
  contentClassName,
  "aria-label": ariaLabel,
}: SelectControlProps) {
  const normalizedValue = value || EMPTY_SELECT_VALUE;
  const normalizedOptions = options.some((option) => option.value === "")
    ? options
    : placeholder
      ? [{ value: "", label: placeholder }, ...options]
      : options;

  return (
    <Select
      name={name}
      value={normalizedValue}
      onValueChange={(nextValue) => onValueChange(nextValue === EMPTY_SELECT_VALUE ? "" : nextValue)}
      disabled={disabled}
      required={required}
    >
      <SelectTrigger id={id} aria-label={ariaLabel} className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="start" className={contentClassName}>
        {normalizedOptions.map((option) => (
          <SelectItem
            key={option.value || EMPTY_SELECT_VALUE}
            value={option.value || EMPTY_SELECT_VALUE}
            disabled={option.disabled}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function StyledSelect({ children, onChange, ...props }: StyledSelectProps) {
  const options = React.Children.toArray(children).flatMap((child) => {
    if (!React.isValidElement<{ value?: string | number; children?: React.ReactNode; disabled?: boolean }>(child) || child.type !== "option") return [];
    return [{
      value: child.props.value == null ? "" : String(child.props.value),
      label: child.props.children,
      disabled: child.props.disabled,
    }];
  });

  return (
    <SelectControl
      {...props}
      options={options}
      onValueChange={(value) => onChange?.({ target: { value }, currentTarget: { value } })}
    />
  );
}

export {
  Select,
  SelectControl,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
  StyledSelect,
};
