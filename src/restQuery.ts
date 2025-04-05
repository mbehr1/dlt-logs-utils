export interface RQCmd {
  cmd: string // must not contain any non valid URI strings!
  param: string // string only. e.g. objects,.. .need to be json encoded. can contain special chars
}

export interface RQ {
  path: string
  commands: RQCmd[]
}

export const rqUriDecode = (rq: string): RQ => {
  const res: RQ = {
    path: '',
    commands: [],
  }
  if (!rq || rq.length === 0) {
    return res
  }

  const indexOfQ = rq?.indexOf('?')
  if (indexOfQ > 0) {
    res.path = rq.slice(0, indexOfQ + 1)

    const options = rq.slice(indexOfQ + 1)
    const optionArr = options.split('&')
    for (const commandStr of optionArr) {
      const eqIdx = commandStr.indexOf('=')
      const command = commandStr.slice(0, eqIdx)
      const commandParams = decodeURIComponent(commandStr.slice(eqIdx + 1))
      res.commands.push({ cmd: command, param: commandParams })
    }
  } else {
    res.path = rq
  }

  return res
}

export const rqUriEncode = (rq: RQ): string => {
  let toRet = rq.path
  if (rq.commands.length > 0) {
    if (!toRet.endsWith('?')) {
      toRet += '?'
    }
    toRet += rq.commands.map((rqCmd) => rqCmd.cmd + '=' + encodeURIComponent(rqCmd.param)).join('&')
  }
  return toRet
}

// #region attributes support
export type AttributesValue = string | number | (string | number)[] | undefined

type OwnJSONParser = { parse: (text: string) => any; stringify: (obj: any) => string }

/**
 * Replace any ${attributes.<attribute>} with the value of the attribute inplace.
 * It e.g. removes keys if the attribute is not found/undefined!
 * @param rq - the rest query object to be modified. Checked for commands 'report','query' and 'filter'
 * @param getAttr - Function to get the attribute value. Will be called with the attributeName part of ${attributes.<attributeName>}
 * @param jsonParser e.g. JSON5 or JSON depending on whether e.g. jsonc should be supported as well.
 */
export const substAttributes = (rq: RQ, getAttr: (attr: string) => AttributesValue, jsonParser: OwnJSONParser) => {
  for (const cmd of rq.commands) {
    switch (cmd.cmd) {
      case 'report':
      case 'filter':
      case 'query':
        {
          const param = jsonParser.parse(cmd.param)
          if (Array.isArray(param)) {
            const doChange = substFilterAttributes(param, getAttr)
            if (doChange) {
              cmd.param = jsonParser.stringify(param)
            }
          }
        }
        break
    }
  }
}

/**
 * Replace any ${attributes.<attributeName>} with the value of the attribute inplace.
 * It e.g. removes keys if the attribute is not found/undefined!
 * @param filters - Array of objects (e.g. filters). From those the direct keys are checked to start with `${attributes.` and needs to end with '}'
 * @param getAttr - Function to get the attribute value. Will be called with the attributeName part of ${attributes.<attributeName>}
 * @returns - boolean - true if any attribute was replaced
 */
export const substFilterAttributes = (filters: any[], getAttr: (attr: string) => AttributesValue) => {
  let didChange = false
  for (const filter of filters) {
    Object.keys(filter).forEach((key) => {
      if (typeof filter[key] === 'string' && filter[key].startsWith('${attributes.')) {
        const attribute = filter[key].slice(13, -1) // remove ${attributes. and }
        const attrVal = getAttr(attribute)
        if (attrVal !== undefined) {
          filter[key] = attrVal
        } else {
          // remove key:
          delete filter[key]
        }
        didChange = true
      }
    })
  }
  return didChange
}

// #region fishbone attributes
// definition in fishbones... re-copied to here to avoid importing the whole
// TODO: refactor into a fishbone-utils package
interface FBAttribute {
  fbUid?: string
  [name: string]:
    | {
        label?: string
        type?: string
        value?: any
        dataProvider?: {
          jsonPath: string
          source: string
        }
      }
    | string // for fbUid only
}

/**
 * Get an attribute by name or name.member from the fishbone attributes.
 *
 * The attribute can be a single value or an array of values.
 * @param fbaAttrs - the attributes from the fishbone
 * @param attribute - the arribute name to be searched for. Can be a member e.g. lifecycles.id or just the attribute name like ecu
 * @returns - the attribute value or undefined if not found
 */
export const getAttributeFromFba = (fbaAttrs: FBAttribute[], attribute: string): AttributesValue => {
  if (Array.isArray(fbaAttrs)) {
    // iterate over all attributes and check if the attribute is in there
    // it can be attributename.member e.g. lifecycles.id or attributename like ecu
    // the attribute value can be a single string/value or an array with string/values
    // for ecu usually value is just a single member (string)
    // for lifecycles value is an array of objects with id (number), label,...
    const [attrName, attrMember] = attribute.split('.')

    for (const attr of fbaAttrs) {
      if (typeof attr === 'object' && attrName in attr) {
        // check if the attribute is in the object
        const attrNameObj = attr[attrName]
        const attrVal = attrNameObj && typeof attrNameObj === 'object' && attrNameObj?.value
        if (attrVal === undefined) {
          return undefined
        }
        if (attrMember) {
          // check if the attribute is in the object/array
          if (Array.isArray(attrVal)) {
            // check if the attribute is in the array
            if (attrVal.length === 0) {
              return attrVal
            }

            const attrMemberVals = attrVal.map((e: any) => e?.[attrMember])
            const toRet =
              attrMemberVals.length > 0
                ? typeof attrMemberVals[0] === 'string' || typeof attrMemberVals[0] === 'number'
                  ? (attrMemberVals as (string | number)[])
                  : undefined
                : []
            return toRet
          } else {
            // expect a single object with key attrMember
            const attrMemberVal = typeof attrVal === 'object' ? attrVal?.[attrMember] : undefined
            return typeof attrMemberVal === 'string' || typeof attrMemberVal === 'number' ? attrMemberVal : undefined
          }
        } else {
          let toRet
          if (Array.isArray(attrVal)) {
            toRet =
              attrVal.length > 0
                ? typeof attrVal[0] === 'string' || typeof attrVal[0] === 'number'
                  ? (attrVal as (string | number)[])
                  : undefined
                : []
          } else {
            toRet = typeof attrVal === 'string' || typeof attrVal === 'number' ? attrVal : undefined
          }
          return toRet
        }
      }
    }
  }
  return undefined
}
