from lib.resize_math import compute, compute_output_size, parse_ratio, snap_to_multiple


def test_compute_output_size_896x512():
    state = {
        "size": 896,
        "ratio": "16:9",
        "step": 32,
        "anchor": "center",
        "allow_upscale": True,
        "resample": "auto",
    }
    assert compute_output_size(state) == (896, 512)


def test_compute_output_size_1344x768_from_ratio():
    state = {"size": 1344, "ratio": "16:9", "step": 32}
    assert compute_output_size(state) == (1344, 768)


def test_compute_upscale_keep_ratio_from_generated_frames():
    result = compute(
        896,
        512,
        {"size": 1344, "ratio": "keep", "step": 32, "allow_upscale": True},
    )
    assert result["size"] == (1344, 768)
    assert result["cropped"] is False


def test_parse_ratio_variants():
    assert parse_ratio("16:9") == (16, 9)
    assert parse_ratio("keep") is None
    assert parse_ratio("9x16") == (9, 16)


def test_snap_to_multiple_never_zero():
    assert snap_to_multiple(504, 32) == 512
    assert snap_to_multiple(4, 32) == 32
