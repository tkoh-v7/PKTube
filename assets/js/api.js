import { CONFIG } from "./config.js";

export async function fetchPlaylist() {
  const res = await fetch("./videos.json", {
    method: "GET",
    credentials: "omit",
    cache: "no-store"
  });

  if (!res.ok) throw new Error(`Playlist fetch failed: ${res.status}`);

  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("Playlist must be an array");
  return data;
}
