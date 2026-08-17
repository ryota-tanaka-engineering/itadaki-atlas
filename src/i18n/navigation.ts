import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

/** ロケールを保ったまま遷移するための Link / router。 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
