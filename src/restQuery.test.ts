import { expect } from 'chai'

import { rqUriEncode, rqUriDecode, RQ, getAttributeFromFba, substAttributes, substFilterAttributes } from './restQuery'

describe('restQuery', () => {
  describe('rqUriDecode', () => {
    it('should return path only', () => {
      const rq = 'path'
      const decoded = rqUriDecode(rq)
      expect(decoded.path).to.equal('path')
      expect(decoded.commands).to.be.empty
    })
    it('should return path and single command', () => {
      const rq = 'path?cmd1=param1'
      const decoded = rqUriDecode(rq)
      expect(decoded.path).to.equal('path?')
      expect(decoded.commands.length).to.equal(1)
      expect(decoded.commands[0].cmd).to.equal('cmd1')
      expect(decoded.commands[0].param).to.equal('param1')
    })
    it('should return path and multiple commands', () => {
      const rq = 'path?cmd1=param1&cmd2=param2'
      const decoded = rqUriDecode(rq)
      expect(decoded.path).to.equal('path?')
      expect(decoded.commands.length).to.equal(2)
      expect(decoded.commands[0].cmd).to.equal('cmd1')
      expect(decoded.commands[0].param).to.equal('param1')
      expect(decoded.commands[1].cmd).to.equal('cmd2')
      expect(decoded.commands[1].param).to.equal('param2')
    })
    it('should return path and multiple commands with special chars', () => {
      const rq = 'path?cmd1=param1%20%7C%20param2&cmd2=param2'
      const decoded = rqUriDecode(rq)
      expect(decoded.path).to.equal('path?')
      expect(decoded.commands.length).to.equal(2)
      expect(decoded.commands[0].cmd).to.equal('cmd1')
      expect(decoded.commands[0].param).to.equal('param1 | param2')
      expect(decoded.commands[1].cmd).to.equal('cmd2')
      expect(decoded.commands[1].param).to.equal('param2')
    })

    it('should return empty RQ if rq is empty', () => {
      const rq = ''
      const decoded = rqUriDecode(rq)
      expect(decoded.path).to.equal('')
      expect(decoded.commands).to.be.empty
    })
    it('should return empty RQ if rq is undefined', () => {
      const rq = undefined
      const decoded = rqUriDecode(rq as unknown as string)
      expect(decoded.path).to.equal('')
      expect(decoded.commands).to.be.empty
    })
  })

  describe('encode and decode', () => {
    it('should encode and decode', () => {
      const rq = 'path?cmd1=param1%20%7C%20param2&cmd2=param2'
      const decoded = rqUriDecode(rq)
      const encoded = rqUriEncode(decoded)
      expect(encoded).to.equal(rq)
    })
    it('should encode and decode numbers and booleans but only as strings!', () => {
      const rq = 'path?cmd1=-1&cmd2=true'
      const decoded = rqUriDecode(rq)
      expect(decoded.commands[0].param).to.equal('-1')
      expect(decoded.commands[1].param).to.equal('true')
      const encoded = rqUriEncode(decoded)
      expect(encoded).to.equal(rq)
    })
    it('should encode and decode special chars', () => {
      const rq: RQ = {
        path: 'apath?',
        commands: [
          { cmd: 'cmd1', param: '&cmd3=true&foo' },
          { cmd: 'cmd2', param: '%7C%20?&?&' },
        ],
      }
      const encoded = rqUriEncode(rq)
      const decoded = rqUriDecode(encoded)
      expect(decoded).to.deep.equal(rq)
    })
  })

  describe('getAttribute', () => {
    it('should work with non member attributes', () => {
      // handle wrong parameter
      expect(getAttributeFromFba(undefined as unknown as any[], 'foo')).to.equal(undefined)
      expect(getAttributeFromFba(null as unknown as any[], 'foo')).to.equal(undefined)

      expect(getAttributeFromFba([], 'foo')).to.equal(undefined)

      expect(getAttributeFromFba([], 'foo')).to.equal(undefined)
      expect(getAttributeFromFba([{}], 'foo')).to.equal(undefined)
      expect(getAttributeFromFba([{ foo: 'bar' }], 'foo')).to.equal(undefined)
      // normal attributes string or number
      expect(getAttributeFromFba([{ foo: { value: 'bar' } }], 'foo')).to.equal('bar')
      expect(getAttributeFromFba([{ foo: { value: 42 } }], 'foo')).to.equal(42)
      expect(getAttributeFromFba([{ foo: { value: null } }], 'foo')).to.equal(undefined)
      expect(getAttributeFromFba([{ foo: { value: undefined } }], 'foo')).to.equal(undefined)

      // array attributes string[] or number[]
      expect(getAttributeFromFba([{ foo: { value: ['bar'] } }], 'foo')).to.eql(['bar'])
      expect(getAttributeFromFba([{ foo: { value: ['bar1', 'bar2'] } }], 'foo')).to.eql(['bar1', 'bar2'])
      expect(getAttributeFromFba([{ foo: { value: [42] } }], 'foo')).to.eql([42])
      expect(getAttributeFromFba([{ foo: { value: [1, 2] } }], 'foo')).to.eql([1, 2])
      expect(getAttributeFromFba([{ foo: { value: [] } }], 'foo')).to.eql([])
      // this is accepted as well (even though not fitting to the definition!)
      expect(getAttributeFromFba([{ foo: { value: ['bar', 42] } }], 'foo')).to.eql(['bar', 42])

      // but first member needs to be an number or string
      expect(getAttributeFromFba([{ foo: { value: [null] } }], 'foo')).to.equal(undefined)
      expect(getAttributeFromFba([{ foo: { value: [undefined] } }], 'foo')).to.equal(undefined)
    })

    it('should work with 1 level member attributes', () => {
      // handle wrong parameter
      expect(getAttributeFromFba(undefined as unknown as any[], 'foo.bar')).to.equal(undefined)
      expect(getAttributeFromFba(null as unknown as any[], 'foo.bar')).to.equal(undefined)

      expect(getAttributeFromFba([], 'foo.bar')).to.equal(undefined)

      expect(getAttributeFromFba([], 'foo.bar')).to.equal(undefined)
      expect(getAttributeFromFba([{}], 'foo.bar')).to.equal(undefined)
      expect(getAttributeFromFba([{ foo: 'bar' }], 'foo.bar')).to.equal(undefined)

      // normal attributes string or number
      expect(getAttributeFromFba([{ foo: { value: { bar: 'bar' } } }], 'foo.bar')).to.equal('bar')
      expect(getAttributeFromFba([{ foo: { value: { bar: 42 } } }], 'foo.bar')).to.equal(42)
      expect(getAttributeFromFba([{ foo: { value: null } }], 'foo.bar')).to.equal(undefined)
      expect(getAttributeFromFba([{ foo: { value: undefined } }], 'foo.bar')).to.equal(undefined)
      expect(getAttributeFromFba([{ foo: { value: { baz: null } } }], 'foo.bar')).to.equal(undefined)
      expect(getAttributeFromFba([{ foo: { value: { bar: null } } }], 'foo.bar')).to.equal(undefined)
      expect(getAttributeFromFba([{ foo: { value: { bar: undefined } } }], 'foo.bar')).to.equal(undefined)

      // array attributes string[] or number[]
      expect(getAttributeFromFba([{ foo: { value: [{ bar: 'bar' }] } }], 'foo.bar')).to.eql(['bar'])
      expect(getAttributeFromFba([{ foo: { value: [{ bar: 'bar1' }, { bar: 'bar2' }] } }], 'foo.bar')).to.eql(['bar1', 'bar2'])
      expect(getAttributeFromFba([{ foo: { value: [{ bar: 42 }] } }], 'foo.bar')).to.eql([42])
      expect(getAttributeFromFba([{ foo: { value: [{ bar: 1 }, { bar: 2 }] } }], 'foo.bar')).to.eql([1, 2])
      expect(getAttributeFromFba([{ foo: { value: [] } }], 'foo.bar')).to.eql([])
      // this is accepted as well (even though not fitting to the definition!)
      expect(getAttributeFromFba([{ foo: { value: [{ bar: 'bar' }, { bar: 42 }] } }], 'foo.bar')).to.eql(['bar', 42])

      // but first member needs to be an number or string
      expect(getAttributeFromFba([{ foo: { value: [{ bar: null }] } }], 'foo.bar')).to.equal(undefined)
      expect(getAttributeFromFba([{ foo: { value: [{ bar: undefined }] } }], 'foo.bar')).to.equal(undefined)
    })
  })

  const getAttr = (attr: string) => {
    if (attr === 'foo') {
      return 'bar'
    }
    if (attr === 'array') {
      return ['bar1', 'bar2']
    }
    if (attr === 'obj.id') {
      return [0, 1]
    }
    return undefined
  }

  describe('substAttributes', () => {
    it('should substitute attributes known and unknown', () => {
      const rq: RQ = {
        path: '',
        commands: [
          { cmd: 'query', param: `${JSON.stringify([])}` },
          { cmd: 'report', param: `${JSON.stringify([{ akey: 'akeyval', bar: '${attributes.foo}', obj: { bar: '${attributes.foo}' } }])}` },
          { cmd: 'filter', param: `${JSON.stringify([{ akey: 'akeyval', bar: '${attributes.array}' }])}` },
          { cmd: 'sequence', param: `${JSON.stringify([{ bar: '${attributes.foo}' }])}` },
          { cmd: 'report', param: `${JSON.stringify([{ bar: '${attributes.obj.id}' }])}` },
          { cmd: 'report', param: `${JSON.stringify([{ a: 42, bar: '${attributes.unknown}' }])}` },
        ],
      }

      substAttributes(rq, getAttr, JSON)
      expect(JSON.parse(rq.commands[0].param)).to.eql([])
      expect(JSON.parse(rq.commands[1].param)).to.eql([{ akey: 'akeyval', bar: 'bar', obj: { bar: '${attributes.foo}' } }])
      expect(JSON.parse(rq.commands[2].param)).to.eql([{ akey: 'akeyval', bar: ['bar1', 'bar2'] }])
      // no subst for e.g. sequence
      expect(JSON.parse(rq.commands[3].param)).to.eql([{ bar: '${attributes.foo}' }])

      expect(JSON.parse(rq.commands[4].param)).to.eql([{ bar: [0, 1] }])

      // test for undefined -> removes keys
      expect(JSON.parse(rq.commands[5].param)).to.eql([{ a: 42 }])
    })
  })

  describe('substFilterAttributes', () => {
    it('should substitute attributes known and unknown', () => {
      const filters = [{ akey: 'akeyval', bar: '${attributes.foo}' }]
      expect(substFilterAttributes(filters, getAttr)).to.equal(true)
      expect(filters).to.eql([{ akey: 'akeyval', bar: 'bar' }])

      const filters2 = [{ akey: 'akeyval', bar: '${attributes.unknown}' }]
      expect(substFilterAttributes(filters2, getAttr)).to.equal(true)
      expect(filters2).to.eql([{ akey: 'akeyval' }])

      const filters3 = [{ akey: 'akeyval', bar: 'bar' }]
      expect(substFilterAttributes(filters3, getAttr)).to.equal(false)
      expect(filters3).to.eql([{ akey: 'akeyval', bar: 'bar' }])
    })
  })
})
