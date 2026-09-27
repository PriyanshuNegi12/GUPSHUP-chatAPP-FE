import { Outlet } from "react-router";
import Rail from "../components/Rail";
import MobileHeader from "../components/MobileHeader";

export default function Layout() {
  return (
    <div className="h-dvh w-screen overflow-hidden bg-[#f3ead8] flex">
      {/* desktop/tablet rail, hidden on mobile */}
      <Rail />

      <div className="flex flex-col flex-1 min-w-0">
        {/* mobile top bar — hides itself on mobile whenever a chat is open */}
        <MobileHeader />

        <div className="flex-1 min-h-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}