// Single place to point the site at a deployed Handleseal.
// The default is the CREATE2 prediction in DEPLOY.md / deploy/manifest.json.
// After a confirmed deploy, replace contractAddress only if the address changed.
window.HANDLESEAL_CONFIG = {
  chainId: 56,
  chainIdHex: "0x38",
  contractAddress: "0x79E48BE7a6AfA67eE82aF4d3cA75387dE7F599F9",
  registryAddress: "0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F",
  factory: "0x4e59b44847b379578588920cA78FbF26c0B4956C",
  rpcUrls: [
    "https://bsc-dataseed.bnbchain.org",
    "https://bsc.publicnode.com",
    "https://1rpc.io/bnb"
  ],
  maxLabelBytes: 80,
  explorer: "https://bscscan.com/address/"
};
