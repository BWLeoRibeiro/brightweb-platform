const CANDIDATE_SUFFIXES = [".ts", ".tsx", "/index.ts", "/index.tsx"];

export async function resolve(specifier, context, defaultResolve) {
  if (specifier === "server-only") {
    return {
      shortCircuit: true,
      url: "data:text/javascript,export default undefined;",
    };
  }

  if (specifier === "next/headers") {
    return {
      shortCircuit: true,
      url: "data:text/javascript,export async function cookies(){return {getAll(){return []},set(){},setAll(){}}};",
    };
  }

  try {
    return await defaultResolve(specifier, context, defaultResolve);
  } catch (error) {
    if (!shouldTryTypeScriptResolution(specifier)) {
      throw error;
    }

    for (const suffix of CANDIDATE_SUFFIXES) {
      try {
        return await defaultResolve(`${specifier}${suffix}`, context, defaultResolve);
      } catch {
        continue;
      }
    }

    throw error;
  }
}

function shouldTryTypeScriptResolution(specifier) {
  return (
    (specifier.startsWith("./") || specifier.startsWith("../"))
    && !specifier.endsWith(".js")
    && !specifier.endsWith(".mjs")
    && !specifier.endsWith(".cjs")
    && !specifier.endsWith(".ts")
    && !specifier.endsWith(".tsx")
    && !specifier.endsWith(".json")
  );
}
