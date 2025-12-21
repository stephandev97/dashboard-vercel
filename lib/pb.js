import PocketBase from "pocketbase";

// Cloudflare / Vite
const PB_URL = import.meta.env.VITE_PB_URL;

export const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);
