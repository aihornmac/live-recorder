import { expect, use } from 'chai'
import * as chaiAsPromised from 'chai-as-promised'

use(chaiAsPromised)

import { useBinaryExponentialBackoffAlgorithm } from '../flow-control'

describe('useBinaryExponentialBackoffAlgorithm', () => {
  it('check duration in sync', async () => {
    const durations: number[] = []

    await expect((async () => {
      await useBinaryExponentialBackoffAlgorithm(duration => {
        durations.push(duration)
        throw new Error('test')
      }, {
        startInterval: 20,
        maxRetry: 6,
      })
    })()).to.be.rejectedWith('test')

    expect(durations).to.deep.equal([
      0, 20, 40, 80, 160, 320, 640
    ])
  }).timeout(700)
})
