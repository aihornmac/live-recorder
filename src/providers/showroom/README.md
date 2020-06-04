
# Live Chat

```ts
ws://bcsvr_host:bcsvr_port

bcsvr_key=960df3:xzRiR62X

SUB	960df3:xzRiR62X
MSG	960f35:OXzh18yn	{"ua":3,"av":1022305,"d":0,"ac":"【初見】【ビギナー】【マイナー】こにたん","cm":"芸人","created_at":1591279316,"u":2262593,"at":0,"t":"1"}
MSG	960df3:xzRiR62X	{"ua":3,"n":1,"av":2,"d":0,"ac":"すずな犬フェス✟ ????✟","created_at":1591278359,"u":3054201,"h":0,"g":1003,"gt":2,"at":0,"t":"2"}
PING	showroom
ACK	showroom
MSG	960f35:OXzh18yn	{"created_at":1591279455,"c":0,"p":197937,"t":5}
MSG	9611c8:mlD1x21z	{"created_at":1591280111,"u":2103907,"at":6,"t":6} // stream end
MSG	960f35:OXzh18yn	{"telops":[{"color":{"r":255,"b":255,"g":255},"text":"まいにち配信100日記念⸜(*ˊᗜˋ*)⸝","type":"user"}],"telop":"まいにち配信100日記念⸜(*ˊᗜˋ*)⸝","interval":6000,"t":8,"api":"https://www.showroom-live.com/live/telop?live_id=9834293"}
MSG	9615a7:VFG7C5rN	{"created_at":1591284787,"n":1,"at":20,"ai":3,"s":10,"t":17}
MSG	9610d9:BoLUSMyY	{"created_at":1591282803,"n":0,"a":0,"t":101} // quit
QUIT
```

```ts
connecting char is not space, but \t or String.fromCodePoint(9)
SUB	${bcsvr_key}
MSG	${bcsvr_key}	<JSON>
PING	showroom // every 60s despite of msg
ACK	showroom
```

```ts
type Message = (
  | Comment
)

interface Common {
  u: number // user id
  av: number // avatar id
}

interface Comment extends Common {
  t: '1'
  cm: string // comment
}

interface Gift extends Common {
  t: '2'
  g: number // gift id
  n: number // gift quantity
}

interface VotingStart extends Common {
  t: '3'
}

{
  t: "1" // comment type flag
  ac: "Hoshi☆彡" // account / nickname
  at: 0
  av: 1003519
  cm: ":たのしかったー！" // comment
  created_at: 1591278343
  d: 0
  u: 1152674
  ua: 3
}
{
  t: "2" // gift type flag
  ac: "すずな犬フェス✟ ????✟" // account / nickname
  at: 0
  av: 2
  created_at: 1591278359 // timestamp in second
  d: 0
  g: 1003
  gt: 2
  h: 0
  n: 1telop, or gift
  u: 3054201 // user id
  ua: 3
}
{
  t: 8,
  telops: [
    {
      color: {
        r: 255,
        b: 255,
        g: 255
      },
      text: 'まいにち配信100日記念⸜(*ˊᗜˋ*)⸝',
      type: 'user'
    }
  ],
  telop: 'まいにち配信100日記念⸜(*ˊᗜˋ*)⸝',
  interval: 6000,
  api: 'https://www.showroom-live.com/live/telop?live_id=9834293'
}
````
