# Live Recorder

Live Recorder is a cli tool to record live stream

## Features

- prioritize recording integrity by using relatively aggresive strategy to make sure all chunks are downloaded

## Installation

    $ npm i -g live-recorder

## Getting Started

Start recording with default configurations:

    $ live-recorder https://showroom-live.com/nekojita

Specify output filename:

    $ live-recorder -o my-nekojita https://showroom-live.com/nekojita

Make an appointment in future:

    $ live-recorder --start-at '12:00 tomorrow' https://showroom-live.com/nekojita

Enable verbose mode:

    $ live-recorder --verbose https://showroom-live.com/nekojita

More cli options can be found in [sections of corresponding  providers](#supported-sites) below

## Supported Sites

| Site | URL |
| :--: | :-- |
| [SHOWROOM](#showroom) | <https://www.showroom-live.com/> |
| [AbemaTV](#abematv) | <https://abema.tv/> |
| [radiko](#radiko) | <https://radiko.jp/> |

### SHOWROOM

Record live chat:

    $ live-recorder --type livechat https://showroom-live.com/nekojita

### AbemaTV

Specify recording content, since you may want to have more information other than video.

    $ live-recorder --content video,chunks,m3u8 https://abema.tv/channels/special-plus/slots/CVRwLESD4GsvQw

Specify user token:

    $ live-recorder --token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkZXYiOiJkZmE1ZWI1ZC0wMDM5LTQ1MzUtOTIwYi00N2RjMDVkODlkNWUiLCJleHAiOjIxNDc0ODM2NDcsImlzcyI6ImFiZW1hLmlvL3YxIiwic3ViIjoiNXZ2ekZDYVgzeGN3M3EifQ.woiwLthcwRCaLb0ppEbaqxuWq4PFMFs_3oUeM2lO40c https://abema.tv/channels/special-plus/slots/CVRwLESD4GsvQw

Specify download concurrency:

    $ live-recorder --concurrent 8 https://abema.tv/channels/special-plus/slots/CVRwLESD4GsvQw

Disable hash in generated filename:

    $ live-recorder --no-hash https://abema.tv/channels/special-plus/slots/CVRwLESD4GsvQw

Set token in configuration:

    $ live-recorder abematv login --token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkZXYiOiJkZmE1ZWI1ZC0wMDM5LTQ1MzUtOTIwYi00N2RjMDVkODlkNWUiLCJleHAiOjIxNDc0ODM2NDcsImlzcyI6ImFiZW1hLmlvL3YxIiwic3ViIjoiNXZ2ekZDYVgzeGN3M3EifQ.woiwLthcwRCaLb0ppEbaqxuWq4PFMFs_3oUeM2lO40c

### radiko

Specify recording content, since you may want to have more information other than video.

    $ live-recorder --content audio.cover,chunks,m3u8 'http://radiko.jp/#!/ts/LFR/20200702010000'

Specify login info:

    $ live-recorder --mail test123@example.com --password password 'http://radiko.jp/#!/ts/LFR/20200702010000'

Specify download concurrency:

    $ live-recorder --concurrent 8 'http://radiko.jp/#!/ts/LFR/20200702010000'

Disable hash in generated filename:

    $ live-recorder --no-hash 'http://radiko.jp/#!/ts/LFR/20200702010000'

Set login info in configuration:

    $ live-recorder abematv login --mail test123@example.com' --password password
