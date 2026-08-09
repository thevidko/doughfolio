import type en from "./en.json";

/**
 * Typed translation keys: `t("setup.welcome.title")` autocompletes and typos
 * fail the typecheck. The English catalog is the source of truth; `cs.json`
 * must mirror its key structure.
 */
declare module "i18next" {
  // Declaration merging into i18next's options requires an interface.
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: { translation: typeof en };
  }
}
