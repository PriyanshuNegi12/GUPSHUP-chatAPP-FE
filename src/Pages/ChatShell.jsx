import { Outlet, useParams } from "react-router";
import ChatListSidebar from "../components/ChatListSidebar";

export default function ChatShell() {
  const { conversationId } = useParams();
  const isChatOpen = Boolean(conversationId);

  return (
    <div className="flex h-full w-full">
      <div
        className={`${isChatOpen ? "hidden" : "flex"} md:flex flex-col w-full md:w-85 shrink-0 border-r border-[#e9ddc4] bg-[#faf5e9] transition-all duration-300`}
      >
        <ChatListSidebar />
      </div>

      <div className={`${isChatOpen ? "flex" : "hidden"} md:flex flex-1 min-w-0 transition-all duration-300`}>
        <Outlet />
      </div>
    </div>
  );
}