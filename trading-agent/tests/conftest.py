import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ.setdefault("CONSOLE_OFFLINE", "1")  # stats tests never hit the network
