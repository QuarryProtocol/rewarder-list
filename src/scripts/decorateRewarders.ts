import type { Network } from "@saberhq/solana-contrib";
import * as fs from "fs/promises";
import { groupBy, mapValues } from "lodash";

import rewarderList from "../config/rewarder-list.json";
import type { RedemptionMethod, RewarderInfo, RewarderMeta } from "../types";
import { serialize } from "../utils";

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

  const rewardersByMint = mapValues(
    groupBy(
      Object.entries(rewarderMetas).flatMap(([rewarderKey, meta]) =>
        meta.quarries.map((q) => ({
          rewarder: rewarderKey,
          token: q.stakedToken.address,
        }))
      ),
      (el) => el.token
    ),
    (group) => group.map((g) => g.rewarder.toString())
  );

  for (const rewarderInfo of networkRewarders) {
    await fs.writeFile(
      `${dir}/rewarders/${rewarderInfo.address}/info.json`,
      JSON.stringify(rewarderInfo, null, 2)
    );
  }

  await fs.writeFile(
    `${dir}/all-rewarders-with-info.json`,
    JSON.stringify(
      mapValues(rewarderMetas, (meta, rewarderKey) => {
        const info = networkRewarders.find((nr) => nr.address === rewarderKey);
        if (info) {
          return {
            ...meta,
            info,
          };
        }
        return meta;
      }),
      serialize,
      2
    )
  );
  await fs.writeFile(
    `${dir}/rewarders-by-mint.json`,
    JSON.stringify(rewardersByMint, serialize, 2)
  );
  await fs.writeFile(
    `${dir}/rewarder-list.json`,
    JSON.stringify(networkRewarders, serialize, 2)
  );
};

Promise.all([
  decorateRewarders("mainnet-beta"),
  decorateRewarders("devnet"),
]).catch((err) => {
  console.error(err);
});
