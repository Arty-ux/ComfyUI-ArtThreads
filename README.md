# ComfyUI-ArtThreads

ArtThreads UI nodes for ComfyUI.

## Nodes

| Class | Display name |
|-------|--------------|
| `ArtThreadsDuration` | Duration ArtThreads |
| `ArtThreadsLoadAudio` | Load Audio ArtThreads |
| `ArtThreadsMultiReference` | Multi Reference ArtThreads |
| `ArtThreadsMiniMaxH3ReferenceToImage` | Reference to Image ArtThreads |
| `ArtThreadsMiniMaxH3ReferenceToImageMaxQuality` | Reference to Image Max Quality ArtThreads |
| `ArtThreadsPromptMentions` | Prompt Mentions ArtThreads |
| `ArtThreadsVideoSize` | Video Size ArtThreads |
| `ArtThreadsLongestSide` | Longest Side ArtThreads |
| `ArtThreadsMonitor` | Monitor ArtThreads |
| `ArtThreadsRunTimer` | Run Timer ArtThreads |

### Multi Reference

Loads up to **9** ordered MiniMax H3 reference images (mixed sizes kept separate).

- Output `ref_images`: type `ARTTHREADS_H3_REFERENCE_IMAGES` (tuple of `[1,H,W,3]` tensors)
- Output `image_list`: `IMAGE` list for list-aware nodes
- Wire `ref_images` into:
  - **Reference to Image ArtThreads** (`artthreads_ref_images`) for stills, or
  - h3-audio-toolkit **Fixed 3 Audio Refs** (`artthreads_ref_images`) for video+audio

### Reference to Image

Builds MiniMax H3 **REF2VA** conditioning for a still image.

**Fast** (`Reference to Image ArtThreads`): `length = 5`, optional `ref_image_size` (`match` | `max`).

**Max Quality** (`Reference to Image Max Quality ArtThreads`):
- `length = 22` (next valid H3 packet after 5 — slower, more temporal context)
- `ref_image_size` locked to `max` (best identity / detail from refs)
- Defaults `1344×768`; outputs `still_frame_index` (default `1` = second frame) for `ImageFromBatch`

Both need REF2VA + video VAE, then `KSampler` → `VAEDecode` → `ImageFromBatch` → `SaveImage`. No audio toolkit required.

Recommended sampler for Max Quality: `res_multistep` + `simple`, 20 steps, CFG 1, plus `MiniMaxH3SigmaShift` (`shift_video=6`).

Starter workflow: `MinimaxH3 - image/ArtThreads_MiniMax_H3_MultiReference_Image_v1.json`

### Prompt Mentions

MiniMax-style prompt editor with `@` autocomplete over wired ArtThreads refs.

- Type `@` to pick **Picture** / **Audio** / **Source Audio** / **Video** refs from Multi Reference,
  Load Audio (Fixed 3 Audio Refs), and Source Audio wired into Auto / Native Audio
- Also discovers Picture refs when wired to **Reference to Image ArtThreads**
- Stored tags are canonical forms: `<Picture N>`, `<Audio N>`, `<Source Audio>`, `<Video N>`
- Bypassed Load Audio nodes are omitted from the tray and `@` list
- Output `prompt` (`STRING`) — wire into Reference to Image or Fixed Audio Refs `prompt`

## Install

Clone into `ComfyUI/custom_nodes/`:

```
git clone https://github.com/Arty-ux/ComfyUI-ArtThreads.git
```

Restart ComfyUI after install or update.
