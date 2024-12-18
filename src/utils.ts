import type { Network } from "@saberhq/solana-contrib";
import { SignerWallet, SolanaProvider } from "@saberhq/solana-contrib";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import fastStringify from "fast-json-stable-stringify";

export const stringify = (v: unknown) =>
  JSON.stringify(
    JSON.parse(fastStringify(JSON.parse(JSON.stringify(v, serialize)))),
    null,
    2,
  );

export const serialize = (_: unknown, v: unknown) => {
  if (v instanceof PublicKey) {
    return v.toString();
  }
  return v;
};

export const makeProvider = (network: Network) => {
  return SolanaProvider.init({
    connection: new Connection(
      network === "mainnet-beta"
        ? "https://saber-solanam-77b6.mainnet.rpcpool.com/d1c03a8b-bd71-4d78-93a0-4f17bd818c1e"
        : "https://api.devnet.solana.com",
      {
        // https://solana.stackexchange.com/questions/6376/premature-close-error-when-fetching-25-or-more-accounts-at-once-with-solana-web
        // https://github.com/solana-labs/solana-web3.js/issues/1418
        httpAgent: false,
      },
    ),
    wallet: new SignerWallet(Keypair.generate()),
  });
};
