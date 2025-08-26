import retry from "async-retry";
import type { Chat, Video } from "./types";

const get_json = async function (url: string) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
};

export const info_from_url = async function (url: string) {
  if (!/^https?:\/\/kick\.com\/.*\/videos\//.test(url)) {
    throw new Error("URLが正しくありません");
  }
  const video_id = url.split("/").slice(-1)[0];
  return (await get_json("https://kick.com/api/v1/video/" + video_id)) as Video;
};

export const download_comments = async function (
  info: Video,
  show_progress?: (progress: number) => void
) {
  const start_at = new Date(info.livestream.start_time);
  const end_at = new Date(start_at.getTime() + info.livestream.duration);
  let t = start_at;
  const list: Chat[] = [];
  const ids: Record<string, boolean> = {};
  while (true) {
    let posted_at: Date | undefined;
    const url =
      `https://kick.com/api/v2/channels/${info.livestream.channel_id}/messages?` +
      `start_time=${t.toISOString()}`;
    const res = await retry(async () => await get_json(url), { retries: 100 });
    const chats:
      | {
          content: string;
          created_at: string;
          id: string;
          user_id: number;
        }[]
      | undefined = res?.data?.messages;

    if (chats) {
      for (const chat of chats) {
        if (ids[chat.id]) continue;
        ids[chat.id] = true;
        posted_at = new Date(chat.created_at);
        const vpos = (posted_at.getTime() - start_at.getTime()) / 10;
        if (vpos < 0) continue;

        const user_id = chat.user_id.toString();
        const message = chat.content; // ← emoteを除外せずそのまま
        if (message) {
          list.push({ vpos, posted_at, user_id, message });
        }
      }
    }

    t = new Date(t.getTime() + 5000);
    const progress =
      (t.getTime() - start_at.getTime()) /
      (end_at.getTime() - start_at.getTime());
    if (show_progress) show_progress(progress);
    if (t > end_at) break;
  }
  return list;
};

async function limit<T>(tasks: (() => Promise<T>)[], concurrency: number) {
  const results: T[] = [];
  const tasksIterator = tasks.entries();

  await Promise.all(
    Array.from({ length: concurrency }).map(async () => {
      for (const [index, task] of tasksIterator) {
        results[index] = await task();
      }
    })
  );

  return results;
}

export const download_comments_parallel = async function (info: Video) {
  const start_at = new Date(info.livestream.start_time);
  const end_at = new Date(start_at.getTime() + info.livestream.duration);
  const downloads = Array.from(
    { length: Math.ceil((end_at.getTime() - start_at.getTime()) / 5000) },
    (_, i) => i
  );
  const list: Chat[] = [];
  const ids = new Set<string>();

  const tasks = downloads.map((i) => async () => {
    const t = new Date(start_at.getTime() + 5000 * i);
    const url =
      `https://kick.com/api/v2/channels/${info.livestream.channel_id}/messages?` +
      `start_time=${t.toISOString()}`;
    const res = await retry(async () => await get_json(url), { retries: 100 });
    const chats:
      | {
          content: string;
          created_at: string;
          id: string;
          user_id: number;
        }[]
      | undefined = res?.data?.messages;

    if (chats) {
      for (const chat of chats) {
        if (ids.has(chat.id)) continue;
        ids.add(chat.id);
        const posted_at = new Date(chat.created_at);
        const vpos = (posted_at.getTime() - start_at.getTime()) / 10;
        if (vpos < 0) continue;

        const user_id = chat.user_id.toString();
        const message = chat.content; // ← emoteを除外せずそのまま
        if (message) {
          list.push({ vpos, posted_at, user_id, message });
        }
      }
    }
  });

  await limit(tasks, 10);

  const sortedList = list.toSorted(
    (a, b) => a.posted_at.getTime() - b.posted_at.getTime()
  );
  return sortedList;
};

export const randomize = function (list: Chat[]) {
  for (const chat of list) {
    if (chat.vpos % 100 === 0) {
      chat.vpos += Math.floor(Math.random() * 100);
    }
  }
  return list.toSorted((a, b) => a.vpos - b.vpos);
};
