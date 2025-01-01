// TODO use json5??? import { default as JSON5 } from 'json5'

// TODO for SeqChecker:
// [] - check why commit with fix! triggered no release.
// [] - add support for alt steps matching different alternative per occurrence
// [x] (0.9.0) - add support for parallel steps (so non sequential)
// [] - add support for lifecycles (a step can expect to be in a certain lifecycle)
// [] - add support for steps returning a warning
// [x] - add support for context values for reporting
// [x] - add support for context values to match a later step (e.g. for identifiers to match the right status/end...) (starting with _)

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

// #region FBSeqStep
export interface FBSeqStep {
  /**
   * either a filter, sequence, alt or par is needed!
   */
  filter?: Filter
  sequence?: FBSequence
  /**
   * This step consists of alternative steps. Only one of the alternatives needs to match.
   * The result stays a single result (e.g. a single event or a single sequence occurrence)
   * The alternative steps inherit canCreateNew and card.
   */
  alt?: FBSeqStep[]
  /**
   * This step consist of parallel steps. All parallel steps need to match/be ok for the step to be ok.
   */
  par?: FBSeqStep[]
  /**
   * if not provided name of filter or name of sequence will be used
   */
  name?: string
  /**
   * cardinality as a regex quanitifier: ? | * | + | {n} | {n,} | {n,m}
   *
   * Note: currently only ?*+ are supported
   */
  card?: string
  /**
   * canCreateNew: boolean // if true, a new instance of the sequence can be created due to this step
   *
   * Defaults to true (if not provided)
   */
  canCreateNew?: boolean
}

export const nameFromStep = (step: FBSeqStep, defaultName: string): string => {
  if (typeof step !== 'object') {
    return defaultName
  }
  return step.name || step.filter?.name || step.sequence?.name || defaultName
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
 * result of a single step occurrence
 */
export interface FbFilterStepRes {
  stepType: 'filter'
  step: FBSeqStep
  res: FbEvent
}
export interface FbAltStepRes {
  stepType: 'alt'
  step: FBSeqStep
  /**
   * index of the alternative step that was executed
   * TODO: or directly the step or both?
   */
  idx: number
  res: FbStepRes
}
export interface FbSeqStepRes {
  stepType: 'sequence'
  step: FBSeqStep
  res: FbSeqOccurrence
}

export interface FbParStepRes {
  stepType: 'par'
  step: FBSeqStep
  /**
   * results of the parallel steps. For each step the results as an array. As a step can have a card. > 1, we have an array of results
   */
  res: FbStepRes[][] // result contains ...summary:'undefined' for mandatory steps that are not executed and [] for optional steps that are not executed
}

export type FbStepRes = FbFilterStepRes | FbAltStepRes | FbSeqStepRes | FbParStepRes
/**
 * The result of a step consists either of:
 * - array of FbStepResult (for regular steps with filter)
 * - array of FbSeqOccurrence (for steps that are themselves sequences)
 *
 * You can determine the type by check whether the first element contains "evType" or whether it's an object with instanceOf FbSeqOccurrence
 *
 * The result should be JSON serializable / deserializable. But as we use object references to steps
 * special care needs to be taken!
 * TODO: function ... and ... can be used for that!
 * (It works as long as a full FbSequenceResult is serialized including the steps pointing to)
 */

export type StepResult = FbStepRes[]

export class FbSeqOccurrence {
  constructor(
    public instance: number,
    public startEvent: FbEvent,
    public result: string,
    public failures: string[],
    public stepsResult: StepResult[],
    /**
     * context values captured (e.g. ids, filenames,...) as key/value pairs
     * Sorted by capture order thus an array and not an object
     */
    public context: [string, string][],
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

export const summaryForStepRes = (stepResult: FbStepRes): string => {
  switch (stepResult.stepType) {
    case 'filter':
      return stepResult.res.summary
    case 'sequence':
      return stepResult.res.result
    case 'alt':
      return summaryForStepRes(stepResult.res)
    case 'par': // return the min ('error','warning','undefined','ok') of the par steps?
      const minResult = (results: string[]): string => {
        return results.reduce((acc, res) => {
          if (res === 'error') {
            return res
          } else if (res === 'warning' && acc !== 'error') {
            return res
          } else if ((res === undefined || res === 'undefined') && acc !== 'error' && acc !== 'warning') {
            return 'undefined'
          }
          return acc
        }, 'ok')
      }
      // if the stepRes for a par step is undefined, we use 'undefined' as result (to indicate that a mandatory step was not executed)
      // (for optional steps the result is [])
      const parStepRes = stepResult.res.map((stepRes) => (stepRes !== undefined ? stepRes.map(summaryForStepRes) : 'undefined')).flat()
      return minResult(parStepRes)
  }
}

export const msgForStepRes = (stepResult: FbStepRes): string => {
  switch (stepResult.stepType) {
    case 'filter':
      return stepResult.res.msgText ? stepResult.res.msgText : stepResult.res.title
    case 'sequence':
      return stepResult.res.startEvent.msgText ? stepResult.res.startEvent.msgText : stepResult.res.startEvent.title
    case 'alt':
      return msgForStepRes(stepResult.res)
    case 'par': // return the first of the par steps? (or a concat of the first ones)
      const startEvent = startEventForStepRes(stepResult)
      return startEvent ? (startEvent.msgText ? startEvent.msgText : startEvent.title) : ''
  }
}

export const startEventForStepRes = (stepResult: FbStepRes): FbEvent | undefined => {
  switch (stepResult.stepType) {
    case 'filter':
      return stepResult.res
    case 'sequence':
      return stepResult.res.startEvent
    case 'alt':
      return startEventForStepRes(stepResult.res)
    case 'par': {
      // TODO optimize with for loop... instead of iterating through all results! (sadly iterator flatMap is only in nodejs 22 but vscode still ships with 20.18.1)
      // return the first of the par steps? (or a concat of the first ones)
      const startEvents = stepResult.res
        .flat()
        .map((res) => startEventForStepRes(res))
        .filter((ev) => ev !== undefined)
      // TODO sort by time or index?
      return startEvents.length > 0 ? startEvents[0] : undefined
    }
  }
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

/**
 * Escape a text for usage in markdown and html
 * @param text - to be escaped for usage in markdown and html
 * @returns text with escaped characters
 */

export const escapeForMD = (text: string): string => {
  if (typeof text !== 'string') {
    return `text(${JSON.stringify(text)}) is not a string but a '${typeof text}'`
  }
  return text.replace(
    /[\\\`*_{}\[\]<>()#+-.!|&]/g,
    (match) =>
      ({
        '\\': '\\\\',
        '`': '\\`',
        '*': '\\*',
        _: '\\_',
        '{': '\\{',
        '}': '\\}',
        '[': '\\[',
        ']': '\\]',
        '<': '&lt;', // we use that to escape html as well
        '>': '&gt;', // we use that to escape html as well
        '(': '\\(',
        ')': '\\)',
        '#': '\\#',
        '+': '\\+',
        '-': '\\-',
        '.': '\\.',
        '!': '\\!',
        '|': '\\|',
        '&': '&amp;', // would not be needed in markdown but we use it for html as well
      }[match]),
  )
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
        return res.map((r) => resAsEmoji(summaryForStepRes(r))).join('')
      })
      .join(',')}`

    const stepsAsHtml = (summaryPrefix: string, stepsResult: StepResult[], steps: FBSeqStep[]): Html => {
      const stepsSummary = `${summaryPrefix}${stepsResult
        .map((res: StepResult) => {
          if (res.length === 0) {
            return ''
          }
          return res.map((r) => resAsEmoji(summaryForStepRes(r))).join('')
        })
        .join(',')}`

      return asCollapsable(
        stepsSummary,
        asHtmlTable(
          ['', '#', 'name', 'result', 'msg'],
          stepsResult
            .map((res, stepIdx) => {
              if (res.length === 0) {
                return `<td>✔️</td><td>${stepIdx + 1}</td><td>${escapeForMD(nameFromStep(steps[stepIdx], ''))}</td><td></td><td></td>`
              } else {
                return res.map((r) => {
                  if (r.stepType === 'sequence') {
                    const stepName = escapeForMD(nameFromStep(r.step, nameFromStep(steps[stepIdx], '')))
                    let msg = `<td>${resAsEmoji(r.res.result)}</td><td>${stepIdx + 1}</td><td>${stepName}</td><td>${escapeForMD(
                      r.res.result,
                    )}</td><td>${r.res.startEvent.msgText ? escapeForMD(r.res.startEvent.msgText) : ''}`
                    // summary the graphical overview of the steps and in next line the startEvent.msgText
                    // TODO: this looks bad (r.step.sequence?...)
                    msg += `<br>${
                      stepsAsHtml('', r.res.stepsResult, r.step.sequence ? r.step.sequence.steps : r.step.alt ? r.step.alt : r.step.par)
                        .value
                    }`
                    if (r.res.failures.length > 0) {
                      msg += `<br>${r.res.failures.length} failures:<br>${r.res.failures.map(escapeForMD).join('<br>')}`
                    }
                    if (r.res.context.length > 0) {
                      msg += `<br>${r.res.context.map(([name, value]) => `${escapeForMD(name)}: ${escapeForMD(value)}`).join('<br>')}`
                    }
                    msg += `</td>`
                    return msg
                  } else if (r.stepType === 'par') {
                    const stepName = escapeForMD(nameFromStep(r.step, nameFromStep(steps[stepIdx], '')))
                    const startEvent = startEventForStepRes(r)
                    const summary = summaryForStepRes(r)
                    let msg = `<td>${resAsEmoji(summary)}</td><td>${stepIdx + 1}</td><td>${stepName}</td><td>${summary}</td><td>${
                      startEvent?.msgText ? escapeForMD(startEvent.msgText) : ''
                    }`
                    msg += `<br>${stepsAsHtml('parallel: ', r.res, r.step.par).value}`
                    msg += `</td>`
                    return msg
                  } else {
                    const stepName = escapeForMD(nameFromStep(r.step, '')) // TODO for alt from the alt[idx] //  || nameFromStep(sequence.steps[stepIdx], '')
                    const summary = summaryForStepRes(r)
                    const msg = escapeForMD(msgForStepRes(r))
                    return `<td>${resAsEmoji(summary)}</td><td>${stepIdx + 1}</td><td>${stepName}</td><td>${summary}</td><td>${msg}</td>`
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
      occ.startEvent && occ.startEvent.timeInMs ? new Date(occ.startEvent.timeInMs).toLocaleString('de-DE') : '_notime_',
      typeof occ.result === 'string' ? occ.result : JSON.stringify(occ.result),
      occ.context.length > 0 ? occ.context.map(([name, value]) => `${escapeForMD(name)}: ${escapeForMD(value)}`).join('<br>') : '',
      stepsAsHtml('', occ.stepsResult, seqResult.sequence.steps),
      occ.failures.length > 0 ? occ.failures.map(escapeForMD).join('\n') : '',
    ])
  }

  const seqOccurrencesAsTableRows: TableRow[] = seqResult.occurrences ? seqResult.occurrences.map(seqOccurrenceAsTableRow) : []
  resultAsMd.push({
    type: 'table',
    align: ['left', 'right', 'right', 'left', 'left', 'left', 'left', 'left'],
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
        'Context',
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
  } else if (step.alt && Array.isArray(step.alt)) {
    return step.alt.map(filterFromStep).flat()
  } else if (step.par && Array.isArray(step.par)) {
    return step.par.map(filterFromStep).flat()
  }
  return []
}

/**
 *
 * @returns all filters from the sequence incl. the filters from steps and failures
 */
const filterFromSeq = (seq: FBSequence): Filter[] => {
  const filterFromFailures = seq.failures ? Object.entries(seq.failures).map(([_, filter]) => filter) : []
  const filtersFromSteps = seq.steps ? seq.steps.map(filterFromStep).flat() : []
  return [...filterFromFailures, ...filtersFromSteps]
}

type SeqStepResult<DltFilterType extends IDltFilter> = StepResult | SeqOccurrence<DltFilterType>[]

class SeqOccurrence<DltFilterType extends IDltFilter> {
  // sequence: FBSequence
  // instance: number // 1.. based
  stepType: 'tmpSequence' // to be compliant with FbStepRes

  stepsResult: Map<SeqStep<DltFilterType>, SeqStepResult<DltFilterType>> // summary field contains the result of the step as "ok", "warning", "error", "undefined"
  failures: string[]
  context: Map<string, string> // context values for reporting, context values starting with _ can be set just once and then later on need to match
  maxStepNr: number // the max stepNr of the executed steps

  constructor(public step: FBSeqStep, public instance: number, public startEvent: FbEvent, private steps: SeqStep<DltFilterType>[]) {
    this.stepType = 'tmpSequence'
    this.stepsResult = new Map()
    this.failures = []
    this.context = new Map()
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
      return lastMandatoryStep.isFinished(this)
    }
    // no mandatory step found???
    throw 'no mandatory step found in sequence'
    // return true
  }

  asFbSeqOccurrence(): FbSeqOccurrence {
    const stepResults = this.steps.map((step) => {
      const stepRes: SeqStepResult<DltFilterType> = this.stepsResult.get(step)
      if (stepRes === undefined) {
        return step.isMandatory()
          ? [
              {
                stepType: 'filter',
                step: step.jsonStep,
                res: { evType: 'step', summary: 'error', title: `mandatory step ${step.stepNr} missing`, timeStamp: 0 },
              },
            ]
          : []
      }
      // stepRes is of type SeqStepResult<_> = StepResult | SeqOccurrence<DltFilterType>[] = FbStepRes[] | SeqOccurrence<DltFilterType>[]
      return stepRes.map((r) =>
        r.stepType === 'tmpSequence'
          ? { stepType: 'sequence', step: step.jsonStep /*todo or this.step? */, res: r.asFbSeqOccurrence() }
          : r,
      )
    })

    return new FbSeqOccurrence(
      this.instance,
      this.startEvent,
      this.result(),
      this.failures,
      stepResults,
      Array.from(this.context.entries()),
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
      step.finalizeResults()
      const result = this.stepsResult.get(step)
      if (result === undefined || result.length === 0) {
        return undefined
      }
      return result.reduce((acc, stepRes) => {
        const thisStepRes = stepRes.stepType === 'tmpSequence' ? stepRes.result() : summaryForStepRes(stepRes /*as unknown as FbStepRes*/)
        if (thisStepRes === 'error') {
          return 'error'
        } else if (thisStepRes === 'warning' && acc !== 'error') {
          return 'warning'
        } else if (thisStepRes === 'undefined' && acc !== 'error' && acc !== 'warning') {
          return 'undefined'
        }
        return acc
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
    const lastMandatoryStep = this.steps.findLast(
      (step, idx) => step.isMandatory() && (stepResults[idx] === undefined || stepResults[idx] === 'undefined'),
    )
    if (lastMandatoryStep !== undefined && lastMandatoryStep.stepNr < this.maxStepNr) {
      return `error`
    }

    // any mandatory step missing? -> undefined
    const mandStepsUndefined = this.steps.filter(
      (step, idx) => step.isMandatory() && (stepResults[idx] === undefined || stepResults[idx] === 'undefined'),
    )
    if (mandStepsUndefined.length > 0) {
      return 'undefined'
    }
    // assert(this.isFinished())
    return 'ok'
  }
}

interface IDltFilter {
  matches(msg: FilterableDltMsg): boolean
  /**
   * the regex is used to get capture groups besides being part of the filter
   */
  payloadRegex: RegExp | undefined
}

export const getCaptures = (regex: RegExp, payloadString: string) => {
  const matches = regex.exec(payloadString)
  if (matches === null) {
    return undefined
  } else {
    return matches.groups
  }
}

// #region SeqStep
/**
 * Create a new SeqStepFiler, SeqStepSequence or SeqStepAlt based on the json step.
 *
 * Performs sanity checks on the json step
 * @param step the json step object
 * @param stepPrefix
 * @param stepNr
 * @param DltFilterConstructor
 * @returns an instance of SeqStep
 */
function newSeqStep<DltFilterType extends IDltFilter>(
  step: FBSeqStep,
  stepPrefix: string,
  stepNr: number,
  DltFilterConstructor: new (json: any, allowEdits?: boolean) => DltFilterType,
): SeqStep<DltFilterType> {
  const hasFilter = typeof step.filter === 'object'
  const hasSequence = typeof step.sequence === 'object'
  const hasAlt = Array.isArray(step.alt)
  const hasPar = Array.isArray(step.par)
  const sumHas = [hasFilter, hasSequence, hasAlt, hasPar].reduce((acc, cur) => acc + (cur ? 1 : 0), 0)

  if (sumHas === 0) {
    throw new Error(
      `SeqStep#${stepPrefix}${stepNr}: no filter, sequence, alt(ernatives) or par(allel) for step found! JSON=${JSON.stringify(step)}`,
    )
  }
  if (sumHas > 1) {
    throw new Error(
      `SeqStep#${stepPrefix}${stepNr}: more than one filter, sequence, alt(ernative) or par(allel) for step found! Should be one of filter, sequence, alt or par. JSON=${JSON.stringify(
        step,
      )}`,
    )
  }

  if (hasFilter) {
    return new SeqStepFilter<DltFilterType>(stepPrefix, stepNr, step, DltFilterConstructor)
  } else if (hasSequence) {
    return new SeqStepSequence<DltFilterType>(stepPrefix, stepNr, step, DltFilterConstructor)
  } else if (hasAlt) {
    return new SeqStepAlt<DltFilterType>(stepPrefix, stepNr, step, DltFilterConstructor)
  } else if (hasPar) {
    return new SeqStepPar<DltFilterType>(stepPrefix, stepNr, step, DltFilterConstructor)
  }
  throw new Error(`SeqStep#${this.stepPrefix}${stepNr}: no filter, sequence or alt(ernatives) for step found! JSON=${JSON.stringify(step)}`)
}

abstract class SeqStep<DltFilterType extends IDltFilter> {
  public minOcc: number = 1
  public maxOcc: number | undefined

  constructor(
    public stepPrefix: string,
    public stepNr: number,
    public jsonStep: FBSeqStep,
    private DltFilterConstructor: new (json: any, allowEdits?: boolean) => DltFilterType,
  ) {
    switch (jsonStep.card) {
      case '?':
        this.minOcc = 0
        this.maxOcc = 1
        break
      case '*':
        this.minOcc = 0
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

  get canCreateNew(): boolean {
    return this.jsonStep.canCreateNew != false
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
  abstract processMsg(
    msg: ViewableDltMsg,
    curSeqOcc: SeqOccurrence<DltFilterType> | undefined,
    seqResult: FbSequenceResult,
    haveOccurrence: boolean, // to check with .canCreateNew whether we have a current occurrence (we cannot use curSeqOcc as for e.g. par steps we use different occurrences)
    newOccurrence: (msg: ViewableDltMsg, step: SeqStep<DltFilterType>) => SeqOccurrence<DltFilterType>,
  ): [boolean, SeqOccurrence<DltFilterType> | undefined]

  /**
   * returns whether the step is finished.
   * Will only be called if the step is mandatory
   */
  abstract isFinished(occurrence: SeqOccurrence<DltFilterType>): boolean

  /**
   * return whether the occurrence allows more matches/msg
   */
  abstract allowsMoreMatches(occurrence: SeqOccurrence<DltFilterType>): boolean

  /**
   * will be called before the result is consolidated. Can be used to finalize/modify results
   */
  finalizeResults(): void {}
}

// #region SeqStepPar
class SeqStepPar<DltFilterType extends IDltFilter> extends SeqStep<DltFilterType> {
  private parSteps: SeqStep<DltFilterType>[]
  // keep a map of FbSeqOccurrences[] for each occurrence of ourself
  // the array contains the results of the parallel stepså
  private occData: Map<FbParStepRes, SeqOccurrence<DltFilterType>[]> = new Map()

  constructor(
    stepPrefix: string,
    stepNr: number,
    jsonStep: FBSeqStep,
    DltFilterConstructor: new (json: any, allowEdits?: boolean) => DltFilterType,
  ) {
    super(stepPrefix, stepNr, jsonStep, DltFilterConstructor)
    if (jsonStep.par.length === 0) {
      throw new Error(`SeqStepPar#${stepPrefix}${stepNr}: no par(allel) steps provided! JSON=${JSON.stringify(jsonStep)}`)
    }
    // every step can have its own card and canCreateNew attribs
    this.parSteps = jsonStep.par.map((parStep, idx) =>
      newSeqStep(parStep, `${stepPrefix.length > 0 ? stepPrefix + '.p' : 'p'}${idx + 1}`, stepNr, DltFilterConstructor),
    )
  }

  /**
   * return whether the last occurrence of this step is finished
   * @param occurrence - sequence occurrence with the results of this step
   * @returns
   */
  isFinished(occurrence: SeqOccurrence<DltFilterType>): boolean {
    const results = occurrence.stepsResult.get(this) as FbParStepRes[] | undefined
    if (results !== undefined && results.length > 0) {
      // return if all par steps are finished
      const stepsOccData = this.occData.get(results[results.length - 1])
      if (stepsOccData === undefined) {
        console.error(`SeqStepPar#${this.stepPrefix}${this.stepNr}: no occurrence data found for last occurrence! Logical error!`)
        return false
      }
      return this.parSteps.every((step, idx) => {
        if (stepsOccData[idx] === undefined) {
          return !step.isMandatory()
        }
        return stepsOccData[idx] !== undefined && step.isFinished(stepsOccData[idx])
      })
    }
    return false
  }

  allowsMoreMatches(occurrence: SeqOccurrence<DltFilterType>): boolean {
    const results = occurrence.stepsResult.get(this) as FbParStepRes[] | undefined
    if (this.maxOcc === undefined || results.length < this.maxOcc) {
      return true
    }
    if (results.length === this.maxOcc) {
      // check if any of the par steps allows more matches
      const stepsOccData = this.occData.get(results[results.length - 1])
      if (stepsOccData !== undefined && stepsOccData.length > 0) {
        return this.parSteps.some((step, idx) => {
          const stepOcc = stepsOccData[idx]
          return stepOcc === undefined || step.allowsMoreMatches(stepOcc)
        })
      }
      return !this.isFinished(occurrence)
    }
    return false
  }

  finalizeResults(): void {
    super.finalizeResults()
    // finalize results of all par steps
    this.parSteps.forEach((step, idx) => step.finalizeResults())

    // now copy the data to the overall par step results
    for (const [parStepRes, stepsOccData] of this.occData.entries()) {
      parStepRes.res.length = stepsOccData.length
      for (const [idx, stepOcc] of stepsOccData.entries()) {
        let res: SeqStepResult<DltFilterType> | undefined = stepOcc !== undefined ? stepOcc.stepsResult.values().next().value : undefined
        if (res !== undefined && res.length > 0) {
          res = res.map((stepRes) => {
            if (stepRes.stepType === 'tmpSequence') {
              return { stepType: 'sequence', step: stepRes.step, res: stepRes.asFbSeqOccurrence() }
            }
            return stepRes
          })
        }
        if (res === undefined) {
          if (this.parSteps[idx].isMandatory()) {
            res = [
              {
                stepType: 'filter',
                step: this.parSteps[idx].jsonStep,
                res: {
                  evType: 'step',
                  summary: 'undefined',
                  title: `mandatory step ${this.parSteps[idx].stepPrefix} missing`,
                  timeStamp: 0,
                },
              },
            ]
          } else {
            res = []
          }
        }
        parStepRes.res[idx] = res as FbStepRes[]
      }
    }
  }

  processMsg(
    msg: ViewableDltMsg,
    curSeqOcc: SeqOccurrence<DltFilterType> | undefined,
    seqResult: FbSequenceResult,
    haveOccurrence: boolean,
    newOccurrence: (msg: ViewableDltMsg, step: SeqStep<DltFilterType>) => SeqOccurrence<DltFilterType>,
  ): [boolean, SeqOccurrence<DltFilterType> | undefined] {
    // type StepResult = FbStepRes[] // FbEvent[] | FbSeqOccurrence[]
    // type FbStepRes = FbFilterStepRes | FbAltStepRes | FbSeqStepRes
    // type SeqStepResult<DltFilterT...> = StepResult | SeqOccurrence<DltFilterType>[]

    if (!haveOccurrence && !this.canCreateNew) {
      return [false, curSeqOcc]
    }
    let curValues = curSeqOcc?.stepsResult.get(this) as FbParStepRes[] | undefined

    // do we have a started one? (a !isFinished() one)
    let runningValues: FbParStepRes | undefined = undefined
    let lastFinishedValues: FbParStepRes | undefined = undefined // only if the last one is finished (not running)
    if (curValues !== undefined && curValues.length > 0) {
      if (!this.isFinished(curSeqOcc) /* || this.allowsMoreMatches(curSeqOcc)*/) {
        runningValues = curValues[curValues.length - 1]
      } else {
        lastFinishedValues = curValues[curValues.length - 1]
      }
    }
    const stepsOccRunningData = runningValues ? this.occData.get(runningValues) : undefined
    const stepsOccFinishedData = lastFinishedValues ? this.occData.get(lastFinishedValues) : undefined

    for (const [idx, parStep] of this.parSteps.entries()) {
      // if we have a non running one but a last finished one and this parStep allows more matches, pass it on to it:
      let prevStepOcc: SeqOccurrence<DltFilterType> | undefined = undefined
      let stepRunningValues: FbParStepRes | undefined = runningValues
      if (
        stepsOccFinishedData !== undefined &&
        (stepsOccFinishedData[idx] === undefined || parStep.allowsMoreMatches(stepsOccFinishedData[idx]))
      ) {
        prevStepOcc = stepsOccFinishedData[idx]
        stepRunningValues = lastFinishedValues
      }

      const stepNewOccurrence = (msg: ViewableDltMsg, step: SeqStep<DltFilterType>): SeqOccurrence<DltFilterType> => {
        const newOcc = new SeqOccurrence(
          step.jsonStep, // NOTE this is wrong step (no sequence) but we don't use it anyhow
          prevStepOcc ? prevStepOcc.instance + 1 : 1,
          {
            evType: 'sequence', // or parStep? as it wont be reflected to outside anyhow. finalizeResults() will take only the results from it
            title: this.name,
            timeInMs: msg.receptionTimeInMs, // todo: map to lifecycle time + timestamp...
            timeStamp: msg.timeStamp,
            lifecycle: msg.lifecycle,
            summary: `started by step #${step.stepPrefix}${step.stepNr} via msg #${msg.index}`,
            msgText: `\#${msg.index} ${msg.timeStamp / 10000}s ${msg.ecu} ${msg.apid} ${msg.ctid} ${msg.payloadString}`,
          },
          [parStep],
        )
        if (curValues === undefined) {
          if (curSeqOcc === undefined) {
            curSeqOcc = newOccurrence(msg, this)
          }
          curSeqOcc.stepsResult.set(this, (curValues = []))
        }
        if (stepRunningValues === undefined) {
          curValues.push({ stepType: 'par', step: this.jsonStep, res: new Array(this.parSteps.length).fill(undefined) })
          stepRunningValues = curValues[curValues.length - 1]
          if (runningValues === undefined) {
            runningValues = stepRunningValues
          }
          this.occData.set(stepRunningValues, new Array(this.parSteps.length))
        }
        this.occData.get(stepRunningValues)![idx] = newOcc
        newOcc.context = curSeqOcc.context // we share the context with the parent sequence
        return newOcc
      }

      const [updated, newOcc] = parStep.processMsg(msg, prevStepOcc, seqResult, curSeqOcc !== undefined, stepNewOccurrence)
      if (updated) {
        // the results get updated only in the finalizeResults() method

        // check for sequence compliance?
        let errorText: string | undefined = undefined
        if (curSeqOcc.maxStepNr > this.stepNr) {
          errorText = `step #${this.stepPrefix}${this.stepNr} out of order (maxStepNr=${curSeqOcc.maxStepNr})`
        } else if (this.maxOcc !== undefined) {
          // check cardinality:
          const curOcc = curValues.length
          if (curOcc > this.maxOcc) {
            // fail this step:
            // curValues.push({ stepType: 'filter', step: this, res: this.eventFromMsg(msg, 'error') })
            errorText = `step #${this.stepPrefix}${this.stepNr} exceeded max cardinality ${this.maxOcc}`
          }
        }
        if (errorText !== undefined) {
          curSeqOcc.failures.push(`step #${this.stepPrefix}${this.stepNr} exceeded max cardinality ${this.maxOcc}`)
          // pass this msgs to new sequence occurrence
          if (this.canCreateNew) {
            curSeqOcc = newOccurrence(msg, this)
            const [newUpdated, newOcc] = this.processMsg(msg, curSeqOcc, seqResult, true, newOccurrence)
            if (newUpdated) {
              // in this case the log "...finished by ..." would be missing! TODO... move this log to here?
              curSeqOcc = newOcc
            }
          }
        }
        curSeqOcc.maxStepNr = Math.max(curSeqOcc.maxStepNr, this.stepNr)
        return [true, curSeqOcc]
      }
    }
    return [false, curSeqOcc]
  }
}

// #region SeqStepAlt
class SeqStepAlt<DltFilterType extends IDltFilter> extends SeqStep<DltFilterType> {
  private altSteps: SeqStep<DltFilterType>[]
  constructor(
    stepPrefix: string,
    stepNr: number,
    jsonStep: FBSeqStep,
    DltFilterConstructor: new (json: any, allowEdits?: boolean) => DltFilterType,
  ) {
    super(stepPrefix, stepNr, jsonStep, DltFilterConstructor)
    if (typeof jsonStep.alt !== 'object' || !Array.isArray(jsonStep.alt)) {
      throw new Error(`SeqStep#${stepPrefix}${stepNr}: no alt array for step found! JSON=${JSON.stringify(jsonStep)}`)
    }
    if (jsonStep.alt.length === 0) {
      throw new Error(`SeqStep#${stepPrefix}${stepNr}: no alt(ernative) steps provided! JSON=${JSON.stringify(jsonStep)}`)
    }
    // we need to pass the canCreateNew (non overwriteable) and card (overwriteable) attribs to the alt steps
    this.altSteps = jsonStep.alt.map((altStep, idx) =>
      newSeqStep(
        { card: jsonStep.card, ...altStep, canCreateNew: this.canCreateNew },
        `${stepPrefix.length > 0 ? stepPrefix + '.a' : 'a'}${idx + 1}`,
        stepNr,
        DltFilterConstructor,
      ),
    )
  }

  isFinished(occurrence: SeqOccurrence<DltFilterType>): boolean {
    // return if any alt step is finished
    return this.altSteps.some((step) => {
      return step.isFinished(occurrence)
    })
  }

  allowsMoreMatches(occurrence: SeqOccurrence<DltFilterType>): boolean {
    const stepRes = occurrence.stepsResult.get(this)
    if (stepRes !== undefined && (this.maxOcc === undefined || stepRes.length < this.maxOcc)) {
      return true
    }
    return false
  }

  finalizeResults(): void {
    super.finalizeResults()
    // finalize results of all alt steps
    this.altSteps.forEach((step) => step.finalizeResults())
  }
  processMsg(
    msg: ViewableDltMsg,
    curSeqOcc: SeqOccurrence<DltFilterType> | undefined,
    seqResult: FbSequenceResult,
    haveOccurrence: boolean,
    newOccurrence: (msg: ViewableDltMsg, step: SeqStep<DltFilterType>) => SeqOccurrence<DltFilterType>,
  ): [boolean, SeqOccurrence<DltFilterType> | undefined] {
    if (!haveOccurrence && !this.canCreateNew) {
      return [false, curSeqOcc]
    }
    // pass the msg to alt steps and return the first one that matches
    // TODO check whether any did match already? (e.g. by checking whether the step has already a result?)
    // and then only call that one?
    // this is only for card and mixed use-cases...

    for (const [idx, altStep] of this.altSteps.entries()) {
      const [updated, newOcc] = altStep.processMsg(msg, curSeqOcc, seqResult, haveOccurrence, newOccurrence)
      if (updated) {
        // update seqResult for this step... we do mirror the result from the alt step
        // that updated/matched
        if (curSeqOcc !== undefined) {
          const curSeqOccStepResult = curSeqOcc.stepsResult.get(altStep)

          // type StepResult = FbStepRes[] // FbEvent[] | FbSeqOccurrence[]
          // type FbStepRes = FbFilterStepRes | FbAltStepRes | FbSeqStepRes
          // map type SeqStepResult<DltFilterT...> = StepResult | SeqOccurrence<DltFilterType>[]
          // TODO: every step could be from a different alt.
          // So even the number of occ/card could be different.
          // Need to think whether we do want to support that.
          // So for now we do return the result (and stepType) from the step that matched last.

          const altStepResult = curSeqOcc.stepsResult.get(this)
          //if (!!curSeqOccStepResult != !!altStepResult) {
          curSeqOccStepResult
            ? curSeqOcc.stepsResult.set(this, curSeqOccStepResult) // TODO .map((o)=> return { stepType: 'alt', step: this, idx, res: o }))
            : // TODO if we map we have to handle nested alt steps as well (!) (for the name generation and get the result from last one)
              curSeqOcc.stepsResult.delete(this)
          //}
        }
        if (newOcc !== curSeqOcc && newOcc !== undefined) {
          const newSeqOccStepResult = newOcc.stepsResult.get(altStep)
          newSeqOccStepResult ? newOcc.stepsResult.set(this, newSeqOccStepResult) : newOcc.stepsResult.delete(this)
        }
        return [true, newOcc]
      }
    }
    return [false, curSeqOcc]
  }
}

// #region SeqStepFilter
class SeqStepFilter<DltFilterType extends IDltFilter> extends SeqStep<DltFilterType> {
  public filter: IDltFilter

  constructor(
    stepPrefix: string,
    stepNr: number,
    jsonStep: FBSeqStep,
    DltFilterConstructor: new (json: any, allowEdits?: boolean) => DltFilterType,
  ) {
    super(stepPrefix, stepNr, jsonStep, DltFilterConstructor)
    if (typeof jsonStep.filter !== 'object') {
      throw new Error(`SeqStep#${stepPrefix}${stepNr}: no filter for step found! JSON=${JSON.stringify(jsonStep)}`)
    }
    this.filter = new DltFilterConstructor({ type: 3, ...jsonStep.filter })
  }

  isFinished(occurrence: SeqOccurrence<DltFilterType>): boolean {
    const lastResult = occurrence.stepsResult.get(this)
    return lastResult !== undefined
  }

  allowsMoreMatches(occurrence: SeqOccurrence<DltFilterType>): boolean {
    const results = occurrence.stepsResult.get(this)
    if (results !== undefined && (this.maxOcc === undefined || results.length < this.maxOcc)) {
      return true
    }
    return false
  }

  processMsg(
    msg: ViewableDltMsg,
    curSeqOcc: SeqOccurrence<DltFilterType> | undefined,
    seqResult: FbSequenceResult,
    haveOccurrence: boolean,
    newOccurrence: (msg: ViewableDltMsg, step: SeqStep<DltFilterType>) => SeqOccurrence<DltFilterType>,
  ): [boolean, SeqOccurrence<DltFilterType> | undefined] {
    if (!haveOccurrence && !this.canCreateNew) {
      return [false, curSeqOcc]
    }
    if (this.filter.matches(msg)) {
      if (curSeqOcc === undefined) {
        // start a new sequence occurrence
        curSeqOcc = newOccurrence(msg, this)
      }

      // evaluate value: ok, warn, undefined, error
      const value = 'ok'

      // update overall step value as max of ... and keep the msg determining that value

      // get cur value: (here only FbEvent[])
      let curValues: FbFilterStepRes[] | undefined = curSeqOcc.stepsResult.get(this) as unknown as FbFilterStepRes[] | undefined
      if (curValues === undefined) {
        curSeqOcc.stepsResult.set(this, (curValues = []))
      }

      // check for sequence compliance?
      let errorText: string | undefined = undefined
      if (curSeqOcc.maxStepNr > this.stepNr) {
        errorText = `step #${this.stepPrefix}${this.stepNr} out of order (maxStepNr=${curSeqOcc.maxStepNr})`
      } else if (this.maxOcc !== undefined) {
        // check cardinality:
        const curOcc = curValues.length
        if (curOcc >= this.maxOcc) {
          // fail this step:
          curValues.push({ stepType: 'filter', step: this.jsonStep, res: this.eventFromMsg(msg, 'error') })
          curSeqOcc.failures.push(`step #${this.stepPrefix}${this.stepNr} exceeded max cardinality ${this.maxOcc}`)
          errorText = `step #${this.stepPrefix}${this.stepNr} exceeded max cardinality ${this.maxOcc}`
        }
      }

      // any captures?
      const captures =
        errorText === undefined && this.filter.payloadRegex ? getCaptures(this.filter.payloadRegex, msg.payloadString) : undefined
      if (captures !== undefined) {
        // fail this step with error if any capture with name "_..." has already been set with a different value
        for (const [key, value] of Object.entries(captures)) {
          const curCtxt = curSeqOcc.context.get(key)
          if (curCtxt !== undefined && curCtxt !== value) {
            if (key.startsWith('_')) {
              errorText = `step #${this.stepPrefix}${this.stepNr} context '${key}' already set with different value ('${curCtxt}' != '${value}')`
              break
            }
          }
          curSeqOcc.context.set(key, value)
        }
      }
      if (errorText !== undefined) {
        curValues.push({ stepType: 'filter', step: this.jsonStep, res: this.eventFromMsg(msg, 'error') })
        curSeqOcc.failures.push(errorText) // TODO... added the error text twice?
        // pass this msgs to new sequence occurrence
        if (this.canCreateNew) {
          curSeqOcc = newOccurrence(msg, this)
          const [newUpdated, newOcc] = this.processMsg(msg, curSeqOcc, seqResult, true, newOccurrence)
          if (newUpdated) {
            // in this case the log "...finished by ..." would be missing! TODO... move this log to here?
            curSeqOcc = newOcc
          }
        }
        return [true, curSeqOcc]
      }

      curValues.push({ stepType: 'filter', step: this.jsonStep, res: this.eventFromMsg(msg, value) })
      curSeqOcc.maxStepNr = Math.max(curSeqOcc.maxStepNr, this.stepNr) // max would not be necessary as we check upfront
      // not needed, Array updated in place... curSeqOcc.stepsResult.set(this, curValues)
      return [true, curSeqOcc] // updated curSeq
    }
    return [false, curSeqOcc] // neither match nor start a new seq
  }
}

// #region SeqStepSequence
class SeqStepSequence<DltFilterType extends IDltFilter> extends SeqStep<DltFilterType> {
  public sequence: Sequence<DltFilterType>

  constructor(
    stepPrefix: string,
    stepNr: number,
    jsonStep: FBSeqStep,
    DltFilterConstructor: new (json: any, allowEdits?: boolean) => DltFilterType,
  ) {
    super(stepPrefix, stepNr, jsonStep, DltFilterConstructor)
    if (typeof jsonStep.sequence !== 'object') {
      throw new Error(`SeqStep#${stepPrefix}${stepNr}: no sequence for step found! JSON=${JSON.stringify(jsonStep)}`)
    }
    this.sequence = new Sequence(stepPrefix.length > 0 ? `${stepPrefix}.${stepNr}.` : `${stepNr}.`, jsonStep.sequence, DltFilterConstructor)
  }

  isFinished(occurrence: SeqOccurrence<DltFilterType>): boolean {
    const lastResult = occurrence.stepsResult.get(this)
    return (
      lastResult !== undefined && lastResult.length > 0 && (lastResult[lastResult.length - 1] as SeqOccurrence<DltFilterType>).isFinished()
    )
  }

  allowsMoreMatches(occurrence: SeqOccurrence<DltFilterType>): boolean {
    const results = occurrence.stepsResult.get(this)
    if (this.maxOcc === undefined || results.length < this.maxOcc) {
      return true
    }
    if (results.length === this.maxOcc) {
      const lastSeqOcc = results[results.length - 1] as SeqOccurrence<DltFilterType>
      return !lastSeqOcc.isFinished()
    }
    return false
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
    haveOccurrence: boolean,
    newOccurrence: (msg: ViewableDltMsg, step: SeqStep<DltFilterType>) => SeqOccurrence<DltFilterType>,
  ): [boolean, SeqOccurrence<DltFilterType> | undefined] {
    if (!haveOccurrence && !this.canCreateNew) {
      return [false, curSeqOcc]
    }
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
        this.jsonStep,
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
        return [true, curSeqOcc]
      }

      if (curValues === undefined) {
        curSeqOcc.stepsResult.set(this, (curValues = []))
      }
      // curValues.push(newOcc)
      curSeqOcc.maxStepNr = Math.max(curSeqOcc.maxStepNr, this.stepNr) // max would not be necessary as we check upfront
      return [true, curSeqOcc]
    }

    return [false, curSeqOcc] // neither match nor start a new seq
  }
}

// #region Sequence
export class Sequence<DltFilterType extends IDltFilter> {
  public steps: SeqStep<DltFilterType>[] = []
  public failureFilters: [string, DltFilterType][]

  constructor(
    public stepPrefix: string,
    public jsonSeq: FBSequence,
    private DltFilterConstructor: new (json: any, allowEdits?: boolean) => DltFilterType,
  ) {
    if (!this.jsonSeq.name || typeof this.jsonSeq.name !== 'string') {
      throw new Error(`SeqChecker: no name for sequence found! JSON=${JSON.stringify(this.jsonSeq)}`)
    }
    // check for steps
    if (!this.jsonSeq.steps || !Array.isArray(this.jsonSeq.steps)) {
      throw new Error(`SeqChecker: steps not an array for sequence '${this.jsonSeq.name}'! JSON=${JSON.stringify(this.jsonSeq)}`)
    }
    for (const [idx, step] of this.jsonSeq.steps.entries()) {
      this.steps.push(newSeqStep(step, stepPrefix, idx + 1, DltFilterConstructor))
    }

    if (this.steps.length > 0 && !this.steps[0].canCreateNew) {
      throw new Error(`SeqChecker: start step for sequence '${this.jsonSeq.name}' must have attribute canCreateNew`)
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
    // select the next step to check for a match:
    // prefer "good" sequences
    // the problem is mainly for msgs that match multiple steps.
    // this is like regex matching and thus might be complex (e.g. m*m would match to m but is difficult to detect sequentially).
    // So do simple rules:
    // We want to support: mm (2 steps filter for m)
    // We want to support: m*nm <- depends on whether n was matched yet. e.g. mnm, mmnm, nm are ok.
    // m*ns <- should fail on mnms but mmns

    // so we start with:
    //  - last matched step if it allows for more matches
    //  - next step if the last matched step does not allow for more matches

    // if none matched yet, we start with the first step

    // determine the last matched step:
    let lastMatchedStep: number = -1
    if (startedSeqOccurrence !== undefined) {
      // find the last step that was matched
      lastMatchedStep = this.steps.findLastIndex((step) => startedSeqOccurrence.stepsResult.get(step) !== undefined)
    }
    if (lastMatchedStep >= 0) {
      // does this step allow for more matches?
      const lastMatchedStepObj = this.steps[lastMatchedStep]
      if (lastMatchedStepObj.allowsMoreMatches(startedSeqOccurrence) /* allowsMoreMatches(lastMatchedStepObj)*/) {
        // continue with this step
      } else {
        // next one
        if (lastMatchedStep < this.steps.length - 1) {
          lastMatchedStep += 1
        } else {
          // todo which one here? we start with the first one
          lastMatchedStep = 0
        }
      }
    }
    if (lastMatchedStep < 0) {
      lastMatchedStep = 0
    }

    const stepSearchArray =
      lastMatchedStep > 0 ? [...this.steps.slice(lastMatchedStep), ...this.steps.slice(0, lastMatchedStep)] : this.steps

    for (const step of stepSearchArray) {
      const [stepUpdated, newOcc] = step.processMsg(msg, startedSeqOccurrence, seqResult, startedSeqOccurrence !== undefined, newOccurrence)
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
        break // only one step per msg
      }
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
      this.jsonSeq,
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
