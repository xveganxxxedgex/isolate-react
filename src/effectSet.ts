type Effect = () => void | Function

type EffectState = {
  effect: Effect
  deps?: any[]
  dirty: boolean
  cleanup?: Function | void
}

type Deps = any[] | undefined

export const createEffectSet = () => {
  let effects: EffectState[] = []
  let nextEffects: EffectState[] = []

  const dirtyDeps = (a: Deps, b: Deps) => {
    if (a === undefined || b === undefined) return true
    if (a === [] && b === []) return false
    return a.some((value, i) => !Object.is(value, b[i]))
  }

  const flush = () => {
    const dirtyEffects = nextEffects.filter((e) => e.dirty)
    dirtyEffects.forEach((e) => {
      if (e.cleanup) e.cleanup()
      e.cleanup = e.effect()
    })

    effects = nextEffects
  }

  return {
    cleanup: () => {
      effects.forEach((effect) => {
        if (typeof effect.cleanup === 'function') {
          effect.cleanup()
        }
      })
    },
    flush,
    nextEffect: (effect: Effect, deps: Deps) => {
      const firstTime = !effects.length

      const nextEffect: EffectState = { effect, deps, dirty: firstTime }

      if (!firstTime) {
        const existing = effects.shift()
        nextEffect.dirty = dirtyDeps(existing.deps, deps)
        nextEffect.cleanup = existing.cleanup
      }

      nextEffects.push(nextEffect)
      return
    },
  }
}
