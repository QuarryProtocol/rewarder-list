import type { Network } from "@saberhq/solana-contrib";
import { SignerWallet, SolanaProvider } from "@saberhq/solana-contrib";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";

export const serialize = (_: unknown, v: unknown) => {
  if (v instanceof PublicKey) {
    return v.toString();
  }
  return v;
};

export const makeProvider = (network: Network) => {
  return SolanaProvider.load({
    connection: new Connection(
      network === "mainnet-beta"
        ? "https://barry.rpcpool.com"
        : "https://api.devnet.solana.com"
    ),
    wallet: new SignerWallet(Keypair.generate()),
  });
};
