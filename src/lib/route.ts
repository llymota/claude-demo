import { useEffect, useState } from "react";

export type Route = "welcome" | "today" | "rooms" | "circles" | "second-life" | "storefront" | "ledger";
const ROUTES: Route[] = ["welcome", "today", "rooms", "circles", "second-life", "storefront", "ledger"];

function read(): Route {
  const h = window.location.hash.replace(/^#/, "") as Route;
  return ROUTES.includes(h) ? h : "welcome";
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(read);
  useEffect(() => {
    const on = () => {
      setRoute(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}
