import type { MarketingCampaign, MarketingCampaignInput } from "./types";

export type CampaignForm = {
  name: string;
  subject: string;
  preheader: string;
  fromName: string;
  fromEmail: string;
  topicId: string;
  segmentId: string;
  bodyHtml: string;
};

export const emptyForm: CampaignForm = {
  name: "",
  subject: "",
  preheader: "",
  fromName: "",
  fromEmail: "",
  topicId: "",
  segmentId: "",
  bodyHtml: "",
};

export function toForm(campaign: MarketingCampaign): CampaignForm {
  return {
    name: campaign.name,
    subject: campaign.subject,
    preheader: campaign.preheader ?? "",
    fromName: campaign.fromName ?? "",
    fromEmail: campaign.fromEmail ?? "",
    topicId: campaign.topicId,
    segmentId: campaign.segmentId ?? "",
    bodyHtml: campaign.bodyHtml ?? "",
  };
}

export function toInput(form: CampaignForm): MarketingCampaignInput {
  return {
    name: form.name.trim(),
    subject: form.subject.trim(),
    preheader: form.preheader.trim() || null,
    fromName: form.fromName.trim() || null,
    fromEmail: form.fromEmail.trim() || null,
    topicId: form.topicId,
    segmentId: form.segmentId || null,
    bodyHtml: form.bodyHtml,
  };
}

export function isValid(form: CampaignForm) {
  return Boolean(form.name.trim() && form.subject.trim() && form.topicId && form.bodyHtml.trim());
}
