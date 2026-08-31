// Load Audio ArtThreads — server API.

import { artApiUrl } from "../shared/api_url.mjs";

export async function listAudioFiles() {
  try {
    const res = await fetch(artApiUrl("/artthreads/api/load_audio/list"), { cache: "no-store" });
    if (!res.ok) return { files: [], error: true };
    const data = await res.json();
    return {
      files: Array.isArray(data?.files) ? data.files : [],
      error: data?.error === true,
    };
  } catch (_e) {
    return { files: [], error: true };
  }
}

export function audioFileUrl(name) {
  if (!name) return "";
  return artApiUrl(`/view?filename=${encodeURIComponent(name)}&type=input`);
}

export async function uploadAudio(file) {
  const body = new FormData();
  body.append("image", file, file.name);
  body.append("type", "input");
  const res = await fetch(artApiUrl("/upload/image"), { method: "POST", body });
  if (!res.ok) throw new Error(`upload failed (${res.status})`);
  const data = await res.json();
  const name = data?.name || file.name;
  return data?.subfolder ? `${data.subfolder}/${name}` : name;
}
