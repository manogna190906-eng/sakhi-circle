import { Pool } from 'pg';
import { Post, Comment, User, PublicPost, PublicComment } from '../types';
import { toPublicPost, toPublicComment } from '../utils/anonymity';

// Raw DB row for the post+user join.
// Defined separately to avoid the Post & User intersection conflict on 'status'.
interface PostUserRow {
  post_id: string;
  user_id: string;
  title: string;
  content: string;
  type: Post['type'];
  category: string;
  is_anonymous: boolean;
  status: Post['status'];
  created_at: string;
  name: string;
  email: string | null;
  phone: string | null;
  user_is_anonymous: boolean;
}

export class PostService {
  constructor(private db: Pool) {}

  /** Create a post. user_id is always persisted regardless of is_anonymous. */
  async createPost(params: {
    user_id: string;
    title: string;
    content: string;
    type: Post['type'];
    category: string;
    is_anonymous: boolean;
  }): Promise<Post> {
    const { rows } = await this.db.query<Post>(
      `INSERT INTO posts (user_id, title, content, type, category, is_anonymous)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        params.user_id,
        params.title,
        params.content,
        params.type,
        params.category,
        params.is_anonymous,
      ],
    );
    return rows[0];
  }

  /**
   * Get a single post with its comments.
   * isAdmin=true reveals real identities for anonymous content.
   */
  async getPost(
    postId: string,
    isAdmin = false,
  ): Promise<PublicPost & { comments: PublicComment[] }> {
    const { rows: postRows } = await this.db.query<PostUserRow>(
      `SELECT p.*, u.name, u.email, u.phone, u.is_anonymous AS user_is_anonymous
       FROM posts p
       JOIN users u ON u.user_id = p.user_id
       WHERE p.post_id = $1 AND p.status = 'published'`,
      [postId],
    );
    if (!postRows.length) throw new Error('Post not found');

    const row = postRows[0];
    const post: Post = {
      post_id: row.post_id,
      user_id: row.user_id,
      title: row.title,
      content: row.content,
      type: row.type,
      category: row.category,
      is_anonymous: row.is_anonymous,
      status: row.status,
      created_at: row.created_at,
    };
    const author: User = {
      user_id: row.user_id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      is_anonymous: row.user_is_anonymous,
      profile_visibility: 'public',
      bio: null,
      interests: [],
      role: 'user',
      status: 'active',
      created_at: row.created_at,
    };

    // Reaction counts
    const { rows: reactionRows } = await this.db.query<{ type: string; count: number }>(
      `SELECT type, COUNT(*)::int AS count FROM reactions WHERE post_id = $1 GROUP BY type`,
      [postId],
    );
    const reactionCounts: Record<string, number> = {};
    for (const r of reactionRows) reactionCounts[r.type] = r.count;

    // Top-level comments + authors
    const { rows: commentRows } = await this.db.query<Comment & { author_name: string }>(
      `SELECT c.*, u.name AS author_name
       FROM comments c
       JOIN users u ON u.user_id = c.user_id
       WHERE c.post_id = $1 AND c.parent_comment_id IS NULL AND c.status = 'published'
       ORDER BY c.created_at ASC`,
      [postId],
    );

    const comments: PublicComment[] = await Promise.all(
      commentRows.map(async (cr: Comment & { author_name: string }) => {
        const commentAuthor: User = {
          user_id: cr.user_id,
          name: cr.author_name,
          email: null,
          phone: null,
          is_anonymous: false,
          profile_visibility: 'public',
          bio: null,
          interests: [],
          role: 'user',
          status: 'active',
          created_at: cr.created_at,
        };

        const { rows: replyRows } = await this.db.query<Comment & { author_name: string }>(
          `SELECT c.*, u.name AS author_name
           FROM comments c
           JOIN users u ON u.user_id = c.user_id
           WHERE c.parent_comment_id = $1 AND c.status = 'published'
           ORDER BY c.created_at ASC`,
          [cr.comment_id],
        );

        const replies: PublicComment[] = replyRows.map((rr: Comment & { author_name: string }) => {
          const replyAuthor: User = {
            user_id: rr.user_id,
            name: rr.author_name,
            email: null,
            phone: null,
            is_anonymous: false,
            profile_visibility: 'public',
            bio: null,
            interests: [],
            role: 'user',
            status: 'active',
            created_at: rr.created_at,
          };
          const reply: Comment = {
            comment_id: rr.comment_id,
            post_id: rr.post_id,
            user_id: rr.user_id,
            parent_comment_id: rr.parent_comment_id,
            content: rr.content,
            is_anonymous: rr.is_anonymous,
            status: rr.status,
            created_at: rr.created_at,
          };
          return toPublicComment(reply, replyAuthor, [], isAdmin);
        });

        const comment: Comment = {
          comment_id: cr.comment_id,
          post_id: cr.post_id,
          user_id: cr.user_id,
          parent_comment_id: cr.parent_comment_id,
          content: cr.content,
          is_anonymous: cr.is_anonymous,
          status: cr.status,
          created_at: cr.created_at,
        };
        return toPublicComment(comment, commentAuthor, replies, isAdmin);
      }),
    );

    const publicPost = toPublicPost(post, author, reactionCounts, comments.length, isAdmin);
    return { ...publicPost, comments };
  }

  /** Create a comment or reply. is_anonymous is stored per-comment. */
  async createComment(params: {
    post_id: string;
    user_id: string;
    content: string;
    is_anonymous: boolean;
    parent_comment_id?: string;
  }): Promise<Comment> {
    const { rows } = await this.db.query<Comment>(
      `INSERT INTO comments (post_id, user_id, content, is_anonymous, parent_comment_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        params.post_id,
        params.user_id,
        params.content,
        params.is_anonymous,
        params.parent_comment_id ?? null,
      ],
    );
    return rows[0];
  }

  /** Soft-delete a post (author or admin only). */
  async deletePost(postId: string, requesterId: string, isAdmin: boolean): Promise<void> {
    const { rows } = await this.db.query<{ user_id: string }>(
      `SELECT user_id FROM posts WHERE post_id = $1`,
      [postId],
    );
    if (!rows.length) throw new Error('Post not found');
    if (!isAdmin && rows[0].user_id !== requesterId) throw new Error('Forbidden');

    await this.db.query(
      `UPDATE posts SET status = 'removed' WHERE post_id = $1`,
      [postId],
    );
  }
}
