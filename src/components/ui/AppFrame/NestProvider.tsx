"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type MutableRefObject,
  type ReactNode,
} from "react";
import type { NestMember, NestPreferences, NestSelf } from "@/lib/nest-types";

type NestContextValue = NestPreferences & {
  /** null when the Nest data could not be read */
  nestName: string | null;
  members: NestMember[];
  me: NestSelf | null;
  /** True once the user moved to another page of the app in this tab */
  hasPreviousPage: MutableRefObject<boolean>;
};

const NestContext = createContext<NestContextValue | null>(null);

export function useNest(): NestContextValue {
  const value = useContext(NestContext);
  if (!value) throw new Error("useNest must be used inside <NestProvider>");
  return value;
}

/** Gives the frame components the Nest data read on the server. Renders no element. */
export function NestProvider({
  nestName,
  members,
  me,
  startLens,
  defaultVisibility,
  children,
}: NestPreferences & {
  nestName: string | null;
  members: NestMember[];
  me: NestSelf | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const hasPreviousPage = useRef(false);
  const firstPath = useRef<string | null>(null);

  useEffect(() => {
    if (firstPath.current === null) {
      firstPath.current = pathname;
    } else if (firstPath.current !== pathname) {
      hasPreviousPage.current = true;
    }
  }, [pathname]);

  const value = useMemo(
    () => ({
      nestName,
      members,
      me,
      startLens,
      defaultVisibility,
      hasPreviousPage,
    }),
    [nestName, members, me, startLens, defaultVisibility],
  );
  return <NestContext.Provider value={value}>{children}</NestContext.Provider>;
}
