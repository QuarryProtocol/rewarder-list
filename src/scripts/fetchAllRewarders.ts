import { QuarrySDK } from "@quarryprotocol/quarry-sdk";
import type { Network } from "@saberhq/solana-contrib";
import * as fs from "fs/promises";
import { groupBy, keyBy, mapValues } from "lodash";

import { makeProvider } from "../utils";

export const fetchAllRewarders = async (network: Network): Promise<void> => {
  const provider = makeProvider(network);
  const quarry = QuarrySDK.load({ provider });
  const allRewarders = await quarry.programs.Mine.account.rewarder.all();
  const allQuarries = await quarry.programs.Mine.account.quarry.all();

  const dir = `${__dirname}/../../data/${network}/`;
  await fs.mkdir(dir, { recursive: true });

  // addresses of each quarry
  const allQuarriesJSON = allQuarries.map((q) => ({
    rewarder: q.account.rewarderKey.toString(),
    quarry: q.publicKey.toString(),
    stakedToken: {
      address: q.account.tokenMintKey.toString(),
      decimals: q.account.tokenMintDecimals,
    },
    cached: {
      index: q.account.index,
      famineTs: q.account.famineTs.toString(),
      lastUpdateTs: q.account.lastUpdateTs.toString(),
      rewardsPerTokenStored: q.account.rewardsPerTokenStored.toString(),
      rewardsShare: q.account.rewardsShare.toString(),
      numMiners: q.account.numMiners.toString(),
      totalTokensDeposited: q.account.totalTokensDeposited.toString(),
    },
  }));

  const allRewarderQuarries = mapValues(
    groupBy(allQuarriesJSON, (q) => q.rewarder),
    (v) => {
      return v
        .map(({ rewarder: _rewarder, ...rest }) => rest)
        .sort((a, b) => (a.cached.index < b.cached.index ? -1 : 1));
    }
  );

  const allRewardersList = allRewarders.map((rewarder) => {
    const quarries = allRewarderQuarries[rewarder.publicKey.toString()] ?? [];
    if (rewarder.account.numQuarries !== quarries.length) {
      console.warn(
        `Expected ${
          rewarder.account.numQuarries
        } quarries on rewarder ${rewarder.publicKey.toString()}; got ${
          quarries.length
        }`
      );
    }
    return {
      rewarder: rewarder.publicKey.toString(),
      authority: rewarder.account.authority.toString(),
      rewardsTokenMint: rewarder.account.rewardsTokenMint.toString(),
      mintWrapper: rewarder.account.mintWrapper.toString(),
      quarries,
    };
  });
  const allRewardersJSON = mapValues(
    keyBy(allRewardersList, (r) => r.rewarder),
    ({ rewarder: _rewarder, quarries, ...info }) => ({
      ...info,
      quarries: quarries.map(
        ({ cached: _cached, ...quarryInfo }) => quarryInfo
      ),
    })
  );

  // rewarders without the cached values
  await fs.writeFile(
    `${dir}/all-rewarders.json`,
    JSON.stringify(allRewardersJSON, null, 2)
  );

  // quarries with cached values -- go in their own files
  await fs.mkdir(`${dir}/rewarders`, { recursive: true });
  for (const [rewarderKey, rewarderInfo] of Object.entries(allRewardersJSON)) {
    await fs.mkdir(`${dir}/rewarders/${rewarderKey}`, { recursive: true });
    await fs.writeFile(
      `${dir}/rewarders/${rewarderKey}/meta.json`,
      JSON.stringify(rewarderInfo, null, 2)
    );
  }

  console.log(
    `Fetched ${allQuarriesJSON.length} quarries across ${
      Object.keys(allRewarders).length
    } rewarders.`
  );
};

Promise.all([
  fetchAllRewarders("mainnet-beta"),
  fetchAllRewarders("devnet"),
]).catch((err) => {
  console.error(err);
  process.exit(1);
});
