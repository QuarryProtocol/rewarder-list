# Quarry Rewarder List

[![Refresh Registry](https://github.com/QuarryProtocol/rewarder-list/actions/workflows/refresh-registry.yml/badge.svg)](https://github.com/QuarryProtocol/rewarder-list/actions/workflows/refresh-registry.yml)

Cache of a list of rewarders associated with each mint.

## Adding a Rewarder

To add a rewarder, edit [Rewarders.toml](Rewarders.toml) with your rewarder's information and send a pull request.

This will add the rewarder to the Quarry UI, allowing others to discover your protocol's rewards.

## Usage

The following scripts should be run periodically:

```bash
yarn compile-rewarders-list
yarn fetch-all-rewarders
yarn decorate-rewarders
yarn build-token-list
yarn build-tvl-list
```

This will ensure that all of the latest mints are always in the repo.

## License

AGPL-3.0
