import { store } from "./store";

// ❤️ Love, 💡 Brilliant, 😂 Haha on the Feed. 👍 stays valid so older reactions still count.
export const NOTICE_REACTIONS = ["❤️", "💡", "😂", "👍"] as const;
export async function noticeBoard(email: string) {
  const rows = await store.listNotices(100);
  const reactions = await store.listNoticeReactions(rows.map(n => n.id));
  return rows.map(({ authorEmail, ...row }) => ({
    ...row,
    // Whether the viewer wrote it. The author's email itself never leaves the server.
    mine: !!authorEmail && authorEmail === email,
    reactions: NOTICE_REACTIONS.map(emoji => ({
      emoji,
      count: reactions.filter(r => r.noticeId === row.id && r.emoji === emoji).length,
      mine: reactions.some(r => r.noticeId === row.id && r.emoji === emoji && r.email === email),
    })),
  }));
}
export type PublicNotice = Awaited<ReturnType<typeof noticeBoard>>[number];
