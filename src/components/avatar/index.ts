/*
 * Avatar engine — public API.
 *   Data (pure, import anywhere): AvatarConfig + option types, OPTIONS, PALETTE, sanitizeAvatar,
 *   randomAvatar, AVATAR_PRESETS, DEFAULT_AVATAR…
 *   Components (server-safe): Avatar, AvatarCircle, AvatarHand.
 * Data-only consumers (route handlers, editors' state) can import "@/components/avatar/config".
 */
export * from "./config";
export {
  AVATAR_HAND_VIEWBOX,
  AVATAR_VIEWBOX,
  Avatar,
  AvatarCircle,
  AvatarHand,
  avatarCircleBg,
  avatarHeight,
  type AvatarCircleProps,
  type AvatarHandProps,
  type AvatarHandVariant,
  type AvatarProps,
} from "./avatar";
