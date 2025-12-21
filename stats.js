import { pb } from "./lib/pb.js";

export async function getDailyStatRecordSmart({ dateKey, pb }) {
  try {
    return await pb
      .collection("daily_stats")
      .getFirstListItem(`day="${dateKey}"`);
  } catch (e) {
    if (e?.status === 404) return null;
    throw e;
  }
}
