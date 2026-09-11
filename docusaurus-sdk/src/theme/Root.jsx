import React, { createContext, useContext, useMemo, useState } from "react";
import { TogglyProvider } from "@ops-ai/toggly-docusaurus-plugin/client";
import catalog from "../sample/catalog.cjs";
const WorkshopContext = createContext(null);
export const useWorkshop = () => useContext(WorkshopContext);
export default function Root({ children }) {
  // DefinePlugin supplies the same public configuration during SSR and in the
  // browser. A provider owns one immutable core client; identity changes remount
  // it instead of mutating a shared server or inventing a setContext API.
  const generated =
    typeof __TOGGLY_CONFIG__ === "undefined" ? {} : __TOGGLY_CONFIG__;
  const offline = !generated.appKey;
  const [preset, setPreset] = useState("matching");
  const [order, setOrder] = useState("vip");
  const [toggles, setToggles] = useState(() =>
    Object.fromEntries(catalog.demoKeys.map((k) => [k, true])),
  );
  const [safeDefaults, setSafeDefaults] = useState(false);
  const [entityFilter, setEntityFilter] = useState(null);
  const config = useMemo(
    () => ({
      ...generated,
      identity: catalog.users[preset].identity,
      featureFlagsRefreshInterval: 1000,
      flagDefaults:
        offline && !safeDefaults
          ? catalog.fixtureFlags(preset, toggles)
          : Object.fromEntries(catalog.allKeys.map((k) => [k, false])),
    }),
    [preset, toggles, safeDefaults],
  );
  const sessionKey = JSON.stringify([preset, toggles, safeDefaults]);
  const workshop = {
    offline,
    preset,
    setPreset,
    order,
    setOrder,
    toggles,
    setToggles,
    safeDefaults,
    setSafeDefaults,
    config,
    sessionKey,
    entityFilter,
    setEntityFilter,
  };
  return (
    <WorkshopContext.Provider value={workshop}>
      <TogglyProvider key={sessionKey} config={config}>
        {children}
      </TogglyProvider>
    </WorkshopContext.Provider>
  );
}
