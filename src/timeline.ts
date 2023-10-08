
export class TL {
  [x: string]: any
  // will all be defined as non enumerable properties:
  //public tooltip?: string
  //public color?: string
  //public tlEnds?: boolean
  //public persistLcs?: boolean

  constructor(
    group: string,
    lane: string,
    value: string | number | undefined,
    options?: { tooltip?: string; color?: string; tlEnds?: boolean; persistLcs?: boolean; lateEval?: boolean },
  ) {
    const thisObj = this
    Object.defineProperties(thisObj, {
      group: { value: group, enumerable: false },
      lane: { value: lane, enumerable: false },
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
