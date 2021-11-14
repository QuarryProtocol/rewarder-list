# Quarry Rewarder List

Cache of a list of rewarders associated with each mint.

## Adding a Rewarder

To add a rewarder, edit [src/config/known-rewarders.json](src/config/known-rewarders.json) with your rewarder's information and send a pull request.

This will add the rewarder to the Quarry UI, allowing others to discover your protocol's rewards.

## Usage

The following scripts should be run periodically:

```bash
yarn fetch-all-rewarders
yarn build-token-list
```

This will ensure that all of the latest mints are always in the repo.

## License

AGPL-3.0
