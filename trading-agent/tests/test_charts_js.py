"""The chart page's pattern spotter must recognise every example in its own pattern library."""

import os
import shutil
import subprocess

import pytest

HERE = os.path.dirname(os.path.abspath(__file__))


@pytest.mark.skipif(shutil.which("node") is None, reason="node not installed")
def test_pattern_library_examples_are_detected():
    r = subprocess.run(["node", os.path.join(HERE, "js", "patterns_check.cjs")], capture_output=True, text=True, timeout=60)
    assert r.returncode == 0, r.stdout + r.stderr
    assert "13/13" in r.stdout


@pytest.mark.skipif(shutil.which("node") is None, reason="node not installed")
def test_training_simulator_and_question_bank():
    r = subprocess.run(["node", os.path.join(HERE, "js", "train_check.cjs")], capture_output=True, text=True, timeout=60)
    assert r.returncode == 0, r.stdout + r.stderr
    assert "ALL OK" in r.stdout
