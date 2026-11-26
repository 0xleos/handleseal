// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title IAgentId
/// @notice The three registry reads Handleseal uses as an identity gate.
/// @dev `handleOf` returns the bare handle, for example "218", never "218.ai".
///      `tokenId` is `uint256(keccak256(bytes(handle)))`.
///      `ownerOfHandle` exists on the live registry and is intentionally absent
///      here. It is not a gate input. In particular, `ownerOfHandle("218.ai")`
///      is not consulted: on the live registry that call returns address(0).
interface IAgentId {
    function balanceOf(address owner) external view returns (uint256);
    function handleOf(address owner) external view returns (string memory);
    function ownerOf(uint256 tokenId) external view returns (address);
}

/// @title Handleseal
/// @author nacai — Agent ID hackathon entry. Experimental software. No yield.
/// @notice An Agent ID holder seals a content hash. Another holder may witness it.
/// @dev Immutable. No owner, admin, pause, fee, token, proxy, or payable function.
///
/// Identity gate for `seal` and `witness`, in this order:
/// 1. `REGISTRY.balanceOf(account) > 0`
/// 2. `handle = REGISTRY.handleOf(account)` is non-empty
/// 3. `tokenId = uint256(keccak256(bytes(handle)))`
/// 4. `REGISTRY.ownerOf(tokenId) == account`
///
/// The handle stored and emitted is the bare `handleOf` string. Clients display
/// it with a ".ai" suffix (218 → 218.ai). The suffix is not part of the hash
/// preimage and is not written on-chain.
///
/// A seal stores the sealer, handle, token id, content hash, label, and time.
/// It does not store the preimage. Seals cannot be edited or removed.
contract Handleseal {
    /// @notice SPACE ID Agent ID registry on BNB Smart Chain (chain id 56).
    IAgentId public constant REGISTRY = IAgentId(0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F);

    /// @notice Maximum label length, measured in bytes, not characters.
    uint256 public constant MAX_LABEL_BYTES = 80;

    struct Seal {
        address sealer;
        uint64 sealedAt;
        uint256 tokenId;
        bytes32 contentHash;
        string handle;
        string label;
    }

    struct Witness {
        address witness;
        uint64 witnessedAt;
        uint256 tokenId;
        string handle;
    }

    struct SealInfo {
        address sealer;
        string handle;
        uint256 tokenId;
        bytes32 contentHash;
        string label;
        uint64 sealedAt;
        uint256 witnessCount;
    }

    uint256 public sealCount;

    mapping(uint256 sealId => Seal) private _seals;
    mapping(uint256 sealId => Witness[]) private _witnesses;
    mapping(uint256 sealId => mapping(address witness => bool)) public hasWitnessed;
    mapping(address sealer => uint256[]) private _sealsOf;
    mapping(bytes32 contentHash => uint256[]) private _sealsByHash;

    event Sealed(
        uint256 indexed sealId,
        address indexed sealer,
        bytes32 indexed contentHash,
        string handle,
        uint256 tokenId,
        string label,
        uint64 sealedAt
    );

    event Witnessed(
        uint256 indexed sealId,
        address indexed witness,
        string handle,
        uint256 tokenId,
        uint64 witnessedAt
    );

    error NotAgent();
    error EmptyHandle();
    error HandleTokenMismatch();
    error ZeroContentHash();
    error LabelTooLong(uint256 length, uint256 max);
    error UnknownSeal(uint256 sealId);
    error WitnessOwnSeal();
    error AlreadyWitnessed();

    /// @notice Seal `contentHash` under the caller's Agent ID.
    /// @param contentHash keccak256 of the preimage. Zero is rejected.
    /// @param label Optional public label, at most 80 bytes. Empty is allowed.
    /// @return sealId Identifier of the new seal. The first seal is 1.
    function seal(bytes32 contentHash, string calldata label) external returns (uint256 sealId) {
        if (contentHash == bytes32(0)) revert ZeroContentHash();
        uint256 labelLength = bytes(label).length;
        if (labelLength > MAX_LABEL_BYTES) revert LabelTooLong(labelLength, MAX_LABEL_BYTES);

        (string memory handle, uint256 tokenId) = _identity(msg.sender);

        sealId = ++sealCount;
        uint64 sealedAt = uint64(block.timestamp);
        _seals[sealId] = Seal({
            sealer: msg.sender,
            sealedAt: sealedAt,
            tokenId: tokenId,
            contentHash: contentHash,
            handle: handle,
            label: label
        });
        _sealsOf[msg.sender].push(sealId);
        _sealsByHash[contentHash].push(sealId);

        emit Sealed(sealId, msg.sender, contentHash, handle, tokenId, label, sealedAt);
    }

    /// @notice Witness an existing seal. One witness per address per seal.
    /// @dev The caller cannot witness a seal they created.
    function witness(uint256 sealId) external {
        Seal storage stored = _requireSeal(sealId);
        if (stored.sealer == msg.sender) revert WitnessOwnSeal();

        (string memory handle, uint256 tokenId) = _identity(msg.sender);
        if (hasWitnessed[sealId][msg.sender]) revert AlreadyWitnessed();

        uint64 witnessedAt = uint64(block.timestamp);
        hasWitnessed[sealId][msg.sender] = true;
        _witnesses[sealId].push(
            Witness({
                witness: msg.sender, witnessedAt: witnessedAt, tokenId: tokenId, handle: handle
            })
        );

        emit Witnessed(sealId, msg.sender, handle, tokenId, witnessedAt);
    }

    /// @notice Full record for one seal, including how many witnesses it has.
    function getSeal(uint256 sealId) external view returns (SealInfo memory info) {
        Seal storage stored = _requireSeal(sealId);
        info = SealInfo({
            sealer: stored.sealer,
            handle: stored.handle,
            tokenId: stored.tokenId,
            contentHash: stored.contentHash,
            label: stored.label,
            sealedAt: stored.sealedAt,
            witnessCount: _witnesses[sealId].length
        });
    }

    /// @notice Seal ids created by `sealer`, in creation order.
    function sealsOf(address sealer) external view returns (uint256[] memory) {
        return _sealsOf[sealer];
    }

    /// @notice Seal ids that committed to `contentHash`, in creation order.
    function sealsByHash(bytes32 contentHash) external view returns (uint256[] memory) {
        return _sealsByHash[contentHash];
    }

    /// @notice Witnesses of a seal, in the order they were recorded.
    function witnessesOf(uint256 sealId) external view returns (Witness[] memory) {
        _requireSeal(sealId);
        return _witnesses[sealId];
    }

    /// @notice Whether `account` currently passes the identity gate.
    function isAgent(address account) external view returns (bool) {
        (BindStatus status,,) = _bind(account);
        return status == BindStatus.Ok;
    }

    /// @notice Bare handle for `account`, or "" when the identity gate fails.
    /// @dev Clients append ".ai" for display. This function does not.
    function agentHandle(address account) external view returns (string memory handle) {
        BindStatus status;
        (status, handle,) = _bind(account);
        if (status != BindStatus.Ok) return "";
    }

    enum BindStatus {
        Ok,
        NotAgent,
        EmptyHandle,
        Mismatch
    }

    function _identity(address account)
        private
        view
        returns (string memory handle, uint256 tokenId)
    {
        BindStatus status;
        (status, handle, tokenId) = _bind(account);
        if (status == BindStatus.NotAgent) revert NotAgent();
        if (status == BindStatus.EmptyHandle) revert EmptyHandle();
        if (status == BindStatus.Mismatch) revert HandleTokenMismatch();
    }

    function _bind(address account)
        private
        view
        returns (BindStatus status, string memory handle, uint256 tokenId)
    {
        if (REGISTRY.balanceOf(account) == 0) return (BindStatus.NotAgent, "", 0);

        string memory resolved = REGISTRY.handleOf(account);
        if (bytes(resolved).length == 0) return (BindStatus.EmptyHandle, "", 0);

        uint256 id = uint256(keccak256(bytes(resolved)));
        try REGISTRY.ownerOf(id) returns (address owner) {
            if (owner != account) return (BindStatus.Mismatch, "", 0);
        } catch {
            return (BindStatus.Mismatch, "", 0);
        }
        return (BindStatus.Ok, resolved, id);
    }

    function _requireSeal(uint256 sealId) private view returns (Seal storage stored) {
        if (sealId == 0 || sealId > sealCount) revert UnknownSeal(sealId);
        stored = _seals[sealId];
    }
}
