const stub = new URL('./marketing-test-ui.mjs', import.meta.url).href;
export async function resolve(specifier, context, next) {
  if (['@brightweblabs/ui', '@brightweblabs/app-shell', 'sonner'].includes(specifier)
    || (specifier === './context' && context.parentURL?.includes('/module-marketing/src/ui/'))
    || (context.parentURL?.endsWith('/marketing-client.tsx') && ['./segment-workspace', './workflow-workspace', './topic-workspace', './analytics-workspace'].includes(specifier))) {
    return { url: stub, shortCircuit: true };
  }
  return next(specifier, context);
}
