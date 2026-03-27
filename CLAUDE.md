# ChoreQuest - Development Guide

## Project Overview
ChoreQuest is a bidirectional family development & reward platform for iOS and Android.
Kids complete tasks for stars; kids can also create requests for parents. Everyone competes on the same Family Leaderboard.

## Tech Stack
- **App**: React Native + Expo (managed workflow) + TypeScript
- **Backend**: Firebase (Firestore, Auth, Cloud Functions, Storage)
- **State**: Zustand stores (single source of truth; Firestore is persistence layer)
- **Navigation**: Expo Router (file-based)
- **UI**: Lucide icons, Inter + Nunito fonts, Lottie animations, Reanimated 3
- **Forms**: React Hook Form
- **Lists**: @shopify/flash-list

## Monorepo Structure
- `app/` - Expo React Native app
- `functions/` - Firebase Cloud Functions (TypeScript)

## Architecture Rules (NON-NEGOTIABLE)
1. **Never call Firestore from React components** - all access through `src/services/`
2. **Zustand stores subscribe to Firestore via onSnapshot** - components subscribe to Zustand only
3. **Never open a real-time listener on a collection** - always query a SINGLE DOCUMENT
4. **Star balances use `runTransaction()`** - never sequential read-then-write
5. **Star balances stored on profile docs** - not calculated from transactions
6. **Child profiles are NOT Firebase Auth users** - PIN verified via Cloud Function, uses parent's auth token
7. **All Cloud Function writes use WriteBatch** - never sequential awaits
8. **Never cast to `any`** - fix the type instead
9. **Never hard-code hex values or pixel values** - import from `src/constants/tokens.ts`
10. **Leaderboard uses denormalized summary document** - never aggregate transactions at read time

## Key Patterns
- Use `withConverter()` on all Firestore collection references
- Use `React Hook Form` for all forms (not useState)
- Use `FlashList` for all lists (not FlatList/ScrollView)
- Use `Reanimated 3` for animations (not Animated API)
- All Cloud Functions are idempotent
- Firestore offline persistence enabled on app init

## Commands
```bash
npm run dev              # Start app + emulators
npm run app:start        # Start Expo dev server
npm run app:ios          # Start iOS
npm run app:android      # Start Android
npm run emulators        # Start Firebase emulators
npm run functions:build  # Build Cloud Functions
```

## Testing
```bash
cd app && npx jest                    # Run all tests
cd app && npx jest --coverage src/services/  # Coverage for services
firebase emulators:start --only firestore,auth,functions  # Start emulators for tests
```

## Sprint Order
Follow IC-001 strictly. Complete ALL tasks in a sprint before starting the next.
Current: Sprint 0 (Setup) -> Sprint 1 (Foundation, Auth, Family Account)

## Reference Documents
All in `~/Desktop/MyCoding/FamilyQuest/`:
- `ChoreQuest_PRD_v1.3.docx` - Product Requirements
- `ChoreQuest_DS_001.docx` - Design System
- `ChoreQuest_IC_001.docx` - Implementation Checklist (primary dev reference)
- `ChoreQuest_WFB_001.docx` - Wireframe Brief
