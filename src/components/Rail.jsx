import { NavLink } from "react-router";
import { useSelector } from "react-redux";

const railLink =
  "w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center text-[20px] md:text-[24px] text-[#3b2e22] transition-all duration-200 hover:scale-105 active:scale-95";
const railActive = "bg-[#e9ddc4] shadow-sm";
const railIdle = "hover:bg-[#efe4cd]";

export default function Rail() {
  const { user } = useSelector((state) => state.auth);

  return (
    <div className="hidden md:flex flex-col items-center justify-between w-19 md:w-22 py-5 md:py-7 border-r border-[#e9ddc4] bg-[#faf5e9]">
      <div className="flex flex-col items-center gap-2 md:gap-3">
        <NavLink to="/" end className={({ isActive }) => `${railLink} ${isActive ? railActive : railIdle}`}>
          💬
        </NavLink>
        <NavLink to="/friends" className={({ isActive }) => `${railLink} ${isActive ? railActive : railIdle}`}>
          👥
        </NavLink>
        <NavLink to="/search" className={({ isActive }) => `${railLink} ${isActive ? railActive : railIdle}`}>
          🔍
        </NavLink>
      </div>

      <div className="flex flex-col items-center gap-2 md:gap-3">
        {user?.role === 'admin' && (
          <NavLink to="/admin" className={({ isActive }) => `${railLink} ${isActive ? railActive : railIdle}`}>
            ⚙️
          </NavLink>
        )}
        <NavLink to="/profile" className={({ isActive }) => `${railLink} ${isActive ? railActive : railIdle}`}>
          {user?.avatar ? (
            <img src={user.avatar} alt="" className="w-10 h-10 md:w-11 md:h-11 rounded-full object-cover" />
          ) : (
            "👤"
          )}
        </NavLink>
      </div>
    </div>
  );
}