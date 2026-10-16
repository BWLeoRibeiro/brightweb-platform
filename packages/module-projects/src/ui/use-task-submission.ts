"use client";

import { useEffect, useRef, useState } from "react";
import type { ProjectsUiClient } from "./types";

export function useTaskSubmission(client: ProjectsUiClient, projectId: string, initialOpen: boolean) {
  const [open, setOpen] = useState(initialOpen);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const openRef = useRef(initialOpen);
  const generationRef = useRef(0);
  const pendingRef = useRef<object | null>(null);
  const identityRef = useRef({ client, projectId });
  identityRef.current = { client, projectId };
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    setIsSubmitting(false);
    return () => {
      generationRef.current += 1;
      pendingRef.current = null;
    };
  }, [client, projectId]);

  const onOpenChange = (nextOpen: boolean) => {
    if (nextOpen !== openRef.current) {
      generationRef.current += 1;
      pendingRef.current = null;
      setIsSubmitting(false);
    }
    openRef.current = nextOpen;
    setOpen(nextOpen);
  };

  const submit = async ({ save, onPersisted, onSuccess, onError }: {
    save(): Promise<unknown>;
    onPersisted(): void;
    onSuccess(): void;
    onError(error: unknown): void;
  }) => {
    if (pendingRef.current || !openRef.current) return;
    const request = {};
    const generation = generationRef.current;
    pendingRef.current = request;
    setIsSubmitting(true);
    const isCurrent = () => mountedRef.current
      && generation === generationRef.current
      && client === identityRef.current.client
      && projectId === identityRef.current.projectId;
    try {
      await save();
      // Persistence outlives the editor session, but belongs to the original client.
      if (mountedRef.current && client === identityRef.current.client) onPersisted();
      if (isCurrent()) onSuccess();
    } catch (error) {
      if (isCurrent()) onError(error);
    } finally {
      if (pendingRef.current === request) {
        pendingRef.current = null;
        if (mountedRef.current) setIsSubmitting(false);
      }
    }
  };

  return { open, onOpenChange, isSubmitting, submit };
}
