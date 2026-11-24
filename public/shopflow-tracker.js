/* ShopFlow first-party analytics. Load only after the site's analytics consent choice. */
(() => {
  const script = document.currentScript;
  if (!script) return;
  const token = script.dataset.siteToken;
  const endpoint = script.dataset.endpoint;
  if (!token || !endpoint) return;
  const id = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
  const getId = (key, storage) => {
    let value = storage.getItem(key);
    if (!value) { value = id(); storage.setItem(key, value); }
    return value;
  };
  const visitorId = getId("shopflow_visitor", localStorage);
  const sessionId = getId("shopflow_session", sessionStorage);
  const query = new URLSearchParams(location.search);
  const common = {
    token, visitor_id: visitorId, session_id: sessionId,
    page_url: location.href, page_path: location.pathname,
    referrer: document.referrer || "",
    utm_source: query.get("utm_source") || "",
    utm_medium: query.get("utm_medium") || "",
    utm_campaign: query.get("utm_campaign") || "",
  };
  const send = (eventName, details = {}) => {
    const payload = JSON.stringify({ ...common, ...details, event_name: eventName });
    fetch(endpoint, { method: "POST", mode: "cors", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true }).catch(() => {});
  };
  const firstSession = !sessionStorage.getItem("shopflow_session_started");
  if (firstSession) {
    sessionStorage.setItem("shopflow_session_started", "1");
    send("session_start");
  }
  send("page_view");
  window.ShopFlowTrack = (eventName, details = {}) => {
    const allowed = ["add_to_cart", "begin_checkout", "purchase", "lead", "custom"];
    if (!allowed.includes(eventName)) return false;
    send(eventName, details);
    return true;
  };
})();
