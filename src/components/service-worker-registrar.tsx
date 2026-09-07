"use client";

import { useEffect } from "react";

// Registra el service worker en cuanto se carga la página, no solo al
// activar avisos — si no, Chrome no reconoce la app como instalable de
// verdad (WebAPK) y la trata como un simple acceso directo, mostrando un
// aviso persistente de "sigue siendo una web".
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return null;
}
