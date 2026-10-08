import os

SRC = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT = os.path.dirname(SRC)
CACHE = os.path.join(PROJECT, "cache")
OUT = os.path.join(PROJECT, "out")
REFS = os.path.normpath(os.path.join(PROJECT, "..", "..", "refs"))
BLENDER = "/Applications/Blender.app/Contents/MacOS/Blender"
