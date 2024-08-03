import { expect } from 'chai'

import { TLStateColorMap3S, tlAll, TLAll, tlGetOrCreate, TLStRegExpNamedGroup, TLState, Params, TLStRegExpIdxGroup } from './tlAll'

function containsTlKey(obj: any): boolean {
  return Object.keys(obj).some((key) => key.startsWith('TL_'))
}

const mapFn = (v: string) => (Number(v) > 12.8 ? 'ok' : 'error')

describe('tlGetOrCreate', () => {
  describe('manages map', () => {
    it('should return a new map if where._tlMap is not defined', () => {
      const where: any = {}
      const group = 'group1'
      const lane = 'lane1'
      const createFn = () => {}
      const tl = tlGetOrCreate(where, group, lane, createFn)
      expect(where._tlMap).to.be.instanceOf(Map)
      expect(where._tlMap).to.contain.keys('group1_lane1')
    })
    it('should return the existing map if where._tlMap is defined', () => {
      const where: any = { _tlMap: new Map([['group1_lane1', 42]]) }
      const group = 'group1'
      const lane = 'lane1'
      const createFn = () => 41
      const tl = tlGetOrCreate(where, group, lane, createFn)
      expect(tl).to.equal(42)
      expect(where._tlMap).to.be.instanceOf(Map)
      expect(where._tlMap).to.contain.keys('group1_lane1')

      const tl41 = tlGetOrCreate(where, group, 'lane2', createFn)
      expect(tl41).to.equal(41)
      expect(where._tlMap).to.contain.keys('group1_lane2')
    })
  })
})

describe('tlAll', () => {
  const params: Params = {
    reportObj: {},
    localObj: {},
    msg: { timeStamp: 0, ecu: '', apid: '', ctid: '', payloadString: '', lifecycle: 0 },
  }
  const values = [new TLStRegExpNamedGroup('s1', mapFn), new TLStRegExpNamedGroup('s2', mapFn)]
  before(() => {
    expect(params.reportObj).to.be.deep.equal({})
  })

  it('should create a TLAll object on first call', () => {
    const matches = /foo/.exec('foo')
    expect(matches).to.be.not.null
    const tl = tlAll(
      matches!,
      params,
      'group1',
      'lane1',
      () => values,
      () => TLStateColorMap3S,
    )
    expect(containsTlKey(tl)).to.be.true
    const [val, tooltip, color] = (tl['TL_group1_lane1'] as string).split('|')
    expect(val).to.be.equal('unknown')
    expect(color).to.be.equal('gray')
  })

  it('should not return a TLAll object on non first call if no matches', () => {
    const matches = /foo/.exec('foo')
    expect(matches).to.be.not.null
    const tl = tlAll(
      matches!,
      params,
      'group1',
      'lane1',
      () => [],
      () => new Map(),
    )
    expect(tl).to.be.deep.equal({})
  })

  it('should not return a TLAll object on non first call if no matches expect if new lifecycle', () => {
    const matches = /foo/.exec('foo')
    expect(matches).to.be.not.null
    expect(params.reportObj._tlMap.get('group1_lane1').persistLcs).to.be.false
    const tl = tlAll(
      matches!,
      { ...params, msg: { ...params.msg, lifecycle: 1 } },
      'group1',
      'lane1',
      () => [],
      () => new Map(),
    )
    expect(containsTlKey(tl)).to.be.true
  })

  it('should return a TLAll object on non first call if matches', () => {
    const matches = /(?<s2>.*)/.exec('12.9')
    expect(matches).to.be.not.null
    const tl = tlAll(
      matches!,
      params,
      'group1',
      'lane1',
      () => [],
      () => new Map(),
    )
    expect(containsTlKey(tl)).to.be.true
    const [val, tooltip, color] = (tl['TL_group1_lane1'] as string).split('|')
    expect(val).to.be.equal('unknown')
    expect(color).to.be.equal('gray')
  })

  it('should not modify prev. results', () => {
    const matches = /(?<s2>.*)/.exec('12.7')
    expect(matches).to.be.not.null
    const tl1 = tlAll(
      matches!,
      params,
      'group1',
      'lane1',
      () => [],
      () => new Map(),
    )
    expect(typeof tl1['TL_group1_lane1']).to.be.equal('string')

    const matches2 = /(?<s2>.*)/.exec('12.9')
    const tl2 = tlAll(
      matches2!,
      params,
      'group1',
      'lane1',
      () => [],
      () => TLStateColorMap3S,
    )
    expect(typeof tl2['TL_group1_lane1']).to.be.equal('string')
    expect(tl1).to.not.equal(tl2)
  })

  it('should have a valid html as tooltip without |', () => {
    const matches = /foo/.exec('foo')
    expect(matches).to.be.not.null
    const tl = tlAll(
      matches!,
      params,
      'group1',
      'lane2',
      () => [new TLStRegExpNamedGroup('<div|foo>', mapFn), new TLStRegExpNamedGroup('&<"bar', mapFn, 'tooltip for ..bar')],
      () => TLStateColorMap3S,
    )
    expect(containsTlKey(tl)).to.be.true
    const val = tl['TL_group1_lane2']
    const tooltip = (val as string).split('|')[1]
    expect(tooltip).not.to.be.empty
    // todo html dom compare?
    expect(tooltip).to.match(/^\<ul class="tl tt">.*<\/ul>$/)
  })

  after(() => {
    expect(params.reportObj).not.to.be.deep.equal({})
  })
})

describe('TLAll', () => {
  describe('constructor', () => {
    it('should create a TLAll object with the correct properties', () => {
      const tl = new TLAll('group1', 'lane1', [], TLStateColorMap3S, { persistLcs: true })
      expect(tl.values).to.deep.equal([])
      expect(tl.stateToIdxColorMap).to.have.all.keys(['error', 'warning', undefined, 'ok'])
      expect(tl.group).to.equal('group1')
      expect(tl.lane).to.equal('lane1')
      expect(tl.tlEnds).to.equal(false)
      expect(tl.persistLcs).to.equal(true)
      expect(tl['TL_group1_lane1']).to.include('ok') // default for no values -> last state color map entry
    })
  })
})

describe('TLStRegExpIdxGroup', () => {
  const mapFn = (v: string) => (Number(v) > 12.8 ? 'ok' : 'error')

  it('should initialize correctly', () => {
    const tlStRegExpIdxGroup = new TLStRegExpIdxGroup(1, 'test', mapFn, 'tooltip', 'initial')
    expect(tlStRegExpIdxGroup.n).to.equal('test')
    expect(tlStRegExpIdxGroup.t).to.equal('tooltip')
    expect(tlStRegExpIdxGroup.v).to.equal('initial')
  })

  it('should update value correctly when match is found', () => {
    const tlStRegExpIdxGroup = new TLStRegExpIdxGroup(1, 'test', mapFn)
    const matches = /(\d+\.\d+)/.exec('Value: 13.5')
    const params = { reportObj: {}, localObj: {}, msg: { timeStamp: 0, ecu: '', apid: '', ctid: '', payloadString: '', lifecycle: 0 } }
    const updated = tlStRegExpIdxGroup.update(matches!, params)
    expect(updated).to.be.true
    expect(tlStRegExpIdxGroup.v).to.equal('ok')
  })

  it('should not update value when match is not found', () => {
    const tlStRegExpIdxGroup = new TLStRegExpIdxGroup(1, 'test', mapFn, undefined, 'initial')
    const matches = /(\d+\.\d+)/.exec('Value: abc')
    const params = { reportObj: {}, localObj: {}, msg: { timeStamp: 0, ecu: '', apid: '', ctid: '', payloadString: '', lifecycle: 0 } }
    const updated = tlStRegExpIdxGroup.update(matches!, params)
    expect(updated).to.be.false
    expect(tlStRegExpIdxGroup.v).to.equal('initial')
  })

  it('should not update value when new value is the same as the old value', () => {
    const tlStRegExpIdxGroup = new TLStRegExpIdxGroup(1, 'test', mapFn, 'tooltip', 'ok')
    const matches = /(\d+\.\d+)/.exec('Value: 13.5')
    const params = { reportObj: {}, localObj: {}, msg: { timeStamp: 0, ecu: '', apid: '', ctid: '', payloadString: '', lifecycle: 0 } }
    const updated = tlStRegExpIdxGroup.update(matches!, params)
    expect(updated).to.be.false
    expect(tlStRegExpIdxGroup.v).to.equal('ok')
  })
})

describe('TLState', () => {
  const mapFn = (matches: RegExpMatchArray, params: Params) => matches?.[1]

  describe('constructor', () => {
    it('should create a TLState object with the correct properties', () => {
      const tlState = new TLState('state1', mapFn, 'tooltip', 'initialValue')
      expect(tlState.n).to.equal('state1')
      expect(tlState.t).to.equal('tooltip')
      expect(tlState.v).to.equal('initialValue')
      expect(tlState.mf).to.equal(mapFn)
    })
  })

  describe('update', () => {
    it('should update the value based on the map function', () => {
      const tlState = new TLState('state1', mapFn)
      const matches = /(\d+)/.exec('123')
      const params = { reportObj: {}, localObj: {}, msg: { timeStamp: 0, ecu: '', apid: '', ctid: '', payloadString: '', lifecycle: 0 } }
      const updated = tlState.update(matches!, params)
      expect(updated).to.be.true
      expect(tlState.v).to.equal('123')
    })

    it('should return false if matches are null', () => {
      const tlState = new TLState('state1', mapFn)
      const params = { reportObj: {}, localObj: {}, msg: { timeStamp: 0, ecu: '', apid: '', ctid: '', payloadString: '', lifecycle: 0 } }
      const updated = tlState.update(null!, params)
      expect(updated).to.be.false
      expect(tlState.v).to.be.undefined
    })

    it('should return false if update to same value', () => {
      const tlState = new TLState('state1', mapFn)
      const matches = /(\d+)/.exec('123')
      const params = { reportObj: {}, localObj: {}, msg: { timeStamp: 0, ecu: '', apid: '', ctid: '', payloadString: '', lifecycle: 0 } }
      let updated = tlState.update(matches!, params)
      expect(updated).to.be.true
      expect(tlState.v).to.equal('123')
      updated = tlState.update(matches!, params)
      expect(updated).to.be.false
      expect(tlState.v).to.equal('123')
    })

    it('should return false if map function returns undefined', () => {
      const tlState = new TLState('state1', () => undefined)
      const matches = /(\d+)/.exec('123')
      const params = { reportObj: {}, localObj: {}, msg: { timeStamp: 0, ecu: '', apid: '', ctid: '', payloadString: '', lifecycle: 0 } }
      const updated = tlState.update(matches!, params)
      expect(updated).to.be.false
      expect(tlState.v).to.be.undefined
    })
  })
})

describe('TLStRegExpNamedGroup', () => {
  const mapFn = (v: string) => (Number(v) > 12.8 ? 'ok' : 'error')

  it('should initialize correctly', () => {
    const tlState = new TLStRegExpNamedGroup('s1', mapFn, 'tooltip', 'initial')
    expect(tlState.n).to.equal('s1')
    expect(tlState.t).to.equal('tooltip')
    expect(tlState.v).to.equal('initial')
  })

  it('should update value when named group is present', () => {
    const tlState = new TLStRegExpNamedGroup('s1', mapFn)
    const matches = { groups: { s1: '13.0' } } as unknown as RegExpMatchArray
    const params = {} as Params
    const updated = tlState.update(matches, params)
    expect(updated).to.be.true
    expect(tlState.v).to.equal('ok')
  })

  it('should not update value when named group is not present', () => {
    const tlState = new TLStRegExpNamedGroup('s1', mapFn)
    const matches = { groups: { s2: '12.0' } } as unknown as RegExpMatchArray
    const params = {} as Params
    const updated = tlState.update(matches, params)
    expect(updated).to.be.false
    expect(tlState.v).to.be.undefined
  })

  it('should not update value when value does not change', () => {
    const tlState = new TLStRegExpNamedGroup('s1', mapFn, undefined, 'ok')
    const matches = { groups: { s1: '13.0' } } as unknown as RegExpMatchArray
    const params = {} as Params
    const updated = tlState.update(matches, params)
    expect(updated).to.be.false
    expect(tlState.v).to.equal('ok')
  })

  it('should update value when value changes', () => {
    const tlState = new TLStRegExpNamedGroup('s1', mapFn, undefined, 'ok')
    const matches = { groups: { s1: '12.0' } } as unknown as RegExpMatchArray
    const params = {} as Params
    const updated = tlState.update(matches, params)
    expect(updated).to.be.true
    expect(tlState.v).to.equal('error')
  })
})
