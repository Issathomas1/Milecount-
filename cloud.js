/*
MileCount Cloud V1 client.
Production configuration is intentionally blank until a backend project is provisioned.
The current product keeps working locally when cloud is not configured.
*/
window.MileCountCloud = (() => {
  const CONFIG = {
    apiBase: "",
    enabled: false
  };

  async function request(path, options={}) {
    if (!CONFIG.enabled || !CONFIG.apiBase) throw new Error("MileCount Cloud is not configured yet.");
    const response = await fetch(CONFIG.apiBase + path, {
      ...options,
      headers: {"Content-Type":"application/json", ...(options.headers||{})}
    });
    if (!response.ok) throw new Error("Cloud request failed: " + response.status);
    return response.status === 204 ? null : response.json();
  }

  return {
    isEnabled: () => CONFIG.enabled,
    configure: ({apiBase}) => { CONFIG.apiBase = apiBase || ""; CONFIG.enabled = Boolean(apiBase); },
    getMe: () => request("/v1/me"),
    listVehicles: () => request("/v1/vehicles"),
    saveVehicle: vehicle => request("/v1/vehicles",{method:"POST",body:JSON.stringify(vehicle)}),
    listTrips: () => request("/v1/trips"),
    saveTrip: trip => request("/v1/trips",{method:"POST",body:JSON.stringify(trip)}),
    saveAnalyzedLoad: load => request("/v1/loads",{method:"POST",body:JSON.stringify(load)})
  };
})();
