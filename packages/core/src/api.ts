// @ts-expect-error
import postcssJs from 'postcss-js';
import hash from '@emotion/hash';
import deepMerge from 'deepmerge';
import postcss from 'postcss';
import dedent from 'dedent';

import { appendCss } from './adapter';

type PartialAlternateContract<T> = {
  [P in keyof T]?: T[P] extends Record<string | number, unknown>
    ? PartialAlternateContract<T[P]>
    : T[P];
};

type MapLeafNodes<Obj, LeafType> = {
  [Prop in keyof Obj]: Obj[Prop] extends object
    ? MapLeafNodes<Obj[Prop], LeafType>
    : LeafType;
};

type Primitive = string | number | boolean;
type WalkableValue = Primitive | WalkableObject | WalkableArray;
interface WalkableObject {
  [index: string]: WalkableValue;
  [index: number]: WalkableValue;
}
interface WalkableArray extends Array<WalkableValue> {}
type Walkable = WalkableObject | WalkableArray;

let refCounter = 0;
let fileScope = 'DEFAULT_FILE_SCOPE';

export function setFileScope(newFileScope: string) {
  refCounter = 0;
  fileScope = newFileScope;
}

function attachCssRule(selector: string, cssObj: any) {
  const { css } = postcss().process(cssObj, {
    parser: postcssJs,
    from: undefined,
  });

  const classDefinition = dedent`${selector} {
      ${css}
  }`;

  // console.log(classDefinition);

  appendCss(classDefinition);
}

const createFileScopeIdent = () => {
  // return `${hash(fileScope)}${refCounter++}`;

  return `${fileScope}_${refCounter++}`;
};

const walkObject = <T extends Walkable, MapTo>(
  obj: T,
  fn: (value: Primitive, path: string) => MapTo,
  path: Array<string> = [],
): MapLeafNodes<T, MapTo> => {
  const clone = obj.constructor();

  for (let key in obj) {
    const value = obj[key];
    const currentPath = [...path, key];

    if (typeof value === 'object') {
      clone[key] = value ? walkObject(value, fn, currentPath) : value;
    } else {
      clone[key] = fn(value, currentPath.join('-'));
    }
  }

  return clone;
};

const hashToClassName = (h: string) => (/^[0-9]/.test(h[0]) ? `_${h}` : h);

export function style(css: any) {
  const styleRuleName = hashToClassName(createFileScopeIdent());

  attachCssRule(`.${styleRuleName}`, css);

  return styleRuleName;
}

export function defineVars<VarContract extends Walkable>(
  varContract: VarContract,
) {
  const varContractHash = createFileScopeIdent();
  const rootVarsClassName = hashToClassName(varContractHash);
  const cssVars: { [cssVarName: string]: Primitive } = {};

  const vars = walkObject(varContract, (value, path) => {
    const cssVarName = `--${hash(varContractHash + path)}`;

    cssVars[cssVarName] = value;

    return `var(${cssVarName})`;
  });

  attachCssRule(`:root, .${rootVarsClassName}`, cssVars);

  return {
    className: rootVarsClassName,
    vars,
    alternate: <AltVarContract extends PartialAlternateContract<VarContract>>(
      altVarContract: AltVarContract,
    ) => {
      // @ts-expect-error // Revisit types here, maybe even library itself
      const mergedContract = deepMerge(varContract, altVarContract);
      const altVarContractHash = createFileScopeIdent();
      const altVarsClassName = hashToClassName(altVarContractHash);
      const altCssVars: { [cssVarName: string]: Primitive } = {};

      /* TODO 
        - validate new variables arn't set
        - validate arrays have the same length as contract
      */
      walkObject(mergedContract, (value, path) => {
        const cssVarName = `--${hash(varContractHash + path)}`;

        altCssVars[cssVarName] = value;
      });

      attachCssRule(`.${altVarsClassName}`, altCssVars);

      return altVarsClassName;
    },
  };
}
