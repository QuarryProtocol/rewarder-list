import { QuarrySDK } from "@quarryprotocol/quarry-sdk";
import type { Network } from "@saberhq/solana-contrib";
import { SignerWallet, SolanaProvider } from "@saberhq/solana-contrib";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import * as fs from "fs/promises";
import { groupBy, mapValues } from "lodash";

import rewarderList from "../config/rewarder-list.json";
import type { RedemptionMethod, RewarderInfo } from "../types";

const serialize = (_: unknown, v: unknown) => {
  if (v instanceof PublicKey) {
    return v.toString();
  }
  return v;
};

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

export const fetchAllRewarders = async (): Promise<void> => {
  const provider = SolanaProvider.load({
    connection: new Connection("https://barry.rpcpool.com"),
    wallet: new SignerWallet(Keypair.generate()),
  });

  const quarry = QuarrySDK.load({ provider });
  const registry = quarry.programs.Registry;
  const allRegistries = await registry.account.registry.all();

  const rewardersJSON = allRegistries.map((reg) => ({
    rewarder: reg.account.rewarder,
    tokens: reg.account.tokens.filter((tok) => !tok.equals(PublicKey.default)),
    info: KNOWN_REWARDERS.find(
      (r) => r.address === reg.account.rewarder.toString()
    ),
  }));

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

  await fs.mkdir("data/", { recursive: true });
  await fs.writeFile(
    "data/rewarders.json",
    JSON.stringify(rewardersJSON, serialize)
  );
  await fs.writeFile(
    "data/rewarders-by-mint.json",
    JSON.stringify(rewardersByMint)
  );
  await fs.writeFile("data/rewarder-list.json", JSON.stringify(rewarderList));
};

fetchAllRewarders().catch((err) => {
  console.error(err);
});
