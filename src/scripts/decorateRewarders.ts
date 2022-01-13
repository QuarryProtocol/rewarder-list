import { findReplicaMintAddress } from "@quarryprotocol/quarry-sdk";
import type { Network } from "@saberhq/solana-contrib";
import { PublicKey } from "@saberhq/solana-contrib";
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
} from "../types";
import { stringify } from "../utils";

interface RewarderInfoRaw extends Omit<RewarderInfo, "networks" | "redeemer"> {
  networks: string[];
  redeemer?: Omit<NonNullable<RewarderInfo["redeemer"]>, "method"> & {
    method: string;
  };
}

const KNOWN_REWARDERS_RAW: RewarderInfoRaw[] = rewarderList;

const KNOWN_REWARDERS: RewarderInfo[] = KNOWN_REWARDERS_RAW.map((kr) => ({
  ...kr,
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
              primaryMint: new PublicKey(q.stakedToken.address),
            });
            return {
              rewarder: rewarderKey,
              token: q.stakedToken.address,
              quarry: q.quarry,
              replicaMint: replicaMint.toString(),
            };
          })
        );
      })
    )
  ).flat();
  const quarriesByMint = groupBy(allQuarries, (el) => el.token);
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
          const quarries = await Promise.all(
            meta.quarries.map(
              async (quarry): Promise<QuarryMetaWithReplicas> => {
                const [replicaMint] = await findReplicaMintAddress({
                  primaryMint: new PublicKey(quarry.stakedToken.address),
                });

                const primaryQuarries =
                  quarriesByReplicaMint[quarry.stakedToken.address];
                const otherQuarries =
                  quarriesByMint[quarry.stakedToken.address];
                const replicaQuarries =
                  quarriesByReplicaMint[replicaMint.toString()];

                const isReplica = !!primaryQuarries?.length;

                const myPrimaryQuarries = isReplica ? primaryQuarries : [];
                const myReplicaQuarries = isReplica
                  ? otherQuarries
                  : replicaQuarries;

                const addRewardsTokenMint = (
                  quarries: {
                    rewarder: string;
                    token: string;
                    quarry: string;
                  }[]
                ) =>
                  quarries.map(({ quarry, rewarder }) => {
                    const rewardsTokenMint =
                      rewarderMetas[rewarder]?.rewardsTokenMint;
                    invariant(rewardsTokenMint);
                    return { quarry, rewarder, rewardsTokenMint };
                  });

                return {
                  ...quarry,
                  primaryMint: isReplica
                    ? primaryQuarries[0].token
                    : quarry.stakedToken.address,
                  replicaMint: isReplica
                    ? quarry.stakedToken.address
                    : replicaMint.toString(),
                  primaryQuarries: addRewardsTokenMint(myPrimaryQuarries),
                  replicaQuarries: addRewardsTokenMint(myReplicaQuarries ?? []),
                };
              }
            )
          );
          const result: RewarderMetaWithInfo = { ...meta, quarries };
          if (info) {
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
};

Promise.all([
  decorateRewarders("mainnet-beta"),
  decorateRewarders("devnet"),
]).catch((err) => {
  console.error(err);
});
