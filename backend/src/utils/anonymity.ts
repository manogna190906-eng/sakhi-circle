import {
  User,
  Post,
  Comment,
  PublicAuthor,
  PublicPost,
  PublicComment,
  ANONYMOUS_DISPLAY_NAME,
  ANONYMOUS_AVATAR,
} from '../types';

/**
 * Build the public-safe author object.
 * When is_anonymous=true, real identity is replaced with "Anonymous Sister".
 * The real user_id is NEVER sent to non-admin clients for anonymous content.
 */
export function buildAuthor(user: User, isAnonymous: boolean): PublicAuthor {
  if (isAnonymous) {
    return {
      user_id: null,
      name: ANONYMOUS_DISPLAY_NAME,
      avatar: ANONYMOUS_AVATAR,
    };
  }
  return {
    user_id: user.user_id,
    name: user.name,
    avatar: null, // avatar URL resolved separately
  };
}

/**
 * Project a Post row into a public-safe shape.
 * Pass isAdmin=true only for admin-facing endpoints — real identity is included.
 */
export function toPublicPost(
  post: Post,
  author: User,
  reactionCounts: Record<string, number>,
  commentCount: number,
  isAdmin = false,
): PublicPost {
  const { user_id, ...rest } = post;

  return {
    ...rest,
    author: isAdmin
      ? { user_id: author.user_id, name: author.name, avatar: null }
      : buildAuthor(author, post.is_anonymous),
    reaction_counts: {
      support: reactionCounts['support'] ?? 0,
      hug: reactionCounts['hug'] ?? 0,
      strong: reactionCounts['strong'] ?? 0,
      like: reactionCounts['like'] ?? 0,
    },
    comment_count: commentCount,
  };
}

/**
 * Project a Comment row into a public-safe shape.
 * Handles both top-level comments and nested replies.
 */
export function toPublicComment(
  comment: Comment,
  author: User,
  replies: PublicComment[] = [],
  isAdmin = false,
): PublicComment {
  const { user_id, ...rest } = comment;

  return {
    ...rest,
    author: isAdmin
      ? { user_id: author.user_id, name: author.name, avatar: null }
      : buildAuthor(author, comment.is_anonymous),
    replies,
  };
}
