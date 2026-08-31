def test_node_mappings():
    from nodes import NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS

    expected = {
        "ArtThreadsDuration",
        "ArtThreadsLoadAudio",
        "ArtThreadsVideoSize",
        "ArtThreadsLongestSide",
        "ArtThreadsMonitor",
        "ArtThreadsRunTimer",
    }
    assert expected == set(NODE_CLASS_MAPPINGS)
    assert expected == set(NODE_DISPLAY_NAME_MAPPINGS)


def test_duration_run():
    from nodes.duration import ArtThreadsDuration

    frames, seconds = ArtThreadsDuration().run(
        DurationState='{"seconds":5,"fps":24,"step":17,"plus":5,"minFrames":5,"mode":"recipe"}'
    )
    assert frames == 124
    assert abs(seconds - 124 / 24) < 0.001


def test_video_size_run():
    from nodes.video_size import ArtThreadsVideoSize

    w, h, img = ArtThreadsVideoSize().run(
        VideoSizeState='{"size":896,"ratio":"16:9","step":32,"anchor":"center","allow_upscale":true,"resample":"auto"}'
    )
    assert (w, h) == (896, 512)
    assert tuple(img.shape) == (1, 64, 64, 3)
