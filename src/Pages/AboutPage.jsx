import { NavLink } from "react-router";
import VartalaMark from "../components/VartalaMark";
import BackgroundArt from "../components/BackgroundArt";
import CardFoliage from "../components/CardFoliage";

// ---------- inline icons, matching the thin-stroke style used across the app ----------

function GithubIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21" />
    </svg>
  );
}

function LinkedinIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M7 10v7M7 7v.01M11 17v-4.5a2 2 0 0 1 4 0V17M11 12.5V17" />
    </svg>
  );
}

function MailIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}

function PhoneIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 3h3l1.5 4.5-2.2 1.7a12 12 0 0 0 5.5 5.5l1.7-2.2L20 14v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4.5 5.2 2 2 0 0 1 6.5 3Z" />
    </svg>
  );
}

function BoltIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
    </svg>
  );
}

function TicksIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12.5 6 16l4-8" />
      <path d="M10 12.5 14 16l8-11" />
    </svg>
  );
}

function PeopleIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c.8-3.4 3-5 6-5s5.2 1.6 6 5" />
      <circle cx="17" cy="7" r="2.3" />
      <path d="M15.5 12.2c2.2.2 3.6 1.7 4.2 4.3" />
    </svg>
  );
}

function ShieldIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" />
      <path d="M9 12l2 2 4-4.5" />
    </svg>
  );
}

function DotIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TypingIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="6" width="18" height="12" rx="3" />
      <circle cx="8.5" cy="12" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="12" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

// ---------- small building blocks ----------

function FeatureCard({ icon, title, text }) {
  return (
    <div className="rounded-2xl border border-[#e9ddc4] bg-[#faf5e9] p-5 hover:shadow-[0_14px_28px_-16px_rgba(120,85,35,0.35)] hover:-translate-y-0.5 transition-all duration-200">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-[#f3e8d6] mb-3"
        style={{ background: "linear-gradient(180deg, #b97a45 0%, #8a5527 100%)" }}
      >
        {icon}
      </div>
      <h3 className="font-medium text-[15px] text-[#2e2a22] mb-1">{title}</h3>
      <p className="text-[13.5px] text-[#6b6257] leading-relaxed">{text}</p>
    </div>
  );
}

function TechChip({ children }) {
  return (
    <span className="px-3.5 py-1.5 rounded-full text-[12.5px] font-medium bg-[#efe4cd] text-[#4a463e] border border-[#e9ddc4]">
      {children}
    </span>
  );
}

function ContactLink({ href, icon, label, sub }) {
  return (
      <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
      className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-[#e9ddc4] bg-[#faf5e9] hover:bg-[#f3ead8] hover:-translate-y-0.5 transition-all duration-200 group"
    >
      <><span className="w-10 h-10 rounded-full bg-[#efe4cd] flex items-center justify-center text-[#8a5527] group-hover:bg-[#8a5527] group-hover:text-[#f3e8d6] transition-colors duration-200 shrink-0">
          {icon}
        </span><div className="min-w-0">
            <p className="text-[13.5px] font-medium text-[#2e2a22] truncate">{label}</p>
            <p className="text-[12px] text-[#6b6257] truncate">{sub}</p>
          </div></>
    </a>
  );
}

// ---------- page ----------

export default function AboutPage() {
  return (
    <div className="relative h-full w-full overflow-y-auto bg-[#f3ead8]">
      <div
        className="pointer-events-none fixed inset-0"
        style={{ background: "radial-gradient(ellipse at 15% 5%, #fbf6e9 0%, #f3ead8 45%, #ecdfc2 100%)" }}
      />
      <div className="pointer-events-none fixed inset-0 opacity-30 sm:opacity-60">
        <BackgroundArt />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-5 sm:px-8 py-10 sm:py-14">

        {/* ---------- header: logo + site name, centered ---------- */}
        <div className="flex flex-col items-center text-center mb-12 sm:mb-16">
          <div className="flex items-center gap-3 mb-3">
            <VartalaMark size={48} />
            <span className="font-display font-extrabold tracking-wide text-[30px] sm:text-[36px] text-[#4a463e]">
              GUPSHUP
            </span>
          </div>
          <p className="text-[14px] sm:text-[15px] text-[#6b6257] max-w-md">
            A real-time conversation, the way it should feel — instant, alive, and yours.
          </p>
        </div>

        {/* ---------- the story ---------- */}
        <section className="relative rounded-[28px] border border-[#e9ddc4] bg-[#faf5e9] px-6 py-8 sm:px-10 sm:py-10 shadow-[0_30px_50px_-24px_rgba(120,85,35,0.35)] overflow-hidden mb-8">
          <CardFoliage />
          <div className="relative">
            <h2 className="font-display text-[22px] sm:text-[26px] text-[#2e2a22] mb-5">The Story</h2>

            <div className="space-y-4 text-[14.5px] sm:text-[15px] text-[#3b3226] leading-relaxed">
              <p>
                Gupshup — <span className="italic text-[#6b6257]">"conversation"</span> — started as a simple
                question: what does it actually take to make a chat app feel alive? Not just a form that
                saves a row to a database, but something that reacts the instant a friend starts typing,
                the instant a message lands, the instant someone comes online.
              </p>
              <p>
                Under the hood, Gupshup is built on the MERN stack — MongoDB, Express, React, and Node —
                with Socket.IO layered on top to carry everything that needs to happen{" "}
                <em>right now</em> rather than on the next page load: new messages, delivered and read
                receipts, typing indicators, presence, and live updates to friend requests and group
                membership. Redis sits alongside it, tracking who's online across every open tab and
                device, rate-limiting login attempts, and managing short-lived OTP codes for email
                verification.
              </p>
              <p>
                Every message is written to MongoDB the moment it's sent, so nothing is ever lost —
                whether the recipient is looking at the screen, on another page, or completely offline.
                When they come back, their full history is exactly where they left it, and anything they
                missed catches up automatically: delivered ticks update the moment they reconnect, read
                receipts turn blue the moment they open the chat, and the chat list bumps itself to the
                top the moment a new message arrives, no refresh required.
              </p>
              <p>
                Authentication is cookie-based and JWT-signed, with OTP email verification on signup,
                bcrypt-hashed passwords, and a Redis-backed token blacklist so logging out actually
                revokes a session rather than just clearing a cookie. Friendship is a first-class concept
                here — you can only message people who've accepted a friend request, direct chats freeze
                the moment someone unfriends or blocks the other, and group chats can only be built from
                people you're already friends with.
              </p>
              <p>
                The result is something that behaves the way the apps you already use every day behave —
                single, double, and blue ticks; a quiet "typing…" that appears and disappears in real
                time; a green dot that means someone is actually there — built from scratch, piece by
                piece, as a way to genuinely understand what real-time software takes to build well.
              </p>
            </div>
          </div>
        </section>

        {/* ---------- features ---------- */}
        <section className="mb-8">
          <h2 className="font-display text-[20px] sm:text-[24px] text-[#2e2a22] mb-4 px-1">What it does</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <FeatureCard
              icon={<BoltIcon />}
              title="Real-time messaging"
              text="Messages arrive instantly over WebSockets — in an open chat, from the chat list, or from anywhere else in the app."
            />
            <FeatureCard
              icon={<TicksIcon />}
              title="Delivery & read receipts"
              text="Single, double, and blue ticks track exactly when a message reaches someone and when they've actually read it."
            />
            <FeatureCard
              icon={<TypingIcon />}
              title="Live typing indicators"
              text="See the moment someone starts replying — in the chat window and right in the chat list."
            />
            <FeatureCard
              icon={<DotIcon />}
              title="Online presence"
              text="A live green dot for friends who are online right now, with a last-seen fallback when they're not."
            />
            <FeatureCard
              icon={<PeopleIcon />}
              title="Friends & groups"
              text="Send and accept friend requests, build group chats, add or remove members, and leave whenever you want."
            />
            <FeatureCard
              icon={<ShieldIcon />}
              title="Block & privacy controls"
              text="Block anyone to instantly stop them from reaching you, with OTP-verified signup and secure, revocable sessions."
            />
          </div>
        </section>

        {/* ---------- tech stack ---------- */}
        <section className="mb-8">
          <h2 className="font-display text-[20px] sm:text-[24px] text-[#2e2a22] mb-4 px-1">Built with</h2>
          <div className="rounded-2xl border border-[#e9ddc4] bg-[#faf5e9] p-5 flex flex-wrap gap-2.5">
            <TechChip>React</TechChip>
            <TechChip>Redux Toolkit</TechChip>
            <TechChip>Node.js</TechChip>
            <TechChip>Express</TechChip>
            <TechChip>MongoDB</TechChip>
            <TechChip>Socket.IO</TechChip>
            <TechChip>Redis</TechChip>
            <TechChip>JWT</TechChip>
            <TechChip>Tailwind CSS</TechChip>
          </div>
        </section>

        {/* ---------- about me ---------- */}
        <section className="relative rounded-[28px] border border-[#e9ddc4] bg-[#faf5e9] px-6 py-8 sm:px-10 sm:py-10 shadow-[0_30px_50px_-24px_rgba(120,85,35,0.35)] overflow-hidden mb-10">
          <CardFoliage />
          <div className="relative">
            <h2 className="font-display text-[22px] sm:text-[26px] text-[#2e2a22] mb-6">About Me</h2>

            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 sm:gap-6 mb-6">
              <span
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center text-[28px] sm:text-[32px] font-display font-bold text-[#f3e8d6] shrink-0"
                style={{ background: "linear-gradient(180deg, #b97a45 0%, #8a5527 100%)" }}
              >
                PN
              </span>
              <div className="text-center sm:text-left">
                <h3 className="font-display text-[19px] sm:text-[21px] text-[#2e2a22]">Priyanshu Negi</h3>
                <p className="text-[13.5px] text-[#6b6257] mt-1">Uttarakhand, India</p>
                <p className="text-[14px] text-[#3b3226] mt-2 leading-relaxed max-w-md">
                  Full-stack developer working across the MERN stack, with a focus on generative AI
                  engineering — building applications that combine real-time systems with LLM-powered
                  features. Computer Science graduate from Shivalik College of Engineering.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ContactLink
                href="https://github.com/PriyanshuNegi12"
                icon={<GithubIcon />}
                label="GitHub"
                sub="@PriyanshuNegi12"
              />
              <ContactLink
                href="https://www.linkedin.com/in/priyanshu-negi-829368277/"
                icon={<LinkedinIcon />}
                label="LinkedIn"
                sub="Priyanshu Negi"
              />
              <ContactLink
                href="mailto:priyanshunegi.409@gmail.com"
                icon={<MailIcon />}
                label="Email"
                sub="priyanshunegi.409@gmail.com"
              />
              <ContactLink
                href="tel:+918979894409"
                icon={<PhoneIcon />}
                label="Phone"
                sub="+91 89798 94409"
              />
            </div>
          </div>
        </section>

        {/* ---------- footer ---------- */}
        <div className="text-center pb-6">
          <NavLink
            to="/"
            className="inline-block text-[13.5px] text-[#8a5527] hover:underline transition-all duration-150"
          >
            &larr; Back to chats
          </NavLink>
          <p className="text-[12px] text-[#8a8072] mt-3">Gupshup — built with MERN, Socket.IO & Redis</p>
        </div>
      </div>
    </div>
  );
}