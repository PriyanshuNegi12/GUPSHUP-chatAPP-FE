import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router";
import { fetchProfile, updateProfile, logoutUser, deleteAccount } from "../utils/authSlice";
import { imageToDataUrl } from "../utils/imageToDataUrl";
import BackgroundArt from "../components/BackgroundArt";
import CardFoliage from "../components/CardFoliage";

function CameraIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="13.5" r="3.5" />
    </svg>
  );
}

function EditIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function Field({ label, value, name, editing, onChange, placeholder, type = "text", textarea, maxLength }) {
  return (
    <div>
      <label className="block text-[12px] text-[#8a8072] mb-1">{label}</label>
      {editing ? (
        textarea ? (
          <textarea
            name={name}
            value={value ?? ""}
            onChange={onChange}
            placeholder={placeholder}
            maxLength={maxLength}
            rows={3}
            className="w-full px-4 py-2.5 rounded-2xl border-[1.5px] border-[#3b2e22]/30 bg-white/70 outline-none text-[14px] text-[#3b2e22] placeholder:text-[#4a3d2e]/50 resize-none"
          />
        ) : (
          <input
            type={type}
            name={name}
            value={value ?? ""}
            onChange={onChange}
            placeholder={placeholder}
            maxLength={maxLength}
            className="w-full h-11 px-4 rounded-full border-[1.5px] border-[#3b2e22]/30 bg-white/70 outline-none text-[14px] text-[#3b2e22] placeholder:text-[#4a3d2e]/50"
          />
        )
      ) : (
        <p className="text-[14.5px] text-[#2e2a22] px-1 py-1 min-h-[1.5em]">
          {value || <span className="text-[#8a8072] italic">Not set</span>}
        </p>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, profileLoading, profileSaving, profileError } = useSelector((state) => state.auth);
  const fileInputRef = useRef(null);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ firstname: "", lastname: "", age: "", bio: "" });
  const [avatarPreview, setAvatarPreview] = useState(null); // data URL, staged before save
  const [avatarError, setAvatarError] = useState("");
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    dispatch(fetchProfile());
  }, [dispatch]);

  useEffect(() => {
    if (user && !editing) {
      setForm({
        firstname: user.firstname || "",
        lastname: user.lastname || "",
        age: user.age ?? "",
        bio: user.bio || "",
      });
    }
  }, [user, editing]);

  const startEdit = () => {
    setForm({
      firstname: user?.firstname || "",
      lastname: user?.lastname || "",
      age: user?.age ?? "",
      bio: user?.bio || "",
    });
    setAvatarPreview(null);
    setAvatarError("");
    setSaveError("");
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setAvatarPreview(null);
    setAvatarError("");
    setSaveError("");
  };

  const handleFieldChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleAvatarPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again later
    if (!file) return;

    setAvatarError("");
    try {
      const dataUrl = await imageToDataUrl(file, { size: 256, quality: 0.82 });
      setAvatarPreview(dataUrl);
    } catch (err) {
      setAvatarError(err.message || "Could not process that image");
    }
  };

  const handleSave = async () => {
    setSaveError("");

    const firstname = form.firstname.trim();
    if (firstname.length < 2 || firstname.length > 20) {
      setSaveError("First name must be 2 to 20 characters");
      return;
    }
    if (form.bio.length > 150) {
      setSaveError("Bio must be at most 150 characters");
      return;
    }

    const payload = {
      firstname,
      lastname: form.lastname.trim(),
      age: form.age === "" ? "" : Number(form.age),
      bio: form.bio,
    };
    if (avatarPreview) payload.avatar = avatarPreview;

    const result = await dispatch(updateProfile(payload));
    if (updateProfile.fulfilled.match(result)) {
      setEditing(false);
      setAvatarPreview(null);
    } else {
      setSaveError(result.payload || "Something went wrong");
    }
  };

  const handleLogout = async () => {
    await dispatch(logoutUser());
    navigate("/login");
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      "Delete your account? This deactivates your account and logs you out. This cannot be undone from here."
    );
    if (!confirmed) return;
    const result = await dispatch(deleteAccount());
    if (deleteAccount.fulfilled.match(result)) navigate("/login");
  };

  if (profileLoading && !user) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-[#f3ead8]">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  const displayAvatar = avatarPreview || user?.avatar;
  const initials = (user?.firstname?.[0] || user?.username?.[0] || "?").toUpperCase();

  return (
    <div className="relative h-full w-full overflow-y-auto bg-[#f3ead8]">
      <div
        className="pointer-events-none fixed inset-0"
        style={{ background: "radial-gradient(ellipse at 15% 5%, #fbf6e9 0%, #f3ead8 45%, #ecdfc2 100%)" }}
      />
      <div className="pointer-events-none fixed inset-0 opacity-30 sm:opacity-60">
        <BackgroundArt />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-5 sm:px-8 py-10 sm:py-14">
        <h1 className="font-display text-[26px] sm:text-[30px] text-[#2e2a22] mb-6 sm:mb-8 text-center">
          Your Profile
        </h1>

        <section className="relative rounded-[28px] border border-[#e9ddc4] bg-[#faf5e9] px-6 py-8 sm:px-10 sm:py-10 shadow-[0_30px_50px_-24px_rgba(120,85,35,0.35)] overflow-hidden mb-6">
          <CardFoliage />

          <div className="relative">
            {/* ---------- avatar ---------- */}
            <div className="flex flex-col items-center mb-7">
              <div className="relative">
                {displayAvatar ? (
                  <img
                    src={displayAvatar}
                    alt=""
                    className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover"
                  />
                ) : (
                  <span
                    className="w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center text-[30px] sm:text-[34px] font-display font-bold text-[#f3e8d6]"
                    style={{ background: "linear-gradient(180deg, #b97a45 0%, #8a5527 100%)" }}
                  >
                    {initials}
                  </span>
                )}

                {editing && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Change avatar"
                    className="absolute bottom-0 right-0 w-9 h-9 rounded-full flex items-center justify-center text-[#f3e8d6] border-2 border-[#faf5e9] cursor-pointer transition-transform duration-150 hover:scale-110"
                    style={{ background: "linear-gradient(180deg, #b97a45 0%, #8a5527 100%)" }}
                  >
                    <CameraIcon />
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarPick}
                  className="hidden"
                />
              </div>
              {avatarError && (
                <p className="text-[12px] text-[#8a2f2f] mt-2">{avatarError}</p>
              )}
              {!editing && (
                <>
                  <h2 className="font-display text-[20px] text-[#2e2a22] mt-4">
                    {user?.firstname} {user?.lastname || ""}
                  </h2>
                  <p className="text-[13.5px] text-[#6b6257]">@{user?.username}</p>
                </>
              )}
            </div>

            {saveError && (
              <div className="rounded-2xl border border-[#c94f4f]/30 bg-[#f8e4e4] px-4 py-2.5 text-[13px] text-[#8a2f2f] mb-4">
                {saveError}
              </div>
            )}

            {/* ---------- fields ---------- */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field
                  label="First name"
                  name="firstname"
                  value={editing ? form.firstname : user?.firstname}
                  editing={editing}
                  onChange={handleFieldChange}
                  maxLength={20}
                />
                <Field
                  label="Last name"
                  name="lastname"
                  value={editing ? form.lastname : user?.lastname}
                  editing={editing}
                  onChange={handleFieldChange}
                  placeholder="Optional"
                  maxLength={20}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] text-[#8a8072] mb-1">Username</label>
                  <p className="text-[14.5px] text-[#2e2a22] px-1 py-1">@{user?.username}</p>
                </div>
                <div>
                  <label className="block text-[12px] text-[#8a8072] mb-1">Email</label>
                  <p className="text-[14.5px] text-[#2e2a22] px-1 py-1 truncate">{user?.emailId || "—"}</p>
                </div>
              </div>

              <Field
                label="Age"
                name="age"
                type="number"
                value={editing ? form.age : user?.age}
                editing={editing}
                onChange={handleFieldChange}
                placeholder="Optional"
              />

              <Field
                label="Bio"
                name="bio"
                value={editing ? form.bio : user?.bio}
                editing={editing}
                onChange={handleFieldChange}
                placeholder="Say something about yourself"
                textarea
                maxLength={150}
              />
              {editing && (
                <p className="text-[11px] text-[#8a8072] text-right -mt-2">{form.bio.length}/150</p>
              )}
            </div>

            {/* ---------- edit controls ---------- */}
            <div className="flex items-center gap-3 mt-6">
              {editing ? (
                <>
                  <button
                    onClick={handleSave}
                    disabled={profileSaving}
                    className="flex-1 h-11 rounded-full text-[14.5px] font-medium text-[#f3e8d6] disabled:opacity-60 transition-transform duration-150 hover:scale-[1.02] active:scale-95"
                    style={{ background: "linear-gradient(180deg, #b97a45 0%, #8a5527 100%)" }}
                  >
                    {profileSaving ? "Saving..." : "Save changes"}
                  </button>
                  <button
                    onClick={cancelEdit}
                    disabled={profileSaving}
                    className="h-11 px-5 rounded-full text-[14.5px] font-medium bg-[#efe4cd] text-[#4a463e] hover:bg-[#e9ddc4] disabled:opacity-60"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={startEdit}
                  className="flex items-center justify-center gap-2 w-full h-11 rounded-full text-[14.5px] font-medium bg-[#efe4cd] text-[#4a463e] hover:bg-[#e9ddc4] transition-colors duration-150"
                >
                  <EditIcon /> Edit profile
                </button>
              )}
            </div>
          </div>
        </section>

        {/* ---------- account actions ---------- */}
        <section className="rounded-2xl border border-[#e9ddc4] bg-[#faf5e9] overflow-hidden">
          <button
            onClick={handleLogout}
            className="w-full text-left px-5 py-3.5 text-[14.5px] text-[#3b2e22] hover:bg-[#f3ead8] border-b border-[#e9ddc4]/60"
          >
            Log out
          </button>
          <button
            onClick={handleDeleteAccount}
            className="w-full text-left px-5 py-3.5 text-[14.5px] text-[#8a2f2f] hover:bg-[#f8e4e4]"
          >
            Delete account
          </button>
        </section>
      </div>
    </div>
  );
}