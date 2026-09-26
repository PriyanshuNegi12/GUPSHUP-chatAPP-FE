import { useState, useRef, useEffect } from "react";
import { NavLink, useMatch, useNavigate } from "react-router";
import { useDispatch, useSelector } from "react-redux";
import { logoutUser } from "../utils/authSlice";
import VartalaMark from "./VartalaMark";

// wordmark font — falls back to system fonts if the Google font hasn't loaded
const BRAND_FONT = "'Baloo 2', 'Trebuchet MS', system-ui, sans-serif";

export default function MobileHeader() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);

  // only the chat LIST should show this bar on mobile — hide it whenever
  // a specific conversation is open (ChatWindow renders its own header there)
  const inChat = useMatch("/chat/:conversationId");

  useEffect(() => {
    const onClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const handleLogout = async () => {
    setOpen(false);
    await dispatch(logoutUser());
    navigate("/login");
  };

  if (inChat) return null;

  const item = "block w-full text-left px-4 py-2.5 text-[14.5px] text-[#3b2e22] transition-colors duration-150 hover:bg-[#f3ead8]";

  return (
    <div className="md:hidden flex items-center justify-between px-4 h-16 border-b border-[#e9ddc4] bg-[#faf5e9] relative">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&display=swap');

        @keyframes menuIn {
          0% { opacity: 0; transform: translateY(-8px) scale(0.97); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      <div className="flex items-center gap-2.5">
        <VartalaMark size={40} />
        <span
          className="font-extrabold tracking-[0.06em] text-[26px] leading-none text-[#4a463e]"
          style={{ fontFamily: BRAND_FONT }}
        >
          GUPSHUP
        </span>
      </div>

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label="Menu"
          className="transition-transform duration-200 active:scale-90"
        >
          {user?.avatar ? (
            <img src={user.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <span className="w-8 h-8 rounded-full bg-[#e9ddc4] flex items-center justify-center">👤</span>
          )}
        </button>

        {open && (
          <div
            className="absolute right-0 top-11 w-52 rounded-2xl border border-[#e9ddc4] bg-[#faf5e9] shadow-lg overflow-hidden z-30 origin-top-right"
            style={{ animation: "menuIn 0.18s ease-out backwards" }}
          >
            <NavLink to="/friends" className={item} onClick={() => setOpen(false)}>Friends</NavLink>
            <NavLink to="/friends/requests" className={item} onClick={() => setOpen(false)}>Friend requests</NavLink>
            <NavLink to="/friends/blocked" className={item} onClick={() => setOpen(false)}>Blocked</NavLink>
            <NavLink to="/search" className={item} onClick={() => setOpen(false)}>Add friend</NavLink>
            <div className="border-t border-[#e9ddc4]" />
            <NavLink to="/profile" className={item} onClick={() => setOpen(false)}>Profile</NavLink>
            {user?.role === 'admin' && (
              <NavLink to="/admin" className={item} onClick={() => setOpen(false)}>Admin</NavLink>
            )}
            <NavLink to="/about" className={item} onClick={() => setOpen(false)}>About</NavLink>
            <div className="border-t border-[#e9ddc4]" />
            <button onClick={handleLogout} className={`${item} text-[#8a2f2f]`}>Logout</button>
          </div>
        )}
      </div>
    </div>
  );
}