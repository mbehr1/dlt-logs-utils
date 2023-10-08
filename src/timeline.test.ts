import { expect } from 'chai'

import { TL } from './timeline'

describe('TL', () => {
  describe('constructor', () => {
    it('should create a TL object with the correct properties', () => {
      const tl = new TL('group1', 'lane1', 'value1', { tooltip: 'tooltip1', color: 'color1', tlEnds: true, persistLcs: true })
      expect(tl.group).to.equal('group1')
      expect(tl.lane).to.equal('lane1')
      expect(tl.value).to.equal('value1')
      expect(tl.tooltip).to.equal('tooltip1')
      expect(tl.color).to.equal('color1')
      expect(tl.tlEnds).to.equal(true)
      expect(tl.persistLcs).to.equal(true)
    })

    it('should create a TL object with default properties', () => {
      const tl = new TL('group1', 'lane1', 'value1')
      expect(tl.group).to.equal('group1')
      expect(tl.lane).to.equal('lane1')
      expect(tl.value).to.equal('value1')
      expect(tl.tooltip).to.be.undefined
      expect(tl.color).to.be.undefined
      expect(tl.tlEnds).to.be.undefined
      expect(tl.persistLcs).to.be.undefined
    })

    it('should remove invalid chars from group name', () => {
      const tl = new TL('||__group|_,:;_//\\', 'lane1', 'value1')
      expect(tl.group).to.equal('group')
    })

    it('should remove invalid chars from group name', () => {
      const tl = new TL('group1', '||__lane|_,:;_//\\', 'value1')
      expect(tl.lane).to.equal('__lane__')
    })


    it('should have only one enumeratable property', () => {
      const tl = new TL('group1', 'lane1', 123)
      expect(Object.keys(tl).length).to.equal(1)
      expect(Object.keys(tl)).to.eql(['TL_group1_lane1'])
      expect(Object.entries(tl)).to.eql([['TL_group1_lane1', 123]])
    })

    it('supports object spread', () => {
      const tl = new TL('group1', 'lane1', 123)
      const tl2 = new TL('group1', 'lane2', 456)
      const tl3 = { ...tl, ...tl2 }
      expect(Object.keys(tl3).length).to.equal(2)
      expect(Object.keys(tl3)).to.eql(['TL_group1_lane1', 'TL_group1_lane2'])
      expect(Object.entries(tl3)).to.eql([
        ['TL_group1_lane1', 123],
        ['TL_group1_lane2', 456],
      ])
      tl2.value = 789
      expect(Object.entries(tl3)).to.eql([
        ['TL_group1_lane1', 123],
        ['TL_group1_lane2', 456], // take care! object spread copies only the enumerable properties (but late eval does see below!)
      ])

      it('reflects value changes', () => {
        const tl = new TL('group1', 'lane1', 123)
        expect(tl.TL_group1_lane1).to.equal(123)
        tl.value = 456
        expect(tl.TL_group1_lane1).to.equal(456)
      })

      it('supports late eval with obj.y', () => {
        const tl = new TL('group1', 'lane1', 123, { lateEval: true })
        expect(tl.TL_group1_lane1).to.eql({ y: 123 })
        tl.value = 456
        expect(tl.TL_group1_lane1).to.eql({ y: 456 })

        // now with object spread tl3
        const tl2 = new TL('group1', 'lane2', 123, { lateEval: false })
        const tl3 = { ...tl, ...tl2 }
        expect(Object.entries(tl3)).to.eql([
          ['TL_group1_lane1', { y: 456 }],
          ['TL_group1_lane2', 123],
        ])
        tl.value = 789
        expect(Object.entries(tl3)).to.eql([
          ['TL_group1_lane1', { y: 789 }], // works as the y function keeps a reference to the orig obj!
          ['TL_group1_lane2', 123],
        ])
      })
    })
  })

  describe('calculateY', () => {
    it('should return the value string with tooltip, color, tlEnds and persistLcs', () => {
      const tl = new TL('group1', 'lane1', 'value1', { tooltip: 'tooltip1', color: 'color1', tlEnds: true, persistLcs: true })
      expect(tl.calculateY()).to.equal('value1|tooltip1|color1|$')
    })

    it('should return the value string with tooltip and color', () => {
      const tl = new TL('group1', 'lane1', 'value1', { tooltip: 'tooltip1', color: 'color1' })
      expect(tl.calculateY()).to.equal('value1|tooltip1|color1')
    })

    it('should return the value string with tooltip', () => {
      const tl = new TL('group1', 'lane1', 'value1', { tooltip: 'tooltip1' })
      expect(tl.calculateY()).to.equal('value1|tooltip1')
    })

    it('should return the value string with color', () => {
      const tl = new TL('group1', 'lane1', 'value1', { color: 'color1' })
      expect(tl.calculateY()).to.equal('value1||color1')
    })

    it('should return the value string with tlEnds', () => {
      const tl = new TL('group1', 'lane1', 'value1', { tlEnds: true })
      expect(tl.calculateY()).to.equal('value1||')
    })

    it('should return the value string with persistLcs', () => {
      const tl = new TL('group1', 'lane1', 'value1', { persistLcs: true })
      expect(tl.calculateY()).to.equal('value1|$')
    })

    it('should return the value string without tooltip, color, tlEnds and persistLcs', () => {
      const tl = new TL('group1', 'lane1', 'value1')
      expect(tl.calculateY()).to.equal('value1')
    })

    it('should return undefined if value is undefined', () => {
      const tl = new TL('group1', 'lane1', undefined)
      expect(tl.calculateY()).to.be.undefined
    })

    it('should return the value if value is a number', () => {
      const tl = new TL('group1', 'lane1', 123)
      expect(tl.calculateY()).to.equal(123)
    })

    it('should return as string if persistLcs if set', () => {
      const tl = new TL('group1', 'lane1', 123)
      tl.persistLcs = true
      expect(tl.TL_group1_lane1).to.equal('123|$')
    })

    it('should return the value string if value is a string', () => {
      const tl = new TL('group1', 'lane1', 'value1')
      expect(tl.calculateY()).to.equal('value1')
    })

    it('should return the value string with spaces instead of |', () => {
      const tl = new TL('group1', 'lane1', 'value1|value2')
      expect(tl.calculateY()).to.equal('value1 value2')
    })

    it('should trim value', () => {
      const tl = new TL('group1', 'lane1', '   foo bar   |  ')
      expect(tl.TL_group1_lane1).to.equal('foo bar')
    })
  })
})
