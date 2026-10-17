#!/usr/bin/env python3
"""Read-only ZIP metadata inventory. Never extracts or uploads ECU file contents."""
import csv
import hashlib
import json
import pathlib
import sys
import zipfile
from collections import Counter
from datetime import datetime, timezone

EXTS = {".a2l", ".damos", ".ols", ".xdf", ".bin", ".hex", ".ori", ".mod", ".frf", ".sgo", ".kp", ".map"}
def main(source, target):
    source, target = pathlib.Path(source), pathlib.Path(target)
    target.mkdir(parents=True, exist_ok=True)
    digest = hashlib.sha256()
    with source.open("rb") as f:
        for block in iter(lambda: f.read(4 * 1024 * 1024), b""):
            digest.update(block)
    rows, extensions, errors = [], Counter(), []
    with zipfile.ZipFile(source) as z:
        for info in z.infolist():
            if info.is_dir():
                continue
            suffix = pathlib.PurePosixPath(info.filename).suffix.lower()
            extensions[suffix or "(none)"] += 1
            rows.append({"path": info.filename, "extension": suffix, "bytes": info.file_size,
                         "compressed_bytes": info.compress_size, "crc32": f"{info.CRC:08x}",
                         "encrypted": bool(info.flag_bits & 1), "ecu_candidate": suffix in EXTS})
        # Validate CRC of unencrypted members, without writing files to disk.
        for info in z.infolist():
            if info.is_dir():
                continue
            if info.flag_bits & 1:
                errors.append({"path": info.filename, "error": "encrypted: cannot verify"})
                continue
            try:
                with z.open(info) as f:
                    for _ in iter(lambda: f.read(4 * 1024 * 1024), b""):
                        pass
            except Exception as e:
                errors.append({"path": info.filename, "error": str(e)[:300]})
    with (target / "manifest.csv").open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["path","extension","bytes","compressed_bytes","crc32","encrypted","ecu_candidate"])
        writer.writeheader()
        writer.writerows(rows)
    report = {"generated_utc": datetime.now(timezone.utc).isoformat(),
              "archive_name": source.name, "archive_size": source.stat().st_size,
              "archive_sha256": digest.hexdigest(), "file_count": len(rows),
              "ecu_candidate_count": sum(r["ecu_candidate"] for r in rows),
              "extensions": dict(extensions.most_common()), "verification_errors": errors,
              "note": "CRC validates archive transfer, not ECU calibration correctness. ZIP file contents are not uploaded."}
    (target / "report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({k: report[k] for k in ("file_count","ecu_candidate_count","verification_errors")}, ensure_ascii=False))
    if errors:
        sys.exit(2)

if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("usage: index_ecu_zip.py ARCHIVE.zip OUTPUT_DIR")
    main(sys.argv[1], sys.argv[2])
