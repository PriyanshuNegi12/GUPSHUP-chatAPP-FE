import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchAllUsers, deleteUserByAdmin } from "../utils/adminSlice";

function TrashIcon({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

function SearchIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function RoleBadge({ role }) {
  const isAdmin = role === "admin";
  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
        isAdmin ? "bg-[#e9d8c4] text-[#8a5527]" : "bg-[#efe4cd] text-[#6b6257]"
      }`}
    >
      {isAdmin ? "Admin" : "User"}
    </span>
  );
}

function StatusBadge({ isActive }) {
  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
        isActive ? "bg-[#e3f0e4] text-[#2f6b45]" : "bg-[#f8e4e4] text-[#8a2f2f]"
      }`}
    >
      {isActive ? "Active" : "Removed"}
    </span>
  );
}

export default function AdminPage() {
  const dispatch = useDispatch();
  const meId = useSelector((state) => state.auth.user?._id);
  const { users, total, page, limit, loading, deletingIds } = useSelector((state) => state.admin);

  const [search, setSearch] = useState("");
  const [confirmingId, setConfirmingId] = useState(null);

  useEffect(() => {
    dispatch(fetchAllUsers({ page: 1, q: "" }));
  }, [dispatch]);

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      dispatch(fetchAllUsers({ page: 1, q: search.trim() }));
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const handleDelete = async (userId) => {
    setConfirmingId(null);
    await dispatch(deleteUserByAdmin(userId));
  };

  const goToPage = (p) => {
    if (p < 1 || p > totalPages) return;
    dispatch(fetchAllUsers({ page: p, q: search.trim() }));
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="h-full w-full overflow-y-auto bg-[#f3ead8]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="font-display text-[26px] text-[#2e2a22]">Admin — Users</h1>
          <span className="text-[13px] text-[#6b6257]">{total} total</span>
        </div>
        <p className="text-[13.5px] text-[#6b6257] mb-5">
          View every registered user and remove access for anyone who violates the rules.
        </p>

        <div className="relative mb-4">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8a8072]">
            <SearchIcon />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by username or email"
            className="w-full h-11 pl-11 pr-4 rounded-full border-[1.5px] border-[#3b2e22]/30 bg-white/70 outline-none text-[14px] text-[#3b2e22] placeholder:text-[#4a3d2e]/60"
          />
        </div>

        <div className="rounded-2xl border border-[#e9ddc4] bg-[#faf5e9] overflow-hidden">
          {loading && users.length === 0 ? (
            <p className="text-center text-[13px] text-[#6b6257] py-10">Loading users...</p>
          ) : users.length === 0 ? (
            <p className="text-center text-[13px] text-[#6b6257] py-10">No users found</p>
          ) : (
            users.map((u) => {
              const isSelf = u._id === meId;
              const isDeleting = deletingIds.includes(u._id);
              return (
                <div
                  key={u._id}
                  className="flex items-center gap-3 px-4 py-3 border-b border-[#e9ddc4]/60 last:border-b-0"
                >
                  {u.avatar ? (
                    <img src={u.avatar} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                  ) : (
                    <span className="w-10 h-10 rounded-full bg-[#d8c9a3] flex items-center justify-center shrink-0">👤</span>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-[14.5px] text-[#2e2a22] truncate">
                        {u.firstname} {u.lastname || ""}
                      </p>
                      <RoleBadge role={u.role} />
                      <StatusBadge isActive={u.isActive} />
                    </div>
                    <p className="text-[13px] text-[#6b6257] truncate">
                      @{u.username} · {u.emailId}
                    </p>
                  </div>

                  {!isSelf && u.isActive && (
                    confirmingId === u._id ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleDelete(u._id)}
                          disabled={isDeleting}
                          className="px-3 py-1.5 rounded-full text-[12px] font-medium bg-[#8a2f2f] text-white hover:bg-[#7a2828] disabled:opacity-60"
                        >
                          {isDeleting ? "Removing..." : "Confirm"}
                        </button>
                        <button
                          onClick={() => setConfirmingId(null)}
                          className="px-3 py-1.5 rounded-full text-[12px] font-medium bg-[#efe4cd] text-[#4a463e] hover:bg-[#e9ddc4]"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmingId(u._id)}
                        aria-label={`Remove ${u.username}`}
                        className="w-9 h-9 rounded-full flex items-center justify-center text-[#8a2f2f] hover:bg-[#f8e4e4] shrink-0"
                      >
                        <TrashIcon />
                      </button>
                    )
                  )}
                </div>
              );
            })
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-5">
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              className="px-4 py-1.5 rounded-full text-[13px] font-medium bg-[#efe4cd] text-[#4a463e] hover:bg-[#e9ddc4] disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-[13px] text-[#6b6257]">Page {page} of {totalPages}</span>
            <button
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
              className="px-4 py-1.5 rounded-full text-[13px] font-medium bg-[#efe4cd] text-[#4a463e] hover:bg-[#e9ddc4] disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}