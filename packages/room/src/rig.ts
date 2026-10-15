/** Drops `rig` unless the worker is running with DEV_RIG=1. A client seed is never read here. */
export function stripRig(config: unknown, devRig: boolean): unknown {
  if (devRig || typeof config !== 'object' || config === null || Array.isArray(config)) return config
  if (!('rig' in config)) return config
  const rest = { ...(config as Record<string, unknown>) }
  delete rest.rig
  return rest
}
