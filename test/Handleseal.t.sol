// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {Handleseal} from "../contracts/Handleseal.sol";
import {MockAgentId} from "./mocks/MockAgentId.sol";

contract HandlesealTest is Test {
    address internal constant REGISTRY = 0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F;
    bytes4 internal constant OWNER_OF_HANDLE = bytes4(keccak256("ownerOfHandle(string)"));

    Handleseal internal hs;
    MockAgentId internal registry;

    address internal alice;
    address internal bob;
    address internal carol;

    function setUp() public {
        MockAgentId impl = new MockAgentId();
        vm.etch(REGISTRY, address(impl).code);
        registry = MockAgentId(REGISTRY);
        hs = new Handleseal();

        alice = makeAddr("alice");
        bob = makeAddr("bob");
        carol = makeAddr("carol");

        registry.register(alice, "218");
        registry.register(bob, "bob");
    }

    function test_registryConstantMatchesLiveDeployment() public view {
        assertEq(address(hs.REGISTRY()), REGISTRY);
        assertEq(hs.MAX_LABEL_BYTES(), 80);
    }

    /// @dev Locks the frozen init code to the CREATE2 address in DEPLOY.md.
    function test_predictedCreate2Address() public view {
        bytes32 salt = keccak256("handleseal-v1");
        bytes32 initHash = keccak256(type(Handleseal).creationCode);
        assertEq(salt, 0xefb4a59946552036bbe4e4fa2ba001fcb63c69dc7313b156fe1eff80f1e79d73);
        assertEq(initHash, 0x49b53f6e7e6929b97c71e9f5e3e8fd772a0fb7814310a64c79bbfbb4cce4315a);
        assertEq(keccak256(type(Handleseal).runtimeCode), 0x3f6d8141bdb5a280e44aaa59eec99502e0569f1044d852857921ec47524952fb);
        address predicted = vm.computeCreate2Address(salt, initHash, 0x4e59b44847b379578588920cA78FbF26c0B4956C);
        assertEq(predicted, 0x79E48BE7a6AfA67eE82aF4d3cA75387dE7F599F9);
    }

    function test_mockMatchesLiveHandleBinding() public {
        assertEq(registry.handleOf(alice), "218");
        assertEq(registry.balanceOf(alice), 1);

        uint256 tokenId = uint256(keccak256(bytes("218")));
        assertEq(registry.ownerOf(tokenId), alice);
        assertTrue(tokenId != uint256(keccak256(bytes("218.ai"))));

        assertEq(registry.ownerOfHandle("218"), alice);
        assertEq(registry.ownerOfHandle("218.ai"), address(0));

        vm.expectRevert(bytes("ERC721NonexistentToken"));
        registry.ownerOf(uint256(keccak256(bytes("218.ai"))));
    }

    function test_sealBindsBareHandleAndTokenId() public {
        bytes32 contentHash = keccak256("quarterly-notes");
        _expectNoOwnerOfHandle();

        vm.prank(alice);
        uint256 sealId = hs.seal(contentHash, "notes");

        Handleseal.SealInfo memory info = hs.getSeal(sealId);
        assertEq(sealId, 1);
        assertEq(info.sealer, alice);
        assertEq(info.handle, "218");
        assertEq(info.tokenId, uint256(keccak256(bytes("218"))));
        assertTrue(info.tokenId != uint256(keccak256(bytes("218.ai"))));
        assertEq(info.contentHash, contentHash);
        assertEq(info.label, "notes");
        assertEq(info.sealedAt, block.timestamp);
        assertEq(info.witnessCount, 0);
        assertEq(hs.agentHandle(alice), "218");
        assertTrue(hs.isAgent(alice));

        uint256[] memory mine = hs.sealsOf(alice);
        assertEq(mine.length, 1);
        assertEq(mine[0], sealId);
        uint256[] memory byHash = hs.sealsByHash(contentHash);
        assertEq(byHash.length, 1);
        assertEq(byHash[0], sealId);
    }

    function test_bytecodeDoesNotReferenceOwnerOfHandle() public view {
        bytes memory selector = abi.encodePacked(OWNER_OF_HANDLE);
        assertEq(OWNER_OF_HANDLE, bytes4(0x1da94fb4));
        assertFalse(_contains(address(hs).code, selector));
        assertFalse(_contains(type(Handleseal).creationCode, selector));

        assertTrue(
            _contains(address(hs).code, abi.encodePacked(bytes4(keccak256("balanceOf(address)"))))
        );
        assertTrue(
            _contains(address(hs).code, abi.encodePacked(bytes4(keccak256("handleOf(address)"))))
        );
        assertTrue(
            _contains(address(hs).code, abi.encodePacked(bytes4(keccak256("ownerOf(uint256)"))))
        );
        assertTrue(_contains(address(hs).code, abi.encodePacked(bytes20(REGISTRY))));
    }

    function test_sealRejectsZeroHashAndLongLabel() public {
        vm.startPrank(alice);
        vm.expectRevert(Handleseal.ZeroContentHash.selector);
        hs.seal(bytes32(0), "");

        vm.expectRevert(abi.encodeWithSelector(Handleseal.LabelTooLong.selector, 81, 80));
        hs.seal(keccak256("ok"), _bytesString(81));

        uint256 sealId = hs.seal(keccak256("ok"), _bytesString(80));
        vm.stopPrank();

        assertEq(hs.getSeal(sealId).label, _bytesString(80));
    }

    function test_labelLimitIsBytesNotCharacters() public {
        // U+5370 is 3 bytes. 26 fit (78). 27 do not (81).
        string memory ok = _repeat(unicode"印", 26);
        string memory tooLong = _repeat(unicode"印", 27);
        assertEq(bytes(ok).length, 78);
        assertEq(bytes(tooLong).length, 81);

        vm.startPrank(alice);
        hs.seal(keccak256("glyph"), ok);
        vm.expectRevert(abi.encodeWithSelector(Handleseal.LabelTooLong.selector, 81, 80));
        hs.seal(keccak256("glyph-2"), tooLong);
        vm.stopPrank();
    }

    function test_identityFailures() public {
        vm.expectRevert(Handleseal.NotAgent.selector);
        vm.prank(carol);
        hs.seal(keccak256("x"), "");

        address dave = makeAddr("dave");
        registry.setRaw(dave, "", 1, address(0));
        vm.expectRevert(Handleseal.EmptyHandle.selector);
        vm.prank(dave);
        hs.seal(keccak256("x"), "");

        address eve = makeAddr("eve");
        registry.setRaw(eve, "eve", 1, alice);
        vm.expectRevert(Handleseal.HandleTokenMismatch.selector);
        vm.prank(eve);
        hs.seal(keccak256("x"), "");

        address frank = makeAddr("frank");
        registry.setRaw(frank, "frank", 1, address(0));
        vm.expectRevert(Handleseal.HandleTokenMismatch.selector);
        vm.prank(frank);
        hs.seal(keccak256("x"), "");

        address grace = makeAddr("grace");
        registry.setRaw(grace, "grace", 0, grace);
        vm.expectRevert(Handleseal.NotAgent.selector);
        vm.prank(grace);
        hs.seal(keccak256("x"), "");

        assertFalse(hs.isAgent(carol));
        assertFalse(hs.isAgent(dave));
        assertFalse(hs.isAgent(eve));
        assertFalse(hs.isAgent(frank));
        assertFalse(hs.isAgent(grace));
        assertEq(hs.agentHandle(carol), "");
        assertEq(hs.agentHandle(eve), "");
    }

    function test_witnessRulesAndIndexes() public {
        bytes32 contentHash = keccak256("shared");
        vm.prank(alice);
        uint256 first = hs.seal(contentHash, "public");
        vm.prank(alice);
        uint256 second = hs.seal(contentHash, "");

        vm.expectRevert(Handleseal.WitnessOwnSeal.selector);
        vm.prank(alice);
        hs.witness(first);

        vm.expectRevert(abi.encodeWithSelector(Handleseal.UnknownSeal.selector, uint256(0)));
        vm.prank(bob);
        hs.witness(0);

        vm.expectRevert(abi.encodeWithSelector(Handleseal.UnknownSeal.selector, uint256(99)));
        vm.prank(bob);
        hs.witness(99);

        vm.expectRevert(Handleseal.NotAgent.selector);
        vm.prank(carol);
        hs.witness(first);

        _expectNoOwnerOfHandle();
        vm.prank(bob);
        hs.witness(first);

        vm.expectRevert(Handleseal.AlreadyWitnessed.selector);
        vm.prank(bob);
        hs.witness(first);

        Handleseal.SealInfo memory info = hs.getSeal(first);
        assertEq(info.witnessCount, 1);
        assertEq(info.label, "public");
        assertEq(hs.getSeal(second).label, "");
        assertEq(hs.getSeal(second).witnessCount, 0);

        Handleseal.Witness[] memory witnesses = hs.witnessesOf(first);
        assertEq(witnesses.length, 1);
        assertEq(witnesses[0].witness, bob);
        assertEq(witnesses[0].handle, "bob");
        assertEq(witnesses[0].tokenId, uint256(keccak256(bytes("bob"))));
        assertTrue(hs.hasWitnessed(first, bob));
        assertFalse(hs.hasWitnessed(first, alice));

        uint256[] memory both = hs.sealsByHash(contentHash);
        assertEq(both.length, 2);
        assertEq(both[0], first);
        assertEq(both[1], second);
        assertEq(hs.sealsOf(bob).length, 0);
        assertEq(hs.sealsOf(alice).length, 2);
    }

    function test_sealEventTopics() public {
        bytes32 contentHash = keccak256("doc");
        vm.recordLogs();
        vm.prank(alice);
        uint256 sealId = hs.seal(contentHash, "labeled");

        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(logs.length, 1);
        assertEq(logs[0].emitter, address(hs));
        assertEq(
            logs[0].topics[0],
            keccak256("Sealed(uint256,address,bytes32,string,uint256,string,uint64)")
        );
        assertEq(uint256(logs[0].topics[1]), sealId);
        assertEq(address(uint160(uint256(logs[0].topics[2]))), alice);
        assertEq(logs[0].topics[3], contentHash);
    }

    function test_unknownSealAndEmptyHashLookup() public {
        vm.expectRevert(abi.encodeWithSelector(Handleseal.UnknownSeal.selector, uint256(1)));
        hs.getSeal(1);
        assertEq(hs.sealsByHash(keccak256("missing")).length, 0);
        assertEq(hs.sealsOf(alice).length, 0);
        assertEq(hs.sealCount(), 0);
    }

    function test_contractHasNoAdminSurfaceAndRejectsValue() public {
        bytes[] memory probes = new bytes[](5);
        probes[0] = abi.encodeWithSignature("owner()");
        probes[1] = abi.encodeWithSignature("pause()");
        probes[2] = abi.encodeWithSignature("setFee(uint256)", uint256(1));
        probes[3] = abi.encodeWithSignature("upgradeTo(address)", address(1));
        probes[4] = abi.encodeWithSignature("transferOwnership(address)", alice);

        for (uint256 i = 0; i < probes.length; i++) {
            (bool ok,) = address(hs).call(probes[i]);
            assertFalse(ok);
        }

        (bool paid,) = address(hs).call{value: 1 ether}(
            abi.encodeWithSelector(hs.seal.selector, keccak256("v"), "")
        );
        assertFalse(paid);
        assertEq(address(hs).balance, 0);
        assertEq(hs.sealCount(), 0);
    }

    function testFuzz_labelByteBoundary(uint8 length) public {
        length = uint8(bound(length, 0, 120));
        string memory label = _bytesString(length);
        vm.prank(alice);
        if (length > 80) {
            vm.expectRevert(abi.encodeWithSelector(Handleseal.LabelTooLong.selector, length, 80));
            hs.seal(keccak256(abi.encodePacked("fuzz", length)), label);
        } else {
            uint256 sealId = hs.seal(keccak256(abi.encodePacked("fuzz", length)), label);
            assertEq(bytes(hs.getSeal(sealId).label).length, length);
        }
    }

    function _expectNoOwnerOfHandle() private {
        vm.expectCall(REGISTRY, abi.encodePacked(OWNER_OF_HANDLE), 0);
    }

    function _bytesString(uint256 length) private pure returns (string memory) {
        bytes memory out = new bytes(length);
        for (uint256 i = 0; i < length; i++) {
            out[i] = "a";
        }
        return string(out);
    }

    function _repeat(string memory glyph, uint256 times) private pure returns (string memory) {
        bytes memory piece = bytes(glyph);
        bytes memory out = new bytes(piece.length * times);
        for (uint256 i = 0; i < times; i++) {
            for (uint256 j = 0; j < piece.length; j++) {
                out[i * piece.length + j] = piece[j];
            }
        }
        return string(out);
    }

    function _contains(bytes memory haystack, bytes memory needle) private pure returns (bool) {
        if (needle.length == 0 || haystack.length < needle.length) return false;
        uint256 last = haystack.length - needle.length;
        for (uint256 i = 0; i <= last; i++) {
            bool matched = true;
            for (uint256 j = 0; j < needle.length; j++) {
                if (haystack[i + j] != needle[j]) {
                    matched = false;
                    break;
                }
            }
            if (matched) return true;
        }
        return false;
    }
}
