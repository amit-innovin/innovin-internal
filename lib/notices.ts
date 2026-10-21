import { store } from "./store";

export const NOTICE_REACTIONS = ["❤️", "👍", "💡"] as const;
export async function noticeBoard(email: string) {
  const rows = await store.listNotices(100);
  const reactions = await store.listNoticeReactions(rows.map(n => n.id));
  return rows.map(({ authorEmail: _, ...row }) => ({
    ...row,
    reactions: NOTICE_REACTIONS.map(emoji => ({
      emoji,
      count: reactions.filter(r => r.noticeId === row.id && r.emoji === emoji).length,
      mine: reactions.some(r => r.noticeId === row.id && r.emoji === emoji && r.email === email),
    })),
  }));
}
export type PublicNotice = Awaited<ReturnType<typeof noticeBoard>>[number];
