(async function () {
    if (GM_getValue('isDebug')) {
        debugger
    }
    /**
     * RenderCode 转换成 Node
     * @param renderCode - RenderCode
     * @returns Node 节点
     */
    const renderNode = function (renderCode: RenderCode): Node | Element {
        if (typeof renderCode === "string") {
            return document.createTextNode(renderCode)
        }
        if (renderCode instanceof Node) {
            return renderCode
        }
        if (typeof renderCode !== "object" || !renderCode.nodeType) {
            throw new Error('Invalid arguments')
        }
        const { nodeType, attributes, events, className, childs } = renderCode
        const node: Element = document.createElement(nodeType);
        (attributes !== undefined && attributes !== null && Object.keys(attributes).length !== 0) && Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
        (events !== undefined && events !== null && Object.keys(events).length > 0) && Object.entries(events).forEach(([eventName, eventHandler]) => node.addEventListener(eventName, eventHandler));
        (className !== undefined && className !== null && className.length > 0) && node.classList.add(...[].concat(className));
        (childs !== undefined && childs !== null) && node.append(...[].concat(childs).map(renderNode));
        return node
    }
    class Queue<T> {
        private items: QueueItem<T>[];
        constructor() {
            this.items = []
        }
        public enqueue(id: string, element: T): void {
            this.items.push({ id, data: element })
        }
        public dequeue(): QueueItem<T> | undefined {
            return this.items.shift()
        }
        public peek(): QueueItem<T> | undefined {
            return this.items[0]
        }
        public size(): number {
            return this.items.length
        }
        public isEmpty(): boolean {
            return this.items.length === 0
        }
        public clear(): void {
            this.items = []
        }
        public remove(id: string): void {
            const index = this.items.findIndex(item => item.id === id);
            if (index !== -1) {
                this.items.splice(index, 1)
            }
        }
    }
    class Dictionary<T> {
        public items: { [key: string]: T };
        constructor() {
            this.items = {};
        }
        public set(key: string, value: T): void {
            this.items[key] = value;
        }
        public get(key: string): T | undefined {
            return this.has(key) ? this.items[key] : undefined;
        }
        public has(key: string): boolean {
            return this.items.hasOwnProperty(key);
        }
        public remove(key: string): boolean {
            if (this.has(key)) {
                delete this.items[key];
                return true;
            }
            return false;
        }
        public get size(): number {
            return Object.keys(this.items).length;
        }
        public keys(): string[] {
            return Object.keys(this.items);
        }
        public values(): T[] {
            return Object.values(this.items);
        }
        public clear(): void {
            this.items = {};
        }
        public forEach(callback: (key: string, value: T) => void): void {
            for (let key in this.items) {
                if (this.has(key)) {
                    callback(key, this.items[key]);
                }
            }
        }
    }

    enum DownloadType {
        Aria2,
        IwaraDownloader,
        Others
    }
    enum TipsType {
        Info,
        Warning,
        Success,
        Progress,
        Dialog
    }

    class Config {
        cookies: Array<any>
        checkDownloadLink: boolean
        downloadType: DownloadType
        downloadPath: string
        downloadProxy: string
        aria2Path: string
        aria2Token: string
        iwaraDownloaderPath: string
        iwaraDownloaderToken: string
        constructor() {
            //初始化
            this.checkDownloadLink = GM_getValue('checkDownloadLink', true)
            this.downloadType = GM_getValue('downloadType', DownloadType.Others)
            this.downloadPath = GM_getValue('downloadPath', '')
            this.downloadProxy = GM_getValue('downloadProxy', '')
            this.aria2Path = GM_getValue('aria2Path', 'http://127.0.0.1:6800/jsonrpc')
            this.aria2Token = GM_getValue('aria2Token', '')
            this.iwaraDownloaderPath = GM_getValue('iwaraDownloaderPath', 'http://127.0.0.1:6800/jsonrpc')
            this.iwaraDownloaderToken = GM_getValue('iwaraDownloaderToken', '')
            //代理本页面的更改
            let body = new Proxy(this, {
                get: function (target, property) {
                    console.log(`get ${property.toString()}`)
                    return target[property]
                },
                set: function (target, property, value) {
                    if (target[property] !== value && !GM_getValue('isFirstRun', true)) {
                        let setr = Reflect.set(target, property, value);
                        console.log(`set ${property.toString()} ${value} ${setr}`)
                        GM_setValue(property.toString(), value)
                        target.configChange(property.toString())
                        return setr
                    }
                    return true;
                }
            })
            //同步其他页面脚本的更改
            GM_listValues().forEach((value) => {
                GM_addValueChangeListener(value, (name: string, old_value: any, new_value: any, remote: boolean) => {
                    if (remote && body[name] !== new_value && !GM_getValue('isFirstRun', true)) {
                        body[name] = new_value
                    }
                })
            })
            GM_cookie('list', { domain: 'iwara.tv', httpOnly: true }, (list, error) => {
                if (error) {
                    console.log(error)
                } else {
                    body.cookies = list;
                }
            })
            return body
        }
        private downloadTypeItem(type: DownloadType): RenderCode {
            return {
                nodeType: 'label',
                className: 'inputRadio',
                childs: [
                    DownloadType[type],
                    {
                        nodeType: 'input',
                        attributes: Object.assign(
                            {
                                name: 'DownloadType',
                                type: 'radio',
                                value: type
                            },
                            config.downloadType == type ? { checked: true } : {}
                        ),
                        events: {
                            change: () => {
                                config.downloadType = type
                            }
                        }
                    }
                ]
            }
        }
        private configChange(item: string) {
            switch (item) {
                case 'downloadType':
                    let page: HTMLElement = document.querySelector('#pluginConfigPage');
                    while (page.hasChildNodes()) {
                        page.removeChild(page.firstChild);
                    }
                    let downloadConfigInput = [
                        renderNode({
                            nodeType: 'label',
                            childs: [
                                '下载到：',
                                {
                                    nodeType: 'input',
                                    attributes: Object.assign(
                                        {
                                            name: 'DownloadPath',
                                            type: 'Text',
                                            value: config.downloadPath
                                        }
                                    ),
                                    events: {
                                        change: (event: Event) => {
                                            config.downloadPath = (event.target as HTMLInputElement).value
                                        }
                                    }
                                }
                            ]
                        }),
                        renderNode({
                            nodeType: 'label',
                            childs: [
                                '下载代理：',
                                {
                                    nodeType: 'input',
                                    attributes: Object.assign(
                                        {
                                            name: 'DownloadProxy',
                                            type: 'Text',
                                            value: config.downloadProxy
                                        }
                                    ),
                                    events: {
                                        change: (event: Event) => {
                                            config.downloadProxy = (event.target as HTMLInputElement).value
                                        }
                                    }
                                }
                            ]
                        })
                    ]
                    let aria2ConfigInput = [
                        renderNode({
                            nodeType: 'label',
                            childs: [
                                'Aria2 RPC：',
                                {
                                    nodeType: 'input',
                                    attributes: Object.assign(
                                        {
                                            name: 'Aria2Path',
                                            type: 'Text',
                                            value: config.aria2Path
                                        }
                                    ),
                                    events: {
                                        change: (event: Event) => {
                                            config.aria2Path = (event.target as HTMLInputElement).value
                                        }
                                    }
                                }
                            ]
                        }),
                        renderNode({
                            nodeType: 'label',
                            childs: [
                                'Aria2 Token：',
                                {
                                    nodeType: 'input',
                                    attributes: Object.assign(
                                        {
                                            name: 'Aria2Token',
                                            type: 'Text',
                                            value: config.aria2Token
                                        }
                                    ),
                                    events: {
                                        change: (event: Event) => {
                                            config.aria2Token = (event.target as HTMLInputElement).value
                                        }
                                    }
                                }
                            ]
                        })
                    ]
                    let iwaraDownloaderConfigInput = [
                        renderNode({
                            nodeType: 'label',
                            childs: [
                                'IwaraDownloader RPC：',
                                {
                                    nodeType: 'input',
                                    attributes: Object.assign(
                                        {
                                            name: 'IwaraDownloaderPath',
                                            type: 'Text',
                                            value: config.iwaraDownloaderPath
                                        }
                                    ),
                                    events: {
                                        change: (event: Event) => {
                                            config.iwaraDownloaderPath = (event.target as HTMLInputElement).value
                                        }
                                    }
                                }
                            ]
                        }),
                        renderNode({
                            nodeType: 'label',
                            childs: [
                                'IwaraDownloader Token：',
                                {
                                    nodeType: 'input',
                                    attributes: Object.assign(
                                        {
                                            name: 'IwaraDownloaderToken',
                                            type: 'Text',
                                            value: config.iwaraDownloaderToken
                                        }
                                    ),
                                    events: {
                                        change: (event: Event) => {
                                            config.downloadProxy = (event.target as HTMLInputElement).value
                                        }
                                    }
                                }
                            ]
                        })
                    ]
                    switch (config.downloadType) {
                        case DownloadType.Aria2:
                            downloadConfigInput.map(i => page.appendChild(i))
                            aria2ConfigInput.map(i => page.appendChild(i))
                            break;
                        case DownloadType.IwaraDownloader:
                            downloadConfigInput.map(i => page.appendChild(i))
                            iwaraDownloaderConfigInput.map(i => page.appendChild(i))
                            break;
                        default:
                            break;
                    }
                    break;
                default:
                    break;
            }
        }
        public edit() {
            if (!document.querySelector('#pluginConfig')) {
                let editor = renderNode({
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
                                    childs: 'Iwara 批量下载工具'
                                },
                                {
                                    nodeType: 'p',
                                    className: 'inputRadioLine',
                                    childs: [
                                        '下载方式：',
                                        ...Object.keys(DownloadType).map(i => !Object.is(Number(i), NaN) ? this.downloadTypeItem(Number(i)) : undefined).filter(Boolean)
                                    ]
                                },
                                {
                                    nodeType: 'p',
                                    attributes: {
                                        id: 'pluginConfigPage'
                                    }
                                }
                            ]
                        },
                        {
                            nodeType: 'button',
                            className: 'closeButton',
                            childs: '保存',
                            events: {
                                click: () => {
                                    editor.remove()
                                }
                            }
                        }
                    ]
                }) as HTMLElement
                document.body.appendChild(editor)
                this.configChange('downloadType')
            }
        }
    }
    class VideoInfo {
        Title: RenderCode
        ID: string
        UploadTime: Date
        Name: string | null
        FileName: string
        Tags: string[]
        Author: string | null
        Private: boolean
        VideoInfoSource: VideoInfoAPIRawData
        VideoFileSource: VideoFileAPIRawDataList
        State: boolean
        getDownloadQuality: () => string
        getDownloadUrl: () => string
        getComment: () => string
        constructor(Name: string) {
            this.Title = { nodeType: 'h2', childs: 'Iwara批量下载工具-解析模块' }
            this.Name = Name
            return this;
        }
        async init(ID: string) {
            try {
                this.ID = ID
                this.VideoInfoSource = JSON.parse(await get(`https://api.iwara.tv/video/${this.ID}`))
                if (this.VideoInfoSource.id === undefined) {
                    throw new Error('获取视频信息失败')
                }
                this.Name = this.VideoInfoSource.title ?? this.Name
                this.Author = this.VideoInfoSource.user.username.replace(/^\.|[\\\\/:*?\"<>|.]/img, '_')
                this.Private = this.VideoInfoSource.private
                this.UploadTime = new Date(this.VideoInfoSource.createdAt)
                this.Tags = this.VideoInfoSource.tags.map((i) => i.id)
                this.FileName = this.VideoInfoSource.file.name.replace(/^\.|[\\\\/:*?\"<>|.]/img, '_')
                this.VideoFileSource = JSON.parse(await get(this.VideoInfoSource.fileUrl))
                if (this.VideoFileSource.length == 0) {
                    throw new Error('获取视频源失败')
                }
                this.getComment = () => {
                    return this.VideoInfoSource.body
                }
                this.getDownloadQuality = () => {
                    let priority = {
                        'Source': 100,
                        '540': 2,
                        '360': 1
                    }
                    return this.VideoFileSource.sort((a, b) => priority[b.name] - priority[a.name])[0].name
                }
                this.getDownloadUrl = () => {
                    let fileList = this.VideoFileSource.filter(x => x.name == this.getDownloadQuality())
                    return decodeURIComponent('https:' + fileList[Math.floor(Math.random() * fileList.length)].src.download)
                }
                this.State = true
                return this
            } catch (error) {
                console.error(`${this.Name}[${this.ID}] ${error}`)
                console.log(this.VideoInfoSource)
                console.log(this.VideoFileSource)
                this.State = false
                return this
            }
        }
    }

    function parseSearchParams(searchParams: URLSearchParams, initialObject = {}): {} {
        return [...searchParams.entries()].reduce((acc, [key, value]) => ({ ...acc, [key]: value }), initialObject);
    }
    async function getXVersion(urlString: string): Promise<string> {
        let url = new URL(urlString)
        let params = parseSearchParams(url.searchParams)
        const data = new TextEncoder().encode(`${url.pathname.split("/").pop()}_${params['expires']}_5nFp9kmbNnHdAFhaqMvt`);
        const hashBuffer = await crypto.subtle.digest("SHA-1", data);
        return Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, "0"))
            .join("");
    }

    async function get(url: string, referrer: string = window.location.hostname, headers: object = {}) {
        if (url.split('//')[1].split('/')[0] == window.location.hostname) {
            return await (await fetch(url, {
                'headers': Object.assign({
                    'accept': 'application/json, text/plain, */*',
                    'x-version': await getXVersion(url)
                }, headers),
                "referrerPolicy": "strict-origin-when-cross-origin",
                'referrer': referrer,
                'method': 'GET',
                'mode': 'cors',
                'redirect': 'follow',
                'credentials': 'omit'
            })).text()
        } else {
            let data: any = await new Promise(async (resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    headers: Object.assign({
                        'Accept': 'application/json, text/plain, */*',
                        'x-version': await getXVersion(url)
                    }, headers),
                    onload: function (response: any) {
                        resolve(response)
                    },
                    onerror: function (error: any) {
                        reject(error)
                    }
                })
            })
            return data.responseText
        }
    }
    async function post(url: string, body: any, referrer: string = window.location.hostname, headers: object = {}) {
        if (typeof body !== 'string') body = JSON.stringify(body)
        if (url.split('//')[1].split('/')[0] == window.location.hostname) {
            return await (await fetch(url, {
                'headers': Object.assign({
                    'accept': 'application/json, text/plain, */*'
                }, headers),
                'referrer': referrer,
                'body': body,
                'method': 'POST',
                'mode': 'cors',
                'redirect': 'follow',
                'credentials': 'include'
            })).text()
        } else {
            let data: any = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: url,
                    headers: Object.assign({
                        'Accept': 'application/json, text/plain, */*',
                        'Content-Type': 'application/json'
                    }, headers),
                    data: body,
                    onload: function (response: any) {
                        resolve(response)
                    },
                    onerror: function (error: any) {
                        reject(error)
                    }
                })
            })
            return data.responseText
        }
    }
    /**
      * 检查字符串中是否包含下载链接特征
      * @param {string} comment - 待检查的字符串
      * @returns {boolean} - 如果字符串中包含下载链接特征则返回 true，否则返回 false
      */
    function checkIsHaveDownloadLink(comment: string): boolean {
        if (!config.checkDownloadLink) {
            return false
        }
        if (comment == null) {
            return false
        }
        const downloadLinkCharacteristics = [
            'pan\.baidu',
            'mega\.nz',
            'drive\.google\.com',
            'aliyundrive',
            'uploadgig',
            'katfile',
            'storex',
            'subyshare',
            'rapidgator',
            'filebe',
            'filespace',
            'mexa\.sh',
            'mexashare',
            'mx-sh\.net',
            'uploaded\.',
            'icerbox',
            'alfafile',
            'drv\.ms',
            'onedrive',
            'pixeldrain\.com',
            'gigafile\.nu'
        ]
        for (let index = 0; index < downloadLinkCharacteristics.length; index++) {
            if (comment.indexOf(downloadLinkCharacteristics[index]) != -1) {
                return true
            }
        }
        return false
    }

    String.prototype.isEmpty = function () {
        return this == null || this.trim().length == 0;
    };

    String.prototype.replaceVariable = function (replacements) {
        return Object.entries(replacements).reduce(
            (str, [key, value]) => str.split(`%#${key}#%`).join(String(value)),
            this as string
        );
    };

    String.prototype.replaceNowTime = function () {
        return this.replaceVariable({
            Y: new Date().getFullYear(),
            M: new Date().getMonth() + 1,
            D: new Date().getDate(),
            h: new Date().getHours(),
            m: new Date().getMinutes(),
            s: new Date().getSeconds()
        })
    }

    String.prototype.replaceUploadTime = function (time) {
        return this.replaceVariable({
            UploadYear: time.getFullYear(),
            UploadMonth: time.getMonth() + 1,
            UploadDate: time.getDate(),
            UploadHours: time.getHours(),
            UploadMinutes: time.getMinutes(),
            UploadSeconds: time.getSeconds()
        })
    }

    async function AnalyzeDownloadTask() {
        for (const key in videoList.items) {
            let videoInfo = await (new VideoInfo(videoList[key])).init(key)
            videoInfo.State && pustDownloadTask(videoInfo)
        }
        document.querySelectorAll('.selectButton').forEach((element) => {
            let button = element as HTMLInputElement
            button.checked && button.click()
        })
        videoList.clear()
    }

    async function pustDownloadTask(videoInfo: VideoInfo) {
        if (checkIsHaveDownloadLink(videoInfo.getComment())) {
            console.error(`${videoInfo.Name}[${videoInfo.ID}] 发现疑似高画质下载连接`)
            return
        }
        if (videoInfo.getDownloadQuality() != 'Source') {
            console.error(`${videoInfo.Name}[${videoInfo.ID}] 无法解析到原画下载连接`)
            return
        }
        switch (config.downloadType) {
            case DownloadType.Aria2:
                aria2Download(videoInfo)
                break;
            case DownloadType.IwaraDownloader:
                iwaraDownloaderDownload(videoInfo)
                break;
            default:
                othersDownload(videoInfo)
                break;
        }

    }


    function analyzeLocalPath(path: string): LocalPath {
        let matchPath = path.match(/^([a-zA-Z]:)?[\/\\]?([^\/\\]+[\/\\])*([^\/\\]+\.\w+)$/) || ''
        return {
            fullPath: matchPath[0],
            drive: matchPath[1] || '',
            directories: matchPath[2].split(/[\/\\]/),
            filename: matchPath[3],
            match: matchPath !== null
        }
    }
    function UUID() {
        let UUID = '';
        for (let index = 0; index < 8; index++) {
            UUID += (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
        }
        return UUID;
    }
    function aria2Download(videoInfo: VideoInfo) {
        (async function (id: string, author: string, name: string, uploadTime: Date, info: string, tag: Array<string>, downloadUrl: string) {
            let localPath = analyzeLocalPath(config.downloadPath.replaceNowTime().replaceUploadTime(uploadTime).replaceVariable(
                {
                    AUTHOR: author,
                    ID: id,
                    TITLE: name
                }
            ).trim())
            let json = JSON.stringify({
                'jsonrpc': '2.0',
                'method': 'aria2.addUri',
                'id': UUID(),
                'params': [
                    'token:' + config.aria2Token,
                    [downloadUrl],
                    Object.assign(
                        config.downloadProxy.isEmpty() ? {} : { 'all-proxy': config.downloadProxy },
                        config.downloadPath.isEmpty() ? {} : {
                            'out': localPath.filename,
                            'dir': localPath.fullPath.replace(localPath.filename,'')
                        },
                        {
                            'referer': 'https://ecchi.iwara.tv/',
                            'header': [
                                'Cookie:' + config.cookies.map((i) => `${i.name}:${i.value}`).join('; ')
                            ]
                        }
                    )
                ]
            })
            console.log(`${name} 已推送到Aria2 ${await post(config.aria2Path, json)}`)
        }(videoInfo.ID, videoInfo.Author, videoInfo.Name, videoInfo.UploadTime, videoInfo.getComment(), videoInfo.Tags, videoInfo.getDownloadUrl()));
    }
    function iwaraDownloaderDownload(videoInfo: VideoInfo) {
        (async function (ID: string, Author: string, Name: string, UploadTime: Date, Info: string, Tag: Array<string>, DownloadUrl: string) {
            let r = JSON.parse(await post(config.iwaraDownloaderPath, Object.assign({
                'ver': 1,
                'code': 'add',
                'data': Object.assign({
                    'Source': ID,
                    'author': Author,
                    'name': Name,
                    'downloadTime': new Date(),
                    'uploadTime': UploadTime,
                    'downloadUrl': DownloadUrl,
                    'downloadCookies': config.cookies,
                    'info': Info,
                    'tag': Tag
                },
                    config.downloadPath.isEmpty() ? {} : {
                        'path': config.downloadPath.replaceNowTime().replaceUploadTime(UploadTime).replaceVariable(
                            {
                                AUTHOR: Author,
                                ID: ID,
                                TITLE: Name
                            }
                        )
                    }
                )
            },
                config.iwaraDownloaderToken.isEmpty() ? {} : { 'token': config.iwaraDownloaderToken }
            )))

            if (r.code == 0) {
                console.log("已推送" + ID)
            } else {
                console.log("推送失败" + ID)
            }
        }(videoInfo.ID, videoInfo.Author, videoInfo.Name, videoInfo.UploadTime, videoInfo.getComment(), videoInfo.Tags, videoInfo.getDownloadUrl()))
    }
    function othersDownload(videoInfo: VideoInfo) {
        (async function (ID: string, Author: string, Name: string, UploadTime: Date, Info: string, Tag: Array<string>, DownloadUrl: string) {
            GM_openInTab(DownloadUrl, { active: true, insert: true, setParent: true })
        }(videoInfo.ID, videoInfo.Author, videoInfo.Name, videoInfo.UploadTime, videoInfo.getComment(), videoInfo.Tags, videoInfo.getDownloadUrl()))
    }

    let style = renderNode({
        nodeType: "style",
        childs: `
        #pluginMenu {
            z-index: 4096;
            position: fixed;
            top: 50%;
            right: 0px;
            padding: 10px;
            background-color: #565656;
            border: 1px solid #ccc;
            border-radius: 5px;
            box-shadow: 0 0 10px #ccc;
            transform: translate(85%, -50%);
            transition: transform 0.5s cubic-bezier(0.68, -0.24, 0.265, 1.20);
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
    
        /* 以下为兼容性处理 */
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
			position: fixed;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			background-color: rgba(128, 128, 128, 0.8);
			z-index: 8192; 
			display: flex;
            flex-direction: column;
			align-items: center;
			justify-content: center;
		}
		#pluginConfig .main {
            color: white;
            background-color: rgb(64,64,64,0.7);
            padding: 24px;
            margin: 10px;
            overflow-y: auto;
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
        #pluginConfig p {
			display: flex;
            flex-direction: column;
		}
        #pluginConfig p label{
			display: flex;
		}
        #pluginConfig p label input{
			flex-grow: 1;
            margin-left: 10px;
		}
        #pluginConfig .inputRadioLine {
			display: flex;
			align-items: center;
            flex-direction: row;
            margin-right: 10px;
		}
        #pluginConfig .inputRadio {
			display: flex;
            align-items: center;
            flex-direction: row-reverse;
            margin-right: 10px;
		}

        #pluginOverlay {
			position: fixed;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			background-color: rgba(128, 128, 128, 0.8);
			z-index: 8192; 
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

		#pluginOverlay .checkbox-container {
			display: flex;
			align-items: center;
		}

		#pluginOverlay .checkbox-label {
			color: white;
			font-size: 18px;
			margin-left: 10px;
		}

        .selectButton {
            position: absolute;
            width: 32px;
            height: 32px;
            bottom: 24px;
            right: 0px;
        }
        `
    })

    let config = new Config()
    // 检查是否是首次运行脚本
    if (GM_getValue('isFirstRun', true)) {
        GM_listValues().forEach(i => GM_deleteValue(i))
        config = new Config()
        let confirmButton = renderNode({
            nodeType: 'button',
            attributes: {
                disabled: true
            },
            childs: '确定',
            events: {
                click: () => {
                    GM_setValue('isFirstRun', false)
                    document.querySelector('#pluginOverlay').remove()
                    window.unsafeWindow.location.reload()
                }
            }
        }) as HTMLButtonElement
        document.body.appendChild(renderNode({
            nodeType: 'div',
            attributes: {
                id: 'pluginOverlay'
            },
            childs: [
                {
                    nodeType: 'div',
                    className: 'main',
                    childs: [
                        {
                            nodeType: 'h2',
                            childs: [
                                '下载私有(上锁)视频请使用',
                                { nodeType: 'br' },
                                {
                                    nodeType: 'a',
                                    attributes: {
                                        href: 'https://docs.scriptcat.org/'
                                    },
                                    childs: 'ScriptCat'
                                },
                                ' 或 ',
                                {
                                    nodeType: 'a',
                                    attributes: {
                                        href: 'https://www.tampermonkey.net/index.php?#download_gcal'
                                    },
                                    childs: 'Tampermonkey Beta'
                                },
                                '载入本脚本。'
                            ]
                        },
                        { nodeType: 'p', childs: '全局可用变量：%#Y#% (当前时间[年]) | %#M#% (当前时间[月]) | %#D#% (当前时间[日]) | %#h#% (当前时间[时]) | %#m#% (当前时间[分]) | %#s#% (当前时间[秒])' },
                        { nodeType: 'p', childs: '路径可用变量：%#TITLE#% (标题) | %#ID#% (ID) | %#AUTHOR#% (作者) | %#UploadYear#% (发布时间[年]) | %#UploadMonth#% (发布时间[月]) | %#UploadDate#% (发布时间[日]) | %#UploadHours#% (发布时间[时]) | %#UploadMinutes#% (发布时间[分]) | %#UploadSeconds#% (发布时间[秒])' },
                        { nodeType: 'p', childs: '例: %#Y#%-%#M#%-%#D#%_%#TITLE#%[%#ID#%].MP4' },
                        { nodeType: 'p', childs: '结果: ' + '%#Y#%-%#M#%-%#D#%_%#TITLE#%[%#ID#%].MP4'.replaceNowTime().replace('%#TITLE#%', '演示标题').replace('%#ID#%', '演示ID'), },
                        { nodeType: 'p', childs: '点击侧边栏中“开关选择”开启下载复选框' },
                        { nodeType: 'p', childs: '[尚未在新版实现]在作者用户页面可以点击下载全部，将会搜索该用户的所有视频进行下载。' },
                        { nodeType: 'p', childs: '[尚未在新版实现]插件下载视频前会检查视频简介，如果在简介中发现疑似第三方下载链接，将会弹窗提示，您可以手动打开视频页面选择。' },
                        { nodeType: 'p', childs: '[尚未在新版实现]手动下载需要您提供视频ID!' }
                    ]
                },
                {
                    nodeType: 'div',
                    className: 'checkbox-container',
                    childs: [
                        {
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
                        },
                        {
                            nodeType: 'label',
                            className: 'checkbox-label',
                            attributes: {
                                for: 'agree-checkbox'
                            },
                            childs: '我已知晓如何使用',
                        },
                    ],
                },
                confirmButton
            ]
        }))
    }


    let videoList = new Dictionary<string>();

    let UI = renderNode({
        nodeType: "div",
        attributes: {
            id: "pluginMenu"
        },
        childs: {
            nodeType: "ul",
            childs: [
                {
                    nodeType: "li",
                    childs: "开关选择",
                    events: {
                        click: () => {
                            if (!document.querySelector('.selectButton')) {
                                document.querySelectorAll('.page-videoList__item * .videoTeaser__thumbnail').forEach((element) => {
                                    element.appendChild(renderNode({
                                        nodeType: "input",
                                        attributes: Object.assign(
                                            videoList.has(element.getAttribute('href').trim().split('/')[2]) ? { checked: true } : {}, {
                                            type: "checkbox"
                                        }),
                                        className: 'selectButton',
                                        events: {
                                            input: (event: Event) => {
                                                event.stopPropagation()
                                                return false;
                                            },
                                            click: (event: Event) => {
                                                let target = event.target as HTMLInputElement
                                                let id = target.parentElement.getAttribute('href').trim().split('/')[2]
                                                let name = target.parentElement.parentElement.querySelector('.videoTeaser__title').getAttribute('title')
                                                target.checked ? videoList.set(id, name) : videoList.remove(id)
                                                event.stopPropagation()
                                                return false;
                                            }
                                        }
                                    }))
                                })
                            } else {
                                document.querySelectorAll('.selectButton').forEach((element) => {
                                    videoList.remove(element.parentElement.getAttribute('href').trim().split('/')[2])
                                    element.remove()
                                })
                            }
                        }
                    }
                },
                {
                    nodeType: "li",
                    childs: "下载所选",
                    events: {
                        click: (event: Event) => {
                            AnalyzeDownloadTask()
                            event.stopPropagation()
                            return false;
                        }
                    }
                },
                {
                    nodeType: "li",
                    childs: "全部选中",
                    events: {
                        click: (event: Event) => {
                            document.querySelectorAll('.selectButton').forEach((element) => {
                                let button = element as HTMLInputElement
                                !button.checked && button.click()
                            })
                            event.stopPropagation()
                            return false;
                        }
                    }
                },
                {
                    nodeType: "li",
                    childs: "取消全选",
                    events: {
                        click: (event: Event) => {
                            document.querySelectorAll('.selectButton').forEach((element) => {
                                let button = element as HTMLInputElement
                                button.checked && button.click()
                            })
                            event.stopPropagation()
                            return false;
                        }
                    }
                },
                {
                    nodeType: "li",
                    childs: "反向选中",
                    events: {
                        click: (event: Event) => {
                            document.querySelectorAll('.selectButton').forEach((element) => {
                                (element as HTMLInputElement).click()
                            })
                            event.stopPropagation()
                            return false;
                        }
                    }
                },
                {
                    nodeType: "li",
                    childs: "打开设置",
                    events: {
                        click: (event: Event) => {
                            config.edit()
                            event.stopPropagation()
                            return false;
                        }
                    }
                }
            ]
        }
    })

    document.head.appendChild(style)
    document.body.appendChild(UI)


































    /*
        class pluginTips {
            WaitingQueue: Queue<DownloadTask>
            DownloadingQueue: Queue<DownloadTask>
            static Title: RenderCode = { nodeType: 'h2', childs: 'Iwara批量下载工具' }
            static typeIcon: object = {
                Info: '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>',
                Warning: '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>',
                Success: '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>',
                Progress: '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>'
            }
            static Container: Element = renderNode({
                nodeType: 'section',
                attributes: {
                    id: 'PluginTips'
                },
                className: 'tipsContainer'
            }) as Element
            constructor() {
                this.DownloadingQueue = new Queue()
                this.WaitingQueue = new Queue()
                document.body.appendChild(pluginTips.Container);
            }
            downloadComplete(id: string) {
                this.DownloadingQueue.remove(id)
                pluginTips.Container.children.namedItem(id).remove()
                if (this.WaitingQueue.size() > 0) {
                    let downloadTask = this.WaitingQueue.dequeue()
                    if (GM_info.downloadMode == 'native') {
                        this.progress({
                            title: {
                                nodeType: 'h2',
                                childs: `${downloadTask.data.name} 下载中...`
                            },
                            id: downloadTask.id
                        })
                    } else {
                        this.info({
                            content: {
                                nodeType: 'p',
                                childs: `${downloadTask.data.name} 已开始下载!`
                            }
                        })
                    }
                    this.DownloadingQueue.enqueue(downloadTask.id,downloadTask.data)
                    GM_download(downloadTask.data)
                }
            }
            downloading(id: string, value: number) {
                let downloadTask = pluginTips.Container.children.namedItem(id).querySelector('.value') as HTMLElement
                downloadTask.setAttribute('value', value.toFixed(2))
                downloadTask.style.width = value.toFixed(2) + '%'
            }
            info(params: LogCode) {
                let code = params
                new tips(TipsType.Info, code.content, code.title, code.id, code.wait)
                console.info(code)
            }
            warning(params: LogCode) {
                let code = params
                new tips(TipsType.Warning, code.content, code.title, code.id, code.wait)
                console.warn(code)
            }
            success(params: LogCode) {
                let code = params
                new tips(TipsType.Success, code.content, code.title, code.id, code.wait)
                console.log(code)
            }
            progress(params: LogCode) {
                if (pluginTips.Container.children.namedItem(params.id as string) != null) {
                    this.warning({
                        content: {
                            nodeType: 'p',
                            childs: [
                                params.content,
                                '任务已存在。'
                            ]
                        }
                    })
                    return
                }
                new tips(TipsType.Progress, params.title, {
                    nodeType: 'div',
                    className: 'Progress',
                    childs: [{
                        nodeType: 'div',
                        className: 'value',
                        attributes: {
                            value: 0
                        }
                    }]
                }, params.id, true)
            }
            dialog(params: LogCode,) {
                let s  = {
                    childs: "取消下载",
                    events:{
                        click : () => {
                            pluginTips.Container.children.namedItem(params.id).remove()
                        }
                    }
                };
                params.content =
                {
                    nodeType: "div",
                    childs: [
                        params.content, {
                            nodeType: "button",
                            className: "btn-primary tipsButton"
                            
                        }, {
                            nodeType: "button",
                            className: "btn-primary tipsButton",
                            childs: "重新下载",
                            attributes: {
                                id: true
                            },
                            events:{
                                click : () => {
                                    //ParseDownloadAddress(params.id, false)
                                    pluginTips.Container.children.namedItem(params.id).remove()
                                }
                            }
                        }
                    ]
                }
                new tips(TipsType.Dialog, params.content, params.title, params.id, true, TipsType.Warning)
            }
        }
        class tips {
            id: String;
            type: TipsType
            show: TipsType
            wait: boolean
            constructor(type: TipsType, content: RenderCode, title: RenderCode, id: String = null, wait: boolean = false, show: TipsType = null) {
                this.type = type
                this.show = show ??= type
                this.wait = wait
                switch (this.type) {
                    case TipsType.Progress:
                        //todo 取消任务
                        break;
                    case TipsType.Dialog:
                        //todo 确认框
                        break;
                    default:
                        break;
                }
                renderNode(Object.assign({
                    nodeType: 'div',
                    childs: [{
                        nodeType: 'div',
                        className: 'tipsIcon',
                        childs: getRenderCode(pluginTips.typeIcon[TipsType[show]])
                    }, {
                        nodeType: 'div',
                        className: 'tipsContent',
                        childs: [title ?? pluginTips.Title].concat(content)
                    }],
                    parent: pluginTips.Container
                }, this.style(), this.event(), id != null ? {
                    attributes: {
                        id: id
                    }
                } : {}))
            }
            event() {
                return {
                    onclick: (e: any) => {
                        switch (this.type) {
                            case TipsType.Info:
                            case TipsType.Success:
                            case TipsType.Warning:
                                e.currentTarget.remove()
                                break;
                            case TipsType.Dialog:
                            default:
                                break;
                        }
                    },
                    onanimationend: (e: any) => {
                        if (!this.wait) {
                            e.currentTarget.remove()
                        }
                    }
                }
            }
            style() {
                let style = {
                    className: ['tips']
                }
                style.className.push('tips' + TipsType[this.show])
                style.className.push(this.wait ? 'tipsWait' : 'tipsActive')
                return style
            }
        }
    
    
    
        
        let sttt = {
            nodeType: "div",
            attributes: {
                style: "position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);",
            },
            className: "float-window",
            childs: {
                nodeType: "div",
                attributes: {
                    style: "background-color: #fff; padding: 10px;"
                },
                className: "float-content",
                childs: [
                    {
                        nodeType: "p",
                        childs: "This is a floating window!"
                    },
                    {
                        nodeType: "button",
                        events: {
                            click: () =>{}
                        },
                        childs: "Close"
                    }
                ]
            }
        }
    
        /*
        class Plugin {
            config: Config
            
            constructor(){
               
                this.config = new Config()
            }
        }
    
    
        let  test : RenderCode =  {
            nodeType: "input",
            attributes: {
                type: "checkbox"
            },
            className: 'selectButton',
            events: {
                click : (event: Event) => {
                    (event.target as HTMLElement).parentElement.querySelector('a.videoTeaser__title').getAttribute('href').trim().split('/')[2]
                }
            }
        }
    */
})()
