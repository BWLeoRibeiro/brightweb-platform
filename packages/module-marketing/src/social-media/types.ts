export type SocialMediaPublication = {
  id: string;
  date: string;
  type: string;
  title: string;
  channels: string;
  format: string;
  summary: string;
  interaction: string;
  cta: string;
  baseText: string;
  service: string;
  editorialNote: string;
  references: [label: string, url: string][];
};

export type SocialMediaPositioning = {
  eyebrow?: string;
  headline: string;
  statement: string;
  principles: { title: string; description: string }[];
  rhythm?: { label: string; description: string; icon?: string }[];
};

export type SocialMediaPlan = {
  measurement?: SocialMediaMeasurement;
  positioning?: SocialMediaPositioning;
  title: string;
  period: string;
  editorial?: SocialMediaEditorial;
  campaigns?: SocialMediaCampaigns;
  sections: { id: string; title: string }[];
  types: Record<string, SocialMediaPublicationType>;
  events: SocialMediaPublication[];
  holidays?: Record<string, string>;
};

export type SocialMediaMeasurement = {
  period: string;
  title: string;
  introduction: string;
  deliverables: { value: string; label: string; description: string }[];
  baseline?: { value: string; label: string; date: string; description: string; ariaLabel?: string };
  signalsIntroduction?: string;
  signals: { title: string; question: string; indicators: string[]; interpretation: string; icon?: string }[];
  references?: SocialMediaMeasurementReferences;
  decisions: { when: string; title: string; description: string; outcome?: string }[];
  routine: string;
};

/** Inline editorial emphasis only; layout and HTML remain package-owned. */
export type SocialMediaCopy = { text: string; emphasis?: boolean }[];
export type SocialMediaSectionHeading = { eyebrow: string; title: string };
export type SocialMediaEditorial = SocialMediaSectionHeading & {
  titleAccent?: string;
  introduction: string;
  sequence?: SocialMediaSectionHeading & {
    introduction: string;
    steps: { label: string; title: string; description: string }[];
    definition?: { title: string; description: string; points: SocialMediaCopy[] };
  };
  distribution?: SocialMediaSectionHeading & {
    introduction: SocialMediaCopy;
    channels: { icon?: string; priority: string; name: string; description: string; points: string[] }[];
  };
  production?: SocialMediaSectionHeading & {
    formats: { label: string; title: string; description: SocialMediaCopy }[];
    example?: { title: string; description: SocialMediaCopy };
  };
};
export type SocialMediaCampaigns = SocialMediaSectionHeading & {
  introduction: string;
  launch?: { date: string; title: string; description: string };
  items: { period: string; title: string; description: SocialMediaCopy; points: string[] }[];
};
export type SocialMediaMeasurementReferences = {
  title: string;
  description?: string;
  note?: string;
  columns: { name: string; value: string; interpretation: string; source: string };
  rows: { name: string; context?: string; value: string; interpretation: string; source: { label: string; href: string } }[];
};

export type SocialMediaPublicationType = {
  label: string;
  medium: "social" | "website";
  tone?: "primary" | "success" | "warning" | "info" | "special";
};
