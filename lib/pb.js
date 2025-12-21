import PocketBase from "https://esm.sh/pocketbase";

const PB_URL = "https://railway-production-857d.up.railway.app"; // sin slash final

export const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);
