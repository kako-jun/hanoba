// 简体中文文案（#147 阶段1）。
//
// `Partial<Record<MessageKey, string>>`＝**不强制完备**（优先灵活·#147）。
// 未翻译的键会在 t.ts 中回退到 ja＝即使翻译有缺口也不会出错。
//
// 世界观文案不直译，而是意译（保留品牌的气息）：
// - 「育てて、見せる。」→ "种下它，亮出它。"
// - 「みんなの植物 / あなたの植物」→ "大家的植物 / 你的植物"

import type { MessageKey } from "./ja.ts";

export const zh: Partial<Record<MessageKey, string>> = {
  "nav.discover": "大家的植物",
  "nav.me": "你的植物",
  "nav.compose": "发布",
  "nav.ranking": "市情普查",
  "nav.vote": "市民投票",
  "nav.gazette": "市政通讯",
  "nav.menu.open": "打开菜单",
  "nav.menu.close": "关闭菜单",
  "nav.home.aria": "Hanōba 首页",

  "footer.nav.aria": "页脚导航",
  "footer.tagline": "Hanōba：一座由大家共同培育的、爱植物之人的虚构城市。",

  "scrollToTop.aria": "回到顶部",

  "install.title": "添加到主屏幕",
  "install.ios":
    "点击分享菜单里的 {arrow}，选择「添加到主屏幕」，就能像应用一样打开。",
  "install.tagline": "像应用一样打开。",
  "install.add": "添加",
  "install.later": "以后再说",

  "common.close": "关闭",
  "common.retry": "重试",

  "time.justNow": "刚刚",
  "time.minutesAgo": "{n} 分钟前",
  "time.hoursAgo": "{n} 小时前",
  "time.daysAgo": "{n} 天前",

  "card.photo.zoom": "放大照片",
  "card.photos.count": "{n}",
  "card.author.profile": "{name} 的主页",
  "card.author.profileWithId": "{name}（{id}）的主页",
  "author.unnamed": "旅人",
  "card.readMore": "查看更多",
  "reaction.likes.aria": "{n} 个赞",
  "reaction.comments.aria": "{n} 条评论",
  "fuda.search.title": "搜索 {label}",
  "filter.remove.aria": "移除「{tag}」",

  "feed.error": "无法加载动态。",
  "feed.empty": "还没有帖子。",
  "feed.error.short": "无法加载。",
  "feed.filter.clear": "清除筛选",
  "feed.tag.empty": "「#{tag}」还没有帖子。",
  "discover.loading": "正在搜索「{summary}」…",
  "discover.empty": "没有找到「{summary}」的帖子。换个品种试试吧。",

  "my.subject": "你",
  "my.empty": "你还没有放下任何植物。",
  "my.edit.aria": "编辑这篇帖子",
  "my.delete.aria": "删除这篇帖子",
  "my.edit.done": "帖子已编辑（作为新帖子重新发布）。",
  "my.delete.photoUnconfirmed":
    "帖子已删除，但我们无法确认照片是否已被移除（可能会在几分钟后消失）。",
  "my.delete.failed": "删除失败。请稍后再试。",
  "my.firstPost": "放下你的第一株",
  "my.loading.sr": "正在加载你的植物…",
  "my.delete.confirm.q": "连同照片一起删除吗？",
  "my.delete.confirm.note": "（无法撤销）",
  "my.delete.confirm.yes": "删除",
  "my.delete.confirm.no": "取消",
  "my.delete.deleting": "删除中…",

  "home.hero.title": "种下它，亮出它。",
  "home.hero.lead":
    "一个分享植物照片的社交动态。比 Instagram 更快更简单——只需加一个词。农作物、鹿角蕨、幼苗：全都汇于一处。",
  "home.hero.sub":
    "这是保存在 Hanōba 里的植物时间线。想看遍整个 Nostr 的植物，请前往 {link}。",
  "home.hero.sub.link": "大家的植物",

  "fab.compose.aria": "发布",

  "site.description":
    "一个分享植物照片的社交动态。比 Instagram 更快更简单——只需加一个词。",

  "meta.about.title": "关于 Hanōba——一座虚构的植物之城",
  "meta.about.description":
    "Hanōba 是一个分享植物照片的社交动态——一座由我们大家共同培育、爱植物之人的虚构城市。",
  "meta.compose.title": "发布 — Hanōba",
  "meta.discover.title": "大家的植物 — Hanōba",
  "meta.discover.description":
    "和 Hanōba 的帖子一起，浏览整个 Nostr（#plantstr）的植物。",
  "meta.me.title": "你的植物 — Hanōba",
  "meta.me.description":
    "你在 Hanōba 放下的植物。你可以在这里删除帖子（连同照片）。",
  "meta.ranking.title": "市情普查 — Hanōba",
  "meta.ranking.description":
    "当下正流行的品种，每周从 Hanōba 的帖子中统计——并附上较上周的变化（↑↓、NEW、RE）。",
  "meta.u.title": "市民主页 — Hanōba",
  "meta.u.description":
    "一位 Hanōba 市民的公开主页——他放下的植物，以及活动数据（帖子、照片、栽培过的品种、居住天数）。",
  "meta.vote.title": "居民投票 — Hanōba 市政厅",
  "meta.vote.description":
    "Hanōba 市政厅的居民投票。品种排序、功能请求、错误报告——在留言板上留下一笔吧。署名自愿。",
  "meta.gazette.title": "市政通讯 — Hanōba",
  "meta.gazette.description":
    "市长 Botanics von Hanōba 亲笔撰写的城市动态：新开的市政窗口、新功能与改进，以市政通讯的形式呈送。",

  "discover.lead": "和 Hanōba 的帖子一起，浏览整个 Nostr（#plantstr）的植物。",
  "me.lead": "你放下的那些。删除一篇，帖子和它的照片会一同消失。",
  "ranking.lead":
    "咳咳。这里是市情普查处。当下正流行的品种，每周从市民们的帖子中统计——并附上较上周的变化（↑↓、NEW、RE）。每一位市民的帖子，都在推动这张图表。",

  "vote.h1": "居民投票",
  "vote.intro":
    "咳咳。这里是居民的投票箱。对城中事务有话要说的市民们——尽管畅所欲言。即便不署名，一票也算数。市长会逐一过目。",
  "vote.note": "* 每个版块都是一块留言板。请自由书写（署名自愿）。",
  "vote.board.aria": "居民投票 — {title}",
  "vote.board.requests.title": "品种请求",
  "vote.board.requests.intro":
    "关于品种的一切心愿都写在这里——排序、登记册里缺的品种，随便什么都行。无需顾虑。市长会全部阅读。",
  "vote.board.features.title": "功能请求",
  "vote.board.features.intro":
    "为这座城市该有的任何机制请愿吧。市长会处理的（也许）。",
  "vote.board.bugs.title": "错误报告",
  "vote.board.bugs.intro": "在城里发现了故障？请在这里报告。维修队会立刻出动。",

  "citizen.level.traveler": "旅人",
  "citizen.level.citizen": "市民",

  "stats.subject.default": "这位市民",
  "stats.activity.heading": "{subject}的活动",
  "stats.posts.label": "帖子",
  "stats.posts.unit": "",
  "stats.photos.label": "照片",
  "stats.photos.unit": "",
  "stats.varieties.label": "品种",
  "stats.varieties.unit": "",
  "stats.tenure.label": "居住",
  "stats.tenure.unit": "天",
  "stats.varieties.grown": "栽培过的品种",
  "stats.variety.filterTitle": "按 {label} 筛选大家的植物",
  // 栽培品种的横向翻页（#388：笔记本滑动 + 模糊翻页，每页 10 个）。
  "stats.varieties.pager.aria": "翻阅栽培过的品种",
  "stats.varieties.pager.prev": "上一页",
  "stats.varieties.pager.next": "下一页",
  "stats.varieties.pager.indicator": "{page} / {total}",

  "green.heading": "{subject}为城市增添的绿意",
  "green.cumulative.label": "全绿照片",
  "green.cumulative.value": "≈{equivalent} 张",
  "green.measuring": "（正在测量绿意…）",

  "activity.heading": "拍摄草地",
  "activity.heading.note": "（最近 {weeks} 周）",
  "activity.streak.current": "当前连续",
  "activity.streak.longest": "最长",
  "activity.streak.days": "天",
  "activity.legend.low": "低",
  "activity.legend.high": "高",

  "profile.subject.default": "市民",
  "profile.subject.withId": "{name}（{id}）",
  "profile.notFound": "找不到这位市民的主页。",
  "profile.toDiscover": "前往大家的植物",
  "profile.isMe": "这是你的公开主页（前往你的植物）",
  "profile.favorites": "喜爱的品种",
  "profile.loading.sr": "正在加载这位市民的植物…",
  "profile.empty": "这位市民还没有植物。",

  "compose.account.prompt": "很高兴认识你。你想用什么用户名？",
  "compose.photos.heading": "照片",
  "compose.photos.count": "{count}/{max}",
  "compose.photos.limitNotice": "最多 4 张照片。已尽量添加。",
  "compose.photos.thumbAlt": "照片 {n}",
  "compose.reorder.left.aria": "将选中的照片左移",
  "compose.reorder.left": "左移",
  "compose.reorder.right.aria": "将选中的照片右移",
  "compose.reorder.right": "右移",
  "compose.reorder.counter": "照片 {index} / {total}",
  "compose.undo": "撤销",
  "compose.undo.aria": "撤销上一次图像编辑（旋转、滤镜、裁剪、拍摄日期）",
  "compose.filter.heading": "滤镜",
  "compose.shotDate.heading": "拍摄日期",
  "compose.shotDate.auto": "已自动识别。",
  "compose.shotDate.input.aria": "这张照片的拍摄日期",
  "compose.shotDate.exclude": "不包含日期",
  "compose.shortfall.name": "一个用户名",
  "compose.shortfall.photo": "一张照片",
  "compose.shortfall.caption": "一个词",
  "compose.shortfall.lead": "再添加",
  "compose.shortfall.trail": "即可发布",
  "compose.action.removeOne": "移除这张照片",
  "compose.action.resetImage": "换一张照片",
  "compose.submit.uploading": "正在发送照片 {done}/{total}",
  "compose.submit.publishing": "发布中…",
  "compose.submit": "发布",
  "compose.done": "已发布。正前往你的植物…",
  "compose.error.notConfirmed":
    "无法确认帖子是否发布。请在网络更好时再试（你的草稿已保留）。",
  "compose.error.generic": "发布失败。",
  "compose.error.imageLoad": "无法加载图像。",

  "crop.image.alt": "待裁剪的照片",
  "crop.rotate.label": "旋转",
  "crop.rotate.left90.aria": "将照片向左旋转 90°",
  "crop.rotate.left90": "左转 90°",
  "crop.rotate.fineLeft.aria": "向左 0.5°",
  "crop.rotate.fineRight.aria": "向右 0.5°",
  "crop.rotate.slider.aria": "微调角度（0.5° 步进）",
  "crop.rotate.right90.aria": "将照片向右旋转 90°",
  "crop.rotate.right90": "右转 90°",
  "crop.dragHint": "拖动取景框来定位。",

  "caption.label": "一个词",
  "caption.placeholder":
    "关于你的植物。一个词，或更多。也可以加上 #龙舌兰 这样的标签。",
  "caption.suggest.aria": "标签建议",

  "filter.strength.none": "关",
  "filter.strength.weak": "低",
  "filter.strength.medium": "中",
  "filter.strength.strong": "高",
  "filter.group.aria": "叠加滤镜",
  "filter.chip.aria": "{name}（{strength}）",

  "picker.shoot": "相机",
  "picker.album": "相册",
  "picker.hint": "拍一张你植物的照片，或从相册里选。最多 4 张。",
  "picker.error.notImage": "请选择图像文件（视频无法发布）。",
  "picker.error.limit": "最多 4 张照片。",
  "picker.add.aria": "添加一张照片",
  "picker.camera.aria": "用相机拍摄",
  "picker.gallery.aria": "从相册选择",

  "tag.heading.filter": "按品种筛选",
  "tag.heading.compose": "选择标签",
  "tag.fromPlants": "从植物中选择",
  "tag.breadcrumb.root": "植物",
  "tag.group.recent": "最近",
  "tag.group.popular": "热门",
  "tag.overflow.button": "更多",
  "tag.overflow.aria": "更多 {label} 标签",
  "tag.overflow.count": "{label}（还有 {n} 个）",
  "tag.overflow.dialog.aria": "{label} 标签",
  "tag.overflow.close.aria": "关闭标签列表",
  "tag.request": "这株植物不在这里 → 请求添加",
  "tag.back.aria": "退回上一步",
  "tag.back": "‹ 返回",
  "tag.close.aria": "关闭细分",
  "tag.search.aria": "搜索标签",
  "tag.search.placeholder": "搜索品种和属（例如 Titanota）",
  "tag.dict.loading": "正在加载词典…",
  "tag.dict.error": "无法加载词典。请重试。",
  "tag.noResults": "没有匹配项",
  "tag.category.label": "分类",
  "tag.useFreeform": "直接使用 #{tag}",
  "tag.useCategory": "直接使用 #{label}",
  "tag.useGenus": "直接使用 #{name}",

  "account.handle.unset": "未设置用户名",
  "account.name.clear": "清除输入",
  "account.name.import.label": "用你已有的账号继续",
  "account.name.import.placeholder": "粘贴 nsec1…",
  "account.name.import.aria": "nsec 私钥",
  "account.name.import.error.invalid":
    "这个 nsec 无效。请粘贴一个「nsec1…」密钥。",
  "account.name.import.help":
    "你可以用在 mypace 等地方使用的账号继续。你的信息只保存在本设备上。",
  "account.name.import.cancel": "取消",
  "account.name.import.submitting": "检查中…",
  "account.name.import.submit": "继续",
  "account.name.edit.placeholder": "用户名（之后可以更改）",
  "account.name.edit.aria": "用户名",
  "account.name.edit.save": "保存",
  "account.name.edit.hint": "设置用户名后，你就不只是浏览，还能发布。",
  "account.name.edit.haveAccount": "已经有账号了？",
  "account.name.set": "设置用户名",
  "account.name.change": "更改用户名",
  "account.name.changeAccount": "切换账号",

  "account.profile.heading": "个人资料",
  "account.profile.sub": "头像、简介、网站",
  "account.profile.edit": "编辑",
  "account.profile.editHint": "请先设置用户名。",
  "account.profile.icon.label": "头像",
  "account.profile.icon.uploading": "上传中…",
  "account.profile.icon.pick": "选择一张图片",
  "account.profile.icon.remove": "移除",
  "account.profile.icon.urlPlaceholder": "或粘贴图片网址（https://…）",
  "account.profile.icon.urlAria": "头像图片网址",
  "account.profile.icon.uploadError": "无法上传图片。请稍后再试。",
  "account.profile.about.label": "简介",
  "account.profile.about.placeholder": "你的植物、喜爱的品种等等",
  "account.profile.sites.label": "网站和社交媒体",
  "account.profile.sites.hint":
    "它们会作为图标排列在放大照片的作者区域。每个人都能把访客引导到自己的网站。",
  "account.profile.sites.urlPlaceholder": "https://…",
  "account.profile.sites.urlAria": "网站 {n} 的网址",
  "account.profile.sites.clearAria": "清除网站 {n}",
  "account.profile.sites.moveUpAria": "上移网站 {n}",
  "account.profile.sites.moveDownAria": "下移网站 {n}",
  "account.profile.sites.removeAria": "移除网站 {n}",
  "account.profile.sites.add": "＋ 添加一个网站",
  "account.profile.nameMissing": "请先在上方设置用户名。",
  "account.profile.saved": "已保存。",
  "account.profile.saveError": "无法保存（已保存在本设备上）。",
  "account.profile.saving": "保存中…",
  "account.profile.save": "保存",
  "account.profile.nsec.label": "私钥（备份）",
  "account.profile.nsec.warning":
    "如果不保存这个密钥，一旦你更换设备或清除浏览器数据，就再也无法找回账号。此外，任何知道这个密钥的人都能掌控你的全部帖子。不要给任何人看，也不要粘贴到任何地方。",
  "account.profile.nsec.codeAria": "私钥（nsec）",
  "account.profile.nsec.hideAria": "隐藏私钥",
  "account.profile.nsec.showAria": "显示私钥",
  "account.profile.nsec.hide": "隐藏",
  "account.profile.nsec.show": "显示",
  "account.profile.nsec.copyAria": "复制私钥",
  "account.profile.nsec.copy": "复制",
  "account.profile.nsec.copied": "已复制",

  "account.favorites.hint":
    "它们会显示在你的主页上。找到同样喜爱这些品种的人。",
  "account.favorites.removeAria": "从喜爱的品种中移除 {name}",
  "account.favorites.search.aria": "搜索品种",
  "account.favorites.dict.empty": "—",
  "account.favorites.useFreeform": "直接添加「{freeform}」",

  "detail.dialog.aria": "帖子详情",
  "detail.photo.alt": "{caption}（{n}）",
  "detail.photo.prev": "上一张照片",
  "detail.photo.next": "下一张照片",
  "detail.photo.goto": "显示照片 {n}",
  "detail.fuda.heading": "这篇帖子里的植物",
  "detail.translate": "翻译",
  "detail.translate.original": "显示原文",
  "detail.translate.busy": "翻译中…",
  "detail.likes.loading": "加载中",
  "detail.likes.like.aria": "{n} 个赞。点击点赞。",
  "detail.likes.unlike.aria": "{n} 个赞。再次点击取消点赞。",
  "detail.likes.sending": "正在点赞",
  "detail.likes.unsending": "正在取消点赞",
  "detail.likes.error": "点赞发送失败，请重试。",
  "detail.likes.unlike.error": "取消点赞失败，请重试。",
  "detail.share.aria": "分享到 X",
  "detail.share.split.aria": "分享到 X（拆分）",
  "detail.share.whole": "全文",

  "comment.section.aria": "评论",
  "comment.heading": "评论",
  "comment.sort.toNew": "按从新到旧排序",
  "comment.sort.toOld": "按从旧到新排序",
  "comment.sort.old": "最旧优先",
  "comment.sort.new": "最新优先",
  "comment.loading": "加载中…",
  "comment.error.submit": "无法发送你的评论。请稍候再试。",
  "comment.error.remove": "无法删除评论。",
  "comment.empty": "还没有评论",
  "comment.delete.aria": "删除这条评论",
  "comment.delete.label": "删除",
  "comment.delete.confirm.q": "删除这条吗？",
  "comment.delete.confirm.no": "取消",
  "comment.deleting": "删除中…",
  "comment.input.aria": "写评论",
  "comment.input.clear": "清除评论",
  "comment.input.placeholder": "写一条评论…",
  "comment.submit": "评论",
  "comment.submit.posting": "发布中…",

  "edit.dialog.aria": "编辑帖子",
  "edit.heading": "编辑帖子",
  "edit.caption.label": "正文",
  "edit.caption.placeholder": "一个词（也可以在正文里写 #标签）",
  "edit.error": "无法编辑。请稍候再试。",
  "edit.confirm.lead": "编辑",
  "edit.confirm.repost": "会把它作为新帖子重新发布",
  "edit.confirm.mid": "，并且",
  "edit.confirm.has.prefix": "这篇帖子的",
  "edit.confirm.has.counts": "{likes} 个赞和 {comments} 条评论",
  "edit.confirm.has.suffix": "不会保留。",
  "edit.confirm.none": "原帖子的赞和评论不会保留。",
  "edit.confirm.q": "确定吗？",
  "edit.back": "返回",
  "edit.confirm.submit": "编辑并重新发布",
  "edit.cancel": "取消",
  "edit.saving": "重新发布中…",
  "edit.update": "更新",

  "ranking.board.loading": "加载中…",
  "ranking.board.error": "无法加载排行榜。",
  "ranking.board.reload": "重新加载",
  "ranking.board.empty": "帖子还不够多，暂时无法显示排行榜。",
  "ranking.board.firstPost": "发布第一盆",
  "ranking.board.demo": "开发预览（?demo）——合成数据，并非真实帖子。",
  "ranking.board.firstWeek": "这是统计的第一周。与上周的对比（↑↓）从下周开始。",
  "ranking.board.count.unit": "",
  "ranking.board.chart.loading": "正在加载图表…",
  "ranking.board.delta.new": "新上榜",
  "ranking.board.delta.re": "重返榜单",
  "ranking.board.delta.same": "无变化",
  "ranking.board.delta.up": "上升 {by}",
  "ranking.board.delta.down": "下降 {by}",
  "ranking.board.rowSummary": "第 {rank} 名 {sci} {count} 篇帖子 {delta}",

  "ranking.chart.sparse": "积累两周以上后，趋势图就会出现。",
  "ranking.chart.caption": "进展（变动）——每周帖子数。准确排名请见上方表格。",
  "ranking.chart.summary":
    "一张展示最热门品种（{names}）每周帖子数的图表。详情请见上方表格。",

  "dilution.stop.none": "无",
  "dilution.trigger.idle": "调整 {name} 的出现方式",
  "dilution.trigger.active": "将 {name} 减少到 1/{n}",
  "dilution.heading": "在动态里少显示一些 {name} 的帖子",
  "dilution.slider.aria": "在动态里把 {name} 的帖子减少多少",

  "input.clear": "清除输入",
  "input.resizeHandle.aria": "调整输入框高度",

  "feed.skeleton.loading.sr": "正在加载植物…",

  // 关于标签（aboutLabel.ts·#262）。访客＝通往世界的入口；市民＝你自己的书。
  "about.label.visitor": "关于 Hanōba",
  "about.label.citizen": "市民手册",

  // Hanōba 市民手册（cityHall.ts / CityHallBook·#163）。由市长 Botanics von Hanōba 讲述。
  "cityHall.book.title": "Hanōba 市民手册",
  "cityHall.mayor.name": "Botanics von Hanōba",
  "cityHall.mayor.shortName": "Botanics",
  // P1 欢迎（市长的问候致辞）。
  "cityHall.welcome.title": "一封定居的邀请",
  "cityHall.welcome.0":
    "咳咳。我是 Hanōba 的市长，Botanics von Hanōba。欢迎来到这座绿色之城。",
  "cityHall.welcome.1":
    "在我的城里，土地不收租。只要你种着一株植物，那块地就永远免费地属于你。要做的只有一件事——在一块方形的地里种下你自己的一盆，再添上一个词。如此，你也就是一位堂堂正正的市民了。只发植物的照片（人和宠物，请带到别的城去）。",
  "cityHall.welcome.2":
    "城市的编年史、它的法令、它的花展——都能从这座市政厅查看。来吧，去办理定居的手续。决定一个你喜欢的名字，事情就办妥了。无需真名——只要你是你自己，就足够了。",
  "cityHall.welcome.3":
    "* Hanōba 是一个只发植物的照片 SNS。一张方形照片 + 一个词，只发植物。注册一个名字即可发布。",
  // P2 城市地图（图鉴的早期奖励页；末尾附「市政窗口」一栏）。
  "cityHall.map.title": "城市地图",
  "cityHall.map.lead":
    "咳咳。这便是我市的地图。Hanōba 宛如一片叶子，沿着叶脉河铺展开来。",
  "cityHall.map.landmark.0.name": "叶脉河",
  "cityHall.map.landmark.0.text":
    "城市的脊梁。每一方地块，都从这条河的叶脉中分得水源。",
  "cityHall.map.landmark.1.name": "方形地块",
  "cityHall.map.landmark.1.text":
    "首任市长定下的规矩。每一座庭院都同样方正。无论大小，对本市而言皆是珍宝。",
  "cityHall.map.landmark.2.name": "市政厅",
  "cityHall.map.landmark.2.text": "诸位此刻所在之处。市政窗口，就在其下。",
  "cityHall.map.note": "市徽与特产已记在后页。诸君游览时，可与这幅地图一并参阅。",
  "cityHall.map.placeholder": "地图绘制中",
  "cityHall.map.civic.heading": "市政窗口",
  "cityHall.map.civic.0.label": "市民投票",
  "cityHall.map.civic.1.label": "花展（比赛）",
  "cityHall.map.civic.2.label": "市政通讯",
  "cityHall.map.civic.3.label": "市情普查",
  "cityHall.map.comingSoon": "即将开放",
  "cityHall.districts.title": "街区指南",
  "cityHall.districts.lead":
    "咳咳。植物喜好不同，宜居之地自然也不同。让我为诸位的一盆引路。",
  "cityHall.districts.0.name": "温室街",
  "cityHall.districts.0.text":
    "为观叶植物与兰花而设，充满光线与湿气的玻璃街区。",
  "cityHall.districts.0.note": "清晨先读玻璃后的日光，到了中午，喷雾声便响遍街巷。",
  "cityHall.districts.1.name": "田园区",
  "cityHall.districts.1.text": "蔬菜与香草的方形地块，共享叶脉河的水。",
  "cityHall.districts.1.note": "开水渠的时刻要与邻畦商量，收获篮则在凉亭下共同分享。",
  "cityHall.districts.2.name": "果树丘",
  "cityHall.districts.2.text": "柑橘与果树成行，花朵与香气随四季更替。",
  "cityHall.districts.2.note": "坡顶风更畅。花期相助授粉，果熟时则彼此帮忙采收。",
  "cityHall.districts.3.name": "实生巷",
  "cityHall.districts.3.text":
    "热爱种子与嫩芽的人聚集的小巷。盆越小，未来越大。",
  "cityHall.districts.3.note": "门前小牌记下播种日，多余的种子放入巷中的交换箱。",
  "cityHall.districts.4.name": "养护街",
  "cityHall.districts.4.text": "交流换盆、修剪与浇水智慧的市民共享苗圃。",
  "cityHall.districts.4.note": "工作台与工具皆为公用。带来一盆弱株，自会有人以经验相助。",
  // P3 编年史。以市长的前言开篇（每页皆以市长之声起首·#469 变更B）。
  "cityHall.guide.vista": "城市全景",
  "cityHall.guide.landmarks": "叶脉河与名胜",
  "cityHall.guide.crest": "市徽",
  "cityHall.guide.crest.text": "米色底面、两根绿色立柱与一条粉色横杠组成字母 H——这就是 Hanōba 的市旗与市徽。",
  "cityHall.guide.specialties": "特产",
  "cityHall.guide.specialties.text": "观叶植物、田园收成、果树、种子嫩芽与养护工具，是五个街区的骄傲。",
  "cityHall.nav.jumpBack": "后退5页",
  "cityHall.nav.jumpForward": "前进5页",
  "book.nav.first": "第一页",
  "book.nav.last": "最后一页",
  "cityHall.nav.toc": "目录",
  "cityHall.chronicle.title": "编年史",
  "cityHall.chronicle.lead": "咳咳。容我略述我市的来历。",
  "cityHall.chronicle.entry.0.era": "元年·春",
  "cityHall.chronicle.entry.0.text":
    "首任市长 Botanics von Hanōba 在荒原上种下第一盆。新芽冒出的那天被定为城市的诞生之日。",
  "cityHall.chronicle.entry.1.era": "元年·夏",
  "cityHall.chronicle.entry.1.text":
    "市长宣告：「没有一株植物叫杂草。」永远禁止制定任何把一株植物排在另一株之上的法令。",
  "cityHall.chronicle.entry.2.era": "元年·秋",
  "cityHall.chronicle.entry.2.text": "叶脉河的水首次滋润了温室街区。",
  "cityHall.chronicle.entry.3.era": "元年·冬",
  "cityHall.chronicle.entry.3.text":
    "法令定下所有地块皆为方形。理由仅记作「因为它很美」。",
  "cityHall.chronicle.note": "每当一位市民到来，这部编年史便继续书写下去。",
  // P4 城市法令（Hanōba 宪章，每一条都附市长的注解）。以市长的前言开篇（#469 变更B）。
  "cityHall.ordinance.title": "城市法令",
  "cityHall.ordinance.lead":
    "咳咳。这便是我市的宪章。虽显刻板，但每一条都是为植物而立的规矩。",
  "cityHall.ordinance.0.article": "第一条（土地）",
  "cityHall.ordinance.0.text":
    "Hanōba 市的土地租金应当免费，只要其上种着一株植物。",
  "cityHall.ordinance.0.commentary":
    "栽培的意愿本身就是你的租金。浇水、凝视一片叶子——如此，你便已付清了全款。",
  "cityHall.ordinance.1.article": "第二条（地块）",
  "cityHall.ordinance.1.text": "每一块地都应附上一张方形照片，和一个词。",
  "cityHall.ordinance.1.commentary":
    "地块是方形的，且只能是方形。为何？因为它们很美。这理由便足够了。",
  "cityHall.ordinance.2.article": "第三条（居民）",
  "cityHall.ordinance.2.text": "凡取了名字者，应视为市民。",
  "cityHall.ordinance.2.commentary":
    "取一个名字，就是提交定居的申请。它不必是你的真名。只要你是你自己，就足够了。",
  "cityHall.ordinance.3.article": "第四条（平等）",
  "cityHall.ordinance.3.text":
    "城市平等地爱着每一株植物。这座城里没有一株植物叫杂草。",
  "cityHall.ordinance.3.commentary":
    "阴影里的苔藓、屋檐下的多肉——都是城市的珍宝。把它们排出高下的法令，永远不会颁布。",
  "cityHall.ordinance.4.article": "第五条（照片）",
  "cityHall.ordinance.4.text": "在这座城里展示的照片，应当只有植物。",
  "cityHall.ordinance.4.commentary":
    "让人和宠物各自在自己的城里闪耀吧。这是一座植物之城。",
  // 升级时附上的市长简短寄语。
  "cityHall.flavor.citizen": "你的定居业已如实受理。欢迎诸位市民。",
  "cityHall.flavor.tenured":
    "咳咳。如今你已是城市的老朋友了。我已为你敞开了内厅。",
  // CityHallBook 界面元素。
  "cityHall.mayorTitle": "{name} 市长",
  "book.nav.aria": "翻页",
  "book.nav.prev": "上一页",
  "book.nav.prev.label": "返回",
  "book.nav.next": "下一页",
  "book.nav.next.label": "下一页",
  "book.nav.indicator": "{page} / {total}",

  // 市政通讯（gazette.ts / GazetteBook · #164）。以市长 Botanics von Hanōba 之声撰写的静态更新记录，
  // 与市民手册共用同一套本页翻页组件（BookPager）。条目按最早到最新编号；没有保存页的初次访问
  // 会打开最后一页（最新条目）（#533）。
  "gazette.book.title": "Hanōba 市政通讯",
  // 第0条（最新）：市民手册全面修订（#137）。
  "gazette.articles.0.heading": "市民手册全面修订",
  "gazette.articles.0.body.0":
    "咳咳。本市长将市民手册作了一次全面修订。各街区指南、编年史、市政条文——旅途中诸位想知道的一切，如今重新汇编成一册。",
  "gazette.articles.0.body.1":
    "翻开它，便能一目了然 Hanōba 的由来与规矩。诸位再无需迷路。",
  "gazette.articles.0.closing": "愿诸位携此一册，作为旅途的良伴。",
  "gazette.articles.0.link.0.label": "翻开市民手册",
  // 第1条：显示语言的多语言支持（#147）。
  "gazette.articles.1.heading": "语言，面向世界敞开",
  "gazette.articles.1.body.0":
    "咳咳。本市长已将 Hanōba 的默认显示语言切换为英语，并正式启动多语言支持。切换入口在任意页面皆可找到。",
  "gazette.articles.1.body.1":
    "语言虽异，养护之心相通。迎接世界各地的植物爱好者，正是本市应有的气度。",
  "gazette.articles.1.closing": "远道而来的朋友，亦与诸位同受欢迎。",
  // 第2条：居民投票与市情普查窗口开庁（#160 · #162）。
  "gazette.articles.2.heading": "两处市政窗口，同日开庁",
  "gazette.articles.2.body.0":
    "咳咳。本市长开设了居民投票所，以及查看品种人气走势的窗口。前者聆听诸位的声音，后者呈现此刻本市哪些品种正在兴起。",
  "gazette.articles.2.body.1":
    "如此一来，市民之声与品种之势，终于都能反映到市政之中了。",
  "gazette.articles.2.closing": "诸位的一票，与品种的势头，本市长皆看在眼里。",
  "gazette.articles.2.link.0.label": "前往居民投票",
  "gazette.articles.2.link.1.label": "查看市情普查",
  // 第3条（最早）：「你的植物」页面合并姓名与个人资料（#104）。
  "gazette.articles.3.heading": "「你的植物」合并为一张卡片",
  "gazette.articles.3.body.0":
    "咳咳。本市长将「你的植物」页面作了修改，把姓名与个人资料合并成了一张卡片。",
  "gazette.articles.3.body.1":
    "如今只需看这一张卡片，便知诸位是怎样一位市民。",
  "gazette.articles.3.closing": "诸位的这张卡片，想必也会成为值得骄傲的一张。",
  "gazette.articles.3.link.0.label": "查看你的植物",
};
