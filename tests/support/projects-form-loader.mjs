const stub = new URL('./projects-form-ui.mjs', import.meta.url).href;
export async function resolve(specifier, context, next) {
  if (['@brightweblabs/ui','@brightweblabs/app-shell','sonner','next/navigation'].includes(specifier) || /shared\/(app-sheet|project-calendar)$/.test(specifier)) return {url:stub,shortCircuit:true};
  return next(specifier,context);
}
