import PocketBase from 'pocketbase';

// URL de PocketBase (configurar en Vercel como variable de entorno PB_URL)
const PB_URL = process.env.PB_URL || 'https://railway-production-857d.up.railway.app/';
export const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);