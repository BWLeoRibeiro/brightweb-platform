"use client";

import { StyledSelect } from "@brightweblabs/ui";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Save, X } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Label } from "@brightweblabs/ui";
import type { AccountLanguage, AccountProfile } from "../../account/profile";
import { createAccountUiClient } from "./client";
import { defaultAccountUiDictionary } from "./dictionary";
import type { AccountUiClient, AccountUiDictionary } from "./types";

export type AccountClientProps = {
  profile: AccountProfile;
  client?: AccountUiClient;
  dictionary?: AccountUiDictionary;
};

const defaultClient = createAccountUiClient();

export function AccountClient({
  profile,
  client = defaultClient,
  dictionary = defaultAccountUiDictionary,
}: AccountClientProps) {
  const router = useRouter();
  const [isRefreshing, startRefreshTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [saved, setSaved] = useState({
    firstName: profile.firstName,
    lastName: profile.lastName,
    preferredLanguage: profile.preferredLanguage,
  });
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [preferredLanguage, setPreferredLanguage] = useState<AccountLanguage>(profile.preferredLanguage);
  const [isSaving, setIsSaving] = useState(false);

  const languageLabels: Record<AccountLanguage, string> = {
    "pt-PT": dictionary.profile.portuguese,
    en: dictionary.profile.english,
  };
  const hasChanges = firstName !== saved.firstName
    || lastName !== saved.lastName
    || preferredLanguage !== saved.preferredLanguage;

  const handleCancel = () => {
    setFirstName(saved.firstName);
    setLastName(saved.lastName);
    setPreferredLanguage(saved.preferredLanguage);
    setIsEditing(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving || !hasChanges) return;
    setIsSaving(true);

    try {
      const updated = await client.updateProfile({ firstName, lastName, preferredLanguage });
      setFirstName(updated.firstName);
      setLastName(updated.lastName);
      setPreferredLanguage(updated.preferredLanguage);
      setSaved({
        firstName: updated.firstName,
        lastName: updated.lastName,
        preferredLanguage: updated.preferredLanguage,
      });
      setIsEditing(false);
      toast.success(dictionary.profile.saveSuccess);
      startRefreshTransition(() => router.refresh());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dictionary.profile.saveError);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!isEditing ? (
        <div className="divide-y divide-border/40">
          <div className="flex items-center justify-between py-2.5">
            <span className="text-meta text-muted-foreground">{dictionary.profile.firstName}</span>
            <span className="text-body font-semibold">{saved.firstName || dictionary.profile.emptyValue}</span>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <span className="text-meta text-muted-foreground">{dictionary.profile.lastName}</span>
            <span className="text-body font-semibold">{saved.lastName || dictionary.profile.emptyValue}</span>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <span className="text-meta text-muted-foreground">{dictionary.profile.email}</span>
            <span className="max-w-[60%] truncate text-body font-semibold text-muted-foreground">
              {profile.email ?? dictionary.profile.emptyValue}
            </span>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <span className="text-meta text-muted-foreground">{dictionary.profile.language}</span>
            <span className="text-body font-semibold">{languageLabels[saved.preferredLanguage]}</span>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="account-first-name">{dictionary.profile.firstName}</Label>
              <Input
                id="account-first-name"
                name="firstName"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                placeholder={dictionary.profile.firstNamePlaceholder}
                maxLength={80}
                disabled={isSaving}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="account-last-name">{dictionary.profile.lastName}</Label>
              <Input
                id="account-last-name"
                name="lastName"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                placeholder={dictionary.profile.lastNamePlaceholder}
                maxLength={80}
                disabled={isSaving}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="account-email">{dictionary.profile.email}</Label>
            <Input id="account-email" name="email" type="email" value={profile.email ?? ""} readOnly disabled autoComplete="email" spellCheck={false} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="account-language">{dictionary.profile.preferredLanguage}</Label>
            <StyledSelect
              id="account-language"
              value={preferredLanguage}
              onChange={(event) => setPreferredLanguage(event.target.value === "en" ? "en" : "pt-PT")}
              disabled={isSaving}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-body shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <option value="pt-PT">{dictionary.profile.portuguese}</option>
              <option value="en">{dictionary.profile.english}</option>
            </StyledSelect>
          </div>
        </>
      )}

      <div className="flex items-center justify-between gap-3 pt-1">
        {!isEditing ? (
          <>
            <p className="text-meta text-muted-foreground">{dictionary.profile.emailHint}</p>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditing(true)}
              className="shrink-0 gap-2"
            >
              <Pencil className="size-3.5" />
              {dictionary.profile.edit}
            </Button>
          </>
        ) : (
          <>
            <Button type="button" variant="ghost" onClick={handleCancel} disabled={isSaving} className="gap-2">
              <X className="size-3.5" />
              {dictionary.profile.cancel}
            </Button>
            <Button type="submit" disabled={isSaving || isRefreshing || !hasChanges} className="gap-2">
              {isSaving || isRefreshing
                ? <Loader2 className="size-3.5 animate-spin" />
                : <Save className="size-3.5" />}
              {dictionary.profile.save}
            </Button>
          </>
        )}
      </div>
    </form>
  );
}
