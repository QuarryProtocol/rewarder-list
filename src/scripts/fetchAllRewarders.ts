import { Coder } from "@project-serum/anchor";
import type { RewarderData } from "@quarryprotocol/quarry-sdk";
import { QuarryMineJSON, QuarrySDK } from "@quarryprotocol/quarry-sdk";
import type { Network } from "@saberhq/solana-contrib";
import { PublicKey } from "@solana/web3.js";
import * as fs from "fs/promises";
import { groupBy, mapValues, zip } from "lodash";
import invariant from "tiny-invariant";

import rewarderList from "../config/rewarder-list.json";
import type { RedemptionMethod, RewarderInfo } from "../types";
import { makeProvider, serialize } from "../utils";

const mineCoder = new Coder(QuarryMineJSON);

const parseRewarder = (data: Buffer) =>
  mineCoder.accounts.decode<RewarderData>("Rewarder", data);

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

export const fetchAllRewarders = async (network: Network): Promise<void> => {
  const provider = makeProvider(network);

  const quarry = QuarrySDK.load({ provider });
  const registry = quarry.programs.Registry;
  const allRegistries = await registry.account.registry.all();

  const networkRewarders = KNOWN_REWARDERS.filter((kr) =>
    kr.networks.includes(network)
  );

  const rewarderKeys = allRegistries.map((r) => r.account.rewarder);

  const rewarderInfo: Record<string, { rewardsTokenMint: PublicKey }> = {};
  zip(
    rewarderKeys,
    await provider.connection.getMultipleAccountsInfo(rewarderKeys)
  ).forEach(([rewarderKey, account]) => {
    invariant(rewarderKey, "rewarder key");
    invariant(account, "rewarder account");
    const rewarderData = parseRewarder(account.data);
    rewarderInfo[rewarderKey.toString()] = {
      rewardsTokenMint: rewarderData.rewardsTokenMint,
    };
  });

  const rewardersJSON = allRegistries.map((reg) => {
    const rewardsTokenMint =
      rewarderInfo[reg.account.rewarder.toString()]?.rewardsTokenMint;
    invariant(rewardsTokenMint, "rewards token mint");
    return {
      rewarder: reg.account.rewarder,
      tokens: reg.account.tokens.filter(
        (tok) => !tok.equals(PublicKey.default)
      ),
      info: networkRewarders.find(
        (r) => r.address === reg.account.rewarder.toString()
      ),
      rewardsTokenMint,
    };
  });

  const rewardersByMint = mapValues(
    groupBy(
      allRegistries.flatMap((reg) =>
        reg.account.tokens
          .filter((tok) => !tok.equals(PublicKey.default))
          .map((token) => ({
            rewarder: reg.account.rewarder,
            token: token.toString(),
          }))
      ),
      (el) => el.token
    ),
    (group) => group.map((g) => g.rewarder.toString())
  );

  const dir = `${__dirname}/../../data/${network}/`;

  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    `${dir}/rewarders.json`,
    JSON.stringify(rewardersJSON, serialize)
  );
  await fs.writeFile(
    `${dir}/rewarders-by-mint.json`,
    JSON.stringify(rewardersByMint, serialize)
  );
  await fs.writeFile(
    `${dir}/rewarder-list.json`,
    JSON.stringify(networkRewarders, serialize)
  );
};

Promise.all([
  fetchAllRewarders("mainnet-beta"),
  fetchAllRewarders("devnet"),
]).catch((err) => {
  console.error(err);
});
