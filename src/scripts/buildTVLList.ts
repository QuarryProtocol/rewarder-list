import type { Network } from "@saberhq/solana-contrib";
import * as fs from "fs/promises";
import { groupBy, mapValues } from "lodash";

import type { RewarderMeta } from "../types";

export const buildTVLList = async (network: Network): Promise<void> => {
  const dir = `${__dirname}/../../data/${network}/`;
  await fs.mkdir(dir, { recursive: true });

  const rewarderMetas = JSON.parse(
    (await fs.readFile(`${dir}/all-rewarders.json`)).toString()
  ) as Record<string, RewarderMeta>;

  const quarriesByStakedMint = mapValues(
    groupBy(
      Object.values(rewarderMetas).flatMap((rew) =>
        rew.quarries.map((q) => ({
          address: q.stakedToken.address,
          quarry: q.quarry,
        }))
      ),
      (q) => q.address
    ),
    (v) => v.map((q) => q.quarry)
  );

  const tvl = { quarriesByStakedMint };

  await fs.writeFile(`${dir}/tvl.json`, JSON.stringify(tvl, null, 2));
};

Promise.all([buildTVLList("mainnet-beta")]).catch((err) => {
  console.error(err);
});
