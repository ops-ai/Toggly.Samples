import React, { useEffect, useMemo, useState } from "react";
import { createTogglyClient } from "@ops-ai/toggly-client-core";
import { useWorkshop } from "../theme/Root";
import catalog from "../sample/catalog.cjs";
export default function OrderContext() {
  const { config, offline, order, setOrder, safeDefaults, setEntityFilter } =
    useWorkshop();
  const client = useMemo(() => {
    // This is the real independent core registry, not an unrelated JS SDK.
    // The browser binding's getFlag omits entity arguments, so entity checks
    // use native core with its own client and complete canonical Order mapper.
    const core = createTogglyClient({
      ...config,
      flagDefaults:
        offline && !safeDefaults
          ? {
              ...config.flagDefaults,
              ExpressCheckout: catalog.orderGate,
              "filter-context-property": catalog.orderGate,
            }
          : config.flagDefaults,
    });
    catalog.registerOrder(core);
    return core;
  }, [config]);
  const [enabled, setEnabled] = useState(null);
  useEffect(() => {
    let active = true,
      revision = 0;
    const read = async () => {
      const current = ++revision;
      // The first read fills this client's cache; the next reads the same
      // snapshot without starting a duplicate initial request.
      const value = await client.getFlag(
        "ExpressCheckout",
        false,
        catalog.orders[order],
        "Order",
      );
      if (!active) return;
      const filter = await client.getFlag(
        "filter-context-property",
        false,
        catalog.orders[order],
        "Order",
      );
      if (active && current === revision) {
        setEnabled(value);
        setEntityFilter({ value: filter, order, identity: config.identity });
      }
    };
    setEnabled(null);
    read();
    // Core exposes no refresh event. Poll its cache and ignore late completion
    // when the Order/session changes or this component unmounts.
    const timer = setInterval(read, 1000);
    client.startWebSocket();
    return () => {
      active = false;
      ++revision;
      clearInterval(timer);
      client.stopWebSocket();
    };
  }, [client, order]);
  return (
    <section className="panel" id="order">
      <h2>05 · Same user. Different Order.</h2>
      <p>
        Order attributes travel with this evaluation. They do not change
        identity or upload a dashboard schema.
      </p>
      <div className="row">
        <button onClick={() => setOrder("vip")}>VIP Order</button>
        <button onClick={() => setOrder("standard")}>Standard Order</button>
      </div>
      <pre>{JSON.stringify(catalog.orders[order], null, 2)}</pre>
      <p data-testid="order-result">
        Native core ExpressCheckout:{" "}
        {enabled === null ? "Loading" : enabled ? "ON" : "OFF"}
      </p>
      <p>
        The React Feature binding cannot accept an entity. The core getFlag call
        above supports a registered mapper; missing entity context fails closed.
        This separate core client intentionally performs its own request.
      </p>
    </section>
  );
}
