/**
 * Information about a rewarder.
 */
export interface RewarderInfo {
  /**
   * Name of the rewarder.
   */
  name: string;
  /**
   * Color to use for the rewarder's name.
   *
   * Please choose a color that looks good on dark backgrounds.
   */
  color: string;
  /**
   * Description of the protocol that the rewarder originates from.
   */
  description: string;
  /**
   * Website of the rewarder.
   */
  website: string;
}

/**
 * List of known rewarders.
 *
 * These rewarders will show up as verified in the list of all rewarders.
 */
export const KNOWN_REWARDERS: Record<string, RewarderInfo> = {
  rXhAofQCT7NN9TUqigyEAUzV1uLL4boeD8CRkNBSkYk: {
    name: "Saber",
    color: "#6966FB",
    description:
      "Saber is a protocol enabling seamless cross-chain liquidity exchange.",
    website: "https://saber.so",
  },
  "97PmYbGpSHSrKrUkQX793mjpA2EA9rrQKkHsQuvenU44": {
    name: "Sunny Aggregator",
    color: "#DC723F",
    description: "Solana's cross-chain DeFi yield aggregator.",
    website: "https://sunny.ag",
  },
};
