# Changelog

## [0.0.20] - 2020-06-25
### Added
- add commands for providers, the canonical format is `live-recorder <provider> ...` (provider is case insensitive)
- [AbemaTV] add command `login` with option `--token` to set token in configuration

## [0.0.19] - 2020-06-25
### Added
- [AbemaTV] add cli option `content`, providing more output types, including `video`, `chunks`, `m3u8`

## [0.0.18] - 2020-06-25
### Added
- cope with SHOWROOM live interruption

## [0.0.17] - 2020-06-24
### Added
- add supports for more AbemaTV stream type: `onair` `serires` `season` `episode`
- AbemaTV cli now display progress bar while recording hls stream

## [0.0.16] - 2020-06-24
### Fixed
- showroom livechat recording now exists when live ends
- cli `--help` `-h` now prints help even without url input

### Added
- cli `--version` `-v` now prints tool version

## [0.0.15] - 2020-06-23
### Fixed
- start time is awaited incorrectly

## [0.0.14] - 2020-06-22
### Added
- Basic support for AbemaTV
