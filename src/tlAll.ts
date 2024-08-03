/**
 * class that helps to construct the Timeline value format for
 * multiple state values.
 *
 * It reports ok/green if all values are ok/true else it reports error/red.
 * Supports "unknown" values in gray.
 *
 */
export class TLAll {
  [x: string]: any

  constructor(
    group: string,
    lane: string,
    values: ITLState[],
    stateToColorMap: Map<string | undefined, string>,
    options?: { tlEnds?: boolean; persistLcs?: boolean },
  ) {
    const thisObj = this
    // we ensure that undefined is part for the state/color map (and preferrably 2nd last)
    const stateToIdxColorMap = new Map<string | undefined, [number, string]>()

    if (stateToColorMap.size === 0) {
      stateToIdxColorMap.set(undefined, [0, 'grey'])
    } else {
      const needsUndefinedIdx = stateToColorMap.has(undefined) ? -1 : stateToColorMap.size - 1
      let idx = 0
      for (const [state, color] of stateToColorMap) {
        if (needsUndefinedIdx == idx) {
          stateToIdxColorMap.set(undefined, [idx, 'grey'])
          idx++
        }
        stateToIdxColorMap.set(state, [idx, color])
        idx++
      }
    }

    // todo use decorators for nonenumerable instead?
    Object.defineProperties(thisObj, {
      values: { value: values, enumerable: false },
      stateToIdxColorMap: { value: stateToIdxColorMap, enumerable: false },
      group: { value: group.replaceAll(/[_|,:;\\\/]/g, ''), enumerable: false },
      lane: { value: lane.replaceAll(/[|,:;\\\/]/g, ''), enumerable: false },
      tlEnds: { value: !!options?.tlEnds, enumerable: false, writable: true },
      persistLcs: { value: !!options?.persistLcs, enumerable: false, writable: true },
      lastLcsThatUpdated: { value: new Map<string, any>(), enumerable: false, writable: false },
      [`TL_${group}_${lane}`]: {
        get: () => thisObj.calculateY(),
        enumerable: true,
      },
    })
  }

  calculateY(): string | undefined {
    // as overall value we use the smallest index used from the colorMap, default to the index from the last one

    const valueIdx = this.values.reduce(
      (acc, value) => Math.min(acc, this.stateToIdxColorMap.get(value.v)?.[0] ?? this.stateToIdxColorMap.get(undefined)[0]),
      this.stateToIdxColorMap.size - 1,
    )
    let allColor = 'grey'
    let allState = 'unknown'
    for (const [state, [idx, color]] of this.stateToIdxColorMap) {
      if (idx === valueIdx) {
        allColor = color
        if (state) allState = state // avoid undefined
        break
      }
    }

    // we generate a html list for the tooltip with the states for each value

    // css classes used:
    // tl = timeline
    // tt = tooltip
    // sl = state light

    // styles used:
    // --sc : state color
    const tooltip =
      `<ul class="tl tt">` +
      this.values
        .map((value) => {
          const [idx, color] = this.stateToIdxColorMap.get(value.v) || this.stateToIdxColorMap.get(undefined)
          const state = value.v !== undefined ? value.v : 'unknown'
          // todo put value.n, state and value.t in a div/sep class?
          return `<li><div class="sl" style="--sc:${color}"></div>${escapedText(value.n)} = ${escapedText(state)}${
            value.t ? ' / ' + escapedText(value.t) : ''
          }</li>`
        })
        .join('') +
      `</ul>`
    if (tooltip || allColor || this.tlEnds || this.persistLcs) {
      return `${escapedText(allState)}|${tooltip.replaceAll('|', ' ')}${'|' + allColor}${this.tlEnds ? '|' : ''}${
        this.persistLcs ? '$' : ''
      }`
    } else {
      return escapedText(allState)
    }
  }

  /**
   * Updates all values in the collection based on the provided matches and parameters.
   *
   * @param matches - The regular expression matches.
   * @param params - The parameters for the update.
   * @returns True if any value was updated or if peristLcs is false and a new lifecycle is detected, false otherwise.
   */
  update(matches: RegExpMatchArray, params: Params) {
    let anyUpdated = false
    for (const value of this.values) {
      if (value.update(matches, params)) anyUpdated = true
    }
    if (!this.persistLcs) {
      if (anyUpdated) {
        // we store the lifecycle per ecu that lead to an update
        if (params.msg) {
          this.lastLcsThatUpdated.set(params.msg.ecu, params.msg.lifecycle)
        }
      } else {
        // we check if a new lifecycle is detected
        if (params.msg) {
          const lastLcs = this.lastLcsThatUpdated.get(params.msg.ecu)
          if (lastLcs !== params.msg.lifecycle) {
            this.lastLcsThatUpdated.set(params.msg.ecu, params.msg.lifecycle)
            anyUpdated = true
          }
        }
      }
    }
    return anyUpdated
  }

  tlCopy() {
    return {
      [`TL_${this.group}_${this.lane}`]: this.calculateY(), // or other attr as well?
    }
  }
}

function escapedText(text: string): string {
  if (typeof text !== 'string') {
    return `text(${JSON.stringify(text)}) is not a string but a '${typeof text}'`
  }
  return text.replace(
    /[&<>"|]/g,
    (match) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        '|': '&vert;',
      }[match]),
  )
}

export const TLStateColorMap3S = new Map([
  ['error', 'red'],
  ['warning', 'yellow'],
  [undefined, 'gray'],
  ['ok', 'green'],
])

interface ITLState {
  n: string // name
  t?: string // tooltip
  v: string | undefined

  update(matches: RegExpMatchArray, params: Params): boolean
}

/**
 * The TLState class represents a state with a name, an optional tooltip, and a value.
 * It includes a method to update its value based on a mapping function and regular expression matches.
 * @implements {ITLState}
 */
export class TLState implements ITLState {
  n: string // name
  t?: string // tooltip
  v: string | undefined
  mf: (matches: RegExpMatchArray, params: Params) => string | undefined

  constructor(name: string, mapFn: (matches: RegExpMatchArray, params: Params) => string | undefined, tooltip?: string, value?: string) {
    this.n = name
    this.mf = mapFn
    this.t = tooltip
    this.v = value
  }

  update(matches: RegExpMatchArray, params: Params): boolean {
    const mapped_new_v = this.mf(matches, params)
    if (this.v === mapped_new_v) return false
    this.v = mapped_new_v
    return true
  }
}

/**
 * Represents a state that is updated based on a named group in a regular expression.
 * @implements {ITLState}
 */
export class TLStRegExpNamedGroup implements ITLState {
  n: string // name
  t?: string // tooltip
  v: string | undefined
  mf: (v: string) => string | undefined

  constructor(name: string, mapFn: (v: string) => string | undefined, tooltip?: string, value?: string) {
    this.n = name
    this.mf = mapFn
    this.t = tooltip
    this.v = value
  }

  update(matches: RegExpMatchArray, params: Params): boolean {
    const new_v = matches.groups?.[this.n]
    if (new_v === undefined) return false
    const mapped_new_v = this.mf(new_v)
    if (this.v === mapped_new_v) return false
    this.v = mapped_new_v
    return true
  }
}

/**
 * Represents a state that is updated based on the nth(=idx) capture group.
 * @implements {ITLState}
 */
export class TLStRegExpIdxGroup implements ITLState {
  private mIdx: number
  n: string // name
  t?: string // tooltip
  v: string | undefined
  mf: (v: string) => string | undefined

  constructor(matchIdx: number, name: string, mapFn: (v: string) => string | undefined, tooltip?: string, value?: string) {
    this.mIdx = matchIdx
    this.n = name
    this.mf = mapFn
    this.t = tooltip
    this.v = value
  }

  update(matches: RegExpMatchArray, params: Params): boolean {
    const new_v = matches?.length > this.mIdx ? matches[this.mIdx] : undefined
    if (new_v === undefined) return false
    const mapped_new_v = this.mf(new_v)
    if (this.v === mapped_new_v) return false
    this.v = mapped_new_v
    return true
  }
}

/**
 * function that manages a map for TL objects as singletons
 * @param where - to use the Map: '_tlMap' e.g. params.reportObj or params.localObj
 * @param group - group name
 * @param lane - lane name
 * @param createFn - function that creates the TL object
 * @returns the TL object from the map or from createFn and added to the map
 */
export function tlGetOrCreate<T>(where: Record<string, any>, group: string, lane: string, createFn: () => T): T {
  const tlMap = where._tlMap || (where._tlMap = new Map())
  const key = `${group}_${lane}`
  return tlMap.get(key) || tlMap.set(key, createFn()).get(key)
}

interface Message {
  timeStamp: number
  ecu: string
  apid: string
  ctid: string
  payloadString: string
  lifecycle: number
}

export interface Params {
  reportObj: Record<string, any>
  localObj: Record<string, any>
  msg: Message
}

/**
 * Calculates the TL (Timeline) for multiple states.
 * The overall state reflected is the worst state of all states.
 * This can be used to e.g. check for a set of pre-conditions. Only if all pre-condition states are ok, the overall state is ok.
 *
 * It creates a single TLAll instance for each group/lane combination. This TLAll instance aggregates the states of all values
 * and debounces the update of the TL value to only happen on changes.
 *
 * @param matches - The regular expression match array.
 * @param params - The parameters object. By default the reportObj from params is used to store the TLAll object.
 * @param group - group name to use
 * @param lane - lane name to use
 * @param values - A function that returns an array of ITLState objects. The function is only called on the first invocation for that group/lane.
 * @param stateToColorMap - A function that returns a map of state to color values. The function is only called on the first invocation for that group/lane.
 * @param options - An optional object containing additional options. The options are only used on first invocation.
 * @param options.tlEnds - An optional boolean indicating whether the TL ends after every match/change. Default is false.
 * @param options.persistLcs - An option boolean indicating whether to persist LCs. Default is to end with each lifecycle.
 * @param options.useLocalObj - An optional boolean indicating whether to use the params.localObj, i.e. whether the TLAll object is local only for the single filter. Default is false (use the report object).
 * @returns The TL (Timeline) on first use and on every change. Otherwise an empty object.
 */
export function tlAll(
  matches: RegExpMatchArray,
  params: Params,
  group: string,
  lane: string,
  values: () => ITLState[],
  stateToColorMap: () => Map<string | undefined, string>,
  options?: { tlEnds?: boolean; persistLcs?: boolean; useLocalObj?: boolean },
): Record<string, string> | {} {
  if (!params || !params.reportObj || !params.localObj) {
    return { TL_tlAll_err: `params invalid: '${JSON.stringify(params)}'` }
  }

  let wasCreated = false
  const tl = tlGetOrCreate(options?.useLocalObj ? params.localObj : params.reportObj, group, lane, () => {
    wasCreated = true
    return new TLAll(group, lane, values(), stateToColorMap(), options)
  })
  return tl.update(matches, params) || wasCreated ? tl.tlCopy() : {}
}
