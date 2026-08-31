# ComfyUI-ArtThreads

ArtThreads UI nodes for ComfyUI.

## Nodes

| Class | Display name |
|-------|--------------|
| `ArtThreadsDuration` | Duration ArtThreads |
| `ArtThreadsLoadAudio` | Load Audio ArtThreads |
| `ArtThreadsMultiReference` | Multi Reference ArtThreads |
| `ArtThreadsVideoSize` | Video Size ArtThreads |
| `ArtThreadsLongestSide` | Longest Side ArtThreads |
| `ArtThreadsMonitor` | Monitor ArtThreads |
| `ArtThreadsRunTimer` | Run Timer ArtThreads |

### Multi Reference

Loads up to **9** ordered MiniMax H3 reference images (mixed sizes kept separate).

- Output `ref_images`: type `ARTTHREADS_H3_REFERENCE_IMAGES` (tuple of `[1,H,W,3]` tensors)
- Output `image_list`: `IMAGE` list for list-aware nodes
- Wire `ref_images` into h3-audio-toolkit **Fixed 3 Audio Refs** socket `artthreads_ref_images`
  (Deno loaders still use `ref_images`)

## Install

Clone into `ComfyUI/custom_nodes/`:

```
git clone https://github.com/Arty-ux/ComfyUI-ArtThreads.git
```

Restart ComfyUI after install or update.
