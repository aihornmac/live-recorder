# Live Recorder

Live Recorder is a cli tool to record live stream

## Features

- prioritize recording integrity by using relatively aggresive strategy to make sure all chunks are downloaded

## Installation

    $ npm i -g live-recorder

## Getting Started

Start recording with dfault configurations:

    $ live-recorder https://showroom-live.com/nekojita

Specify output filename:

    $ live-recorder -o my-nekojita https://showroom-live.com/nekojita

Make an appointment in future:

    $ live-recorder --start-at '12:00 tomorrow' https://showroom-live.com/nekojita

More cli options can be found in [sections of corresponding  providers](#supported-sites) below

## Supported Sites

| Site | URL |
| :--: | :-- |
| [SHOWROOM](#showroom) | <https://www.showroom-live.com/> |
| [AbemaTV](#abematv) | <https://abema.tv/> |

### SHOWROOM

Record live chat:

    $ live-recorder --type livechat https://showroom-live.com/nekojita

### AbemaTV

Specify recording content, since you may want to have more information other than video.

    $ live-recorder --content video,chunks,m3u8 https://abema.tv/channels/special-plus/slots/CVRwLESD4GsvQw

Specify user token:

    $ live-recorder --token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkZXYiOiJkZmE1ZWI1ZC0wMDM5LTQ1MzUtOTIwYi00N2RjMDVkODlkNWUiLCJleHAiOjIxNDc0ODM2NDcsImlzcyI6ImFiZW1hLmlvL3YxIiwic3ViIjoiNXZ2ekZDYVgzeGN3M3EifQ.woiwLthcwRCaLb0ppEbaqxuWq4PFMFs_3oUeM2lO40c https://abema.tv/channels/special-plus/slots/CVRwLESD4GsvQw

Disable hash in generated filename:

    $ live-recorder --no-hash https://abema.tv/channels/special-plus/slots/CVRwLESD4GsvQw
