import type { RouteRecordRaw } from 'vue-router'
import ChatPage from '../pages/ChatPage.vue'
import CommunityPage from '../pages/CommunityPage.vue'
import DiscoverPage from '../pages/DiscoverPage.vue'
import LoginPage from '../pages/LoginPage.vue'
import MatchDetailPage from '../pages/MatchDetailPage.vue'
import MessagesPage from '../pages/MessagesPage.vue'
import MyMatchesPage from '../pages/MyMatchesPage.vue'
import MyRegistrationsPage from '../pages/MyRegistrationsPage.vue'
import NotFoundPage from '../pages/NotFoundPage.vue'
import PostDetailPage from '../pages/PostDetailPage.vue'
import PostNewPage from '../pages/PostNewPage.vue'
import ProfilePage from '../pages/ProfilePage.vue'
import PublishPage from '../pages/PublishPage.vue'

// 路由表与 name 常量：跳转处只引用 RouteName，不写字面量字符串
export const ROUTE_NAMES = {
  discover: 'discover',
  community: 'community',
  // 发帖与帖子详情：不带 meta.tab，底栏自动隐藏
  postNew: 'post-new',
  postDetail: 'post-detail',
  messages: 'messages',
  // 聊天页：全屏，不带 meta.tab 所以底栏自动隐藏
  conversation: 'conversation',
  matchDetail: 'match-detail',
  publish: 'publish',
  myRegistrations: 'my-registrations',
  myMatches: 'my-matches',
  profile: 'profile',
  login: 'login',
  notFound: 'not-found',
} as const

export type RouteName = (typeof ROUTE_NAMES)[keyof typeof ROUTE_NAMES]

// meta.tab 决定底栏显隐（只有 4 个 tab 页为 true）；meta.title 是顶栏标题
export const routes: RouteRecordRaw[] = [
  { path: '/', name: ROUTE_NAMES.discover, component: DiscoverPage, meta: { tab: true, title: '发现约球' } },
  {
    path: '/community',
    name: ROUTE_NAMES.community,
    component: CommunityPage,
    meta: { tab: true, title: '社区' },
  },
  {
    path: '/community/new',
    name: ROUTE_NAMES.postNew,
    component: PostNewPage,
    meta: { requiresAuth: true, title: '发布动态' },
  },
  {
    path: '/community/:id',
    name: ROUTE_NAMES.postDetail,
    component: PostDetailPage,
    meta: { title: '动态详情' },
  },
  {
    path: '/messages',
    name: ROUTE_NAMES.messages,
    component: MessagesPage,
    meta: { tab: true, requiresAuth: true, title: '消息' },
  },
  {
    path: '/messages/:id',
    name: ROUTE_NAMES.conversation,
    component: ChatPage,
    // 标题在页面里用 ui.pageTitle 覆盖成对方昵称 / 球局标题
    meta: { requiresAuth: true, title: '聊天' },
  },
  {
    path: '/matches/:id',
    name: ROUTE_NAMES.matchDetail,
    component: MatchDetailPage,
    meta: { title: '球局详情' },
  },
  {
    path: '/publish',
    name: ROUTE_NAMES.publish,
    component: PublishPage,
    meta: { requiresAuth: true, title: '发布约球' },
  },
  {
    path: '/me/registrations',
    name: ROUTE_NAMES.myRegistrations,
    component: MyRegistrationsPage,
    meta: { requiresAuth: true, title: '我的报名' },
  },
  {
    path: '/me/matches',
    name: ROUTE_NAMES.myMatches,
    component: MyMatchesPage,
    meta: { requiresAuth: true, title: '我发布的' },
  },
  {
    path: '/me',
    name: ROUTE_NAMES.profile,
    component: ProfilePage,
    meta: { tab: true, requiresAuth: true, title: '我的' },
  },
  { path: '/login', name: ROUTE_NAMES.login, component: LoginPage, meta: { title: '登录 / 注册' } },
  { path: '/:pathMatch(.*)*', name: ROUTE_NAMES.notFound, component: NotFoundPage, meta: { title: '页面不存在' } },
]