// TODO use json5??? import { default as JSON5 } from 'json5'

// TODO for SeqChecker:
// [] - add support for parallel steps (so non sequential)
// [] - add support for lifecycles (a step can expect to be in a certain lifecycle)
// [] - add support for steps returning a warning
// [] - add support for context values for reporting
// [] - add support for context values to match a later step (e.g. for identifiers to match the right status/end...)

import { Html, RootContent, TableCell, TableRow } from 'mdast'

export interface RestObject {
  id: string | number
  type: string
  attributes?: object
  // relationsships
  // links
  meta?: object
}

export interface DltLifecycleInfoMinIF {
  ecu: string
  ecuLcNr?: number // the number shown in the tree view
  persistentId: number
  lifecycleStart: Date
  isResume?: boolean // is this a resumed lifecycle?
  lifecycleResume?: Date // resume time if any. use this instead of lifecycleStart then.
  lifecycleEnd: Date
  getTreeNodeLabel(): string
  tooltip: string
  swVersions: string[]
  apidInfos?: Map<string, { apid: string; desc: string; ctids: Map<string, string> }>
  nrMsgs: number
  //logMessages?: DltMsg[],
  //decorationType?: vscode.TextEditorDecorationType,
  //node?: LifecycleNode,
}

export interface FilterableDltMsg {
  timeStamp: number // timestamp_dms [deci=0.1 ms]
  mstp: number
  mtin: number
  //readonly mcnt: number,
  ecu: string
  apid: string
  ctid: string
  verbose: boolean
  payloadString: string
  lifecycle?: DltLifecycleInfoMinIF

  asRestObject(idHint: number): RestObject
}

export interface ViewableDltMsg extends FilterableDltMsg {
  receptionTimeInMs: number
  index: number
  mcnt: number
}

// #region DltFilter
/// TODO refactor DltFilter into own lib...
// this here is a copy from dlt-logs...
export enum DltFilterType {
  POSITIVE,
  NEGATIVE,
  MARKER,
  EVENT,
}
export const MSTP_strs: string[] = ['log', 'app_trace', 'nw_trace', 'control', '', '', '', '']
export const MTIN_LOG_strs: string[] = ['', 'fatal', 'error', 'warn', 'info', 'debug', 'verbose', '', '', '', '', '', '', '', '', '']

export class DltFilter {
  filterName: string | undefined // maps to "name" from config
  type: DltFilterType
  enabled: boolean = true
  atLoadTime: boolean = false // this filter gets used a load/opening the dlt file already (thus can't be deactivated later). Not possible with MARKER.
  beforePositive: boolean = false // for neg. (todo later for marker?): match this before the pos. filters. mainly used for plugins like FileTransfer
  negateMatch: boolean = false // perform a "not"/! on the match result. As pos and neg. Filters are or'd this allows to create e.g. a pos filter that all messages have to match e.g. via NEGATIVE with NOT.

  // what to match for:
  mstp: number | undefined
  ecu: string | undefined
  apid: string | undefined
  ctid: string | undefined
  logLevelMin: number | undefined
  logLevelMax: number | undefined
  verbose: boolean | undefined
  payload: string | undefined
  payloadToUpper: string | undefined // will be set if ignoreCasePayload is used, internal speedup
  payloadRegex: RegExp | undefined
  ignoreCasePayload: boolean = false // for both payload and payloadRegex, default to false
  lifecycles: number[] | undefined // array with persistentIds from lifecycles

  // marker decorations:
  filterColour: string | object | undefined
  decorationId: string | undefined

  // time sync:
  timeSyncId: string | undefined
  timeSyncPrio: number | undefined

  // report options:
  reportOptions: any | undefined

  // configs:
  private _configs: string[] = []

  // the options used to create the object.
  // asConfiguration() modifies this one based on current values
  configOptions: any | undefined

  constructor(options: any, readonly allowEdit = true) {
    // we do need at least the type
    if ('type' in options) {
      this.type = options['type']
    } else {
      throw Error('type missing for DltFilter')
    }
    // we create a deep copy (ignoring functions....) and don't keep reference to the options
    // passed... otherwise changes on a filter in one document reflect the other as well.
    try {
      this.configOptions = JSON.parse(JSON.stringify(options))
    } catch (e) {
      throw Error(`can't JSON parse the options: ${e}`)
    }

    this.reInitFromConfiguration()
  }

  asConfiguration() {
    // to persist new Filters into configuration setting
    // if (this.configOptions === undefined) { this.configOptions = { type: this.type, id: uuidv4() }; }
    const obj = this.configOptions
    obj.type = this.type
    // we don't store/change enabled. As we do use configs for runtime changes.
    // obj.enabled = this.enabled ? undefined : false; // default to true. don't store to make the config small, readable
    obj.name = this.filterName
    obj.atLoadTime = this.atLoadTime ? true : undefined // default to false
    obj.not = this.negateMatch ? true : undefined // default to false
    obj.mstp = this.mstp
    obj.ecu = this.ecu
    obj.apid = this.apid
    obj.ctid = this.ctid
    obj.logLevelMin = this.logLevelMin
    obj.logLevelMax = this.logLevelMax
    obj.verbose = this.verbose
    obj.payload = this.payload
    obj.payloadRegex = this.payloadRegex !== undefined ? this.payloadRegex.source : undefined
    obj.ignoreCasePayload = this.ignoreCasePayload ? true : undefined // default to false
    obj.lifecycles = this.lifecycles
    obj.timeSyncId = this.timeSyncId
    obj.timeSyncPrio = this.timeSyncPrio
    obj.decorationId = this.decorationId
    obj.filterColour = this.filterColour // or remove blue?
    obj.reportOptions = this.reportOptions
    obj.configs = this._configs.length > 0 ? this._configs : undefined // we report it even if property later hides it

    return obj
  }

  /**
   * Re-initializes the internal variables from the configOptions object.
   * Allows to update the filter from outside e.g. via filter.configOptions[key] = ...
   * and then reflect those values as well.
   * Take care: some values can't be changed! (e.g. type)
   */
  reInitFromConfiguration() {
    const options = this.configOptions
    if (!options) {
      return
    }

    this.filterName = 'name' in options ? options.name : undefined

    this.enabled = 'enabled' in options ? options.enabled : true

    this.atLoadTime = 'atLoadTime' in options ? options.atLoadTime : false

    if ('not' in options) {
      this.negateMatch = options.not ? true : false
    } else {
      this.negateMatch = false
    }

    this.mstp = 'mstp' in options ? options.mstp : undefined

    this.ecu = 'ecu' in options ? options.ecu : undefined

    this.apid = 'apid' in options ? options.apid : undefined

    this.ctid = 'ctid' in options ? options.ctid : undefined

    if ('logLevelMin' in options) {
      this.mstp = 0
      this.logLevelMin = options.logLevelMin
    } else {
      this.logLevelMin = undefined
    }

    if ('logLevelMax' in options) {
      this.mstp = 0
      this.logLevelMax = options.logLevelMax
    } else {
      this.logLevelMax = undefined
    }

    this.verbose = 'verbose' in options ? options.verbose : undefined

    this.ignoreCasePayload = 'ignoreCasePayload' in options ? options.ignoreCasePayload === true : false
    this.payload = 'payload' in options ? options.payload : undefined
    if (this.ignoreCasePayload && this.payload !== undefined) {
      this.payloadToUpper = this.payload.toUpperCase()
    } else {
      this.payloadToUpper = undefined
    }

    if ('payloadRegex' in options) {
      this.payload = undefined
      this.payloadToUpper = undefined
      this.payloadRegex = new RegExp(options.payloadRegex, this.ignoreCasePayload ? 'i' : undefined)

      // needs payloadRegex
      if ('timeSyncId' in options && 'timeSyncPrio' in options) {
        this.type = DltFilterType.EVENT
        this.timeSyncId = options.timeSyncId
        this.timeSyncPrio = options.timeSyncPrio
      }
    } else {
      // on update those might have been set prev.
      this.payloadRegex = undefined
      this.timeSyncId = undefined
      this.timeSyncPrio = undefined
    }

    this.lifecycles = 'lifecycles' in options && Array.isArray(options.lifecycles) ? options.lifecycles : undefined

    this.decorationId = undefined
    this.filterColour = undefined
    if (this.type === DltFilterType.MARKER || this.type === DltFilterType.POSITIVE) {
      if ('decorationId' in options) {
        // has preference wrt filterColour
        this.decorationId = options.decorationId
      } else if ('filterColour' in options) {
        this.filterColour = options.filterColour
      } else {
        if (this.type === DltFilterType.MARKER) {
          this.filterColour = 'blue' // default to blue
        }
      }
    }

    this.reportOptions = undefined
    if ('reportOptions' in options) {
      this.reportOptions = options.reportOptions
    }

    this._configs = []
    if ('configs' in options && Array.isArray(options.configs)) {
      this._configs.push(...options.configs)
    }
  }

  matches(msg: FilterableDltMsg): boolean {
    if (!this.enabled) {
      return false // negateMatch doesn't negate this!
    }

    const negated = this.negateMatch

    if (this.mstp !== undefined && msg.mstp !== this.mstp) {
      return negated
    }
    if (this.logLevelMax && msg.mtin > this.logLevelMax) {
      return negated
    } // mstp already checked
    if (this.logLevelMin && msg.mtin < this.logLevelMin) {
      return negated
    } // mstp already checked
    if (this.ecu && msg.ecu !== this.ecu) {
      return negated
    }
    if (this.apid && msg.apid !== this.apid) {
      return negated
    }
    if (this.ctid && msg.ctid !== this.ctid) {
      return negated
    }
    if (this.verbose !== undefined && msg.verbose !== this.verbose) {
      return negated
    }
    if (this.payload) {
      if (!this.ignoreCasePayload) {
        if (!msg.payloadString.includes(this.payload)) {
          return negated
        }
      } else {
        if (!msg.payloadString.toUpperCase().includes(this.payloadToUpper!)) {
          return negated
        }
      }
    }
    if (this.payloadRegex !== undefined && !this.payloadRegex.test(msg.payloadString)) {
      return negated
    }
    if (this.lifecycles !== undefined && this.lifecycles.length > 0) {
      // we treat an empty array as always matching (that's why we skip this check if length<=0)
      // otherwise the msg lifecycle needs to be within the array:
      // msgs without lifecycle are not matched
      const lc = msg.lifecycle
      if (!lc) {
        return negated
      }
      const msgLcPeristentId = lc.persistentId
      let foundLc: boolean = false
      const lcArray = this.lifecycles
      const lcLength = lcArray.length
      for (let i = 0; i < lcLength; ++i) {
        if (msgLcPeristentId === lcArray[i]) {
          foundLc = true
          break
        }
      }
      if (!foundLc) {
        return negated
      }
    }

    // if we reach here all defined criteria match
    return !negated
  }

  get id(): string {
    return this.configOptions.id
  }

  get name(): string {
    let enabled: string = this.enabled ? '' : 'disabled: '
    if (this.filterName) {
      enabled += this.filterName + ' '
    }
    let type: string
    switch (this.type) {
      case DltFilterType.POSITIVE:
        type = '+'
        break
      case DltFilterType.NEGATIVE:
        type = '-'
        break
      case DltFilterType.MARKER:
        type = '*'
        break
      case DltFilterType.EVENT:
        type = '@'
        break
    }
    if (this.atLoadTime) {
      type = '(load time) ' + type
    }
    if (this.negateMatch) {
      type += '!'
    }
    let nameStr: string = ''
    if (this.mstp !== undefined) {
      nameStr += MSTP_strs[this.mstp]
      nameStr += ' '
    }
    if (this.logLevelMin) {
      // we ignore 0 values here
      nameStr += `>=${MTIN_LOG_strs[this.logLevelMin]} `
    }
    if (this.logLevelMax) {
      // we ignore 0 value here
      nameStr += `<=${MTIN_LOG_strs[this.logLevelMax]} `
    }
    if (this.ecu) {
      nameStr += `ECU:${this.ecu} `
    } // we ignore empty strings
    if (this.apid) {
      nameStr += `APID:${this.apid} `
    }
    if (this.ctid) {
      nameStr += `CTID:${this.ctid} `
    }
    if (this.verbose !== undefined) {
      nameStr += this.verbose ? 'VERB ' : 'NON-VERB '
    }
    if (this.payload) {
      nameStr += `payload contains ${this.ignoreCasePayload ? 'ignoring case ' : ''}'${this.payload}' `
    }
    if (this.payloadRegex !== undefined) {
      nameStr += `payload matches ${this.ignoreCasePayload ? 'ignoring case ' : ''}'${this.payloadRegex.source}'`
    }
    if (this.lifecycles !== undefined) {
      nameStr += ` in ${this.lifecycles.length} LCs`
    }
    if (this.timeSyncId !== undefined) {
      nameStr += ` timeSyncId:${this.timeSyncId} prio:${this.timeSyncPrio}`
    }

    return `${enabled}${type}${nameStr}`
  }
}

/**
 * interims type for the json parameter of a filter (e.g. incl. type, enabled,...)
 */
export type Filter = Record<string, any>

// #region FBSequence
/**
 * type for a sequence within a fishbone for rq.cmd === 'sequences' array
 */
export interface FBSequence {
  name: string
  steps: FBSeqStep[]
  failures?: Record<string, Filter>
}

export interface FBSeqStep {
  /**
   * either a filter or sequence is needed!
   */
  filter?: Filter
  sequence?: FBSequence
  /**
   * if not provide name of filter or name of sequence will be used
   */
  name?: string
  /**
   * cardinality as a regex quanitifier: ? | * | + | {n} | {n,} | {n,m}
   */
  card?: string
}

export const nameFromStep = (step: FBSeqStep, defaultName: string): string => {
  if (typeof step !== 'object') {
    return defaultName
  }
  return step.name || (step.filter && step.filter.name) || (step.sequence && step.sequence.name) || defaultName
}

export interface FbEvent {
  evType: string
  title: string
  timeInMs?: number
  timeStamp: number
  lifecycle?: DltLifecycleInfoMinIF
  summary?: string
  msgText?: string
}

/**
 * The result of a step consists either of:
 * - array of FbEvent (for regular steps with filter)
 * - array of FbSeqOccurrence (for steps that are themselves sequences)
 *
 * You can determine the type by check whether the first element contains "evType" or whether it's an object with instanceOf FbSeqOccurrence
 */
type StepResult = FbEvent[] | FbSeqOccurrence[]

export class FbSeqOccurrence {
  constructor(
    public instance: number,
    public startEvent: FbEvent,
    public result: string,
    public failures: string[],
    public stepsResult: StepResult[],
  ) {}

  //instance: number
  //startEvent: FbEvent
  /**
   * overall result for this occurrence (ok, warning, undefined, error)
   */
  //result: string
  //failures: string[]
  //stepsResult: StepResult[] // for each step the results (in event.summary field). as a step can be executed multiple times, we have an array of results
}

// #region FBSequenceResult
export interface FbSequenceResult {
  sequence: FBSequence // to get info like name...
  occurrences: FbSeqOccurrence[]
  logs: string[]
}

export const resAsEmoji = (res: string | undefined): string => {
  switch (res) {
    case 'ok':
      return '✅'
    case 'warning':
      return '⚠️'
    case 'error':
      return '❌'
    default:
      return '❓'
  }
}

const asHtmlTable = (headers: string[], rows: string[]): Html => {
  return {
    type: 'html',
    value: `<table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows
      .map((r) => `<tr>${r}</tr>`)
      .join('')}</tbody></table>`,
  }
}

const asTableRow = (cellTexts: (string | Html)[]): TableRow => {
  return {
    type: 'tableRow',
    children: cellTexts.map((text) => asTableCell(text)),
  }
}

const asTableCell = (text: string | Html): TableCell => {
  return {
    type: 'tableCell',
    children: [
      typeof text === 'string'
        ? { type: 'text', value: text }
        : typeof text === 'object' && text !== null
        ? text
        : { type: 'text', value: JSON.stringify(text) },
    ],
  }
}

const asCollapsable = (summary: string, content: string): Html => {
  return {
    type: 'html',
    value: `<details><summary>${summary}</summary><br>${content}</details>`,
  }
}

// #region seqResultToMdAst
export const seqResultToMdAst = (seqResult: FbSequenceResult): RootContent[] => {
  const resultAsMd: RootContent[] = []
  // summary of all occurrences
  const summary = Array.from(
    seqResult.occurrences
      .reduce(
        (acc, cur) => {
          const curVal = acc.get(cur.result)
          return curVal ? acc.set(cur.result, curVal + 1) : acc.set(cur.result, 1), acc
        },
        new Map<string, number>([
          ['error', 0],
          ['warning', 0],
          ['undefined', 0],
          ['ok', 0],
        ]),
      )
      .entries(),
  )
    .filter((entry) => entry[1] > 0)
    .map((entry) => `${resAsEmoji(entry[0])}: ${entry[1]}`)
    .join(', ')
  resultAsMd.push({
    type: 'paragraph',
    children: [
      { type: 'html', value: `<details>` },
      { type: 'html', value: `<summary>` },
      { type: 'text', value: `Sequence '${seqResult.sequence.name}': ${seqResult.occurrences.length} occurrences (${summary})` },
      { type: 'html', value: `</summary><br>` },
    ],
  })

  const seqOccurrenceAsTableRow = (occ: FbSeqOccurrence): TableRow => {
    const stepsSummary = `${occ.stepsResult
      .map((res: StepResult) => {
        if (res.length === 0) {
          return ''
        }
        if (res[0] instanceof FbSeqOccurrence) {
          return res.map((r) => resAsEmoji(r.result)).join('')
        } else {
          // FbEvent[]
          return res.map((r) => resAsEmoji(r.summary)).join('')
        }
      })
      .join(',')}`

    const stepsAsHtml = (stepsResult: StepResult[], sequence: FBSequence): Html => {
      const stepsSummary = `${stepsResult
        .map((res: StepResult) => {
          if (res.length === 0) {
            return ''
          }
          if (res[0] instanceof FbSeqOccurrence) {
            return res.map((r) => resAsEmoji(r.result)).join('')
          } else {
            // FbEvent[]
            return res.map((r) => resAsEmoji(r.summary)).join('')
          }
        })
        .join(',')}`

      return asCollapsable(
        stepsSummary,
        asHtmlTable(
          ['', '#', 'name', 'result', 'msg'],
          stepsResult
            .map((res, stepIdx) => {
              if (res.length === 0) {
                return `<td>✔️</td><td>${stepIdx + 1}</td><td>${nameFromStep(sequence.steps[stepIdx], '')}</td><td></td><td></td>`
              } else {
                return res.map((r) => {
                  if (r instanceof FbSeqOccurrence) {
                    let msg = `<td>${resAsEmoji(r.result)}</td><td>${stepIdx + 1}</td><td>${nameFromStep(
                      sequence.steps[stepIdx],
                      '',
                    )}</td><td>${r.result}</td><td>${r.startEvent.msgText ? r.startEvent.msgText : ''}`
                    // summary the graphical overview of the steps and in next line the startEvent.msgText
                    msg += `<br>${stepsAsHtml(r.stepsResult, sequence.steps[stepIdx].sequence).value}`
                    if (r.failures.length > 0) {
                      msg += `<br>${r.failures.length} failures:<br>${r.failures.join('<br>')}`
                    }
                    msg += `</td>`
                    return msg
                  } else {
                    return `<td>${resAsEmoji(r.summary)}</td><td>${stepIdx + 1}</td><td>${nameFromStep(
                      sequence.steps[stepIdx],
                      '',
                    )}</td><td>${r.summary}</td><td>${r.msgText ? r.msgText : r.title}</td>`
                  }
                })
              }
            })
            .flat(),
        ).value,
      )
    }
    return asTableRow([
      resAsEmoji(occ.result),
      occ.instance.toString(),
      occ.startEvent.lifecycle !== undefined
        ? typeof occ.startEvent.lifecycle === 'number'
          ? (occ.startEvent.lifecycle as undefined as number).toString()
          : occ.startEvent.lifecycle.persistentId.toString()
        : '', // todo the persistent id is not the one from adlt convert if adlt is started locally and port is used.
      occ.startEvent && occ.startEvent.timeInMs ? new Date(occ.startEvent.timeInMs).toLocaleString('de-DE') : '<notime>',
      typeof occ.result === 'string' ? occ.result : JSON.stringify(occ.result),
      stepsAsHtml(occ.stepsResult, seqResult.sequence),
      /*asCollapsable(
        stepsSummary,
        asHtmlTable(
          ['', '#', 'name', 'result', 'msg'],
          occ.stepsResult
            .map((res, stepIdx) => {
              if (res.length === 0) {
                return `<td>✔️</td><td>${stepIdx + 1}</td><td>${nameFromStep(seqResult.sequence.steps[stepIdx], '')}</td><td></td><td></td>`
              } else {
                return res.map((r) => {
                  if (r instanceof FbSeqOccurrence) {
                    let msg = `<td>${resAsEmoji(r.result)}</td><td>${stepIdx + 1}</td><td>${nameFromStep(
                      seqResult.sequence.steps[stepIdx],
                      '',
                    )}</td><td>${r.result}</td><td>${r.startEvent.msgText ? r.startEvent.msgText : 'todo! r.title?'}`
                    // todo add summary for r.stepsResult (incl. recursive... sequences)
                    // summary the graphical overview of the steps and in next line the startEvent.msgText

                    if (r.failures.length > 0) {
                      msg += `<br>${r.failures.length} failures:<br>${r.failures.join('<br>')}`
                    }
                    msg += `</td>`
                    return msg
                  } else {
                    return `<td>${resAsEmoji(r.summary)}</td><td>${stepIdx + 1}</td><td>${nameFromStep(
                      seqResult.sequence.steps[stepIdx],
                      '',
                    )}</td><td>${r.summary}</td><td>${r.msgText ? r.msgText : r.title}</td>`
                  }
                })
              }
            })
            .flat(),
        ).value,
      ),*/
      occ.failures.length > 0 ? occ.failures.join('\n') : '',
    ])
  }

  const seqOccurrencesAsTableRows: TableRow[] = seqResult.occurrences ? seqResult.occurrences.map(seqOccurrenceAsTableRow) : []
  resultAsMd.push({
    type: 'table',
    align: ['left', 'right', 'right', 'left', 'left', 'left', 'left'],
    children: [
      asTableRow([
        '',
        '#',
        'LC',
        `Time (${
          Intl.DateTimeFormat('de-DE', { timeZoneName: 'longOffset' })
            .formatToParts(
              seqResult.occurrences && seqResult.occurrences.length > 0 && seqResult.occurrences[0].startEvent.timeInMs !== undefined
                ? new Date(seqResult.occurrences[0].startEvent.timeInMs)
                : Date.now(),
            )
            .find((part) => part.type === 'timeZoneName')?.value || 'UTC'
        })`,
        'Result',
        'Steps',
        'Failures',
      ]),
      ...seqOccurrencesAsTableRows,
    ],
  })

  // embedd logs if any:
  if (seqResult.logs.length) {
    resultAsMd.push({
      type: 'paragraph',
      children: [
        { type: 'html', value: `<details>` },
        { type: 'html', value: `<summary>` },
        { type: 'text', value: `Logs: ${seqResult.logs.length}` },
        { type: 'html', value: `</summary><br>` },
      ],
    })
    resultAsMd.push({
      type: 'code',
      value: seqResult.logs.join('\n'),
    })
    resultAsMd.push({
      type: 'paragraph',
      children: [{ type: 'html', value: `</details>` }],
    })
  }

  resultAsMd.push({
    type: 'paragraph',
    children: [{ type: 'html', value: `</details>` }],
  })
  return resultAsMd
}

const filterFromStep = (step: FBSeqStep): Filter[] => {
  if (step.filter && typeof step.filter === 'object') {
    return [{ type: 3, ...step.filter }]
  } else if (step.sequence && typeof step.sequence === 'object') {
    return filterFromSeq(step.sequence)
  }
  return []
}

/**
 *
 * @returns all filters from the sequence incl. the filters from steps and failures
 */
const filterFromSeq = (seq: FBSequence): Filter[] => {
  const filterFromFailures = seq.failures ? Object.entries(seq.failures).map(([_, filter]) => filter) : []
  // todo add non sequential filters as well (so arrays of filters)
  const filtersFromSteps = seq.steps ? seq.steps.map(filterFromStep).flat() : []
  return [...filterFromFailures, ...filtersFromSteps]
}

class SeqOccurrence<DltFilterType extends IDltFilter> {
  // sequence: FBSequence
  // instance: number // 1.. based

  stepsResult: Map<SeqStep<DltFilterType>, FbEvent[] | SeqOccurrence<DltFilterType>[]> // summary field contains the result of the step as "ok", "warning", "error", "undefined"
  failures: string[]
  maxStepNr: number // the max stepNr of the executed steps

  constructor(public instance: number, public startEvent: FbEvent, private steps: SeqStep<DltFilterType>[]) {
    this.stepsResult = new Map()
    this.failures = []
    this.maxStepNr = 0
  }

  /**
   *
   * @returns whether the sequence is finished due to an error or as soon as the last mandatory sequential step is finished
   */
  isFinished(): boolean {
    if (this.failures.length > 0) {
      return true
    }
    const lastMandatoryStep = this.steps.findLast((step) => step.isMandatory())
    if (lastMandatoryStep !== undefined) {
      const lastResult = this.stepsResult.get(lastMandatoryStep)
      return lastResult !== undefined
    }
    // no mandatory step found???
    throw 'no mandatory step found in sequence'
    // return true
  }

  asFbSeqOccurrence(): FbSeqOccurrence {
    return new FbSeqOccurrence(
      this.instance,
      this.startEvent,
      this.result(),
      this.failures,
      this.steps.map((step) => {
        const stepRes = this.stepsResult.get(step)
        if (stepRes === undefined) {
          return step.isMandatory()
            ? [{ evType: 'step', summary: 'error', title: `mandatory step ${step.stepNr} missing`, timeStamp: 0 }]
            : []
        }
        if (stepRes.length > 0 && stepRes[0] instanceof SeqOccurrence) {
          return stepRes.map((r) => r.asFbSeqOccurrence())
        } else {
          return stepRes
        }
      }),
    )
  }

  /**
   *
   * @returns error in case of any failure, warn if one step lead to a warning, undefined if any mandatory step was missing, ok otherwise
   */
  result(): string {
    // if any failure -> error
    // otherwise "max" of all steps. per step:
    // error, warning, undefined, ok
    if (this.failures.length > 0) {
      return 'error'
    }
    const stepResults = this.steps.map((step) => {
      const result = this.stepsResult.get(step)
      if (result === undefined || result.length === 0) {
        return undefined
      }
      return result.reduce((acc, stepRes) => {
        const thisStepRes = stepRes instanceof SeqOccurrence ? stepRes.result() : stepRes.summary
        if (thisStepRes === 'error') {
          return 'error'
        } else if (thisStepRes === 'warning') {
          return 'warning'
        } else {
          return acc
        }
      }, 'ok')
    })

    if (stepResults.includes('error')) {
      return 'error'
    }
    if (stepResults.includes('warning')) {
      return 'warning'
    }

    // any mandatory step missing but a later mandatory step is there? -> error
    // determine last missing mandatory step and compare towards maxStepNr
    const lastMandatoryStep = this.steps.findLast((step, idx) => step.isMandatory() && stepResults[idx] === undefined)
    if (lastMandatoryStep !== undefined && lastMandatoryStep.stepNr < this.maxStepNr) {
      return `error`
    }

    // any mandatory step missing? -> undefined
    const mandStepsUndefined = this.steps.filter((step, idx) => step.isMandatory() && stepResults[idx] === undefined)
    if (mandStepsUndefined.length > 0) {
      return 'undefined'
    }
    // assert(this.isFinished())
    return 'ok'
  }
}

interface IDltFilter {
  matches(msg: FilterableDltMsg): boolean
}

class SeqStep<DltFilterType extends IDltFilter> {
  public filter?: IDltFilter
  public sequence?: Sequence<DltFilterType>

  public minOcc: number = 1
  public maxOcc: number | undefined

  constructor(
    public stepPrefix: string,
    public stepNr: number,
    public jsonStep: FBSeqStep,
    private DltFilterConstructor: new (json: any, allowEdits?: boolean) => DltFilterType,
  ) {
    // todo do checks/preproc and throw errors if needed

    if (typeof jsonStep.filter !== 'object' && typeof jsonStep.sequence !== 'object') {
      throw new Error(`SeqStep#${stepPrefix}${stepNr}: no filter or sequence for step found! JSON=${JSON.stringify(jsonStep)}`)
    }
    if (typeof jsonStep.filter === 'object' && typeof jsonStep.sequence === 'object') {
      throw new Error(
        `SeqStep#${stepPrefix}${stepNr}: both filter or sequence for step found! Should be either filter or sequence. JSON=${JSON.stringify(
          jsonStep,
        )}`,
      )
    }

    // e.g if no filters for this sequence
    if (typeof jsonStep.filter === 'object') {
      this.filter = new DltFilterConstructor({ type: 3, ...jsonStep.filter })
    } else if (typeof jsonStep.sequence === 'object') {
      this.sequence = new Sequence(
        stepPrefix.length > 0 ? `${stepPrefix}${stepNr}.` : `${stepNr}.`,
        jsonStep.sequence,
        DltFilterConstructor,
      )
    }
    switch (jsonStep.card) {
      case '?':
        this.minOcc = 0
        this.maxOcc = 1
        break
      case '*':
        this.minOcc = 0 // todo 0
        break
      case '+':
        this.minOcc = 1
        break
      case undefined:
        this.maxOcc = 1
        break
      // default: TODO PARSE {n} or {min,max} or {min,} or {,max}
    }
  }

  get name(): string {
    return nameFromStep(this.jsonStep, '')
  }

  isMandatory(): boolean {
    return this.minOcc > 0
  }

  eventFromMsg(msg: ViewableDltMsg, result: string): FbEvent {
    return {
      evType: 'step',
      title: `step #${this.stepPrefix}${this.stepNr} matched by msg #${msg.index}`,
      timeInMs: msg.receptionTimeInMs,
      timeStamp: msg.timeStamp,
      lifecycle: msg.lifecycle,
      summary: result,
      msgText: `\#${msg.index} ${msg.timeStamp / 10000}s ${msg.ecu} ${msg.apid} ${msg.ctid} ${msg.payloadString}`,
    }
  }

  /**
   * process a msg
   * If we have no cur sequence occurrence yet we return whether this msg can start a new one
   *
   * @param msg
   * @param curSeqOcc
   * @returns pair of boolean, SeqOccurence: true if the seq was updated and the new sequence occurrence (or the prev one)
   */
  processMsg(
    msg: ViewableDltMsg,
    curSeqOcc: SeqOccurrence<DltFilterType> | undefined,
    seqResult: FbSequenceResult,
    newOccurrence: (msg: ViewableDltMsg, step: SeqStep<DltFilterType>) => SeqOccurrence<DltFilterType>,
  ): [boolean, SeqOccurrence<DltFilterType> | undefined] {
    if (this.sequence !== undefined) {
      let curValues: SeqOccurrence<DltFilterType>[] | undefined = curSeqOcc?.stepsResult.get(this) as
        | SeqOccurrence<DltFilterType>[]
        | undefined

      // do we have a started one? (a !isFinished() one)
      let startedSeqOccurrence: SeqOccurrence<DltFilterType> | undefined = undefined
      if (curValues !== undefined && curValues.length > 0) {
        let lastOcc = curValues[curValues.length - 1]
        if (!lastOcc.isFinished()) {
          startedSeqOccurrence = lastOcc
        }
      }

      const seqNewOccurrence = (msg: ViewableDltMsg, step: SeqStep<DltFilterType>): SeqOccurrence<DltFilterType> => {
        const newOcc = new SeqOccurrence(
          curValues !== undefined ? curValues.length + 1 : 1,
          {
            evType: 'sequence',
            title: this.name,
            timeInMs: msg.receptionTimeInMs, // todo: map to lifecycle time + timestamp...
            timeStamp: msg.timeStamp,
            lifecycle: msg.lifecycle,
            summary: `started by step #${step.stepPrefix}${step.stepNr} via msg #${msg.index}`,
            msgText: `\#${msg.index} ${msg.timeStamp / 10000}s ${msg.ecu} ${msg.apid} ${msg.ctid} ${msg.payloadString}`,
          },
          this.sequence.steps,
        )
        if (curValues === undefined) {
          if (curSeqOcc === undefined) {
            // for now simply if we do match... TODO: on first mandatory step only?
            // start a new sequence occurrence
            curSeqOcc = newOccurrence(msg, this)
          }
          curSeqOcc.stepsResult.set(this, (curValues = []))
        }
        curValues.push(newOcc)
        seqResult.logs.push(
          `started sequence '${this.sequence.name}' instance #${newOcc.instance} by step #${step.stepPrefix}${step.stepNr} by msg #${msg.index}`,
        )
        return newOcc
      }

      // todo other newOccurrence here!
      // const seqResult: FbSequenceResult = { sequence: this.sequence.jsonSeq, occurrences: [], logs: [] }
      const [updated, newOcc] = this.sequence.processMsg(msg, startedSeqOccurrence, seqResult, seqNewOccurrence)
      if (updated) {
        if (curSeqOcc === undefined) {
          // for now simply if we do match... TODO: on first mandatory step only?
          // start a new sequence occurrence
          curSeqOcc = newOccurrence(msg, this)
        }

        // check for sequence compliance:
        let errorText: string | undefined = undefined
        if (curSeqOcc.maxStepNr > this.stepNr) {
          errorText = `step #${this.stepPrefix}${this.stepNr} out of order (maxStepNr=${curSeqOcc.maxStepNr})`
        } else {
          if (this.maxOcc !== undefined) {
            // check cardinality:
            const curOcc = curValues !== undefined ? curValues.length : 0
            if (curOcc > this.maxOcc) {
              // curValues includes already the new one
              // fail this step:
              // TODO! How to return the msg that errored? curValues.push(this.eventFromMsg(msg, 'error'))
              curSeqOcc.failures.push(`step #${this.stepPrefix}${this.stepNr} exceeded max cardinality ${this.maxOcc}`)
              errorText = `step #${this.stepPrefix}${this.stepNr} exceeded max cardinality ${this.maxOcc}`
            }
          }
        }
        if (errorText !== undefined) {
          // TODO How to return? curValues.push(this.eventFromMsg(msg, 'error'))
          curSeqOcc.failures.push(errorText)
          // pass this msgs to new sequence occurrence (TODO: as well for sub-sequences?)
          // todo create a new one? rethink... whether sub-sequences should start new seq. curSeqOcc = newOccurrence(msg, this)
          /*const [newUpdated, newOcc] = this.processMsg(msg, curSeqOcc, seqResult, newOccurrence)
          if (newUpdated) {
            // in this case the log "...finished by ..." would be missing! TODO... move this log to here?
            curSeqOcc = newOcc
          }*/
          return [true, curSeqOcc]
        }

        if (curValues === undefined) {
          curSeqOcc.stepsResult.set(this, (curValues = []))
        }
        // curValues.push(newOcc)
        curSeqOcc.maxStepNr = Math.max(curSeqOcc.maxStepNr, this.stepNr) // max would not be necessary as we check upfront
        return [true, curSeqOcc]
      }
    } else if (this.filter.matches(msg)) {
      if (curSeqOcc === undefined) {
        // for now simply if we do match... TODO: on first mandatory step only?
        // start a new sequence occurrence
        curSeqOcc = newOccurrence(msg, this)
      }

      // evaluate value: ok, warn, undefined, error
      const value = 'ok'

      // update overall step value as max of ... and keep the msg determining that value
      // todo... check cardinality minOcc/maxOcc... treat as failure if not exceeded

      // get cur value: (here only FbEvent[])
      let curValues: FbEvent[] | undefined = curSeqOcc.stepsResult.get(this) as FbEvent[] | undefined
      if (curValues === undefined) {
        curSeqOcc.stepsResult.set(this, (curValues = []))
      }

      // check for sequence compliance?
      let errorText: string | undefined = undefined
      if (curSeqOcc.maxStepNr > this.stepNr) {
        errorText = `step #${this.stepPrefix}${this.stepNr} out of order (maxStepNr=${curSeqOcc.maxStepNr})`
      } else {
        if (this.maxOcc !== undefined) {
          // check cardinality:
          const curOcc = curValues.length
          if (curOcc >= this.maxOcc) {
            // fail this step:
            curValues.push(this.eventFromMsg(msg, 'error'))
            curSeqOcc.failures.push(`step #${this.stepPrefix}${this.stepNr} exceeded max cardinality ${this.maxOcc}`)
            errorText = `step #${this.stepPrefix}${this.stepNr} exceeded max cardinality ${this.maxOcc}`
          }
        }
      }
      if (errorText !== undefined) {
        curValues.push(this.eventFromMsg(msg, 'error'))
        curSeqOcc.failures.push(errorText)
        // pass this msgs to new sequence occurrence
        curSeqOcc = newOccurrence(msg, this)
        const [newUpdated, newOcc] = this.processMsg(msg, curSeqOcc, seqResult, newOccurrence)
        if (newUpdated) {
          // in this case the log "...finished by ..." would be missing! TODO... move this log to here?
          curSeqOcc = newOcc
        }
        return [true, curSeqOcc]
      }

      /*if (this.maxOcc !== undefined) {
        // check cardinality:
        const curOcc = curValues.reduce((acc, [_, occ]) => acc + occ, 0)
        if (curOcc >= this.maxOcc) {
          // fail this step:
          curValues.push(['error', 1]) // todo logically we should update the last entry if it is the same value
          curSeqOcc.failures.push(`step #${this.stepNr} exceeded max cardinality ${this.maxOcc}`)

          // if we fail due to maxOcc, we create a new seq. occurrence as well
          curSeqOcc = seqChecker.newOccurrence(msg, this)
          const [newUpdated, newOcc] = this.processMsgs(msg, curSeqOcc, seqChecker)
          if (newUpdated) {
            // in this case the log "...finished by ..." would be missing! TODO... move this log to here?
            curSeqOcc = newOcc
          }
          return [true, curSeqOcc]
        }
      }*/

      curValues.push(this.eventFromMsg(msg, value))
      curSeqOcc.maxStepNr = Math.max(curSeqOcc.maxStepNr, this.stepNr) // max would not be necessary as we check upfront
      // not needed, Array updated in place... curSeqOcc.stepsResult.set(this, curValues)
      return [true, curSeqOcc] // updated curSeq
    }
    return [false, curSeqOcc] // neither match nor start a new seq
  }
}

export class Sequence<DltFilterType extends IDltFilter> {
  public steps: SeqStep<DltFilterType>[] = []
  public failureFilters: [string, DltFilterType][]

  constructor(
    public stepPrefix: string,
    public jsonSeq: FBSequence,
    private DltFilterConstructor: new (json: any, allowEdits?: boolean) => DltFilterType,
  ) {
    // todo do checks/preproc and throw errors if needed
    // e.g if no filters for this sequence
    if (!this.jsonSeq.name || typeof this.jsonSeq.name !== 'string') {
      throw new Error(`SeqChecker: no name for sequence found! JSON=${JSON.stringify(this.jsonSeq)}`)
    }
    // check for steps
    if (!this.jsonSeq.steps || !Array.isArray(this.jsonSeq.steps)) {
      throw new Error(`SeqChecker: steps not an array for sequence '${this.jsonSeq.name}'! JSON=${JSON.stringify(this.jsonSeq)}`)
    }
    for (const [idx, step] of this.jsonSeq.steps.entries()) {
      this.steps.push(new SeqStep<DltFilterType>(this.stepPrefix, idx + 1, step, DltFilterConstructor))
    }

    this.failureFilters = Object.entries(this.jsonSeq.failures || {}).map(([failureName, filter]) => [
      failureName,
      new this.DltFilterConstructor(filter),
    ])
  }

  get name(): string {
    return this.jsonSeq.name
  }

  processMsg(
    msg: ViewableDltMsg,
    curSeqOcc: SeqOccurrence<DltFilterType> | undefined,
    seqResult: FbSequenceResult,
    newOccurrence: (msg: ViewableDltMsg, step: SeqStep<DltFilterType>) => SeqOccurrence<DltFilterType>,
  ): [boolean, SeqOccurrence<DltFilterType> | undefined] {
    let startedSeqOccurrence: SeqOccurrence<DltFilterType> | undefined = curSeqOcc
    let updated = false
    for (const [failureName, filter] of this.failureFilters) {
      if (filter.matches(msg)) {
        // do we have a started sequence? then mark that as failed
        // the first failure marks it as failed (or when isFinished)
        if (startedSeqOccurrence !== undefined) {
          startedSeqOccurrence.failures.push(failureName)
          seqResult.logs.push(
            `sequence '${this.name}' instance #${startedSeqOccurrence.instance} marked as failure '${failureName}' by matched msg #${msg.index}`,
          )
          if (startedSeqOccurrence.isFinished()) {
            startedSeqOccurrence = undefined
            updated = true
            break // only one failure per seq
          }
        } else {
          // else start a new sequence and mark that as failed ? <- no, we should not start a new sequence
          // startedSeqOccurrence = {} as SeqOccurrence
          seqResult.logs.push(`ignored failure '${failureName}' of matched msg #${msg.index} as no started sequence occurrence`)
        }
      }
    }
    for (const step of this.steps) {
      const [stepUpdated, newOcc] = step.processMsg(msg, startedSeqOccurrence, seqResult, newOccurrence)
      if (stepUpdated) {
        updated = true
        const newSeqOcc = newOcc !== startedSeqOccurrence
        if (startedSeqOccurrence && startedSeqOccurrence.isFinished()) {
          seqResult.logs.push(
            `sequence '${this.name}' instance #${startedSeqOccurrence.instance} finished by step #${this.stepPrefix}${step.stepNr} by msg #${msg.index}`,
          )
          startedSeqOccurrence = undefined
        }
        if (newSeqOcc) {
          // even the newly one could be finished instantly
          startedSeqOccurrence = newOcc
          if (startedSeqOccurrence && startedSeqOccurrence.isFinished()) {
            seqResult.logs.push(
              `sequence '${this.name}' instance #${startedSeqOccurrence.instance} finished by step #${this.stepPrefix}${step.stepNr} by msg #${msg.index}`,
            )
            startedSeqOccurrence = undefined
          }
        }
      } // TODO break for after an update? or shall we let a msg update multiple steps?
    }
    return [updated, startedSeqOccurrence]
  }
}

export class SeqChecker<DltFilterType extends IDltFilter> {
  public seqOccurrences: SeqOccurrence<DltFilterType>[] = []
  //private steps: SeqStep<DltFilterType>[] = []
  private sequence: Sequence<DltFilterType>

  constructor(
    private jsonSeq: FBSequence,
    public seqResult: FbSequenceResult,
    private DltFilterConstructor: new (json: any, allowEdits?: boolean) => DltFilterType,
  ) {
    this.sequence = new Sequence('', jsonSeq, DltFilterConstructor)
  }

  get name(): string {
    return this.sequence.name
  }

  newOccurrence(msg: ViewableDltMsg, step: SeqStep<DltFilterType>): SeqOccurrence<DltFilterType> {
    const newOcc = new SeqOccurrence(
      this.seqOccurrences.length + 1,
      {
        evType: 'sequence',
        title: this.name,
        timeInMs: msg.receptionTimeInMs, // todo: map to lifecycle time + timestamp...
        timeStamp: msg.timeStamp,
        lifecycle: msg.lifecycle,
        summary: `started by step #${this.sequence.stepPrefix}${step.stepNr} via msg #${msg.index}`,
        msgText: `\#${msg.index} ${msg.timeStamp / 10000}s ${msg.ecu} ${msg.apid} ${msg.ctid} ${msg.payloadString}`,
      },
      this.sequence.steps,
    )
    this.seqOccurrences.push(newOcc)
    this.seqResult.logs.push(
      `started sequence '${this.name}' instance #${newOcc.instance} by step #${this.sequence.stepPrefix}${step.stepNr} by msg #${msg.index}`,
    )
    return newOcc
  }

  processMsgs(msgs: ViewableDltMsg[]) {
    // now process the msgs:
    let startedSeqOccurrence: SeqOccurrence<DltFilterType> | undefined = undefined

    // prepare to refactor following code into a method of Sequence
    const sequence = this.sequence

    for (const msg of msgs) {
      const [updated, newOcc] = sequence.processMsg(msg, startedSeqOccurrence, this.seqResult, this.newOccurrence.bind(this))
      if (updated) {
        startedSeqOccurrence = newOcc
      }
      /*
      // any failure?
      // todo except for logging/debugging we can skip if startedSeqOccurrence is undefined
      for (const [failureName, filter] of sequence.failureFilters) {
        if (filter.matches(msg)) {
          // do we have a started sequence? then mark that as failed
          // the first failure marks it as failed (or when isFinished)
          if (startedSeqOccurrence !== undefined) {
            startedSeqOccurrence.failures.push(failureName)
            this.seqResult.logs.push(
              `sequence '${sequence.name}' instance #${startedSeqOccurrence.instance} marked as failure '${failureName}' by matched msg #${msg.index}`,
            )
            if (startedSeqOccurrence.isFinished()) {
              startedSeqOccurrence = undefined
              break // only one failure per seq
            }
          } else {
            // else start a new sequence and mark that as failed ? <- no, we should not start a new sequence
            // startedSeqOccurrence = {} as SeqOccurrence
            this.seqResult.logs.push(`ignored failure '${failureName}' of matched msg #${msg.index} as no started sequence occurrence`)
          }
        }
      }
      // any step?
      // TODO lifecycle support can change this... (e.g. a msg can match the prev as error and/or should start a new one???)
      for (const step of sequence.steps) {
        const [updated, newOcc] = step.processMsg(msg, startedSeqOccurrence, this)
        if (updated) {
          const newSeqOcc = newOcc !== startedSeqOccurrence
          if (startedSeqOccurrence && startedSeqOccurrence.isFinished()) {
            this.seqResult.logs.push(
              `sequence '${sequence.name}' instance #${startedSeqOccurrence.instance} finished by step #${step.stepNr} by msg #${msg.index}`,
            )
            startedSeqOccurrence = undefined
          }
          if (newSeqOcc) {
            // even the newly one could be finished instantly
            startedSeqOccurrence = newOcc
            if (startedSeqOccurrence && startedSeqOccurrence.isFinished()) {
              this.seqResult.logs.push(
                `sequence '${sequence.name}' instance #${startedSeqOccurrence.instance} finished by step #${step.stepNr} by msg #${msg.index}`,
              )
              startedSeqOccurrence = undefined
            }
          }
        } // TODO break for after an update? or shall we let a msg update multiple steps?
      }*/
    }
    // update seqResult.occurrences
    this.seqResult.occurrences = this.seqOccurrences.map((seqOcc) => seqOcc.asFbSeqOccurrence())
  }

  /**
   *
   * @returns all filters from the sequence incl. the filters from steps and failures
   */
  getAllFilters(): Filter[] {
    return filterFromSeq(this.jsonSeq)
  }
}
