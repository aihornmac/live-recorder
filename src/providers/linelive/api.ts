import { get } from '../../utils/request'

export async function getPlayerStatus(channelId: number, broadcastId: number) {
  const url = `https://live-api.line-apps.com/app/v3.2/channel/${channelId}/broadcast/${broadcastId}/player_status`
  const res = await get<{
    freeLoveCount: number
    premiumLoveCount: number
    limitedLoveCount: number
    ownedLimitedLoveCount: number
    sentLimitedLoveCount: number
    liveHLSURLs: { [key: string]: null | string }
    archivedHLSURLs: { [key: string]: null | string }
    liveStatus: 'LIVE' | 'FINISHED'
    face2face: null
    apistatusCode: number
    chat: {
      url: string | null
      archiveURL: string | null
      ownerMessageURL: string
    }
    isFollowing: null
    isOAFollowRequired: boolean
    isChannelBlocked: boolean
    isCollaborating: boolean
    isCollaboratable: boolean
    canRequestCollaboration: boolean
    paidLive: null
    subscriptionLive: null
    status: number
  }>(url, {
    headers: getHeaders(),
  })
  return res.data
}

function getHeaders() {
  return {
    Pragma: 'no-cache',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.106 Safari/537.36',
  }
}
