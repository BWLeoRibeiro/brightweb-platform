export function computeInitials(email: string | null | undefined, firstName?: string, lastName?: string) {
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  if (fullName) {
    return fullName
      .split(" ")
      .slice(0, 2)
      .map((segment) => segment[0]?.toUpperCase() ?? "")
      .join("");
  }

  const localPart = (email ?? "").split("@")[0] ?? "";
  const pieces = localPart.split(/[._-]+/).filter(Boolean);
  if (pieces.length > 1) {
    return pieces
      .slice(0, 2)
      .map((segment) => segment[0]?.toUpperCase() ?? "")
      .join("");
  }
  return localPart.slice(0, 2).toUpperCase() || "BW";
}
