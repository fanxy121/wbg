; (async function () {

  const yawf = window.yawf;

  const feedParser = yawf.feed;
  const request = yawf.request;
  const message = yawf.message;

  const downloader = yawf.downloader = {};

  const getSetting = function () {
    const setting = yawf.rules.feedDownload;
    const content = setting.content;
    return {
      content: {
        html: content.downloadAsHtml.getConfig(),
        text: content.downloadAsText.getConfig(),
        image: content.downloadImage.getConfig(),
        video: content.downloadVideo.getConfig(),
      },
      path: './wbg/$year$month/$author/',
    };
  };

  /**
   * @template T, S
   * @param {T} base
   * @param {...S} settings
   * @return {T & S}
   */
  const mergeSetting = function (base, ...settings) {
    if (!settings.length) return base;
    const [ref, ...rem] = settings;
    return mergeSetting((function merge(base, ref) {
      Object.keys(ref).forEach(key => {
        if (typeof ref[key] === 'undefined') return;
        if (base[key] && ref[key] && typeof ref[key] === 'object') {
          if (typeof base[key] !== 'object') base[key] = {};
          merge(base[key], ref[key]);
        } else {
          base[key] = ref[key];
        }
      });
      return base;
    }(base, ref)), ...rem);
  };

  class FileDownloader {
    constructor(basePath = '/', useCache = false, timeout = 300e3) {
      /** @type {Map<string, Set<string>>} */
      this.cache = useCache ? new Map() : null;
      this.basePath = new URL(basePath.replace(/\/?$/, '/'), 'file:///');
      this.timeout = timeout;
    }
    setPathParamResolver(resolver) {
      /** @type {FilePathParamResolver} */
      this.pathParamResolver = resolver;
    }
    getDefaultFilename() {
      this.defaultIndex = (this.defaultIndex || 0) + 1;
      return '_' + this.defaultIndex;
    }
    normalizeFilename(filename) {
      const valid = (filename + '')
        .match(/./ug).map(character => character.replace(FileDownloader.regOtherCharacters, '_')).join('')
        .replace(FileDownloader.regFilenameUnhappyCharacters, '_') ||
        this.getDefaultFilename();
      if (valid === filename) return filename;
      return this.normalizeFilename(valid);
    }
    computeFilePath(dest) {
      const path = new URL(dest, this.basePath).pathname.slice(1);
      const paramPath = path.replace(/\$(?=\(?(\w+))(?:\(\w+\)|\w+)/g, (_, param) => {
        return this.pathParamResolver.resolve(param);
      }).replace(/\$\$/g, () => '$');
      return this.normalizeFilename(paramPath);
    }
    async downloadFile({ url, filename }) {
      await Promise.race([
        message.invoke.downloadFile({ url, filename }),
        new Promise((resolve, reject) => {
          setTimeout(() => reject(Error('Timeout')), this.timeout);
        }),
      ]);
    }
    async downloadFromUrl(url, dest) {
      const source = new URL(url).href;
      if (this.cache) {
        if (!this.cache.has(source)) {
          this.cache.set(source, new Set());
        }
      }
      const sourceCache = this.cache && this.cache.get(source);
      const filename = this.computeFilePath(dest);
      if (sourceCache && sourceCache.has(filename)) {
        return filename;
      }
      await this.downloadFile({ url: source, filename });
      if (sourceCache) {
        sourceCache.add(filename);
      }
      return filename;
    }
    /**
     * @param {Blob} blob
     * @param {string} dest
     */
    async downloadFromBlob(blob, dest) {
      const filename = this.computeFilePath(dest);
      return new Promise((resolve, reject) => {
        const fileReader = new FileReader();
        fileReader.addEventListener('load', async () => {
          try {
            const url = fileReader.result;
            await this.downloadFile({ url, filename });
            resolve(filename);
          } catch (e) {
            reject(e);
          }
        });
        fileReader.readAsDataURL(blob);
      });
    }
    static getFilename(url) {
      return decodeURIComponent(new URL(url).pathname.split('/').pop());
    }
  }
  FileDownloader.regOtherCharacters = /^(?:\uD834[\uDCF6-\uDCFF\uDD27\uDD28\uDD73-\uDD7A\uDDE9-\uDDFF\uDE46-\uDEFF\uDF57-\uDF5F\uDF72-\uDFFF]|\uD836[\uDE8C-\uDE9A\uDEA0\uDEB0-\uDFFF]|\uD83C[\uDC2C-\uDC2F\uDC94-\uDC9F\uDCAF\uDCB0\uDCC0\uDCD0\uDCF6-\uDCFF\uDD0D-\uDD0F\uDD2F\uDD6C-\uDD6F\uDD9B-\uDDE5\uDE03-\uDE0F\uDE3B-\uDE3F\uDE49-\uDE4F\uDE52-\uDEFF]|\uD81A[\uDE39-\uDE3F\uDE5F\uDE6A-\uDE6D\uDE70-\uDECF\uDEEE\uDEEF\uDEF6-\uDEFF\uDF46-\uDF4F\uDF5A\uDF62\uDF78-\uDF7C\uDF90-\uDFFF]|\uD809[\uDC6F\uDC75-\uDC7F\uDD44-\uDFFF]|\uD81B[\uDC00-\uDEFF\uDF45-\uDF4F\uDF7F-\uDF8E\uDFA0-\uDFFF]|\uD86E[\uDC1E\uDC1F]|\uD83D[\uDD7A\uDDA4\uDED1-\uDEDF\uDEED-\uDEEF\uDEF4-\uDEFF\uDF74-\uDF7F\uDFD5-\uDFFF]|\uD801[\uDC9E\uDC9F\uDCAA-\uDCFF\uDD28-\uDD2F\uDD64-\uDD6E\uDD70-\uDDFF\uDF37-\uDF3F\uDF56-\uDF5F\uDF68-\uDFFF]|\uD800[\uDC0C\uDC27\uDC3B\uDC3E\uDC4E\uDC4F\uDC5E-\uDC7F\uDCFB-\uDCFF\uDD03-\uDD06\uDD34-\uDD36\uDD8D-\uDD8F\uDD9C-\uDD9F\uDDA1-\uDDCF\uDDFE-\uDE7F\uDE9D-\uDE9F\uDED1-\uDEDF\uDEFC-\uDEFF\uDF24-\uDF2F\uDF4B-\uDF4F\uDF7B-\uDF7F\uDF9E\uDFC4-\uDFC7\uDFD6-\uDFFF]|\uD869[\uDED7-\uDEFF]|\uD83B[\uDC00-\uDDFF\uDE04\uDE20\uDE23\uDE25\uDE26\uDE28\uDE33\uDE38\uDE3A\uDE3C-\uDE41\uDE43-\uDE46\uDE48\uDE4A\uDE4C\uDE50\uDE53\uDE55\uDE56\uDE58\uDE5A\uDE5C\uDE5E\uDE60\uDE63\uDE65\uDE66\uDE6B\uDE73\uDE78\uDE7D\uDE7F\uDE8A\uDE9C-\uDEA0\uDEA4\uDEAA\uDEBC-\uDEEF\uDEF2-\uDFFF]|\uD87E[\uDE1E-\uDFFF]|\uDB40[\uDC00-\uDCFF\uDDF0-\uDFFF]|\uD804[\uDC4E-\uDC51\uDC70-\uDC7E\uDCBD\uDCC2-\uDCCF\uDCE9-\uDCEF\uDCFA-\uDCFF\uDD35\uDD44-\uDD4F\uDD77-\uDD7F\uDDCE\uDDCF\uDDE0\uDDF5-\uDDFF\uDE12\uDE3E-\uDE7F\uDE87\uDE89\uDE8E\uDE9E\uDEAA-\uDEAF\uDEEB-\uDEEF\uDEFA-\uDEFF\uDF04\uDF0D\uDF0E\uDF11\uDF12\uDF29\uDF31\uDF34\uDF3A\uDF3B\uDF45\uDF46\uDF49\uDF4A\uDF4E\uDF4F\uDF51-\uDF56\uDF58-\uDF5C\uDF64\uDF65\uDF6D-\uDF6F\uDF75-\uDFFF]|\uD83A[\uDCC5\uDCC6\uDCD7-\uDFFF]|\uD80D[\uDC2F-\uDFFF]|\uD86D[\uDF35-\uDF3F]|[\uD807\uD80A\uD80B\uD80E-\uD810\uD812-\uD819\uD81C-\uD82B\uD82D\uD82E\uD830-\uD833\uD837-\uD839\uD83F\uD874-\uD87D\uD87F-\uDB3F\uDB41-\uDBFF][\uDC00-\uDFFF]|\uD806[\uDC00-\uDC9F\uDCF3-\uDCFE\uDD00-\uDEBF\uDEF9-\uDFFF]|\uD803[\uDC49-\uDC7F\uDCB3-\uDCBF\uDCF3-\uDCF9\uDD00-\uDE5F\uDE7F-\uDFFF]|\uD835[\uDC55\uDC9D\uDCA0\uDCA1\uDCA3\uDCA4\uDCA7\uDCA8\uDCAD\uDCBA\uDCBC\uDCC4\uDD06\uDD0B\uDD0C\uDD15\uDD1D\uDD3A\uDD3F\uDD45\uDD47-\uDD49\uDD51\uDEA6\uDEA7\uDFCC\uDFCD]|\uD805[\uDC00-\uDC7F\uDCC8-\uDCCF\uDCDA-\uDD7F\uDDB6\uDDB7\uDDDE-\uDDFF\uDE45-\uDE4F\uDE5A-\uDE7F\uDEB8-\uDEBF\uDECA-\uDEFF\uDF1A-\uDF1C\uDF2C-\uDF2F\uDF40-\uDFFF]|\uD802[\uDC06\uDC07\uDC09\uDC36\uDC39-\uDC3B\uDC3D\uDC3E\uDC56\uDC9F-\uDCA6\uDCB0-\uDCDF\uDCF3\uDCF6-\uDCFA\uDD1C-\uDD1E\uDD3A-\uDD3E\uDD40-\uDD7F\uDDB8-\uDDBB\uDDD0\uDDD1\uDE04\uDE07-\uDE0B\uDE14\uDE18\uDE34-\uDE37\uDE3B-\uDE3E\uDE48-\uDE4F\uDE59-\uDE5F\uDEA0-\uDEBF\uDEE7-\uDEEA\uDEF7-\uDEFF\uDF36-\uDF38\uDF56\uDF57\uDF73-\uDF77\uDF92-\uDF98\uDF9D-\uDFA8\uDFB0-\uDFFF]|\uD808[\uDF9A-\uDFFF]|\uD82F[\uDC6B-\uDC6F\uDC7D-\uDC7F\uDC89-\uDC8F\uDC9A\uDC9B\uDCA0-\uDFFF]|\uD82C[\uDC02-\uDFFF]|\uD811[\uDE47-\uDFFF]|\uD83E[\uDC0C-\uDC0F\uDC48-\uDC4F\uDC5A-\uDC5F\uDC88-\uDC8F\uDCAE-\uDD0F\uDD19-\uDD7F\uDD85-\uDDBF\uDDC1-\uDFFF]|\uD873[\uDEA2-\uDFFF]|[\0-\x1F\x7F-\x9F\xAD\u0378\u0379\u0380-\u0383\u038B\u038D\u03A2\u0530\u0557\u0558\u0560\u0588\u058B\u058C\u0590\u05C8-\u05CF\u05EB-\u05EF\u05F5-\u0605\u061C\u061D\u06DD\u070E\u070F\u074B\u074C\u07B2-\u07BF\u07FB-\u07FF\u082E\u082F\u083F\u085C\u085D\u085F-\u089F\u08B5-\u08E2\u0984\u098D\u098E\u0991\u0992\u09A9\u09B1\u09B3-\u09B5\u09BA\u09BB\u09C5\u09C6\u09C9\u09CA\u09CF-\u09D6\u09D8-\u09DB\u09DE\u09E4\u09E5\u09FC-\u0A00\u0A04\u0A0B-\u0A0E\u0A11\u0A12\u0A29\u0A31\u0A34\u0A37\u0A3A\u0A3B\u0A3D\u0A43-\u0A46\u0A49\u0A4A\u0A4E-\u0A50\u0A52-\u0A58\u0A5D\u0A5F-\u0A65\u0A76-\u0A80\u0A84\u0A8E\u0A92\u0AA9\u0AB1\u0AB4\u0ABA\u0ABB\u0AC6\u0ACA\u0ACE\u0ACF\u0AD1-\u0ADF\u0AE4\u0AE5\u0AF2-\u0AF8\u0AFA-\u0B00\u0B04\u0B0D\u0B0E\u0B11\u0B12\u0B29\u0B31\u0B34\u0B3A\u0B3B\u0B45\u0B46\u0B49\u0B4A\u0B4E-\u0B55\u0B58-\u0B5B\u0B5E\u0B64\u0B65\u0B78-\u0B81\u0B84\u0B8B-\u0B8D\u0B91\u0B96-\u0B98\u0B9B\u0B9D\u0BA0-\u0BA2\u0BA5-\u0BA7\u0BAB-\u0BAD\u0BBA-\u0BBD\u0BC3-\u0BC5\u0BC9\u0BCE\u0BCF\u0BD1-\u0BD6\u0BD8-\u0BE5\u0BFB-\u0BFF\u0C04\u0C0D\u0C11\u0C29\u0C3A-\u0C3C\u0C45\u0C49\u0C4E-\u0C54\u0C57\u0C5B-\u0C5F\u0C64\u0C65\u0C70-\u0C77\u0C80\u0C84\u0C8D\u0C91\u0CA9\u0CB4\u0CBA\u0CBB\u0CC5\u0CC9\u0CCE-\u0CD4\u0CD7-\u0CDD\u0CDF\u0CE4\u0CE5\u0CF0\u0CF3-\u0D00\u0D04\u0D0D\u0D11\u0D3B\u0D3C\u0D45\u0D49\u0D4F-\u0D56\u0D58-\u0D5E\u0D64\u0D65\u0D76-\u0D78\u0D80\u0D81\u0D84\u0D97-\u0D99\u0DB2\u0DBC\u0DBE\u0DBF\u0DC7-\u0DC9\u0DCB-\u0DCE\u0DD5\u0DD7\u0DE0-\u0DE5\u0DF0\u0DF1\u0DF5-\u0E00\u0E3B-\u0E3E\u0E5C-\u0E80\u0E83\u0E85\u0E86\u0E89\u0E8B\u0E8C\u0E8E-\u0E93\u0E98\u0EA0\u0EA4\u0EA6\u0EA8\u0EA9\u0EAC\u0EBA\u0EBE\u0EBF\u0EC5\u0EC7\u0ECE\u0ECF\u0EDA\u0EDB\u0EE0-\u0EFF\u0F48\u0F6D-\u0F70\u0F98\u0FBD\u0FCD\u0FDB-\u0FFF\u10C6\u10C8-\u10CC\u10CE\u10CF\u1249\u124E\u124F\u1257\u1259\u125E\u125F\u1289\u128E\u128F\u12B1\u12B6\u12B7\u12BF\u12C1\u12C6\u12C7\u12D7\u1311\u1316\u1317\u135B\u135C\u137D-\u137F\u139A-\u139F\u13F6\u13F7\u13FE\u13FF\u169D-\u169F\u16F9-\u16FF\u170D\u1715-\u171F\u1737-\u173F\u1754-\u175F\u176D\u1771\u1774-\u177F\u17DE\u17DF\u17EA-\u17EF\u17FA-\u17FF\u180E\u180F\u181A-\u181F\u1878-\u187F\u18AB-\u18AF\u18F6-\u18FF\u191F\u192C-\u192F\u193C-\u193F\u1941-\u1943\u196E\u196F\u1975-\u197F\u19AC-\u19AF\u19CA-\u19CF\u19DB-\u19DD\u1A1C\u1A1D\u1A5F\u1A7D\u1A7E\u1A8A-\u1A8F\u1A9A-\u1A9F\u1AAE\u1AAF\u1ABF-\u1AFF\u1B4C-\u1B4F\u1B7D-\u1B7F\u1BF4-\u1BFB\u1C38-\u1C3A\u1C4A-\u1C4C\u1C80-\u1CBF\u1CC8-\u1CCF\u1CF7\u1CFA-\u1CFF\u1DF6-\u1DFB\u1F16\u1F17\u1F1E\u1F1F\u1F46\u1F47\u1F4E\u1F4F\u1F58\u1F5A\u1F5C\u1F5E\u1F7E\u1F7F\u1FB5\u1FC5\u1FD4\u1FD5\u1FDC\u1FF0\u1FF1\u1FF5\u1FFF\u200B-\u200F\u202A-\u202E\u2060-\u206F\u2072\u2073\u208F\u209D-\u209F\u20BF-\u20CF\u20F1-\u20FF\u218C-\u218F\u23FB-\u23FF\u2427-\u243F\u244B-\u245F\u2B74\u2B75\u2B96\u2B97\u2BBA-\u2BBC\u2BC9\u2BD2-\u2BEB\u2BF0-\u2BFF\u2C2F\u2C5F\u2CF4-\u2CF8\u2D26\u2D28-\u2D2C\u2D2E\u2D2F\u2D68-\u2D6E\u2D71-\u2D7E\u2D97-\u2D9F\u2DA7\u2DAF\u2DB7\u2DBF\u2DC7\u2DCF\u2DD7\u2DDF\u2E43-\u2E7F\u2E9A\u2EF4-\u2EFF\u2FD6-\u2FEF\u2FFC-\u2FFF\u3040\u3097\u3098\u3100-\u3104\u312E-\u3130\u318F\u31BB-\u31BF\u31E4-\u31EF\u321F\u32FF\u4DB6-\u4DBF\u9FD6-\u9FFF\uA48D-\uA48F\uA4C7-\uA4CF\uA62C-\uA63F\uA6F8-\uA6FF\uA7AE\uA7AF\uA7B8-\uA7F6\uA82C-\uA82F\uA83A-\uA83F\uA878-\uA87F\uA8C5-\uA8CD\uA8DA-\uA8DF\uA8FE\uA8FF\uA954-\uA95E\uA97D-\uA97F\uA9CE\uA9DA-\uA9DD\uA9FF\uAA37-\uAA3F\uAA4E\uAA4F\uAA5A\uAA5B\uAAC3-\uAADA\uAAF7-\uAB00\uAB07\uAB08\uAB0F\uAB10\uAB17-\uAB1F\uAB27\uAB2F\uAB66-\uAB6F\uABEE\uABEF\uABFA-\uABFF\uD7A4-\uD7AF\uD7C7-\uD7CA\uD7FC-\uF8FF\uFA6E\uFA6F\uFADA-\uFAFF\uFB07-\uFB12\uFB18-\uFB1C\uFB37\uFB3D\uFB3F\uFB42\uFB45\uFBC2-\uFBD2\uFD40-\uFD4F\uFD90\uFD91\uFDC8-\uFDEF\uFDFE\uFDFF\uFE1A-\uFE1F\uFE53\uFE67\uFE6C-\uFE6F\uFE75\uFEFD-\uFF00\uFFBF-\uFFC1\uFFC8\uFFC9\uFFD0\uFFD1\uFFD8\uFFD9\uFFDD-\uFFDF\uFFE7\uFFEF-\uFFFB\uFFFE\uFFFF])$/g; // eslint-disable-line
  FileDownloader.regFilenameUnhappyCharacters = /[<>:"\\|?*;#]$/g;

  /** @typedef {'mid'|'author'|'year'|'month'} ParamType */
  class FilePathParamResolver {
    constructor(feed) {
      /** @type {Document} */
      this.feed = feed;
      /** @type {Map<ParamType, string>} */
      this.cache = new Map();
    }
    /** @param {ParamType} type */
    resolve(type) {
      if (this.cache.has(type)) return this.cache.get(type);
      const result = this.resolveType(type);
      this.cache.set(type, result);
      return result;
    }
    /** @param {ParamType} type */
    resolveType(type) {
      if (type === 'mid') return this.getMid();
      if (type === 'author') return this.getAuthor();
      if (type === 'year') return this.getYear();
      if (type === 'month') return this.getMonth();
      return '';
    }
    getMid() {
      return this.feed.getAttribute('mid');
    }
    getAuthor() {
      const [author] = feedParser.author.id(this.feed);
      return author;
    }
    getYear() {
      const [date] = feedParser.date.date(this.feed, true);
      // 总是获取东八区的日期而不是使用客户端时间
      return String(new Date(Number(date) + 28800e3).getUTCFullYear());
    }
    getMonth() {
      const [date] = feedParser.date.date(this.feed, true);
      return String(new Date(Number(date) + 28800e3).getUTCMonth() + 1).padStart(2, 0);
    }
  }

  class FeedDownloader {
    constructor(custom = {}) {
      const config = this.config = mergeSetting(getSetting(), custom);
      this.fileDownloader = new FileDownloader(config.path);
    }
    async download(author, mid) {
      const config = this.config;
      /** @type {{ raw: ArrayBuffer, page: Document }} */
      const feed = await request.getFeed(author, mid);
      this.fileDownloader.setPathParamResolver(new FilePathParamResolver(feed));
      const content = config.content, empty = Promise.resolve(true);
      const successList = await Promise.all([
        content.text ? this.downloadAsText(feed) : empty,
        content.html ? this.downloadAsHtml(feed) : empty,
        content.image ? this.downloadImage(feed) : empty,
        content.video ? this.downloadVideo(feed) : empty,
      ]);
      return successList.every(success => success);
    }

    /** @param {HTMLElement} feed */
    async downloadAsText(feed) {
      const text = feedParser.text.detail(feed);
      const content = '\ufeff' + text.replace(/\r|\n|\r\n|(\u2028)/g, '\r\n$1');
      const blob = new Blob([content], { type: 'application/octet-stream' });
      const success = await this.fileDownloader.downloadFromBlob(blob, './$mid.txt');
      return success;
    }

    /** @param {HTMLElement} feed */
    async downloadAsHtml(feed) {
      const content = feed.outerHTML;
      const blob = new Blob([content], { type: 'application/octet-stream' });
      const success = await this.fileDownloader.downloadFromBlob(blob, './$mid.html');
      return success;
    }

    /** @param {HTMLElement} feed */
    async downloadImage(feed) {
      const imgs = Array.from(feed.querySelectorAll('.WB_media_wrap .WB_pic img'));
      if (!imgs) return true;
      const successList = await Promise.all(imgs.map(async img => {
        const host = new URL(img.src).host;
        const filename = img.src.split('/').pop();
        const url = `https://${host}/large/${filename}`;
        await this.fileDownloader.downloadFromUrl(url, `./$mid/${filename}`);
      }));
      return successList.every(success => success);
    }

    /** @param {HTMLElement} feed */
    async downloadVideo(feed) {
      const container = feed.querySelector('li.WB_video[node-type="fl_h5_video"][video-sources]');
      if (!container) return true;
      const videoSourceData = new URLSearchParams(container.getAttribute('video-sources'));
      const videoSource = videoSourceData.get(videoSourceData.get('qType'));
      const url = videoSource.replace(/^http:/, 'https:');
      const filename = new URL(url).pathname.split('/').pop();
      const success = this.fileDownloader.downloadFromUrl(url, `./$mid/${filename}`);
      return success;
    }

    static getFeedInfo(feed) {
      const mid = feed.getAttribute('mid');
      if (!mid) return null;
      const [author] = feedParser.author.id(feed);
      if (!author) return null;
      return { author, mid };
    }

  }

  downloader.FeedDownloader = FeedDownloader;

}());
