import PocketBase from 'pocketbase';

// Usá tu dominio público de Railway:
const PB_URL = import.meta.env?.VITE_PB_URL || 'https://railway-production-857d.up.railway.app/';

export const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);

// (opcional) login si vas a usar usuarios
export async function login(email, password) {
  return pb.collection('users').authWithPassword(email, password);
}
