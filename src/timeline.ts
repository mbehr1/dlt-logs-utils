
/**
 * class that helps to construct the Timeline value format from
 * 
 * https://mbehr1.github.io/dlt-logs/docs/reports#tl_-format-details
 * 
 * @example return new TL('group', 'lane', matches[1])
 * // returns {TL_group_lane: matches[1]}
 * @example return new TL('group', 'lane', matches[1], {color: 'red'})
 * // returns {TL_group_lane: `${matches[1]||red}`}
 */
export class TL {
  [x: string]: any
  // will all be defined as non enumerable properties:
  //public tooltip?: string
  //public color?: string
  //public tlEnds?: boolean
  //public persistLcs?: boolean

  /**
   *
   * @param group name of the group. Invalid chars (_|,:;\/) will be removed
   * @param lane name of the lane. Invalid chars (|,:;\/) will be removed
   * @param value value to use for the lane
   * @param options additional options:
   * - tooltip: tooltip to use for the lane
   * - color: color to use for the lane, e.g. 'red' or '#ff0000'
   * - tlEnds: if true the value/timeline ends here.
   * - persistLcs: if true the timeline will not end at the end of the current lifecycle.
   * - lateEval: if true the value won't be returned but a an object with a y property that returns the value.
   *  This is useful if the value or color is not yet known at the time of the constructor call or might change later.
   */
  constructor(
    group: string,
    lane: string,
    value: string | number | undefined,
    options?: { tooltip?: string; color?: string; tlEnds?: boolean; persistLcs?: boolean; lateEval?: boolean },
  ) {
    const thisObj = this
    Object.defineProperties(thisObj, {
      group: { value: group.replaceAll(/[_|,:;\\\/]/g, ''), enumerable: false },
      lane: { value: lane.replaceAll(/[|,:;\\\/]/g, ''), enumerable: false },
      value: { value: value, enumerable: false, writable: true },
      tooltip: { value: options?.tooltip, enumerable: false, writable: true },
      color: { value: options?.color, enumerable: false, writable: true },
      tlEnds: { value: options?.tlEnds, enumerable: false, writable: true },
      persistLcs: { value: options?.persistLcs, enumerable: false, writable: true },
      [`TL_${group}_${lane}`]: {
        get: () =>
          options?.lateEval
            ? {
                get y() {
                  return thisObj.calculateY()
                },
              }
            : thisObj.calculateY(),
        enumerable: true,
      },
    })
  }

  calculateY(): string | number | undefined {
    const valueStr =
      this.value !== undefined ? (typeof this.value === 'number' ? `${this.value}` : `${this.value}`.replaceAll('|', ' ')).trim() : ''
    if (this.tooltip || this.color || this.tlEnds || this.persistLcs) {
      return `${valueStr}|${this.tooltip ? this.tooltip.replaceAll('|', ' ') : ''}${this.color ? '|' + this.color : ''}${
        this.tlEnds ? '|' : ''
      }${this.persistLcs ? '$' : ''}`
    } else {
      return this.value !== undefined ? (typeof this.value === 'number' ? this.value : valueStr) : undefined
    }
  }
}
