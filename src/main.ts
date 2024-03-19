(function () { 
    const originalWindow = unsafeWindow as Window
    //@ts-ignore
    const originalObject = originalWindow.Object as ObjectConstructor
    const originalFetch = originalWindow.fetch

    const document = originalWindow.document

    //@ts-ignore
    const originalAddEventListener = unsafeWindow.EventTarget.prototype.addEventListener
    //@ts-ignore
    unsafeWindow.EventTarget.prototype.addEventListener = function (type, listener, options) {
        originalAddEventListener.call(this, type, listener, options)
    }

    Node.prototype.originalAppendChild = Node.prototype.appendChild
    const isNull = (obj: any): obj is null => typeof obj === 'undefined' || obj === null
    const isObject = (obj: any): obj is Object => !isNull(obj) && typeof obj === 'object' && !Array.isArray(obj)
    const isString = (obj: any): obj is String => !isNull(obj) && typeof obj === 'string'
    const isNumber = (obj: any): obj is Number => !isNull(obj) && typeof obj === 'number'
    const isElement = (obj: any): obj is Element => !isNull(obj) && obj instanceof Element
    const isNode = (obj: any): obj is Node => !isNull(obj) && obj instanceof Node
    const isDate = (obj: any): obj is Date => !isNull(obj) && obj instanceof Date

    const isStringTupleArray = (obj: any): obj is [string, string][] => Array.isArray(obj) && obj.every(item => Array.isArray(item) && item.length === 2 && typeof item[0] === 'string' && typeof item[1] === 'string')

    const hasFunction = (obj: any, method: string): boolean => {
        return !method.isEmpty() && !isNull(obj) ? method in obj && typeof obj[method] === 'function' : false
    }
    const getString = (obj: any): string => {
        obj = obj instanceof Error ? String(obj) : obj
        obj = obj instanceof Date ? obj.format('YYYY-MM-DD') : obj
        return typeof obj === 'object' ? JSON.stringify(obj, null, 2) : String(obj)
    }

    Array.prototype.any = function () {
        return this.prune().length > 0
    }
    Array.prototype.prune = function () {
        return this.filter(i => i !== null && typeof i !== 'undefined')
    }
    Array.prototype.unique = function () {
        return Array.from(new Set(this))
    }

    Array.prototype.union = function (that) {
        return Array.from(new Set([...this, ...that]))
    }

    Array.prototype.intersect = function (that) {
        const set = new Set(that)
        return this.filter(v => set.has(v))
    }

    Array.prototype.difference = function (that) {
        const set = new Set(that)
        return this.filter(v => !set.has(v))
    }

    Array.prototype.complement = function (that) {
        const union = this.union(that)
        const intersect = this.intersect(that)
        return union.difference(intersect)
    }

    String.prototype.isEmpty = function () {
        return !isNull(this) && this.length === 0
    }
    String.prototype.among = function (start: string, end: string) {
        if (this.isEmpty() || start.isEmpty() || end.isEmpty()) {
            throw new Error('Empty')
        }
        let body = !this.split(start).pop().isEmpty() ? this.split(start).pop() : ''
        return !body.split(end).shift().isEmpty() ? body.split(end).shift() : ''
    }
    String.prototype.splitLimit = function (separator: string, limit?: number) {
        if (this.isEmpty() || isNull(separator)) {
            throw new Error('Empty')
        }
        let body = this.split(separator)
        return limit ? body.slice(0, limit).concat(body.slice(limit).join(separator)) : body
    }
    String.prototype.truncate = function (maxLength) {
        return this.length > maxLength ? this.substring(0, maxLength) : this.toString()
    }
    String.prototype.trimHead = function (prefix: string) {
        return this.startsWith(prefix) ? this.slice(prefix.length) : this.toString()
    }
    String.prototype.trimTail = function (suffix: string) {
        return this.endsWith(suffix) ? this.slice(0, -suffix.length) : this.toString()
    }

    String.prototype.toURL = function () {
        return new URL(this.toString())
    }

    Array.prototype.append = function (arr) {
        this.push(...arr)
    }

    Date.prototype.format = function (format?: string) {
        return moment(this).locale(language()).format(format)
    }

    String.prototype.replaceVariable = function (replacements, count = 0) {
        let replaceString = this.toString()
        try {
            replaceString = originalObject.entries(replacements).reduce((str, [key, value]) => {
                if (str.includes(`%#${key}:`)) {
                    let format = str.among(`%#${key}:`, '#%').toString()
                    return str.replaceAll(`%#${key}:${format}#%`, getString(hasFunction(value, 'format') ? value.format(format) : value))
                } else {
                    return str.replaceAll(`%#${key}#%`, getString(value))
                }
            },
                replaceString
            )
            count++
            return originalObject.keys(replacements).map((key) => this.includes(`%#${key}#%`)).includes(true) && count < 128 ? replaceString.replaceVariable(replacements, count) : replaceString
        } catch (error) {
            GM_getValue('isDebug') && console.log(`replace variable error: ${getString(error)}`)
            return replaceString
        }
    }
    function prune(obj: any): any {
        if (Array.isArray(obj)) {
            return obj.filter(isNotEmpty).map(prune);
        }
        if (isElement(obj) || isNode(obj)) {
            return obj
        }
        if (isObject(obj)) {
            return originalObject.fromEntries(
                originalObject.entries(obj)
                    .filter(([key, value]) => isNotEmpty(value))
                    .map(([key, value]) => [key, prune(value)])
            )
        }
        return isNotEmpty(obj) ? obj : undefined;
    }
    function isNotEmpty(obj: any): boolean {
        if (isNull(obj)) {
            return false
        }
        if (Array.isArray(obj)) {
            return obj.some(isNotEmpty);
        }
        if (isString(obj)) {
            return !obj.isEmpty();
        }
        if (isNumber(obj)) {
            return !Number.isNaN(obj)
        }
        if (isElement(obj) || isNode(obj)) {
            return true
        }
        if (isObject(obj)) {
            return originalObject.values(obj).some(isNotEmpty)
        }
        return true
    }


    const fetch = (input: RequestInfo, init?: RequestInit, force?: boolean): Promise<Response> => {
        if (init && init.headers && isStringTupleArray(init.headers)) throw new Error("init headers Error")
        if (init && init.method && !(init.method === 'GET' || init.method === 'HEAD' || init.method === 'POST')) throw new Error("init method Error")
        return force || (typeof input === 'string' ? input : input.url).toURL().hostname !== unsafeWindow.location.hostname ? new Promise((resolve, reject) => {
            GM_xmlhttpRequest(prune({
                method: (init && init.method) as "GET" | "HEAD" | "POST" || 'GET',
                url: typeof input === 'string' ? input : input.url,
                headers: (init && init.headers) as Tampermonkey.RequestHeaders || {},
                data: ((init && init.body) || null) as string,
                onload: function (response: Tampermonkey.ResponseBase) {
                    resolve(new Response(response.responseText, {
                        status: response.status,
                        statusText: response.statusText,
                    }))
                },
                onerror: function (error: Error) {
                    reject(error)
                }
            }))
        }) : originalFetch(input, init)
    }
    const UUID = function () {
        return Array.from({ length: 8 }, () => (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1)).join('')
    }
    const ceilDiv = function (dividend: number, divisor: number): number {
        return Math.floor(dividend / divisor) + (dividend % divisor > 0 ? 1 : 0)
    }

    const language = function () {
        let env = (!isNull(config) ? config.language : (navigator.language ?? navigator.languages[0] ?? 'en')).replace('-', '_')
        let main = env.split('_').shift() ?? 'en'
        return (!isNull(i18n[env]) ? env : !isNull(i18n[main]) ? main : 'en')
    }

    const renderNode = function (renderCode: RenderCode): Node | Element {
        renderCode = prune(renderCode)
        if (isNull(renderCode)) throw new Error("RenderCode null")
        if (typeof renderCode === 'string') {
            return document.createTextNode(renderCode.replaceVariable(i18n[language()]).toString())
        }
        if (renderCode instanceof Node) {
            return renderCode
        }
        if (typeof renderCode !== 'object' || !renderCode.nodeType) {
            throw new Error('Invalid arguments')
        }
        const { nodeType, attributes, events, className, childs } = renderCode
        const node: Element = document.createElement(nodeType);
        (!isNull(attributes) && originalObject.keys(attributes).any()) && originalObject.entries(attributes).forEach(([key, value]: any) => node.setAttribute(key, value));
        (!isNull(events) && originalObject.keys(events).any()) && originalObject.entries(events).forEach(([eventName, eventHandler]: any) => originalAddEventListener.call(node, eventName, eventHandler));
        (!isNull(className) && className.length > 0) && node.classList.add(...[].concat(className))
        !isNull(childs) && node.append(...[].concat(childs).map(renderNode))
        return node
    }
    const findElement = function (element: Element, condition: string) {
        while (element && !element.matches(condition)) {
            element = element.parentElement
        }
        return element
    }

    if (GM_getValue('isDebug')) {
        console.log(getString(GM_info))
        debugger
    }

    const Channel = new BroadcastChannel('IwaraDownloadTool')

    enum DownloadType {
        Aria2,
        IwaraDownloader,
        Browser,
        Others
    }
    enum PageType {
        Video = 'video',
        Image = 'image',
        VideoList = 'videoList',
        ImageList = 'imageList',
        Forum = 'forum',
        ForumSection = 'forumSection',
        ForumThread = 'forumThread',
        Page = 'page',
        Home = 'home',
        Profile = 'profile'
    }
    enum ToastType {
        Log,
        Info,
        Warn,
        Error
    }
    enum MessageType {
        Set,
        Del
    }

    enum VersionState {
        low,
        equal,
        high
    }

    function compareVersions(version1: string, version2: string): VersionState {
        const v1 = version1.split('.').map(Number)
        const v2 = version2.split('.').map(Number)

        for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
            const num1 = v1[i] || 0
            const num2 = v2[i] || 0

            if (num1 < num2) {
                return VersionState.low
            } else if (num1 > num2) {
                return VersionState.high
            }
        }

        return VersionState.equal
    }

    class SyncDictionary<T> {
        [key: string]: any
        public id: string
        private dictionary: Dictionary<T>
        constructor(id: string, data: Array<{ key: string, value: T }> = []) {
            this.id = id
            this.dictionary = new Dictionary<T>(data)
            GM_getValue(this.id, []).map(i => this.dictionary.set(i.key, i.value))
            Channel.onmessage = (event: MessageEvent) => {
                const message = event.data as IChannelMessage<{ key: string, value: T | number | undefined }>
                if (message.id === this.id) {
                    switch (message.type) {
                        case MessageType.Set:
                            this.dictionary.set(message.data.key, message.data.value as T)
                            let selectButtonA = document.querySelector(`input.selectButton[videoid="${message.data.key}"]`) as HTMLInputElement
                            if (!isNull(selectButtonA)) selectButtonA.checked = true
                            break
                        case MessageType.Del:
                            this.dictionary.del(message.data.key)
                            let selectButtonB = document.querySelector(`input.selectButton[videoid="${message.data.key}"]`) as HTMLInputElement
                            if (!isNull(selectButtonB)) selectButtonB.checked = false
                            break
                        default:
                            break
                    }
                }
            }
            Channel.onmessageerror = (event) => {
                GM_getValue('isDebug') && console.log(`Channel message error: ${getString(event)}`)
            }
        }
        public set(key: string, value: T): void {
            this.dictionary.set(key, value)
            Channel.postMessage({ id: this.id, type: MessageType.Set, data: { key: key, value: value } })
            GM_setValue(this.id, this.dictionary.toArray())
        }
        public get(key: string): T | undefined {
            return this.dictionary.get(key)
        }
        public has(key: string): boolean {
            return this.dictionary.has(key)
        }
        public del(key: string): void {
            this.dictionary.del(key)
            Channel.postMessage({ id: this.id, type: MessageType.Del, data: { key: key } })
            GM_setValue(this.id, this.dictionary.toArray())
        }
        public get size(): number {
            return this.dictionary.size
        }
        public keys(): string[] {
            return this.dictionary.keys()
        }
        public values(): T[] {
            return this.dictionary.values()
        }
        public toArray(): Array<{ key: string, value: T }> {
            return this.dictionary.toArray()
        }
    }
    class Dictionary<T> {
        [key: string]: any
        items: { [key: string]: T }
        constructor(data: Array<{ key: string, value: T }> = []) {
            this.items = new originalObject() as any
            data.map(i => this.set(i.key, i.value))
        }
        public set(key: string, value: T): void {
            this.items[key] = value
        }
        public del(key: string): void {
            delete this.items[key]
        }
        public get(key: string): T | undefined {
            return this.has(key) ? this.items[key] : undefined
        }
        public has(key: string): boolean {
            return this.items.hasOwnProperty(key)
        }
        public get size(): number {
            return originalObject.keys(this.items).length
        }
        public keys(): string[] {
            return originalObject.keys(this.items)
        }
        public values(): T[] {
            return originalObject.values(this.items)
        }
        public toArray(): Array<{ key: string, value: T }> {
            return this.keys().map(k => { return { key: k, value: this.items[k] } })
        }
    }
    class I18N {
        [key: string]: { [key: string]: RenderCode | RenderCode[] }
        public zh_CN = this['zh']
        public zh: { [key: string]: RenderCode | RenderCode[] } = {
            appName: 'Iwara 批量下载工具',
            language: '语言: ',
            downloadPath: '下载到: ',
            downloadProxy: '下载代理: ',
            aria2Path: 'Aria2 RPC: ',
            aria2Token: 'Aria2 密钥: ',
            iwaraDownloaderPath: 'IwaraDownloader RPC: ',
            iwaraDownloaderToken: 'IwaraDownloader 密钥: ',
            rename: '重命名',
            save: '保存',
            ok: '确定',
            on: '开启',
            off: '关闭',
            isDebug: '调试模式',
            downloadType: '下载方式',
            browserDownload: '浏览器下载',
            iwaraDownloaderDownload: 'IwaraDownloader下载',
            autoFollow: '自动关注选中的视频作者',
            autoLike: '自动点赞选中的视频',
            checkDownloadLink: '高画质下载连接检查',
            checkPrioritySource: '源画质检查',
            autoInjectCheckbox: '自动注入选择框',
            configurationIncompatible: '检测到不兼容的配置文件，请重新配置！',
            browserDownloadNotEnabled: `未启用下载功能！`,
            browserDownloadNotWhitelisted: `请求的文件扩展名未列入白名单！`,
            browserDownloadNotPermitted: `下载功能已启用，但未授予下载权限！`,
            browserDownloadNotSupported: `目前浏览器/版本不支持下载功能！`,
            browserDownloadNotSucceeded: `下载未开始或失败！`,
            browserDownloadUnknownError: `未知错误，有可能是下载时提供的参数存在问题，请检查文件名是否合法！`,
            browserDownloadTimeout: `下载超时，请检查网络环境是否正常！`,
            variable: '查看可用变量',
            downloadTime: '下载时间 ',
            uploadTime: '发布时间 ',
            example: '示例: ',
            result: '结果: ',
            loadingCompleted: '加载完成',
            settings: '打开设置',
            downloadThis: '下载当前',
            manualDownload: '手动下载',
            reverseSelect: '反向选中',
            aria2TaskCheck: 'Aria2任务重启',
            deselect: '取消选中',
            selectAll: '全部选中',
            downloadSelected: '下载所选',
            downloadingSelected: '正在下载所选, 请稍后...',
            injectCheckbox: '开关选择',
            configError: '脚本配置中存在错误，请修改。',
            alreadyKnowHowToUse: '我已知晓如何使用!!!',
            notice: '重构以及调整配置界面，新增自动点赞功能，因存在违规风险，该功能默认关闭！如需使用请手动开启，你已经被警告过了！',
            useHelpForInjectCheckbox: `开启“自动注入选择框”以获得更好的体验！或等待加载出视频卡片后, 点击侧边栏中[%#injectCheckbox#%]开启下载选择框`,
            useHelpForCheckDownloadLink: '开启“高画质下载连接检查”功能会在下载视频前会检查视频简介以及评论，如果在其中发现疑似第三方下载链接，将会弹出提示，您可以点击提示打开视频页面。',
            useHelpForManualDownload: '手动下载需要您提供视频ID!',
            useHelpForBugreport: [
                '反馈遇到的BUG、使用问题等请前往: ',
                {
                    nodeType: 'a',
                    childs: 'Guthub',
                    attributes: {
                        href: 'https://github.com/dawn-lc/IwaraDownloadTool/issues/new/choose'
                    }
                }
            ],
            tryRestartingDownload: '→ 点击此处重新下载 ←',
            tryReparseDownload: '→ 点击此处重新解析 ←',
            openVideoLink: '→ 进入视频页面 ←',
            pushTaskSucceed: '推送下载任务成功！',
            connectionTest: '连接测试',
            settingsCheck: '配置检查',
            createTask: '创建任务',
            downloadPathError: '下载路径错误!',
            browserDownloadModeError: '请启用脚本管理器的浏览器API下载模式!',
            downloadQualityError: '无原画下载地址!',
            findedDownloadLink: '发现疑似高画质下载连接!',
            allCompleted: '全部解析完成！',
            parsingProgress: '解析进度: ',
            manualDownloadTips: '请输入需要下载的视频ID! \r\n若需要批量下载请用 "|" 分割ID, 例如: AAAAAAAAAA|BBBBBBBBBBBB|CCCCCCCCCCCC...',
            externalVideo: `非本站视频`,
            noAvailableVideoSource: '没有可供下载的视频源',
            videoSourceNotAvailable: '视频源地址不可用',
            getVideoSourceFailed: '获取视频源失败',
            downloadFailed: '下载失败！',
            downloadThisFailed: '未找到可供下载的视频！',
            pushTaskFailed: '推送下载任务失败！',
            parsingFailed: '视频信息解析失败！',
            autoFollowFailed: '自动关注视频作者失败！',
            autoLikeFailed: '自动点赞视频失败！',
        }
        public en: { [key: string]: RenderCode | RenderCode[] } = {
            appName: 'Iwara Download Tool',
            language: 'Language:',
            downloadPath: 'Download to:',
            downloadProxy: 'Download proxy:',
            rename: 'Rename:',
            save: 'Save',
            ok: 'OK',
            on: 'On',
            off: 'Off',
            switchDebug: 'Debug mode:',
            downloadType: 'Download type:',
            configurationIncompatible: 'An incompatible configuration file was detected, please reconfigure!',
            browserDownload: 'Browser download',
            iwaraDownloaderDownload: 'iwaraDownloader download',
            checkDownloadLink: 'High-quality download link check:',
            downloadThis: 'Download this video',
            autoInjectCheckbox: 'Auto inject selection',
            variable: 'Available variables:',
            downloadTime: 'Download time ',
            uploadTime: 'Upload time ',
            example: 'Example:',
            result: 'Result:',
            loadingCompleted: 'Loading completed',
            settings: 'Open settings',
            manualDownload: 'Manual download',
            reverseSelect: 'Reverse select',
            deselect: 'Deselect',
            selectAll: 'Select all',
            downloadSelected: 'Download selected',
            downloadingSelected: 'Downloading selected, please wait...',
            injectCheckbox: 'Switch selection',
            configError: 'There is an error in the script configuration, please modify it.',
            alreadyKnowHowToUse: 'I\'m already aware of how to use it!!!',
            useHelpForInjectCheckbox: "After the video card is loaded, click [%#injectCheckbox#%] in the sidebar to enable the download checkbox",
            useHelpForCheckDownloadLink: "Before downloading the video, the video introduction and comments will be checked. If a suspected third-party download link is found in them, a prompt will pop up. You can click the prompt to open the video page.",
            useHelpForManualDownload: "Manual download requires you to provide a video ID! \r\nIf you need to batch download, please use '|' to separate IDs. For example:A|B|C...",
            useHelpForBugreport: [
                'Report bugs: ',
                {
                    nodeType: 'a',
                    childs: 'Guthub',
                    attributes: {
                        href: 'https://github.com/dawn-lc/IwaraDownloadTool/issues/new/choose'
                    }
                }
            ],
            downloadFailed: 'Download failed!',
            tryRestartingDownload: '→ Click here to restrat ←',
            tryReparseDownload: '→ Click here to reparse ←',
            openVideoLink: '→ Enter video page ←',
            pushTaskFailed: 'Failed to push download task!',
            pushTaskSucceed: 'Pushed download task successfully!',
            connectionTest: 'Connection test',
            settingsCheck: 'Configuration check',
            parsingFailed: 'Video information parsing failed!',
            createTask: 'Create task',
            downloadPathError: 'Download path error!',
            browserDownloadModeError: "Please enable the browser API download mode of the script manager!",
            downloadQualityError: "No original painting download address!",
            findedDownloadLink: "Found suspected high-quality download link!",
            allCompleted: "All parsing completed!",
            parsingProgress: "Parsing progress:",
            manualDownloadTips: "Please enter the video ID you want to download! \r\nIf you need to batch download, please use '|' to separate IDs. For example:A|B|C...",
            externalVideo: `Non-site video`,
            getVideoSourceFailed: `Failed to get video source`,
            noAvailableVideoSource: `No available video source`,
            videoSourceNotAvailable: `Video source address not available`,
        }
    }

    class Config {
        configChange: Function
        language: string
        autoFollow: boolean
        autoLike: boolean
        autoInjectCheckbox: boolean
        checkDownloadLink: boolean
        checkPrioritySource: boolean
        downloadType: DownloadType
        downloadPath: string
        downloadProxy: string
        aria2Path: string
        aria2Token: string
        iwaraDownloaderPath: string
        iwaraDownloaderToken: string
        authorization: string
        priority: Record<string, number>
        [key: string]: any
        constructor() {
            this.language = language()
            this.autoFollow = false
            this.autoLike = false
            this.autoInjectCheckbox = true
            this.checkDownloadLink = true
            this.checkPrioritySource = true
            this.downloadType = DownloadType.Others
            this.downloadPath = '/Iwara/%#AUTHOR#%/%#TITLE#%[%#ID#%].mp4'
            this.downloadProxy = ''
            this.aria2Path = 'http://127.0.0.1:6800/jsonrpc'
            this.aria2Token = ''
            this.iwaraDownloaderPath = 'http://127.0.0.1:6800/jsonrpc'
            this.iwaraDownloaderToken = ''
            this.priority = {
                'Source': 100,
                '540': 2,
                '360': 1
            }
            let body = new Proxy(this, {
                get: function (target, property: string) {
                    if (property === 'configChange') {
                        return target.configChange
                    }
                    let value = GM_getValue(property, target[property])
                    GM_getValue('isDebug') && console.log(`get: ${property} ${getString(value)}`)
                    return value
                },
                set: function (target, property: string, value) {
                    if (property === 'configChange') {
                        target.configChange = value
                        return true
                    }
                    GM_setValue(property, value)
                    GM_getValue('isDebug') && console.log(`set: ${property} ${getString(value)}`)
                    target.configChange(property)
                    return true
                }
            })
            GM_listValues().forEach((value) => {
                GM_addValueChangeListener(value, (name: string, old_value: any, new_value: any, remote: boolean) => {
                    GM_getValue('isDebug') && console.log(`$Is Remote: ${remote} Change Value: ${name} old: ${getString(old_value)} new: ${getString(new_value)}`)
                    if (remote && !isNull(body.configChange)) body.configChange(name)
                })
            })
            return body
        }
        public async check() {
            if (await localPathCheck()) {
                switch (this.downloadType) {
                    case DownloadType.Aria2:
                        return await aria2Check()
                    case DownloadType.IwaraDownloader:
                        return await iwaraDownloaderCheck()
                    case DownloadType.Browser:
                        return await EnvCheck()
                    default:
                        break
                }
                return true
            } else {
                return false
            }
        }
    }

    class configEdit {
        source: configEdit
        target: Config
        interface: HTMLElement
        interfacePage: HTMLElement

        constructor(config: Config) {
            this.target = config
            this.target.configChange = (item: string) => { this.configChange.call(this, item) }
            this.interfacePage = renderNode({
                nodeType: 'p'
            }) as HTMLElement
            let save = renderNode({
                nodeType: 'button',
                className: 'closeButton',
                childs: '%#save#%',
                attributes: {
                    title: i18n[language()].save
                },
                events: {
                    click: async () => {
                        save.disabled = !save.disabled
                        if (await this.target.check()) {
                            unsafeWindow.location.reload()
                        }
                        save.disabled = !save.disabled
                    }
                }
            }) as HTMLButtonElement
            this.interface = renderNode({
                nodeType: 'div',
                attributes: {
                    id: 'pluginConfig'
                },
                childs: [
                    {
                        nodeType: 'div',
                        className: 'main',
                        childs: [
                            {
                                nodeType: 'h2',
                                childs: '%#appName#%'
                            },
                            {
                                nodeType: 'label',
                                childs: [
                                    '%#language#% ',
                                    {
                                        nodeType: 'input',
                                        className: 'inputRadioLine',
                                        attributes: originalObject.assign(
                                            {
                                                name: 'language',
                                                type: 'text',
                                                value: this.target.language
                                            }
                                        ),
                                        events: {
                                            change: (event: Event) => {
                                                this.target.language = (event.target as HTMLInputElement).value
                                            }
                                        }
                                    }
                                ]
                            },
                            this.switchButton('isDebug', GM_getValue, (name: string, e) => { GM_setValue(name, (e.target as HTMLInputElement).checked) }, false),
                            this.switchButton('checkDownloadLink'),
                            this.switchButton('autoFollow'),
                            this.switchButton('autoLike'),
                            this.switchButton('checkPrioritySource'),
                            this.switchButton('autoInjectCheckbox'),
                            this.downloadTypeSelect(),
                            this.interfacePage
                        ]
                    },
                    save
                ]
            }) as HTMLElement
        }
        private switchButton(name: string, get?: (name: string, defaultValue?: any) => any, set?: (name: string, e: Event) => void, defaultValue?: boolean): RenderCode {
            let button = renderNode({
                nodeType: 'p',
                className: 'inputRadioLine',
                childs: [
                    {
                        nodeType: 'label',
                        childs: `%#${name}#%`,
                        attributes: {
                            for: name
                        }
                    }, {
                        nodeType: 'input',
                        className: 'switch',
                        attributes: {
                            type: 'checkbox',
                            name: name,
                        },
                        events: {
                            change: (e: Event) => {
                                if (set !== undefined) {
                                    set(name, e)
                                    return
                                } else {
                                    this.target[name] = (e.target as HTMLInputElement).checked
                                }
                            }
                        }
                    }
                ]
            }) as HTMLElement
            (button.querySelector(`[name='${name}']`) as HTMLInputElement).checked = get !== undefined ? get(name, defaultValue) : this.target[name] ?? defaultValue ?? false
            return button
        }
        private inputComponent(name: string, type?: string, get?: (name: string) => void, set?: (name: string, e: Event) => void): RenderCode {
            return {
                nodeType: 'label',
                childs: [
                    `%#${name}#% `,
                    {
                        nodeType: 'input',
                        attributes: originalObject.assign(
                            {
                                name: name,
                                type: type ?? 'text',
                                value: get !== undefined ? get(name) : this.target[name]
                            }
                        ),
                        events: {
                            change: (e: Event) => {
                                if (set !== undefined) {
                                    set(name, e)
                                    return
                                } else {
                                    this.target[name] = (e.target as HTMLInputElement).value
                                }
                            }
                        }
                    }
                ]
            }
        }
        private downloadTypeSelect(): RenderCode {
            let select = renderNode({
                nodeType: 'p',
                className: 'inputRadioLine',
                childs: [
                    `%#downloadType#%`,
                    {
                        nodeType: 'select',
                        childs: originalObject.keys(DownloadType).filter((i: any) => isNaN(Number(i))).map((i: string) => renderNode({
                            nodeType: 'option',
                            childs: i
                        })),
                        attributes: {
                            name: 'downloadType'
                        },
                        events: {
                            change: (e) => {
                                this.target.downloadType = (e.target as HTMLSelectElement).selectedIndex
                            }
                        }
                    }
                ]
            }) as HTMLSelectElement
            select.selectedIndex = Number(this.target.downloadType)

            return select
        }
        private configChange(item: string) {
            switch (item) {
                case 'downloadType':
                    (this.interface.querySelector(`[name=${item}]`) as HTMLSelectElement).selectedIndex = Number(this.target.downloadType)
                    this.downloadTypeChange()
                    break
                default:
                    let element = this.interface.querySelector(`[name=${item}]`) as HTMLInputElement
                    if (element) {
                        switch (element.type) {
                            case 'radio':
                                element.value = this.target[item]
                                break
                            case 'checkbox':
                                element.checked = this.target[item]
                                break
                            case 'text':
                            case 'password':
                                element.value = this.target[item]
                                break
                            default:
                                break
                        }
                    }
                    break
            }
        }
        private downloadTypeChange() {
            while (this.interfacePage.hasChildNodes()) {
                this.interfacePage.removeChild(this.interfacePage.firstChild)
            }
            let variableInfo = renderNode({
                nodeType: 'a',
                childs: '%#variable#%',
                attributes: {
                    href: 'https://github.com/dawn-lc/IwaraDownloadTool#路径可用变量'
                }
            })
            let downloadConfigInput = [
                variableInfo,
                renderNode(this.inputComponent('downloadPath')),
                renderNode(this.inputComponent('downloadProxy'))
            ]
            let aria2ConfigInput = [
                renderNode(this.inputComponent('aria2Path')),
                renderNode(this.inputComponent('aria2Token', 'password'))
            ]
            let iwaraDownloaderConfigInput = [
                renderNode(this.inputComponent('iwaraDownloaderPath')),
                renderNode(this.inputComponent('iwaraDownloaderToken', 'password'))
            ]
            let BrowserConfigInput = [
                variableInfo,
                renderNode(this.inputComponent('downloadPath'))
            ]
            switch (this.target.downloadType) {
                case DownloadType.Aria2:
                    downloadConfigInput.map(i => this.interfacePage.originalAppendChild(i))
                    aria2ConfigInput.map(i => this.interfacePage.originalAppendChild(i))
                    break
                case DownloadType.IwaraDownloader:
                    downloadConfigInput.map(i => this.interfacePage.originalAppendChild(i))
                    iwaraDownloaderConfigInput.map(i => this.interfacePage.originalAppendChild(i))
                    break
                default:
                    BrowserConfigInput.map(i => this.interfacePage.originalAppendChild(i))
                    break
            }
        }
        public inject() {
            if (!document.querySelector('#pluginConfig')) {
                document.body.originalAppendChild(this.interface)
                this.configChange('downloadType')
            }
        }
    }


    class VideoInfo {
        ID: string
        UploadTime: Date
        Name: string | null
        FileName: string
        Size: number
        Tags: Array<{
            id: string
            type: string
        }>
        Liked: boolean
        Following: boolean
        Friend: boolean
        Alias: string
        Author: string
        AuthorID: string
        Private: boolean
        VideoInfoSource: VideoAPIRawData
        VideoFileSource: VideoFileAPIRawDataList
        External: boolean
        State: boolean
        Comments: string
        DownloadQuality: string
        DownloadUrl: string
        constructor(Name: string) {
            this.Name = Name
            return this
        }
        async init(ID: string) {
            try {
                config.authorization = `Bearer ${await refreshToken()}`
                this.ID = ID.toLocaleLowerCase()
                this.VideoInfoSource = await (await fetch(`https://api.iwara.tv/video/${this.ID}`, {
                    headers: await getAuth()
                })).json()
                if (this.VideoInfoSource.id === undefined) {
                    let cache = await db.videos.where('ID').equals(this.ID).toArray()
                    if (cache.any()) Object.assign(this, cache.pop())
                    throw new Error(i18n[language()].parsingFailed.toString())
                }
                this.Name = ((this.VideoInfoSource.title ?? this.Name).normalize('NFKC').replace(/^\.|[\\\\/:*?\"<>|]/img, '_')).truncate(128)
                this.External = !isNull(this.VideoInfoSource.embedUrl) && !this.VideoInfoSource.embedUrl.isEmpty()
                if (this.External) {
                    throw new Error(i18n[language()].externalVideo.toString())
                }
                this.AuthorID = this.VideoInfoSource.user.id
                this.Following = this.VideoInfoSource.user.following
                this.Liked = this.VideoInfoSource.liked
                this.Friend = this.VideoInfoSource.user.friend
                this.Private = this.VideoInfoSource.private
                this.Alias = this.VideoInfoSource.user.name
                this.Author = this.VideoInfoSource.user.username.replace(/^\.|[\\\\/:*?\"<>|]/img, '_')
                this.UploadTime = new Date(this.VideoInfoSource.createdAt)
                this.Tags = this.VideoInfoSource.tags
                this.FileName = this.VideoInfoSource.file.name.replace(/^\.|[\\\\/:*?\"<>|]/img, '_')
                this.Size = this.VideoInfoSource.file.size
                this.VideoFileSource = (await (await fetch(this.VideoInfoSource.fileUrl, { headers: await getAuth(this.VideoInfoSource.fileUrl) })).json() as VideoFileAPIRawData[]).sort((a, b) => (!isNull(config.priority[b.name]) ? config.priority[b.name] : 0) - (!isNull(config.priority[a.name]) ? config.priority[a.name] : 0))
                if (isNull(this.VideoFileSource) || !(this.VideoFileSource instanceof Array) || this.VideoFileSource.length < 1) {
                    throw new Error(i18n[language()].getVideoSourceFailed.toString())
                }
                this.DownloadQuality = this.VideoFileSource[0].name

                let fileList = this.VideoFileSource.filter(x => x.name === this.DownloadQuality)
                if (!fileList.any()) throw new Error(i18n[language()].noAvailableVideoSource.toString())
                let Source = fileList[Math.floor(Math.random() * fileList.length)].src.download
                if (isNull(Source) || Source.isEmpty()) throw new Error(i18n[language()].videoSourceNotAvailable.toString())
                this.DownloadUrl = decodeURIComponent(`https:${Source}`)
                
                const getCommentData = async (commentID: string = null, page: number = 0): Promise<VideoCommentAPIRawData> => {
                    return await (await fetch(`https://api.iwara.tv/video/${this.ID}/comments?page=${page}${!isNull(commentID) && !commentID.isEmpty() ? '&parent=' + commentID : ''}`, { headers: await getAuth() })).json() as VideoCommentAPIRawData
                }
                const getCommentDatas = async (commentID: string = null): Promise<VideoCommentAPIRawData["results"]> => {
                    let comments: VideoCommentAPIRawData["results"] = []
                    let base = await getCommentData(commentID)
                    comments.append(base.results)
                    for (let page = 1; page < ceilDiv(base.count, base.limit); page++) {
                        comments.append((await getCommentData(commentID, page)).results)
                    }
                    let replies: VideoCommentAPIRawData["results"] = []
                    for (let index = 0; index < comments.length; index++) {
                        const comment = comments[index]
                        if (comment.numReplies > 0) {
                            replies.append(await getCommentDatas(comment.id))
                        }
                    }
                    comments.append(replies)
                    return comments.prune()
                }
                this.Comments = `${this.VideoInfoSource.body}\n${(await getCommentDatas()).map(i => i.body).join('\n')}`.normalize('NFKC')
                this.State = true
                await db.videos.put(this)
                return this
            } catch (error) {
                let data = this
                let toast = newToast(
                    ToastType.Error,
                    {
                        node:
                            toastNode([
                                `${this.Name}[${this.ID}] %#parsingFailed#%`,
                                { nodeType: 'br' },
                                `${getString(error)}`,
                                { nodeType: 'br' },
                                this.External ? `%#openVideoLink#%` : `%#tryReparseDownload#%`
                            ], '%#createTask#%'),
                        onClick() {
                            if (data.External) {
                                GM_openInTab(data.VideoInfoSource.embedUrl, { active: false, insert: true, setParent: true })
                            } else {
                                analyzeDownloadTask(new Dictionary<string>([{ key: data.ID, value: data.Name }]))
                            }
                            toast.hideToast()
                        },
                    }
                )
                toast.showToast()
                let button = document.querySelector(`.selectButton[videoid="${this.ID}"]`) as HTMLInputElement
                button && button.checked && button.click()
                selectList.del(this.ID)
                this.State = false
                return this
            }
        }
    }
    class Database extends Dexie {
        videos: Dexie.Table<VideoInfo, string>;
        constructor() {
            super("VideoDatabase");
            this.version(1).stores({
                videos: 'ID'
            });
            this.videos = this.table("videos");
        }
    }
    class menu {
        source: menu
        interface: HTMLElement
        interfacePage: HTMLElement
        constructor() {
            this.interfacePage = renderNode({
                nodeType: 'ul'
            }) as HTMLElement
            this.interface = renderNode({
                nodeType: 'div',
                attributes: {
                    id: 'pluginMenu'
                },
                childs: this.interfacePage
            }) as HTMLElement
            new MutationObserver((mutationsList) => {
                for (let mutation of mutationsList) {
                    if (mutation.type !== 'childList' || mutation.addedNodes.length < 1) {
                        continue;
                    }
                    let pages = ([...mutation.addedNodes] as Element[]).filter(i => i.classList.contains('page'))
                    if (pages.length === 0) {
                        continue;
                    }
                    let page = pages.find(i => isElement(i) && i.classList.length > 1)
                    if (!page) {
                        continue;
                    }
                    this.pageChange(page.classList[1].split('-').pop() as PageType)
                }
            }).observe(document.getElementById('app'), { childList: true, subtree: true });
        }
        private button(name: string, click?: (name: string, e: Event) => void) {
            return renderNode(prune({
                nodeType: 'li',
                childs: '%#name#%',
                events: {
                    click: (event: Event) => {
                        click(name, event)
                        event.stopPropagation()
                        return false
                    }
                }
            }))
        }
        private pageChange(pageType: PageType) {
            while (this.interfacePage.hasChildNodes()) {
                this.interfacePage.removeChild(this.interfacePage.firstChild)
            }

            let injectCheckboxButton = this.button('injectCheckbox', (name, event) => {
                if (document.querySelector('.selectButton')) {
                    document.querySelectorAll('.selectButton').forEach((element) => {
                        element.remove()
                    })
                } else {
                    document.querySelectorAll(`.videoTeaser`).forEach((element: Element) => {
                        injectCheckbox(element, compatible)
                    })
                }
            })
            let manualDownloadButton = this.button('manualDownload', (name, event) => {
                addDownloadTask()
            })
            let settingsButton = this.button('settings', (name, event) => {
                editConfig.inject()
            })

            let baseButtons = [injectCheckboxButton, manualDownloadButton, settingsButton]

            let selectAllButton = this.button('selectAll', (name, event) => {
                document.querySelectorAll('.selectButton').forEach((element) => {
                    let button = element as HTMLInputElement
                    !button.checked && button.click()
                })
            })
            let reverseSelectButton = this.button('reverseSelect', (name, event) => {
                document.querySelectorAll('.selectButton').forEach((element) => {
                    (element as HTMLInputElement).click()
                })
            })
            let deselectButton = this.button('deselect', (name, event) => {
                document.querySelectorAll('.selectButton').forEach((element) => {
                    let button = element as HTMLInputElement
                    button.checked && button.click()
                })
            })
            let downloadSelectedButton = this.button('downloadSelected', (name, event) => {
                analyzeDownloadTask()
                newToast(ToastType.Info, {
                    text: `%#${name}#%`,
                    close: true
                }).showToast()
            })
            let selectButtons = [selectAllButton, reverseSelectButton, deselectButton, downloadSelectedButton]

            let downloadThisButton = this.button('downloadThis', async (name, event) => {
                let ID = unsafeWindow.location.href.trim().split('//').pop().split('/')[2]
                let Title = document.querySelector('.page-video__details')?.childNodes[0]?.textContent ?? '未获取到标题'
                let videoInfo = await (new VideoInfo(Title)).init(ID)
                videoInfo.State && await pustDownloadTask(videoInfo)
            })

            let aria2TaskCheckButton = this.button('aria2TaskCheck', (name, event) => {
                aria2TaskCheck()
            })
            GM_getValue('isDebug') && this.interfacePage.originalAppendChild(aria2TaskCheckButton)

            switch (pageType) {
                case PageType.Video:
                    this.interfacePage.originalAppendChild(downloadThisButton)
                    selectButtons.map(i => this.interfacePage.originalAppendChild(i))
                    baseButtons.map(i => this.interfacePage.originalAppendChild(i))
                    break
                case PageType.Profile:
                case PageType.Home:
                case PageType.VideoList:
                    selectButtons.map(i => this.interfacePage.originalAppendChild(i))
                    baseButtons.map(i => this.interfacePage.originalAppendChild(i))
                    break;
                case PageType.Page:
                case PageType.Forum:
                case PageType.Image:
                case PageType.ImageList:
                case PageType.ForumSection:
                case PageType.ForumThread:
                default:
                    baseButtons.map(i => this.interfacePage.originalAppendChild(i))
                    break;
            }
        }
        public inject() {
            if (!document.querySelector('#pluginMenu')) {
                document.body.originalAppendChild(this.interface)
                this.pageChange(PageType.Page)
            }
        }
    }

    GM_addStyle(GM_getResourceText('toastify-css'))
    GM_addStyle(`
        .rainbow-text {
            background-image: linear-gradient(to right, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #8b00ff);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-size: 600% 100%;
            animation: rainbow 0.5s infinite linear;
        }
        @keyframes rainbow {
            0% {
                background-position: 0% 0%;
            }
            100% {
                background-position: 100% 0%;
            }
        }

        #pluginMenu {
            z-index: 2147483645;
            color: white;
            position: fixed;
            top: 50%;
            right: 0px;
            padding: 10px;
            background-color: #565656;
            border: 1px solid #ccc;
            border-radius: 5px;
            box-shadow: 0 0 10px #ccc;
            transform: translate(85%, -50%);
            transition: transform 0.5s cubic-bezier(0,1,.60,1);
        }
        #pluginMenu ul {
            list-style: none;
            margin: 0;
            padding: 0;
        }
        #pluginMenu li {
            padding: 5px 10px;
            cursor: pointer;
            text-align: center;
            user-select: none;
        }
        #pluginMenu li:hover {
            background-color: #000000cc;
            border-radius: 3px;
        }
        #pluginMenu:hover {
            transform: translate(0%, -50%);
            transition-delay: 0.5s;
        }
        #pluginMenu:not(:hover) {
            transition-delay: 0s;
        }
        #pluginMenu.moving-out {
            transform: translate(0%, -50%);
        }
        #pluginMenu.moving-in {
            transform: translate(85%, -50%);
        }
        #pluginMenu:not(.moving-out):not(.moving-in) {
            transition-delay: 0s;
        }
        #pluginMenu:hover,
        #pluginMenu:hover ~ #pluginMenu {
            transition-delay: 0s;
        }
        #pluginMenu:hover {
            transition-duration: 0.5s;
        }
        #pluginMenu:not(:hover).moving-in {
            transition-delay: 0.5s;
        }

        #pluginConfig {
            color: var(--text);
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.75);
            z-index: 2147483647; 
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        }
        #pluginConfig .main {
            background-color: var(--body);
            padding: 24px;
            margin: 10px;
            overflow-y: auto;
            width: 400px;
        }
        @media (max-width: 640px) {
            #pluginConfig .main {
                width: 100%;
            }
        }
        #pluginConfig button {
            background-color: blue;
            padding: 10px 20px;
            color: white;
            font-size: 18px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        #pluginConfig button {
            background-color: blue;
        }
        #pluginConfig button[disabled] {
            background-color: darkgray;
            cursor: not-allowed;
        }
        #pluginConfig p {
            display: flex;
            flex-direction: column;
        }
        #pluginConfig p label{
            display: flex;
            flex-direction: column;
            margin: 5px;
        }
        #pluginConfig .inputRadioLine {
            display: flex;
            align-items: center;
            flex-direction: row;
            justify-content: space-between;
        }
        #pluginConfig input[type="text"], #pluginConfig input[type="password"] {
            outline: none;
            border-top: none;
            border-right: none;
            border-left: none;
            border-image: initial;
            border-bottom: 1px solid var(--muted);
            line-height: 1;
            height: 30px;
            box-sizing: border-box;
            width: 100%;
            background-color: var(--body);
            color: var(--text);
        }
        #pluginConfig input[type='checkbox'].switch{
            outline: none;
            appearance: none;
            -webkit-appearance: none;
            -moz-appearance: none;
            position: relative;
            width: 40px;
            height: 20px;
            background: #ccc;
            border-radius: 10px;
            transition: border-color .2s, background-color .2s;
        }
        #pluginConfig input[type='checkbox'].switch::after {
            content: '';
            display: inline-block;
            width: 1rem;
            height: 1rem;
            border-radius: 50%;
            background: #fff;
            box-shadow: 0, 0, 2px, #999;
            transition: .2s;
            top: 2px;
            position: absolute;
            right: 55%;
        }
        #pluginConfig input[type='checkbox'].switch:checked {
            background: rgb(19, 206, 102);
        }
        #pluginConfig input[type='checkbox'].switch:checked::after {
            content: '';
            position: absolute;
            right: 2px;
            top: 2px;
        }

        #pluginOverlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(128, 128, 128, 0.8);
            z-index: 2147483646; 
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        }
        #pluginOverlay .main {
            color: white;
            font-size: 24px;
            width: 60%;
            background-color: rgb(64,64,64,0.7);
            padding: 24px;
            margin: 10px;
            overflow-y: auto;
        }
        @media (max-width: 640px) {
            #pluginOverlay .main {
                width: 100%;
            }
        }
        #pluginOverlay button {
            padding: 10px 20px;
            color: white;
            font-size: 18px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        #pluginOverlay button {
            background-color: blue;
        }
        #pluginOverlay button[disabled] {
            background-color: darkgray;
            cursor: not-allowed;
        }
        #pluginOverlay .checkbox {
            width: 32px;
            height: 32px;
            margin: 0 4px 0 0;
            padding: 0;
        }
        #pluginOverlay .checkbox-container {
            display: flex;
            align-items: center;
            margin: 0 0 10px 0;
        }
        #pluginOverlay .checkbox-label {
            color: white;
            font-size: 32px;
            font-weight: bold;
            margin-left: 10px;
            display: flex;
            align-items: center;
        }

        .selectButton {
            position: absolute;
            width: 38px;
            height: 38px;
            bottom: 24px;
            right: 0px;
            cursor:pointer;
        }
        .selectButtonCompatible {
            width: 32px;
            height: 32px;
            bottom: 0px;
            right: 4px;
            transform: translate(-50%, -50%);
            margin: 0;
            padding: 0;
            cursor:pointer;
        }

        .toastify h3 {
            margin: 0 0 10px 0;
        }
        .toastify p {
            margin: 0 ;
        }
    `)
    var mouseTarget: Element = null
    var compatible = navigator.userAgent.toLowerCase().includes('firefox')
    var i18n = new I18N()
    var config = new Config()
    var db = new Database();
    var selectList = new SyncDictionary<string>('selectList')
    var editConfig = new configEdit(config)
    var pluginMenu = new menu()

    function getPlayload(authorization: string) {
        return JSON.parse(decodeURIComponent(encodeURIComponent(window.atob(authorization.split(' ').pop().split('.')[1]))))
    }

    const modifyFetch = async (input: Request | string | URL, init?: RequestInit) => {
        GM_getValue('isDebug') && console.log(`Fetch ${input}`)
        if ((input instanceof Request ? input.url : input instanceof URL ? input.href : input).toLowerCase().includes('sentry.io')) return undefined
        if (!isNull(init) && !isNull(init.headers) && !isStringTupleArray(init.headers)) {
            let authorization = null
            if (init.headers instanceof Headers) {
                authorization = init.headers.has('Authorization') ? init.headers.get('Authorization') : null
            } else {
                for (const key in init.headers) {
                    if (key.toLocaleLowerCase() === "authorization") {
                        authorization = init.headers[key]
                        break
                    }
                }
            }
            if (!isNull(authorization) && authorization !== config.authorization) {
                let playload = getPlayload(authorization)
                if (playload['type'] === 'refresh_token') {
                    GM_getValue('isDebug') && console.log(`refresh_token: ${authorization.split(' ').pop()}`)
                    isNull(localStorage.getItem('token')) && localStorage.setItem('token', authorization.split(' ').pop())
                }
                if (playload['type'] === 'access_token') {
                    config.authorization = `Bearer ${authorization.split(' ').pop()}`
                    GM_getValue('isDebug') && console.log(JSON.parse(decodeURIComponent(encodeURIComponent(window.atob(config.authorization.split('.')[1])))))
                    GM_getValue('isDebug') && console.log(`access_token: ${config.authorization.split(' ').pop()}`)
                }
            }
        }
        return originalFetch(input, init)
    }
    unsafeWindow.fetch = modifyFetch


    async function refreshToken(): Promise<string> {
        let refresh = config.authorization
        try {
            refresh = (await (await fetch(`https://api.iwara.tv/user/token`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            })).json())['accessToken']
        } catch (error) {
            console.warn(`Refresh token error: ${getString(error)}`)
        }
        return refresh
    }
    async function getXVersion(urlString: string): Promise<string> {
        let url = urlString.toURL()
        const data = new TextEncoder().encode(`${url.pathname.split("/").pop()}_${url.searchParams.get('expires')}_5nFp9kmbNnHdAFhaqMvt`)
        const hashBuffer = await crypto.subtle.digest('SHA-1', data)
        return Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')
    }
    async function getAuth(url?: string) {
        return originalObject.assign(
            {
                'Cooike': document.cookie,
                'Authorization': config.authorization
            },
            !isNull(url) && !url.isEmpty() ? { 'X-Version': await getXVersion(url) } : {}
        )
    }
    async function addDownloadTask() {
        let data = prompt(i18n[language()].manualDownloadTips.toString(), '')
        if (!isNull(data) && !(data.isEmpty())) {
            let IDList = new Dictionary<string>()
            data.toLowerCase().split('|').map(ID => ID.match(/((?<=(\[)).*?(?=(\])))/g)?.pop() ?? ID.match(/((?<=(\_)).*?(?=(\_)))/g)?.pop() ?? ID).prune().map(ID => IDList.set(ID, '手动解析'))
            analyzeDownloadTask(IDList)
        }
    }
    async function analyzeDownloadTask(list: IDictionary<string> = selectList) {
        let size = list.size
        let node = renderNode({
            nodeType: 'p',
            childs: `%#parsingProgress#%[${list.size}/${size}]`
        })
        let start = newToast(ToastType.Info, {
            node: node,
            duration: -1
        })
        start.showToast()
        if (GM_getValue('isDebug') && config.downloadType === DownloadType.Aria2) {
            let completed = (await aria2API('aria2.tellStopped', [0, 2048, [
                'gid',
                'status',
                'files',
                'errorCode',
                'bittorrent'
            ]])).result.filter((task: Aria2.Status) => isNull(task.bittorrent) && (task.status === 'complete' || task.errorCode === '13')).map((task: Aria2.Status) => aria2TaskExtractVideoID(task)).filter(Boolean)
            for (let key of list.keys().intersect(completed)) {
                let button = document.querySelector(`.selectButton[videoid="${key}"]`) as HTMLInputElement
                button && button.checked && button.click()
                list.del(key)
                node.firstChild.textContent = `${i18n[language()].parsingProgress}[${list.size}/${size}]`
            }
        }
        for (let key of list.keys()) {
            let videoInfo = await (new VideoInfo(list[key])).init(key)
            videoInfo.State && await pustDownloadTask(videoInfo)
            let button = document.querySelector(`.selectButton[videoid="${key}"]`) as HTMLInputElement
            button && button.checked && button.click()
            list.del(key)
            node.firstChild.textContent = `${i18n[language()].parsingProgress}[${list.size}/${size}]`
        }
        start.hideToast()
        if (size != 1) {
            let completed = newToast(
                ToastType.Info,
                {
                    text: `%#allCompleted#%`,
                    duration: -1,
                    close: true,
                    onClick() {
                        completed.hideToast()
                    }
                }
            )
            completed.showToast()
        }
    }
    function checkIsHaveDownloadLink(comment: string): boolean {
        if (!config.checkDownloadLink || isNull(comment) || comment.isEmpty()) {
            return false
        }
        return [
            'pan.baidu',
            '/s/',
            'mega.nz',
            'drive.google.com',
            'aliyundrive',
            'uploadgig',
            'katfile',
            'storex',
            'subyshare',
            'rapidgator',
            'filebe',
            'filespace',
            'mexa.sh',
            'mexashare',
            'mx-sh.net',
            'uploaded.',
            'icerbox',
            'alfafile',
            '1drv.ms',
            'onedrive.',
            'pixeldrain.',
            'gigafile.nu'
        ].filter(i => comment.toLowerCase().includes(i)).any()
    }
    function toastNode(body: RenderCode | RenderCode[], title?: string): Element | Node {
        return renderNode({
            nodeType: 'div',
            childs: [
                !isNull(title) && !title.isEmpty() ? {
                    nodeType: 'h3',
                    childs: `%#appName#% - ${title}`
                } : {
                    nodeType: 'h3',
                    childs: '%#appName#%'
                }
                ,
                {
                    nodeType: 'p',
                    childs: body
                }
            ]
        })
    }
    function getTextNode(node: Node | Element): string {
        return node.nodeType === Node.TEXT_NODE
            ? node.textContent || ''
            : node.nodeType === Node.ELEMENT_NODE
                ? Array.from(node.childNodes)
                    .map(getTextNode)
                    .join('')
                : ''
    }
    function newToast(type: ToastType, params?: Toastify.Options) {
        const logFunc = {
            [ToastType.Warn]: console.warn,
            [ToastType.Error]: console.error,
            [ToastType.Log]: console.log,
            [ToastType.Info]: console.info,
        }[type] || console.log
        params = originalObject.assign({
            newWindow: true,
            gravity: 'top',
            position: 'left',
            stopOnFocus: true
        },
            type === ToastType.Warn && {
                duration: -1,
                style: {
                    background: 'linear-gradient(-30deg, rgb(119 76 0), rgb(255 165 0))'
                }
            },
            type === ToastType.Error && {
                duration: -1,
                style: {
                    background: 'linear-gradient(-30deg, rgb(108 0 0), rgb(215 0 0))'
                }
            },
            !isNull(params) && params
        )
        if (!isNull(params.text)) {
            params.text = params.text.replaceVariable(i18n[language()]).toString()
        }
        logFunc((!isNull(params.text) ? params.text : !isNull(params.node) ? getTextNode(params.node) : 'undefined').replaceVariable(i18n[language()]))
        return Toastify(params)
    }
    async function pustDownloadTask(videoInfo: VideoInfo) {
        if (config.autoFollow && !videoInfo.Following) {
            if ((await fetch(`https://api.iwara.tv/user/${videoInfo.AuthorID}/followers`, {
                method: 'POST',
                headers: await getAuth()
            })).status !== 201) newToast(ToastType.Warn, { text: `${videoInfo.Alias} %#autoFollowFailed#%`, close: true }).showToast()
        }
        if (config.autoLike && !videoInfo.Liked) {
            if ((await fetch(`https://api.iwara.tv/video/${videoInfo.ID}/like`, {
                method: 'POST',
                headers: await getAuth()
            })).status !== 201) newToast(ToastType.Warn, { text: `${videoInfo.Alias} %#autoLikeFailed#%`, close: true }).showToast()
        }
        if (config.checkDownloadLink && checkIsHaveDownloadLink(videoInfo.Comments)) {
            let toast = newToast(
                ToastType.Warn,
                {
                    node: toastNode([
                        `${videoInfo.Name}[${videoInfo.ID}] %#findedDownloadLink#%`,
                        { nodeType: 'br' },
                        `%#openVideoLink#%`
                    ], '%#createTask#%'),
                    onClick() {
                        GM_openInTab(`https://www.iwara.tv/video/${videoInfo.ID}`, { active: false, insert: true, setParent: true })
                        toast.hideToast()
                    }
                }
            )
            toast.showToast()
            return
        }
        if (config.checkPrioritySource && videoInfo.DownloadQuality != 'Source') {
            let toast = newToast(
                ToastType.Warn,
                {
                    node: toastNode([
                        `${videoInfo.Name}[${videoInfo.ID}] %#downloadQualityError#%`,
                        { nodeType: 'br' },
                        `%#tryReparseDownload#%`
                    ], '%#createTask#%'),
                    onClick() {
                        analyzeDownloadTask(new Dictionary<string>([{ key: videoInfo.ID, value: videoInfo.Name }]))
                        toast.hideToast()
                    }
                }
            )
            toast.showToast()
            return
        }
        switch (config.downloadType) {
            case DownloadType.Aria2:
                aria2Download(videoInfo)
                break
            case DownloadType.IwaraDownloader:
                iwaraDownloaderDownload(videoInfo)
                break
            case DownloadType.Browser:
                browserDownload(videoInfo)
                break
            default:
                othersDownload(videoInfo)
                break
        }
    }
    function analyzeLocalPath(path: string): LocalPath {
        let matchPath = path.replaceAll('//', '/').replaceAll('\\\\', '/').match(/^([a-zA-Z]:)?[\/\\]?([^\/\\]+[\/\\])*([^\/\\]+\.\w+)$/)
        if (isNull(matchPath)) throw new Error(`%#downloadPathError#%["${path}"]`)
        try {
            return {
                fullPath: matchPath[0],
                drive: matchPath[1] || '',
                filename: matchPath[3]
            }
        } catch (error) {
            throw new Error(`%#downloadPathError#% ["${matchPath.join(',')}"]`)
        }
    }
    async function EnvCheck(): Promise<boolean> {
        try {
            if (GM_info.downloadMode !== 'browser') {
                GM_getValue('isDebug') && console.log(GM_info)
                throw new Error('%#browserDownloadModeError#%')
            }
        } catch (error: any) {
            let toast = newToast(
                ToastType.Error,
                {
                    node: toastNode([
                        `%#configError#%`,
                        { nodeType: 'br' },
                        getString(error)
                    ], '%#settingsCheck#%'),
                    position: 'center',
                    onClick() {
                        toast.hideToast()
                    }
                }
            )
            toast.showToast()
            return false
        }
        return true
    }
    async function localPathCheck(): Promise<boolean> {
        try {
            let pathTest = analyzeLocalPath(config.downloadPath)
            for (const key in pathTest) {
                if (!originalObject.prototype.hasOwnProperty.call(pathTest, key) || pathTest[key]) {
                    //todo localPathCheck
                }
            }
        } catch (error: any) {
            let toast = newToast(
                ToastType.Error,
                {
                    node: toastNode([
                        `%#downloadPathError#%`,
                        { nodeType: 'br' },
                        getString(error)
                    ], '%#settingsCheck#%'),
                    position: 'center',
                    onClick() {
                        toast.hideToast()
                    }
                }
            )
            toast.showToast()
            return false
        }
        return true
    }
    async function aria2Check(): Promise<boolean> {
        try {
            let res = await (await fetch(config.aria2Path, {
                method: 'POST',
                body: JSON.stringify({
                    'jsonrpc': '2.0',
                    'method': 'aria2.tellActive',
                    'id': UUID(),
                    'params': ['token:' + config.aria2Token]
                })
            })).json()
            if (res.error) {
                throw new Error(res.error.message)
            }
        } catch (error: any) {
            let toast = newToast(
                ToastType.Error,
                {
                    node: toastNode([
                        `Aria2 RPC %#connectionTest#%`,
                        { nodeType: 'br' },
                        getString(error)
                    ], '%#settingsCheck#%'),
                    position: 'center',
                    onClick() {
                        toast.hideToast()
                    }
                }
            )
            toast.showToast()
            return false
        }
        return true
    }
    async function iwaraDownloaderCheck(): Promise<boolean> {
        try {
            let res = await (await fetch(config.iwaraDownloaderPath, {
                method: 'POST',
                body: JSON.stringify(prune({
                    'ver': GM_getValue('version', '0.0.0').split('.').map(i => Number(i)),
                    'code': 'State',
                    'token': config.iwaraDownloaderToken
                }))
            })).json()
            if (res.code !== 0) {
                throw new Error(res.msg)
            }
        } catch (error) {
            let toast = newToast(
                ToastType.Error,
                {
                    node: toastNode([
                        `IwaraDownloader RPC %#connectionTest#%`,
                        { nodeType: 'br' },
                        getString(error)
                    ], '%#settingsCheck#%'),
                    position: 'center',
                    onClick() {
                        toast.hideToast()
                    }
                }
            )
            toast.showToast()
            return false
        }
        return true
    }
    function aria2Download(videoInfo: VideoInfo) {
        (async function (id: string, author: string, name: string, uploadTime: Date, info: string, tag: Array<{
            id: string
            type: string
        }>, quality: string, alias: string, downloadUrl: string) {
            let localPath = analyzeLocalPath(config.downloadPath.replaceVariable(
                {
                    NowTime: new Date(),
                    UploadTime: uploadTime,
                    AUTHOR: author,
                    ID: id,
                    TITLE: name,
                    ALIAS: alias,
                    QUALITY: quality
                }
            ).trim())

            let res = await aria2API('aria2.addUri', [
                [downloadUrl],
                prune({
                    'all-proxy': config.downloadProxy,
                    'out': localPath.filename,
                    'dir': localPath.fullPath.replace(localPath.filename, ''),
                    'referer': window.location.hostname,
                    'header': [
                        'Cookie:' + document.cookie
                    ]
                })
            ])
            console.log(`Aria2 ${name} ${JSON.stringify(res)}`)
            newToast(
                ToastType.Info,
                {
                    node: toastNode(`${videoInfo.Name}[${videoInfo.ID}] %#pushTaskSucceed#%`)
                }
            ).showToast()
        }(videoInfo.ID, videoInfo.Author, videoInfo.Name, videoInfo.UploadTime, videoInfo.Comments, videoInfo.Tags, videoInfo.DownloadQuality, videoInfo.Alias, videoInfo.DownloadUrl))
    }
    function iwaraDownloaderDownload(videoInfo: VideoInfo) {
        (async function (videoInfo: VideoInfo) {
            let r = await (await fetch(config.iwaraDownloaderPath, {
                method: 'POST',
                body: JSON.stringify(prune({
                    'ver': GM_getValue('version', '0.0.0').split('.').map(i => Number(i)),
                    'code': 'add',
                    'token': config.iwaraDownloaderToken,
                    'data': {
                        'info': {
                            'name': videoInfo.Name,
                            'url': videoInfo.DownloadUrl,
                            'size': videoInfo.Size,
                            'source': videoInfo.ID,
                            'alias': videoInfo.Alias,
                            'author': videoInfo.Author,
                            'uploadTime': videoInfo.UploadTime,
                            'comments': videoInfo.Comments,
                            'tags': videoInfo.Tags,
                            'path': config.downloadPath.replaceVariable(
                                {
                                    NowTime: new Date(),
                                    UploadTime: videoInfo.UploadTime,
                                    AUTHOR: videoInfo.Author,
                                    ID: videoInfo.ID,
                                    TITLE: videoInfo.Name,
                                    ALIAS: videoInfo.Alias,
                                    QUALITY: videoInfo.DownloadQuality
                                }
                            )
                        },
                        'option': {
                            'proxy': config.downloadProxy,
                            'cookies': document.cookie
                        }
                    }
                }))
            })).json()
            if (r.code === 0) {
                console.log(`${videoInfo.Name} %#pushTaskSucceed#% ${r}`)
                newToast(
                    ToastType.Info,
                    {
                        node: toastNode(`${videoInfo.Name}[${videoInfo.ID}] %#pushTaskSucceed#%`)
                    }
                ).showToast()
            } else {
                let toast = newToast(
                    ToastType.Error,
                    {
                        node: toastNode([
                            `${videoInfo.Name}[${videoInfo.ID}] %#pushTaskFailed#% `,
                            { nodeType: 'br' },
                            r.msg
                        ], '%#iwaraDownloaderDownload#%'),
                        onClick() {
                            toast.hideToast()
                        }
                    }
                )
                toast.showToast()
            }
        }(videoInfo))
    }
    function othersDownload(videoInfo: VideoInfo) {
        (async function (ID: string, Author: string, Name: string, UploadTime: Date, DownloadQuality: string, Alias: string, DownloadUrl: URL) {
            let filename = analyzeLocalPath(config.downloadPath.replaceVariable(
                {
                    NowTime: new Date(),
                    UploadTime: UploadTime,
                    AUTHOR: Author,
                    ID: ID,
                    TITLE: Name,
                    ALIAS: Alias,
                    QUALITY: DownloadQuality
                }
            ).trim()).filename
            DownloadUrl.searchParams.set('download', filename)
            GM_openInTab(DownloadUrl.href, { active: false, insert: true, setParent: true })
        }(videoInfo.ID, videoInfo.Author, videoInfo.Name, videoInfo.UploadTime, videoInfo.DownloadQuality, videoInfo.Alias, videoInfo.DownloadUrl.toURL()))
    }
    function browserDownload(videoInfo: VideoInfo) {
        (async function (ID: string, Author: string, Name: string, UploadTime: Date, Info: string, Tag: Array<{
            id: string
            type: string
        }>, DownloadQuality: string, Alias: string, DownloadUrl: string) {
            function browserDownloadError(error: Tampermonkey.DownloadErrorResponse | Error) {
                let errorInfo = getString(Error)
                if (!(error instanceof Error)) {
                    errorInfo = {
                        'not_enabled': `%#browserDownloadNotEnabled#%`,
                        'not_whitelisted': `%#browserDownloadNotWhitelisted#%`,
                        'not_permitted': `%#browserDownloadNotPermitted#%`,
                        'not_supported': `%#browserDownloadNotSupported#%`,
                        'not_succeeded': `%#browserDownloadNotSucceeded#% ${error.details ?? getString(error.details)}`
                    }[error.error] || `%#browserDownloadUnknownError#%`
                }
                let toast = newToast(
                    ToastType.Error,
                    {
                        node: toastNode([
                            `${Name}[${ID}] %#downloadFailed#%`,
                            { nodeType: 'br' },
                            errorInfo,
                            { nodeType: 'br' },
                            `%#tryRestartingDownload#%`
                        ], '%#browserDownload#%'),
                        onClick() {
                            analyzeDownloadTask(new Dictionary<string>([{ key: ID, value: Name }]))
                            toast.hideToast()
                        }
                    }
                )
                toast.showToast()
            }
            GM_download({
                url: DownloadUrl,
                saveAs: false,
                name: config.downloadPath.replaceVariable(
                    {
                        NowTime: new Date(),
                        UploadTime: UploadTime,
                        AUTHOR: Author,
                        ID: ID,
                        TITLE: Name,
                        ALIAS: Alias,
                        QUALITY: DownloadQuality
                    }
                ).trim(),
                onerror: (err) => browserDownloadError(err),
                ontimeout: () => browserDownloadError(new Error('%#browserDownloadTimeout#%'))
            })
        }(videoInfo.ID, videoInfo.Author, videoInfo.Name, videoInfo.UploadTime, videoInfo.Comments, videoInfo.Tags, videoInfo.DownloadQuality, videoInfo.Alias, videoInfo.DownloadUrl))
    }
    async function aria2API(method: string, params: any) {
        return await (await fetch(config.aria2Path, {
            headers: {
                'accept': 'application/json',
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: method,
                id: UUID(),
                params: [`token:${config.aria2Token}`, ...params]
            }),
            method: 'POST'
        })).json()
    }
    function aria2TaskExtractVideoID(task: Aria2.Status): string | null {
        if (isNull(task.files)) {
            GM_getValue('isDebug') && console.log(`check aria2 task files fail! ${JSON.stringify(task)}`)
            return null
        }
        for (let index = 0; index < task.files.length; index++) {
            const file = task.files[index]
            if (isNull(file)) {
                GM_getValue('isDebug') && console.log(`check aria2 task file fail! ${JSON.stringify(task.files)}`)
                continue
            }
            // 仅支持路径最后一组[]中包含%#ID#%的路径
            // todo: 支持自定义提取ID表达式
            let videoID: string = analyzeLocalPath(file.path).filename.toLowerCase().match(/\[([^\[\]]*)\](?=[^\[]*$)/g).pop()?.trimHead('[').trimTail(']');
            if (isNull(videoID) || videoID.isEmpty()) {
                GM_getValue('isDebug') && console.log(`check aria2 task videoID fail! ${JSON.stringify(file.path)}`)
                continue
            }
            return videoID
        }
        return null
    }
    async function aria2TaskCheck() {
        let completed = (await aria2API('aria2.tellStopped', [0, 2048, [
            'gid',
            'status',
            'files',
            'errorCode',
            'bittorrent'
        ]])).result.filter((task: Aria2.Status) => isNull(task.bittorrent) && (task.status === 'complete' || task.errorCode === '13')).map((task: Aria2.Status) => aria2TaskExtractVideoID(task)).filter(Boolean)

        let active = await aria2API('aria2.tellActive', [[
            'gid',
            'downloadSpeed',
            'files',
            'bittorrent'
        ]])

        let needRestart: Aria2.Status[] = active.result.filter((i: Aria2.Status) => isNull(i.bittorrent) && !Number.isNaN(i.downloadSpeed) && Number(i.downloadSpeed) <= 1024)

        for (let index = 0; index < needRestart.length; index++) {
            const task = needRestart[index]
            let videoID = aria2TaskExtractVideoID(task)
            if (!isNull(videoID) && !videoID.isEmpty()) {
                if (!completed.includes(videoID)) {
                    let videoInfo = await (new VideoInfo(videoID)).init(videoID)
                    videoInfo.State && await pustDownloadTask(videoInfo)
                }
                await aria2API('aria2.forceRemove', [task.gid])
            }
        }

    }
    function injectCheckbox(element: Element, compatible: boolean) {
        let ID = (element.querySelector('a.videoTeaser__thumbnail') as HTMLLinkElement).href.toLowerCase().toURL().pathname.split('/')[2]
        let Name = element.querySelector('.videoTeaser__title').getAttribute('title').trim()
        let node = compatible ? element : element.querySelector('.videoTeaser__thumbnail')
        node.originalAppendChild(renderNode({
            nodeType: 'input',
            attributes: originalObject.assign(
                selectList.has(ID) ? { checked: true } : {}, {
                type: 'checkbox',
                videoID: ID,
                videoName: Name
            }),
            className: compatible ? ['selectButton', 'selectButtonCompatible'] : 'selectButton',
            events: {
                click: (event: Event) => {
                    (event.target as HTMLInputElement).checked ? selectList.set(ID, Name) : selectList.del(ID)
                    event.stopPropagation()
                    event.stopImmediatePropagation()
                    return false
                }
            }
        }))
    }

    function firstRun() {
        console.log('First run config reset!')
        GM_listValues().forEach(i => GM_deleteValue(i))
        config = new Config()
        editConfig = new configEdit(config)
        let confirmButton = renderNode({
            nodeType: 'button',
            attributes: {
                disabled: true,
                title: i18n[language()].ok
            },
            childs: '%#ok#%',
            events: {
                click: () => {
                    GM_setValue('isFirstRun', false)
                    GM_setValue('version', GM_info.script.version)
                    document.querySelector('#pluginOverlay').remove()
                    editConfig.inject()
                }
            }
        }) as HTMLButtonElement
        document.body.originalAppendChild(renderNode({
            nodeType: 'div',
            attributes: {
                id: 'pluginOverlay'
            },
            childs: [
                {
                    nodeType: 'div',
                    className: 'main',
                    childs: [
                        { nodeType: 'p', childs: '%#useHelpForInjectCheckbox#%' },
                        { nodeType: 'p', childs: '%#useHelpForCheckDownloadLink#%' },
                        { nodeType: 'p', childs: '%#useHelpForManualDownload#%' },
                        { nodeType: 'p', childs: i18n[language()].useHelpForBugreport }
                    ]
                },
                {
                    nodeType: 'div',
                    className: 'checkbox-container',
                    childs: {
                        nodeType: 'label',
                        className: ['checkbox-label', 'rainbow-text'],
                        childs: [{
                            nodeType: 'input',
                            className: 'checkbox',
                            attributes: {
                                type: 'checkbox',
                                name: 'agree-checkbox'
                            },
                            events: {
                                change: (event: Event) => {
                                    confirmButton.disabled = !(event.target as HTMLInputElement).checked
                                }
                            }
                        }, '%#alreadyKnowHowToUse#%'
                        ]
                    }
                },
                confirmButton
            ]
        }))
    }

    async function main() {
        if (GM_getValue('isFirstRun', true)) {
            firstRun()
            return
        }
        if (!await config.check()) {
            newToast(ToastType.Info, {
                text: `%#configError#%`,
                duration: 60 * 1000,
            }).showToast()
            editConfig.inject()
            return
        }
        GM_setValue('version', GM_info.script.version)
        if (config.autoInjectCheckbox) {
            Node.prototype.appendChild = function <T extends Node>(node: T): T {
                if (node instanceof HTMLElement && node.classList.contains('videoTeaser')) {
                    injectCheckbox(node, compatible)
                }
                return this.originalAppendChild(node)
            }
        }
        
        pluginMenu.inject()

        originalAddEventListener('mouseover', (event: Event) => {
            mouseTarget = (event as MouseEvent).target instanceof Element ? (event as MouseEvent).target as Element : null
        })

        document.addEventListener('keydown', function (e) {
            if (e.code === 'Space' && !isNull(mouseTarget)) {
                let element = findElement(mouseTarget, '.videoTeaser')
                let button = element && (element.matches('.selectButton') ? element : element.querySelector('.selectButton'))
                button && (button as HTMLInputElement).click()
                button && e.preventDefault()
            }
        })


        newToast(
            ToastType.Info,
            {
                node: toastNode([
                    `加载完成`,
                    { nodeType: 'br' },
                    `公告: %#notice#%`
                ]),
                duration: 10000,
                gravity: 'bottom',
                position: 'center'
            }
        ).showToast()
    }

    if (compareVersions(GM_getValue('version', '0.0.0'), '3.1.300') === VersionState.low) {
        GM_setValue('isFirstRun', true)
        alert(i18n[language()].configurationIncompatible)
    }

    (document.body ? Promise.resolve() : new Promise(resolve => originalAddEventListener.call(document, "DOMContentLoaded", resolve))).then(main)
})();