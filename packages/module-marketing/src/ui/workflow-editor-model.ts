import type { MarketingWorkflow, MarketingWorkflowInput, MarketingWorkflowNode, MarketingWorkflowNodeInput, MarketingWorkflowNodeType, MarketingWorkflowTriggerType } from "./types";

export type WorkflowForm = {
  name: string;
  description: string;
  triggerType: MarketingWorkflowTriggerType;
  triggerValue: string;
};

export type DraftNode = {
  key: string;
  id?: string;
  type: MarketingWorkflowNodeType;
  subject: string;
  body: string;
  topic: string;
  duration: string;
  durationUnit: "minutes" | "hours" | "days";
  tag: string;
};

export const emptyForm: WorkflowForm = {
  name: "",
  description: "",
  triggerType: "contact_subscribed",
  triggerValue: "",
};

function triggerValue(workflow: MarketingWorkflow) {
  const config = workflow.triggerConfig;
  if (workflow.triggerType === "contact_subscribed") {
    return String(config.topicId ?? config.topic ?? "");
  }
  if (workflow.triggerType === "form_submitted") {
    return String(config.formId ?? config.form ?? "");
  }
  return String(config.toStatus ?? config.targetStatus ?? "");
}

export function toForm(workflow: MarketingWorkflow): WorkflowForm {
  return {
    name: workflow.name,
    description: workflow.description ?? "",
    triggerType: workflow.triggerType,
    triggerValue: triggerValue(workflow),
  };
}

export function createDraftNode(type: MarketingWorkflowNodeType, index: number): DraftNode {
  return {
    key: `new-${Date.now()}-${index}`,
    type,
    subject: "",
    body: "",
    topic: "",
    duration: "1",
    durationUnit: "hours",
    tag: "",
  };
}

export function toDraftNode(node: MarketingWorkflowNode): DraftNode {
  const durationMinutes = Number(node.config.durationMinutes ?? node.config.duration_minutes ?? 60);
  const durationUnit = durationMinutes > 0 && durationMinutes % 1440 === 0
    ? "days"
    : durationMinutes > 0 && durationMinutes % 60 === 0 ? "hours" : "minutes";
  const divisor = durationUnit === "days" ? 1440 : durationUnit === "hours" ? 60 : 1;
  return {
    key: node.id,
    id: node.id,
    type: node.type,
    subject: String(node.config.subject ?? ""),
    body: String(node.config.bodyHtml ?? node.config.body ?? ""),
    topic: String(node.config.topicId ?? node.config.topic ?? ""),
    duration: String(Math.max(1, durationMinutes / divisor)),
    durationUnit,
    tag: String(node.config.tag ?? ""),
  };
}

export function toWorkflowInput(form: WorkflowForm): MarketingWorkflowInput {
  const value = form.triggerValue.trim();
  const triggerConfig = form.triggerType === "contact_subscribed"
    ? { topicId: value }
    : form.triggerType === "form_submitted"
      ? { formId: value }
      : { toStatus: value };
  return {
    name: form.name.trim(),
    description: form.description.trim() || null,
    triggerType: form.triggerType,
    triggerConfig,
  };
}

export function toNodeInput(node: DraftNode, position: number): MarketingWorkflowNodeInput {
  if (node.type === "send_email") {
    return {
      id: node.id,
      nodeType: node.type,
      position,
      config: {
        subject: node.subject.trim(),
        bodyHtml: node.body,
        ...(node.topic.trim() ? { topicId: node.topic.trim() } : {}),
      },
    };
  }
  if (node.type === "wait") {
    const multiplier = node.durationUnit === "days" ? 1440 : node.durationUnit === "hours" ? 60 : 1;
    return {
      id: node.id,
      nodeType: node.type,
      position,
      config: { durationMinutes: Math.max(1, Number(node.duration) || 1) * multiplier },
    };
  }
  return {
    id: node.id,
    nodeType: node.type,
    position,
    config: { tag: node.tag.trim() },
  };
}

export function isNodeValid(node: DraftNode) {
  if (node.type === "send_email") return Boolean(node.subject.trim() && node.body.trim());
  if (node.type === "wait") return Number(node.duration) > 0;
  return Boolean(node.tag.trim());
}
