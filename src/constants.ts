export interface RewarderInfo {
  name: string;
  color: string;
}

/**
 * List of known rewarders by name.
 */
export const KNOWN_REWARDERS: Record<string, RewarderInfo> = {
  rXhAofQCT7NN9TUqigyEAUzV1uLL4boeD8CRkNBSkYk: {
    name: "Saber",
    color: "#6966FB",
  },
  "97PmYbGpSHSrKrUkQX793mjpA2EA9rrQKkHsQuvenU44": {
    name: "Sunny Aggregator",
    color: "#DC723F",
  },
};
