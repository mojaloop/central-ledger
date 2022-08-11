# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [16.1.0](https://github.com/mojaloop/central-ledger/compare/v16.0.0...v16.1.0) (2022-08-11)


### Bug Fixes

* **mojaloop/#2796:** duplicate transaction not getting callback for post /bulkTransfers (not forked) ([#915](https://github.com/mojaloop/central-ledger/issues/915)) ([e520aa5](https://github.com/mojaloop/central-ledger/commit/e520aa5c5e748a051534f69f5734918f0e02f379)), closes [mojaloop/#2796](https://github.com/mojaloop/project/issues/2796)

## [16.0.0](https://github.com/mojaloop/central-ledger/compare/v15.2.0...v16.0.0) (2022-08-05)


### ⚠ BREAKING CHANGES

* rework bulk handler validation  (#913)

### Refactors

* rework bulk handler validation  ([#913](https://github.com/mojaloop/central-ledger/issues/913)) ([38d29fd](https://github.com/mojaloop/central-ledger/commit/38d29fde13128fa656b6a3cfd71c05ba52b92994))

## [15.2.0](https://github.com/mojaloop/central-ledger/compare/v15.1.3...v15.2.0) (2022-08-01)


### Features

* add bulk error handling notification callbacks ([#911](https://github.com/mojaloop/central-ledger/issues/911)) ([9ac6e1a](https://github.com/mojaloop/central-ledger/commit/9ac6e1afe3a72cbad0c1b5fc2a7a559d6435ce63))

### [15.1.3](https://github.com/mojaloop/central-ledger/compare/v15.1.2...v15.1.3) (2022-07-12)


### Chore

* add ci to publish npm package ([#909](https://github.com/mojaloop/central-ledger/issues/909)) ([f0ac068](https://github.com/mojaloop/central-ledger/commit/f0ac068d1f689a650ac80cf9d8806dec1c64c59b))
* fixed typo ([140ebdf](https://github.com/mojaloop/central-ledger/commit/140ebdfa7a8c0a36fb147191017b8714dc121a95))
* updates to readme for header badges [skip ci] ([#910](https://github.com/mojaloop/central-ledger/issues/910)) ([c8b69b3](https://github.com/mojaloop/central-ledger/commit/c8b69b314e08eaa143d9e8a6fdc97b30e7387a5c))

### [15.1.2](https://github.com/mojaloop/central-ledger/compare/v15.1.1...v15.1.2) (2022-07-05)


### Bug Fixes

* **mojaloop/#2810:** timeout evts are being prod for transfers with an int-state of ABORTED_ERROR ([#907](https://github.com/mojaloop/central-ledger/issues/907)) ([e77de0a](https://github.com/mojaloop/central-ledger/commit/e77de0a8e7dd473d3afbb27df464d27ff5ce98a7)), closes [mojaloop/#2810](https://github.com/mojaloop/project/issues/2810)


### Chore

* fix audit-resolve ([4e3a969](https://github.com/mojaloop/central-ledger/commit/4e3a969b9da78760540f375144bf25b347d0a8ae))

### [15.1.1](https://github.com/mojaloop/central-ledger/compare/v15.1.0...v15.1.1) (2022-06-17)


### Bug Fixes

* set ttk func tests as dependency ([#906](https://github.com/mojaloop/central-ledger/issues/906)) ([a146431](https://github.com/mojaloop/central-ledger/commit/a1464312e5b39d564d3b89ad0f055ca54f897df1))

## [15.1.0](https://github.com/mojaloop/central-ledger/compare/v15.0.2...v15.1.0) (2022-06-17)


### Features

* added functonal test pipline to circle-cicd ([#905](https://github.com/mojaloop/central-ledger/issues/905)) ([2dd0dae](https://github.com/mojaloop/central-ledger/commit/2dd0daef7aea4bc3694a21655105e6bd5f7d73db))

### [15.0.2](https://github.com/mojaloop/central-ledger/compare/v15.0.1...v15.0.2) (2022-06-10)


### Bug Fixes

* docker file using ci instead of install ([#904](https://github.com/mojaloop/central-ledger/issues/904)) ([b01f079](https://github.com/mojaloop/central-ledger/commit/b01f0795f3fae5523ebc22ba740a90838c93f4bf))

### [15.0.1](https://github.com/mojaloop/central-ledger/compare/v15.0.0...v15.0.1) (2022-05-26)


### Bug Fixes

* error codes for liquidity and ndc limit check ([#901](https://github.com/mojaloop/central-ledger/issues/901)) ([83a197c](https://github.com/mojaloop/central-ledger/commit/83a197cdded36f71c884104587cd67d2f494ce92))

## [15.0.0](https://github.com/mojaloop/central-ledger/compare/v14.0.0...v15.0.0) (2022-05-26)


### ⚠ BREAKING CHANGES

* **mojaloop/#2092:** Major version bump for node v16 LTS support, re-structuring of project directories to align to core Mojaloop repositories and docker image now uses `/opt/app` instead of `/opt/central-ledger` which will impact config mounts.

### Features

* **mojaloop/#2092:** upgrade nodeJS version for core services ([#902](https://github.com/mojaloop/central-ledger/issues/902)) ([defff30](https://github.com/mojaloop/central-ledger/commit/defff30b2bf29a74a4bb152e5fa4af00ae5b7463)), closes [mojaloop/#2092](https://github.com/mojaloop/project/issues/2092)


### Bug Fixes

* ci publish issue ([#903](https://github.com/mojaloop/central-ledger/issues/903)) ([49b3f06](https://github.com/mojaloop/central-ledger/commit/49b3f06b29a9b1ed52fa7431597bbf6637a99297))

## [14.0.0](https://github.com/mojaloop/central-ledger/compare/v13.16.3...v14.0.0) (2022-05-17)


### ⚠ BREAKING CHANGES

* Transfer will be successful only if the payer has settlement account balance. This is the additional check that has been added in this PR. And also the error message is changed for NDC limit check from `PAYER_FSP_INSUFFICIENT_LIQUIDITY` to `PAYER_LIMIT_ERROR`. Now the error message `PAYER_FSP_INSUFFICIENT_LIQUIDITY` occurs when the payer has insufficient settlement account balance.

### Features

* update liquidity check ([#899](https://github.com/mojaloop/central-ledger/issues/899)) ([2e33a5a](https://github.com/mojaloop/central-ledger/commit/2e33a5a1dc5996d1d2f39a629a17710f8cbd6d69))

### [13.16.3](https://github.com/mojaloop/central-ledger/compare/v13.16.2...v13.16.3) (2022-04-05)


### Bug Fixes

* package.json & package-lock.json to reduce vulnerabilities ([#893](https://github.com/mojaloop/central-ledger/issues/893)) ([4b036a4](https://github.com/mojaloop/central-ledger/commit/4b036a42122ad66e402598b44b29bd96cb85e122))

### [13.16.2](https://github.com/mojaloop/central-ledger/compare/v13.16.1...v13.16.2) (2022-03-30)


### Chore

* updated populateTestData.sh script ([#892](https://github.com/mojaloop/central-ledger/issues/892)) ([df2495b](https://github.com/mojaloop/central-ledger/commit/df2495b6c14da7dbf16bc44d88655a8d54b7024e))

### [13.16.1](https://github.com/mojaloop/central-ledger/compare/v13.16.0...v13.16.1) (2022-03-14)


### Bug Fixes

* **mojaloop/#2719:** post quotes fails when transactionId does not equal transactionRequestId ([#887](https://github.com/mojaloop/central-ledger/issues/887)) ([b9944d1](https://github.com/mojaloop/central-ledger/commit/b9944d15c9486ffd62b968797fb79847a512a6c8)), closes [mojaloop/#2719](https://github.com/mojaloop/project/issues/2719)

## [13.16.0](https://github.com/mojaloop/central-ledger/compare/v13.15.4...v13.16.0) (2022-03-03)


### Features

* **mojaloop/#2704:** core-services support for non-breaking backward api compatibility ([#884](https://github.com/mojaloop/central-ledger/issues/884)) ([02cf7c2](https://github.com/mojaloop/central-ledger/commit/02cf7c25b4071bb44f62271d7e9bdbc8674a1ee7)), closes [mojaloop/#2704](https://github.com/mojaloop/project/issues/2704)

### [13.15.4](https://github.com/mojaloop/central-ledger/compare/v13.15.3...v13.15.4) (2022-02-25)


### Chore

* added more error loggers on bulk prepare ([#882](https://github.com/mojaloop/central-ledger/issues/882)) ([aa7a159](https://github.com/mojaloop/central-ledger/commit/aa7a1594bc6577818f6779e94f770c9150285170))

### [13.15.3](https://github.com/mojaloop/central-ledger/compare/v13.15.2...v13.15.3) (2022-02-25)


### Chore

* added-more-error-loggers-on-bulk-prepare ([#881](https://github.com/mojaloop/central-ledger/issues/881)) ([e212160](https://github.com/mojaloop/central-ledger/commit/e212160874abf71314702f27bef208c0f071b64a))

### [13.15.2](https://github.com/mojaloop/central-ledger/compare/v13.15.1...v13.15.2) (2022-02-25)


### Bug Fixes

* bug fix for the last chore update on bulk handlers ([#880](https://github.com/mojaloop/central-ledger/issues/880)) ([6b3a269](https://github.com/mojaloop/central-ledger/commit/6b3a2695b657c6dff8c79a1fb4447320411eb746))

### [13.15.1](https://github.com/mojaloop/central-ledger/compare/v13.15.0...v13.15.1) (2022-02-23)


### Chore

* minor updates and dependency cleanup ([#879](https://github.com/mojaloop/central-ledger/issues/879)) ([0c9c4bb](https://github.com/mojaloop/central-ledger/commit/0c9c4bba7b4e08562e5e46499070e3e57db6b463))

## [13.15.0](https://github.com/mojaloop/central-ledger/compare/v13.14.6...v13.15.0) (2022-02-22)


### Features

* **mojaloop/project#2556:** implement patch notification for failure scenarios ([#874](https://github.com/mojaloop/central-ledger/issues/874)) ([8b72cfe](https://github.com/mojaloop/central-ledger/commit/8b72cfe41558bf955fd516eba06d921e988d0664)), closes [mojaloop/project#2556](https://github.com/mojaloop/project/issues/2556) [#2697](https://github.com/mojaloop/central-ledger/issues/2697)

### [13.14.6](https://github.com/mojaloop/central-ledger/compare/v13.14.5...v13.14.6) (2021-11-17)


### Chore

* **refactor:** tidy up fulfil handler code ([#870](https://github.com/mojaloop/central-ledger/issues/870)) ([49c1f88](https://github.com/mojaloop/central-ledger/commit/49c1f887d54aea902ba03f15755cd7f32faabaf3))

### [13.14.5](https://github.com/mojaloop/central-ledger/compare/v13.14.4...v13.14.5) (2021-11-11)


### Chore

* update to docker-compose & dependencies ([#871](https://github.com/mojaloop/central-ledger/issues/871)) ([69fc49e](https://github.com/mojaloop/central-ledger/commit/69fc49e32d4768447f980d455b8a462618ba5a75))

### [13.14.4](https://github.com/mojaloop/central-ledger/compare/v13.14.3...v13.14.4) (2021-11-10)


### Bug Fixes

* **#2557:** error notification to payer fsp, header for source having wrong value ([#869](https://github.com/mojaloop/central-ledger/issues/869)) ([472fc12](https://github.com/mojaloop/central-ledger/commit/472fc12763ca53f2ea92093b7d9925c9028a92a1)), closes [#2557](https://github.com/mojaloop/central-ledger/issues/2557)

### [13.14.3](https://github.com/mojaloop/central-ledger/compare/v13.14.2...v13.14.3) (2021-10-01)


### Bug Fixes

* **mojaloop/2525:** transfers are not being assigned to a settlementWindow on transfers version=1.1 ([#866](https://github.com/mojaloop/central-ledger/issues/866)) ([602704b](https://github.com/mojaloop/central-ledger/commit/602704bfb9d63764e66d59d53e42b2469c34bfc3)), closes [#2525](https://github.com/mojaloop/central-ledger/issues/2525)

### [13.14.2](https://github.com/mojaloop/central-ledger/compare/v13.14.1...v13.14.2) (2021-09-29)


### Bug Fixes

* **mojaloop/#2522:** cl-migration scripts should configure quoting tables to utf8 follow-up ([#865](https://github.com/mojaloop/central-ledger/issues/865)) ([dcc57b8](https://github.com/mojaloop/central-ledger/commit/dcc57b8f22bc66fa4e6ae35ce04cf095fce780c6)), closes [mojaloop/#2522](https://github.com/mojaloop/project/issues/2522)

### [13.14.1](https://github.com/mojaloop/central-ledger/compare/v13.14.0...v13.14.1) (2021-09-17)


### Bug Fixes

* change endpoint types to line up with enums ([#863](https://github.com/mojaloop/central-ledger/issues/863)) ([2046288](https://github.com/mojaloop/central-ledger/commit/2046288d7070711a5bb7eb600bf0f1e87c0e8768))

## [13.14.0](https://github.com/mojaloop/central-ledger/compare/v13.13.4...v13.14.0) (2021-09-16)


### Features

* **mojaloop/#2480:** central-ledger migration scripts to configure quote party table utf8 support ([#862](https://github.com/mojaloop/central-ledger/issues/862)) ([bf4da0e](https://github.com/mojaloop/central-ledger/commit/bf4da0e7645edf2e701b36b9f78c32c8783136b8)), closes [mojaloop/#2480](https://github.com/mojaloop/project/issues/2480)

### [13.13.4](https://github.com/mojaloop/central-ledger/compare/v13.13.3...v13.13.4) (2021-08-24)


### Chore

* **deps:** bump path-parse from 1.0.6 to 1.0.7 ([#858](https://github.com/mojaloop/central-ledger/issues/858)) ([77d4251](https://github.com/mojaloop/central-ledger/commit/77d42518075e200a00a958a19db35591d96b6f65))

### [13.13.3](https://github.com/mojaloop/central-ledger/compare/v13.13.1...v13.13.3) (2021-08-06)


### Chore

* **deps:** [security] bump normalize-url from 4.5.0 to 4.5.1 ([#848](https://github.com/mojaloop/central-ledger/issues/848)) ([d3f0c48](https://github.com/mojaloop/central-ledger/commit/d3f0c48f176f73b0e682f3cd14222bdb1546751a))
* **deps:** [security] bump tar from 6.1.0 to 6.1.3 ([#855](https://github.com/mojaloop/central-ledger/issues/855)) ([ec9e5cc](https://github.com/mojaloop/central-ledger/commit/ec9e5cc4c9ee56fa7caa628b9cc6cdfe9723cfe8))
* **deps:** [security] bump urijs from 1.19.6 to 1.19.7 ([#854](https://github.com/mojaloop/central-ledger/issues/854)) ([97db6ac](https://github.com/mojaloop/central-ledger/commit/97db6ac73eefb5628843121d8ad7eec9238bc030))
* **release:** 13.13.2 [skip ci] ([a969db1](https://github.com/mojaloop/central-ledger/commit/a969db1bf3ea212ea1ef06dda31db1bf23134ff6))

### [13.13.2](https://github.com/mojaloop/central-ledger/compare/v13.13.1...v13.13.2) (2021-08-06)


### Chore

* **deps:** [security] bump normalize-url from 4.5.0 to 4.5.1 ([#848](https://github.com/mojaloop/central-ledger/issues/848)) ([d3f0c48](https://github.com/mojaloop/central-ledger/commit/d3f0c48f176f73b0e682f3cd14222bdb1546751a))
* **deps:** [security] bump urijs from 1.19.6 to 1.19.7 ([#854](https://github.com/mojaloop/central-ledger/issues/854)) ([97db6ac](https://github.com/mojaloop/central-ledger/commit/97db6ac73eefb5628843121d8ad7eec9238bc030))

### [13.13.1](https://github.com/mojaloop/central-ledger/compare/v13.13.0...v13.13.1) (2021-08-06)


### Chore

* add seeds for /verifications endpoint ([#857](https://github.com/mojaloop/central-ledger/issues/857)) ([024942b](https://github.com/mojaloop/central-ledger/commit/024942b288001fb3b52ebbbd7463aebe1929f150))

## [13.13.0](https://github.com/mojaloop/central-ledger/compare/v13.12.1...v13.13.0) (2021-06-30)


### Features

* **#2300:** add logging statements for all errors ([#852](https://github.com/mojaloop/central-ledger/issues/852)) ([2cd6446](https://github.com/mojaloop/central-ledger/commit/2cd64460bfa4c9858c32fb221c01d3a4d64ac504)), closes [#2300](https://github.com/mojaloop/central-ledger/issues/2300)

### [13.12.1](https://github.com/mojaloop/central-ledger/compare/v13.11.1...v13.12.1) (2021-06-22)


### Bug Fixes

* helm release 12.1 for default settlement functionality  ([#853](https://github.com/mojaloop/central-ledger/issues/853)) ([7904b76](https://github.com/mojaloop/central-ledger/commit/7904b76f0f56539a4024b9d5233f77423ddcd63b))

### [13.11.1](https://github.com/mojaloop/central-ledger/compare/v13.11.0...v13.11.1) (2021-06-15)


### Chore

* remove seeds added by mistake ([#850](https://github.com/mojaloop/central-ledger/issues/850)) ([b5195ac](https://github.com/mojaloop/central-ledger/commit/b5195ac2806683ec38035aa71a978ba0444b0be9))

## [13.11.0](https://github.com/mojaloop/central-ledger/compare/v13.10.2...v13.11.0) (2021-06-13)


### Features

* add endpoints for last stage of account linking ([#849](https://github.com/mojaloop/central-ledger/issues/849)) ([eff5c7f](https://github.com/mojaloop/central-ledger/commit/eff5c7f3c099c28b631725709e69902fb6773739))


### Chore

* **deps:** [security] bump hosted-git-info from 2.8.8 to 2.8.9 ([#840](https://github.com/mojaloop/central-ledger/issues/840)) ([d093895](https://github.com/mojaloop/central-ledger/commit/d093895b0bca6a4a2d36e86547ccafe39aa3b8f1))

### [13.10.2](https://github.com/mojaloop/central-ledger/compare/v13.10.0...v13.10.2) (2021-05-26)


### Bug Fixes

* helm release v12.1.0 ([#845](https://github.com/mojaloop/central-ledger/issues/845)) ([51731b0](https://github.com/mojaloop/central-ledger/commit/51731b0f1656d87bb1e1fe4ea4425ab2a385cae0))

## [13.10.0](https://github.com/mojaloop/central-ledger/compare/v13.9.0...v13.10.0) (2021-05-14)


### Features

* **2151:** helm-release-v12.1.0 ([#844](https://github.com/mojaloop/central-ledger/issues/844)) ([2b1ecab](https://github.com/mojaloop/central-ledger/commit/2b1ecabbfbbd46807749a6986f1a3d8643d1dba7))

## [13.9.0](https://github.com/mojaloop/central-ledger/compare/v13.8.0...v13.9.0) (2021-05-14)


### Features

* **2151:** helm-release-v12.1.0 ([#843](https://github.com/mojaloop/central-ledger/issues/843)) ([02fa819](https://github.com/mojaloop/central-ledger/commit/02fa819dac16d301f626177871d99e225982098d))

## [13.8.0](https://github.com/mojaloop/central-ledger/compare/v13.6.0...v13.8.0) (2021-05-14)


### Features

* **2151:** helm-release-v12.1.0 ([#842](https://github.com/mojaloop/central-ledger/issues/842)) ([459c9e0](https://github.com/mojaloop/central-ledger/commit/459c9e0890bb4a56e240c22ef2490927087f0204))

## [13.6.0](https://github.com/mojaloop/central-ledger/compare/v13.4.0...v13.6.0) (2021-05-12)


### Features

* **#2123:** default settlement model added ([#839](https://github.com/mojaloop/central-ledger/issues/839)) ([605177a](https://github.com/mojaloop/central-ledger/commit/605177af94314e5170c7d1927b2492dd8060c4b5)), closes [#2123](https://github.com/mojaloop/central-ledger/issues/2123)

## [13.4.0](https://github.com/mojaloop/central-ledger/compare/v13.3.0...v13.4.0) (2021-05-07)


### Features

* add services endpoint seeds ([#838](https://github.com/mojaloop/central-ledger/issues/838)) ([233785e](https://github.com/mojaloop/central-ledger/commit/233785e73662782be29c12590007313bda21b2d5))

## [13.3.0](https://github.com/mojaloop/central-ledger/compare/v13.2.6...v13.3.0) (2021-05-04)


### Features

* **db migrations:** fix subid db ([#836](https://github.com/mojaloop/central-ledger/issues/836)) ([de5077a](https://github.com/mojaloop/central-ledger/commit/de5077a478131455f43ec478e55caa7d2c5ce295))


### Bug Fixes

* **security:** Bump y18n from 3.2.1 to 3.2.2 ([#830](https://github.com/mojaloop/central-ledger/issues/830)) ([32346e5](https://github.com/mojaloop/central-ledger/commit/32346e522075589c956e9f2d7a979b2905215c89))
* package.json & package-lock.json to reduce vulnerabilities ([#829](https://github.com/mojaloop/central-ledger/issues/829)) ([16a75af](https://github.com/mojaloop/central-ledger/commit/16a75af6ff7bc7aa7ed45d11344ec976c0cfd9bc))


### Chore

* **deps:** bump djv from 2.1.2 to 2.1.4 ([#833](https://github.com/mojaloop/central-ledger/issues/833)) ([182a591](https://github.com/mojaloop/central-ledger/commit/182a591196e2056440f4aaf5ca5b9dceccbc81ed))

### [13.2.6](https://github.com/mojaloop/central-ledger/compare/v13.2.5...v13.2.6) (2021-03-15)


### Chore

* add patch consentRequest and put cr error endpoints ([#828](https://github.com/mojaloop/central-ledger/issues/828)) ([6cb311a](https://github.com/mojaloop/central-ledger/commit/6cb311a5526efc12011b96f09d4857f7926fe345))

### [13.2.5](https://github.com/mojaloop/central-ledger/compare/v13.2.4...v13.2.5) (2021-03-05)


### Bug Fixes

* [#1977](https://github.com/mojaloop/central-ledger/issues/1977) timeout enumeration for cron job fixed ([#824](https://github.com/mojaloop/central-ledger/issues/824)) ([2bb426d](https://github.com/mojaloop/central-ledger/commit/2bb426d52b29a9c797b1a2307110acf3c0082b7e))

### [13.2.4](https://github.com/mojaloop/central-ledger/compare/v13.2.3...v13.2.4) (2021-03-05)

### [13.2.3](https://github.com/mojaloop/central-ledger/compare/v13.2.2...v13.2.3) (2021-02-25)


### Chore

* add accounts callback endpoints ([#822](https://github.com/mojaloop/central-ledger/issues/822)) ([9e4d017](https://github.com/mojaloop/central-ledger/commit/9e4d017120dc8030c1cb66ded31b73c9f47aafa5))

### [13.2.2](https://github.com/mojaloop/central-ledger/compare/v13.2.1...v13.2.2) (2021-02-24)


### Chore

* fix hidden commit types not being included in changelog ([#821](https://github.com/mojaloop/central-ledger/issues/821)) ([3a490c1](https://github.com/mojaloop/central-ledger/commit/3a490c18ecba7b481ee65431700a886c9e963673))

### [13.2.1](https://github.com/mojaloop/central-ledger/compare/v13.2.0...v13.2.1) (2021-02-23)


### Bug Fixes

* branch filter regex ([#820](https://github.com/mojaloop/central-ledger/issues/820)) ([14a04be](https://github.com/mojaloop/central-ledger/commit/14a04bedfcbde05b495f36938c6fef666090eef3))

## [13.2.0](https://github.com/mojaloop/central-ledger/compare/v13.1.1...v13.2.0) (2021-02-23)


### Features

* enable feature branch based releases ([#819](https://github.com/mojaloop/central-ledger/issues/819)) ([346f09f](https://github.com/mojaloop/central-ledger/commit/346f09f98613b84a1ba2e21a9f5d869a516b3bde))

### [13.1.1](https://github.com/mojaloop/central-ledger/compare/v13.1.0...v13.1.1) (2021-02-23)
