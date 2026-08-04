"use client";

import type { ComponentProps } from "react";
import { pt } from "date-fns/locale";
import { Calendar } from "@brightweblabs/ui";

type ProjectCalendarProps = ComponentProps<typeof Calendar>;

export function ProjectCalendar(props: ProjectCalendarProps) {
  return <Calendar locale={pt} {...props} />;
}
