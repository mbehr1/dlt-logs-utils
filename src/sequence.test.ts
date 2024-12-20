import { expect } from 'chai'
import {
  DltFilter,
  FbEvent,
  FbSeqOccurrence,
  FBSequence,
  FbSequenceResult,
  FilterableDltMsg,
  getCaptures,
  SeqChecker,
  seqResultToMdAst,
  ViewableDltMsg,
} from './sequence'

describe('FbEvent', () => {
  it('contains evType', () => {
    const ev: FbEvent = {
      evType: 'foo',
      title: 'bar',
      timeStamp: 0,
    }
    expect(ev).to.have.property('evType')

    // and FbSeqOccurrence does not include evType
    const so: FbSeqOccurrence = new FbSeqOccurrence(0, ev, 'ok', [], [], [])
    expect(so).to.not.have.property('evType')
    expect(so).to.be.instanceOf(FbSeqOccurrence)
  })
})

describe('SeqChecker', () => {
  // a few filter:
  const f1 = new DltFilter({ type: 3, apid: '1' })
  const f2 = new DltFilter({ type: 3, apid: '2' })
  const f3 = new DltFilter({ type: 3, apid: '3' })
  const f4 = new DltFilter({ type: 3, apid: '4' })

  // a few steps:
  const s1 = { filter: f1 }
  const s2 = { filter: f2 }
  const s3 = { filter: f3 }
  const s4 = { filter: f4 }

  // optional steps:
  const o3_0_1 = { filter: f3, card: '?' }
  const o3_1_m = { filter: f3, card: '+' }
  const o3_0_m = { filter: f3, card: '*' }

  // a few msgs:
  const m1 = { apid: '1' } as ViewableDltMsg
  const m2 = { apid: '2' } as ViewableDltMsg
  const m3 = { apid: '3' } as ViewableDltMsg
  const m4 = { apid: '4' } as ViewableDltMsg

  const newFbSeqResult = (seq: FBSequence): FbSequenceResult => {
    return {
      sequence: seq,
      occurrences: [],
      logs: [],
    }
  }

  const processMsgs = (seq: FBSequence, msgs: ViewableDltMsg[]): FbSequenceResult => {
    const seqResult = newFbSeqResult(seq)
    const seqChecker = new SeqChecker(seq, seqResult, DltFilter)
    seqChecker.processMsgs(
      msgs.map((m, idx) => {
        return { ...m, index: idx + 1 }
      }),
    )
    return seqResult
  }

  beforeEach(() => {})

  it('should initialize correctly', () => {
    const jsonSeq: FBSequence = {
      name: 'seq1',
      steps: [],
    }
    const seqResult = newFbSeqResult(jsonSeq)
    const seqChecker = new SeqChecker(jsonSeq, seqResult, DltFilter)

    expect(seqChecker.name).to.equal('seq1')
    expect(seqChecker.getAllFilters()).to.be.empty
  })

  it('getAllFilters should include filters from subsequence', () => {
    const jsonSeq: FBSequence = {
      name: 'seq1',
      steps: [s1, { sequence: { name: 'sub seq 1', steps: [s3, s4] } }, s2],
    }
    const seqResult = newFbSeqResult(jsonSeq)
    const seqChecker = new SeqChecker(jsonSeq, seqResult, DltFilter)

    expect(seqChecker.name).to.equal('seq1')
    expect(seqChecker.getAllFilters()).to.have.length(4)
  })

  it('should detect a simple sequence', () => {
    const jsonSeq: FBSequence = {
      name: 'seq1',
      steps: [s1],
    }
    const msgs = [m1]

    const seqResult = newFbSeqResult(jsonSeq)
    const seqChecker = new SeqChecker(jsonSeq, seqResult, DltFilter)

    expect(seqChecker.getAllFilters()).to.have.lengthOf(1)
    seqChecker.processMsgs(msgs)
    expect(seqResult.occurrences).to.have.lengthOf(1)
    expect(seqResult.occurrences[0].result).to.equal('ok')
  })

  it('should detect two occurrences of a sequence', () => {
    const jsonSeq: FBSequence = {
      name: 'seq1',
      steps: [s1],
    }
    const msgs = [m1, m1]

    const seqResult = processMsgs(jsonSeq, msgs)
    expect(seqResult.occurrences).to.have.lengthOf(2)
    seqResult.occurrences.forEach((occ) => {
      expect(occ.result).to.equal('ok')
    })
  })

  it('should detect a partial sequence and a starting one', () => {
    const jsonSeq: FBSequence = {
      name: 'seq1',
      steps: [s1, s2],
    }
    const msgs = [m2, m1]

    const seqResult = processMsgs(jsonSeq, msgs)
    expect(seqResult.occurrences).to.have.lengthOf(2)
    expect(seqResult.occurrences[0].result).to.equal('error')
    expect(seqResult.occurrences[1].result).to.equal('undefined')
  })

  it('should detect a partial sequence and a complete one', () => {
    const jsonSeq: FBSequence = {
      name: 'seq1',
      steps: [s1, s2],
    }
    const msgs = [m2, m1, m2]

    const seqResult = processMsgs(jsonSeq, msgs)
    expect(seqResult.occurrences).to.have.lengthOf(2)
    expect(seqResult.occurrences[0].result).to.equal('error')
    expect(seqResult.occurrences[1].result).to.equal('ok')
  })

  it('should not detect a start of a partial sequence with steps canCreateNew:false', () => {
    let jsonSeq: FBSequence = {
      name: 'seq1',
      steps: [s1, { canCreateNew: false, ...s2 }],
    }
    let msgs = [m2, m1, m2]

    let seqResult = processMsgs(jsonSeq, msgs)
    expect(seqResult.occurrences).to.have.lengthOf(1)
    expect(seqResult.occurrences[0].result).to.equal('ok')

    jsonSeq = {
      name: 'seq1',
      steps: [s1, { canCreateNew: false, ...s2 }, s3],
    }
    msgs = [m2, m1, m2, m2] // card for s2 exceeded -> no create of new

    seqResult = processMsgs(jsonSeq, msgs)
    expect(seqResult.occurrences).to.have.lengthOf(1)
    expect(seqResult.occurrences[0].result).to.equal('error')
  })

  it('should throw on sequences starting with !canCreateNew step', () => {
    const jsonSeq: FBSequence = {
      name: 'seq1',
      steps: [{ canCreateNew: false, ...s1 }, s2],
    }
    const msgs = [m1, m2]

    expect(() => processMsgs(jsonSeq, msgs)).to.throw()
  })

  it('should detect a sequence with repeating filter', () => {
    let jsonSeq: FBSequence = {
      name: 'seq1',
      steps: [s1, s1],
    }
    let msgs = [m1, m1]

    let seqResult = processMsgs(jsonSeq, msgs)
    //console.log(`seqResult: ${JSON.stringify(seqResult, null, 2)}`)
    expect(seqResult.occurrences).to.have.lengthOf(1)
    expect(seqResult.occurrences[0].result).to.equal('ok')

    jsonSeq = {
      name: 'seq1',
      steps: [o3_0_m, s1, s3], // m*m <- we cannot but m*nm
    }
    msgs = [m3, m1, m3] // [m3, m3, m1, m3]

    seqResult = processMsgs(jsonSeq, msgs)
    //console.log(`seqResult: ${JSON.stringify(seqResult, null, 2)}`)
    expect(seqResult.occurrences).to.have.lengthOf(1)
    expect(seqResult.occurrences[0].result).to.equal('ok')

    jsonSeq = {
      name: 'seq1',
      steps: [o3_0_m, s1, s3], //m*nm
    }
    msgs = [m3, m3, m1, m3]

    seqResult = processMsgs(jsonSeq, msgs)
    //console.log(`seqResult: ${JSON.stringify(seqResult, null, 2)}`)
    expect(seqResult.occurrences).to.have.lengthOf(1)
    expect(seqResult.occurrences[0].result).to.equal('ok')

    jsonSeq = {
      name: 'seq1',
      steps: [o3_0_m, s1, s2], //m*ns
    }
    msgs = [m3, m1, m3, m2] // invalid! as 2nd m3 is out of sequence -> should be two occurrences m3,m1 and m3,m2 (both errors)

    seqResult = processMsgs(jsonSeq, msgs)
    //console.log(`seqResult: ${JSON.stringify(seqResult, null, 2)}`)
    expect(seqResult.occurrences).to.have.lengthOf(2)
    expect(seqResult.occurrences[0].result).to.equal('error')

    // sub-sequences with optional steps
    jsonSeq = {
      name: 'seq1',
      steps: [{ sequence: { name: 'sub seq 1', steps: [s1, s1] } }, { sequence: { name: 'sub seq 1.2', steps: [s1, s1] } }], // mm
    }
    msgs = [m1, m1, m1, m1]
    seqResult = processMsgs(jsonSeq, msgs)
    console.log(`seqResult: ${JSON.stringify(seqResult, null, 2)}`)
    expect(seqResult.occurrences).to.have.lengthOf(1)
    expect(seqResult.occurrences[0].result).to.equal('ok')
  })

  it('should handle sequences starting with an optional step', () => {
    const jsonSeq: FBSequence = {
      name: 'seq1',
      steps: [o3_0_1, s2, o3_0_1],
    }
    const msgs = [m3, m2, m2]

    const seqResult = processMsgs(jsonSeq, msgs)
    //console.log(`seqResult: ${JSON.stringify(seqResult, null, 2)}`)
    expect(seqResult.occurrences).to.have.lengthOf(2)
    expect(seqResult.occurrences[0].result).to.equal('ok')
    expect(seqResult.occurrences[1].result).to.equal('ok')
  })

  it('should detect a sequence with optional steps', () => {
    let jsonSeq: FBSequence = {
      name: 'seq1',
      steps: [s1, o3_0_1, s2],
    }
    let msgs = [m1, m2]

    let seqResult = processMsgs(jsonSeq, msgs)
    expect(seqResult.occurrences).to.have.lengthOf(1)
    expect(seqResult.occurrences[0].result).to.equal('ok')

    msgs = [m1, m3, m2]

    seqResult = processMsgs(jsonSeq, msgs)
    expect(seqResult.occurrences).to.have.lengthOf(1)
    expect(seqResult.occurrences[0].result).to.equal('ok')

    // not valid, should be detected as two sequences: m1,m3 and m3,m2
    // TODO or shall we detect it as a single sequence with an error?
    msgs = [m1, m3, m3, m2]

    seqResult = processMsgs(jsonSeq, msgs)
    expect(seqResult.occurrences).to.have.lengthOf(2)
    expect(seqResult.occurrences[0].result).to.equal('error')
    expect(seqResult.occurrences[1].result).to.equal('error')

    jsonSeq = {
      name: 'seq1',
      steps: [s1, o3_0_m, s2],
    }
    msgs = [m1, m2]

    seqResult = processMsgs(jsonSeq, msgs)
    expect(seqResult.occurrences).to.have.lengthOf(1)
    expect(seqResult.occurrences[0].result).to.equal('ok')

    msgs = [m1, m3, m3, m3, m2]

    seqResult = processMsgs(jsonSeq, msgs)
    expect(seqResult.occurrences).to.have.lengthOf(1)
    expect(seqResult.occurrences[0].result).to.equal('ok')

    jsonSeq = {
      name: 'seq1',
      steps: [s1, o3_1_m, s2],
    }
    msgs = [m1, m2]

    seqResult = processMsgs(jsonSeq, msgs)
    expect(seqResult.occurrences).to.have.lengthOf(1)
    expect(seqResult.occurrences[0].result).to.equal('error')

    msgs = [m1, m3, m2]
    seqResult = processMsgs(jsonSeq, msgs)
    expect(seqResult.occurrences).to.have.lengthOf(1)
    expect(seqResult.occurrences[0].result).to.equal('ok')

    msgs = [m1, m3, m3, m2]
    seqResult = processMsgs(jsonSeq, msgs)
    expect(seqResult.occurrences).to.have.lengthOf(1)
    expect(seqResult.occurrences[0].result).to.equal('ok')
  })

  it('should support sub-sequences', () => {
    let jsonSeq: FBSequence = {
      name: 'seq1',
      steps: [s1, { sequence: { name: 'sub seq 1', steps: [s3, s4] } }, s2],
    }
    let msgs = [m1, m3, m4, m2]
    let seqResult = processMsgs(jsonSeq, msgs)
    //console.log(`seqResult: ${JSON.stringify(seqResult, null, 2)}`)
    expect(seqResult.occurrences).to.have.lengthOf(1)
    expect(seqResult.occurrences[0].result).to.equal('ok')

    jsonSeq = {
      name: 'seq1',
      steps: [{ sequence: { name: 'sub seq 1', steps: [s3, s4] } }],
    }
    msgs = [m3, m4]
    seqResult = processMsgs(jsonSeq, msgs)
    //console.log(`seqResult: ${JSON.stringify(seqResult, null, 2)}`)
    expect(seqResult.occurrences).to.have.lengthOf(1)
    expect(seqResult.occurrences[0].result).to.equal('ok')
  })

  it('should support sequence starting with a sub-sequences', () => {
    const jsonSeq: FBSequence = {
      name: 'seq1',
      steps: [{ sequence: { name: 'sub seq 1', steps: [s3, s4] } }, s2],
    }
    const msgs = [m1, m3, m4, m2]
    const seqResult = processMsgs(jsonSeq, msgs)
    //console.log(`seqResult: ${JSON.stringify(seqResult, null, 2)}`)
    expect(seqResult.occurrences).to.have.lengthOf(1)
    expect(seqResult.occurrences[0].result).to.equal('ok')
    // seqResult can be converted to mdAst:
    const md = seqResultToMdAst(seqResult)
    expect(md.length).to.be.greaterThan(0)
    //console.log(`mdAst: ${JSON.stringify(md, null, 2)}`)
  })

  it('should support sub-sequences with canCreateNew:false', () => {
    let jsonSeq: FBSequence = {
      name: 'seq1',
      steps: [{ sequence: { name: 'sub seq 1', steps: [{ canCreateNew: false, ...s3 }, s4] } }, s2],
    }
    const msgs = [m1, m4, m1, m3, m4, m2]
    expect(() => processMsgs(jsonSeq, msgs)).to.throw()

    jsonSeq = {
      name: 'seq1',
      steps: [
        {
          sequence: {
            name: 'sub seq 1',
            steps: [
              { canCreateNew: true, ...s3 },
              { canCreateNew: false, ...s4 },
            ],
          },
        },
        s2,
      ],
    }
    const seqResult = processMsgs(jsonSeq, msgs)
    expect(seqResult.occurrences).to.have.lengthOf(1)
    expect(seqResult.occurrences[0].result).to.equal('ok')
  })

  it('should support sub-sequences with canCreateNew:false triggered by card exceed', () => {
    let jsonSeq: FBSequence = {
      name: 'seq1',
      steps: [{ sequence: { name: 'sub seq 1', steps: [{ canCreateNew: false, ...s3 }, s4] } }, s2],
    }
    const msgs = [m3, m4, m4, m2]
    // the 2nd m4 is ignored as it would trigger a new sub-sequence but that's not allowed
    expect(() => processMsgs(jsonSeq, msgs)).to.throw()

    jsonSeq = {
      name: 'seq1',
      steps: [
        {
          sequence: {
            name: 'sub seq 1',
            steps: [
              { canCreateNew: true, ...s3 },
              { canCreateNew: false, ...s4 },
            ],
          },
        },
        s2,
      ],
    }
    const seqResult = processMsgs(jsonSeq, msgs)
    expect(seqResult.occurrences).to.have.lengthOf(1)
    expect(seqResult.occurrences[0].result).to.equal('ok')
  })


  // todo check sequence with as last step/partial
  // todo check for cardinalities with sub-sequences

  it('should support sub-sequences with card +', () => {
    const jsonSeq: FBSequence = {
      name: 'seq1',
      steps: [s1, { sequence: { name: 'sub seq 1', steps: [s3, s4] }, card: '+' }, s2],
    }
    let msgs = [m1, m3, m4, m3, m4, m2] // twice should be ok
    let seqResult = processMsgs(jsonSeq, msgs)
    //console.log(`seqResult: ${JSON.stringify(seqResult, null, 2)}`)
    expect(seqResult.occurrences).to.have.lengthOf(1)
    expect(seqResult.occurrences[0].result).to.equal('ok')

    msgs = [m1, m2] // none -> should be an error
    seqResult = processMsgs(jsonSeq, msgs)
    //console.log(`seqResult: ${JSON.stringify(seqResult, null, 2)}`)
    expect(seqResult.occurrences).to.have.lengthOf(1)
    expect(seqResult.occurrences[0].result).to.equal('error')
  })

  it('should support sub-sequences with card ?', () => {
    const jsonSeq: FBSequence = {
      name: 'seq1',
      steps: [s1, { sequence: { name: 'sub seq 1', steps: [s3, s4] }, card: '?' }, s2],
    }
    let msgs = [m1, m3, m4, m2]
    let seqResult = processMsgs(jsonSeq, msgs)
    //console.log(`seqResult: ${JSON.stringify(seqResult, null, 2)}`)
    expect(seqResult.occurrences).to.have.lengthOf(1)
    expect(seqResult.occurrences[0].result).to.equal('ok')

    msgs = [m1, m2] // none -> should be ok
    seqResult = processMsgs(jsonSeq, msgs)
    //console.log(`seqResult: ${JSON.stringify(seqResult, null, 2)}`)
    expect(seqResult.occurrences).to.have.lengthOf(1)
    expect(seqResult.occurrences[0].result).to.equal('ok')

    msgs = [m1, m3, m4, m3, m4, m2] // twice should be an error
    seqResult = processMsgs(jsonSeq, msgs)
    //console.log(`seqResult: ${JSON.stringify(seqResult, null, 2)}`)
    expect(seqResult.occurrences).to.have.lengthOf(2) // 2nd m3 errors out first, m4 starts new one, m2 ends it (with error as well)
    expect(seqResult.occurrences[0].result).to.equal('error')
    expect(seqResult.occurrences[1].result).to.equal('error')
  })

  it('should support sub-sequences with card *', () => {
    const jsonSeq: FBSequence = {
      name: 'seq1',
      steps: [s1, { sequence: { name: 'sub seq 1', steps: [s3, s4] }, card: '*' }, s2],
    }
    let msgs = [m1, m3, m4, m3, m4, m2] // twice should be ok
    let seqResult = processMsgs(jsonSeq, msgs)
    //console.log(`seqResult: ${JSON.stringify(seqResult, null, 2)}`)
    expect(seqResult.occurrences).to.have.lengthOf(1)
    expect(seqResult.occurrences[0].result).to.equal('ok')

    msgs = [m1, m2] // none -> should be ok as well
    seqResult = processMsgs(jsonSeq, msgs)
    //console.log(`seqResult: ${JSON.stringify(seqResult, null, 2)}`)
    expect(seqResult.occurrences).to.have.lengthOf(1)
    expect(seqResult.occurrences[0].result).to.equal('ok')
  })

  // todo check for sub-sequences being out of order
})

describe('getCaptures', () => {
  it('should return the capture groups for a regex', () => {
    // const re = /(?<g2>\d+)-(?<$g1>\d+)/
    const re = new RegExp('(?<g2>\\d+)-(?<_g1>\\d+)', 'i')
    const str = '123-456'
    const captures = getCaptures(re, str)
    expect(captures).to.not.be.undefined
    expect(captures).to.include.keys('_g1', 'g2')
    expect(captures).to.not.include.keys('toString')
    expect(captures!['_g1']).to.equal('456')
    expect(captures!.g2).to.equal('123')
    expect(Object.keys(captures!)).to.have.lengthOf(2)
  })
})
