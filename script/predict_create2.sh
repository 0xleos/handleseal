#!/usr/bin/env bash
# Reproduce the Handleseal CREATE2 address. This script never broadcasts.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v forge >/dev/null 2>&1 || ! command -v cast >/dev/null 2>&1; then
  if [[ -x "$HOME/.foundry/bin/forge" ]]; then
    export PATH="$HOME/.foundry/bin:$PATH"
  else
    echo "forge and cast are required" >&2
    exit 1
  fi
fi

MODE="check"
if [[ "${1:-}" == "--write" ]]; then
  MODE="write"
elif [[ "${1:-}" != "--check" && "${1:-}" != "" ]]; then
  echo "usage: script/predict_create2.sh [--check|--write]" >&2
  exit 2
fi

forge build >/dev/null

INIT="$(forge inspect Handleseal bytecode | tr -d '[:space:]')"
RUN="$(forge inspect Handleseal deployedBytecode | tr -d '[:space:]')"
SALT_PREIMAGE="handleseal-v1"
SALT="$(cast keccak "$SALT_PREIMAGE")"
INIT_HASH="$(cast keccak "$INIT")"
RUN_HASH="$(cast keccak "$RUN")"
FACTORY="0x4e59b44847b379578588920cA78FbF26c0B4956C"
PACKED="$(cast concat-hex 0xff "$FACTORY" "$SALT" "$INIT_HASH")"
DIGEST="$(cast keccak "$PACKED")"
ADDR="$(cast to-check-sum-address "0x${DIGEST:26}")"
INIT_BYTES="$(( (${#INIT} - 2) / 2 ))"
RUN_BYTES="$(( (${#RUN} - 2) / 2 ))"

python3 - "$MODE" "$INIT" "$RUN" "$SALT" "$INIT_HASH" "$RUN_HASH" "$ADDR" "$INIT_BYTES" "$RUN_BYTES" <<'PY'
import json, pathlib, sys
mode, init, run, salt, init_hash, run_hash, addr, init_bytes, run_bytes = sys.argv[1:10]
root = pathlib.Path(".")
manifest = {
    "contract": "Handleseal",
    "solc": "0.8.28+commit.7893614a",
    "optimizer": True,
    "optimizer_runs": 200,
    "via_ir": False,
    "evm_version": "cancun",
    "bytecode_hash": "ipfs",
    "cbor_metadata": True,
    "constructor_args": None,
    "salt_preimage": "handleseal-v1",
    "salt": salt,
    "initcode_bytes": int(init_bytes),
    "initcode_keccak256": init_hash,
    "runtime_bytes": int(run_bytes),
    "runtime_keccak256": run_hash,
    "factory": "0x4e59b44847b379578588920cA78FbF26c0B4956C",
    "address": addr,
    "formula": "keccak256(0xff ++ factory ++ salt ++ keccak256(initcode))[12:]",
}
path = root / "deploy" / "manifest.json"
if mode == "write":
    (root / "deploy").mkdir(exist_ok=True)
    (root / "deploy" / "initcode.hex").write_text(init + "\n")
    (root / "deploy" / "runtime.hex").write_text(run + "\n")
    path.write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps(manifest, indent=2))
else:
    have = json.loads(path.read_text())
    keys = [
        "salt",
        "initcode_bytes",
        "initcode_keccak256",
        "runtime_bytes",
        "runtime_keccak256",
        "factory",
        "address",
    ]
    mismatch = []
    for key in keys:
        if have.get(key) != manifest[key]:
            mismatch.append(f"{key}: manifest={have.get(key)} built={manifest[key]}")
    init_file = (root / "deploy" / "initcode.hex").read_text().strip()
    run_file = (root / "deploy" / "runtime.hex").read_text().strip()
    if init_file != init:
        mismatch.append("deploy/initcode.hex does not match forge inspect bytecode")
    if run_file != run:
        mismatch.append("deploy/runtime.hex does not match forge inspect deployedBytecode")
    if mismatch:
        print("\n".join(mismatch), file=sys.stderr)
        sys.exit(1)
    print(f"ok {addr}")
PY

python3 script/sync_abi.py "$MODE"
