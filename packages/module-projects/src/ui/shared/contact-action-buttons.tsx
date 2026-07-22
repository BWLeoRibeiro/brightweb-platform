import { Mail, Phone } from "lucide-react";
import { buildProjectMemberEmailHref, buildProjectMemberPhoneHref } from "./contact-links";
import { defaultProjectsUiDictionary } from "../dictionary";

type ContactActionButtonsProps = {
  label: string | null;
  email?: string | null;
  phone?: string | null;
  projectName: string;
  projectReference: string;
  iconClassName?: string;
  linkClassName?: string;
  phoneAriaPrefix?: string;
  emailAriaPrefix?: string;
};

export function ContactActionButtons({
  label,
  email,
  phone,
  projectName,
  projectReference,
  iconClassName,
  linkClassName,
  phoneAriaPrefix = defaultProjectsUiDictionary.people.call,
  emailAriaPrefix = defaultProjectsUiDictionary.people.email,
}: ContactActionButtonsProps) {
  return (
    <>
      {phone ? (
        <a
          href={buildProjectMemberPhoneHref(phone)}
          className={linkClassName}
          aria-label={`${phoneAriaPrefix} ${label ?? defaultProjectsUiDictionary.people.contact}`}
          title={`${phoneAriaPrefix} ${phone}`}
        >
          <Phone className={iconClassName ?? "size-3.5"} />
        </a>
      ) : null}
      {email ? (
        <a
          href={buildProjectMemberEmailHref(email, projectName, projectReference)}
          className={linkClassName}
          aria-label={`${emailAriaPrefix} ${label ?? defaultProjectsUiDictionary.people.contact}`}
          title={`${emailAriaPrefix} ${email}`}
        >
          <Mail className={iconClassName ?? "size-3.5"} />
        </a>
      ) : null}
    </>
  );
}
