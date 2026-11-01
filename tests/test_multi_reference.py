"""Unit tests for Multi Reference ArtThreads helpers and node."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


def _load_module(name, rel_path):
    spec = importlib.util.spec_from_file_location(name, ROOT / rel_path)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


def test_parse_state():
    mod = _load_module("artthreads_mr_lib", "lib/multi_reference.py")
    assert mod.parse_state("{}") == {"files": []}
    assert mod.parse_state("not-json") == {"files": []}
    assert mod.parse_state('{"files":["a.png","","  b.jpg  ",3]}') == {
        "files": ["a.png", "b.jpg"]
    }


def test_resolve_rejects_absolute(tmp_path, monkeypatch):
    mod = _load_module("artthreads_mr_lib2", "lib/multi_reference.py")
    abs_path = str(tmp_path / "x.png")
    assert mod.resolve_image_path(abs_path) is None
    assert mod.resolve_image_path("") is None
    assert mod.resolve_image_path(None) is None


def test_load_and_node_bundle(tmp_path, monkeypatch):
    pytest.importorskip("torch")
    from PIL import Image

    a = tmp_path / "a.png"
    b = tmp_path / "b.png"
    Image.new("RGB", (32, 16), (255, 0, 0)).save(a)
    Image.new("RGB", (20, 40), (0, 255, 0)).save(b)

    mod = _load_module("artthreads_mr_lib3", "lib/multi_reference.py")

    def fake_resolve(name):
        p = tmp_path / name
        return str(p) if p.is_file() else None

    monkeypatch.setattr(mod, "resolve_image_path", fake_resolve)

    t0 = mod.load_image_tensor(str(a))
    t1 = mod.load_image_tensor(str(b))
    assert tuple(t0.shape) == (1, 16, 32, 3)
    assert tuple(t1.shape) == (1, 40, 20, 3)

    node_mod = _load_module("artthreads_mr_node", "nodes/multi_reference.py")
    monkeypatch.setattr(node_mod, "resolve_image_path", fake_resolve)
    monkeypatch.setattr(node_mod, "load_image_tensor", mod.load_image_tensor)

    node = node_mod.ArtThreadsMultiReference()
    state = json.dumps({"files": ["a.png", "b.png"]})
    bundle, image_list = node.run(**{node_mod.HIDDEN_INPUT: state})

    assert isinstance(bundle, tuple)
    assert len(bundle) == 2
    assert image_list is not bundle
    assert len(image_list) == 2
    assert tuple(bundle[0].shape) == (1, 16, 32, 3)
    assert tuple(bundle[1].shape) == (1, 40, 20, 3)


def test_node_empty_and_too_many(monkeypatch):
    pytest.importorskip("torch")
    node_mod = _load_module("artthreads_mr_node2", "nodes/multi_reference.py")
    node = node_mod.ArtThreadsMultiReference()

    with pytest.raises(ValueError, match="no images selected"):
        node.run(**{node_mod.HIDDEN_INPUT: "{}"})

    files = [f"f{i}.png" for i in range(10)]
    with pytest.raises(ValueError, match="at most 9"):
        node.run(**{node_mod.HIDDEN_INPUT: json.dumps({"files": files})})


def test_multi_reference_in_mappings():
    pytest.importorskip("torch")
    pkg = _load_module("artthreads_nodes_mr", "nodes/__init__.py")
    assert "ArtThreadsMultiReference" in pkg.NODE_CLASS_MAPPINGS
    assert pkg.NODE_DISPLAY_NAME_MAPPINGS["ArtThreadsMultiReference"] == "Multi Reference ArtThreads"


def test_bundle_to_stock_ref_images():
    pytest.importorskip("torch")
    import torch

    mod = _load_module("artthreads_mr_stock", "lib/multi_reference.py")
    t0 = torch.zeros(1, 8, 12, 3)
    t1 = torch.ones(1, 16, 10, 3)
    stock = mod.bundle_to_stock_ref_images((t0, t1))
    assert list(stock.keys()) == ["ref_image_0", "ref_image_1"]
    assert stock["ref_image_0"] is t0
    assert stock["ref_image_1"] is t1

    with pytest.raises(ValueError, match="empty"):
        mod.bundle_to_stock_ref_images(())
    with pytest.raises(TypeError, match="Multi Reference"):
        mod.bundle_to_stock_ref_images("nope")
    with pytest.raises(ValueError, match="at most 9"):
        mod.bundle_to_stock_ref_images(tuple(torch.zeros(1, 4, 4, 3) for _ in range(10)))


def test_reference_to_image_constants_and_mapping():
    pytest.importorskip("torch")
    node_mod = _load_module("artthreads_ref2img", "nodes/reference_to_image.py")
    assert node_mod.STILL_LENGTH == 5
    assert node_mod.MAX_QUALITY_LENGTH == 22
    assert node_mod.RECOMMENDED_STILL_FRAME == 1
    assert "ArtThreadsMiniMaxH3ReferenceToImage" in node_mod.NODE_CLASS_MAPPINGS
    assert "ArtThreadsMiniMaxH3ReferenceToImageMaxQuality" in node_mod.NODE_CLASS_MAPPINGS
    assert (
        node_mod.NODE_DISPLAY_NAME_MAPPINGS["ArtThreadsMiniMaxH3ReferenceToImage"]
        == "Reference to Image ArtThreads"
    )
    assert (
        node_mod.NODE_DISPLAY_NAME_MAPPINGS["ArtThreadsMiniMaxH3ReferenceToImageMaxQuality"]
        == "Reference to Image Max Quality ArtThreads"
    )
    types = node_mod.ArtThreadsMiniMaxH3ReferenceToImage.INPUT_TYPES()
    assert "artthreads_ref_images" in types["required"]
    assert "length" not in types["required"]
    hq = node_mod.ArtThreadsMiniMaxH3ReferenceToImageMaxQuality.INPUT_TYPES()
    assert "still_frame_index" in hq["required"]
    assert "ref_image_size" not in hq["required"]
