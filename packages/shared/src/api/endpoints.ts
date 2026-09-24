// 全部接口定义与路径。**路径字符串只允许出现在这个文件里** —— 迁移到小程序时
// 只需换 HttpAdapter，接口层零改动。

import type { HttpClient } from '../http/client'
import type { HealthResponse, Paginated } from '../types/api'
import type {
  ChatMessage,
  ConversationListItem,
  DirectConversationInput,
  MarkReadInput,
  MarkReadResult,
  MessagePage,
  MessageQuery,
  SendMessageInput,
} from '../types/chat'
import type {
  CancelMatchResult,
  CreateMatchInput,
  JoinMatchInput,
  JoinResult,
  LeaveResult,
  MatchDetail,
  MatchListQuery,
  MatchListItem,
  RegistrationsQuery,
} from '../types/match'
import type {
  CreateCommentInput,
  CreatePostInput,
  DeletePostResult,
  HotTag,
  LikeResult,
  PostCommentItem,
  PostDetail,
  PostListItem,
  PostListQuery,
} from '../types/post'
import type { AuthResponse, LoginInput, MeResponse, RegisterInput, UpdateProfileInput } from '../types/user'

export const API_PREFIX = '/api'

export const PATHS = {
  health: `${API_PREFIX}/health`,
  register: `${API_PREFIX}/auth/register`,
  login: `${API_PREFIX}/auth/login`,
  me: `${API_PREFIX}/users/me`,
  matches: `${API_PREFIX}/matches`,
  match: (id: number) => `${API_PREFIX}/matches/${id}`,
  matchCancel: (id: number) => `${API_PREFIX}/matches/${id}/cancel`,
  matchParticipants: (id: number) => `${API_PREFIX}/matches/${id}/participants`,
  matchLeave: (id: number) => `${API_PREFIX}/matches/${id}/participants/me`,
  myRegistrations: `${API_PREFIX}/me/registrations`,
  myMatches: `${API_PREFIX}/me/matches`,
  conversations: `${API_PREFIX}/conversations`,
  conversationDirect: `${API_PREFIX}/conversations/direct`,
  conversationMessages: (id: number) => `${API_PREFIX}/conversations/${id}/messages`,
  conversationRead: (id: number) => `${API_PREFIX}/conversations/${id}/read`,
  posts: `${API_PREFIX}/posts`,
  post: (id: number) => `${API_PREFIX}/posts/${id}`,
  postLike: (id: number) => `${API_PREFIX}/posts/${id}/like`,
  postComments: (id: number) => `${API_PREFIX}/posts/${id}/comments`,
  tagsHot: `${API_PREFIX}/tags/hot`,
  uploads: `${API_PREFIX}/uploads`,
} as const

export function createApi(http: HttpClient) {
  return {
    health: () => http.request<HealthResponse>({ method: 'GET', path: PATHS.health }),

    auth: {
      register: (input: RegisterInput) =>
        http.request<AuthResponse>({ method: 'POST', path: PATHS.register, body: input }),
      login: (input: LoginInput) =>
        http.request<AuthResponse>({ method: 'POST', path: PATHS.login, body: input }),
    },

    users: {
      me: () => http.request<MeResponse>({ method: 'GET', path: PATHS.me }),
      updateMe: (input: UpdateProfileInput) =>
        http.request<MeResponse>({ method: 'PATCH', path: PATHS.me, body: input }),
    },

    matches: {
      list: (query?: MatchListQuery) =>
        http.request<Paginated<MatchListItem>>({ method: 'GET', path: PATHS.matches, query }),
      detail: (id: number) => http.request<MatchDetail>({ method: 'GET', path: PATHS.match(id) }),
      create: (input: CreateMatchInput) =>
        http.request<MatchDetail>({ method: 'POST', path: PATHS.matches, body: input }),
      // 取消无需理由字段：数据模型里没有 cancelReason，先不接收以免「收了却丢掉」
      cancel: (id: number) => http.request<CancelMatchResult>({ method: 'POST', path: PATHS.matchCancel(id), body: {} }),
      join: (id: number, input?: JoinMatchInput) =>
        http.request<JoinResult>({ method: 'POST', path: PATHS.matchParticipants(id), body: input ?? {} }),
      leave: (id: number) =>
        http.request<LeaveResult>({ method: 'DELETE', path: PATHS.matchLeave(id) }),
    },

    me: {
      registrations: (query?: RegistrationsQuery) =>
        http.request<Paginated<MatchListItem>>({ method: 'GET', path: PATHS.myRegistrations, query }),
      matches: (query?: RegistrationsQuery) =>
        http.request<Paginated<MatchListItem>>({ method: 'GET', path: PATHS.myMatches, query }),
    },

    conversations: {
      list: () => http.request<ConversationListItem[]>({ method: 'GET', path: PATHS.conversations }),
      // 幂等：两人之间只可能有一个单聊会话
      direct: (input: DirectConversationInput) =>
        http.request<ConversationListItem>({ method: 'POST', path: PATHS.conversationDirect, body: input }),
      messages: (id: number, query?: MessageQuery) =>
        http.request<MessagePage>({ method: 'GET', path: PATHS.conversationMessages(id), query }),
      send: (id: number, input: SendMessageInput) =>
        http.request<ChatMessage>({ method: 'POST', path: PATHS.conversationMessages(id), body: input }),
      read: (id: number, input: MarkReadInput) =>
        http.request<MarkReadResult>({ method: 'POST', path: PATHS.conversationRead(id), body: input }),
    },

    posts: {
      list: (query?: PostListQuery) =>
        http.request<Paginated<PostListItem>>({ method: 'GET', path: PATHS.posts, query }),
      detail: (id: number) => http.request<PostDetail>({ method: 'GET', path: PATHS.post(id) }),
      create: (input: CreatePostInput) =>
        http.request<PostDetail>({ method: 'POST', path: PATHS.posts, body: input }),
      // 软删：仅作者可调，成功后从信息流消失
      remove: (id: number) => http.request<DeletePostResult>({ method: 'DELETE', path: PATHS.post(id) }),
      like: (id: number) => http.request<LikeResult>({ method: 'POST', path: PATHS.postLike(id), body: {} }),
      unlike: (id: number) => http.request<LikeResult>({ method: 'DELETE', path: PATHS.postLike(id) }),
      comment: (id: number, input: CreateCommentInput) =>
        http.request<PostCommentItem>({ method: 'POST', path: PATHS.postComments(id), body: input }),
    },

    tags: {
      hot: () => http.request<HotTag[]>({ method: 'GET', path: PATHS.tagsHot }),
    },
  }
}

export type Api = ReturnType<typeof createApi>