# @ethereumjs/common

[![NPM Package][common-npm-badge]][common-npm-link]
[![GitHub Issues][common-issues-badge]][common-issues-link]
[![Actions Status][common-actions-badge]][common-actions-link]
[![Code Coverage][common-coverage-badge]][common-coverage-link]
[![Discord][discord-badge]][discord-link]

| Resources common to all EthereumJS implementations. |
| --------------------------------------------------- |

Note: this `README` reflects the state of the library from `v2.0.0` onwards. See `README` from the [standalone repository](https://github.com/ethereumjs/ethereumjs-common) for an introduction on the last preceding release.

## Installation

To obtain the latest version, simply require the project using `npm`:

```shell
npm install @ethereumjs/common
```

## Usage

### import / require

import (ESM, TypeScript):

```ts
import { Chain, Common, Hardfork } from '@ethereumjs/common'
```

require (CommonJS, Node.js):

```ts
const { Common, Chain, Hardfork } = require('@ethereumjs/common')
```

### Parameters

All parameters can be accessed through the `Common` class, instantiated with an object containing either the `chain` (e.g. 'Chain.Mainnet') or the `chain` together with a specific `hardfork` provided:

```ts
// ./examples/common.ts#L1-L7

import { Common, Hardfork, Mainnet, createCustomCommon } from '@ethereumjs/common'

// With enums:
const commonWithEnums = new Common({ chain: Mainnet, hardfork: Hardfork.London })

// Instantiate with the chain (and the default hardfork)
let c = new Common({ chain: Mainnet })
```

If no hardfork is provided, the common is initialized with the default hardfork.

Current `DEFAULT_HARDFORK`: `Hardfork.Shanghai`

Here are some simple usage examples:

```ts
// ./examples/common.ts#L9-L23

// Get bootstrap nodes for chain/network
console.log('Below are the known bootstrap nodes')
console.log(c.bootstrapNodes()) // Array with current nodes

// Instantiate with an EIP activated
c = new Common({ chain: Mainnet, eips: [4844] })
console.log(`EIP 4844 is active -- ${c.isActivatedEIP(4844)}`)

// Instantiate common with custom chainID
const commonWithCustomChainId = createCustomCommon({ chainId: 1234 }, Mainnet)
console.log(`The current chain ID is ${commonWithCustomChainId.chainId}`)
```

### Custom Cryptography Primitives (WASM)

All EthereumJS packages use cryptographic primitives from the audited `ethereum-cryptography` library by default.
These primitives, including `keccak256`, `sha256`, and elliptic curve signature methods, are all written in native
Javascript and therefore have the potential downside of being less performant than alternative cryptography modules
written in other languages and then compiled to WASM. If cryptography performance is a bottleneck in your usage of
the EthereumJS libraries, you can provide your own primitives to the `Common` constructor and they will be used in
place of the defaults. Depending on how your preferred primitives are implemented, you may need to write wrapper
methods around them so they conform to the interface exposed by the [`common.customCrypto` property](./src/types.ts).
See the implementation of this in the [`@ethereumjs/client`](../client/bin/cli.ts#L810) using `@polkadot/wasm-crypto`
for an example of how this is done for each available cryptographic primitive.

Note: replacing native JS crypto primitives with WASM based libraries comes with new security assumptions (additional external dependencies, unauditability of WASM code). It is therefore recommended to evaluate your usage context before applying!

### Example 1: keccak256 Hashing

The following is an example using the [@polkadot/wasm-crypto](https://github.com/polkadot-js/wasm/tree/master/packages/wasm-crypto) package:

```ts
// ./examples/customCrypto.ts

import { createBlock } from '@ethereumjs/block'
import { Common, Mainnet } from '@ethereumjs/common'
import { keccak256, waitReady } from '@polkadot/wasm-crypto'

const main = async () => {
  // @polkadot/wasm-crypto specific initialization
  await waitReady()

  const common = new Common({ chain: Mainnet, customCrypto: { keccak256 } })
  const block = createBlock({}, { common })

  // Method invocations within EthereumJS library instantiations where the common
  // instance above is passed will now use the custom keccak256 implementation
  console.log(block.hash())
}

void main()
```

### Example 2: KZG

The KZG library used for EIP-4844 Blob Transactions is initialized by `common` under the `common.customCrypto` property
and is then used throughout the `Ethereumjs` stack wherever KZG cryptography is required. Below is an example of how
to initialize (assuming you are using the `c-kzg` package as your KZG cryptography library).

```ts
// ./examples/initKzg.ts

import { Common, Hardfork, Mainnet } from '@ethereumjs/common'
import { trustedSetup } from '@paulmillr/trusted-setups/fast.js'
import { KZG as microEthKZG } from 'micro-eth-signer/kzg'

const main = async () => {
  const kzg = new microEthKZG(trustedSetup)
  const common = new Common({
    chain: Mainnet,
    hardfork: Hardfork.Cancun,
    customCrypto: { kzg },
  })
  console.log(common.customCrypto.kzg) // Should print the initialized KZG interface
}

void main()
```

## Browser

With the breaking release round in Summer 2023 we have added hybrid ESM/CJS builds for all our libraries (see section below) and have eliminated many of the caveats which had previously prevented a frictionless browser usage.

It is now easily possible to run a browser build of one of the EthereumJS libraries within a modern browser using the provided ESM build. For a setup example see [./examples/browser.html](./examples/browser.html).

## API

### Docs

See the API documentation for a full list of functions for accessing specific chain and
depending hardfork parameters. There are also additional helper functions like
`paramByBlock (topic, name, blockNumber)` or `hardforkIsActiveOnBlock (hardfork, blockNumber)`
to ease `blockNumber` based access to parameters.

Generated TypeDoc API [Documentation](./docs/README.md)

### Hybrid CJS/ESM Builds

With the breaking releases from Summer 2023 we have started to ship our libraries with both CommonJS (`cjs` folder) and ESM builds (`esm` folder), see `package.json` for the detailed setup.

If you use an ES6-style `import` in your code files from the ESM build will be used:

```ts
import { EthereumJSClass } from '@ethereumjs/[PACKAGE_NAME]'
```

If you use Node.js specific `require`, the CJS build will be used:

```ts
const { EthereumJSClass } = require('@ethereumjs/[PACKAGE_NAME]')
```

Using ESM will give you additional advantages over CJS beyond browser usage like static code analysis / Tree Shaking which CJS can not provide.

## Events

The `Common` class has a public property `events` which contains an `EventEmitter`. Following events are emitted on which you can react within your code:

| Event             | Description                                                |
| ----------------- | ---------------------------------------------------------- |
| `hardforkChanged` | Emitted when a hardfork change occurs in the Common object |

## Setup

### Chains

The `chain` can be set in the constructor like this:

```ts
const c = new Common({ chain: Chain.Mainnet })
```

Supported chains:

- `mainnet` (`Chain.Mainnet`)
- `goerli` (`Chain.Goerli`)
- `sepolia` (`Chain.Sepolia`) (`v2.6.1`+)
- `holesky` (`Chain.Holesky`) (`v4.1.0`+)
- Private/custom chain parameters

The following chain-specific parameters are provided:

- `name`
- `chainId`
- `networkId`
- `consensusType` (e.g. `pow` or `poa`)
- `consensusAlgorithm` (e.g. `ethash` or `clique`)
- `consensusConfig` (depends on `consensusAlgorithm`, e.g. `period` and `epoch` for `clique`)
- `genesis` block header values
- `hardforks` block numbers
- `bootstrapNodes` list
- `dnsNetworks` list ([EIP-1459](https://eips.ethereum.org/EIPS/eip-1459)-compliant list of DNS networks for peer discovery)

To get an overview of the different parameters have a look at one of the chain configurations in the `chains.ts` configuration
file, or to the `Chain` type in [./src/types.ts](./src/types.ts).

### Working with private/custom chains

There are two distinct APIs available for setting up custom(ized) chains.

#### Basic Chain Customization / Predefined Custom Chains

There is a dedicated `Common.custom()` static constructor which allows for an easy instantiation of a Common instance with somewhat adopted chain parameters, with the main use case to adopt on instantiating with a deviating chain ID (you can use this to adopt other chain parameters as well though). Instantiating a custom common instance with its own chain ID and inheriting all other parameters from `mainnet` can now be as easily done as:

```ts
// ./examples/common.ts#L25-L27
```

The `custom()` method also takes a string as a first input (instead of a dictionary). This can be used in combination with the `CustomChain` enum dict which allows for the selection of predefined supported custom chains for an easier `Common` setup of these supported chains:

```ts
const common = Common.custom(CustomChain.ArbitrumRinkebyTestnet)
```

The following custom chains are currently supported:

- `PolygonMainnet`
- `PolygonMumbai`
- `ArbitrumRinkebyTestnet`
- `xDaiChain`
- `OptimisticKovan`
- `OptimisticEthereum`

`Common` instances created with this simplified `custom()` constructor can't be used in all usage contexts (the HF configuration is very likely not matching the actual chain) but can be useful for specific use cases, e.g. for sending a tx with `@ethereumjs/tx` to an L2 network (see the `Tx` library [README](https://github.com/ethereumjs/ethereumjs-monorepo/tree/master/packages/tx) for a complete usage example).

#### Activate with a single custom Chain setup

If you want to initialize a `Common` instance with a single custom chain which is then directly activated
you can pass a dictionary - conforming to the parameter format described above - with your custom chain
values to the constructor using the `chain` parameter or the `setChain()` method, here is some example:

```ts
// ./examples/customChain.ts

import { Common, Mainnet, createCustomCommon } from '@ethereumjs/common'

import myCustomChain1 from './genesisData/testnet.json'

// Add custom chain config
const common1 = createCustomCommon(myCustomChain1, Mainnet)
console.log(`Common is instantiated with custom chain parameters - ${common1.chainName()}`)
```

#### Initialize using customChains Array

A second way for custom chain initialization is to use the `customChains` constructor option. This
option comes with more flexibility and allows for an arbitrary number of custom chains to be initialized on
a common instance in addition to the already supported ones. It also allows for an activation-independent
initialization, so you can add your chains by adding to the `customChains` array and either directly
use the `chain` option to activate one of the custom chains passed or activate a build in chain
(e.g. `mainnet`) and switch to other chains - including the custom ones - by using `Common.setChain()`.

```ts
// ./examples/customChain.ts

import { Common, Mainnet, createCustomCommon } from '@ethereumjs/common'

import myCustomChain1 from './genesisData/testnet.json'

// Add custom chain config
const common1 = createCustomCommon(myCustomChain1, Mainnet)
console.log(`Common is instantiated with custom chain parameters - ${common1.chainName()}`)
```

Starting with v3 custom genesis states should be passed to the [Blockchain](../blockchain/) library directly.

#### Initialize using Geth's genesis json

For lots of custom chains (for e.g. devnets and testnets), you might come across a genesis json config which
has both config specification for the chain as well as the genesis state specification. You can derive the
common from such configuration in the following manner:

```ts
// ./examples/fromGeth.ts

import { createCommonFromGethGenesis } from '@ethereumjs/common'
import { hexToBytes } from '@ethereumjs/util'

import genesisJSON from './genesisData/post-merge.json'

const genesisHash = hexToBytes('0x3b8fb240d288781d4aac94d3fd16809ee413bc99294a085798a589dae51ddd4a')
// Load geth genesis JSON file into lets say `genesisJSON` and optional `chain` and `genesisHash`
const common = createCommonFromGethGenesis(genesisJSON, { chain: 'customChain', genesisHash })
// If you don't have `genesisHash` while initiating common, you can later configure common (for e.g.
// after calculating it via `blockchain`)
common.setForkHashes(genesisHash)

console.log(`The London forkhash for this custom chain is ${common.forkHash('london')}`)
```

### Hardforks

The `hardfork` can be set in constructor like this:

```ts
// ./examples/common.ts#L1-L4

import { Common, Hardfork, Mainnet, createCustomCommon } from '@ethereumjs/common'

// With enums:
const commonWithEnums = new Common({ chain: Mainnet, hardfork: Hardfork.London })
```

### Active Hardforks

There are currently parameter changes by the following past and future hardfork by the
library supported:

- `chainstart` (`Hardfork.Chainstart`)
- `homestead` (`Hardfork.Homestead`)
- `dao` (`Hardfork.Dao`)
- `tangerineWhistle` (`Hardfork.TangerineWhistle`)
- `spuriousDragon` (`Hardfork.SpuriousDragon`)
- `byzantium` (`Hardfork.Byzantium`)
- `constantinople` (`Hardfork.Constantinople`)
- `petersburg` (`Hardfork.Petersburg`) (aka `constantinopleFix`, apply together with `constantinople`)
- `istanbul` (`Hardfork.Istanbul`)
- `muirGlacier` (`Hardfork.MuirGlacier`)
- `berlin` (`Hardfork.Berlin`) (since `v2.2.0`)
- `london` (`Hardfork.London`) (since `v2.4.0`)
- `merge` (`Hardfork.Merge`) (`DEFAULT_HARDFORK`) (since `v2.5.0`)
- `shanghai` (`Hardfork.Shanghai`) (since `v3.1.0`)
- `cancun` (`Hardfork.Cancun`) (since `v4.2.0`)

### Future Hardforks

The next upcoming HF `Hardfork.Prague` is currently not yet supported by this library.

### Parameter Access

For hardfork-specific parameter access with the `param()` and `paramByBlock()` functions
you can use the following `topics`:

- `gasConfig`
- `gasPrices`
- `vm`
- `pow`
- `sharding`

See one of the hardfork configurations in the `hardforks.ts` file
for an overview. For consistency, the chain start (`chainstart`) is considered an own
hardfork.

The hardfork configurations above `chainstart` only contain the deltas from `chainstart` and
shouldn't be accessed directly until you have a specific reason for it.

### EIPs

Starting with the `v2.0.0` release of the library, EIPs are now native citizens within the library
and can be activated like this:

```ts
const c = new Common({ chain: Chain.Mainnet, eips: [4844] })
```

The following EIPs are currently supported:

- [EIP-1153](https://eips.ethereum.org/EIPS/eip-1153) - Transient storage opcodes (Cancun)
- [EIP-1559](https://eips.ethereum.org/EIPS/eip-1559) - Fee market change for ETH 1.0 chain
- [EIP-2537](https://eips.ethereum.org/EIPS/eip-2537) - BLS precompiles (removed in v4.0.0, see latest v3 release)
- [EIP-2565](https://eips.ethereum.org/EIPS/eip-2565) - ModExp gas cost
- [EIP-2718](https://eips.ethereum.org/EIPS/eip-2718) - Transaction Types
- [EIP-2935](https://eips.ethereum.org/EIPS/eip-2935) - Serve historical block hashes from state (Prague)
- [EIP-2929](https://eips.ethereum.org/EIPS/eip-2929) - gas cost increases for state access opcodes
- [EIP-2930](https://eips.ethereum.org/EIPS/eip-2930) - Optional access list tx type
- [EIP-3074](https://eips.ethereum.org/EIPS/eip-3074) - AUTH and AUTHCALL opcodes
- [EIP-3198](https://eips.ethereum.org/EIPS/eip-3198) - Base fee Opcode
- [EIP-3529](https://eips.ethereum.org/EIPS/eip-3529) - Reduction in refunds
- [EIP-3540](https://eips.ethereum.org/EIPS/eip-3540) - EVM Object Format (EOF) v1 (`outdated`)
- [EIP-3541](https://eips.ethereum.org/EIPS/eip-3541) - Reject new contracts starting with the 0xEF byte
- [EIP-3554](https://eips.ethereum.org/EIPS/eip-3554) - Difficulty Bomb Delay to December 2021 (only PoW networks)
- [EIP-3607](https://eips.ethereum.org/EIPS/eip-3607) - Reject transactions from senders with deployed code
- [EIP-3651](https://eips.ethereum.org/EIPS/eip-3651) - Warm COINBASE (Shanghai)
- [EIP-3670](https://eips.ethereum.org/EIPS/eip-3670) - EOF - Code Validation (`outdated`)
- [EIP-3675](https://eips.ethereum.org/EIPS/eip-3675) - Upgrade consensus to Proof-of-Stake
- [EIP-3855](https://eips.ethereum.org/EIPS/eip-3855) - Push0 opcode (Shanghai)
- [EIP-3860](https://eips.ethereum.org/EIPS/eip-3860) - Limit and meter initcode (Shanghai)
- [EIP-4345](https://eips.ethereum.org/EIPS/eip-4345) - Difficulty Bomb Delay to June 2022
- [EIP-4399](https://eips.ethereum.org/EIPS/eip-4399) - Supplant DIFFICULTY opcode with PREVRANDAO (Merge)
- [EIP-4788](https://eips.ethereum.org/EIPS/eip-4788) - Beacon block root in the EVM (Cancun)
- [EIP-4844](https://eips.ethereum.org/EIPS/eip-4844) - Shard Blob Transactions (Cancun)
- [EIP-4895](https://eips.ethereum.org/EIPS/eip-4895) - Beacon chain push withdrawals as operations (Shanghai)
- [EIP-5133](https://eips.ethereum.org/EIPS/eip-5133) - Delaying Difficulty Bomb to mid-September 2022 (Gray Glacier)
- [EIP-5656](https://eips.ethereum.org/EIPS/eip-5656) - MCOPY - Memory copying instruction (Cancun)
- [EIP-6110](https://eips.ethereum.org/EIPS/eip-6110) - Supply validator deposits on chain (Prague)
- [EIP-6780](https://eips.ethereum.org/EIPS/eip-6780) - SELFDESTRUCT only in same transaction (Cancun)
- [EIP-7002](https://eips.ethereum.org/EIPS/eip-7002) - Execution layer triggerable withdrawals (Prague)
- [EIP-7251](https://eips.ethereum.org/EIPS/eip-7251) - Execution layer triggerable validator consolidations (Prague)
- [EIP-7702](https://eips.ethereum.org/EIPS/eip-7702) - EOA code transactions (Prague) (`outdated`)
- [EIP-7709](https://eips.ethereum.org/EIPS/eip-7709) - Read BLOCKHASH from storage and update cost (Osaka)
- [EIP-7516](https://eips.ethereum.org/EIPS/eip-7516) - BLOBBASEFEE opcode (Cancun)
- [EIP-7685](https://eips.ethereum.org/EIPS/eip-7685) - General purpose execution layer requests (Prague)

### Bootstrap Nodes

You can use `common.bootstrapNodes()` function to get nodes for a specific chain/network.

## EthereumJS

See our organizational [documentation](https://ethereumjs.readthedocs.io) for an introduction to `EthereumJS` as well as information on current standards and best practices. If you want to join for work or carry out improvements on the libraries, please review our [contribution guidelines](https://ethereumjs.readthedocs.io/en/latest/contributing.html) first.

## License

[MIT](https://opensource.org/licenses/MIT)

[discord-badge]: https://img.shields.io/static/v1?logo=discord&label=discord&message=Join&color=blue
[discord-link]: https://discord.gg/TNwARpR
[common-npm-badge]: https://img.shields.io/npm/v/@ethereumjs/common.svg
[common-npm-link]: https://www.npmjs.com/package/@ethereumjs/common
[common-issues-badge]: https://img.shields.io/github/issues/ethereumjs/ethereumjs-monorepo/package:%20common?label=issues
[common-issues-link]: https://github.com/ethereumjs/ethereumjs-monorepo/issues?q=is%3Aopen+is%3Aissue+label%3A"package%3A+common"
[common-actions-badge]: https://github.com/ethereumjs/ethereumjs-monorepo/workflows/Common/badge.svg
[common-actions-link]: https://github.com/ethereumjs/ethereumjs-monorepo/actions?query=workflow%3A%22Common%22
[common-coverage-badge]: https://codecov.io/gh/ethereumjs/ethereumjs-monorepo/branch/master/graph/badge.svg?flag=common
[common-coverage-link]: https://codecov.io/gh/ethereumjs/ethereumjs-monorepo/tree/master/packages/common
