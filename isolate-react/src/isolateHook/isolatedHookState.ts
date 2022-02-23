import { createEffectSet } from './effectSet'
import { IsolatedHookOptions } from './types/IsolatedHookOptions'
export type IsolatedHookState = ReturnType<typeof createIsolatedHookState>

type HookState<T> = [{ value: T }, (value: (previous: T) => T) => void]
interface HookStateDef<T> {
  type: StateType
  create: () => T
  update?: (
    current: T,
    next: any
  ) => {
    value: T
  }
}

type StateType =
  | 'useRef'
  | 'useState'
  | 'useMemo'
  | 'useCallback'
  | 'useReducer'

export const createIsolatedHookState = (options: IsolatedHookOptions) => {
  let dirty = false
  let first = true

  let hookStates: any[] = []
  let nextHookStates: any[] = []
  let usedContextTypes = new Set<React.Context<any>>()

  const context = new Map<React.Context<any>, any>()

  const layoutEffects = createEffectSet()
  const effects = createEffectSet()

  if (options.context) {
    options.context.forEach((c) => {
      context.set(c.type, c.value)
    })
  }

  let onUpdated = () => {}

  const addHookState = <T>(
    type: StateType,
    value: T,
    updateValue?: any
  ): HookState<T> => {
    let newState = { value, type }

    const updater = updateValue
      ? (next: any) => {
          const updateResult = updateValue(newState.value, next)

          newState.value = updateResult.value

          dirty = true
          onUpdated()
        }
      : () => {
          throw new Error(`Could not update ${type}`)
        }

    const state = [newState, updater] as HookState<T>

    nextHookStates.push(state)

    return state
  }

  const nextHookState = <T>({
    type,
    create,
    update,
  }: HookStateDef<T>): HookState<T> => {
    if (first) return addHookState(type, create(), update)
    let state = hookStates.shift()
    nextHookStates.push(state)
    return state
  }

  const endPass = () => {
    dirty = false
    first = false

    layoutEffects.flush()
    effects.flush()

    hookStates = nextHookStates
  }

  const setRef = (index: number, value: any) => {
    const refs = hookStates.filter(([s]) => s.type === 'useRef')
    refs[index][0].value.current = value
  }

  const contextValue = (type: React.Context<any>) =>
    context.has(type) ? context.get(type) : (type as any)._currentValue

  const setContext = (contextType: React.Context<any>, value: any) => {
    if (contextValue(contextType) === value) return
    context.set(contextType, value)
    if (usedContextTypes.has(contextType)) {
      onUpdated()
    }
  }

  return {
    layoutEffects,
    effects,
    endPass,
    nextHookState,
    setContext,
    setRef,
    firstPass: () => first,
    dirty: () => dirty,
    onUpdated: (handler: () => void) => {
      onUpdated = handler
    },
    cleanup: () => {
      layoutEffects.cleanup()
      effects.cleanup()
    },
    contextValue: (contextType: React.Context<any>) => {
      usedContextTypes.add(contextType)
      return contextValue(contextType)
    },
  }
}

export default createIsolatedHookState
