import fs from "node:fs";
import { fileURLToPath } from "node:url";

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import importPlugin from "eslint-plugin-import";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

function pathExists(relativePath) {
  return fs.existsSync(new URL(relativePath, import.meta.url));
}

function existingPaths(relativePaths) {
  return relativePaths.filter(pathExists);
}

function getSliceNames(layer) {
  const layerDirectory = new URL(`src/${layer}/`, import.meta.url);

  if (!fs.existsSync(layerDirectory)) {
    return [];
  }

  return fs
    .readdirSync(layerDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort();
}

function createSiblingSliceZones(layer, message) {
  return getSliceNames(layer).map((sliceName) => ({
    target: `./src/${layer}/${sliceName}`,
    from: `./src/${layer}`,
    except: [`./${sliceName}`],
    message,
  }));
}

const boundaryZones = [
  {
    target: "./src",
    from: "./app",
    message:
      "Code under src/ must stay independent from the Next.js app router shell. Move shared code downward into src/shared or compose it from app/ instead.",
  },
  {
    target: "./app",
    from: existingPaths([
      "./src/entities",
      "./src/features",
      "./src/widgets",
    ]),
    message:
      "The app router layer should stay thin. Import route screens from src/views or cross-app helpers from src/shared instead of reaching directly into entities, features, or widgets.",
  },
  {
    target: "./app/api",
    from: "./src",
    message:
      "REST handlers must stay separate from UI slices. Keep app/api on application, contracts, auth, db runtime, and app/api/_lib boundaries instead of importing from src/.",
  },
  {
    target: "./src/shared",
    from: existingPaths([
      "./src/entities",
      "./src/features",
      "./src/widgets",
      "./src/views",
    ]),
    message:
      "src/shared is the bottom layer. Move shared code downward instead of importing from entities, features, widgets, or views.",
  },
  {
    target: "./src/entities",
    from: existingPaths([
      "./src/features",
      "./src/widgets",
      "./src/views",
    ]),
    message:
      "Entity slices must stay independent from feature, widget, and view layers. Move reusable domain code downward or compose it one layer up.",
  },
  {
    target: "./src/features",
    from: existingPaths(["./src/widgets", "./src/views"]),
    message:
      "Feature slices must not depend on widgets or views. Compose features from views/widgets instead of reaching upward.",
  },
  {
    target: "./src/widgets",
    from: existingPaths(["./src/views"]),
    message:
      "Widgets are screen sections, not pages. Move shared screen composition up into src/views instead of importing a view from a widget.",
  },
  ...createSiblingSliceZones(
    "entities",
    "Sibling entity slices should not import each other directly. Move shared domain logic down to src/shared or compose entities one layer up.",
  ),
  ...createSiblingSliceZones(
    "features",
    "Sibling feature slices should not import each other directly. Share code downward or compose them from a widget or view instead.",
  ),
  ...createSiblingSliceZones(
    "widgets",
    "Sibling widget slices should not import each other directly. Compose screen sections from src/views instead of wiring widgets sideways.",
  ),
  ...createSiblingSliceZones(
    "views",
    "Sibling view slices should stay independent. Share code downward or compose routing concerns from app/ instead of importing another view.",
  ),
].filter((zone) => {
  if (Array.isArray(zone.from)) {
    return zone.from.length > 0;
  }

  return true;
});

const srcWorkspacePackageRestrictions = [
  {
    group: ["@dabrowskiego/application", "@dabrowskiego/application/*"],
    message:
      "UI slices should talk to backend logic through REST/contracts, not application services directly.",
  },
  {
    group: ["@dabrowskiego/auth", "@dabrowskiego/auth/*"],
    message:
      "UI slices should use shared auth clients/providers instead of importing Better Auth server helpers directly.",
  },
  {
    group: ["@dabrowskiego/db", "@dabrowskiego/db/*"],
    message:
      "UI slices must not reach into the database package. Read data through REST contracts only.",
  },
  {
    group: ["@dabrowskiego/sync", "@dabrowskiego/sync/*"],
    message:
      "UI slices should not import sync internals. Surface sync state through application and contract layers.",
  },
  {
    group: ["@dabrowskiego/vault", "@dabrowskiego/vault/*"],
    message:
      "UI slices must not read local-first vault internals directly. Use app-facing contracts instead.",
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["app/**/*.{ts,tsx}", "src/**/*.{ts,tsx}"],
    plugins: {
      import: importPlugin,
    },
    settings: {
      "import/resolver": {
        typescript: {
          project: "./tsconfig.json",
        },
      },
    },
    rules: {
      "import/no-restricted-paths": [
        "error",
        {
          basePath: projectRoot,
          zones: boundaryZones,
        },
      ],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: srcWorkspacePackageRestrictions,
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
