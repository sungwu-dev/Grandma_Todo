"use client";

import type { SupabaseClient, User } from "@supabase/supabase-js";

export const REGISTERED_MEMBERS_STORAGE_KEY = "registered_family_members_v1";
const REGISTERED_MEMBERS_TABLE = "family_member_registrations";

const REGISTERED_MEMBERS_UPDATED_EVENT = "registered-family-members-updated";

type RegisteredMemberRow = {
  name?: string | null;
};

type RegisteredMemberPayload = {
  user_id: string;
  name: string;
  relation: string;
  email: string | null;
};

type RegisterMemberInput = {
  userId?: string | null;
  name: string;
  relation?: string;
  email?: string | null;
};

export const normalizeRegisteredMemberName = (value: string) =>
  value.trim().replace(/\s+/g, "").toLowerCase();

const normalizeRegisteredMembers = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [];
  }

  const deduped = new Map<string, string>();
  value.forEach((item) => {
    const rawName = String(item).trim();
    const normalizedName = normalizeRegisteredMemberName(rawName);
    if (normalizedName && !deduped.has(normalizedName)) {
      deduped.set(normalizedName, rawName);
    }
  });

  return [...deduped.values()];
};

const persistRegisteredMembers = (members: string[]) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    REGISTERED_MEMBERS_STORAGE_KEY,
    JSON.stringify(members)
  );
  window.dispatchEvent(new Event(REGISTERED_MEMBERS_UPDATED_EVENT));
};

const buildRegisteredMemberPayload = ({
  userId,
  name,
  relation,
  email
}: RegisterMemberInput): RegisteredMemberPayload | null => {
  const normalizedName = name.trim();
  const normalizedRelation = relation?.trim() ?? "";
  const normalizedEmail = email?.trim() ?? null;

  if (!userId || !normalizedName) {
    return null;
  }

  return {
    user_id: userId,
    name: normalizedName,
    relation: normalizedRelation,
    email: normalizedEmail
  };
};

const buildRegisteredMemberPayloadFromUser = (user: User) => {
  const metadata = user.user_metadata ?? {};
  const name =
    typeof metadata.name === "string"
      ? metadata.name.trim()
      : typeof metadata.nickname === "string"
        ? metadata.nickname.trim()
        : "";
  const relation =
    typeof metadata.relation === "string" ? metadata.relation.trim() : "";

  return buildRegisteredMemberPayload({
    userId: user.id,
    name,
    relation,
    email: user.email ?? null
  });
};

export const loadRegisteredMembers = () => {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(REGISTERED_MEMBERS_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    return normalizeRegisteredMembers(JSON.parse(raw));
  } catch {
    return [];
  }
};

export const addRegisteredMember = (name: string) => {
  const rawName = name.trim();
  if (!rawName) {
    return loadRegisteredMembers();
  }

  const currentMembers = loadRegisteredMembers();
  const normalizedName = normalizeRegisteredMemberName(rawName);
  const hasMember = currentMembers.some(
    (member) => normalizeRegisteredMemberName(member) === normalizedName
  );
  if (hasMember) {
    return currentMembers;
  }

  const nextMembers = [...currentMembers, rawName];
  persistRegisteredMembers(nextMembers);
  return nextMembers;
};

export const fetchRegisteredMembers = async (supabase: SupabaseClient) => {
  const { data, error } = await supabase
    .from(REGISTERED_MEMBERS_TABLE)
    .select("name");

  if (error) {
    return loadRegisteredMembers();
  }

  const members = normalizeRegisteredMembers(
    (data ?? []).map((item: RegisteredMemberRow) => item.name ?? "")
  );
  persistRegisteredMembers(members);
  return members;
};

export const registerMemberFromSignup = async (
  supabase: SupabaseClient,
  input: RegisterMemberInput
) => {
  const fallbackMembers = addRegisteredMember(input.name);
  const payload = buildRegisteredMemberPayload(input);
  if (!payload) {
    return fallbackMembers;
  }

  const { error } = await supabase
    .from(REGISTERED_MEMBERS_TABLE)
    .insert(payload);

  if (error) {
    return fallbackMembers;
  }

  return fetchRegisteredMembers(supabase);
};

export const syncAuthenticatedRegisteredMember = async (
  supabase: SupabaseClient
) => {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return loadRegisteredMembers();
  }

  const payload = buildRegisteredMemberPayloadFromUser(data.user);
  if (!payload) {
    return fetchRegisteredMembers(supabase);
  }

  const fallbackMembers = addRegisteredMember(payload.name);
  const { error: upsertError } = await supabase
    .from(REGISTERED_MEMBERS_TABLE)
    .upsert(payload, { onConflict: "user_id" });

  if (upsertError) {
    return fallbackMembers;
  }

  return fetchRegisteredMembers(supabase);
};

export const subscribeRegisteredMembers = (
  onChange: (members: string[]) => void
) => {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key && event.key !== REGISTERED_MEMBERS_STORAGE_KEY) {
      return;
    }
    onChange(loadRegisteredMembers());
  };
  const handleRegisteredMembersUpdated: EventListener = () => {
    onChange(loadRegisteredMembers());
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(
    REGISTERED_MEMBERS_UPDATED_EVENT,
    handleRegisteredMembersUpdated
  );

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(
      REGISTERED_MEMBERS_UPDATED_EVENT,
      handleRegisteredMembersUpdated
    );
  };
};
