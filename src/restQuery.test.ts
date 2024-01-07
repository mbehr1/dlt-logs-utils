import { expect } from 'chai'

import { rqUriEncode, rqUriDecode, RQ } from './restQuery'

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
})
