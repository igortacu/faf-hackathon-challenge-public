import { env } from "@/config/env";
import { api } from "@/lib/api-client";
import {
  AdminMetricsResponseSchema,
  ChatHistoryResponseSchema,
  ConversationsListResponseSchema,
  ConversationTranscriptResponseSchema,
  PostChatResponseSchema,
  type AdminMetricsResponse,
  type ChatHistoryResponse,
  type ConversationsListResponse,
  type ConversationTranscriptResponse,
  type PostChatRequest,
  type PostChatResponse,
} from "@/features/parrot/types";

export function getChatHistory(guestId: string): Promise<ChatHistoryResponse> {
  return api.parrot.get(ChatHistoryResponseSchema, `/history/${guestId}`);
}

export function postChat(body: PostChatRequest): Promise<PostChatResponse> {
  return api.parrot.post(PostChatResponseSchema, "/chat", body);
}

// Parrot admin endpoints are gated by the X-Admin-Passcode header (same passcode
// the Observer/admin login validates against). Without it the gateway/parrot
// returns 401 and the panel shows "Admin authentication required".
const adminHeaders = (): Record<string, string> =>
  env.adminPasscode ? { "X-Admin-Passcode": env.adminPasscode } : {};

export function getAdminMetrics(): Promise<AdminMetricsResponse> {
  return api.parrot.get(AdminMetricsResponseSchema, "/admin/metrics", adminHeaders());
}

export function getConversations(): Promise<ConversationsListResponse> {
  return api.parrot.get(
    ConversationsListResponseSchema,
    "/admin/conversations",
    adminHeaders()
  );
}

export function getConversationTranscript(
  guestId: string
): Promise<ConversationTranscriptResponse> {
  return api.parrot.get(
    ConversationTranscriptResponseSchema,
    `/admin/conversations/${guestId}`,
    adminHeaders()
  );
}
