const CANDIDATE_SUFFIXES = [".ts", ".tsx", "/index.ts", "/index.tsx"];

export async function load(url, context, defaultLoad) {
  if (!url.endsWith(".tsx")) return defaultLoad(url, context, defaultLoad);
  const [{ readFile }, ts] = await Promise.all([import("node:fs/promises"), import("typescript")]);
  const source = await readFile(new URL(url), "utf8");
  return {
    format: "module",
    shortCircuit: true,
    source: ts.transpileModule(source, {
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
      fileName: new URL(url).pathname,
    }).outputText,
  };
}

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
    if (specifier.startsWith("next/") && !specifier.endsWith(".js")) {
      return defaultResolve(`${specifier}.js`, context, defaultResolve);
    }
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
