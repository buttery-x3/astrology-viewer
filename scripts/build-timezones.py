"""Extract pinned IANA sources and convert range-bounded TZif to Moment records.

No host timezone database or private zoneinfo API is used. Every extracted period
is independently checked with Python's public ZoneInfo.from_file API.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import struct
import tarfile
from zoneinfo import ZoneInfo

LOWER = -2240524800  # 1899-01-01T00:00:00Z
UPPER = 4165516800   # 2102-01-01T00:00:00Z
EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)


def extract(archives: list[str], directory: str) -> None:
    target = Path(directory)
    target.mkdir(parents=True, exist_ok=True)
    for archive in archives:
        with tarfile.open(archive) as source:
            # Python's data filter rejects paths escaping the extraction root.
            source.extractall(target, filter="data")


def load_tzif(path: Path) -> tuple[list[int], list[int], list[tuple[int, bool, str]]]:
    data = path.read_bytes()

    def header(at: int) -> tuple[bytes, tuple[int, ...]]:
        if data[at:at + 4] != b"TZif":
            raise ValueError(f"Not a TZif file: {path}")
        return data[at + 4:at + 5], struct.unpack_from(">6I", data, at + 20)

    def block_size(counts: tuple[int, ...], width: int) -> int:
        isut, isstd, leaps, transitions, types, chars = counts
        return transitions * (width + 1) + types * 6 + chars + leaps * (width + 4) + isstd + isut

    version, counts = header(0)
    width, at = 4, 44
    if version in (b"2", b"3", b"4"):
        at += block_size(counts, width)
        _, counts = header(at)
        at += 44
        width = 8
    _, _, _, transition_count, type_count, char_count = counts
    code = "q" if width == 8 else "i"
    transitions = list(struct.unpack_from(f">{transition_count}{code}", data, at))
    at += transition_count * width
    indices = list(data[at:at + transition_count])
    at += transition_count
    raw_types = [struct.unpack_from(">lBB", data, at + index * 6) for index in range(type_count)]
    at += type_count * 6
    abbreviation_bytes = data[at:at + char_count]
    types = []
    for offset, daylight, abbreviation_index in raw_types:
        end = abbreviation_bytes.index(0, abbreviation_index)
        abbreviation = abbreviation_bytes[abbreviation_index:end].decode("ascii")
        types.append((offset, bool(daylight), abbreviation))
    return transitions, indices, types


def unpack(directory: str, source: str, output: str) -> None:
    names: set[str] = set()
    for line in Path(source).read_text(encoding="utf-8-sig").splitlines():
        fields = line.split("#", 1)[0].split()
        if fields and fields[0] == "Zone":
            names.add(fields[1])
        elif fields and fields[0] == "Link":
            names.add(fields[2])
    records = []
    verified_periods = 0
    for name in sorted(names):
        if name.startswith("/") or ".." in name.split("/"):
            raise ValueError(f"Invalid zone path: {name}")
        path = Path(directory) / name
        transitions, indices, types = load_tzif(path)
        if not types:
            raise ValueError(f"No local-time types: {name}")
        with path.open("rb") as zone_file:
            reference = ZoneInfo.from_file(zone_file, name)
        current = types[0]
        periods: list[tuple[int | None, tuple[int, bool, str]]] = []
        for instant, index in zip(transitions, indices, strict=True):
            if instant <= LOWER:
                current = types[index]
            elif instant < UPPER:
                periods.append((instant, current))
                current = types[index]
            else:
                break
        periods.append((None, current))
        # Coalesce identical neighbouring offset/abbreviation pairs. DST flags
        # do not affect civil conversion, and Moment's format does not store them.
        compact: list[tuple[int | None, tuple[int, bool, str]]] = []
        for until, local_type in periods:
            if compact and compact[-1][1][0] == local_type[0] and compact[-1][1][2] == local_type[2]:
                compact[-1] = (until, local_type)
            else:
                compact.append((until, local_type))
        start = LOWER
        for until, (offset, _, abbreviation) in compact:
            end = UPPER if until is None else until
            for instant in {start, min(start + 1, end - 1), end - 1}:
                local = (EPOCH + timedelta(seconds=instant)).astimezone(reference)
                if int(local.utcoffset().total_seconds()) != offset or local.tzname() != abbreviation:
                    raise ValueError(f"TZif parser/ZoneInfo mismatch: {name} at {instant}")
            verified_periods += 1
            start = end
        records.append({
            "name": name,
            "abbrs": [local_type[2] for _, local_type in compact],
            "offsets": [-local_type[0] / 60 for _, local_type in compact],
            "untils": [None if until is None else until * 1000 for until, _ in compact],
        })
    Path(output).write_text(json.dumps({"zones": records, "verifiedPeriods": verified_periods}, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Parsed {len(records)} zones; independently verified {verified_periods} periods with ZoneInfo.from_file.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    actions = parser.add_subparsers(dest="action", required=True)
    extraction = actions.add_parser("extract")
    extraction.add_argument("--archive", action="append", required=True)
    extraction.add_argument("--directory", required=True)
    conversion = actions.add_parser("unpack")
    conversion.add_argument("--directory", required=True)
    conversion.add_argument("--source", required=True)
    conversion.add_argument("--output", required=True)
    args = parser.parse_args()
    if args.action == "extract":
        extract(args.archive, args.directory)
    else:
        unpack(args.directory, args.source, args.output)
