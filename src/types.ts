import type { Network } from "@saberhq/solana-contrib";

/**
 * Method on how to redeem the rewards tokens.
 */
export type RedemptionMethod =
  | "quarry-redeemer"
  | "saber"
  | "sunny"
  | "marinade";

/**
 * Fetched information about a rewarder.
 */
export interface RewarderMeta {
  authority: string;
  rewardsTokenMint: string;
  mintWrapper: string;
  quarries: {
    quarry: string;
    stakedToken: {
      address: string;
      decimals: number;
    };
  }[];
}

export interface RewarderMetaWithInfo extends RewarderMeta {
  info?: RewarderInfo;
}

/**
 * Information about a rewarder.
 */
export interface RewarderInfo {
  /**
   * Unique ID of this Rewarder. Should be a URL slug (kebab-case).
   */
  id: string;
  /**
   * Name of the rewarder.
   */
  name: string;
  /**
   * Address of the rewarder.
   */
  address: string;
  /**
   * Networks that this rewarder is deployed on.
   */
  networks: Network[];
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
  /**
   * Allows pools of this rewarder to be mined via Quarry. Defaults to false.
   */
  allowQuarryMine?: boolean;
  /**
   * If true, this pool does not show up on the main farming page.
   */
  hidden?: boolean;

  /**
   * Information on how to redeem an IOU reward token for the underlying reward token, if applicable.
   *
   * The Quarry application will automatically register the reward token in its internal token list.
   */
  redeemer?: RedeemerInfo;
}

export interface RedeemerInfo {
  /**
   * Mint of the underlying reward token.
   */
  underlyingToken: string;
  /**
   * Redemption method.
   */
  method: RedemptionMethod;
}
