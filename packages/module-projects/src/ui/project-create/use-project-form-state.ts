"use client";

import { useCallback, useMemo, useState } from "react";

type OrganizationOption = {
  id: string;
  name: string;
};

function toCodeToken(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function buildProjectCode(organizationName: string, projectName: string): string {
  const orgToken = toCodeToken(organizationName).split("-").slice(0, 2).join("-") || "ORG";
  const projectToken = toCodeToken(projectName).split("-").slice(0, 3).join("-") || "PROJECT";
  const year = String(new Date().getFullYear());
  return `${orgToken}-${projectToken}-${year}`.slice(0, 72);
}

export function useProjectFormState(organizations: OrganizationOption[]) {
  const [organizationId, setOrganizationId] = useState(organizations[0]?.id ?? "");
  const [name, setName] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [codeTouched, setCodeTouched] = useState(false);
  const [status, setStatus] = useState("planned");
  const [cancellationReason, setCancellationReason] = useState("");
  const [startDate, setStartDate] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [summary, setSummary] = useState("");

  const isDateRangeValid = !startDate || !targetDate || targetDate >= startDate;
  const isFormValid = useMemo(
    () => organizationId.trim().length > 0 && name.trim().length > 0 && isDateRangeValid,
    [isDateRangeValid, name, organizationId],
  );
  const derivedCode = useMemo(() => {
    const organizationName = organizations.find((organization) => organization.id === organizationId)?.name ?? "";
    if (!organizationName.trim() || !name.trim()) {
      return "";
    }
    return buildProjectCode(organizationName, name);
  }, [name, organizationId, organizations]);
  const code = codeTouched ? manualCode : derivedCode;

  const setCode = useCallback((value: string) => {
    setManualCode(value);
  }, []);

  const resetProjectForm = useCallback((
    nextOrganizations: OrganizationOption[] = organizations,
    defaultOrganizationId: string = nextOrganizations[0]?.id ?? "",
  ) => {
    setOrganizationId(defaultOrganizationId);
    setName("");
    setManualCode("");
    setCodeTouched(false);
    setStatus("planned");
    setCancellationReason("");
    setStartDate("");
    setTargetDate("");
    setSummary("");
  }, [organizations]);

  return {
    organizationId,
    setOrganizationId,
    name,
    setName,
    code,
    setCode,
    codeTouched,
    setCodeTouched,
    status,
    setStatus,
    cancellationReason,
    setCancellationReason,
    startDate,
    setStartDate,
    targetDate,
    setTargetDate,
    summary,
    setSummary,
    isDateRangeValid,
    isFormValid,
    resetProjectForm,
  };
}
