# Handleseal 部署记录

本文只记录已经冻结的字节码和 CREATE2 预测地址。**现在不要部署。**

部署会向链 56 广播一笔交易并花费 gas。那是以后单独的付费步骤：必须重新报价，并向你明确确认费用和这笔交易之后，才能广播。本仓库没有广播脚本，也不包含私钥。

Do not broadcast this deployment. It spends gas and is a later step. Quote the fee again and wait for an explicit confirmation before any transaction is sent.

## Compiler

| Setting | Value |
| --- | --- |
| Contract | `contracts/Handleseal.sol` → `Handleseal` |
| solc | `0.8.28+commit.7893614a` |
| Optimizer | enabled, **200** runs |
| via IR | false |
| EVM | `cancun` |
| Metadata | `bytecodeHash = ipfs`, CBOR metadata on |
| Constructor arguments | none |
| Libraries | none |
| Forge | 1.10.0 (`083e229941`) |

`forge build` may print lints about the `uint64` timestamp cast and `balanceOf == 0`. Those checks are intentional: a timestamp fits in `uint64`, and a zero balance is the specified identity gate. They are not a reason to edit the frozen source.

## Reproduce

```bash
forge build
forge inspect Handleseal bytecode
forge inspect Handleseal deployedBytecode
script/predict_create2.sh --check
```

`--check` rebuilds and compares the bytecode, hashes, and address with `deploy/manifest.json`. It does not broadcast. `--write` regenerates `deploy/initcode.hex`, `deploy/runtime.hex`, `deploy/manifest.json`, and `frontend/js/abi.js` after an intentional source change. A source change also needs a new address in `frontend/js/config.js`, `skill/SKILL.md`, and this file.

## Bytecode

| Artifact | Size | keccak256 |
| --- | --- | --- |
| Init code (`forge inspect Handleseal bytecode`) | **4845** bytes | `0x49b53f6e7e6929b97c71e9f5e3e8fd772a0fb7814310a64c79bbfbb4cce4315a` |
| Runtime code (`forge inspect Handleseal deployedBytecode`) | **4817** bytes | `0x3f6d8141bdb5a280e44aaa59eec99502e0569f1044d852857921ec47524952fb` |

Each hex file is a single line and includes the `0x` prefix:

- `deploy/initcode.hex`
- `deploy/runtime.hex`
- `deploy/manifest.json`

## CREATE2

| Field | Value |
| --- | --- |
| Factory | `0x4e59b44847b379578588920cA78FbF26c0B4956C` |
| Factory note | Arachnid deterministic deployment proxy. Observed on chain 56 with 69 bytes of code, keccak `0x2fa86add0aed31f33a762c9d88e807c475bd51d0f52bd0955754b2608f7e4989`, at block 135820196 on 2026-11-26. |
| Salt preimage | `handleseal-v1` (UTF-8, no newline) |
| Salt | `keccak256(preimage)` = `0xefb4a59946552036bbe4e4fa2ba001fcb63c69dc7313b156fe1eff80f1e79d73` |
| Formula | `address = keccak256(0xff ++ factory ++ salt ++ keccak256(initcode))[12:]` |
| Predicted address | `0x79E48BE7a6AfA67eE82aF4d3cA75387dE7F599F9` |

The factory takes calldata `salt (32 bytes) || initcode` and value 0. The first 32 bytes are `calldataload(0)`, and the rest is the init code passed to `CREATE2`.

On 2026-11-26, at block 135820196, `eth_getCode` of the predicted address was empty. That observation can go stale. Read the code again before telling anyone the contract is live. This file is not a deployment.

`forge test` includes `test_predictedCreate2Address`, which recomputes the address from `type(Handleseal).creationCode` and the salt above.

## After a later deploy

1. Confirm `eth_getCode(0x79E48BE7a6AfA67eE82aF4d3cA75387dE7F599F9)` equals `deploy/runtime.hex`.
2. Verify the source on BscScan with the compiler settings in the table above.
3. Read `REGISTRY()` and confirm it is `0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F`.
4. Confirm there is still no `owner`, `pause`, or fee function.

The BscScan link in the site is a placeholder until those steps are done.
