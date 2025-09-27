import { pb } from './lib/pb.js';

// Solo necesitamos esta función para leer daily_stats
export async function getDailyStatRecordSmart({ dateKey }) {
  try {
    return await pb.collection('daily_stats').getFirstListItem(`day="${dateKey}"`);
  } catch (e) {
    if (e?.status === 404) return null;
    throw e;
  }
}