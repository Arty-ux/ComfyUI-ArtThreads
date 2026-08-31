from lib.monitor_stats import gpu_extras_for, parse_nvidia_smi, parse_visible_devices, pct


SAMPLE_SMI = (
    "0, NVIDIA GeForce RTX 4090, 42, 12000, 24576, 65, 220.5\n"
    "1, NVIDIA GeForce RTX 3060, [N/A], 4096, 12288, [N/A], [Not Supported]\n"
)


def test_parse_nvidia_smi_rows():
    rows = parse_nvidia_smi(SAMPLE_SMI)
    assert len(rows) == 2
    assert rows[0]["index"] == 0
    assert rows[0]["util"] == 42.0
    assert rows[0]["memUsed"] == 12000 * 1024 * 1024
    assert rows[0]["temp"] == 65.0
    assert rows[1]["util"] is None
    assert rows[1]["power"] is None


def test_pct_clamps_and_handles_invalid_total():
    assert pct(50, 100) == 50.0
    assert pct(150, 100) == 100.0
    assert pct(10, 0) is None


def test_parse_visible_devices():
    assert parse_visible_devices(None) is None
    assert parse_visible_devices("") is None
    assert parse_visible_devices("0,2") == [0, 2]
    assert parse_visible_devices("GPU-uuid") == []


def test_gpu_extras_for_maps_cuda_visible_devices():
    devices = [{"index": 0, "name": "cuda:0"}]
    smi_rows = parse_nvidia_smi(SAMPLE_SMI)
    out = gpu_extras_for(devices, smi_rows, visible=[1])
    assert out[0]["util"] is None
    assert out[0]["temp"] is None

    out = gpu_extras_for(devices, smi_rows, visible=None)
    assert out[0]["util"] == 42.0
    assert out[0]["cardUsed"] == 12000 * 1024 * 1024
