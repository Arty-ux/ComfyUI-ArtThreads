// Multi Reference ArtThreads — server API.

import { artApiUrl } from "../shared/api_url.mjs";

export async function listImageFiles() {
  try {
    const res = await fetch(artApiUrl("/artthreads/api/multi_reference/list"), { cache: "no-store" });
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

export function imageFileUrl(name) {
  if (!name) return "";
  const parts = String(name).replace(/\\/g, "/").split("/");
  const filename = parts.pop() || "";
  const subfolder = parts.join("/");
  let url = `/view?filename=${encodeURIComponent(filename)}&type=input`;
  if (subfolder) url += `&subfolder=${encodeURIComponent(subfolder)}`;
  return artApiUrl(url);
}

export async function uploadImage(file) {
  const body = new FormData();
  body.append("image", file, file.name);
  body.append("type", "input");
  const res = await fetch(artApiUrl("/upload/image"), { method: "POST", body });
  if (!res.ok) throw new Error(`upload failed (${res.status})`);
  const data = await res.json();
  const name = data?.name || file.name;
  return data?.subfolder ? `${data.subfolder}/${name}` : name;
}
