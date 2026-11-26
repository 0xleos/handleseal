// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Handleseal} from "../contracts/Handleseal.sol";

/// @notice Read-only fork checks against the live registry.
/// @dev Skipped unless BSC_RPC_URL is set. This test never broadcasts.
interface IAgentIdLive {
    function balanceOf(address owner) external view returns (uint256);
    function handleOf(address owner) external view returns (string memory);
    function ownerOf(uint256 tokenId) external view returns (address);
    function ownerOfHandle(string calldata handle) external view returns (address);
}

contract HandlesealForkTest is Test {
    address internal constant REGISTRY = 0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F;
    /// @dev Holder of bare handle "218", read on 2026-11-26. Soulbound, so this is stable.
    address internal constant HOLDER_218 = 0xb113647078DD2a03FF2F1aaDba8244Bbac0926bf;

    function testFork_live218Binding() public {
        string memory rpc = vm.envOr("BSC_RPC_URL", string(""));
        if (bytes(rpc).length == 0) {
            vm.skip(true, "set BSC_RPC_URL to run the live registry fork check");
            return;
        }
        vm.createSelectFork(rpc);

        IAgentIdLive live = IAgentIdLive(REGISTRY);
        assertEq(live.handleOf(HOLDER_218), "218");
        assertEq(live.balanceOf(HOLDER_218), 1);

        uint256 tokenId = uint256(keccak256(bytes("218")));
        assertEq(live.ownerOf(tokenId), HOLDER_218);
        assertEq(live.ownerOfHandle("218"), HOLDER_218);
        assertEq(live.ownerOfHandle("218.ai"), address(0));

        Handleseal hs = new Handleseal();
        assertTrue(hs.isAgent(HOLDER_218));
        assertEq(hs.agentHandle(HOLDER_218), "218");
        assertFalse(hs.isAgent(address(0xBEEF)));
        assertEq(hs.agentHandle(address(0xBEEF)), "");
    }
}
