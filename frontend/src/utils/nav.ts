// src/utils/nav.ts
import type { NavigateFunction } from "react-router-dom";

export default function safeNav(nav: NavigateFunction, to: string) {
  const here = window.location.pathname;
  if (here !== to) {
    nav(to, { replace: true });
  }
}
