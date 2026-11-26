# Handleseal

用你的 Agent ID，给一段内容的 keccak256 哈希盖一枚不可更改的印。另一个持有 Agent ID 的人可以见证这枚印。文件和原文留在你自己的设备上。没有代币，没有协议费，也没有收益。

Handleseal lets an Agent ID seal a keccak256 hash. Another Agent ID can witness that seal. The file never leaves the device. There is no token, no protocol fee, and no yield.

实验性软件。一枚印只是对哈希的时间戳承诺，不能证明文件为真，不是法律意见，也不承诺收益、奖励或回报。

链：56。身份注册表（只读）：`0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F`。

合约地址（链 56，已部署，BscScan 源码完全匹配）：`0x79E48BE7a6AfA67eE82aF4d3cA75387dE7F599F9`。数字和字节码见 [DEPLOY.md](DEPLOY.md)。

## 这是什么

链上的 `handleOf` 返回不带后缀的名字，例如 `218`。本站把它显示成 `218.ai`。盖印和见证使用同一套校验，而且**不**调用 `ownerOfHandle`：

1. `balanceOf(account) > 0`
2. `handle = handleOf(account)` 非空
3. `tokenId = uint256(keccak256(bytes(handle)))`
4. `ownerOf(tokenId) == account`

印上保存：盖印人、名字、token id、内容哈希、可选标签（最多 80 字节）、时间。见证另记。印记不能修改或删除。

## 怎么用

静态页面在 `frontend/`，不需要构建。

```bash
python3 -m http.server 38471 --directory frontend
```

打开 `http://127.0.0.1:38471`。

- **介绍**：产品是什么，怎样获得 Agent ID，以及实验性声明。
- **盖印**：只连接注入的 EIP-1193 钱包（例如钱包内置浏览器）。在本地对文本或文件做 keccak256，文件不会上传。可选公开标签。先核对，再提交。钱包还会再确认一次。
- **核验**：只按印记编号或内容哈希。没有按名字查钱包的入口。
- **公开印**：只列出作者自愿写了标签的印，不是 Agent ID 名录。
- **文档**：方法、所有者权限、BscScan 上已验证的源码，以及 `baw` 的预览 → 确认 → 执行示例。

获得 Agent ID 的技术说明：<https://docs.space.id/agent-id>。本站不能代你注册。

代理钱包的操作说明在 [skill/SKILL.md](skill/SKILL.md)。写操作只走官方 `baw contract-call`：先 `preview`，向本人展示解析后的条款和风险，得到明确同意之后，才 `execute`。`requireConfirmation: false` 也不能跳过这次同意。

## 所有者权限：无

合约没有 owner、管理员、暂停、手续费、升级、代理或提取函数。没有人可以改掉一枚印。误打进合约的金额也取不回来，因为没有管理员。`frontend/docs.html` 和本文件作同样披露。

## 红线

- 不处理私钥、助记词、API 密钥或配对码。仓库里没有这些秘密。
- 没有后端，没有用户账户，没有服务端会话，也不使用第三方 Agentic Wallet 二维码或配对码登录。
- 不是按 Agent ID 名字查询他人钱包的工具。
- 本仓库不部署、不广播交易、不花费 gas，也不提交黑客松问卷。
- 合约已经在链 56 上。不要从本仓库再广播一笔部署交易。见 [DEPLOY.md](DEPLOY.md)。
- 不承诺收益、奖励或回报。

## 如何在 BscScan 核对

1. 打开 <https://bscscan.com/address/0x79E48BE7a6AfA67eE82aF4d3cA75387dE7F599F9#code>。源码验证为完全匹配。
2. 确认 `eth_getCode` 与 `deploy/runtime.hex` 一致，keccak256 为 `0x3f6d8141bdb5a280e44aaa59eec99502e0569f1044d852857921ec47524952fb`。
3. 编译设置是 solc `0.8.28+commit.7893614a`、优化器开启、200 次、Cancun、关闭 via-IR、无构造参数。
4. 读 `REGISTRY()`，应为 `0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F`。
5. 确认没有 `owner`、`pause` 或费用函数。

如果实际部署地址不同，只改 `frontend/js/config.js` 里的 `contractAddress`，并同步文档中的链接。

## 运行测试

需要 [Foundry](https://book.getfoundry.sh/getting-started/installation)。`forge-std` 以子模块放在 `lib/forge-std`。

```bash
git submodule update --init --recursive
forge test
script/predict_create2.sh --check
```

`forge test` 会跳过需要 RPC 的分叉测试。要对照链上真实注册表再跑一次（只读，不广播）：

```bash
BSC_RPC_URL=https://bsc-dataseed.bnbchain.org forge test --match-test testFork_live218Binding
```

该测试核对：`handleOf` 返回 `218` 而不是 `218.ai`，`ownerOf(keccak256("218"))` 是持有人，`ownerOfHandle("218.ai")` 为 `address(0)`，并且 Handleseal 的 `isAgent` / `agentHandle` 与此一致。

## 发布静态页

把本仓库公开为名为 `handleseal` 的 GitHub 仓库之后，在仓库设置里打开 Pages，来源选 GitHub Actions。`.github/workflows/pages.yml` 会发布 `frontend/`。页面地址会是 `https://<github 用户名>.github.io/handleseal/`。也可以直接把 `frontend/` 当作静态文件打开或托管。

60 秒产品演示：<https://0xleos.github.io/handleseal/handleseal-demo.mp4>

第三方库：`frontend/vendor/ethers.umd.min.js` 是 MIT 许可的 ethers.js 5.7.2，只用于本地 keccak256 和 ABI 编码。见 `frontend/vendor/SOURCES.txt`。

## English

Handleseal records that an Agent ID committed to a keccak256 hash at a moment in time. Witnesses are other Agent ID holders. The preimage stays off-chain. The contract is immutable: no owner, no admin, no pause, no fee, no proxy, and no token.

The on-chain handle has no `.ai` suffix. The site displays `218` as `218.ai`. The identity gate is `balanceOf`, non-empty `handleOf`, `tokenId = uint256(keccak256(bytes(handle)))`, and `ownerOf(tokenId) == account`. `ownerOfHandle` is not a gate. In particular, `ownerOfHandle("218.ai")` is not consulted.

**Owner permissions: none.**

The contract is deployed on chain 56 at `0x79E48BE7a6AfA67eE82aF4d3cA75387dE7F599F9`. BscScan shows an exact source match. Do not broadcast another deployment from this repository. See [DEPLOY.md](DEPLOY.md).

Run the site with `python3 -m http.server 38471 --directory frontend`. Run `forge test` and `script/predict_create2.sh --check`. The optional fork test is read-only and runs only when `BSC_RPC_URL` is set.

BscScan verifies that source as an exact match. Runtime bytecode matches `deploy/runtime.hex`, and `REGISTRY()` is the Agent ID registry above.

Red lines: no keys or pairing codes, no backend or accounts, no QR pairing login, no handle-to-wallet directory, no broadcast from this repo, and no promise of yield.

License: [MIT](LICENSE).
