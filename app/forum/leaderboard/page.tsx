// // app/forum/leaderboard/page.tsx
// // Career Copilot — Phase 9: Forum reputation leaderboard

// import Link from "next/link"
// import { redirect } from "next/navigation"
// import { createClient } from "@/utils/supabase/server"
// import { getLeaderboard, getUserSavedPosts, getUserReputation } from "@/lib/db/forum"
// import { getReputationBadge } from "@/types/forum"
// import { formatDistanceToNow } from "date-fns"

// export const metadata = { title: "Forum Leaderboard — Career Copilot" }

// export default async function ForumLeaderboardPage() {
//   const supabase = await createClient()
//   const { data: { user } } = await supabase.auth.getUser()
//   if (!user) redirect("/auth/login")

//   const [leaderboard, savedPosts, myReputation] = await Promise.all([
//     getLeaderboard(10),
//     getUserSavedPosts(user.id),
//     getUserReputation(user.id),
//   ])

//   const myBadge = getReputationBadge(myReputation?.points ?? 0)

//   return (
//     <div className="min-h-screen bg-[#0f0f0f]">
//       <div className="border-b border-white/[0.06] bg-[#0f0f0f]/80 backdrop-blur-md sticky top-0 z-30">
//         <div className="max-w-5xl mx-auto px-6 h-14 flex items-center gap-4">
//           <Link href="/forum" className="text-white/30 text-sm hover:text-white/60 transition-colors">
//             ← Forum
//           </Link>
//           <span className="text-white/10">/</span>
//           <span className="text-white/60 text-sm">Leaderboard & saved</span>
//         </div>
//       </div>

//       <div className="max-w-5xl mx-auto px-6 py-10">
//         <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

//           {/* ── My stats ─────────────────────────────────────────────── */}
//           <div>
//             <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 mb-6">
//               <p className="text-white/30 text-xs uppercase tracking-widest mb-4">Your reputation</p>
//               <div className="flex items-center gap-4 mb-6">
//                 <div className="text-4xl font-mono font-medium text-[#e8d5a3]">
//                   {myReputation?.points ?? 0}
//                 </div>
//                 <div>
//                   <p className="text-white/70 text-sm font-medium" style={{ color: myBadge.color }}>
//                     {myBadge.label}
//                   </p>
//                   <p className="text-white/25 text-xs">reputation points</p>
//                 </div>
//               </div>
//               <div className="grid grid-cols-2 gap-3">
//                 {[
//                   { label: "Posts",         value: myReputation?.posts_count ?? 0 },
//                   { label: "Replies",       value: myReputation?.comments_count ?? 0 },
//                   { label: "Upvotes got",   value: myReputation?.upvotes_received ?? 0 },
//                   { label: "Best answers",  value: myReputation?.best_answers ?? 0 },
//                 ].map(stat => (
//                   <div key={stat.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
//                     <p className="text-white/60 text-lg font-mono font-medium">{stat.value}</p>
//                     <p className="text-white/30 text-xs">{stat.label}</p>
//                   </div>
//                 ))}
//               </div>
//             </div>

//             {/* ── Saved posts ──────────────────────────────────────────── */}
//             <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
//               <div className="px-5 py-3 border-b border-white/[0.06]">
//                 <p className="text-white/40 text-xs uppercase tracking-widest">Saved posts ({savedPosts.length})</p>
//               </div>
//               {savedPosts.length === 0 ? (
//                 <div className="p-8 text-center">
//                   <p className="text-white/25 text-sm">No saved posts yet. Bookmark posts with ☆.</p>
//                 </div>
//               ) : (
//                 <div className="divide-y divide-white/[0.04]">
//                   {savedPosts.map(post => (
//                     <Link
//                       key={post.id}
//                       href={`/forum/post/${post.id}`}
//                       className="block px-5 py-3.5 hover:bg-white/[0.025] transition-colors"
//                     >
//                       <p className="text-white/65 text-sm leading-snug mb-1 line-clamp-2">{post.title}</p>
//                       <p className="text-white/25 text-xs">
//                         {post.category?.icon} {post.category?.name} ·{" "}
//                         {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
//                       </p>
//                     </Link>
//                   ))}
//                 </div>
//               )}
//             </div>
//           </div>

//           {/* ── Global leaderboard ────────────────────────────────────── */}
//           <div>
//             <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
//               <div className="px-5 py-3 border-b border-white/[0.06]">
//                 <p className="text-white/40 text-xs uppercase tracking-widest">Top contributors</p>
//               </div>
//               {leaderboard.length === 0 ? (
//                 <div className="p-8 text-center">
//                   <p className="text-white/25 text-sm">No contributions yet. Start a discussion!</p>
//                 </div>
//               ) : (
//                 <div className="divide-y divide-white/[0.04]">
//                   {leaderboard.map((entry, idx) => {
//                     const badge = getReputationBadge(entry.points)
//                     const isMe = entry.user_id === user.id
//                     return (
//                       <div
//                         key={entry.user_id}
//                         className={`flex items-center gap-4 px-5 py-4 ${isMe ? "bg-[#e8d5a3]/[0.03]" : ""}`}
//                       >
//                         <span className={`font-mono text-sm w-6 text-center ${
//                           idx === 0 ? "text-[#e8d5a3]" : idx === 1 ? "text-white/50" : idx === 2 ? "text-amber-700/70" : "text-white/20"
//                         }`}>
//                           {idx === 0 ? "①" : idx === 1 ? "②" : idx === 2 ? "③" : `${idx + 1}`}
//                         </span>
//                         <div className="w-8 h-8 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-xs text-white/40 font-medium">
//                           {(entry.full_name ?? "A")[0].toUpperCase()}
//                         </div>
//                         <div className="flex-1 min-w-0">
//                           <p className="text-white/65 text-sm font-medium truncate">
//                             {entry.full_name ?? "Anonymous"}
//                             {isMe && <span className="text-[#e8d5a3]/50 text-xs ml-1">(you)</span>}
//                           </p>
//                           <p className="text-xs" style={{ color: badge.color }}>
//                             {badge.label}
//                           </p>
//                         </div>
//                         <div className="text-right">
//                           <p className="text-[#e8d5a3]/70 text-sm font-mono font-medium">{entry.points}</p>
//                           <p className="text-white/20 text-xs">pts</p>
//                         </div>
//                       </div>
//                     )
//                   })}
//                 </div>
//               )}
//             </div>

//             {/* Points guide */}
//             <div className="mt-6 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
//               <p className="text-white/30 text-xs uppercase tracking-widest mb-3">How points work</p>
//               <div className="flex flex-col gap-2 text-sm text-white/35">
//                 <div className="flex justify-between">
//                   <span>Creating a post</span>
//                   <span className="text-[#e8d5a3]/50 font-mono">+10 pts</span>
//                 </div>
//                 <div className="flex justify-between">
//                   <span>Writing a reply</span>
//                   <span className="text-[#e8d5a3]/50 font-mono">+2 pts</span>
//                 </div>
//                 <div className="flex justify-between">
//                   <span>Receiving an upvote</span>
//                   <span className="text-[#e8d5a3]/50 font-mono">+5 pts</span>
//                 </div>
//                 <div className="flex justify-between">
//                   <span>Best answer selected</span>
//                   <span className="text-[#e8d5a3]/50 font-mono">+25 pts</span>
//                 </div>
//               </div>
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   )
// }


import Link from "next/link"
import { getLeaderboard } from "@/lib/db/forum"

export const metadata = { title: "Forum Leaderboard — Career Copilot" }

export default async function LeaderboardPage() {
  const leaders = await getLeaderboard(50)

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <nav
        className="border-b h-14 flex items-center px-6"
        style={{ borderColor: "var(--border)" }}
      >
        <Link href="/dashboard" className="cc-logo">Career Copilot</Link>
        <Link href="/forum" className="ml-auto text-sm" style={{ color: "var(--text-muted)" }}>
          ← Forum
        </Link>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1
          className="text-2xl font-medium text-white mb-2"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          Community leaderboard
        </h1>
        <p className="text-sm mb-8" style={{ color: "var(--text-muted)" }}>
          Top contributors ranked by reputation points. Earn points by posting, commenting, and getting upvoted.
        </p>

        {/* Points legend */}
        <div
          className="rounded-2xl p-4 mb-8 flex flex-wrap gap-4"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
        >
          {[
            { action: "Create a post",           pts: "+2" },
            { action: "Post gets upvoted",        pts: "+5" },
            { action: "Write a comment",          pts: "+1" },
            { action: "Comment marked best answer", pts: "+10" },
          ].map((item) => (
            <div key={item.action} className="flex items-center gap-2">
              <span
                className="text-xs px-2 py-0.5 rounded-full font-mono"
                style={{ background: "var(--gold-faint)", border: "1px solid var(--gold-border)", color: "var(--gold)" }}
              >
                {item.pts}
              </span>
              <span className="text-xs" style={{ color: "var(--text-dim)" }}>{item.action}</span>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="flex flex-col gap-2">
          {leaders.map((entry, i) => {
            const rank = i + 1
            const medalColor = rank === 1 ? "#FFD700" : rank === 2 ? "#C0C0C0" : rank === 3 ? "#CD7F32" : null

            return (
              <div
                key={entry.user_id}
                className="flex items-center gap-4 rounded-2xl px-5 py-4 transition-colors"
                style={{
                  background: rank <= 3 ? "var(--gold-faint)" : "var(--bg-surface)",
                  border: `1px solid ${rank <= 3 ? "var(--gold-border)" : "var(--border)"}`,
                }}
              >
                {/* Rank */}
                <div
                  className="w-8 text-center text-sm font-semibold shrink-0"
                  style={{
                    color: medalColor ?? "var(--text-dim)",
                    fontFamily: "var(--font-serif)",
                  }}
                >
                  {rank <= 3 ? ["🥇", "🥈", "🥉"][rank - 1] : rank}
                </div>

                {/* Avatar */}
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0"
                  style={{
                    background: "var(--gold-faint)",
                    border: "1px solid var(--gold-border)",
                    color: "var(--gold)",
                    fontFamily: "var(--font-serif)",
                  }}
                >
                  {entry.full_name?.[0]?.toUpperCase() ?? "?"}
                </div>

                {/* Name + exam */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {entry.full_name ?? "Aspirant"}
                  </p>
                  {entry.target_exam && (
                    <p className="text-xs truncate" style={{ color: "var(--text-dim)" }}>
                      {entry.target_exam}
                    </p>
                  )}
                </div>

                {/* Stats */}
                <div className="hidden sm:flex items-center gap-5 shrink-0">
                  <Stat label="Posts"    value={entry.posts_count}      />
                  <Stat label="Answers"  value={entry.best_answers}     />
                  <Stat label="Upvotes"  value={entry.upvotes_received} />
                </div>

                {/* Points */}
                <div
                  className="text-right shrink-0"
                >
                  <p
                    className="text-base font-semibold"
                    style={{ color: rank <= 3 ? "var(--gold)" : "rgba(255,255,255,0.80)", fontFamily: "var(--font-serif)" }}
                  >
                    {entry.points.toLocaleString()}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-ghost)" }}>pts</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.75)" }}>{value}</p>
      <p className="text-xs" style={{ color: "var(--text-ghost)" }}>{label}</p>
    </div>
  )
}