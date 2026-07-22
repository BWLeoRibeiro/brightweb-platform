import { Mail, Phone } from "lucide-react";
import { buildProjectMemberEmailHref, buildProjectMemberPhoneHref } from "./contact-links";

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
  phoneAriaPrefix = "Ligar para",
  emailAriaPrefix = "Enviar email para",
}: ContactActionButtonsProps) {
  return (
    <>
      {phone ? (
        <a
          href={buildProjectMemberPhoneHref(phone)}
          className={linkClassName}
          aria-label={`${phoneAriaPrefix} ${label ?? "contacto"}`}
          title={`${phoneAriaPrefix} ${phone}`}
        >
          <Phone className={iconClassName ?? "size-3.5"} />
        </a>
      ) : null}
      {email ? (
        <a
          href={buildProjectMemberEmailHref(email, projectName, projectReference)}
          className={linkClassName}
          aria-label={`${emailAriaPrefix} ${label ?? "contacto"}`}
          title={`${emailAriaPrefix} ${email}`}
        >
          <Mail className={iconClassName ?? "size-3.5"} />
        </a>
      ) : null}
    </>
  );
}
