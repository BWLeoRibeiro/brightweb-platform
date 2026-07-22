"use client";

import { useCallback, useMemo, useState } from "react";

export type OrganizationCreateFormState = {
  name: string;
  industry: string;
  companySize: string;
  budgetRange: string;
  websiteUrl: string;
  addressLine1: string;
  addressLine2: string;
  zipCode: string;
  country: string;
  taxIdentifierValue: string;
};

export type OrganizationInviteDraft = {
  email: string;
  role: "admin" | "member";
};

const emptyOrganizationCreateForm: OrganizationCreateFormState = {
  name: "",
  industry: "",
  companySize: "",
  budgetRange: "",
  websiteUrl: "",
  addressLine1: "",
  addressLine2: "",
  zipCode: "",
  country: "",
  taxIdentifierValue: "",
};

const emptyOrganizationInviteDraft: OrganizationInviteDraft = {
  email: "",
  role: "member",
};

export function useOrganizationCreationState() {
  const [isOrganizationSheetOpen, setOrganizationSheetOpen] = useState(false);
  const [organizationForm, setOrganizationForm] = useState<OrganizationCreateFormState>(emptyOrganizationCreateForm);
  const [organizationInviteDraft, setOrganizationInviteDraft] = useState<OrganizationInviteDraft>(emptyOrganizationInviteDraft);
  const [organizationInvites, setOrganizationInvites] = useState<OrganizationInviteDraft[]>([]);

  const hasOrganizationName = useMemo(() => organizationForm.name.trim().length > 0, [organizationForm.name]);

  const resetOrganizationForm = useCallback(() => {
    setOrganizationForm(emptyOrganizationCreateForm);
    setOrganizationInviteDraft(emptyOrganizationInviteDraft);
    setOrganizationInvites([]);
  }, []);

  return {
    isOrganizationSheetOpen,
    setOrganizationSheetOpen,
    organizationForm,
    setOrganizationForm,
    organizationInviteDraft,
    setOrganizationInviteDraft,
    organizationInvites,
    setOrganizationInvites,
    hasOrganizationName,
    resetOrganizationForm,
  };
}
