import { QuarrySDK } from "@quarryprotocol/quarry-sdk";
import { SignerWallet, SolanaProvider } from "@saberhq/solana-contrib";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import * as fs from "fs/promises";
import { groupBy, mapValues } from "lodash";

const serialize = (_: unknown, v: unknown) => {
  if (v instanceof PublicKey) {
    return v.toString();
  }
  return v;
};

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
};

fetchAllRewarders().catch((err) => {
  console.error(err);
});
