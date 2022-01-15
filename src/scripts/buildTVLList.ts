import type { Network } from "@saberhq/solana-contrib";
import type { TokenList } from "@saberhq/token-utils";
import * as fs from "fs/promises";
import { groupBy, mapValues } from "lodash";

import type { RewarderMeta } from "../types";
import { stringify } from "../utils";

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
          address: q.stakedToken.mint,
          quarry: q.quarry,
        }))
      ),
      (q) => q.address
    ),
    (v) => v.map((q) => q.quarry)
  );

  const tokenList = JSON.parse(
    (await fs.readFile(`${dir}/token-list.json`)).toString()
  ) as TokenList;

  const coingeckoIDs = Object.keys(quarriesByStakedMint).reduce(
    (acc: Record<string, string>, mint) => {
      const id = tokenList.tokens.find((t) => t.address === mint)?.extensions
        ?.coingeckoId;
      if (id) {
        acc[mint] = id;
      }
      return acc;
    },
    {}
  );

  const tvl = { quarriesByStakedMint, coingeckoIDs };

  await fs.writeFile(`${dir}/tvl.json`, stringify(tvl));
};

Promise.all([buildTVLList("mainnet-beta")]).catch((err) => {
  console.error(err);
});
