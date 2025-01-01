import { expect } from 'chai'
import {
  DltFilter,
  escapeForMD,
  FbEvent,
  FbSeqOccurrence,
  FBSeqStep,
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

  const testSeq = (steps: FBSeqStep[], msgs: ViewableDltMsg[], expected: string[], logRes?: boolean): FbSequenceResult => {
    const jsonSeq: FBSequence = {
      name: 'testSeq',
      steps,
    }
    const seqResult = processMsgs(jsonSeq, msgs)
    expect(seqResult.occurrences).to.have.lengthOf(
      expected.length,
      `occurrences: ${JSON.stringify(seqResult.occurrences.map((o) => o.result))}`,
    )
    seqResult.occurrences.forEach((occ, idx) => {
      expect(occ.result).to.equal(expected[idx], `occurrence ${idx} != ${expected[idx]}: ${JSON.stringify(occ, undefined, 2)}`)
      expect(occ.stepsResult).to.have.lengthOf(steps.length)
      // check that each stepsResult matches the type of step:
      occ.stepsResult.forEach((stepRes, stepIdx) => {
        const step = steps[stepIdx]
        if (stepRes !== undefined && stepRes.length > 0) {
          stepRes.forEach((sr, idx) => {
            expect(sr).to.have.property('stepType')
            if ('filter' in step) {
              expect(sr.stepType).to.equal('filter')
            } else if ('sequence' in step) {
              if (sr.stepType === 'filter' && sr.res.summary === 'error') {
                expect(sr.res.title).to.include('mandatory step') // missing
              } else {
                expect(sr.stepType).to.equal('sequence', `sr#${idx} ${JSON.stringify(sr, null, 2)}`)
              }
            } else if ('alt' in step) {
              expect(sr.stepType).to.be.oneOf(['sequence', 'filter'])
              // see TODO in sequence.ts SeqStepAlt.processMsg
              //expect(sr.stepType).to.equal('alt', `sr#${idx} ${JSON.stringify(sr, null, 2)}`)
            } else if ('par' in step) {
              if (sr.stepType === 'filter' && sr.res.summary === 'error') {
                expect(sr.res.title).to.include('mandatory step') // missing
              } else {
                expect(sr.stepType).to.equal('par', `sr#${idx} ${JSON.stringify(sr, null, 2)}`)
              }
            }
          })
        }
      })
    })
    // we can convert the result to mdAst (at least without error)
    if (logRes) {
      console.log(`seqResult: ${JSON.stringify(seqResult, null, 2)}`)
    }
    const md = seqResultToMdAst(seqResult)
    if (logRes) {
      console.log(`mdAst: ${JSON.stringify(md, null, 2)}`)
    }
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
    testSeq([s1], [m1, m1], ['ok', 'ok'])
  })

  it('should detect a partial sequence and a starting one', () => {
    testSeq([s1, s2], [m2, m1], ['error', 'undefined'])
  })

  it('should detect a partial sequence and a complete one', () => {
    testSeq([s1, s2], [m2, m1, m2], ['error', 'ok'])
  })

  it('should not detect a start of a partial sequence with steps canCreateNew:false', () => {
    testSeq([s1, { canCreateNew: false, ...s2 }], [m2, m1, m2], ['ok'])

    // card for s2 exceeded -> no create of new
    testSeq([s1, { canCreateNew: false, ...s2 }, s3], [m2, m1, m2, m2], ['error'])
  })

  it('should throw on sequences starting with !canCreateNew step', () => {
    expect(() => testSeq([{ canCreateNew: false, ...s1 }, s2], [m1, m2], [])).to.throw()
  })

  it('should detect a sequence with repeating filter', () => {
    testSeq([s1, s1], [m1, m1], ['ok'])

    testSeq([o3_0_m, s1, s3], [m3, m1, m3], ['ok']) // m*m <- we cannot but m*nm

    testSeq([o3_0_m, s1, s3], [m3, m3, m1, m3], ['ok']) //m*nm

    // invalid! as 2nd m3 is out of sequence -> should be two occurrences m3,m1 and m3,m2 (both errors)
    testSeq([o3_0_m, s1, s2], [m3, m1, m3, m2], ['error', 'error']) //m*ns

    // sub-sequences with optional steps
    testSeq(
      [{ sequence: { name: 'sub seq 1', steps: [s1, s1] } }, { sequence: { name: 'sub seq 1.2', steps: [s1, s1] } }],
      [m1, m1, m1, m1],
      ['ok'],
    ) // mm
  })

  it('should handle sequences starting with an optional step', () => {
    testSeq([o3_0_1, s2, o3_0_1], [m3, m2, m2], ['ok', 'ok'])
  })

  it('should detect a sequence with optional steps', () => {
    let jsonSeq: FBSequence = {
      name: 'seq1',
      steps: [s1, o3_0_1, s2],
    }

    testSeq([s1, o3_0_1, s2], [m1, m2], ['ok'])

    testSeq([s1, o3_0_1, s2], [m1, m3, m2], ['ok'])

    // not valid, should be detected as two sequences: m1,m3 and m3,m2
    // TODO or shall we detect it as a single sequence with an error?
    testSeq([s1, o3_0_1, s2], [m1, m3, m3, m2], ['error', 'error'])

    testSeq([s1, o3_0_m, s2], [m1, m2], ['ok'])

    testSeq([s1, o3_0_m, s2], [m1, m3, m3, m3, m2], ['ok'])

    testSeq([s1, o3_1_m, s2], [m1, m2], ['error'])

    testSeq([s1, o3_1_m, s2], [m1, m3, m2], ['ok'])

    testSeq([s1, o3_1_m, s2], [m1, m3, m3, m2], ['ok'])
  })

  it('should support sub-sequences', () => {
    testSeq([s1, { sequence: { name: 'sub seq 1', steps: [s3, s4] } }, s2], [m1, m3, m4, m2], ['ok'])

    testSeq([{ sequence: { name: 'sub seq 1', steps: [s3, s4] } }], [m3, m4], ['ok'])
  })

  it('should support sequence starting with a sub-sequences', () => {
    const seqResult = testSeq([{ sequence: { name: 'sub seq 1', steps: [s3, s4] } }, s2], [m1, m3, m4, m2], ['ok'])
    // seqResult can be converted to mdAst:
    const md = seqResultToMdAst(seqResult)
    expect(md.length).to.be.greaterThan(0)
    //console.log(`mdAst: ${JSON.stringify(md, null, 2)}`)
  })

  it('should support sub-sequences with canCreateNew:false', () => {
    expect(() => testSeq([{ sequence: { name: 'sub seq 1', steps: [{ canCreateNew: false, ...s3 }, s4] } }, s2], [], [])).to.throw()

    testSeq(
      [
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
      [m1, m4, m1, m3, m4, m2],
      ['ok'],
    )
  })

  it('should support sub-sequences with canCreateNew:false triggered by card exceed', () => {
    // first test that a sub-sequence with canCreateNew:false is not allowed and fails on creation
    expect(() => testSeq([{ sequence: { name: 'sub seq 1', steps: [{ canCreateNew: false, ...s3 }, s4] } }, s2], [], [])).to.throw()

    // the 2nd m4 is ignored as it would trigger a new sub-sequence but that's not allowed
    testSeq(
      [
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
      [m3, m4, m4, m2],
      ['ok'],
    )
  })

  // todo check sequence with as last step/partial
  // todo check for cardinalities with sub-sequences

  it('should support sub-sequences with card +', () => {
    // twice should be ok
    testSeq([s1, { sequence: { name: 'sub seq 1', steps: [s3, s4] }, card: '+' }, s2], [m1, m3, m4, m3, m4, m2], ['ok'])

    // none -> should be an error
    testSeq([s1, { sequence: { name: 'sub seq 1', steps: [s3, s4] }, card: '+' }, s2], [m1, m2], ['error'])
  })

  it('should support sub-sequences with card ?', () => {
    testSeq([s1, { sequence: { name: 'sub seq 1', steps: [s3, s4] }, card: '?' }, s2], [m1, m3, m4, m2], ['ok'])

    // none -> should be ok
    testSeq([s1, { sequence: { name: 'sub seq 1', steps: [s3, s4] }, card: '?' }, s2], [m1, m2], ['ok'])

    // twice should be an error
    // 2nd m3 errors out first, m4 starts new one, m2 ends it (with error as well)
    testSeq([s1, { sequence: { name: 'sub seq 1', steps: [s3, s4] }, card: '?' }, s2], [m1, m3, m4, m3, m4, m2], ['error', 'error'])
  })

  it('should support sub-sequences with card *', () => {
    // twice should be ok
    testSeq([s1, { sequence: { name: 'sub seq 1', steps: [s3, s4] }, card: '*' }, s2], [m1, m3, m4, m3, m4, m2], ['ok']) // none -> should be ok as well

    // none -> should be ok as well
    testSeq([s1, { sequence: { name: 'sub seq 1', steps: [s3, s4] }, card: '*' }, s2], [m1, m2], ['ok'])
  })

  // #region alt(ernative) steps
  it('should support sequences with alt(ernative) steps', () => {
    testSeq([s1, { alt: [s2, s3] }], [m1, m2], ['ok'])
    testSeq([s1, { alt: [s2, s3] }], [m1, m3], ['ok'])
    testSeq([s1, { alt: [s2, s3] }, s2], [m1, m3, m2], ['ok'])
    testSeq([s1, { alt: [s2, s3] }], [m1, m3, m2], ['ok', 'error']) // mand. step 1 missing
    testSeq([s1, { alt: [s2, s3] }, s4, s4], [m1, m4, m2, m3, m4], ['error', 'undefined']) // alt being out of sequence
    testSeq([s1, { canCreateNew: false, alt: [s2, s3] }], [m1, m3, m2], ['ok'])
    testSeq([s1, { canCreateNew: false, alt: [s2, s3] }, s2], [m1, m3, m3, m2], ['error', 'error']) // the 2nd m3 triggers out of card!
    testSeq([s1, { alt: [s2, s3] }], [m1, m3, m1, m2], ['ok', 'ok'])
    testSeq([{ alt: [s2, s3] }], [m3, m2], ['ok', 'ok'])
    // with card:
    testSeq([s1, { card: '*', alt: [s2, s3] }, s4], [m1, m4], ['ok'])
    testSeq([s1, { card: '?', alt: [s2, s3] }, s4], [m1, m4], ['ok'])
    testSeq([s1, { card: '+', alt: [s2, s3] }, s4], [m1, m4], ['error'])
    testSeq([s1, { card: '?', alt: [s2, s3] }, s4], [m1, m2, m4], ['ok'])
    testSeq([s1, { card: '+', alt: [s2, s3] }, s4], [m1, m2, m4], ['ok'])
    testSeq([{ card: '+', alt: [s2, s3] }, s4], [m2, m4], ['ok'])
    testSeq([{ card: '+', alt: [s2, s3] }, s4], [m2, m2, m4], ['ok'])
    testSeq([s1, { card: '+', alt: [s2, s3] }, s4], [m1, m2, m2, m4], ['ok'])
    testSeq([s1, { card: '*', alt: [s2, s3] }, s4], [m1, m2, m2, m4], ['ok'])
    testSeq([s1, { card: '*', alt: [s2, s3] }, s4], [m1, m2, m2, m3, m4], ['ok']) // we do allow mix of alternatives
    // test with sub-sequence
    testSeq([s1, { alt: [{ sequence: { name: 'sub seq 1', steps: [s2, s3] } }, s4] }, s4], [m1, m2, m3, m4], ['ok'])
    testSeq([s1, { alt: [{ sequence: { name: 'sub seq 1', steps: [s2, s3] } }, s4] }, s4], [m1, m4, m4], ['ok'])
    testSeq([{ alt: [{ sequence: { name: 'sub seq 1', steps: [s2, s3] } }, s4] }, s4], [m2, m3, m4], ['ok'])
    testSeq([{ alt: [{ sequence: { name: 'sub seq 1', steps: [s2, s3] } }, s4] }, s4], [m4, m4], ['ok'])
    testSeq([s1, { alt: [{ sequence: { name: 'sub seq 1', steps: [s2, s3] } }, s4] }], [m1, m4], ['ok'])
    testSeq([s1, { alt: [{ sequence: { name: 'sub seq 1', steps: [s2, s3] } }, s4] }], [m1, m2, m3], ['ok'])
  })

  it('should handle alt seq missing parameters', () => {
    // alt step with invalid filter, sequence or alt
    expect(() => testSeq([{ alt: [{ name: 'a' }] }], [], [])).to.throw()

    // empty alt not allowed
    expect(() => testSeq([{ alt: [] }], [], [])).to.throw()
  })

  // #region par(arallel) steps
  it('should handle par seq missing parameters', () => {
    // par step with invalid filter, sequence or alt
    expect(() => testSeq([{ par: [{ name: 'a' }] }], [], [])).to.throw()

    // empty par not allowed
    expect(() => testSeq([{ par: [] }], [], [])).to.throw()
  })

  it('should support sequences with par(allel) steps', () => {
    testSeq([s1, { par: [s2, s3] }], [m1, m2, m3], ['ok'])
    testSeq([s1, { par: [s2, s3] }], [m1, m3, m2], ['ok'])
    testSeq([s1, { par: [s2, s3] }], [m1, m2], ['undefined'])
    testSeq([s1, { par: [s2, s3] }], [m1, m3], ['undefined'])
    testSeq([s1, { par: [s2, s3] }, s2], [m1, m2, m3], ['undefined'])
    testSeq([{ par: [s2, s3] }, s1], [m1, m2, m3], ['error', 'undefined']) // wrong order
    testSeq([{ par: [s2, s3] }, { ...s1, canCreateNew: false }], [m1, m2, m3], ['undefined']) // wrong order
    testSeq([s1, { par: [s2, s3] }, s2], [m1, m2, m3, m2], ['ok'])
    testSeq([{ par: [s2, s3] }], [m3, m2], ['ok'])
    testSeq([{ par: [s2, s3] }, { par: [s2, s3] }], [m2, m3, m3, m2], ['ok'])
    testSeq([{ par: [s2, s3], card: '*' }, s1], [m2, m3, m3, m2, m1], ['ok'])
    testSeq([{ par: [s2, s3], card: '+' }, s1], [m2, m3, m3, m2, m1], ['ok'])
    testSeq([{ par: [s2, s3], card: '+' }, s1], [m1], ['error'])
    testSeq([{ par: [s2, s3], card: '?' }, s1], [m1], ['ok'])
    testSeq([{ par: [s2, s3], card: '?' }, s1], [m2, m3, m1], ['ok'])
    testSeq([{ ...s2, card: '?' }, s1], [m2, m2, m1], ['error', 'ok'])
    testSeq([{ par: [s2, s3], card: '?' }, s1], [m2, m3, m2, m3, m1], ['error', 'ok'])
    testSeq([{ par: [s2, { ...s3, card: '*' }], card: '?' }, s1], [m2, m3, m1], ['ok'])
    testSeq([{ par: [s2, { ...s3, card: '*' }], card: '?' }, s1], [m2, m1], ['ok'])
    testSeq([{ par: [s2, { ...s3, card: '*' }] }, s1], [m3, m3, m2, m1], ['ok'])
    // next ones are tricky due to greedy-ness... (isFinished but could take one more...)
    testSeq([{ ...s2, card: '+' }, s1], [m2, m2, m1], ['ok']) // works for filters but not for par
    testSeq([{ par: [s2, { ...s3, card: '*' }] }, s1], [m3, m2, m3, m1], ['ok'])
    testSeq([{ par: [s2, { ...s3, card: '*' }] }, s1], [m3, m2, m2, m1], ['error', 'ok'])
    testSeq([{ par: [s2, { ...s3, card: '*' }] }, s1], [m3, m3, m2, m1], ['ok'])
    // TODO: think about next one... we prefer non-greedy-ness. but it leads to ok,ok,ok
    testSeq([{ par: [s2, { ...s3, card: '*' }], card: '+' }], [m3, m2, m2, m3, m2], ['ok', 'ok', 'ok'])
    testSeq([{ par: [s2, { ...s3, card: '*' }], card: '+' }, s1], [m3, m2, m2, m3, m2, m1], ['ok'])

    // single par step with canCreateNew:false
    testSeq([{ par: [{ ...s2, canCreateNew: false }, s3] }], [m2, m3], ['undefined'])
    testSeq([{ par: [{ ...s2, canCreateNew: false }, s3] }], [m3, m2], ['ok'])

    // par step with sub-sequence:
    testSeq([{ par: [s1, { sequence: { name: 'sub-seq', steps: [s2] } }] }, s3], [m1, m2, m3], ['ok'])
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

describe('escapeForMD', () => {
  it('should escape markdown special chars', () => {
    const str = 'this is a *test* _string_ with `special` chars \\ * _ {} [] <> () # + - . !| &'
    const escaped = escapeForMD(str)
    expect(escaped).to.equal(
      'this is a \\*test\\* \\_string\\_ with \\`special\\` chars \\\\ \\* \\_ \\{\\} \\[\\] &lt;&gt; \\(\\) \\# \\+ \\- \\. \\!\\| &amp;',
    )
  })
})
