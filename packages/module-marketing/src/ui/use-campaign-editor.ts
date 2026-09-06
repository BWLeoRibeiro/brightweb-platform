"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { toast } from "sonner";
import { createLatestRequestController, isAbortError } from "@brightweblabs/infra/request-observability";
import { emptyForm, isValid, toForm, toInput, type CampaignForm } from "./campaign-editor-model";
import { toLocalDateTime, fromLocalDateTime } from "./schedule-time";
import type { MarketingCampaign, MarketingCampaignRecipient, MarketingUiClient, MarketingUiDictionary, MarketingSegment } from "./types";
import type { MarketingCampaignAnalytics, MarketingOverviewMetrics } from "../analytics";

type CampaignMutations = {
  replace(campaign: MarketingCampaign): void;
  remove(campaignId: string): void;
  removeRecipient(campaignId: string): void;
  analytics(campaignId: string, analytics: MarketingCampaignAnalytics): void;
  overview(overview: MarketingOverviewMetrics): void;
  refresh(): void;
};

export function useCampaignEditor({ client, dictionary, ensureSegmentOptions, mutations }: {
  client: MarketingUiClient;
  dictionary: MarketingUiDictionary;
  ensureSegmentOptions(selectedId?: string | null): Promise<MarketingSegment[]>;
  mutations: CampaignMutations;
}) {
  const [activeCampaign, setActiveCampaign] = useState<MarketingCampaign | null>(null);
  const [form, setFormState] = useState<CampaignForm>(emptyForm);
  const [recipients, setRecipients] = useState<MarketingCampaignRecipient[]>([]);
  const [recipientsLoadState, setRecipientsLoadState] = useState<"pending" | "fulfilled" | "rejected">("fulfilled");
  const [editorOpen, setEditorOpen] = useState(false);
  const [busy, setBusyState] = useState<string | null>(null);
  const [scheduledAt, setScheduledAt] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const campaignDetailRequestRef = useRef(createLatestRequestController());
  const campaignEditorGenerationRef = useRef(0);
  const clientRef = useRef(client);
  clientRef.current = client;

  const draftRevisionRef = useRef(0);
  const busyRef = useRef<string | null>(null);
  const setForm: Dispatch<SetStateAction<CampaignForm>> = useCallback((update) => {
    draftRevisionRef.current += 1;
    setFormState(update);
  }, []);
  const setBusy = (value: string | null) => {
    busyRef.current = value;
    setBusyState(value);
  };

  const hasUnsavedDraft = !activeCampaign || JSON.stringify(toInput(form)) !== JSON.stringify(toInput(toForm(activeCampaign)));
  const saveBeforeActionMessage = dictionary.feedback.saveBeforeAction ?? "Guarde as alterações antes de enviar, agendar ou testar a campanha.";

  const setEditorCampaign = (campaign: MarketingCampaign, revision: number) => {
    setActiveCampaign(campaign);
    if (revision === draftRevisionRef.current) setFormState(toForm(campaign));
  };

  const beginCreate = () => {
    campaignEditorGenerationRef.current += 1;
    campaignDetailRequestRef.current.abort();
    setActiveCampaign(null);
    setFormState(emptyForm);
    setRecipients([]);
    setRecipientsLoadState("fulfilled");
    setBusy(null);
    setScheduledAt("");
    setTestEmail("");
    setEditorOpen(true);
    void ensureSegmentOptions();
  };

  const openCampaign = async (campaign: MarketingCampaign) => {
    campaignEditorGenerationRef.current += 1;
    const latest = campaignDetailRequestRef.current.begin();
    const revision = draftRevisionRef.current;
    setActiveCampaign(campaign);
    setFormState(toForm(campaign));
    setRecipients([]);
    setRecipientsLoadState("pending");
    setScheduledAt(campaign.scheduledAt ? toLocalDateTime(campaign.scheduledAt) : "");
    setEditorOpen(true);
    void ensureSegmentOptions(campaign.segmentId);
    setBusy("load");
    try {
      const [detail, nextRecipients, analytics] = await Promise.all([
        client.getCampaign(campaign.id, { signal: latest.signal }),
        client.listRecipients(campaign.id, { signal: latest.signal }),
        client.getCampaignAnalytics(campaign.id, { signal: latest.signal }),
      ]);
      if (!latest.isCurrent()) return;
      mutations.replace(detail);
      setEditorCampaign(detail, revision);
      setRecipients(nextRecipients);
      setRecipientsLoadState("fulfilled");
      mutations.analytics(campaign.id, analytics);
    } catch (error) {
      if (isAbortError(error) || !latest.isCurrent()) return;
      setRecipientsLoadState("rejected");
      toast.error(error instanceof Error ? error.message : dictionary.feedback.genericError);
    } finally {
      const current = latest.isCurrent();
      latest.finish();
      if (current) setBusy(null);
    }
  };

  const persist = async (successMessage?: string) => {
    if (busyRef.current) return null;
    const revision = draftRevisionRef.current;
    if (!isValid(form)) {
      toast.error(dictionary.feedback.campaignRequired ?? dictionary.feedback.required);
      return null;
    }
    const editorGeneration = campaignEditorGenerationRef.current;
    setBusy("save");
    try {
      const saved = activeCampaign
        ? await client.updateCampaign(activeCampaign.id, toInput(form))
        : await client.createCampaign(toInput(form));
      if (client !== clientRef.current) return null;
      mutations.replace(saved);
      mutations.refresh();
      if (editorGeneration !== campaignEditorGenerationRef.current) return null;
      setEditorCampaign(saved, revision);
      toast.success(successMessage ?? (activeCampaign ? dictionary.feedback.saved : dictionary.feedback.created));
      return saved;
    } catch (error) {
      if (editorGeneration === campaignEditorGenerationRef.current) toast.error(error instanceof Error ? error.message : dictionary.feedback.genericError);
      return null;
    } finally {
      if (editorGeneration === campaignEditorGenerationRef.current) setBusy(null);
    }
  };

  const runAction = async (action: "send" | "schedule" | "cancel" | "retry") => {
    if (busyRef.current) return;
    const revision = draftRevisionRef.current;
    const operations = {
      send: (campaign: MarketingCampaign) => client.sendCampaign(campaign.id),
      schedule: (campaign: MarketingCampaign) => client.scheduleCampaign(campaign.id, fromLocalDateTime(scheduledAt, campaign.scheduledAt)),
      cancel: (campaign: MarketingCampaign) => client.cancelCampaign(campaign.id),
      retry: (campaign: MarketingCampaign) => client.retryCampaign(campaign.id),
    };
    const messages = { send: dictionary.feedback.sent, schedule: dictionary.feedback.scheduled, cancel: dictionary.feedback.canceled, retry: dictionary.feedback.retried };
    if (!activeCampaign || ((action === "send" || action === "schedule") && hasUnsavedDraft)) {
      toast.error(saveBeforeActionMessage);
      return;
    }
    const campaign = activeCampaign;
    const editorGeneration = campaignEditorGenerationRef.current;
    setBusy(action);
    try {
      const updated = await operations[action](campaign);
      if (client !== clientRef.current) return;
      mutations.replace(updated);
      mutations.refresh();
      if (editorGeneration !== campaignEditorGenerationRef.current) return;
      setEditorCampaign(updated, revision);
      const [nextRecipients, analytics, nextOverview] = await Promise.all([
        client.listRecipients(updated.id),
        client.getCampaignAnalytics(updated.id),
        client.getOverview(),
      ]);
      if (editorGeneration !== campaignEditorGenerationRef.current) return;
      setRecipients(nextRecipients);
      mutations.analytics(updated.id, analytics);
      mutations.overview(nextOverview);
      toast.success(messages[action]);
    } catch (error) {
      if (editorGeneration === campaignEditorGenerationRef.current) toast.error(error instanceof Error ? error.message : dictionary.feedback.genericError);
    } finally {
      if (editorGeneration === campaignEditorGenerationRef.current) setBusy(null);
    }
  };

  const removeCampaign = async () => {
    if (busyRef.current) return;
    if (!activeCampaign || !["draft", "canceled"].includes(activeCampaign.status)) return;
    if (!window.confirm(`Eliminar definitivamente a campanha “${activeCampaign.name}”?`)) return;
    const campaignId = activeCampaign.id;
    const editorGeneration = campaignEditorGenerationRef.current;
    setBusy("delete");
    try {
      await client.deleteCampaign(campaignId);
      if (client !== clientRef.current) return;
      mutations.remove(campaignId);
      mutations.refresh();
      if (editorGeneration !== campaignEditorGenerationRef.current) return;
      campaignEditorGenerationRef.current += 1;
      campaignDetailRequestRef.current.abort();
      setEditorOpen(false);
      setActiveCampaign(null);
      setBusy(null);
      toast.success("Campanha eliminada.");
    } catch (error) {
      if (editorGeneration === campaignEditorGenerationRef.current) toast.error(error instanceof Error ? error.message : dictionary.feedback.genericError);
    } finally {
      if (editorGeneration === campaignEditorGenerationRef.current) setBusy(null);
    }
  };

  const removeRecipient = async (recipient: MarketingCampaignRecipient) => {
    if (busyRef.current) return;
    if (!activeCampaign || !window.confirm(`Remover ${recipient.email} desta campanha?`)) return;
    const campaignId = activeCampaign.id;
    const editorGeneration = campaignEditorGenerationRef.current;
    setBusy("recipient");
    try {
      await client.deleteRecipient(campaignId, recipient.id);
      if (client !== clientRef.current) return;
      mutations.removeRecipient(campaignId);
      mutations.refresh();
      if (editorGeneration !== campaignEditorGenerationRef.current) return;
      setRecipients((current) => current.filter((item) => item.id !== recipient.id));
      setActiveCampaign((current) => current?.id === campaignId
        ? { ...current, totalRecipients: Math.max(0, current.totalRecipients - 1) }
        : current);
      toast.success("Destinatário removido.");
    } catch (error) {
      if (editorGeneration === campaignEditorGenerationRef.current) toast.error(error instanceof Error ? error.message : dictionary.feedback.genericError);
    } finally {
      if (editorGeneration === campaignEditorGenerationRef.current) setBusy(null);
    }
  };

  const handleEditorOpenChange = (open: boolean) => {
    if (!open) {
      campaignDetailRequestRef.current.abort();
      campaignEditorGenerationRef.current += 1;
    }
    setEditorOpen(open);
  };

  const sendTest = async () => {
    if (busyRef.current) return;
    const email = testEmail.trim();
    if (!email) {
      toast.error(dictionary.feedback.testEmailRequired ?? dictionary.feedback.required);
      return;
    }
    if (!activeCampaign || hasUnsavedDraft) {
      toast.error(saveBeforeActionMessage);
      return;
    }
    const campaign = activeCampaign;
    const editorGeneration = campaignEditorGenerationRef.current;
    setBusy("test");
    try {
      await client.sendTest(campaign.id, email);
      if (editorGeneration !== campaignEditorGenerationRef.current) return;
      toast.success(dictionary.feedback.testSent);
    } catch (error) {
      if (editorGeneration === campaignEditorGenerationRef.current) toast.error(error instanceof Error ? error.message : dictionary.feedback.genericError);
    } finally {
      if (editorGeneration === campaignEditorGenerationRef.current) setBusy(null);
    }
  };

  useEffect(() => {
    setEditorOpen(false);
    setActiveCampaign(null);
    setFormState(emptyForm);
    setRecipients([]);
    setRecipientsLoadState("fulfilled");
    setBusy(null);
    return () => {
      campaignEditorGenerationRef.current += 1;
      campaignDetailRequestRef.current.abort();
    };
  }, [client]);

  return {
    draft: { form, setForm, scheduledAt, setScheduledAt, testEmail, setTestEmail, hasUnsavedDraft, saveBeforeActionMessage },
    session: { activeCampaign, editorOpen, busy, recipients, recipientsLoadState },
    commands: { beginCreate, openCampaign, persist, runAction, removeCampaign, removeRecipient, sendTest, handleEditorOpenChange },
  };
}
