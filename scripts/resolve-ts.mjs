/**
 * Local TS loader: Node 24 runs .ts with type stripping but requires explicit
 * extensions; this hook appends .ts to extensionless relative imports so the
 * kernel/prefab verification scripts run without a bundler.
 */
export async function resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('./') || specifier.startsWith('../')) {
        try {
            return await nextResolve(specifier, context)
        } catch (err) {
            if (err && err.code === 'ERR_MODULE_NOT_FOUND' && !specifier.endsWith('.ts')) {
                return nextResolve(specifier + '.ts', context)
            }
            throw err
        }
    }
    return nextResolve(specifier, context)
}
