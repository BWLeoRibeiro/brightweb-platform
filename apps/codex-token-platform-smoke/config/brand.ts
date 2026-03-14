export type StarterBrandConfig = {
  companyName: string;
  productName: string;
  slug: string;
  tagline: string;
  contactEmail: string;
  supportEmail: string;
  primaryHex: string;
};

export const starterBrandConfig: StarterBrandConfig = {
  companyName: process.env.NEXT_PUBLIC_CLIENT_COMPANY_NAME?.trim() || "Starter Client",
  productName: process.env.NEXT_PUBLIC_CLIENT_PRODUCT_NAME?.trim() || "Operations Platform",
  slug: process.env.NEXT_PUBLIC_CLIENT_SLUG?.trim() || "starter-client",
  tagline:
    process.env.NEXT_PUBLIC_CLIENT_TAGLINE?.trim()
    || "A configurable Brightweb starter app for shipping new client instances without rebuilding the platform.",
  contactEmail: process.env.NEXT_PUBLIC_CLIENT_CONTACT_EMAIL?.trim() || "hello@example.com",
  supportEmail: process.env.NEXT_PUBLIC_CLIENT_SUPPORT_EMAIL?.trim() || "support@example.com",
  primaryHex: process.env.NEXT_PUBLIC_CLIENT_PRIMARY_HEX?.trim() || "#1f7a45",
};
