import {
  findPoolAddress,
  findRedeemerKey,
  findReplicaMintAddress,
} from "@quarryprotocol/quarry-sdk";
import type { Network } from "@saberhq/solana-contrib";
import { PublicKey } from "@saberhq/solana-contrib";
import { getATAAddress } from "@saberhq/token-utils";
import * as fs from "fs/promises";
import { fromPairs, groupBy, mapValues } from "lodash";
import invariant from "tiny-invariant";

import rewarderList from "../config/rewarder-list.json";
import type {
  QuarryMetaWithReplicas,
  RedemptionMethod,
  RewarderInfo,
  RewarderMeta,
  RewarderMetaWithInfo,
  TokenMeta,
} from "../types";
import { stringify } from "../utils";

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
    (await fs.readFile(`${dir}/all-rewarders.json`)).toString()
  ) as Record<string, RewarderMeta>;

  const networkRewarders = KNOWN_REWARDERS.filter((kr) =>
    kr.networks.includes(network)
  );

  const allQuarries = (
    await Promise.all(
      Object.entries(rewarderMetas).map(async ([rewarderKey, meta]) => {
        return await Promise.all(
          meta.quarries.map(async (q) => {
            const [replicaMint] = await findReplicaMintAddress({
              primaryMint: new PublicKey(q.stakedToken.mint),
            });
            return {
              rewarder: rewarderKey,
              token: q.stakedToken,
              quarry: q.quarry,
              slug: q.slug,
              replicaMint: replicaMint.toString(),
            };
          })
        );
      })
    )
  ).flat();

  const quarriesByMint = groupBy(allQuarries, (el) => el.token.mint);
  const quarriesByReplicaMint = groupBy(allQuarries, (el) => el.replicaMint);

  const rewardersByMint = mapValues(quarriesByMint, (group) =>
    group.map((g) => g.rewarder.toString())
  );

  for (const rewarderInfo of networkRewarders) {
    await fs.writeFile(
      `${dir}/rewarders/${rewarderInfo.address}/info.json`,
      stringify(rewarderInfo)
    );
  }

  const allRewardersWithInfo: Record<string, RewarderMetaWithInfo> = fromPairs(
    await Promise.all(
      Object.entries(rewarderMetas).map(
        async ([rewarderKey, meta]): Promise<
          [string, RewarderMetaWithInfo]
        > => {
          const info = networkRewarders.find(
            (nr) => nr.address === rewarderKey
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
                const isReplica = !!primaryQuarries?.length;

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
                  }[]
                ) =>
                  quarries.map(({ quarry, rewarder, slug }) => {
                    const rewardsToken = rewarderMetas[rewarder]?.rewardsToken;
                    invariant(rewardsToken);
                    return { quarry, rewarder, rewardsToken, slug };
                  });

                return {
                  ...quarry,
                  primaryToken: isReplica
                    ? primaryQuarries[0].token
                    : quarry.stakedToken,
                  mergePool: mergePool.toString(),
                  replicaMint: isReplica
                    ? quarry.stakedToken.mint
                    : replicaMint.toString(),
                  primaryQuarries: addRewardsToken(myPrimaryQuarries),
                  replicaQuarries: addRewardsToken(myReplicaQuarries ?? []),
                  isReplica,
                };
              }
            )
          );
          const result: RewarderMetaWithInfo = {
            ...meta,
            quarries,
            slug: info?.id ?? rewarderKey,
          };
          if (info) {
            if (info.redeemer && redeemerKeyAndBump) {
              info.redeemer.redeemerKey = redeemerKeyAndBump[0].toString();
              info.redeemer.redeemerVaultATA = redeemerVaultATA?.toString();
            }
            result.info = info;
          }
          return [rewarderKey, result];
        }
      )
    )
  );

  await fs.writeFile(
    `${dir}/all-rewarders-with-info.json`,
    stringify(allRewardersWithInfo)
  );
  await fs.writeFile(
    `${dir}/rewarders-by-mint.json`,
    stringify(rewardersByMint)
  );
  await fs.writeFile(`${dir}/rewarder-list.json`, stringify(networkRewarders));

  for (const [rewarderKey, rewarderInfoFull] of Object.entries(
    allRewardersWithInfo
  )) {
    await fs.mkdir(`${dir}/rewarders/${rewarderKey}`, { recursive: true });
    await fs.writeFile(
      `${dir}/rewarders/${rewarderKey}/full.json`,
      stringify(rewarderInfoFull)
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
