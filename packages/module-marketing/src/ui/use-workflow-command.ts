"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { toast } from "sonner";
import type { MarketingUiClient } from "./types";

type WorkflowAction = "save" | "activate" | "pause" | "delete";
type CommandOwner = {
  ownsCollection: () => boolean;
  ownsEditor: () => boolean;
};

// A command belongs to its client for its entire lifetime; closing an editor only
// detaches draft updates. A replacement client can start its own independent command.
export function useWorkflowCommand(
  client: MarketingUiClient,
  editorGeneration: RefObject<number>,
  genericError: string,
) {
  const ownerRef = useRef({ client, mounted: true, pending: null as symbol | null });
  if (ownerRef.current.client !== client) {
    ownerRef.current = { client, mounted: true, pending: null };
  }
  const owner = ownerRef.current;
  const [state, setState] = useState<{ owner: typeof owner; action: WorkflowAction } | null>(null);

  useEffect(() => {
    owner.mounted = true;
    return () => { owner.mounted = false; };
  }, [owner]);

  const run = async (
    action: WorkflowAction,
    execute: (scope: CommandOwner) => Promise<void>,
    successMessage: string,
  ) => {
    if (owner.pending || owner !== ownerRef.current || !owner.mounted) return;
    const token = Symbol(action);
    const generation = editorGeneration.current;
    const ownsCollection = () => owner === ownerRef.current && owner.mounted;
    const ownsEditor = () => ownsCollection() && generation === editorGeneration.current;
    owner.pending = token;
    setState({ owner, action });
    try {
      await execute({ ownsCollection, ownsEditor });
      if (ownsEditor()) toast.success(successMessage);
    } catch (error) {
      if (ownsEditor()) toast.error(error instanceof Error ? error.message : genericError);
    } finally {
      if (owner.pending === token) {
        owner.pending = null;
        if (ownsCollection()) setState(null);
      }
    }
  };

  return { busy: state?.owner === owner ? state.action : null, run };
}
