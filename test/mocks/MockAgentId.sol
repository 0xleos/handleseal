// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice Test double for the live Agent ID registry.
/// @dev Behavior matched against chain 56 reads of registry
///      0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F (observed 2026-11-26):
///      - `handleOf` returns the bare handle ("218"), not "218.ai"
///      - `tokenId = uint256(keccak256(bytes(handle)))`
///      - `ownerOf(tokenId)` is the holder and reverts when the token is absent
///      - `ownerOfHandle("218")` is the holder
///      - `ownerOfHandle("218.ai")` returns address(0) and does not revert
///      Handleseal must not call `ownerOfHandle`. The unit tests assert that.
contract MockAgentId {
    mapping(address => string) public handleOf;
    mapping(address => uint256) public balanceOf;
    mapping(uint256 => address) private _owners;

    function register(address account, string calldata handle) external {
        require(account != address(0), "account");
        require(bytes(handle).length != 0, "handle");
        require(balanceOf[account] == 0, "already registered");
        uint256 tokenId = uint256(keccak256(bytes(handle)));
        require(_owners[tokenId] == address(0), "handle taken");
        handleOf[account] = handle;
        balanceOf[account] = 1;
        _owners[tokenId] = account;
    }

    /// @notice Plant a registry state that should fail the Handleseal gate.
    function setRaw(address account, string calldata handle, uint256 balance, address tokenOwner)
        external
    {
        handleOf[account] = handle;
        balanceOf[account] = balance;
        if (bytes(handle).length != 0) {
            _owners[uint256(keccak256(bytes(handle)))] = tokenOwner;
        }
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        address owner = _owners[tokenId];
        require(owner != address(0), "ERC721NonexistentToken");
        return owner;
    }

    /// @notice Live-shaped forward lookup. Not used by Handleseal.
    function ownerOfHandle(string calldata handle) external view returns (address) {
        return _owners[uint256(keccak256(bytes(handle)))];
    }
}
