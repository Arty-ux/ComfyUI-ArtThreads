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
| `ArtThreadsLTXUnpackReferences` | LTX Unpack References ArtThreads |
| `ArtThreadsLTXStillLength` | LTX Still Length ArtThreads |
| `ArtThreadsPromptMentions` | Prompt Mentions ArtThreads |
| `ArtThreadsVideoSize` | Video Size ArtThreads |
| `ArtThreadsLongestSide` | Longest Side ArtThreads |
| `ArtThreadsMonitor` | Monitor ArtThreads |
| `ArtThreadsRunTimer` | Run Timer ArtThreads |

### Multi Reference

Loads up to **9** ordered reference images (mixed sizes kept separate).

- Output `ref_images`: type `ARTTHREADS_H3_REFERENCE_IMAGES` (tuple of `[1,H,W,3]` tensors)
- Output `image_list`: `IMAGE` list for list-aware nodes
- Wire `ref_images` into:
  - **Reference to Image ArtThreads** (`artthreads_ref_images`) for MiniMax H3 stills
  - **LTX Unpack References ArtThreads** for LTX 2.5 MSR stills
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

### LTX Reference to Image

LTX 2.5 has no H3-style `<Picture N>` conditioning. Multi-ref goes through **MSR** slots (`pic1`…`pic4` + `background`). ArtThreads supplies the same upload/prompt UX; generation is a short clip with one frame saved.

**`LTX Unpack References ArtThreads`** maps Multi Reference → MSR slots:

| Refs | Mapping |
|------|---------|
| 1 | `pic1` |
| 2 | `pic1` + `background` |
| 3+ | `pic1`, middle → `pic2`…`pic4`, last → `background` |

Unused slots return `None` (leave MSR optional inputs wired; empty slots are skipped).

**`LTX Still Length ArtThreads`**: frames `9` / `17` / `25` (`8n+1`), default **9**.

Wire: MultiReference → Unpack → `ComfyUILTX25MSRMultiReferenceGuide`; Prompt Mentions → `CLIPTextEncode`; Video Size (default **960×544**) + Still Length → `EmptyLTXVLatentVideo` / `LTXVEmptyLatentAudio`; two-stage distilled sample → `VAEDecode` → `ImageFromBatch` (index **0**) → `SaveImage`.

`<Picture N>` tags in Prompt Mentions are for authoring; LTX identity binding is the MSR slot wiring above.

Starter workflow: `LTX 2.5 - 2 - image/ArtThreads_LTX25_MultiReference_Image_v1.json` (requires `ComfyUI-LTX2.5-MSR`).

### Prompt Mentions

MiniMax-style prompt editor with `@` autocomplete over wired ArtThreads refs.

- Type `@` to pick **Picture** / **Audio** / **Source Audio** / **Video** refs from Multi Reference,
  Load Audio (Fixed 3 Audio Refs), and Source Audio wired into Auto / Native Audio
- Also discovers Picture refs when wired to **Reference to Image ArtThreads** or via **LTX Unpack References** on the graph
- Stored tags are canonical forms: `<Picture N>`, `<Audio N>`, `<Source Audio>`, `<Video N>`
- Bypassed Load Audio nodes are omitted from the tray and `@` list
- Output `prompt` (`STRING`) — wire into Reference to Image, Fixed Audio Refs, or LTX `CLIPTextEncode`

## Install

Clone into `ComfyUI/custom_nodes/`:

```
git clone https://github.com/Arty-ux/ComfyUI-ArtThreads.git
```

Restart ComfyUI after install or update.
