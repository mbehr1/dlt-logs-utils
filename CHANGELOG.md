# Changelog

All notable changes to this project will be documented in this file. See 
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.


## [0.13.3](https://github.com/mbehr1/dlt-logs-utils/compare/v0.13.2...v0.13.3) (2025-04-13)


### Bug Fixes

* **sequence:** support captures for failures ([7cee9d4](https://github.com/mbehr1/dlt-logs-utils/commit/7cee9d4426f8966c02d11ad111a5429c656ed621))

## [0.13.2](https://github.com/mbehr1/dlt-logs-utils/compare/v0.13.1...v0.13.2) (2025-04-12)


### Bug Fixes

* **sequence:** par seq with par seq was not using the current data ([b0e8061](https://github.com/mbehr1/dlt-logs-utils/commit/b0e8061eefacbc56e60480cf7b23993b5822c353))

## [0.13.1](https://github.com/mbehr1/dlt-logs-utils/compare/v0.13.0...v0.13.1) (2025-04-06)


### Bug Fixes

* **sequences:** fix kpi and lastEvent for par step detection ([5a8b01f](https://github.com/mbehr1/dlt-logs-utils/commit/5a8b01fb6402411016950726174057fd0932b415))

# [0.13.0](https://github.com/mbehr1/dlt-logs-utils/compare/v0.12.1...v0.13.0) (2025-04-06)


### Features

* **sequence:** first support for KPIs ([16fa84a](https://github.com/mbehr1/dlt-logs-utils/commit/16fa84ad73bd9196a0d75798f774ec3970a2281e))

## [0.12.1](https://github.com/mbehr1/dlt-logs-utils/compare/v0.12.0...v0.12.1) (2025-04-05)


### Bug Fixes

* **attributes:** minimize the Attribute interface ([4548c95](https://github.com/mbehr1/dlt-logs-utils/commit/4548c952c80748f9912e45cb13ae8e21fbc21d42))

# [0.12.0](https://github.com/mbehr1/dlt-logs-utils/compare/v0.11.0...v0.12.0) (2025-04-05)


### Bug Fixes

* **DltFilter:** support regex for ecu, apid, ctid ([d170fe4](https://github.com/mbehr1/dlt-logs-utils/commit/d170fe484e9cbb0e639764e29bda562ddc1d7c48))


### Features

* support fishbone attributes parsing ([483ba1c](https://github.com/mbehr1/dlt-logs-utils/commit/483ba1cabd5783c88e10f07acc4f5c1fb311a5ab))

# [0.11.0](https://github.com/mbehr1/dlt-logs-utils/compare/v0.10.4...v0.11.0) (2025-04-02)


### Features

* **sequence:** support globalFilters array for main sequence ([6855b59](https://github.com/mbehr1/dlt-logs-utils/commit/6855b599cdbf773edd0ee70ac4648357f70be395))

## [0.10.4](https://github.com/mbehr1/dlt-logs-utils/compare/v0.10.3...v0.10.4) (2025-03-02)


### Bug Fixes

* **sequences:** use html for context and failures ([228f7df](https://github.com/mbehr1/dlt-logs-utils/commit/228f7dfc81d06f6e8744c19c0403b0759ea273c8))

## [0.10.3](https://github.com/mbehr1/dlt-logs-utils/compare/v0.10.2...v0.10.3) (2025-03-02)


### Bug Fixes

* **sequences:** escape using the html notation ([6316a85](https://github.com/mbehr1/dlt-logs-utils/commit/6316a85f6b90087922fc30eedfddcc6eb6762ce4))

## [0.10.2](https://github.com/mbehr1/dlt-logs-utils/compare/v0.10.1...v0.10.2) (2025-01-11)


### Bug Fixes

* **sequences:** , was wrongly escaped to undefined ([aecf5f6](https://github.com/mbehr1/dlt-logs-utils/commit/aecf5f6bee753693f37d5caf142bac43a293453d))

## [0.10.1](https://github.com/mbehr1/dlt-logs-utils/compare/v0.10.0...v0.10.1) (2025-01-07)


### Bug Fixes

* **sequences:** prevent accessing stepResults before being finalized ([ce355f2](https://github.com/mbehr1/dlt-logs-utils/commit/ce355f28842c86342e0a87014dbc817de03ed184))

# [0.10.0](https://github.com/mbehr1/dlt-logs-utils/compare/v0.9.2...v0.10.0) (2025-01-01)


### Bug Fixes

* **sequences:** par steps didn't update the maxStepNr ([39b736c](https://github.com/mbehr1/dlt-logs-utils/commit/39b736c300d6ad1d687cde718e27bac2eb7af9b5))


### Features

* **sequences:** add step attribute ignoreOutOfOrder ([9958920](https://github.com/mbehr1/dlt-logs-utils/commit/99589205df2d61a374e915b5f145d45296af0d39))

## [0.9.2](https://github.com/mbehr1/dlt-logs-utils/compare/v0.9.1...v0.9.2) (2025-01-01)


### Bug Fixes

* **sequences:** escape markdown characters ([2e419ea](https://github.com/mbehr1/dlt-logs-utils/commit/2e419ea31f7bc66b3d5390c9124194024ab4ee59))

## [0.9.1](https://github.com/mbehr1/dlt-logs-utils/compare/v0.9.0...v0.9.1) (2024-12-31)


### Bug Fixes

* **sequences:** result for par steps with sub sequences ([b9d4f82](https://github.com/mbehr1/dlt-logs-utils/commit/b9d4f826e05fd68b0daade4c4b578a9ca1fe83f1))

# [0.9.0](https://github.com/mbehr1/dlt-logs-utils/compare/v0.8.1...v0.9.0) (2024-12-30)


### Features

* par(allel) steps ([ea520dd](https://github.com/mbehr1/dlt-logs-utils/commit/ea520dda6417a957c0de9a5627f28ff04f64f843))

## [0.8.1](https://github.com/mbehr1/dlt-logs-utils/compare/v0.8.0...v0.8.1) (2024-12-26)


### Bug Fixes

* export the sequence occurrence types ([f202110](https://github.com/mbehr1/dlt-logs-utils/commit/f2021104abb2a94ce050d135756d81c8a091f487))

# [0.8.0](https://github.com/mbehr1/dlt-logs-utils/compare/v0.7.0...v0.8.0) (2024-12-26)


### Features

* trigger a release ([a111157](https://github.com/mbehr1/dlt-logs-utils/commit/a111157dbeee1abc05199b91bfa21d5da8672ffb))

# [0.7.0](https://github.com/mbehr1/dlt-logs-utils/compare/v0.6.0...v0.7.0) (2024-12-22)


### Features

* **sequences:** add alt(ernative) steps. ([e295f0d](https://github.com/mbehr1/dlt-logs-utils/commit/e295f0d289003fb4eefa186464a864b7e7aa0c32))

# [0.6.0](https://github.com/mbehr1/dlt-logs-utils/compare/v0.5.1...v0.6.0) (2024-12-20)


### Features

* **sequence:** canCreateNew attribute added ([4ce69a0](https://github.com/mbehr1/dlt-logs-utils/commit/4ce69a00409cb6c6a99aa8c2a8b2826aa47f02c4))

## [0.5.1](https://github.com/mbehr1/dlt-logs-utils/compare/v0.5.0...v0.5.1) (2024-12-20)
