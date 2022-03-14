import { findReplicaMintAddress } from "@quarryprotocol/quarry-sdk";
import type { Network } from "@saberhq/solana-contrib";
import type { TokenInfo, TokenList } from "@saberhq/token-utils";
import { deserializeMint, networkToChainId, Token } from "@saberhq/token-utils";
import { PublicKey } from "@solana/web3.js";
import * as fs from "fs/promises";
import { chunk, uniq, zip } from "lodash";
import invariant from "tiny-invariant";

import type { RewarderInfo, RewarderMeta } from "../types";
import { makeProvider, stringify } from "../utils";

const dedupeTokenList = (tokens: TokenInfo[]): TokenInfo[] => {
  return tokens
    .filter((tok, i) => {
      const prev = tokens.findIndex(
        (otherTok) => tok.address === otherTok.address
      );
      return prev === i;
    })
    .sort((a, b) => a.address.localeCompare(b.address));
};

const makeReplicaTokenInfo = (
  mint: PublicKey,
  primary: TokenInfo
): TokenInfo => ({
  ...primary,
  symbol: `qr${primary.symbol}`,
  name: `${primary.name} (Replica)`,
  address: mint.toString(),
  tags: [...(primary.tags ?? []), "quarry-merge-mine-replica"],
  extensions: {
    ...primary.extensions,
    underlyingTokens: [primary.address],
    source: "quarry-merge-mine-replica",
  },
});

export const buildTokenList = async (network: Network): Promise<void> => {
  const provider = makeProvider(network);

  const dir = `${__dirname}/../../data/${network}`;
  const lists = JSON.parse(
    (await fs.readFile(".tmp.token-list.json")).toString()
  ) as TokenList[];

  const rewarderList = JSON.parse(
    (await fs.readFile(`${dir}/rewarder-list.json`)).toString()
  ) as RewarderInfo[];
  const allRewarders = JSON.parse(
    (await fs.readFile(`${dir}/all-rewarders.json`)).toString()
  ) as Record<string, RewarderMeta>;

  const allMints = uniq([
    ...rewarderList
      .map((rwl) => rwl.redeemer?.underlyingToken)
      .filter((x): x is string => !!x),
    ...Object.values(allRewarders).map((r) => r.rewardsToken.mint),
    ...Object.keys(
      JSON.parse(
        (await fs.readFile(`${dir}/rewarders-by-mint.json`)).toString()
      ) as Record<string, unknown>
    ),
  ]).map((x) => new PublicKey(x));

  const allTokens = lists.flatMap((l) => l.tokens);

  const missingMints: PublicKey[] = [];
  const tokenListTokens = allMints
    .map((mint) => {
      const info = allTokens.find(
        (tok) =>
          tok.chainId === networkToChainId(network) &&
          tok.address === mint.toString()
      );
      if (info) {
        return info;
      }
      missingMints.push(mint);
      return null;
    })
    .filter((x): x is TokenInfo => !!x);

  const underlyingTokens = tokenListTokens
    .flatMap((tok) => {
      return (
        tok.extensions?.underlyingTokens?.map((ut) => {
          return allTokens.find(
            (t) =>
              t.address === ut.toString() &&
              t.chainId === networkToChainId(network)
          );
        }) ?? []
      );
    })
    .filter((t): t is TokenInfo => !!t);

  // check for all replicas that have a quarry
  const replicaMappings = (
    await Promise.all(
      allMints.map(async (mint) => {
        const [replicaMint] = await findReplicaMintAddress({
          primaryMint: mint,
        });
        return { replicaMint, underlyingMint: mint };
      })
    )
  ).filter((rm) => allMints.find((m) => m.equals(rm.replicaMint)));

  const missingReplicaMappings: {
    replicaMint: PublicKey;
    underlyingMint: PublicKey;
  }[] = [];
  const tokenListReplicas = missingMints
    .map((replicaMint): TokenInfo | null => {
      const replicaMapping = replicaMappings.find((rm) =>
        rm.replicaMint.equals(replicaMint)
      );
      if (replicaMapping) {
        const existingToken = tokenListTokens.find(
          (tok) => tok.address === replicaMapping.underlyingMint.toString()
        );
        if (existingToken) {
          return makeReplicaTokenInfo(
            replicaMapping.replicaMint,
            existingToken
          );
        } else {
          missingReplicaMappings.push(replicaMapping);
        }
      }
      return null;
    })
    .filter((x): x is TokenInfo => !!x);

  const missingMintsNonReplica = missingMints.filter(
    (mm) => !missingReplicaMappings.find((mrm) => mrm.replicaMint.equals(mm))
  );
  const missingMintsData = (
    await Promise.all(
      chunk(missingMintsNonReplica, 100).map(async (mintsChunk) =>
        provider.connection.getMultipleAccountsInfo(mintsChunk)
      )
    )
  ).flat();
  const missingTokens = zip(missingMintsNonReplica, missingMintsData).map(
    ([mint, mintDataRaw]) => {
      invariant(mint);
      invariant(mintDataRaw);
      return Token.fromMint(mint, deserializeMint(mintDataRaw.data).decimals)
        .info;
    }
  );
  const missingReplicaTokens = missingReplicaMappings.map(
    ({ replicaMint, underlyingMint }) => {
      const existingToken = missingTokens.find(
        (tok) => tok.address === underlyingMint.toString()
      );
      invariant(
        existingToken,
        `missing ${underlyingMint.toString()} for ${replicaMint.toString()}`
      );
      return makeReplicaTokenInfo(replicaMint, existingToken);
    }
  );

  const tokens = dedupeTokenList([
    ...tokenListTokens,
    ...underlyingTokens,
    ...tokenListReplicas,
    ...missingTokens,
    ...missingReplicaTokens,
  ]);

  const list: TokenList = {
    name: `Quarry Token List (${network})`,
    logoURI:
      "https://raw.githubusercontent.com/QuarryProtocol/rewarder-list/master/icon.png",
    tags: lists.reduce((acc, list) => ({ ...acc, ...list.tags }), {}),
    timestamp: new Date().toISOString(),
    tokens,
  };

  await fs.mkdir("data/", { recursive: true });
  await fs.writeFile(`${dir}/token-list.json`, stringify(list));
};

Promise.all([buildTokenList("mainnet-beta"), buildTokenList("devnet")]).catch(
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
