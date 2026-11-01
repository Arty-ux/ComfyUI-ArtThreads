"""Map ArtThreads Multi Reference bundles onto LTX MSR slots."""

from __future__ import annotations

from lib.multi_reference import bundle_to_stock_ref_images

# MSR guide slots: pic1 required; pic2–pic4 + background optional.
SLOT_NAMES = ("pic1", "pic2", "pic3", "pic4", "background")


def map_refs_to_ltx_slots(ref_images):
    """Convert ARTTHREADS_H3_REFERENCE_IMAGES → (pic1, pic2, pic3, pic4, background).

    Mapping:
      1 ref  → pic1
      2 refs → pic1 + background
      3+     → pic1, middle → pic2…pic4 (up to 3), last → background

    Unused slots are None. Raises if the bundle is empty or pic1 cannot be set.
    """
    stock = bundle_to_stock_ref_images(ref_images)
    refs = [stock[f"ref_image_{i}"] for i in range(len(stock))]
    count = len(refs)

    pic1 = refs[0]
    pic2 = pic3 = pic4 = background = None

    if count == 1:
        return pic1, pic2, pic3, pic4, background

    if count == 2:
        return pic1, pic2, pic3, pic4, refs[1]

    # 3+: first = pic1, last = background, middle fill pic2…pic4.
    background = refs[-1]
    middle = refs[1:-1]
    if len(middle) >= 1:
        pic2 = middle[0]
    if len(middle) >= 2:
        pic3 = middle[1]
    if len(middle) >= 3:
        pic4 = middle[2]
    return pic1, pic2, pic3, pic4, background
