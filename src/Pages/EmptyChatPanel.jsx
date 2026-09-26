export default function EmptyChatPanel() {
  return (
    <div className="hidden md:flex flex-1 flex-col items-center justify-center gap-3 text-[#6b6257]">
      <span className="w-16 h-16 rounded-full bg-[#e9ddc4]/60 flex items-center justify-center text-[30px]">
        💬
      </span>
      <p className="text-[15px] md:text-[16px]">Select a chat to start messaging</p>
    </div>
  );
}