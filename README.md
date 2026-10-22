<div align="center">

# AlphaChat

**A real-time chat app with direct messages, group chats and privacy controls. One codebase for Android, iOS and web.**

![Expo](https://img.shields.io/badge/Expo-React%20Native-000020?logo=expo&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20Realtime-3FCF8E?logo=supabase&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue)

</div>

<!-- Add screenshots here: docs/screenshots/chat-list.png, chat.png, group.png -->

---

## Overview

AlphaChat is a WhatsApp-style messenger built with **React Native (Expo)** and **Supabase**. Users sign in, find each other by username, and chat one-to-one or in groups. Messages, presence, typing state and group changes arrive over Supabase Realtime.

Privacy is built into the data layer. Nobody can browse a list of all users, strangers must send a message request first, and every group action is checked on the server.

## Features

### Direct messaging
- Real-time delivery with **sent, delivered and read ticks**
- **Typing indicator** and **online / last seen** presence
- Optimistic sending with **tap-to-retry** for failed messages
- Day separators, scroll-to-bottom button with a new-message counter
- Tappable chat header that opens the other person's **profile card**

### Privacy and safety
- **Find people by username** (search needs 3+ characters, no public directory)
- **Message requests**: until the other person accepts, you can send only 3 intro messages, and they see no read receipts
- **Block / unblock** and **report** (spam, harassment, impersonation, inappropriate content, other)

### Groups
- Roles: **owner, admin, member**
- Join modes: **open**, **approval** (admins review requests) and **closed**
- Invite by username or by shareable **invite code**, with code rotation
- Message **replies, @mentions, emoji reactions, pinned messages** and soft delete ("This message was deleted")
- Moderation: **admins-only posting**, **slow mode**, **mute** (timed), **remove and ban**, **report message**, ownership transfer
- System notices ("X joined", "X was removed"), unread and mention counts

### Chat list
- Right-click (web) or long-press (mobile) menu: **open, mark as unread, pin (max 3), mute, archive, delete**, plus **Group info** and **Leave group** for groups
- Filters for All, Unread and Online, plus an Archived view
- These preferences are stored on the device, per account

### App
- Email sign-in and **Google OAuth**
- **Light, dark and system** themes
- Session persists across restarts

## Tech stack

| Layer | Technology |
|---|---|
| App | React Native with Expo, TypeScript |
| Backend | Supabase: Postgres, Auth, Realtime, Row Level Security, RPC functions |
| Session storage | `expo-sqlite` key-value store on native, `localStorage` on web |
| Auth | Supabase Auth (email, Google via `expo-auth-session`) |
| UI | Core React Native components, Ionicons, `Animated` API |

## Project structure

```
.
├── App.tsx                  # Root: auth gate, providers, screen transitions
├── index.ts                 # Expo entry point
├── app.json                 # Expo configuration
├── components/              # Screens, modals and UI pieces
│   ├── AuthScreen.tsx
│   ├── ChatListScreen.tsx   # Combined list of direct chats and groups
│   ├── ChatScreen.tsx       # 1:1 conversation
│   ├── GroupChatScreen.tsx  # Group conversation
│   ├── GroupInfoScreen.tsx  # Members, settings, reports
│   ├── ChatContextMenu.tsx  # Right-click / long-press menu
│   ├── PeerProfileModal.tsx # Profile card of the other person
│   └── ...                  # Modals, bubbles, avatars, indicators
├── lib/
│   ├── supabase.ts          # Supabase client and config checks
│   ├── ChatContext.tsx      # Users, messages, presence, typing
│   ├── connections.tsx      # Message requests, blocks, reports
│   ├── groups.tsx           # Group list state and realtime refresh
│   ├── groupApi.ts          # Typed wrappers for the group RPC functions
│   ├── chatPrefs.tsx        # Pin / mute / archive preferences (on-device)
│   ├── googleAuth.ts        # OAuth flow for web and native
│   ├── theme.ts             # Light and dark themes
│   └── utils.ts             # Time formatting, avatar colours
└── assets/                  # Icons and splash images
```

## Architecture

```
React Native UI (components/)
        │  hooks: useChat · useConnections · useGroups · useChatPrefs
        ▼
Context providers (lib/)         ← state, realtime subscriptions
        │
        ▼
Supabase client ── Realtime (postgres_changes)
        │
        ▼
Postgres: tables protected by RLS + security-definer RPC functions
```

- **Reads** go through Row Level Security: you can only read a group's rows if you are a member.
- **Writes that change who can do what** (join, remove, mute, pin, ...) go through `security definer` RPC functions that check the caller's role first.
- **Chat messages** are inserted directly. A database trigger checks membership, mute, slow mode and admins-only rules, and fills in the sender name and reply preview so they cannot be spoofed.
- Providers nest as `ChatProvider → GroupsProvider → ChatPrefsProvider → ConnectionsProvider`.

## Getting started

### Prerequisites
- Node.js 20 or newer
- npm
- A free [Supabase](https://supabase.com) project
- For phone testing: the **Expo Go** app, or an Android or iOS device or emulator

### 1. Clone and install

```bash
git clone https://github.com/Kishor237323/AlphaChat.git
cd AlphaChat
npm install
```

### 2. Configure environment variables

Create a `.env` file in the project root:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR-PUBLIC-ANON-KEY
```

Use the **anon / publishable** key from *Supabase → Project Settings → API*. Never put the `service_role` key in an Expo app.

### 3. Set up the database

1. Open *Supabase → SQL Editor*.
2. Run the schema scripts from the `supabase/` folder in order (core chat tables first, then the groups migration).
3. In *Database → Replication*, make sure Realtime is enabled for the chat and group tables.
4. After any function change, run `notify pgrst, 'reload schema';`.

### 4. Enable authentication

- **Email:** enabled by default in Supabase.
- **Google:** enable the provider in *Authentication → Providers* and add your redirect URLs (see below).

### 5. Run the app

```bash
npx expo start -c
```

Press `w` for web, scan the QR code with Expo Go, or press `a` or `i` for an emulator. Add `--tunnel` if your phone and computer are not on the same network.

## Google sign-in redirect URLs

Add these under *Authentication → URL Configuration → Redirect URLs*:

| Platform | URL |
|---|---|
| Web (dev) | `http://localhost:8081` |
| Web (prod) | your deployed site URL |
| Native | the URL printed by `makeRedirectUri()` for your build |


you can download using the below link ---> 
https://expo.dev/artifacts/eas/V7bAkXp_ShotSXTYzAr8QZRbcoOIGrqoYKRJWocP-Dk.apk

## Building and releasing

```bash
npm install -g eas-cli
eas login

# Installable Android build (APK) for testing
eas build -p android --profile preview

# Publish a JavaScript-only update to installed apps
eas update --branch production --message "describe the change"

# Static web build
npx expo export -p web
```

JavaScript-only changes can ship through `eas update`. Adding a native package needs a new `eas build`.

## Security

- **Row Level Security is enabled** on all group tables. Clients can read only what membership allows.
- **Privileged actions are RPC functions** with explicit role checks, never client-side checks alone.
- **Only the public anon key belongs in the app.** Do not commit `.env`, and do not commit a `lib/localConfig.ts` containing real keys. It is listed in `.gitignore` for that reason.
- **Reports keep a snapshot** of the reported message, so deleting it does not erase the evidence.
- To report a vulnerability, open a private security advisory on GitHub rather than a public issue.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Could not find the function public.create_group ... in the schema cache` | The migration was not run, or the cache is stale. Run it, then `notify pgrst, 'reload schema';` |
| "Supabase is not configured" screen | `.env` is missing or Expo did not load it. Restart with `npx expo start -c` |
| `useChatPrefs must be used inside ChatPrefsProvider` | Wrap the app as shown in the Architecture section |
| Realtime updates do not arrive | Enable Realtime for the tables in the Supabase dashboard |
| Google sign-in returns to a blank page | Add the exact redirect URL to Supabase's allow list |

## Roadmap

- [ ] Push notifications
- [ ] Image and file sharing
- [ ] Sync pin / archive / mute across devices
- [ ] Message search
- [ ] End-to-end encryption (the group schema already tracks a key epoch)
- [ ] Automated tests and CI

## Contributing

1. Fork the repository and create a branch: `git checkout -b feature/your-feature`
2. Keep TypeScript strict and run `npx tsc --noEmit` before committing
3. Open a pull request that describes what changed and how you tested it

## License

Released under the [MIT License](LICENSE).