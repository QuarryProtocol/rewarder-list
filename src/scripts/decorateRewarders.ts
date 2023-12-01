import {
  findPoolAddress,
  findRedeemerKey,
  findReplicaMintAddress,
} from "@quarryprotocol/quarry-sdk";
import type { Network } from "@saberhq/solana-contrib";
import { PublicKey } from "@saberhq/solana-contrib";
import type { TokenInfo } from "@saberhq/token-utils";
import { getATAAddress } from "@saberhq/token-utils";
import * as fs from "fs/promises";
import { fromPairs, groupBy, mapValues } from "lodash";
import invariant from "tiny-invariant";

import rewarderList from "../config/rewarder-list.json";
import { fetchAllTokens } from "../helpers/tokenList";
import type {
  QuarryMetaWithReplicas,
  RedemptionMethod,
  RewarderInfo,
  RewarderMeta,
  RewarderMetaWithInfo,
  TokenMeta,
} from "../types";
import { stringify } from "../utils";

const pushUnderlying = (
  token: TokenInfo,
  allTokens: Record<string, TokenInfo>,
): TokenInfo[] => {
  const ret: TokenInfo[] = [];
  token.extensions?.underlyingTokens?.map((underlyingToken) => {
    const underlying = allTokens[underlyingToken];
    if (underlying) {
      const underlyingOfUnderlying = pushUnderlying(underlying, allTokens);
      if (underlyingOfUnderlying.length === 0) {
        ret.push(underlying);
      } else {
        ret.push(...underlyingOfUnderlying);
      }
    }
  }) ?? [];
  return ret;
};

export interface RewarderInfoRaw
  extends Omit<RewarderInfo, "networks" | "redeemer"> {
  networks: string[];
  redeemer?: Omit<NonNullable<RewarderInfo["redeemer"]>, "method"> & {
    method: string;
  };
  prelaunch?: boolean;
}

const KNOWN_REWARDERS_RAW: RewarderInfoRaw[] = rewarderList.rewarders;

const KNOWN_REWARDERS: RewarderInfo[] = KNOWN_REWARDERS_RAW.map((kr) => ({
  ...kr,
  prelaunch: kr.prelaunch,
  networks: kr.networks as Network[],
  redeemer: kr.redeemer
    ? {
        ...kr.redeemer,
        method: kr.redeemer.method as RedemptionMethod,
      }
    : undefined,
}));

export const decorateRewarders = async (network: Network): Promise<void> => {
  const dir = `${__dirname}/../../data/${network}/`;
  await fs.mkdir(dir, { recursive: true });

  const rewarderMetas = JSON.parse(
    (await fs.readFile(`${dir}/all-rewarders.json`)).toString(),
  ) as Record<string, RewarderMeta>;

  const networkRewarders = KNOWN_REWARDERS.filter((kr) =>
    kr.networks.includes(network),
  );

  const allQuarries = (
    await Promise.all(
      Object.entries(rewarderMetas).map(async ([rewarderKey, meta]) => {
        return await Promise.all(
          meta.quarries.map(async (q) => {
            const [replicaMint] = await findReplicaMintAddress({
              primaryMint: new PublicKey(q.stakedToken.mint),
            });
            const [mergePool] = await findPoolAddress({
              primaryMint: new PublicKey(q.stakedToken.mint),
            });
            return {
              rewarder: rewarderKey,
              token: q.stakedToken,
              quarry: q.quarry,
              slug: q.slug,
              replicaMint: replicaMint.toString(),
              mergePool: mergePool.toString(),
            };
          }),
        );
      }),
    )
  ).flat();

  const quarriesByMint = groupBy(allQuarries, (el) => el.token.mint);
  const quarriesByReplicaMint = groupBy(allQuarries, (el) => el.replicaMint);
  const rewardersByMint = mapValues(quarriesByMint, (group) =>
    group.map((g) => g.rewarder.toString()),
  );

  for (const rewarderInfo of networkRewarders) {
    await fs.writeFile(
      `${dir}/rewarders/${rewarderInfo.address}/info.json`,
      stringify(rewarderInfo),
    );
  }
  const { tokens } = await fetchAllTokens(network);

  const allRewardersWithInfo: Record<string, RewarderMetaWithInfo> = fromPairs(
    await Promise.all(
      Object.entries(rewarderMetas).map(
        async ([rewarderKey, meta]): Promise<
          [string, RewarderMetaWithInfo]
        > => {
          const info = networkRewarders.find(
            (nr) => nr.address === rewarderKey,
          );
          const redeemerKeyAndBump = info?.redeemer?.underlyingToken
            ? await findRedeemerKey({
                iouMint: new PublicKey(meta.rewardsToken.mint),
                redemptionMint: new PublicKey(info?.redeemer?.underlyingToken),
              })
            : null;

          const redeemerVaultATA =
            redeemerKeyAndBump && info?.redeemer?.underlyingToken
              ? await getATAAddress({
                  mint: new PublicKey(info.redeemer.underlyingToken),
                  owner: redeemerKeyAndBump[0],
                })
              : redeemerKeyAndBump;

          const quarries = await Promise.all(
            meta.quarries.map(
              async (quarry): Promise<QuarryMetaWithReplicas> => {
                const [mergePool] = await findPoolAddress({
                  primaryMint: new PublicKey(quarry.stakedToken.mint),
                });
                const [replicaMint] = await findReplicaMintAddress({
                  primaryMint: new PublicKey(quarry.stakedToken.mint),
                });

                const primaryQuarries =
                  quarriesByReplicaMint[quarry.stakedToken.mint];
                const otherQuarries = quarriesByMint[quarry.stakedToken.mint];
                const replicaQuarries = quarriesByMint[replicaMint.toString()];

                // It is a replica if primary quarries exist for this as a replica token.
                const firstPrimaryQuarry = primaryQuarries?.[0];
                const isReplica = !!firstPrimaryQuarry;

                const myPrimaryQuarries = isReplica ? primaryQuarries : [];
                const myReplicaQuarries = isReplica
                  ? otherQuarries
                  : replicaQuarries;

                const addRewardsToken = (
                  quarries: {
                    rewarder: string;
                    quarry: string;
                    token: TokenMeta;
                    slug: string;
                  }[],
                ) =>
                  quarries.map(({ quarry, rewarder, slug }) => {
                    const rewardsToken = rewarderMetas[rewarder]?.rewardsToken;
                    invariant(rewardsToken);
                    const displayRewardsToken =
                      info?.redeemer?.underlyingTokenInfo ??
                      tokens[rewardsToken.mint] ??
                      null;
                    return {
                      quarry,
                      rewarder,
                      rewardsToken,
                      slug,
                      displayRewardsToken,
                    };
                  });

                const primaryToken = isReplica
                  ? firstPrimaryQuarry.token
                  : quarry.stakedToken;
                const primaryTokenInfo = tokens[primaryToken.mint] ?? null;

                return {
                  ...quarry,
                  primaryToken,
                  primaryTokenInfo,
                  mergePool: mergePool.toString(),
                  replicaMint: isReplica
                    ? quarry.stakedToken.mint
                    : replicaMint.toString(),
                  primaryQuarries: addRewardsToken(myPrimaryQuarries ?? []),
                  replicaQuarries: addRewardsToken(myReplicaQuarries ?? []),
                  isReplica,
                };
              },
            ),
          );
          const rewardsTokenInfo = tokens[meta.rewardsToken.mint] ?? null;
          const result: RewarderMetaWithInfo = {
            ...meta,
            quarries,
            slug: info?.id ?? rewarderKey,
            rewardsTokenInfo,
          };
          if (info) {
            if (info.redeemer && redeemerKeyAndBump) {
              info.redeemer.underlyingTokenInfo =
                tokens[info.redeemer.underlyingToken];
              info.redeemer.redeemerKey = redeemerKeyAndBump[0].toString();
              info.redeemer.redeemerVaultATA = redeemerVaultATA?.toString();
            }
            result.info = info;
          }
          return [rewarderKey, result];
        },
      ),
    ),
  );

  await fs.writeFile(`${dir}/quarries-by-mint.json`, stringify(quarriesByMint));

  await fs.writeFile(
    `${dir}/all-rewarders-with-info.json`,
    stringify(allRewardersWithInfo),
  );
  await fs.writeFile(
    `${dir}/rewarders-by-mint.json`,
    stringify(rewardersByMint),
  );
  await fs.writeFile(`${dir}/rewarder-list.json`, stringify(networkRewarders));

  for (const [rewarderKey, rewarderInfoFull] of Object.entries(
    allRewardersWithInfo,
  )) {
    const rewardsToken = tokens[rewarderInfoFull.rewardsToken.mint];

    await fs.mkdir(`${dir}/rewarders/${rewarderKey}`, { recursive: true });

    // Add the name of the staked token & name of the rewards token to the result

    await fs.writeFile(
      `${dir}/rewarders/${rewarderKey}/full.json`,
      stringify(rewarderInfoFull),
    );

    await fs.mkdir(`${dir}/rewarders/${rewarderKey}/quarries`, {
      recursive: true,
    });
    await Promise.all(
      rewarderInfoFull.quarries.map(async (quarry) => {
        let stakedToken: TokenInfo | null = null;

        const underlyingTokens: TokenInfo[] = [];
        stakedToken = tokens[quarry.stakedToken.mint] ?? null;
        if (stakedToken) {
          underlyingTokens.push(...pushUnderlying(stakedToken, tokens));
        }

        const { quarries: _, ...rewarderInfoWithoutQuarries } =
          rewarderInfoFull;
        const quarryInfoStr = stringify({
          rewarder: rewarderInfoWithoutQuarries,
          rewardsToken,
          quarry,
          stakedToken,
          underlyingTokens,
        });

        await fs.writeFile(
          `${dir}/rewarders/${rewarderKey}/quarries/${quarry.index}.json`,
          quarryInfoStr,
        );
        if (quarry.slug && quarry.slug !== quarry.index.toString()) {
          await fs.writeFile(
            `${dir}/rewarders/${rewarderKey}/quarries/${quarry.slug}.json`,
            quarryInfoStr,
          );
        }
      }),
    );
  }
};

Promise.all([
  decorateRewarders("mainnet-beta"),
  decorateRewarders("devnet"),
]).catch((err) => {
  console.error(err);
  process.exit(1);
});
