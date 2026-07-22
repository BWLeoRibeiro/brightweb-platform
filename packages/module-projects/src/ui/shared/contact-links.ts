export function buildProjectMemberEmailHref(email: string, projectName: string, projectReference: string) {
  const params = new URLSearchParams({
    subject: `${projectName} (${projectReference})`,
  });
  return `mailto:${encodeURIComponent(email)}?${params.toString()}`;
}

export function buildProjectMemberPhoneHref(phone: string) {
  const normalized = phone.replace(/[^\d+]/g, "");
  return `tel:${normalized}`;
}
