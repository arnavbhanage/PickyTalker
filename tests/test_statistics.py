import numpy as np
from src.profiling.stats import icc1


def test_icc_high_when_groups_differ():
    g = np.repeat(np.arange(50), 10)
    x = g + np.random.default_rng(0).normal(0, 0.1, g.size)
    assert icc1(x, g) > 0.9


def test_icc_near_zero_for_noise():
    rng = np.random.default_rng(1)
    g = np.repeat(np.arange(200), 5)
    assert abs(icc1(rng.normal(size=g.size), g)) < 0.1