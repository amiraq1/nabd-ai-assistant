export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export function normalizeChatRole(role: string): ChatRole | null {
  if (role === "system" || role === "user" || role === "assistant") {
    return role;
  }
  return null;
}
