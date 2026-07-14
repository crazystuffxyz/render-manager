window.__Cpn = window.__Cpn ? window.__Cpn : function () {
  this.permalink = this.URI(location.href);
  this.modal = "";
  this.header = "<div></div>";
  __Cpn.prototype.debugMode = 0;
  __Cpn.prototype.serviceWorkerUrl = location.origin + "/croxy.sw.js";
  __Cpn.prototype.showAds = false;
  __Cpn.prototype.isProxyHost = false;
  this.analyticsUid = "1752266534.2351988160";
  this.analyticsTrackingId = "G-RWN945234K";
  this.urlTimestamp = 1752266534;
  this.sessionEndRedirectUrl = "";
  this.sessionEndRedirectTtl = 0;
  this.fixedHeader = false;
  this.adsJson = "{}";
};
((rootURIRef, uriFactory) => {
  if (typeof module == "object" && module.exports) {
    module.exports = uriFactory(require("./punycode"), require("./IPv6"), require("./SecondLevelDomains"));
  } else if (typeof define == "function" && define.amd) {
    define(["./punycode", "./IPv6", "./SecondLevelDomains"], uriFactory);
  } else {
    rootURIRef.URI = uriFactory(rootURIRef.punycode, rootURIRef.IPv6, rootURIRef.SecondLevelDomains, rootURIRef);
  }
})(this, function (punycodeLib, ipv6Lib, sldLib, globalRoot) {
  var originalURI = globalRoot && globalRoot.URI;
  function URI_JS(uriText, uriBase) {
    var hasTextArg = arguments.length >= 1;
    if (!(this instanceof URI_JS)) {
      if (hasTextArg) {
        if (arguments.length >= 2) {
          return new URI_JS(uriText, uriBase);
        } else {
          return new URI_JS(uriText);
        }
      } else {
        return new URI_JS();
      }
    }
    if (uriText === undefined) {
      if (hasTextArg) {
        throw new TypeError("undefined is not a valid argument for URI");
      }
      uriText = typeof location != "undefined" ? location.href + "" : "";
    }
    if (uriText === null && hasTextArg) {
      throw new TypeError("null is not a valid argument for URI");
    }
    this.href(uriText);
    if (uriBase !== undefined) {
      return this.absoluteTo(uriBase);
    } else {
      return this;
    }
  }
  URI_JS.version = "1.19.11";
  var URIProto = URI_JS.prototype;
  var hasOwnPropertyRef = Object.prototype.hasOwnProperty;
  function removeArrayMatch(arrMatchTarget, arrMatchPattern) {
    var arrMatchIdx;
    var arrMatchLen;
    var arrMatchMap = {};
    if ((arrMatchPattern === undefined ? "Undefined" : String(Object.prototype.toString.call(arrMatchPattern)).slice(8, -1)) === "RegExp") {
      arrMatchMap = null;
    } else if ((arrMatchPattern === undefined ? "Undefined" : String(Object.prototype.toString.call(arrMatchPattern)).slice(8, -1)) === "Array") {
      arrMatchIdx = 0;
      for (arrMatchLen = arrMatchPattern.length; arrMatchIdx < arrMatchLen; arrMatchIdx++) {
        arrMatchMap[arrMatchPattern[arrMatchIdx]] = true;
      }
    } else {
      arrMatchMap[arrMatchPattern] = true;
    }
    arrMatchIdx = 0;
    for (arrMatchLen = arrMatchTarget.length; arrMatchIdx < arrMatchLen; arrMatchIdx++) {
      if (arrMatchMap && arrMatchMap[arrMatchTarget[arrMatchIdx]] !== undefined || !arrMatchMap && arrMatchPattern.test(arrMatchTarget[arrMatchIdx])) {
        arrMatchTarget.splice(arrMatchIdx, 1);
        arrMatchLen--;
        arrMatchIdx--;
      }
    }
    return arrMatchTarget;
  }
  function containsArray(arrContainsTarget, arrContainsPattern) {
    if ((arrContainsPattern === undefined ? "Undefined" : String(Object.prototype.toString.call(arrContainsPattern)).slice(8, -1)) === "Array") {
      arrContainsI = 0;
      for (arrContainsLen = arrContainsPattern.length; arrContainsI < arrContainsLen; arrContainsI++) {
        if (!containsArray(arrContainsTarget, arrContainsPattern[arrContainsI])) {
          return false;
        }
      }
      return true;
    }
    var arrContainsType = arrContainsPattern === undefined ? "Undefined" : String(Object.prototype.toString.call(arrContainsPattern)).slice(8, -1);
    var arrContainsI = 0;
    for (var arrContainsLen = arrContainsTarget.length; arrContainsI < arrContainsLen; arrContainsI++) {
      if (arrContainsType === "RegExp") {
        if (typeof arrContainsTarget[arrContainsI] == "string" && arrContainsTarget[arrContainsI].match(arrContainsPattern)) {
          return true;
        }
      } else if (arrContainsTarget[arrContainsI] === arrContainsPattern) {
        return true;
      }
    }
    return false;
  }
  function arraysEqual(arrEqA, arrEqB) {
    if ((arrEqA === undefined ? "Undefined" : String(Object.prototype.toString.call(arrEqA)).slice(8, -1)) !== "Array" || (arrEqB === undefined ? "Undefined" : String(Object.prototype.toString.call(arrEqB)).slice(8, -1)) !== "Array") {
      return false;
    }
    if (arrEqA.length !== arrEqB.length) {
      return false;
    }
    arrEqA.sort();
    arrEqB.sort();
    var arrEqI = 0;
    for (var arrEqLen = arrEqA.length; arrEqI < arrEqLen; arrEqI++) {
      if (arrEqA[arrEqI] !== arrEqB[arrEqI]) {
        return false;
      }
    }
    return true;
  }
  function escapeChar(charToEsc) {
    return escape(charToEsc);
  }
  function strictEncodeURIComponent(strParamEnc) {
    return encodeURIComponent(strParamEnc).replace(/[!'()*]/g, escapeChar).replace(/\*/g, "%2A");
  }
  URI_JS._parts = function () {
    return {
      protocol: null,
      username: null,
      password: null,
      hostname: null,
      urn: null,
      port: null,
      path: null,
      query: null,
      fragment: null,
      preventInvalidHostname: URI_JS.preventInvalidHostname,
      duplicateQueryParameters: URI_JS.duplicateQueryParameters,
      escapeQuerySpace: URI_JS.escapeQuerySpace
    };
  };
  URI_JS.preventInvalidHostname = false;
  URI_JS.duplicateQueryParameters = false;
  URI_JS.escapeQuerySpace = true;
  URI_JS.protocol_expression = /^[a-z][a-z0-9.+-]*$/i;
  URI_JS.idn_expression = /[^a-z0-9\._-]/i;
  URI_JS.punycode_expression = /(xn--)/i;
  URI_JS.ip4_expression = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
  URI_JS.ip6_expression = /^\s*((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(%.+)?\s*$/;
  URI_JS.find_uri_expression = /\b((?:[a-z][\w-]+:(?:\/{1,3}|[a-z0-9%])|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}\/)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:'".,<>?«»“”‘’]))/gi;
  URI_JS.findUri = {
    start: /\b(?:([a-z][a-z0-9.+-]*:\/\/)|www\.)/gi,
    end: /[\s\r\n]|$/,
    trim: /[`!()\[\]{};:'".,<>?«»“”„‘’]+$/,
    parens: /(\([^\)]*\)|\[[^\]]*\]|\{[^}]*\}|<[^>]*>)/g
  };
  URI_JS.leading_whitespace_expression = /^[\x00-\x20\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+/;
  URI_JS.ascii_tab_whitespace = /[\u0009\u000A\u000D]+/g;
  URI_JS.defaultPorts = {
    http: "80",
    https: "443",
    ftp: "21",
    gopher: "70",
    ws: "80",
    wss: "443"
  };
  URI_JS.hostProtocols = ["http", "https"];
  URI_JS.invalid_hostname_characters = /[^a-zA-Z0-9\.\-:_]/;
  URI_JS.domAttributes = {
    a: "href",
    blockquote: "cite",
    link: "href",
    base: "href",
    script: "src",
    form: "action",
    img: "src",
    area: "href",
    iframe: "src",
    embed: "src",
    source: "src",
    track: "src",
    input: "src",
    audio: "src",
    video: "src"
  };
  URI_JS.getDomAttribute = function (domElementUri) {
    if (domElementUri && domElementUri.nodeName) {
      var nodeNameUri = domElementUri.nodeName.toLowerCase();
      if (nodeNameUri !== "input" || domElementUri.type === "image") {
        return URI_JS.domAttributes[nodeNameUri];
      }
    }
  };
  URI_JS.encode = strictEncodeURIComponent;
  URI_JS.decode = decodeURIComponent;
  URI_JS.iso8859 = function () {
    URI_JS.encode = escape;
    URI_JS.decode = unescape;
  };
  URI_JS.unicode = function () {
    URI_JS.encode = strictEncodeURIComponent;
    URI_JS.decode = decodeURIComponent;
  };
  URI_JS.characters = {
    pathname: {
      encode: {
        expression: /%(24|26|2B|2C|3B|3D|3A|40)/gi,
        map: {
          "%24": "$",
          "%26": "&",
          "%2B": "+",
          "%2C": ",",
          "%3B": ";",
          "%3D": "=",
          "%3A": ":",
          "%40": "@"
        }
      },
      decode: {
        expression: /[\/\?#]/g,
        map: {
          "/": "%2F",
          "?": "%3F",
          "#": "%23"
        }
      }
    },
    reserved: {
      encode: {
        expression: /%(21|23|24|26|27|28|29|2A|2B|2C|2F|3A|3B|3D|3F|40|5B|5D)/gi,
        map: {
          "%3A": ":",
          "%2F": "/",
          "%3F": "?",
          "%23": "#",
          "%5B": "[",
          "%5D": "]",
          "%40": "@",
          "%21": "!",
          "%24": "$",
          "%26": "&",
          "%27": "'",
          "%28": "(",
          "%29": ")",
          "%2A": "*",
          "%2B": "+",
          "%2C": ",",
          "%3B": ";",
          "%3D": "="
        }
      }
    },
    urnpath: {
      encode: {
        expression: /%(21|24|27|28|29|2A|2B|2C|3B|3D|40)/gi,
        map: {
          "%21": "!",
          "%24": "$",
          "%27": "'",
          "%28": "(",
          "%29": ")",
          "%2A": "*",
          "%2B": "+",
          "%2C": ",",
          "%3B": ";",
          "%3D": "=",
          "%40": "@"
        }
      },
      decode: {
        expression: /[\/\?#:]/g,
        map: {
          "/": "%2F",
          "?": "%3F",
          "#": "%23",
          ":": "%3A"
        }
      }
    }
  };
  URI_JS.encodeQuery = function (queryVal, escapeQuerySpace) {
    queryVal = URI_JS.encode(queryVal + "");
    if (escapeQuerySpace = escapeQuerySpace === undefined ? URI_JS.escapeQuerySpace : escapeQuerySpace) {
      return queryVal.replace(/%20/g, "+");
    } else {
      return queryVal;
    }
  };
  URI_JS.decodeQuery = function (queryDecVal, unscapeQuerySpace) {
    queryDecVal += "";
    if (unscapeQuerySpace === undefined) {
      unscapeQuerySpace = URI_JS.escapeQuerySpace;
    }
    try {
      return URI_JS.decode(unscapeQuerySpace ? queryDecVal.replace(/\+/g, "%20") : queryDecVal);
    } catch (decodeErr) {
      return queryDecVal;
    }
  };
  function buildSegmentCoder(segmentName, coderName) {
    return function (segmentChar) {
      try {
        return URI_JS[coderName](segmentChar + "").replace(URI_JS.characters[segmentName][coderName].expression, function (matchedChar) {
          return URI_JS.characters[segmentName][coderName].map[matchedChar];
        });
      } catch (coderErr) {
        return segmentChar;
      }
    };
  }
  var coderIdx;
  var codersObj = {
    encode: "encode",
    decode: "decode"
  };
  for (coderIdx in codersObj) {
    URI_JS[coderIdx + "PathSegment"] = buildSegmentCoder("pathname", codersObj[coderIdx]);
    URI_JS[coderIdx + "UrnPathSegment"] = buildSegmentCoder("urnpath", codersObj[coderIdx]);
  }
  function buildPathSegCoder(segSeparator, segCoderFn, segDecoderFn) {
    return function (pathStrArg) {
      var pathCoderFn = segDecoderFn ? function (pathDecChar) {
        return URI_JS[segCoderFn](URI_JS[segDecoderFn](pathDecChar));
      } : URI_JS[segCoderFn];
      var pathSegs = (pathStrArg + "").split(segSeparator);
      var pathSegIdx = 0;
      for (var pathSegLen = pathSegs.length; pathSegIdx < pathSegLen; pathSegIdx++) {
        pathSegs[pathSegIdx] = pathCoderFn(pathSegs[pathSegIdx]);
      }
      return pathSegs.join(segSeparator);
    };
  }
  function buildPartGetter(partNameGet) {
    return function (partValGet, deferBldGet) {
      if (partValGet === undefined) {
        return this._parts[partNameGet] || "";
      } else {
        this._parts[partNameGet] = partValGet || null;
        this.build(!deferBldGet);
        return this;
      }
    };
  }
  function buildQueryGetter(qPartNameGet, qCharPfx) {
    return function (qValGet, qDeferBldGet) {
      if (qValGet === undefined) {
        return this._parts[qPartNameGet] || "";
      } else {
        if (qValGet !== null && (qValGet += "").charAt(0) === qCharPfx) {
          qValGet = qValGet.substring(1);
        }
        this._parts[qPartNameGet] = qValGet;
        this.build(!qDeferBldGet);
        return this;
      }
    };
  }
  URI_JS.decodePath = buildPathSegCoder("/", "decodePathSegment");
  URI_JS.decodeUrnPath = buildPathSegCoder(":", "decodeUrnPathSegment");
  URI_JS.recodePath = buildPathSegCoder("/", "encodePathSegment", "decode");
  URI_JS.recodeUrnPath = buildPathSegCoder(":", "encodeUrnPathSegment", "decode");
  URI_JS.encodeReserved = buildSegmentCoder("reserved", "encode");
  URI_JS.parse = function (parseStrURI, parsePartsURI) {
    var parseIdxURI;
    parsePartsURI = parsePartsURI || {
      preventInvalidHostname: URI_JS.preventInvalidHostname
    };
    if ((parseIdxURI = (parseStrURI = (parseStrURI = parseStrURI.replace(URI_JS.leading_whitespace_expression, "")).replace(URI_JS.ascii_tab_whitespace, "")).indexOf("#")) > -1) {
      parsePartsURI.fragment = parseStrURI.substring(parseIdxURI + 1) || null;
      parseStrURI = parseStrURI.substring(0, parseIdxURI);
    }
    if ((parseIdxURI = parseStrURI.indexOf("?")) > -1) {
      parsePartsURI.query = parseStrURI.substring(parseIdxURI + 1) || null;
      parseStrURI = parseStrURI.substring(0, parseIdxURI);
    }
    if ((parseStrURI = (parseStrURI = parseStrURI.replace(/^(https?|ftp|wss?)?:+[/\\]*/i, "$1://")).replace(/^[/\\]{2,}/i, "//")).substring(0, 2) === "//") {
      parsePartsURI.protocol = null;
      parseStrURI = parseStrURI.substring(2);
      parseStrURI = URI_JS.parseAuthority(parseStrURI, parsePartsURI);
    } else if ((parseIdxURI = parseStrURI.indexOf(":")) > -1) {
      parsePartsURI.protocol = parseStrURI.substring(0, parseIdxURI) || null;
      if (parsePartsURI.protocol && !parsePartsURI.protocol.match(URI_JS.protocol_expression)) {
        parsePartsURI.protocol = undefined;
      } else if (parseStrURI.substring(parseIdxURI + 1, parseIdxURI + 3).replace(/\\/g, "/") === "//") {
        parseStrURI = parseStrURI.substring(parseIdxURI + 3);
        parseStrURI = URI_JS.parseAuthority(parseStrURI, parsePartsURI);
      } else {
        parseStrURI = parseStrURI.substring(parseIdxURI + 1);
        parsePartsURI.urn = true;
      }
    }
    parsePartsURI.path = parseStrURI;
    return parsePartsURI;
  };
  URI_JS.parseHost = function (hostStrURI, hostPartsURI) {
    var hostSlashIdx;
    var hostPortIdx;
    var hostEndIdx = (hostStrURI = (hostStrURI = hostStrURI || "").replace(/\\/g, "/")).indexOf("/");
    if (hostEndIdx === -1) {
      hostEndIdx = hostStrURI.length;
    }
    if (hostStrURI.charAt(0) === "[") {
      hostPortIdx = hostStrURI.indexOf("]");
      hostPartsURI.hostname = hostStrURI.substring(1, hostPortIdx) || null;
      hostPartsURI.port = hostStrURI.substring(hostPortIdx + 2, hostEndIdx) || null;
      if (hostPartsURI.port === "/") {
        hostPartsURI.port = null;
      }
    } else {
      hostPortIdx = hostStrURI.indexOf(":");
      hostSlashIdx = hostStrURI.indexOf("/");
      if ((hostPortIdx = hostStrURI.indexOf(":", hostPortIdx + 1)) !== -1 && (hostSlashIdx === -1 || hostPortIdx < hostSlashIdx)) {
        hostPartsURI.hostname = hostStrURI.substring(0, hostEndIdx) || null;
        hostPartsURI.port = null;
      } else {
        hostPortIdx = hostStrURI.substring(0, hostEndIdx).split(":");
        hostPartsURI.hostname = hostPortIdx[0] || null;
        hostPartsURI.port = hostPortIdx[1] || null;
      }
    }
    if (hostPartsURI.hostname && hostStrURI.substring(hostEndIdx).charAt(0) !== "/") {
      hostEndIdx++;
      hostStrURI = "/" + hostStrURI;
    }
    if (hostPartsURI.preventInvalidHostname) {
      URI_JS.ensureValidHostname(hostPartsURI.hostname, hostPartsURI.protocol);
    }
    if (hostPartsURI.port) {
      URI_JS.ensureValidPort(hostPartsURI.port);
    }
    return hostStrURI.substring(hostEndIdx) || "/";
  };
  URI_JS.parseAuthority = function (authStrURI, authPartsURI) {
    authStrURI = URI_JS.parseUserinfo(authStrURI, authPartsURI);
    return URI_JS.parseHost(authStrURI, authPartsURI);
  };
  URI_JS.parseUserinfo = function (userInfoStrURI, userInfoPartsURI) {
    var uiTempStrURI = userInfoStrURI;
    var uiSlashIdxURI = (userInfoStrURI = userInfoStrURI.indexOf("\\") !== -1 ? userInfoStrURI.replace(/\\/g, "/") : userInfoStrURI).indexOf("/");
    var uiAtIdxURI = userInfoStrURI.lastIndexOf("@", uiSlashIdxURI > -1 ? uiSlashIdxURI : userInfoStrURI.length - 1);
    if (uiAtIdxURI > -1 && (uiSlashIdxURI === -1 || uiAtIdxURI < uiSlashIdxURI)) {
      uiSlashIdxURI = userInfoStrURI.substring(0, uiAtIdxURI).split(":");
      userInfoPartsURI.username = uiSlashIdxURI[0] ? URI_JS.decode(uiSlashIdxURI[0]) : null;
      uiSlashIdxURI.shift();
      userInfoPartsURI.password = uiSlashIdxURI[0] ? URI_JS.decode(uiSlashIdxURI.join(":")) : null;
      userInfoStrURI = uiTempStrURI.substring(uiAtIdxURI + 1);
    } else {
      userInfoPartsURI.username = null;
      userInfoPartsURI.password = null;
    }
    return userInfoStrURI;
  };
  URI_JS.parseQuery = function (queryStrURI, qEscapeSpaceURI) {
    if (!queryStrURI) {
      return {};
    }
    if (!(queryStrURI = queryStrURI.replace(/&+/g, "&").replace(/^\?*&*|&+$/g, ""))) {
      return {};
    }
    var qKeyURI;
    var qValSplitURI;
    var qObjURI = {};
    var qPairsURI = queryStrURI.split("&");
    var qPairsLenURI = qPairsURI.length;
    for (var qIterURI = 0; qIterURI < qPairsLenURI; qIterURI++) {
      qValSplitURI = qPairsURI[qIterURI].split("=");
      qKeyURI = URI_JS.decodeQuery(qValSplitURI.shift(), qEscapeSpaceURI);
      qValSplitURI = qValSplitURI.length ? URI_JS.decodeQuery(qValSplitURI.join("="), qEscapeSpaceURI) : null;
      if (qKeyURI !== "__proto__") {
        if (hasOwnPropertyRef.call(qObjURI, qKeyURI)) {
          if (typeof qObjURI[qKeyURI] == "string" || qObjURI[qKeyURI] === null) {
            qObjURI[qKeyURI] = [qObjURI[qKeyURI]];
          }
          qObjURI[qKeyURI].push(qValSplitURI);
        } else {
          qObjURI[qKeyURI] = qValSplitURI;
        }
      }
    }
    return qObjURI;
  };
  URI_JS.build = function (buildPartsURI) {
    var buildResultURI = "";
    var buildHasAuthURI = false;
    if (buildPartsURI.protocol) {
      buildResultURI += buildPartsURI.protocol + ":";
    }
    if (!buildPartsURI.urn && (!!buildResultURI || !!buildPartsURI.hostname)) {
      buildResultURI += "//";
      buildHasAuthURI = true;
    }
    buildResultURI += URI_JS.buildAuthority(buildPartsURI) || "";
    if (typeof buildPartsURI.path == "string") {
      if (buildPartsURI.path.charAt(0) !== "/" && buildHasAuthURI) {
        buildResultURI += "/";
      }
      buildResultURI += buildPartsURI.path;
    }
    if (typeof buildPartsURI.query == "string" && buildPartsURI.query) {
      buildResultURI += "?" + buildPartsURI.query;
    }
    if (typeof buildPartsURI.fragment == "string" && buildPartsURI.fragment) {
      buildResultURI += "#" + buildPartsURI.fragment;
    }
    return buildResultURI;
  };
  URI_JS.buildHost = function (bHostPartsURI) {
    var bHostResultURI = "";
    if (bHostPartsURI.hostname) {
      if (URI_JS.ip6_expression.test(bHostPartsURI.hostname)) {
        bHostResultURI += "[" + bHostPartsURI.hostname + "]";
      } else {
        bHostResultURI += bHostPartsURI.hostname;
      }
      if (bHostPartsURI.port) {
        bHostResultURI += ":" + bHostPartsURI.port;
      }
      return bHostResultURI;
    } else {
      return "";
    }
  };
  URI_JS.buildAuthority = function (bAuthPartsURI) {
    return URI_JS.buildUserinfo(bAuthPartsURI) + URI_JS.buildHost(bAuthPartsURI);
  };
  URI_JS.buildUserinfo = function (bUserPartsURI) {
    var bUserResultURI = "";
    if (bUserPartsURI.username) {
      bUserResultURI += URI_JS.encode(bUserPartsURI.username);
    }
    if (bUserPartsURI.password) {
      bUserResultURI += ":" + URI_JS.encode(bUserPartsURI.password);
    }
    if (bUserResultURI) {
      bUserResultURI += "@";
    }
    return bUserResultURI;
  };
  URI_JS.buildQuery = function (bQueryObjURI, bDuplicateParamsURI, bEscapeSpaceURI) {
    var bQueryKeysURI;
    var bQueryKeyURI;
    var bQueryIdxURI;
    var bQueryLenURI;
    var bQueryResURI = "";
    for (bQueryKeyURI in bQueryObjURI) {
      if (bQueryKeyURI !== "__proto__" && hasOwnPropertyRef.call(bQueryObjURI, bQueryKeyURI)) {
        if ((bQueryObjURI[bQueryKeyURI] === undefined ? "Undefined" : String(Object.prototype.toString.call(bQueryObjURI[bQueryKeyURI])).slice(8, -1)) === "Array") {
          bQueryKeysURI = {};
          bQueryIdxURI = 0;
          for (bQueryLenURI = bQueryObjURI[bQueryKeyURI].length; bQueryIdxURI < bQueryLenURI; bQueryIdxURI++) {
            if (bQueryObjURI[bQueryKeyURI][bQueryIdxURI] !== undefined && bQueryKeysURI[bQueryObjURI[bQueryKeyURI][bQueryIdxURI] + ""] === undefined && (bQueryResURI += "&" + URI_JS.buildQueryParameter(bQueryKeyURI, bQueryObjURI[bQueryKeyURI][bQueryIdxURI], bEscapeSpaceURI), bDuplicateParamsURI !== true)) {
              bQueryKeysURI[bQueryObjURI[bQueryKeyURI][bQueryIdxURI] + ""] = true;
            }
          }
        } else if (bQueryObjURI[bQueryKeyURI] !== undefined) {
          bQueryResURI += "&" + URI_JS.buildQueryParameter(bQueryKeyURI, bQueryObjURI[bQueryKeyURI], bEscapeSpaceURI);
        }
      }
    }
    return bQueryResURI.substring(1);
  };
  URI_JS.buildQueryParameter = function (bParamKeyURI, bParamValURI, bParamEscURI) {
    return URI_JS.encodeQuery(bParamKeyURI, bParamEscURI) + (bParamValURI !== null ? "=" + URI_JS.encodeQuery(bParamValURI, bParamEscURI) : "");
  };
  URI_JS.addQuery = function (addQObjURI, addQKeyURI, addQValURI) {
    if (typeof addQKeyURI == "object") {
      for (var addQIterURI in addQKeyURI) {
        if (hasOwnPropertyRef.call(addQKeyURI, addQIterURI)) {
          URI_JS.addQuery(addQObjURI, addQIterURI, addQKeyURI[addQIterURI]);
        }
      }
    } else {
      if (typeof addQKeyURI != "string") {
        throw new TypeError("URI.addQuery() accepts an object, string as the name parameter");
      }
      if (addQObjURI[addQKeyURI] === undefined) {
        addQObjURI[addQKeyURI] = addQValURI;
      } else {
        if (typeof addQObjURI[addQKeyURI] == "string") {
          addQObjURI[addQKeyURI] = [addQObjURI[addQKeyURI]];
        }
        if ((addQValURI === undefined ? "Undefined" : String(Object.prototype.toString.call(addQValURI)).slice(8, -1)) !== "Array") {
          addQValURI = [addQValURI];
        }
        addQObjURI[addQKeyURI] = (addQObjURI[addQKeyURI] || []).concat(addQValURI);
      }
    }
  };
  URI_JS.setQuery = function (setQObjURI, setQKeyURI, setQValURI) {
    if (typeof setQKeyURI == "object") {
      for (var setQIterURI in setQKeyURI) {
        if (hasOwnPropertyRef.call(setQKeyURI, setQIterURI)) {
          URI_JS.setQuery(setQObjURI, setQIterURI, setQKeyURI[setQIterURI]);
        }
      }
    } else {
      if (typeof setQKeyURI != "string") {
        throw new TypeError("URI.setQuery() accepts an object, string as the name parameter");
      }
      setQObjURI[setQKeyURI] = setQValURI === undefined ? null : setQValURI;
    }
  };
  URI_JS.removeQuery = function (remQObjURI, remQKeyURI, remQValURI) {
    var remQIdxURI;
    var remQLenURI;
    var remQIterURI;
    if ((remQKeyURI === undefined ? "Undefined" : String(Object.prototype.toString.call(remQKeyURI)).slice(8, -1)) === "Array") {
      remQIdxURI = 0;
      for (remQLenURI = remQKeyURI.length; remQIdxURI < remQLenURI; remQIdxURI++) {
        remQObjURI[remQKeyURI[remQIdxURI]] = undefined;
      }
    } else if ((remQKeyURI === undefined ? "Undefined" : String(Object.prototype.toString.call(remQKeyURI)).slice(8, -1)) === "RegExp") {
      for (remQIterURI in remQObjURI) {
        if (remQKeyURI.test(remQIterURI)) {
          remQObjURI[remQIterURI] = undefined;
        }
      }
    } else if (typeof remQKeyURI == "object") {
      for (remQIterURI in remQKeyURI) {
        if (hasOwnPropertyRef.call(remQKeyURI, remQIterURI)) {
          URI_JS.removeQuery(remQObjURI, remQIterURI, remQKeyURI[remQIterURI]);
        }
      }
    } else {
      if (typeof remQKeyURI != "string") {
        throw new TypeError("URI.removeQuery() accepts an object, string, RegExp as the first parameter");
      }
      if (remQValURI !== undefined) {
        if ((remQValURI === undefined ? "Undefined" : String(Object.prototype.toString.call(remQValURI)).slice(8, -1)) === "RegExp") {
          if ((remQObjURI[remQKeyURI] === undefined ? "Undefined" : String(Object.prototype.toString.call(remQObjURI[remQKeyURI])).slice(8, -1)) !== "Array" && remQValURI.test(remQObjURI[remQKeyURI])) {
            remQObjURI[remQKeyURI] = undefined;
          } else {
            remQObjURI[remQKeyURI] = removeArrayMatch(remQObjURI[remQKeyURI], remQValURI);
          }
        } else if (remQObjURI[remQKeyURI] !== String(remQValURI) || (remQValURI === undefined ? "Undefined" : String(Object.prototype.toString.call(remQValURI)).slice(8, -1)) === "Array" && remQValURI.length !== 1) {
          if ((remQObjURI[remQKeyURI] === undefined ? "Undefined" : String(Object.prototype.toString.call(remQObjURI[remQKeyURI])).slice(8, -1)) === "Array") {
            remQObjURI[remQKeyURI] = removeArrayMatch(remQObjURI[remQKeyURI], remQValURI);
          }
        } else {
          remQObjURI[remQKeyURI] = undefined;
        }
      } else {
        remQObjURI[remQKeyURI] = undefined;
      }
    }
  };
  URI_JS.hasQuery = function (hasQObjURI, hasQKeyURI, hasQValURI, hasQExactMatchURI) {
    switch (hasQKeyURI === undefined ? "Undefined" : String(Object.prototype.toString.call(hasQKeyURI)).slice(8, -1)) {
      case "String":
        break;
      case "RegExp":
        for (var hasQIterURI in hasQObjURI) {
          if (hasOwnPropertyRef.call(hasQObjURI, hasQIterURI) && hasQKeyURI.test(hasQIterURI) && (hasQValURI === undefined || URI_JS.hasQuery(hasQObjURI, hasQIterURI, hasQValURI))) {
            return true;
          }
        }
        return false;
      case "Object":
        for (var hasQIter2URI in hasQKeyURI) {
          if (hasOwnPropertyRef.call(hasQKeyURI, hasQIter2URI) && !URI_JS.hasQuery(hasQObjURI, hasQIter2URI, hasQKeyURI[hasQIter2URI])) {
            return false;
          }
        }
        return true;
      default:
        throw new TypeError("URI.hasQuery() accepts a string, regular expression or object as the name parameter");
    }
    switch (hasQValURI === undefined ? "Undefined" : String(Object.prototype.toString.call(hasQValURI)).slice(8, -1)) {
      case "Undefined":
        return hasQKeyURI in hasQObjURI;
      case "Boolean":
        return hasQValURI === Boolean((hasQObjURI[hasQKeyURI] === undefined ? "Undefined" : String(Object.prototype.toString.call(hasQObjURI[hasQKeyURI])).slice(8, -1)) === "Array" ? hasQObjURI[hasQKeyURI].length : hasQObjURI[hasQKeyURI]);
      case "Function":
        return !!hasQValURI(hasQObjURI[hasQKeyURI], hasQKeyURI, hasQObjURI);
      case "Array":
        if ((hasQObjURI[hasQKeyURI] === undefined ? "Undefined" : String(Object.prototype.toString.call(hasQObjURI[hasQKeyURI])).slice(8, -1)) === "Array") {
          return (hasQExactMatchURI ? containsArray : arraysEqual)(hasQObjURI[hasQKeyURI], hasQValURI);
        } else {
          return false;
        }
      case "RegExp":
        if ((hasQObjURI[hasQKeyURI] === undefined ? "Undefined" : String(Object.prototype.toString.call(hasQObjURI[hasQKeyURI])).slice(8, -1)) === "Array") {
          return !!hasQExactMatchURI && containsArray(hasQObjURI[hasQKeyURI], hasQValURI);
        } else {
          return Boolean(hasQObjURI[hasQKeyURI] && hasQObjURI[hasQKeyURI].match(hasQValURI));
        }
      case "Number":
        hasQValURI = String(hasQValURI);
      case "String":
        if ((hasQObjURI[hasQKeyURI] === undefined ? "Undefined" : String(Object.prototype.toString.call(hasQObjURI[hasQKeyURI])).slice(8, -1)) === "Array") {
          return !!hasQExactMatchURI && containsArray(hasQObjURI[hasQKeyURI], hasQValURI);
        } else {
          return hasQObjURI[hasQKeyURI] === hasQValURI;
        }
      default:
        throw new TypeError("URI.hasQuery() accepts undefined, boolean, string, number, RegExp, Function as the value parameter");
    }
  };
  URI_JS.joinPaths = function () {
    var joinResURI;
    var joinURIsList = [];
    var joinPathsList = [];
    var joinPathsLen = 0;
    for (var joinIdxURI = 0; joinIdxURI < arguments.length; joinIdxURI++) {
      var joinURIObj = new URI_JS(arguments[joinIdxURI]);
      var joinSegmentsList = joinURIObj.segment();
      for (var joinSegIdxURI = 0; joinSegIdxURI < joinSegmentsList.length; joinSegIdxURI++) {
        var joinURIObj;
        var joinSegmentsList;
        var joinSegIdxURI;
        if (typeof joinSegmentsList[joinSegIdxURI] == "string") {
          joinPathsList.push(joinSegmentsList[joinSegIdxURI]);
        }
        if (joinSegmentsList[joinSegIdxURI]) {
          joinPathsLen++;
        }
      }
    }
    if (joinPathsList.length && joinPathsLen) {
      joinResURI = new URI_JS("").segment(joinPathsList);
      if (joinURIsList[0].path() === "" || joinURIsList[0].path().slice(0, 1) === "/") {
        joinResURI.path("/" + joinResURI.path());
      }
      return joinResURI.normalize();
    } else {
      return new URI_JS("");
    }
  };
  URI_JS.commonPath = function (commPathA, commPathB) {
    var commLenURI = Math.min(commPathA.length, commPathB.length);
    for (var commIdxURI = 0; commIdxURI < commLenURI; commIdxURI++) {
      if (commPathA.charAt(commIdxURI) !== commPathB.charAt(commIdxURI)) {
        commIdxURI--;
        break;
      }
    }
    if (commIdxURI < 1) {
      if (commPathA.charAt(0) === commPathB.charAt(0) && commPathA.charAt(0) === "/") {
        return "/";
      } else {
        return "";
      }
    } else {
      if (commPathA.charAt(commIdxURI) !== "/" || commPathB.charAt(commIdxURI) !== "/") {
        commIdxURI = commPathA.substring(0, commIdxURI).lastIndexOf("/");
      }
      return commPathA.substring(0, commIdxURI + 1);
    }
  };
  URI_JS.withinString = function (withinStrURI, withinCallbackURI, withinOptionsURI) {
    var withinStartReg = (withinOptionsURI = withinOptionsURI || {}).start || URI_JS.findUri.start;
    var withinEndReg = withinOptionsURI.end || URI_JS.findUri.end;
    var withinTrimReg = withinOptionsURI.trim || URI_JS.findUri.trim;
    var withinParensReg = withinOptionsURI.parens || URI_JS.findUri.parens;
    var withinHtmlMatchReg = /[a-z0-9-]=["']?$/i;
    for (withinStartReg.lastIndex = 0;;) {
      var withinMatchURI = withinStartReg.exec(withinStrURI);
      if (!withinMatchURI) {
        break;
      }
      var withinMatchIdxURI = withinMatchURI.index;
      if (withinOptionsURI.ignoreHtml) {
        var withinPrevIdxURI = withinStrURI.slice(Math.max(withinMatchIdxURI - 3, 0), withinMatchIdxURI);
        if (withinPrevIdxURI && withinHtmlMatchReg.test(withinPrevIdxURI)) {
          continue;
        }
      }
      var withinPrevIdxURI = withinMatchIdxURI + withinStrURI.slice(withinMatchIdxURI).search(withinEndReg);
      var withinMatchStrURI = withinStrURI.slice(withinMatchIdxURI, withinPrevIdxURI);
      var withinParenIdxURI = -1;
      for (;;) {
        var withinParenMatchURI = withinParensReg.exec(withinMatchStrURI);
        if (!withinParenMatchURI) {
          break;
        }
        withinParenMatchURI = withinParenMatchURI.index + withinParenMatchURI[0].length;
        withinParenIdxURI = Math.max(withinParenIdxURI, withinParenMatchURI);
      }
      if (!((withinMatchStrURI = withinParenIdxURI > -1 ? withinMatchStrURI.slice(0, withinParenIdxURI) + withinMatchStrURI.slice(withinParenIdxURI).replace(withinTrimReg, "") : withinMatchStrURI.replace(withinTrimReg, "")).length <= withinMatchURI[0].length) && (!withinOptionsURI.ignore || !withinOptionsURI.ignore.test(withinMatchStrURI))) {
        if ((withinMatchURI = withinCallbackURI(withinMatchStrURI, withinMatchIdxURI, withinPrevIdxURI = withinMatchIdxURI + withinMatchStrURI.length, withinStrURI)) === undefined) {
          withinStartReg.lastIndex = withinPrevIdxURI;
        } else {
          withinMatchURI = String(withinMatchURI);
          withinStrURI = withinStrURI.slice(0, withinMatchIdxURI) + withinMatchURI + withinStrURI.slice(withinPrevIdxURI);
          withinStartReg.lastIndex = withinMatchIdxURI + withinMatchURI.length;
        }
      }
    }
    withinStartReg.lastIndex = 0;
    return withinStrURI;
  };
  URI_JS.ensureValidHostname = function (validHostURI, validProtoURI) {
    var validHasHostURI = !!validHostURI;
    var validHasProtoURI = false;
    if ((validHasProtoURI = validProtoURI ? containsArray(URI_JS.hostProtocols, validProtoURI) : validHasProtoURI) && !validHasHostURI) {
      throw new TypeError("Hostname cannot be empty, if protocol is " + validProtoURI);
    }
    if (validHostURI && validHostURI.match(URI_JS.invalid_hostname_characters)) {
      if (!punycodeLib) {
        throw new TypeError("Hostname \"" + validHostURI + "\" contains characters other than [A-Z0-9.-:_] and Punycode.js is not available");
      }
      if (punycodeLib.toASCII(validHostURI).match(URI_JS.invalid_hostname_characters)) {
        throw new TypeError("Hostname \"" + validHostURI + "\" contains characters other than [A-Z0-9.-:_]");
      }
    }
  };
  URI_JS.ensureValidPort = function (validPortURI) {
    if (validPortURI) {
      var validPortNumURI = Number(validPortURI);
      if (!/^[0-9]+$/.test(validPortNumURI) || !(validPortNumURI > 0) || !(validPortNumURI < 65536)) {
        throw new TypeError("Port \"" + validPortURI + "\" is not a valid port");
      }
    }
  };
  URI_JS.noConflict = function (noConflictCtx) {
    if (noConflictCtx) {
      noConflictCtx = {
        URI: this.noConflict()
      };
      if (globalRoot.URITemplate && typeof globalRoot.URITemplate.noConflict == "function") {
        noConflictCtx.URITemplate = globalRoot.URITemplate.noConflict();
      }
      if (globalRoot.IPv6 && typeof globalRoot.IPv6.noConflict == "function") {
        noConflictCtx.IPv6 = globalRoot.IPv6.noConflict();
      }
      if (globalRoot.SecondLevelDomains && typeof globalRoot.SecondLevelDomains.noConflict == "function") {
        noConflictCtx.SecondLevelDomains = globalRoot.SecondLevelDomains.noConflict();
      }
      return noConflictCtx;
    } else {
      if (globalRoot.URI === this) {
        globalRoot.URI = originalURI;
      }
      return this;
    }
  };
  URIProto.build = function (deferBldURI) {
    if (deferBldURI === true) {
      this._deferred_build = true;
    } else if (deferBldURI === undefined || !!this._deferred_build) {
      this._string = URI_JS.build(this._parts);
      this._deferred_build = false;
    }
    return this;
  };
  URIProto.clone = function () {
    return new URI_JS(this);
  };
  URIProto.valueOf = URIProto.toString = function () {
    return this.build(false)._string;
  };
  URIProto.protocol = buildPartGetter("protocol");
  URIProto.username = buildPartGetter("username");
  URIProto.password = buildPartGetter("password");
  URIProto.hostname = buildPartGetter("hostname");
  URIProto.port = buildPartGetter("port");
  URIProto.query = buildQueryGetter("query", "?");
  URIProto.fragment = buildQueryGetter("fragment", "#");
  URIProto.search = function (searchQueryURI, searchBuildURI) {
    searchQueryURI = this.query(searchQueryURI, searchBuildURI);
    if (typeof searchQueryURI == "string" && searchQueryURI.length) {
      return "?" + searchQueryURI;
    } else {
      return searchQueryURI;
    }
  };
  URIProto.hash = function (hashFragURI, hashBuildURI) {
    hashFragURI = this.fragment(hashFragURI, hashBuildURI);
    if (typeof hashFragURI == "string" && hashFragURI.length) {
      return "#" + hashFragURI;
    } else {
      return hashFragURI;
    }
  };
  URIProto.pathname = function (pPathNameURI, pPathBuildURI) {
    var pPathStrURI;
    if (pPathNameURI === undefined || pPathNameURI === true) {
      pPathStrURI = this._parts.path || (this._parts.hostname ? "/" : "");
      if (pPathNameURI) {
        return (this._parts.urn ? URI_JS.decodeUrnPath : URI_JS.decodePath)(pPathStrURI);
      } else {
        return pPathStrURI;
      }
    } else {
      if (this._parts.urn) {
        this._parts.path = pPathNameURI ? URI_JS.recodeUrnPath(pPathNameURI) : "";
      } else {
        this._parts.path = pPathNameURI ? URI_JS.recodePath(pPathNameURI) : "/";
      }
      this.build(!pPathBuildURI);
      return this;
    }
  };
  URIProto.path = URIProto.pathname;
  URIProto.href = function (hrefValURI, hrefBuildURI) {
    if (hrefValURI === undefined) {
      return this.toString();
    }
    this._string = "";
    this._parts = URI_JS._parts();
    var hrefIsURIRef = hrefValURI instanceof URI_JS;
    var hrefIsObjectRef = typeof hrefValURI == "object" && (hrefValURI.hostname || hrefValURI.path || hrefValURI.pathname);
    if (hrefValURI.nodeName) {
      hrefValURI = hrefValURI[URI_JS.getDomAttribute(hrefValURI)] || "";
      hrefIsObjectRef = false;
    }
    if (typeof (hrefValURI = !hrefIsURIRef && hrefIsObjectRef && hrefValURI.pathname !== undefined ? hrefValURI.toString() : hrefValURI) == "string" || hrefValURI instanceof String) {
      this._parts = URI_JS.parse(String(hrefValURI), this._parts);
    } else {
      if (!hrefIsURIRef && !hrefIsObjectRef) {
        throw new TypeError("invalid input");
      }
      var hrefPartsURI = hrefIsURIRef ? hrefValURI._parts : hrefValURI;
      for (var hrefIterURI in hrefPartsURI) {
        if (hrefIterURI !== "query" && hasOwnPropertyRef.call(this._parts, hrefIterURI)) {
          this._parts[hrefIterURI] = hrefPartsURI[hrefIterURI];
        }
      }
      if (hrefPartsURI.query) {
        this.query(hrefPartsURI.query, false);
      }
    }
    this.build(!hrefBuildURI);
    return this;
  };
  URIProto.is = function (isTypeURI) {
    var isIPURI = false;
    var isIPv4URI = false;
    var isIPv6URI = false;
    var isDomainURI = false;
    var isSLDURI = false;
    var isIDNURI = false;
    var isPunycodeURI = false;
    var isRelativeURI = !this._parts.urn;
    if (this._parts.hostname) {
      isRelativeURI = false;
      isIPv4URI = URI_JS.ip4_expression.test(this._parts.hostname);
      isIPv6URI = URI_JS.ip6_expression.test(this._parts.hostname);
      isSLDURI = (isDomainURI = !(isIPURI = isIPv4URI || isIPv6URI)) && sldLib && sldLib.has(this._parts.hostname);
      isIDNURI = isDomainURI && URI_JS.idn_expression.test(this._parts.hostname);
      isPunycodeURI = isDomainURI && URI_JS.punycode_expression.test(this._parts.hostname);
    }
    switch (isTypeURI.toLowerCase()) {
      case "relative":
        return isRelativeURI;
      case "absolute":
        return !isRelativeURI;
      case "domain":
      case "name":
        return isDomainURI;
      case "sld":
        return isSLDURI;
      case "ip":
        return isIPURI;
      case "ip4":
      case "ipv4":
      case "inet4":
        return isIPv4URI;
      case "ip6":
      case "ipv6":
      case "inet6":
        return isIPv6URI;
      case "idn":
        return isIDNURI;
      case "url":
        return !this._parts.urn;
      case "urn":
        return !!this._parts.urn;
      case "punycode":
        return isPunycodeURI;
    }
    return null;
  };
  var protoGetterURI = URIProto.protocol;
  var portGetterURI = URIProto.port;
  var hostGetterURI = URIProto.hostname;
  URIProto.protocol = function (protoValURI, protoBuildURI) {
    if (protoValURI && !(protoValURI = protoValURI.replace(/:(\/\/)?$/, "")).match(URI_JS.protocol_expression)) {
      throw new TypeError("Protocol \"" + protoValURI + "\" contains characters other than [A-Z0-9.+-] or doesn't start with [A-Z]");
    }
    return protoGetterURI.call(this, protoValURI, protoBuildURI);
  };
  URIProto.scheme = URIProto.protocol;
  URIProto.port = function (portValURI, portBuildURI) {
    if (this._parts.urn) {
      if (portValURI === undefined) {
        return "";
      } else {
        return this;
      }
    } else {
      if (portValURI !== undefined && (portValURI = portValURI === 0 ? null : portValURI)) {
        if ((portValURI += "").charAt(0) === ":") {
          portValURI = portValURI.substring(1);
        }
        URI_JS.ensureValidPort(portValURI);
      }
      return portGetterURI.call(this, portValURI, portBuildURI);
    }
  };
  URIProto.hostname = function (hostValURI, hostBuildURI) {
    if (this._parts.urn) {
      if (hostValURI === undefined) {
        return "";
      } else {
        return this;
      }
    }
    if (hostValURI !== undefined) {
      var hostParsePartsURI = {
        preventInvalidHostname: this._parts.preventInvalidHostname
      };
      if (URI_JS.parseHost(hostValURI, hostParsePartsURI) !== "/") {
        throw new TypeError("Hostname \"" + hostValURI + "\" contains characters other than [A-Z0-9.-]");
      }
      hostValURI = hostParsePartsURI.hostname;
      if (this._parts.preventInvalidHostname) {
        URI_JS.ensureValidHostname(hostValURI, this._parts.protocol);
      }
    }
    return hostGetterURI.call(this, hostValURI, hostBuildURI);
  };
  URIProto.origin = function (originValURI, originBuildURI) {
    var originURIRef;
    if (this._parts.urn) {
      if (originValURI === undefined) {
        return "";
      } else {
        return this;
      }
    } else if (originValURI === undefined) {
      originURIRef = this.protocol();
      if (this.authority()) {
        return (originURIRef ? originURIRef + "://" : "") + this.authority();
      } else {
        return "";
      }
    } else {
      originURIRef = URI_JS(originValURI);
      this.protocol(originURIRef.protocol()).authority(originURIRef.authority()).build(!originBuildURI);
      return this;
    }
  };
  URIProto.host = function (authHostValURI, authHostBuildURI) {
    if (this._parts.urn) {
      if (authHostValURI === undefined) {
        return "";
      } else {
        return this;
      }
    }
    if (authHostValURI === undefined) {
      if (this._parts.hostname) {
        return URI_JS.buildHost(this._parts);
      } else {
        return "";
      }
    }
    if (URI_JS.parseHost(authHostValURI, this._parts) !== "/") {
      throw new TypeError("Hostname \"" + authHostValURI + "\" contains characters other than [A-Z0-9.-]");
    }
    this.build(!authHostBuildURI);
    return this;
  };
  URIProto.authority = function (authValURI, authBuildURI) {
    if (this._parts.urn) {
      if (authValURI === undefined) {
        return "";
      } else {
        return this;
      }
    }
    if (authValURI === undefined) {
      if (this._parts.hostname) {
        return URI_JS.buildAuthority(this._parts);
      } else {
        return "";
      }
    }
    if (URI_JS.parseAuthority(authValURI, this._parts) !== "/") {
      throw new TypeError("Hostname \"" + authValURI + "\" contains characters other than [A-Z0-9.-]");
    }
    this.build(!authBuildURI);
    return this;
  };
  URIProto.userinfo = function (uiValURI, uiBuildURI) {
    var uiStrURI;
    if (this._parts.urn) {
      if (uiValURI === undefined) {
        return "";
      } else {
        return this;
      }
    } else if (uiValURI === undefined) {
      return (uiStrURI = URI_JS.buildUserinfo(this._parts)) && uiStrURI.substring(0, uiStrURI.length - 1);
    } else {
      if (uiValURI[uiValURI.length - 1] !== "@") {
        uiValURI += "@";
      }
      URI_JS.parseUserinfo(uiValURI, this._parts);
      this.build(!uiBuildURI);
      return this;
    }
  };
  URIProto.resource = function (resValURI, resBuildURI) {
    if (resValURI === undefined) {
      return this.path() + this.search() + this.hash();
    } else {
      resValURI = URI_JS.parse(resValURI);
      this._parts.path = resValURI.path;
      this._parts.query = resValURI.query;
      this._parts.fragment = resValURI.fragment;
      this.build(!resBuildURI);
      return this;
    }
  };
  URIProto.subdomain = function (subdValURI, subdBuildURI) {
    if (this._parts.urn) {
      if (subdValURI === undefined) {
        return "";
      } else {
        return this;
      }
    }
    if (subdValURI === undefined) {
      return this._parts.hostname && !this.is("IP") && (subdMatchURI = this._parts.hostname.length - this.domain().length - 1, this._parts.hostname.substring(0, subdMatchURI)) || "";
    }
    var subdMatchURI = this._parts.hostname.length - this.domain().length;
    var subdMatchURI = this._parts.hostname.substring(0, subdMatchURI);
    var subdMatchURI = new RegExp("^" + subdMatchURI.replace(/([.*+?^=!:${}()|[\]\/\\])/g, "\\$1"));
    if (subdValURI && subdValURI.charAt(subdValURI.length - 1) !== ".") {
      subdValURI += ".";
    }
    if (subdValURI.indexOf(":") !== -1) {
      throw new TypeError("Domains cannot contain colons");
    }
    if (subdValURI) {
      URI_JS.ensureValidHostname(subdValURI, this._parts.protocol);
    }
    this._parts.hostname = this._parts.hostname.replace(subdMatchURI, subdValURI);
    this.build(!subdBuildURI);
    return this;
  };
  URIProto.domain = function (domValURI, domBuildURI) {
    if (this._parts.urn) {
      if (domValURI === undefined) {
        return "";
      } else {
        return this;
      }
    }
    var domMatchURI;
    if (typeof domValURI == "boolean") {
      domBuildURI = domValURI;
      domValURI = undefined;
    }
    if (domValURI === undefined) {
      if (!this._parts.hostname || this.is("IP")) {
        return "";
      } else if ((domMatchURI = this._parts.hostname.match(/\./g)) && domMatchURI.length < 2) {
        return this._parts.hostname;
      } else {
        domMatchURI = this._parts.hostname.length - this.tld(domBuildURI).length - 1;
        domMatchURI = this._parts.hostname.lastIndexOf(".", domMatchURI - 1) + 1;
        return this._parts.hostname.substring(domMatchURI) || "";
      }
    }
    if (!domValURI) {
      throw new TypeError("cannot set domain empty");
    }
    if (domValURI.indexOf(":") !== -1) {
      throw new TypeError("Domains cannot contain colons");
    }
    URI_JS.ensureValidHostname(domValURI, this._parts.protocol);
    if (!this._parts.hostname || this.is("IP")) {
      this._parts.hostname = domValURI;
    } else {
      domMatchURI = new RegExp(this.domain().replace(/([.*+?^=!:${}()|[\]\/\\])/g, "\\$1") + "$");
      this._parts.hostname = this._parts.hostname.replace(domMatchURI, domValURI);
    }
    this.build(!domBuildURI);
    return this;
  };
  URIProto.tld = function (tldValURI, tldBuildURI) {
    if (this._parts.urn) {
      if (tldValURI === undefined) {
        return "";
      } else {
        return this;
      }
    }
    var tldMatchURI;
    if (typeof tldValURI == "boolean") {
      tldBuildURI = tldValURI;
      tldValURI = undefined;
    }
    if (tldValURI === undefined) {
      if (!this._parts.hostname || this.is("IP")) {
        return "";
      } else {
        tldMatchURI = this._parts.hostname.lastIndexOf(".");
        tldMatchURI = this._parts.hostname.substring(tldMatchURI + 1);
        return tldBuildURI !== true && sldLib && sldLib.list[tldMatchURI.toLowerCase()] && sldLib.get(this._parts.hostname) || tldMatchURI;
      }
    }
    if (!tldValURI) {
      throw new TypeError("cannot set TLD empty");
    }
    if (tldValURI.match(/[^a-zA-Z0-9-]/)) {
      if (!sldLib || !sldLib.is(tldValURI)) {
        throw new TypeError("TLD \"" + tldValURI + "\" contains characters other than [A-Z0-9]");
      }
    } else if (!this._parts.hostname || this.is("IP")) {
      throw new ReferenceError("cannot set TLD on non-domain host");
    }
    tldMatchURI = new RegExp(this.tld().replace(/([.*+?^=!:${}()|[\]\/\\])/g, "\\$1") + "$");
    this._parts.hostname = this._parts.hostname.replace(tldMatchURI, tldValURI);
    this.build(!tldBuildURI);
    return this;
  };
  URIProto.directory = function (dirValURI, dirBuildURI) {
    var dirMatchURI;
    if (this._parts.urn) {
      if (dirValURI === undefined) {
        return "";
      } else {
        return this;
      }
    } else if (dirValURI === undefined || dirValURI === true) {
      if (this._parts.path || this._parts.hostname) {
        if (this._parts.path === "/") {
          return "/";
        } else {
          dirMatchURI = this._parts.path.length - this.filename().length - 1;
          dirMatchURI = this._parts.path.substring(0, dirMatchURI) || (this._parts.hostname ? "/" : "");
          if (dirValURI) {
            return URI_JS.decodePath(dirMatchURI);
          } else {
            return dirMatchURI;
          }
        }
      } else {
        return "";
      }
    } else {
      dirMatchURI = this._parts.path.length - this.filename().length;
      dirMatchURI = this._parts.path.substring(0, dirMatchURI);
      dirMatchURI = new RegExp("^" + dirMatchURI.replace(/([.*+?^=!:${}()|[\]\/\\])/g, "\\$1"));
      if (!this.is("relative")) {
        if ((dirValURI = dirValURI || "/").charAt(0) !== "/") {
          dirValURI = "/" + dirValURI;
        }
      }
      if (dirValURI && dirValURI.charAt(dirValURI.length - 1) !== "/") {
        dirValURI += "/";
      }
      dirValURI = URI_JS.recodePath(dirValURI);
      this._parts.path = this._parts.path.replace(dirMatchURI, dirValURI);
      this.build(!dirBuildURI);
      return this;
    }
  };
  URIProto.filename = function (fileValURI, fileBuildURI) {
    var fileMatchURI;
    var fileRegExpURI;
    if (this._parts.urn) {
      if (fileValURI === undefined) {
        return "";
      } else {
        return this;
      }
    } else if (typeof fileValURI != "string") {
      if (this._parts.path && this._parts.path !== "/") {
        fileMatchURI = this._parts.path.lastIndexOf("/");
        fileMatchURI = this._parts.path.substring(fileMatchURI + 1);
        if (fileValURI) {
          return URI_JS.decodePathSegment(fileMatchURI);
        } else {
          return fileMatchURI;
        }
      } else {
        return "";
      }
    } else {
      fileMatchURI = false;
      if ((fileValURI = fileValURI.charAt(0) === "/" ? fileValURI.substring(1) : fileValURI).match(/\.?\//)) {
        fileMatchURI = true;
      }
      fileRegExpURI = new RegExp(this.filename().replace(/([.*+?^=!:${}()|[\]\/\\])/g, "\\$1") + "$");
      fileValURI = URI_JS.recodePath(fileValURI);
      this._parts.path = this._parts.path.replace(fileRegExpURI, fileValURI);
      if (fileMatchURI) {
        this.normalizePath(fileBuildURI);
      } else {
        this.build(!fileBuildURI);
      }
      return this;
    }
  };
  URIProto.suffix = function (sufValURI, sufBuildURI) {
    if (this._parts.urn) {
      if (sufValURI === undefined) {
        return "";
      } else {
        return this;
      }
    }
    var sufIdxURI;
    if (sufValURI === undefined || sufValURI === true) {
      if (!this._parts.path || this._parts.path === "/" || (sufIdxURI = (sufMatchURI = this.filename()).lastIndexOf(".")) === -1) {
        return "";
      } else {
        sufMatchURI = sufMatchURI.substring(sufIdxURI + 1);
        sufIdxURI = /^[a-z0-9%]+$/i.test(sufMatchURI) ? sufMatchURI : "";
        if (sufValURI) {
          return URI_JS.decodePathSegment(sufIdxURI);
        } else {
          return sufIdxURI;
        }
      }
    }
    if (sufValURI.charAt(0) === ".") {
      sufValURI = sufValURI.substring(1);
    }
    var sufRegExpURI;
    var sufMatchURI = this.suffix();
    if (sufMatchURI) {
      sufRegExpURI = sufValURI ? new RegExp(sufMatchURI.replace(/([.*+?^=!:${}()|[\]\/\\])/g, "\\$1") + "$") : new RegExp(("." + sufMatchURI).replace(/([.*+?^=!:${}()|[\]\/\\])/g, "\\$1") + "$");
    } else {
      if (!sufValURI) {
        return this;
      }
      this._parts.path += "." + URI_JS.recodePath(sufValURI);
    }
    if (sufRegExpURI) {
      sufValURI = URI_JS.recodePath(sufValURI);
      this._parts.path = this._parts.path.replace(sufRegExpURI, sufValURI);
    }
    this.build(!sufBuildURI);
    return this;
  };
  URIProto.segment = function (segIdxURI, segValURI, segBuildURI) {
    var segSepURI = this._parts.urn ? ":" : "/";
    var segPathURI = this.path();
    var segAbsURI = segPathURI.substring(0, 1) === "/";
    var segPartsURI = segPathURI.split(segSepURI);
    if (segIdxURI !== undefined && typeof segIdxURI != "number") {
      segBuildURI = segValURI;
      segValURI = segIdxURI;
      segIdxURI = undefined;
    }
    if (segIdxURI !== undefined && typeof segIdxURI != "number") {
      throw new Error("Bad segment \"" + segIdxURI + "\", must be 0-based integer");
    }
    if (segAbsURI) {
      segPartsURI.shift();
    }
    if (segIdxURI < 0) {
      segIdxURI = Math.max(segPartsURI.length + segIdxURI, 0);
    }
    if (segValURI === undefined) {
      if (segIdxURI === undefined) {
        return segPartsURI;
      } else {
        return segPartsURI[segIdxURI];
      }
    }
    if (segIdxURI === null || segPartsURI[segIdxURI] === undefined) {
      if ((segValURI === undefined ? "Undefined" : String(Object.prototype.toString.call(segValURI)).slice(8, -1)) === "Array") {
        var segPartsURI = [];
        var segIterURI = 0;
        for (var segLenURI = segValURI.length; segIterURI < segLenURI; segIterURI++) {
          if (segValURI[segIterURI].length || segPartsURI.length && segPartsURI[segPartsURI.length - 1].length) {
            if (segPartsURI.length && !segPartsURI[segPartsURI.length - 1].length) {
              segPartsURI.pop();
            }
            segPartsURI.push(segValURI[segIterURI].replace(/^\/+|\/+$/g, ""));
          }
        }
      } else if (!!segValURI || typeof segValURI == "string") {
        segValURI = segValURI.replace(/^\/+|\/+$/g, "");
        if (segPartsURI[segPartsURI.length - 1] === "") {
          segPartsURI[segPartsURI.length - 1] = segValURI;
        } else {
          segPartsURI.push(segValURI);
        }
      }
    } else if (segValURI) {
      segPartsURI[segIdxURI] = segValURI.replace(/^\/+|\/+$/g, "");
    } else {
      segPartsURI.splice(segIdxURI, 1);
    }
    if (segAbsURI) {
      segPartsURI.unshift("");
    }
    return this.path(segPartsURI.join(segSepURI), segBuildURI);
  };
  URIProto.segmentCoded = function (segCIdxURI, segCValURI, segCBuildURI) {
    var segCRetURI;
    var segCIterURI;
    var segCLenURI;
    if (typeof segCIdxURI != "number") {
      segCBuildURI = segCValURI;
      segCValURI = segCIdxURI;
      segCIdxURI = undefined;
    }
    if (segCValURI === undefined) {
      if (((segCRetURI = this.segment(segCIdxURI, segCValURI, segCBuildURI)) === undefined ? "Undefined" : String(Object.prototype.toString.call(segCRetURI = this.segment(segCIdxURI, segCValURI, segCBuildURI))).slice(8, -1)) === "Array") {
        segCIterURI = 0;
        for (segCLenURI = segCRetURI.length; segCIterURI < segCLenURI; segCIterURI++) {
          segCRetURI[segCIterURI] = URI_JS.decode(segCRetURI[segCIterURI]);
        }
      } else {
        segCRetURI = segCRetURI !== undefined ? URI_JS.decode(segCRetURI) : undefined;
      }
      return segCRetURI;
    }
    if ((segCValURI === undefined ? "Undefined" : String(Object.prototype.toString.call(segCValURI)).slice(8, -1)) === "Array") {
      segCIterURI = 0;
      for (segCLenURI = segCValURI.length; segCIterURI < segCLenURI; segCIterURI++) {
        segCValURI[segCIterURI] = URI_JS.encode(segCValURI[segCIterURI]);
      }
    } else {
      segCValURI = typeof segCValURI == "string" || segCValURI instanceof String ? URI_JS.encode(segCValURI) : segCValURI;
    }
    return this.segment(segCIdxURI, segCValURI, segCBuildURI);
  };
  var queryGetterURI = URIProto.query;
  URIProto.query = function (qSetValURI, qSetBuildURI) {
    var qSetObjURI;
    var qSetRetURI;
    if (qSetValURI === true) {
      return URI_JS.parseQuery(this._parts.query, this._parts.escapeQuerySpace);
    } else if (typeof qSetValURI == "function") {
      qSetObjURI = URI_JS.parseQuery(this._parts.query, this._parts.escapeQuerySpace);
      qSetRetURI = qSetValURI.call(this, qSetObjURI);
      this._parts.query = URI_JS.buildQuery(qSetRetURI || qSetObjURI, this._parts.duplicateQueryParameters, this._parts.escapeQuerySpace);
      this.build(!qSetBuildURI);
      return this;
    } else if (qSetValURI !== undefined && typeof qSetValURI != "string") {
      this._parts.query = URI_JS.buildQuery(qSetValURI, this._parts.duplicateQueryParameters, this._parts.escapeQuerySpace);
      this.build(!qSetBuildURI);
      return this;
    } else {
      return queryGetterURI.call(this, qSetValURI, qSetBuildURI);
    }
  };
  URIProto.setQuery = function (sqKeyURI, sqValURI, sqBuildURI) {
    var sqObjURI = URI_JS.parseQuery(this._parts.query, this._parts.escapeQuerySpace);
    if (typeof sqKeyURI == "string" || sqKeyURI instanceof String) {
      sqObjURI[sqKeyURI] = sqValURI !== undefined ? sqValURI : null;
    } else {
      if (typeof sqKeyURI != "object") {
        throw new TypeError("URI.addQuery() accepts an object, string as the name parameter");
      }
      for (var sqIterURI in sqKeyURI) {
        if (hasOwnPropertyRef.call(sqKeyURI, sqIterURI)) {
          sqObjURI[sqIterURI] = sqKeyURI[sqIterURI];
        }
      }
    }
    this._parts.query = URI_JS.buildQuery(sqObjURI, this._parts.duplicateQueryParameters, this._parts.escapeQuerySpace);
    this.build(!(sqBuildURI = typeof sqKeyURI != "string" ? sqValURI : sqBuildURI));
    return this;
  };
  URIProto.addQuery = function (aqKeyURI, aqValURI, aqBuildURI) {
    var aqObjURI = URI_JS.parseQuery(this._parts.query, this._parts.escapeQuerySpace);
    URI_JS.addQuery(aqObjURI, aqKeyURI, aqValURI === undefined ? null : aqValURI);
    this._parts.query = URI_JS.buildQuery(aqObjURI, this._parts.duplicateQueryParameters, this._parts.escapeQuerySpace);
    this.build(!(aqBuildURI = typeof aqKeyURI != "string" ? aqValURI : aqBuildURI));
    return this;
  };
  URIProto.removeQuery = function (rqKeyURI, rqValURI, rqBuildURI) {
    var rqObjURI = URI_JS.parseQuery(this._parts.query, this._parts.escapeQuerySpace);
    URI_JS.removeQuery(rqObjURI, rqKeyURI, rqValURI);
    this._parts.query = URI_JS.buildQuery(rqObjURI, this._parts.duplicateQueryParameters, this._parts.escapeQuerySpace);
    this.build(!(rqBuildURI = typeof rqKeyURI != "string" ? rqValURI : rqBuildURI));
    return this;
  };
  URIProto.hasQuery = function (hqKeyURI, hqValURI, hqStrictURI) {
    var hqObjURI = URI_JS.parseQuery(this._parts.query, this._parts.escapeQuerySpace);
    return URI_JS.hasQuery(hqObjURI, hqKeyURI, hqValURI, hqStrictURI);
  };
  URIProto.setSearch = URIProto.setQuery;
  URIProto.addSearch = URIProto.addQuery;
  URIProto.removeSearch = URIProto.removeQuery;
  URIProto.hasSearch = URIProto.hasQuery;
  URIProto.normalize = function () {
    return (this._parts.urn ? this.normalizeProtocol(false) : this.normalizeProtocol(false).normalizeHostname(false).normalizePort(false)).normalizePath(false).normalizeQuery(false).normalizeFragment(false).build();
  };
  URIProto.normalizeProtocol = function (normProtoBuildURI) {
    if (typeof this._parts.protocol == "string") {
      this._parts.protocol = this._parts.protocol.toLowerCase();
      this.build(!normProtoBuildURI);
    }
    return this;
  };
  URIProto.normalizeHostname = function (normHostBuildURI) {
    if (this._parts.hostname) {
      if (this.is("IDN") && punycodeLib) {
        this._parts.hostname = punycodeLib.toASCII(this._parts.hostname);
      } else if (this.is("IPv6") && ipv6Lib) {
        this._parts.hostname = ipv6Lib.best(this._parts.hostname);
      }
      this._parts.hostname = this._parts.hostname.toLowerCase();
      this.build(!normHostBuildURI);
    }
    return this;
  };
  URIProto.normalizePort = function (normPortBuildURI) {
    if (typeof this._parts.protocol == "string" && this._parts.port === URI_JS.defaultPorts[this._parts.protocol]) {
      this._parts.port = null;
      this.build(!normPortBuildURI);
    }
    return this;
  };
  URIProto.normalizePath = function (normPathBuildURI) {
    if (normPathURI = this._parts.path) {
      if (this._parts.urn) {
        this._parts.path = URI_JS.recodeUrnPath(this._parts.path);
        this.build(!normPathBuildURI);
      } else if (this._parts.path !== "/") {
        var normAbsURI;
        var normPathURI;
        var normIdxURI;
        var normPrevIdxURI;
        var normPreSlashURI = "";
        if ((normPathURI = URI_JS.recodePath(normPathURI)).charAt(0) !== "/") {
          normAbsURI = true;
          normPathURI = "/" + normPathURI;
        }
        if (normPathURI.slice(-3) === "/.." || normPathURI.slice(-2) === "/.") {
          normPathURI += "/";
        }
        normPathURI = normPathURI.replace(/(\/(\.\/)+)|(\/\.$)/g, "/").replace(/\/{2,}/g, "/");
        for (normAbsURI && (normPreSlashURI = (normPreSlashURI = normPathURI.substring(1).match(/^(\.\.\/)+/) || "") && normPreSlashURI[0]);;) {
          if ((normIdxURI = normPathURI.search(/\/\.\.(\/|$)/)) === -1) {
            break;
          }
          if (normIdxURI === 0) {
            normPathURI = normPathURI.substring(3);
          } else {
            if ((normPrevIdxURI = normPathURI.substring(0, normIdxURI).lastIndexOf("/")) === -1) {
              normPrevIdxURI = normIdxURI;
            }
            normPathURI = normPathURI.substring(0, normPrevIdxURI) + normPathURI.substring(normIdxURI + 3);
          }
        }
        if (normAbsURI && this.is("relative")) {
          normPathURI = normPreSlashURI + normPathURI.substring(1);
        }
        this._parts.path = normPathURI;
        this.build(!normPathBuildURI);
      }
    }
    return this;
  };
  URIProto.normalizePathname = URIProto.normalizePath;
  URIProto.normalizeQuery = function (normQueryBuildURI) {
    if (typeof this._parts.query == "string") {
      if (this._parts.query.length) {
        this.query(URI_JS.parseQuery(this._parts.query, this._parts.escapeQuerySpace));
      } else {
        this._parts.query = null;
      }
      this.build(!normQueryBuildURI);
    }
    return this;
  };
  URIProto.normalizeFragment = function (normFragBuildURI) {
    if (!this._parts.fragment) {
      this._parts.fragment = null;
      this.build(!normFragBuildURI);
    }
    return this;
  };
  URIProto.normalizeSearch = URIProto.normalizeQuery;
  URIProto.normalizeHash = URIProto.normalizeFragment;
  URIProto.iso8859 = function () {
    var isoEncodeURI = URI_JS.encode;
    var isoDecodeURI = URI_JS.decode;
    URI_JS.encode = escape;
    URI_JS.decode = decodeURIComponent;
    try {
      this.normalize();
    } finally {
      URI_JS.encode = isoEncodeURI;
      URI_JS.decode = isoDecodeURI;
    }
    return this;
  };
  URIProto.unicode = function () {
    var uniEncodeURI = URI_JS.encode;
    var uniDecodeURI = URI_JS.decode;
    URI_JS.encode = strictEncodeURIComponent;
    URI_JS.decode = unescape;
    try {
      this.normalize();
    } finally {
      URI_JS.encode = uniEncodeURI;
      URI_JS.decode = uniDecodeURI;
    }
    return this;
  };
  URIProto.readable = function () {
    var readCloneURI = this.clone();
    readCloneURI.username("").password("").normalize();
    var readStrURI = "";
    if (readCloneURI._parts.protocol) {
      readStrURI += readCloneURI._parts.protocol + "://";
    }
    if (readCloneURI._parts.hostname) {
      if (readCloneURI.is("punycode") && punycodeLib) {
        readStrURI += punycodeLib.toUnicode(readCloneURI._parts.hostname);
        if (readCloneURI._parts.port) {
          readStrURI += ":" + readCloneURI._parts.port;
        }
      } else {
        readStrURI += readCloneURI.host();
      }
    }
    if (readCloneURI._parts.hostname && readCloneURI._parts.path && readCloneURI._parts.path.charAt(0) !== "/") {
      readStrURI += "/";
    }
    readStrURI += readCloneURI.path(true);
    if (readCloneURI._parts.query) {
      var readQStrURI = "";
      var readQIdxURI = 0;
      var readQPairsURI = readCloneURI._parts.query.split("&");
      for (var readQLenURI = readQPairsURI.length; readQIdxURI < readQLenURI; readQIdxURI++) {
        var readQPairURI = (readQPairsURI[readQIdxURI] || "").split("=");
        readQStrURI += "&" + URI_JS.decodeQuery(readQPairURI[0], this._parts.escapeQuerySpace).replace(/&/g, "%26");
        if (readQPairURI[1] !== undefined) {
          readQStrURI += "=" + URI_JS.decodeQuery(readQPairURI[1], this._parts.escapeQuerySpace).replace(/&/g, "%26");
        }
      }
      readStrURI += "?" + readQStrURI.substring(1);
    }
    return readStrURI += URI_JS.decodeQuery(readCloneURI.hash(), true);
  };
  URIProto.absoluteTo = function (absURIRef) {
    var absPathURI;
    var absIdxURI;
    var absKeyURI;
    var absCloneURI = this.clone();
    var absPartsURI = ["protocol", "username", "password", "hostname", "port"];
    if (this._parts.urn) {
      throw new Error("URNs do not have any generally defined hierarchical components");
    }
    if (!(absURIRef instanceof URI_JS)) {
      absURIRef = new URI_JS(absURIRef);
    }
    if (!absCloneURI._parts.protocol && (absCloneURI._parts.protocol = absURIRef._parts.protocol, !this._parts.hostname)) {
      for (absIdxURI = 0; absKeyURI = absPartsURI[absIdxURI]; absIdxURI++) {
        absCloneURI._parts[absKeyURI] = absURIRef._parts[absKeyURI];
      }
      if (absCloneURI._parts.path) {
        if (absCloneURI._parts.path.substring(-2) === "..") {
          absCloneURI._parts.path += "/";
        }
        if (absCloneURI.path().charAt(0) !== "/") {
          absPathURI = absURIRef.directory() || (absURIRef.path().indexOf("/") === 0 ? "/" : "");
          absCloneURI._parts.path = (absPathURI ? absPathURI + "/" : "") + absCloneURI._parts.path;
          absCloneURI.normalizePath();
        }
      } else {
        absCloneURI._parts.path = absURIRef._parts.path;
        if (!absCloneURI._parts.query) {
          absCloneURI._parts.query = absURIRef._parts.query;
        }
      }
      absCloneURI.build();
    }
    return absCloneURI;
  };
  URIProto.relativeTo = function (relURIRef) {
    var relMyPartsURI;
    var relOtherPartsURI;
    var relMyPathURI;
    var relCloneURI = this.clone().normalize();
    if (relCloneURI._parts.urn) {
      throw new Error("URNs do not have any generally defined hierarchical components");
    }
    relURIRef = new URI_JS(relURIRef).normalize();
    relMyPartsURI = relCloneURI._parts;
    relOtherPartsURI = relURIRef._parts;
    relMyPathURI = relCloneURI.path();
    relURIRef = relURIRef.path();
    if (relMyPathURI.charAt(0) !== "/") {
      throw new Error("URI is already relative");
    }
    if (relURIRef.charAt(0) !== "/") {
      throw new Error("Cannot calculate a URI relative to another relative URI");
    }
    if (relMyPartsURI.protocol === relOtherPartsURI.protocol) {
      relMyPartsURI.protocol = null;
    }
    if (relMyPartsURI.username === relOtherPartsURI.username && relMyPartsURI.password === relOtherPartsURI.password && relMyPartsURI.protocol === null && relMyPartsURI.username === null && relMyPartsURI.password === null && relMyPartsURI.hostname === relOtherPartsURI.hostname && relMyPartsURI.port === relOtherPartsURI.port) {
      relMyPartsURI.hostname = null;
      relMyPartsURI.port = null;
      if (relMyPathURI === relURIRef) {
        relMyPartsURI.path = "";
      } else if (relMyPathURI = URI_JS.commonPath(relMyPathURI, relURIRef)) {
        relURIRef = relOtherPartsURI.path.substring(relMyPathURI.length).replace(/[^\/]*$/, "").replace(/.*?\//g, "../");
        relMyPartsURI.path = relURIRef + relMyPartsURI.path.substring(relMyPathURI.length) || "./";
      }
    }
    return relCloneURI.build();
  };
  URIProto.equals = function (eqURIRef) {
    var eqMyQURI;
    var eqOtherQURI;
    var eqMyQStrURI;
    var eqOtherQStrURI;
    var eqIterURI;
    var eqCloneURI = this.clone();
    var eqURIRef = new URI_JS(eqURIRef);
    var eqCacheURI = {};
    eqCloneURI.normalize();
    eqURIRef.normalize();
    if (eqCloneURI.toString() !== eqURIRef.toString()) {
      eqMyQStrURI = eqCloneURI.query();
      eqOtherQStrURI = eqURIRef.query();
      eqCloneURI.query("");
      eqURIRef.query("");
      if (eqCloneURI.toString() !== eqURIRef.toString()) {
        return false;
      }
      if (eqMyQStrURI.length !== eqOtherQStrURI.length) {
        return false;
      }
      eqMyQURI = URI_JS.parseQuery(eqMyQStrURI, this._parts.escapeQuerySpace);
      eqOtherQURI = URI_JS.parseQuery(eqOtherQStrURI, this._parts.escapeQuerySpace);
      for (eqIterURI in eqMyQURI) {
        if (hasOwnPropertyRef.call(eqMyQURI, eqIterURI)) {
          if ((eqMyQURI[eqIterURI] === undefined ? "Undefined" : String(Object.prototype.toString.call(eqMyQURI[eqIterURI])).slice(8, -1)) === "Array") {
            if (!arraysEqual(eqMyQURI[eqIterURI], eqOtherQURI[eqIterURI])) {
              return false;
            }
          } else if (eqMyQURI[eqIterURI] !== eqOtherQURI[eqIterURI]) {
            return false;
          }
          eqCacheURI[eqIterURI] = true;
        }
      }
      for (eqIterURI in eqOtherQURI) {
        if (hasOwnPropertyRef.call(eqOtherQURI, eqIterURI) && !eqCacheURI[eqIterURI]) {
          return false;
        }
      }
    }
    return true;
  };
  URIProto.preventInvalidHostname = function (prevHostURI) {
    this._parts.preventInvalidHostname = !!prevHostURI;
    return this;
  };
  URIProto.duplicateQueryParameters = function (dupParamsURI) {
    this._parts.duplicateQueryParameters = !!dupParamsURI;
    return this;
  };
  URIProto.escapeQuerySpace = function (escSpaceURI) {
    this._parts.escapeQuerySpace = !!escSpaceURI;
    return this;
  };
  return URI_JS;
});
((b64Global, b64Factory) => {
  var existingBase64;
  var base64Obj;
  if (typeof exports == "object" && typeof module != "undefined") {
    module.exports = b64Factory();
  } else if (typeof define == "function" && define.amd) {
    define(b64Factory);
  } else {
    existingBase64 = b64Global.Base64;
    (base64Obj = b64Factory()).noConflict = function () {
      b64Global.Base64 = existingBase64;
      return base64Obj;
    };
    if (b64Global.Meteor) {
      Base64 = base64Obj;
    }
    b64Global.Base64 = base64Obj;
  }
})(typeof self != "undefined" ? self : typeof window != "undefined" ? window : typeof global != "undefined" ? global : this, function () {
  function b64ToSafe(b64StrArg) {
    return b64StrArg.replace(/=/g, "").replace(/[+\/]/g, function (b64MatchChar) {
      if (b64MatchChar == "+") {
        return "-";
      } else {
        return "_";
      }
    });
  }
  function btoaPolyfill(binStr) {
    var charC1;
    var charC2;
    var charC3;
    var b64ResStr = "";
    var padLenB64 = binStr.length % 3;
    for (var idxBin = 0; idxBin < binStr.length;) {
      if ((charC1 = binStr.charCodeAt(idxBin++)) > 255 || (charC2 = binStr.charCodeAt(idxBin++)) > 255 || (charC3 = binStr.charCodeAt(idxBin++)) > 255) {
        throw new TypeError("invalid character found");
      }
      b64ResStr += b64CharsArr[(charC1 = charC1 << 16 | charC2 << 8 | charC3) >> 18 & 63] + b64CharsArr[charC1 >> 12 & 63] + b64CharsArr[charC1 >> 6 & 63] + b64CharsArr[charC1 & 63];
    }
    if (padLenB64) {
      return b64ResStr.slice(0, padLenB64 - 3) + "===".substring(padLenB64);
    } else {
      return b64ResStr;
    }
  }
  function fromUint8Arr(u8ArrArg, urisafeFlag) {
    if (urisafeFlag = urisafeFlag === undefined ? false : urisafeFlag) {
      return b64ToSafe(utobProxy(u8ArrArg));
    } else {
      return utobProxy(u8ArrArg);
    }
  }
  function utf8ToBin(utf8Char) {
    var charCodeVal;
    if (utf8Char.length < 2) {
      if ((charCodeVal = utf8Char.charCodeAt(0)) < 128) {
        return utf8Char;
      } else if (charCodeVal < 2048) {
        return fromCodePointFn(charCodeVal >>> 6 | 192) + fromCodePointFn(charCodeVal & 63 | 128);
      } else {
        return fromCodePointFn(charCodeVal >>> 12 & 15 | 224) + fromCodePointFn(charCodeVal >>> 6 & 63 | 128) + fromCodePointFn(charCodeVal & 63 | 128);
      }
    } else {
      charCodeVal = 65536 + (utf8Char.charCodeAt(0) - 55296) * 1024 + (utf8Char.charCodeAt(1) - 56320);
      return fromCodePointFn(charCodeVal >>> 18 & 7 | 240) + fromCodePointFn(charCodeVal >>> 12 & 63 | 128) + fromCodePointFn(charCodeVal >>> 6 & 63 | 128) + fromCodePointFn(charCodeVal & 63 | 128);
    }
  }
  function utobFn(utf8StrInput) {
    return utf8StrInput.replace(utobRegExp, utf8ToBin);
  }
  function toBase64Fn(strB64Target, safeFlagB64) {
    if (safeFlagB64 = safeFlagB64 === undefined ? false : safeFlagB64) {
      return b64ToSafe(encodeProxy(strB64Target));
    } else {
      return encodeProxy(strB64Target);
    }
  }
  function encodeURIB64(strURIInput) {
    return toBase64Fn(strURIInput, true);
  }
  function binToUtf8(binCharMatch) {
    switch (binCharMatch.length) {
      case 4:
        var codePointVal = ((binCharMatch.charCodeAt(0) & 7) << 18 | (binCharMatch.charCodeAt(1) & 63) << 12 | (binCharMatch.charCodeAt(2) & 63) << 6 | binCharMatch.charCodeAt(3) & 63) - 65536;
        return fromCodePointFn(55296 + (codePointVal >>> 10)) + fromCodePointFn(56320 + (codePointVal & 1023));
      case 3:
        return fromCodePointFn((binCharMatch.charCodeAt(0) & 15) << 12 | (binCharMatch.charCodeAt(1) & 63) << 6 | binCharMatch.charCodeAt(2) & 63);
      default:
        return fromCodePointFn((binCharMatch.charCodeAt(0) & 31) << 6 | binCharMatch.charCodeAt(1) & 63);
    }
  }
  function btouFn(binStrInput2) {
    return binStrInput2.replace(btouRegExp, binToUtf8);
  }
  function atobPolyfill(b64StrAscii) {
    b64StrAscii = b64StrAscii.replace(/\s+/g, "");
    if (!b64RegExp.test(b64StrAscii)) {
      throw new TypeError("malformed base64.");
    }
    b64StrAscii += "==".slice(2 - (b64StrAscii.length & 3));
    var numB64;
    var c1B64Val;
    var c2B64Val;
    var binResStr = "";
    for (var idxB64Str = 0; idxB64Str < b64StrAscii.length;) {
      numB64 = b64Table[b64StrAscii.charAt(idxB64Str++)] << 18 | b64Table[b64StrAscii.charAt(idxB64Str++)] << 12 | (c1B64Val = b64Table[b64StrAscii.charAt(idxB64Str++)]) << 6 | (c2B64Val = b64Table[b64StrAscii.charAt(idxB64Str++)]);
      binResStr += c1B64Val === 64 ? fromCodePointFn(numB64 >> 16 & 255) : c2B64Val === 64 ? fromCodePointFn(numB64 >> 16 & 255, numB64 >> 8 & 255) : fromCodePointFn(numB64 >> 16 & 255, numB64 >> 8 & 255, numB64 & 255);
    }
    return binResStr;
  }
  function toUint8ArrFn(strU8Input) {
    return decodeU8Proxy(cleanBase64Str(strU8Input));
  }
  function cleanBase64Str(b64DirtyStr) {
    return b64DirtyStr.replace(/[-_]/g, function (charDirtyMatch) {
      if (charDirtyMatch == "-") {
        return "+";
      } else {
        return "/";
      }
    }).replace(/[^A-Za-z0-9\+\/]/g, "");
  }
  function fromBase64Fn(b64CleanStr) {
    return decodeProxy(cleanBase64Str(b64CleanStr));
  }
  function extendStringProto() {
    function defineStrProp(strPropName, strPropFn) {
      Object.defineProperty(String.prototype, strPropName, {
        value: strPropFn,
        enumerable: false,
        writable: true,
        configurable: true
      });
    }
    defineStrProp("fromBase64", function () {
      return decodeProxy(cleanBase64Str(this));
    });
    defineStrProp("toBase64", function (strPropArg) {
      return toBase64Fn(this, strPropArg);
    });
    defineStrProp("toBase64URI", function () {
      return toBase64Fn(this, true);
    });
    defineStrProp("toBase64URL", function () {
      return toBase64Fn(this, true);
    });
    defineStrProp("toUint8Array", function () {
      return decodeU8Proxy(cleanBase64Str(this));
    });
  }
  function extendUint8ArrProto() {
    function defineU8Prop(u8PropName, u8PropFn) {
      Object.defineProperty(Uint8Array.prototype, u8PropName, {
        value: u8PropFn,
        enumerable: false,
        writable: true,
        configurable: true
      });
    }
    defineU8Prop("toBase64", function (u8PropArg) {
      return fromUint8Arr(this, u8PropArg);
    });
    defineU8Prop("toBase64URI", function () {
      return fromUint8Arr(this, true);
    });
    defineU8Prop("toBase64URL", function () {
      return fromUint8Arr(this, true);
    });
  }
  var b64Table;
  var hasAtobNative = typeof atob == "function";
  var hasBtoaNative = typeof btoa == "function";
  var hasBufferNode = typeof Buffer == "function";
  var textDecoderInst = typeof TextDecoder == "function" ? new TextDecoder() : undefined;
  var textEncoderInst = typeof TextEncoder == "function" ? new TextEncoder() : undefined;
  var b64CharsArr = Array.prototype.slice.call("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=");
  b64Table = {};
  b64CharsArr.forEach(function (charMapKey, charMapIdx) {
    return b64Table[charMapKey] = charMapIdx;
  });
  var b64RegExp = /^(?:[A-Za-z\d+\/]{4})*?(?:[A-Za-z\d+\/]{2}(?:==)?|[A-Za-z\d+\/]{3}=?)?$/;
  var fromCodePointFn = String.fromCharCode.bind(String);
  var u8ArrBuilder = typeof Uint8Array.from == "function" ? Uint8Array.from.bind(Uint8Array) : function (argU8Arr) {
    return new Uint8Array(Array.prototype.slice.call(argU8Arr, 0));
  };
  var btoaProxy = hasBtoaNative ? function (argBtoaNative) {
    return btoa(argBtoaNative);
  } : hasBufferNode ? function (argBtoaBuffer) {
    return Buffer.from(argBtoaBuffer, "binary").toString("base64");
  } : btoaPolyfill;
  var utobProxy = hasBufferNode ? function (argUtobBuf) {
    return Buffer.from(argUtobBuf).toString("base64");
  } : function (argUtobStr) {
    var chunkArray = [];
    var chunkIdx = 0;
    for (var chunkLen = argUtobStr.length; chunkIdx < chunkLen; chunkIdx += 4096) {
      chunkArray.push(fromCodePointFn.apply(null, argUtobStr.subarray(chunkIdx, chunkIdx + 4096)));
    }
    return btoaProxy(chunkArray.join(""));
  };
  var utobRegExp = /[\uD800-\uDBFF][\uDC00-\uDFFFF]|[^\x00-\x7F]/g;
  var encodeProxy = hasBufferNode ? function (argEncBuf) {
    return Buffer.from(argEncBuf, "utf8").toString("base64");
  } : textEncoderInst ? function (argEncText) {
    return utobProxy(textEncoderInst.encode(argEncText));
  } : function (argEncMatch) {
    return btoaProxy(argEncMatch.replace(utobRegExp, utf8ToBin));
  };
  var btouRegExp = /[\xC0-\xDF][\x80-\xBF]|[\xE0-\xEF][\x80-\xBF]{2}|[\xF0-\xF7][\x80-\xBF]{3}/g;
  var atobProxy = hasAtobNative ? function (argAtobNative) {
    return atob(argAtobNative.replace(/[^A-Za-z0-9\+\/]/g, ""));
  } : hasBufferNode ? function (argAtobBuffer) {
    return Buffer.from(argAtobBuffer, "base64").toString("binary");
  } : atobPolyfill;
  var decodeU8Proxy = hasBufferNode ? function (argDecBuf) {
    return u8ArrBuilder(Buffer.from(argDecBuf, "base64"));
  } : function (argDecMap) {
    return u8ArrBuilder(atobProxy(argDecMap).split("").map(function (charDecMapped) {
      return charDecMapped.charCodeAt(0);
    }));
  };
  var decodeProxy = hasBufferNode ? function (argDecStrBuf) {
    return Buffer.from(argDecStrBuf, "base64").toString("utf8");
  } : textDecoderInst ? function (argDecStrText) {
    return textDecoderInst.decode(decodeU8Proxy(argDecStrText));
  } : function (argDecStrRep) {
    return atobProxy(argDecStrRep).replace(btouRegExp, binToUtf8);
  };
  var Base64Exports = {
    version: "3.7.5",
    VERSION: "3.7.5",
    atob: atobProxy,
    atobPolyfill: atobPolyfill,
    btoa: btoaProxy,
    btoaPolyfill: btoaPolyfill,
    fromBase64: fromBase64Fn,
    toBase64: toBase64Fn,
    encode: toBase64Fn,
    encodeURI: encodeURIB64,
    encodeURL: encodeURIB64,
    utob: utobFn,
    btou: btouFn,
    decode: fromBase64Fn,
    isValid: function (isValidArgCheck) {
      return typeof isValidArgCheck == "string" && (isValidArgCheck = isValidArgCheck.replace(/\s+/g, "").replace(/={0,2}$/, ""), !/[^\s0-9a-zA-Z\+/]/.test(isValidArgCheck) || !/[^\s0-9a-zA-Z\-_]/.test(isValidArgCheck));
    },
    fromUint8Array: fromUint8Arr,
    toUint8Array: toUint8ArrFn,
    extendString: extendStringProto,
    extendUint8Array: extendUint8ArrProto,
    extendBuiltins: function () {
      extendStringProto();
      extendUint8ArrProto();
    },
    Base64: {}
  };
  Object.keys(Base64Exports).forEach(function (exportKey) {
    return Base64Exports.Base64[exportKey] = Base64Exports[exportKey];
  });
  return Base64Exports;
});
__Cpn.prototype.initPostedMessageOverride = __Cpn.prototype.initPostedMessageOverride || function (windowObj, proxyInstance) {
  this.PostedMessageOverride = class {
    static create() {
      return new this();
    }
    constructor() {
      this.msgDataKey = "__data";
      this.msgOriginKey = "__origin";
    }
    applyPostMsgOrWindowOverrides() {
      let _thisRef = this;
      windowObj.__cpPreparePostMessageData = function (msgData) {
        var wrappedData;
        if ("Window" in windowObj) {
          (wrappedData = new windowObj.Object())[_thisRef.msgDataKey] = _thisRef.extractOrigData_ApplyCacheOverrides(msgData);
          wrappedData[_thisRef.msgOriginKey] = proxyInstance.proxyLocationRef.origin;
          return wrappedData;
        } else {
          return msgData;
        }
      };
      windowObj.__cpPreparePostMessageOrigin = function (targetOrigin) {
        if ("Window" in windowObj && (typeof targetOrigin == "string" || targetOrigin instanceof String)) {
          return "*";
        } else {
          return targetOrigin;
        }
      };
      function overrideDataGetter(originalData) {
        originalData = originalData();
        if (_thisRef.isProxyMessage(originalData)) {
          return originalData[_thisRef.msgDataKey];
        } else {
          return originalData;
        }
      }
      function overrideOriginGetter(originalOriginGetter) {
        var resolvedOrigin = this.__cpOriginalData;
        if (_thisRef.isProxyMessage(resolvedOrigin)) {
          return resolvedOrigin[_thisRef.msgOriginKey];
        } else if (this.source && this.source.location) {
          resolvedOrigin = this.source.location.href;
          resolvedOrigin = proxyInstance.Uri.create(resolvedOrigin).decodeProxyUrl();
          return new proxyInstance.URI(resolvedOrigin).origin();
        } else {
          return originalOriginGetter();
        }
      }
      if ("MessageEvent" in windowObj) {
        try {
          proxyInstance.overrideProperty(windowObj.MessageEvent.prototype, "data", overrideDataGetter, function () {});
        } catch (errMsgData) {
          proxyInstance.logError_CachePut(errMsgData);
        }
        try {
          proxyInstance.overrideProperty(windowObj.MessageEvent.prototype, "origin", overrideOriginGetter, function () {});
        } catch (errMsgOrigin) {
          proxyInstance.logError_CachePut(errMsgOrigin);
        }
      }
      if ("ExtendableMessageEvent" in windowObj) {
        try {
          proxyInstance.overrideProperty(windowObj.ExtendableMessageEvent.prototype, "data", overrideDataGetter, function () {});
        } catch (errExtData) {
          proxyInstance.logError_CachePut(errExtData);
        }
        try {
          proxyInstance.overrideProperty(windowObj.ExtendableMessageEvent.prototype, "origin", overrideOriginGetter, function () {});
        } catch (errExtOrigin) {
          proxyInstance.logError_CachePut(errExtOrigin);
        }
      }
      return this;
    }
    isProxyMessage(msgObj) {
      return !!msgObj && typeof msgObj == "object" && !!(this.msgDataKey in msgObj) && !!(this.msgOriginKey in msgObj);
    }
    extractOrigData_ApplyCacheOverrides(dataObj) {
      if (dataObj) {
        if (this.isProxyMessage(dataObj)) {
          return dataObj[this.msgDataKey];
        }
        if (windowObj.Array.isArray(dataObj)) {
          for (var msgIdx = 0; msgIdx < dataObj.length; msgIdx++) {
            if (this.isProxyMessage(dataObj[msgIdx])) {
              dataObj[msgIdx] = dataObj[msgIdx][this.msgDataKey];
            } else {
              this.extractOrigData_ApplyCacheOverrides(dataObj[msgIdx]);
            }
          }
        } else if (typeof dataObj == "object") {
          for (var msgKey in dataObj) {
            if (this.isProxyMessage(dataObj[msgKey])) {
              dataObj[msgKey] = dataObj[msgKey][this.msgDataKey];
            } else {
              this.extractOrigData_ApplyCacheOverrides(dataObj[msgKey]);
            }
          }
        }
      }
      return dataObj;
    }
  };
  return this;
};
__Cpn.prototype.initCpn = __Cpn.prototype.initCpn || function (globalWindow, hostNameVal, originUrlVal, proxyLocationObj) {
  var _thisCpn;
  var originalUriToString;
  var OriginalURIRef;
  this.proxyPrefix = "__cp";
  this.isProcessedFlag_CacheMatchAll = "__cpp";
  this.origPropPrefix_CacheMatch = "__cpOriginal";
  this.origValPrefix_CacheKeys = "__cpOriginalValueOf";
  this.originKey = "__cpo";
  this.configKey_CacheDelete = "__cpc";
  this.injectorPath = "/__cpi.php";
  this.shortName = "cp";
  this.typeProperty = "property";
  this.typeAttribute = "attribute";
  this.generatedFlag_CacheAddAll = "__cpGenerated";
  this.locationKey_CacheAdd = "__cpLocation";
  this.blacklistedUrls = new globalWindow.Array();
  this.uiElementsToHide = new globalWindow.Array("#__cpsHeaderZapper", "#__cpsFooter");
  this.globalWindowRef = globalWindow;
  this.hostNameRef = hostNameVal;
  this.originUrl_SetProxyOrigin = originUrlVal;
  this.proxyLocationRef = proxyLocationObj;
  originalUriToString = (_thisCpn = this).URI.prototype.toString;
  _thisCpn.URI.prototype.valueOf = _thisCpn.URI.prototype.toString = function () {
    return originalUriToString.call(this).replace(/##$/, "#");
  };
  OriginalURIRef = _thisCpn.URI;
  _thisCpn.URI = function (urlToParse, uriOptions) {
    if (!(urlToParse = (urlToParse += "").trim())) {
      return OriginalURIRef("", uriOptions);
    }
    let protocolMatch;
    var regexMatchResult = urlToParse.match(/^([a-z0-9+-.]+):\/\//i);
    if (!(protocolMatch = regexMatchResult && regexMatchResult[1] ? regexMatchResult[1] : protocolMatch) || !!protocolMatch.match(/^(http|https)/i)) {
      if ((urlToParse = urlToParse.replace(/(^[a-z]*:?)\/{3,}/i, "$1//")).match(/(%[^0-9a-f%])|(%$)/i)) {
        _thisCpn.logWarning("Invalid url " + urlToParse + " fixed");
        urlToParse = globalWindow.encodeURI(urlToParse);
      }
      if (urlToParse.match(/#$/)) {
        _thisCpn.logWarning("Empty hash " + urlToParse + " fixed");
        urlToParse += "#";
      }
    }
    return OriginalURIRef(urlToParse, uriOptions);
  };
  this.getPermalink = function () {
    if ("permalink" in this && this.permalink) {
      return this.permalink;
    }
    this.throwFatalError("No permalink defined for this window");
  };
  this.isDebugOrLocalhost = function () {
    return !!globalWindow.location && !!globalWindow.location.hostname && !!globalWindow.location.hostname.match(/(proxy|localhost|local)$/i) || !!this.debugMode;
  };
  this.logInfo = function (logMsg) {
    if (globalWindow.closed) {
      console.log("[CP CLOSED WINDOW]", logMsg);
    } else if (this.isDebugOrLocalhost()) {
      globalWindow.console.log("[CP]", logMsg);
    }
    return this;
  };
  this.logWarning = function (warnMsg) {
    var logPrefix;
    if (globalWindow.closed) {
      logPrefix = "[CP CLOSED WINDOW]";
      if (warnMsg instanceof Error) {
        console.warn(logPrefix, warnMsg.message);
        if (warnMsg.stack) {
          console.warn(warnMsg.stack);
        }
      } else {
        console.warn(logPrefix, warnMsg);
      }
    } else if (this.isDebugOrLocalhost()) {
      logPrefix = "[CP " + globalWindow.location.href + "]";
      if (warnMsg instanceof globalWindow.Error) {
        globalWindow.console.warn(logPrefix, warnMsg.message);
        if (warnMsg.stack) {
          globalWindow.console.warn(warnMsg.stack);
        }
      } else {
        globalWindow.console.warn(logPrefix, warnMsg);
      }
    }
    return this;
  };
  this.logError_CachePut = function (errorMsg) {
    return this.logWarning(errorMsg);
  };
  this.throwFatalError = function (fatalMsg) {
    throw new globalWindow.Error("[CP Error] " + fatalMsg);
  };
  this.logException = function (errorObj, contextMsg = "") {
    this.logWarning((contextMsg ? contextMsg + "; " : "") + errorObj.message);
    return this;
  };
  this.isInsideIframe = function () {
    try {
      return globalWindow.self !== globalWindow.top;
    } catch (errTopFrame) {
      return true;
    }
  };
  this.capitalize = function (strToCap) {
    return strToCap.charAt(0).toUpperCase() + strToCap.slice(1);
  };
  this.isDomElement = function (domObjCheck) {
    return domObjCheck instanceof globalWindow.Element;
  };
  this.isInDOMTree = function (elementCheck) {
    return this.isDomElement(elementCheck) && globalWindow.document.documentElement.contains(elementCheck);
  };
  this.generateHashCode = function (strToHash) {
    var iHash;
    var hashVal = 0;
    if (strToHash.length === 0) {
      return hashVal;
    }
    for (iHash = 0; iHash < strToHash.length; iHash++) {
      hashVal = (hashVal << 5) - hashVal + strToHash.charCodeAt(iHash);
      hashVal |= 0;
    }
    return Math.abs(hashVal);
  };
  this.concatAndCapitalize = function (prefixStr, suffixStr) {
    return prefixStr + this.capitalize(suffixStr);
  };
  this.buildProxyRequest = function (requestObj, baseUriArg = null) {
    if (Object.getOwnPropertyDescriptor(requestObj, "url")) {
      return Promise.resolve(requestObj);
    } else {
      return requestObj.blob().then(blobData => {
        var referrerStr = "";
        var reqUrlStr = requestObj.url;
        try {
          reqUrlStr = this.Uri.create(reqUrlStr).encodeProxyUrl_processElement(new globalWindow.Object(), baseUriArg);
        } catch (errReqParse) {
          this.logWarning(errReqParse.message + " (url)");
        }
        try {
          if (requestObj.referrer && (newRequestObj = this.Uri.create(requestObj.referrer)).getProxyQueryValue() !== "1") {
            referrerStr = newRequestObj.encodeProxyUrl_processElement(new globalWindow.Object(), baseUriArg);
          }
        } catch (errRefParse) {
          this.logWarning(errRefParse.message + " (referrer)");
        }
        var newRequestObj = new globalWindow.Request(reqUrlStr, new globalWindow.Object({
          method: requestObj.method,
          keepalive: requestObj.keepalive,
          headers: new Headers(requestObj.headers),
          mode: "cors",
          credentials: "include",
          cache: "default",
          redirect: requestObj.redirect,
          referrer: referrerStr,
          body: requestObj.method !== "GET" && requestObj.method !== "HEAD" ? blobData : undefined
        }));
        return Promise.resolve(newRequestObj);
      });
    }
  };
  this.overrideMethod = function (targetObj, methodName, proxyCallback, shouldPreserveOriginal = true, bindToTarget = false, isConstructor = false) {
    if (typeof targetObj != "object" && typeof targetObj != "function") {
      this.throwFatalError("No object to replace method " + methodName);
    }
    var originalMethodRef = targetObj[methodName];
    if (typeof originalMethodRef != "function") {
      this.throwFatalError("No method " + methodName + " defined in object " + targetObj.constructor.name);
    }
    if (shouldPreserveOriginal) {
      shouldPreserveOriginal = function () {
        if (isConstructor) {
          return new originalMethodRef(...arguments);
        } else {
          return originalMethodRef.apply(this, arguments);
        }
      };
      if (bindToTarget) {
        shouldPreserveOriginal = shouldPreserveOriginal.bind(targetObj);
      }
      targetObj[this.concatAndCapitalize(this.origPropPrefix_CacheMatch, methodName)] = shouldPreserveOriginal;
    }
    var shouldPreserveOriginal = function () {
      return proxyCallback.call(this, argsArrayB => isConstructor ? new originalMethodRef(...argsArrayB) : originalMethodRef.apply(this, argsArrayB), globalWindow.Array.from(arguments));
    };
    if (bindToTarget) {
      shouldPreserveOriginal = shouldPreserveOriginal.bind(targetObj);
    }
    targetObj[methodName] = shouldPreserveOriginal;
    Object.defineProperty(targetObj, "__cpn", {
      value: this,
      writable: false,
      configurable: false,
      enumerable: false
    });
    return targetObj.__cpn = this;
  };
  this.overrideProperty = function (targetObjV, propNameV, getterOverride, setterOverride, preserveOriginalV = true, isConfigurableV = false) {
    if (targetObjV instanceof globalWindow.Array) {
      var objDef;
      var descriptorArray = targetObjV;
      targetObjV = new globalWindow.Object();
      for (objDef of descriptorArray) {
        if (propNameV in objDef) {
          targetObjV = objDef;
          break;
        }
      }
    }
    if (typeof targetObjV != "object") {
      this.throwFatalError("No object to replace property " + propNameV);
    }
    if (!(propNameV in targetObjV)) {
      this.throwFatalError("No property " + propNameV + " defined in object " + targetObjV.constructor.name);
    }
    var originalDescriptor;
    var _thisContextV1;
    var originalGetAttribute;
    var _thisContextV2;
    var originalSetAttribute;
    var _thisContextV3;
    var descriptorArray = globalWindow.Object.getOwnPropertyDescriptor(targetObjV, propNameV);
    if (!descriptorArray || !descriptorArray.configurable) {
      this.throwFatalError("No configurable descriptor for object " + targetObjV.constructor.name + ", property " + propNameV);
    }
    var internalSetAttrFunc = (elemV, attrNameV, attrValueV) => {
      elemV[attrNameV] = attrValueV;
      if (this.isDomElement(elemV)) {
        elemV.setAttribute(attrNameV, attrValueV);
      }
      return this;
    };
    originalDescriptor = descriptorArray;
    _thisContextV1 = this;
    globalWindow.Object.defineProperty(targetObjV, propNameV, new globalWindow.Object({
      set: function (newVal) {
        internalSetAttrFunc(this, _thisContextV1.concatAndCapitalize(_thisContextV1.origValPrefix_CacheKeys, propNameV), newVal);
        setterOverride.call(this, valSet => {
          if (originalDescriptor.set) {
            originalDescriptor.set.call(this, valSet);
          }
        }, newVal, _thisContextV1.typeProperty);
      },
      get: function () {
        return getterOverride.call(this, () => originalDescriptor.get.call(this), _thisContextV1.typeProperty);
      },
      configurable: true,
      enumerable: true
    }));
    if (preserveOriginalV) {
      globalWindow.Object.defineProperty(targetObjV, this.concatAndCapitalize(this.origPropPrefix_CacheMatch, propNameV), new globalWindow.Object({
        set: function (fallbackNewVal) {
          if (originalDescriptor.set) {
            originalDescriptor.set.call(this, fallbackNewVal);
          }
        },
        get: function () {
          return originalDescriptor.get.call(this);
        },
        configurable: isConfigurableV,
        enumerable: false
      }));
    }
    propNameV = propNameV.toLowerCase();
    if ("Element" in globalWindow && targetObjV instanceof globalWindow.Element && typeof targetObjV.getAttribute == "function") {
      originalSetAttribute = targetObjV.setAttribute;
      _thisContextV3 = this;
      targetObjV.setAttribute = function (argAttrName, argAttrValue) {
        var lowerAttrName = argAttrName.toLowerCase();
        if (lowerAttrName === propNameV) {
          internalSetAttrFunc(this, _thisContextV3.concatAndCapitalize(_thisContextV3.origValPrefix_CacheKeys, propNameV), argAttrValue);
          setterOverride.call(this, valSetAttr => {
            originalSetAttribute.call(this, propNameV, valSetAttr);
          }, argAttrValue, _thisContextV3.typeAttribute);
        } else {
          if (preserveOriginalV && lowerAttrName === _thisContextV3.origPropPrefix_CacheMatch.toLowerCase() + propNameV) {
            argAttrName = propNameV;
          }
          originalSetAttribute.call(this, argAttrName, argAttrValue);
        }
      };
      originalGetAttribute = targetObjV.getAttribute;
      _thisContextV2 = this;
      targetObjV.getAttribute = function (argAttrNameGet) {
        var lowerAttrNameGet = argAttrNameGet.toLowerCase();
        if (lowerAttrNameGet === propNameV) {
          return getterOverride.call(this, () => originalGetAttribute.call(this, propNameV), _thisContextV2.typeAttribute);
        } else {
          if (preserveOriginalV && lowerAttrNameGet === _thisContextV2.origPropPrefix_CacheMatch.toLowerCase() + propNameV) {
            argAttrNameGet = propNameV;
          }
          return originalGetAttribute.call(this, argAttrNameGet);
        }
      };
    }
    Object.defineProperty(targetObjV, "__cpn", {
      value: this,
      writable: false,
      configurable: false,
      enumerable: false
    });
    return this;
  };
  this.generateTimestampId = function () {
    return Math.floor(Date.now() / 1000) + "." + Math.floor(Math.random() * 10000000000);
  };
  this.matchesSelector = function (domElementSel, selectorString) {
    var elemPrototype = globalWindow.Element.prototype;
    return (elemPrototype.matches || elemPrototype.matchesSelector || elemPrototype.webkitMatchesSelector || elemPrototype.mozMatchesSelector || elemPrototype.msMatchesSelector || elemPrototype.oMatchesSelector).call(domElementSel, selectorString);
  };
  this.encodeBase64Uri = function (strToEncode) {
    return globalWindow.encodeURIComponent(this.B64.encode(strToEncode));
  };
  this.decodeBase64Uri = function (strToDecode) {
    return globalWindow.decodeURIComponent(this.B64.decode(strToDecode));
  };
  this.getPageTitle = function () {
    if (globalWindow.document.title.length > 256) {
      return globalWindow.document.title.substring(0, 256) + "...";
    } else {
      return globalWindow.document.title;
    }
  };
  this.getPageDescription = function () {
    var metaElem = globalWindow.document.querySelector("meta[name=\"description\"]");
    if (metaElem) {
      metaElem = metaElem.getAttribute("content");
      if (metaElem) {
        if (metaElem.length > 256) {
          return metaElem.substring(0, 256) + "...";
        } else {
          return metaElem;
        }
      }
    }
    return "";
  };
  this.isEventTrusted = function (eventObj) {
    return eventObj.isTrusted;
  };
  this.getRandomArrayItem = function (arrayObjRand) {
    return arrayObjRand[Math.floor(Math.random() * arrayObjRand.length)];
  };
  this.resolveProxyUrl = function (urlStrProxy = null) {
    let resolvedUrlProxy;
    if (urlStrProxy) {
      (resolvedUrlProxy = this.URI(urlStrProxy)).origin(this.originUrl_SetProxyOrigin);
      return resolvedUrlProxy.toString();
    } else if ((resolvedUrlProxy = this.originUrl_SetProxyOrigin + this.URI(globalWindow.location.href).directory()).slice(-1) === "/") {
      return resolvedUrlProxy;
    } else {
      return resolvedUrlProxy + "/";
    }
  };
  return this;
};
__Cpn.prototype.initScope = __Cpn.prototype.initScope || function (globalScopeContext, proxyInstanceScope) {
  this.Scope = class {
    overrideFetchApi() {
      try {
proxyInstanceScope.overrideMethod(globalScopeContext, "fetch", function (originalFetch, fetchArgs) {
          var fetchRequest = fetchArgs[0];
          if (!(fetchRequest instanceof globalScopeContext.Request)) {
            fetchRequest = new globalScopeContext.Request(fetchRequest);
          }
          return this.__cpn.buildProxyRequest(fetchRequest).then(function (modifiedFetchReq) {
            var fetchInitOptions = fetchArgs[1];
            if (typeof fetchInitOptions == "object") {
              fetchInitOptions.mode = modifiedFetchReq.mode;
              fetchInitOptions.credentials = modifiedFetchReq.credentials;
              fetchInitOptions.cache = modifiedFetchReq.cache;
              fetchInitOptions.referrer = modifiedFetchReq.referrer;
              delete fetchInitOptions.integrity;
              fetchArgs[1] = fetchInitOptions;
            }
            fetchArgs[0] = modifiedFetchReq;
            return originalFetch(fetchArgs);
          });
        }, true, true);
      } catch (errFetch) {
        proxyInstanceScope.logError_CachePut(errFetch);
      }
      return this;
    }
    originUrl_SetProxyOrigin() {
      globalScopeContext.origin = proxyInstanceScope.proxyLocationRef.origin;
      return this;
    }
    overrideServiceWorkerScope() {
      try {
        proxyInstanceScope.overrideProperty(globalScopeContext.ServiceWorkerRegistration.prototype, "scope", function (originalScopeGetter) {
          originalScopeGetter = this.__cpn.URI(originalScopeGetter());
          originalScopeGetter.origin(this.__cpn.proxyLocationRef.origin);
          return originalScopeGetter.toString();
        }, function () {});
      } catch (errScope) {
        proxyInstanceScope.logError_CachePut(errScope);
      }
      return this;
    }
    overrideXMLHttpRequest() {
      if ("XMLHttpRequest" in globalScopeContext) {
        try {
          proxyInstanceScope.overrideMethod(globalScopeContext.XMLHttpRequest.prototype, "open", function (originalXhrOpen, xhrArgs) {
            xhrArgs[1] = this.__cpn.Uri.create(xhrArgs[1]).encodeProxyUrl_processElement();
            return originalXhrOpen(xhrArgs);
          });
        } catch (errXhr) {
          proxyInstanceScope.logError_CachePut(errXhr);
        }
        try {
          proxyInstanceScope.overrideProperty(globalScopeContext.XMLHttpRequest.prototype, "responseURL", function (originalResponseUrlGetter) {
            return this.__cpn.Uri.create(originalResponseUrlGetter()).decodeProxyUrl();
          }, function () {});
        } catch (errRespUrl) {
          proxyInstanceScope.logError_CachePut(errRespUrl);
        }
      }
      return this;
    }
    overridePropertyGetterSetter(targetObjAt, propNameAt, isReadonlyAt = false, enforceProxyAt = false) {
      proxyInstanceScope.overrideProperty(targetObjAt, propNameAt, function (originalGetterAt) {
        originalGetterAt = this.__cpn.Uri.create(originalGetterAt());
        if (enforceProxyAt && !originalGetterAt.shouldBypassProxy(true)) {
          return "";
        } else {
          return originalGetterAt.decodeProxyUrl();
        }
      }, isReadonlyAt ? function () {} : function (setterCallbackAt, setterValAt) {
        setterCallbackAt(this.__cpn.Uri.create(setterValAt).encodeProxyUrl_processElement());
      });
      return this;
    }
  };
  return this;
};
__Cpn.prototype.initUri = __Cpn.prototype.initUri || function (windowUri, proxyUri) {
  this.Uri = class {
    static create(urlStrU, isAlreadyParsedU = false) {
      return new this(urlStrU, isAlreadyParsedU);
    }
    constructor(constructorUrlStrU, constructorIsParsedU = false) {
      this.uri = null;
      if (!constructorIsParsedU && constructorUrlStrU != null || constructorIsParsedU && constructorUrlStrU) {
        this.uri = proxyUri.URI(constructorUrlStrU += "");
      }
      this.url = constructorUrlStrU;
    }
    isHttpProtocol() {
      return !!this.uri && (!this.uri.protocol() || this.uri.protocol() === "http" || this.uri.protocol() === "https");
    }
    isUrlBlacklisted() {
      return !!this.uri && !!this.url && !proxyUri.blacklistedUrls.every(blacklistPatternU => !this.url.match(new windowUri.RegExp(blacklistPatternU)));
    }
    hasProxyQueryKey(strictFlagU = false) {
      return this.uri && this.uri.hasSearch(proxyUri.originKey) && (!strictFlagU || this.getProxyQueryValue() !== "1" && strictFlagU);
    }
    shouldBypassProxy(strictFlagE = false) {
      return !this.isHttpProtocol() || this.isUrlBlacklisted() || this.hasProxyQueryKey(strictFlagE);
    }
    isBlobUrl() {
      return !!this.url && !!this.url.match(/^blob:/i);
    }
    getProxyQueryValue() {
      if (this.isHttpProtocol()) {
        return this.uri.query(true)[proxyUri.originKey];
      } else {
        return null;
      }
    }
    buildInjectorUrl() {
      return proxyUri.originUrl_SetProxyOrigin + proxyUri.injectorPath + "?r=" + proxyUri.B64.encode(this.url) + "&" + proxyUri.originKey + "=1";
    }
    encodeProxyUrl_processElement(configObjU = new windowUri.Object(), baseUriStrU = null) {
      if (this.shouldBypassProxy()) {
        if (this.hasProxyQueryKey()) {
          return this.uri.clone().absoluteTo(windowUri.location.href).toString();
        } else {
          return this.url;
        }
      }
      try {
        if ((clonedUriU = this.uri.clone()).origin() && proxyUri.URI(clonedUriU.origin()).equals(proxyUri.originUrl_SetProxyOrigin)) {
          clonedUriU.origin("");
        }
        if (!(clonedUriU = (baseUriStrU = baseUriStrU || proxyUri.proxyLocationRef.getAbsoluteUri()) ? clonedUriU.absoluteTo(baseUriStrU) : clonedUriU).protocol() || !clonedUriU.hostname()) {
          proxyUri.throwFatalError("No origin for url " + this.url + ", possible result is " + clonedUriU);
        }
        var configKeyU;
        var encodedOriginU = btoa(clonedUriU.origin()).replace(/=+$/g, "");
        clonedUriU = this.appendQueryParam(clonedUriU.origin(proxyUri.originUrl_SetProxyOrigin), proxyUri.originKey, encodedOriginU);
        for (configKeyU in configObjU) {
          var configValU = configObjU[configKeyU];
          var clonedUriU = this.appendQueryParam(clonedUriU, proxyUri.shortName + ":" + configKeyU, configValU);
        }
        return clonedUriU.toString();
      } catch (errEncU) {
        proxyUri.logWarning(this.url + ": " + errEncU.message + "; base url: " + (baseUriStrU || "-"));
        return this.url;
      }
    }
   decodeProxyUrl() {
      var proxyQueryValueU = this.getProxyQueryValue();
      if (!proxyQueryValueU || proxyQueryValueU === "1") {
        return this.url;
      }
      try {
        var padded = proxyQueryValueU;
        while (padded.length % 4) padded += '=';
        var decodedOriginHashU = atob(padded);
      } catch (errDecU) {
        proxyUri.logException(errDecU, "Wrong CPO hash supplied, url: " + this.url);
        return this.url;
      }
      var queryKeyU;
      var uriObjU = this.uri.clone().removeSearch(proxyUri.originKey);
      for (queryKeyU in uriObjU.query(true)) {
        if (queryKeyU.match(new windowUri.RegExp("^" + proxyUri.shortName + ":", "i"))) {
          uriObjU.removeSearch(queryKeyU);
        }
      }
      return uriObjU.origin(decodedOriginHashU).toString().replace(proxyUri.locationKey_CacheAdd, "location").trim();
    }
    appendProxyFlag() {
      var parsedUrlObjU = proxyUri.URI(this.url);
      return this.appendQueryParam(parsedUrlObjU, proxyUri.originKey, "1") + "";
    }
    appendQueryParam(targetUriObjU, paramKeyU, paramValU) {
      paramKeyU = windowUri.encodeURIComponent(paramKeyU) + "=" + windowUri.encodeURIComponent(paramValU);
      paramKeyU = (targetUriObjU.search() ? "&" : "?") + paramKeyU;
      return targetUriObjU.search(targetUriObjU.search() + paramKeyU);
    }
  };
  return this;
};
__Cpn.prototype.initElement = __Cpn.prototype.initElement || function (windowElem, proxyElem) {
  this.Element = class ElementOverrideClass {
    static create(elemObjArg) {
      return new this(elemObjArg);
    }
    constructor(constructorElem) {
      if (!proxyElem.isDomElement(constructorElem)) {
        throw new TypeError("Wrong argument passed. Should be instance of Element");
      }
      this.domElement = constructorElem;
      this.tagProcessors = new windowElem.Object({
        a: () => {
          this.proxyUrlAttribute("href");
        },
        area: () => {
          this.proxyUrlAttribute("href");
        },
        form: () => {
          this.proxyUrlAttribute("action");
        },
        video: () => {
          this.proxyUrlAttribute("src", true);
        },
        audio: () => {
          this.proxyUrlAttribute("src", true);
        },
        source: () => {
          this.proxyUrlAttribute("src", true);
        },
use: () => {
          this.proxyUrlAttribute("href", true);
        },
        embed: () => {
          this.proxyUrlAttribute("src", true);
        },
        object: () => {
          this.proxyUrlAttribute("data", true);
        },
        link: () => {
          this.proxyUrlAttribute("href", true);
        },
        script: () => {
          var configObj = new windowElem.Object();
          if (this.domElement.type === "module" || this.domElement.getAttribute("type") === "module") {
            configObj["parser:module"] = 1;
          }
          this.proxyUrlAttribute("src", false, configObj);
        },
        iframe: () => {
          var iframeParent;
          var iframeStub;
          var iframeLoadCounter;
          var iframeLoadInterval;
          var iframeSrcVal = this.getOriginalAttribute("src");
          var iframeParsedUri = proxyElem.Uri.create(iframeSrcVal);
          var iframeSrcVal = !!iframeSrcVal && !!iframeParsedUri.isHttpProtocol() && !iframeParsedUri.shouldBypassProxy();
          var iframeHasSandbox = this.domElement.hasAttribute("sandbox");
          if ((iframeSrcVal || iframeHasSandbox) && (iframeParent = this.domElement.parentNode, iframeStub = document.createElement("framestub"), iframeParent && iframeParent.replaceChild(iframeStub, this.domElement), iframeSrcVal && this.proxyUrlAttribute("src", true), iframeHasSandbox && this.domElement.removeAttribute("sandbox"), iframeParent)) {
            iframeParent.replaceChild(this.domElement, iframeStub);
          }
          if (iframeParsedUri.isBlobUrl()) {
            proxyElem.logWarning("TODO: blob iframe detected: " + iframeParsedUri.toString());
          }
          var iframeIdHash = proxyElem.generateHashCode(this.domElement.outerHTML);
          var initIframeProxy = () => {
            var IframeProxyCpn;
            if (!(proxyElem.isProcessedFlag_CacheMatchAll in this.domElement.contentWindow)) {
              (IframeProxyCpn = function () {}).prototype = windowElem.Object.getPrototypeOf(proxyElem);
              new IframeProxyCpn().init(this.domElement.contentWindow, proxyElem.hostNameRef, proxyElem.originUrl_SetProxyOrigin, this.getOriginalAttribute("src") || windowElem.location.href);
              proxyElem.logInfo("frame " + iframeIdHash + " initialized");
            }
          };
          if (this.domElement.contentWindow) {
            initIframeProxy();
          } else {
            iframeLoadCounter = 0;
            iframeLoadInterval = windowElem.setInterval(() => {
              if (this.domElement.contentWindow) {
                initIframeProxy();
              }
              if (iframeLoadCounter >= 200 || this.domElement.contentWindow) {
                proxyElem.logInfo("interval for frame " + iframeIdHash + " cleared, counter " + iframeLoadCounter);
                windowElem.clearInterval(iframeLoadInterval);
              } else {
                iframeLoadCounter++;
                proxyElem.logInfo("frame load interval " + iframeIdHash);
              }
            }, 10);
          }
        },
        base: () => {
          var headNodeBase;
          var baseNode;
          if (!this.hasAttributeProxy(proxyElem.generatedFlag_CacheAddAll)) {
            if ((headNodeBase = windowElem.document.head) && (baseNode = headNodeBase.querySelector("base[" + proxyElem.generatedFlag_CacheAddAll + "]"))) {
              headNodeBase.removeChild(baseNode);
            }
          }
          proxyElem.Element.create(windowElem.document.documentElement).updateElementTree();
        }
      });
this.tagUpdaters = new windowElem.Object({
        a: () => { this.revertUrlAttribute("href"); },
        area: () => { this.revertUrlAttribute("href"); },
        form: () => { this.revertUrlAttribute("action"); },
        script: () => { this.revertUrlAttribute("src"); },
        embed: () => { this.revertUrlAttribute("src"); },
        object: () => { this.revertUrlAttribute("data"); },
        link: () => { this.revertUrlAttribute("href"); }
      });
    }
    getTagNameLowerCase() {
      if ("tagName" in this.domElement && this.domElement.tagName) {
        return this.domElement.tagName.toLowerCase();
      } else {
        return null;
      }
    }
    hasAttributeProxy(hasAttrName) {
      return this.domElement.hasAttribute(hasAttrName);
    }
    getAttributeProxy(getAttrName) {
      return this.domElement.getAttribute(getAttrName);
    }
    setAttributeSafe(setAttrName, setAttrValue) {
      try {
        this.domElement[setAttrName] = setAttrValue;
      } catch (setAttrErr) {
        proxyElem.logWarning(setAttrErr.message);
      }
      this.domElement.setAttribute(setAttrName, setAttrValue);
      return this;
    }
    getOriginalAttribute(getProxyAttrName) {
      return this.getAttributeProxy(proxyElem.concatAndCapitalize(proxyElem.origPropPrefix_CacheMatch, getProxyAttrName));
    }
    setOriginalAttribute(setProxyAttrName, setProxyAttrValue) {
      return this.setAttributeSafe(proxyElem.concatAndCapitalize(proxyElem.origPropPrefix_CacheMatch, setProxyAttrName), setProxyAttrValue);
    }
    getFallbackAttribute(getOrigAttrName) {
      return this.getAttributeProxy(proxyElem.concatAndCapitalize(proxyElem.origValPrefix_CacheKeys, getOrigAttrName));
    }
    setFallbackAttribute(setOrigAttrName, setOrigAttrValue) {
      return this.setAttributeSafe(proxyElem.concatAndCapitalize(proxyElem.origValPrefix_CacheKeys, setOrigAttrName), setOrigAttrValue);
    }
    hasFallbackAttribute(hasOrigAttrName) {
      return this.hasAttributeProxy(proxyElem.concatAndCapitalize(proxyElem.origValPrefix_CacheKeys, hasOrigAttrName));
    }
    shouldBypassProxy() {
      return !!this.getAttributeProxy(proxyElem.isProcessedFlag_CacheMatchAll) || !!this.domElement[proxyElem.isProcessedFlag_CacheMatchAll];
    }
    isUrlBlacklisted() {
      if (!proxyElem.uiElementsToHide.every(hiddenSelector => !proxyElem.matchesSelector(this.domElement, hiddenSelector))) {
        return true;
      }
      if (proxyElem.isDomElement(this.domElement.parentElement)) {
        try {
          return ElementOverrideClass.create(this.domElement.parentElement).isUrlBlacklisted();
        } catch (parentHiddenErr) {}
      }
      return false;
    }
    encodeProxyUrl_processElement() {
      var tagTypeProcess;
      if (!this.shouldBypassProxy() && !this.isUrlBlacklisted()) {
        this.setAttributeSafe(proxyElem.isProcessedFlag_CacheMatchAll, "1");
        tagTypeProcess = this.getTagNameLowerCase();
        if (this.tagProcessors[tagTypeProcess]) {
          this.tagProcessors[tagTypeProcess]();
        }
      }
      return this;
    }
    processElementTree() {
      this.encodeProxyUrl_processElement();
      if (this.domElement.children.length && !this.isUrlBlacklisted()) {
        for (var childNodeDesc of this.domElement.children) {
          if (proxyElem.isDomElement(childNodeDesc)) {
            try {
              ElementOverrideClass.create(childNodeDesc).processElementTree();
            } catch (childDescErr) {}
          }
        }
      }
      return this;
    }
    updateElement() {
      var tagTypeUpdate = this.getTagNameLowerCase();
      if (this.tagUpdaters[tagTypeUpdate]) {
        this.tagUpdaters[tagTypeUpdate]();
      }
      return this;
    }
    updateElementTree() {
      this.updateElement();
      if (this.domElement.children.length) {
        for (var childNodeUpd of this.domElement.children) {
          if (proxyElem.isDomElement(childNodeUpd)) {
            try {
              ElementOverrideClass.create(childNodeUpd).updateElementTree();
            } catch (childUpdErr) {}
          }
        }
      }
      return this;
    }
proxyUrlAttribute(urlAttrName, urlIsReadonly = false, configObj = new windowElem.Object()) {
      // Intelligently grab the raw URL, checking the fallback attribute first for dynamic scripts
      var urlAttrValue = this.hasFallbackAttribute(urlAttrName) ? this.getFallbackAttribute(urlAttrName) : this.getOriginalAttribute(urlAttrName);
      if (!urlAttrValue && this.hasAttributeProxy(urlAttrName)) {
        urlAttrValue = this.getAttributeProxy(urlAttrName);
      }
      
      var urlParsed = proxyElem.Uri.create(urlAttrValue, urlIsReadonly);
      if (!urlParsed.shouldBypassProxy()) {
        this.setOriginalAttribute(urlAttrName, urlParsed.encodeProxyUrl_processElement(configObj));
        this.setFallbackAttribute(urlAttrName, urlAttrValue);
      }
      return this;
    }
    revertUrlAttribute(revertAttrName) {
      var revertOrigVal;
      if (this.hasFallbackAttribute(revertAttrName)) {
        revertOrigVal = this.getFallbackAttribute(revertAttrName);
        this.setOriginalAttribute(revertAttrName, proxyElem.Uri.create(revertOrigVal).encodeProxyUrl_processElement());
      }
      return this;
    }
  };
  return this;
};
__Cpn.prototype.initCookie = __Cpn.prototype.initCookie || function (windowCookie, proxyCookie) {
  this.Cookie = class CookieOverrideClass {
    static create(cookieStrArg) {
      return new this(cookieStrArg);
    }
    constructor(cookieConstructorArg) {
      this.rawCookieString = cookieConstructorArg;
    }
    parseClientCookie() {
      var domainStrVal;
      var cookieNamePfx;
      var parsedCookieClient = this.parseSingleCookie(this.rawCookieString);
      if (parsedCookieClient !== null && !this.isProxyCookie(parsedCookieClient.name) && (domainStrVal = "domain" in parsedCookieClient ? parsedCookieClient.domain.replace(/^\./, "") : proxyCookie.proxyLocationRef.getUriObject().hostname(), this.isMatchingDomain(domainStrVal))) {
        cookieNamePfx = parsedCookieClient.name.replace(/^(__host)|(__secure)/i, "__$1");
        parsedCookieClient.name = cookieNamePfx + "@" + domainStrVal;
        parsedCookieClient.domain = proxyCookie.hostNameRef;
        parsedCookieClient.path = "path" in parsedCookieClient ? parsedCookieClient.path : "/";
        parsedCookieClient.secure = true;
        return CookieOverrideClass.buildCookieString(parsedCookieClient);
      } else {
        return null;
      }
    }
    parseServerCookie() {
      var parsedCookieServer = this.parseSingleCookie(this.rawCookieString);
      if (parsedCookieServer !== null && this.isProxyCookie(parsedCookieServer.name)) {
        return CookieOverrideClass.buildCookieString(parsedCookieServer);
      } else {
        return null;
      }
    }
    getClientCookiesString() {
      var cookieObjClient;
      var cookieArrClient = new windowCookie.Array();
      for (cookieObjClient of CookieOverrideClass.parseCookieString(this.rawCookieString, false)) {
        var realCookieName;
        var cNameSplit = cookieObjClient.name;
        var cValue = cookieObjClient.value;
        var cNameSplit = CookieOverrideClass.splitStringOnce("@", cNameSplit);
        if (1 in cNameSplit && (realCookieName = (realCookieName = cNameSplit[0]).replace(/^__(__host)|(__secure)/i, "$1"), cNameSplit = cNameSplit[1], this.isMatchingDomain(cNameSplit))) {
          cookieArrClient.push(realCookieName + "=" + cValue);
        }
      }
      return cookieArrClient.join("; ");
    }
    getServerCookiesString() {
      var cookieObjServer;
      var cookieArrServer = new windowCookie.Array();
      for (cookieObjServer of CookieOverrideClass.parseCookieString(this.rawCookieString, false)) {
        var cNameServer = cookieObjServer.name;
        var cValueServer = cookieObjServer.value;
        if (this.isProxyCookie(cNameServer)) {
          cookieArrServer.push(cNameServer + "=" + cValueServer);
        }
      }
      return cookieArrServer.join("; ");
    }
    isProxyCookie(cookieNameCheck) {
      return !!cookieNameCheck.match(new windowCookie.RegExp("^" + proxyCookie.configKey_CacheDelete, "i"));
    }
    isMatchingDomain(cookieDomainCheck) {
      return !!proxyCookie.proxyLocationRef.getUriObject().hostname().match(new windowCookie.RegExp(this.escapeRegexChars(cookieDomainCheck), "i"));
    }
    escapeRegexChars(strToEscape) {
      return strToEscape.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
    }
    parseSingleCookie(cookieStrToParse) {
      if (!cookieStrToParse) {
        return null;
      }
      var parsedCookieObj = new windowCookie.Object();
      var cookieParts = cookieStrToParse.split(";");
      for (var cPartIdx = 0; cPartIdx < cookieParts.length; cPartIdx++) {
        var cKeyValue = CookieOverrideClass.splitStringOnce("=", cookieParts[cPartIdx]);
        if (cPartIdx) {
          parsedCookieObj[cKeyValue[0].trim().toLowerCase()] = !(1 in cKeyValue) || cKeyValue[1];
        } else {
          if (!(1 in cKeyValue)) {
            return null;
          }
          parsedCookieObj.name = cKeyValue[0].trim();
          parsedCookieObj.value = cKeyValue[1];
        }
      }
      return parsedCookieObj;
    }
    static parseCookieString(cookiesStrToParse, returnAsObj = true) {
      var cookiesCollection = new (returnAsObj ? windowCookie.Object : windowCookie.Array)();
      var cookiesSplit = cookiesStrToParse.split(";");
      for (var cSplitIdx = 0; cSplitIdx < cookiesSplit.length; cSplitIdx++) {
        var cSplitKV = CookieOverrideClass.splitStringOnce("=", cookiesSplit[cSplitIdx]);
        if (1 in cSplitKV) {
          if (returnAsObj) {
            cookiesCollection[cSplitKV[0].trim()] = cSplitKV[1];
          } else {
            cookiesCollection.push({
              name: cSplitKV[0].trim(),
              value: cSplitKV[1]
            });
          }
        }
      }
      return cookiesCollection;
    }
    static getCookieValue(getCookieStr, getCookieName, getCookieDefault = null) {
      getCookieStr = this.parseCookieString(getCookieStr);
      if (getCookieName in getCookieStr) {
        return getCookieStr[getCookieName];
      } else {
        return getCookieDefault;
      }
    }
    static buildCookieString(buildCookieObj) {
      var bCookieKey;
      var bCookieArr = new windowCookie.Array();
      if (!("name" in buildCookieObj) || !buildCookieObj.name) {
        return null;
      }
      bCookieArr.push(buildCookieObj.name + "=" + buildCookieObj.value);
      delete buildCookieObj.name;
      delete buildCookieObj.value;
      for (bCookieKey in buildCookieObj) {
        var bCookieVal = buildCookieObj[bCookieKey];
        if (bCookieVal === true) {
          bCookieArr.push(bCookieKey);
        } else if (bCookieVal !== false) {
          bCookieArr.push(bCookieKey + "=" + bCookieVal);
        }
      }
      return bCookieArr.join(";");
    }
    static splitStringOnce(splitChar, splitStr) {
      splitChar = splitStr.indexOf(splitChar);
      if (splitChar >= 0) {
        return new windowCookie.Array(splitStr.slice(0, splitChar), splitStr.slice(splitChar + 1));
      } else {
        return new windowCookie.Array(splitStr);
      }
    }
  };
  return this;
};
__Cpn.prototype.initLocation = __Cpn.prototype.initLocation || function (windowLoc, proxyLoc) {
  this.WorkerLocation = class {
    static create() {
      return new this();
    }
    get hash() {
      return windowLoc.location.hash;
    }
    get host() {
      return this.getUriObject().host();
    }
    get hostname() {
      return this.getUriObject().hostname();
    }
    get href() {
      return this.getHref();
    }
    get pathname() {
      return windowLoc.location.pathname;
    }
    get port() {
      return this.getUriObject().port();
    }
    get protocol() {
      return this.getUriObject().protocol() + ":";
    }
    get search() {
      return this.getUriObject().search();
    }
    get origin() {
      return this.getUriObject().origin();
    }
    toString() {
      return this.getHref();
    }
    getHref(returnOriginalFlag = false) {
      var parsedUriLoc = proxyLoc.Uri.create(windowLoc.location.href);
      if (!returnOriginalFlag || parsedUriLoc.shouldBypassProxy(true)) {
        return parsedUriLoc.decodeProxyUrl();
      } else {
        return windowLoc.location.href;
      }
    }
    getUriObject(returnOriginalFlagCt = false) {
      return proxyLoc.URI(this.getHref(returnOriginalFlagCt));
    }
    getAbsoluteUri() {
      return this.getUriObject(true);
    }
  };
  this.Location = class extends this.WorkerLocation {
    static create(proxyUrlParam, passiveModeParam = false) {
      return new this(proxyUrlParam, passiveModeParam);
    }
    constructor(proxyUrlL, passiveModeL = false) {
      super();
      this.proxyUrl = proxyUrlL;
      this.passiveMode = passiveModeL;
      windowLoc.addEventListener("hashchange", () => {
        this.updateBaseTag();
      }, true);
      windowLoc.addEventListener("popstate", () => {
        this.updateBaseTag();
      }, true);
    }
    get hash() {
      return super.hash;
    }
    set hash(hashValL) {
      windowLoc.location.hash = hashValL;
    }
    get host() {
      return super.host;
    }
    set host(hostValL) {
      this.assign(this.getUriObject().host(hostValL));
    }
    get hostname() {
      return super.hostname;
    }
    set hostname(hostnameValL) {
      this.assign(this.getUriObject().hostname(hostnameValL));
    }
    get href() {
      return super.href;
    }
    set href(hrefValL) {
      this.assign(hrefValL);
    }
    get pathname() {
      return super.pathname;
    }
    set pathname(pathnameValL) {
      this.assign(this.getUriObject().pathname(pathnameValL));
    }
    get port() {
      return super.port;
    }
    set port(portValL) {
      this.assign(this.getUriObject().port(portValL));
    }
    get protocol() {
      return super.protocol;
    }
    set protocol(protocolValL) {
      this.assign(this.getUriObject().protocol(protocolValL.replace(/:$/g, "")));
    }
    get search() {
      return super.search;
    }
    set search(searchValL) {
      this.assign(this.getUriObject().search(searchValL));
    }
    get username() {
      return this.getUriObject().username();
    }
    set username(usernameValL) {}
    get password() {
      return this.getUriObject().password();
    }
    set password(passwordValL) {}
    assign(assignUrlL) {
      windowLoc.location.assign(this.passiveMode ? assignUrlL + "" : proxyLoc.Uri.create(assignUrlL).encodeProxyUrl_processElement());
    }
    reload(forceReloadFlagL) {
      windowLoc.location.reload(forceReloadFlagL);
    }
    replace(replaceUrlL) {
      windowLoc.location.replace(this.passiveMode ? replaceUrlL + "" : proxyLoc.Uri.create(replaceUrlL).encodeProxyUrl_processElement());
    }
    updateBaseTag() {
      var baseTagNodeL = windowLoc.document.querySelector("base[" + proxyLoc.generatedFlag_CacheAddAll + "]");
      if (baseTagNodeL) {
        baseTagNodeL.setAttribute("href", this.getHref());
      }
      this.triggerLocationChange();
      return this;
    }
    triggerLocationChange() {}
getAbsoluteUri() {
      if (typeof self !== 'undefined' && self.__cpLocationBase) {
        return proxyLoc.URI(self.__cpLocationBase);
      }
      var baseTagSelectorL = windowLoc.document.querySelector("base");
      if (baseTagSelectorL) {
        try {
          var baseHrefStrL = proxyLoc.Element.create(baseTagSelectorL).getOriginalAttribute("href");
        } catch (errBaseTag) {}
if (baseHrefStrL) {
        return proxyLoc.URI(baseHrefStrL).absoluteTo(this.getUriObject());
      }
      // FIX: bodyTransform-injected base tags carry the real upstream URL directly
      // in href (no __cpo), but never get __cpOriginalhref set (the base: handler
      // calls updateElementTree instead of proxyUrlAttribute). Read raw href here.
      try {
        var rawBaseHrefL = baseTagSelectorL.getAttribute("href");
        if (rawBaseHrefL && !proxyLoc.Uri.create(rawBaseHrefL).hasProxyQueryKey()) {
          return proxyLoc.URI(rawBaseHrefL);
        }
      } catch (errRawBase) {}
    }
    let currentHrefL = this.getHref();
      if (!proxyLoc.Uri.create(currentHrefL).isHttpProtocol() && this.proxyUrl) {
        currentHrefL = proxyLoc.Uri.create(this.proxyUrl).decodeProxyUrl();
      }
      return proxyLoc.URI(currentHrefL);
    }
  };
  return this;
};
__Cpn.prototype.initUi = __Cpn.prototype.initUi || function (windowUi, proxyUi) {
  this.Ui = class {
    constructor() {
      this.adDisplayDelay = 10000;
      this.headerCloseDelay = 1000;
      this.sessionDuration = 600000;
      this.sessionExtension = 600000;
      this.maxPopups = 5;
      this.uiContainer = null;
      this.uiHeader = null;
      this.uiCloseBtn = null;
      this.uiUrlInput = null;
      this.uiGoBtn = null;
      this.uiShareBtn = null;
      this.uiShareInput = null;
      this.isHeaderHidden = false;
      this.isHeaderVisible = false;
      this.isHeaderAnimating = false;
      this.isHeaderClosed = false;
      this.headerTimeoutId = null;
      this.isHeaderTimeoutSet = false;
      this.adsConfigObj = proxyUi.adsJson ? JSON.parse(proxyUi.adsJson) : null;
    }
    initUiInjection() {
      if (proxyUi.isInsideIframe()) {
        this.initIframeCommunication();
      } else if (/compl|inter|loaded/.test(document.readyState) && this.isUiInjectable()) {
        this.injectUi();
      } else {
        windowUi.document.addEventListener("DOMContentLoaded", () => {
          if (this.isUiInjectable()) {
            this.injectUi();
          }
        }, true);
      }
      return this;
    }
    isUiInjectable() {
      return windowUi.document.body !== null;
    }
    injectUi() {
      return this;
    }
    initIframeCommunication() {
      return this;
    }
    renderUiHtml(adblockEnabled) {
      console.log("Ads: " + proxyUi.showAds);
      console.log("Ad codes: " + !!proxyUi.adsJson);
      console.log("Adblock: " + adblockEnabled);
      windowUi.document.body.insertAdjacentHTML("afterbegin", proxyUi.modal);
      if (proxyUi.header) {
        if (proxyUi.header) {
          this.bindUiEvents(adblockEnabled);
        }
      }
      return this;
    }
    bindUiEvents(adblockStatus) {
      this.uiContainer = null;
      this.uiHeader = null;
      this.uiCloseBtn = null;
      this.uiUrlInput = null;
      this.uiGoBtn = null;
      this.uiShareBtn = null;
      this.uiShareInput = null;
      if (proxyUi.fixedHeader) {
        this.initFixedHeader();
      } else {
        this.initAutoHidingHeader();
      }
      if (this.uiShareBtn && this.uiShareInput) {
        this.uiShareBtn.addEventListener("click", btnClickEvent => {
          function fallbackCopyFn() {
            proxyUi.logWarning("Unable to copy permalink");
          }
          this.uiShareInput.value = proxyUi.getPermalink().toString();
          this.uiShareInput.select();
          try {
            if (document.execCommand("copy")) {
              windowUi.alert("The permalink was copied into your clipboard.\nTime to live for the permalink is 3 hours.");
            } else {
              fallbackCopyFn();
            }
          } catch (errCopy) {
            fallbackCopyFn();
          }
          btnClickEvent.stopImmediatePropagation();
        }, true);
      }
      if (this.uiGoBtn && this.uiUrlInput) {
        this.uiGoBtn.addEventListener("click", navClickEvent => {
          var navUrlInput = this.uiUrlInput.value;
          var navUrlInput = proxyUi.Uri.create(navUrlInput);
          proxyUi.proxyLocationRef.href = navUrlInput.buildInjectorUrl();
          navClickEvent.stopImmediatePropagation();
        }, true);
        this.uiUrlInput.addEventListener("keyup", navKeyEvent => {
          if (navKeyEvent.keyCode === 13) {
            this.uiGoBtn.click();
          }
          navKeyEvent.stopImmediatePropagation();
        }, true);
      }
      return this;
    }
    initAutoHidingHeader() {
      this.monitorScrollForHeader();
      this.resetHeaderTimeout();
      windowUi.setTimeout(() => {
        if (!this.isHeaderTimeoutSet) {
          proxyUi.logInfo("Header close assigned by timeout");
          this.isHeaderTimeoutSet = true;
        }
      }, this.headerCloseDelay);
      return this;
    }
    initFixedHeader() {
      var unusedScrollVar;
      var htmlNode = windowUi.document.querySelector("html");
      var bodyNode = windowUi.document.querySelector("body");
      var cssResetProps = {
        "overscroll-behavior-y": "auto",
        "padding-top": "0",
        "padding-left": "0",
        "padding-right": "0",
        "margin-top": "0",
        "margin-left": "0",
        "margin-right": "0",
        width: "100%",
        "min-width": "100%",
        top: "0",
        left: "0",
        position: "absolute",
        "min-height": "100%"
      };
      var scrollCount = 0;
      var unusedArrUI = [];
      var unusedNullUI = null;
      var headerHeight = this.getElementHeight(this.uiContainer);
      var scrollAdjustFn = () => {//
      };
      scrollAdjustFn();
      var scrollCheckFn = (isIntervalUI = false) => {};
      scrollCheckFn();
      windowUi.addEventListener("scroll", () => {
        if (scrollCount) {
          scrollCheckFn();
          scrollCount = 0;
        }
        scrollCount++;
      });
      windowUi.setInterval(() => {
        scrollAdjustFn();
        scrollCheckFn(true);
      }, 1000);
      return this;
    }
    monitorScrollForHeader() {
      let headerUpdateFn = isIntervalHeader => {//
      };
      headerUpdateFn(false);
      windowUi.setTimeout(() => {
        windowUi.setInterval(() => {
          headerUpdateFn(true);
        }, 500);
      }, 500);
      windowUi.addEventListener("scroll", () => {
        headerUpdateFn(true);
      }, true);
      return this;
    }
    resetHeaderTimeout() {
      if (this.headerTimeoutId) {
        windowUi.clearTimeout(this.headerTimeoutId);
        this.headerTimeoutId = null;
      }
      this.headerTimeoutId = windowUi.setTimeout(() => {
        this.hideHeader();
      }, this.adDisplayDelay);
      return this;
    }
    showHeader() {
      if (!this.isHeaderClosed) {
        this.isHeaderVisible = true;
        this.isHeaderAnimating = false;
        this.toggleHeaderState("show");
      }
      return this;
    }
    hideHeader() {
      if (!this.isHeaderClosed) {
        this.isHeaderAnimating = true;
        this.isHeaderVisible = false;
        this.toggleHeaderState("hide");
      }
      return this;
    }
    getScrollY() {
      return windowUi.scrollY || windowUi.pageYOffset || windowUi.document.documentElement.scrollTop || document.body.scrollTop;
    }
    getElementHeight(heightElem1) {
      return this.parsePixels(null);
    }
    parsePixels(heightElem2) {
      return Number((heightElem2 || "0px").replace(/px$/i, ""));
    }
    parseTranslateY(translateYStr) {
      translateYStr = translateYStr.replace(/^translateY\(([^)]+)\)$/i, "$1");
      return this.parsePixels(translateYStr);
    }
    animateHeader(elemToMove, yPosVal, moveForce = false) {//
    }
    sendGoogleAnalyticsHit(gaTrackingId, gaClientId, gaEventName, gaHost, gaUrl, gaExtraParams = {}, gaCallback = () => {}) {
      var gaParamKey;
      var gaParamsUrl = new URLSearchParams();
      gaParamsUrl.append(proxyUi.originKey, "1");
      gaParamsUrl.append("v", "2");
      gaParamsUrl.append("en", gaEventName);
      gaParamsUrl.append("tid", gaTrackingId);
      gaParamsUrl.append("cid", gaClientId);
      gaParamsUrl.append("dh", gaHost);
      gaParamsUrl.append("ul", windowUi.navigator.language || windowUi.navigator.userLanguage);
      gaParamsUrl.append("dt", windowUi.document.title);
      gaParamsUrl.append("sr", windowUi.screen.width + "x" + windowUi.screen.height);
      gaParamsUrl.append("dl", gaUrl);
      gaParamsUrl.append("seg", "1");
      gaParamsUrl.append("ir", "0");
      gaParamsUrl.append("_ee", "1");
      gaParamsUrl.append("_p", Math.floor(Math.random() * 2147483648) + "");
      if (windowUi.document.referrer) {
        gaParamsUrl.append("dr", windowUi.document.referrer);
      }
      for (gaParamKey in gaExtraParams) {
        gaParamsUrl.append(gaParamKey, gaExtraParams[gaParamKey]);
      }
      ("__cpOriginalFetch" in windowUi ? windowUi.__cpOriginalFetch : windowUi.fetch)("https://www.google-analytics.com/g/collect?" + gaParamsUrl, {
        method: "POST"
      }).then(function (gaFetchRes) {
        if (gaFetchRes.status >= 200 && gaFetchRes.status < 300) {
          proxyUi.logInfo("GA hit: " + gaClientId + ", " + gaUrl);
        } else {
          proxyUi.logWarning("GA request failed, status: " + gaFetchRes.status);
        }
        gaCallback();
      }).catch(function (gaFetchErr) {
        proxyUi.logWarning("GA request failed, message: " + gaFetchErr.message);
        gaCallback();
      });
      return this;
    }
    trackAdImpression(hostImpression, impressionCallback) {
      impressionCallback();
      return this;
    }
    handleAdPopup(showAdOverride, adConditionCheck, adSuccessCallback, adRotationIndex, isDelayedAd = false, adUrlTransform = null) {
      var adUrlRef;
      if (proxyUi.showAds && !showAdOverride && this.adsConfigObj && !adConditionCheck()) {
        proxyUi.Popup.make(windowUi.location.href, {
          newTab: true,
          beforeOpen: (adElem, adCallback) => {
            if (isDelayedAd) {
              this.showNotification("Launching CroxyProxy advertisement...");
              windowUi.setTimeout(() => {
                adCallback(adUrlRef(adElem));
              }, 1500);
            } else {
              adCallback(adUrlRef(adElem));
            }
          },
          afterOpen: () => {
            var adSelectedDomain = proxyUi.URI(proxyUi.frontOrigin).domain(true);
            var adSelectedDomain = adSelectedDomain in this.adsConfigObj ? this.adsConfigObj[adSelectedDomain] : this.adsConfigObj.default;
            var adSelectedDomain = adSelectedDomain[adRotationIndex() % adSelectedDomain.length];
            let adFinalUrl = proxyUi.getRandomArrayItem(adSelectedDomain);
            this.trackAdImpression(proxyUi.URI(adFinalUrl).hostname(), () => {
              console.log("Navigated to ", adFinalUrl);
              windowUi.location.href = adFinalUrl;
            });
          },
          blur: !(adUrlRef = adClickEvent => {
            adSuccessCallback();
            let adTargetUrl;
            adClickEvent = adClickEvent.target || adClickEvent.srcElement;
            adTargetUrl = adClickEvent instanceof HTMLAnchorElement && adClickEvent.hasAttribute("href") ? adClickEvent.getAttribute("href") : windowUi.location.href;
            if (adUrlTransform) {
              return adUrlTransform(adTargetUrl);
            } else {
              return adTargetUrl;
            }
          })
        });
      }
      return this;
    }
    showNotification(qiArg1, qiArg2 = null, qiArg3 = null, qiArg4 = {}) {
      return null;
    }
    toggleHeaderState(hiArg1, hiArg2 = 0) {}
    applyHeaderState(miArg1 = 0) {}
  };
  this.ProxyUi = class extends this.Ui {
    static create() {
      return new this();
    }
    constructor() {
      super();
      this.maxGaSamples = 9999;
      this.gaCookieName = proxyUi.configKey_CacheDelete + "StatSampleNum";
      this.headerCookieName = proxyUi.configKey_CacheDelete + "HeaderTabClosed";
      this.adblockStatusCache = null;
    }
    injectUi() {
      this.checkAdblockStatus(adblockStat => {
        super.renderUiHtml(adblockStat);
        var lastUrlStat = null;
        proxyUi.proxyLocationRef.triggerLocationChange = (isHashNavStat = true) => {
          var currUrlStat = proxyUi.proxyLocationRef.getHref();
          if (lastUrlStat !== currUrlStat) {
            lastUrlStat = currUrlStat;
            if (this.uiUrlInput) {
              this.uiUrlInput.value = windowUi.decodeURIComponent(currUrlStat);
            }
            this.Ki({
              "ep.adblock_status": adblockStat ? "enabled" : "disabled",
              "ep.navigation_type": isHashNavStat ? "hash" : "location",
              "ep.server_hostname": proxyUi.hostNameRef
            });
          }
        };
        proxyUi.proxyLocationRef.triggerLocationChange(false);
        var popCookieName = proxyUi.configKey_CacheDelete + "PopShown";
        let popCountName = proxyUi.configKey_CacheDelete + "PopCount";
        this.handleAdPopup(adblockStat, () => +proxyUi.Cookie.getCookieValue(windowUi.document.__cpOriginalCookie, popCookieName, 0), () => {
          var popCountVal = +proxyUi.Cookie.getCookieValue(windowUi.document.__cpOriginalCookie, popCountName, 0);
          var popCookieDate = new Date();
          popCookieDate.setTime(new Date().getTime() + this.sessionDuration + popCountVal * this.sessionExtension);
          windowUi.document.__cpOriginalCookie = proxyUi.Cookie.buildCookieString({
            name: popCookieName,
            value: 1,
            domain: windowUi.location.host,
            expires: popCookieDate.toUTCString(),
            path: "/",
            secure: true,
            samesite: "none",
            priority: "high",
            partitioned: true
          });
        }, () => {
          var popCountValCheck = +proxyUi.Cookie.getCookieValue(windowUi.document.__cpOriginalCookie, popCountName, 0);
          var newPopCount = popCountValCheck >= this.maxPopups - 1 ? 0 : 1 + popCountValCheck;
          windowUi.document.__cpOriginalCookie = proxyUi.Cookie.buildCookieString({
            name: popCountName,
            value: newPopCount,
            domain: windowUi.location.host,
            path: "/",
            secure: true,
            samesite: "none",
            priority: "high",
            partitioned: true
          });
          return popCountValCheck;
        }, false, popTargetUrl => proxyUi.Uri.create(popTargetUrl).encodeProxyUrl_processElement());
        this.setupProxySpecificUi();
      });
      return this;
    }
    initIframeCommunication() {
      if (proxyUi.frontOrigin) {
        let adblockMsgStat = null;
        let lastMsgUrl = null;
        let frontOriginUri = proxyUi.URI(proxyUi.frontOrigin);
        let frontOriginHost = frontOriginUri.origin();
        windowUi.addEventListener("message", msgEventObj => {
          if (msgEventObj.__cpOriginalOrigin === frontOriginHost) {
            switch (msgEventObj.__cpOriginalData.type) {
              case "proxyLocation":
                if (adblockMsgStat === null) {
                  this.checkAdblockStatus(adblockStatCallback => {
                    adblockMsgStat = adblockStatCallback;
                    proxyUi.proxyLocationRef.triggerLocationChange = (isHashMsgNav = true) => {
                      var currMsgUrl = proxyUi.proxyLocationRef.getHref();
                      if (lastMsgUrl !== currMsgUrl) {
                        lastMsgUrl = currMsgUrl;
                        this.Ki({
                          "ep.adblock_status": adblockMsgStat ? "enabled" : "disabled",
                          "ep.navigation_type": isHashMsgNav ? "hash" : "location",
                          "ep.server_hostname": proxyUi.hostNameRef
                        });
                      }
                    };
                    proxyUi.proxyLocationRef.triggerLocationChange(false);
                  });
                }
                msgEventObj.source.postMessage({
                  type: "proxyLocation",
                  url: lastMsgUrl || proxyUi.proxyLocationRef.getHref()
                }, frontOriginUri.origin());
                break;
              case "proxyForward":
                windowUi.history.forward();
                break;
              case "proxyBackward":
                windowUi.history.back();
            }
            msgEventObj.stopImmediatePropagation();
            msgEventObj.stopPropagation();
          }
        }, true);
      }
      return this;
    }
    setupProxySpecificUi() {
      return this;
    }
    bindUiEvents(biArg1) {
      super.bindUiEvents(biArg1);
      if (+proxyUi.Cookie.getCookieValue(windowUi.document.__cpOriginalCookie, this.headerCookieName, 0)) {
        this.toggleHeaderState("close", false);
      }
      if (this.uiCloseBtn) {
        this.uiCloseBtn.addEventListener("click", headerClickEvent => {
          if (this.isHeaderHidden && !this.isHeaderClosed) {
            this.showHeader();
          } else {
            this.toggleHeaderState(this.isHeaderClosed ? "open" : "close");
            windowUi.document.__cpOriginalCookie = proxyUi.Cookie.buildCookieString({
              name: this.headerCookieName,
              value: +this.isHeaderClosed,
              domain: windowUi.location.host,
              path: "/",
              secure: true,
              samesite: "none",
              priority: "high",
              partitioned: true
            });
          }
          headerClickEvent.stopImmediatePropagation();
        }, true);
      }
      return this;
    }
    toggleHeaderState(hiArgType, hiArgForce = true) {
      return this.applyHeaderState(hiArgForce);
    }
    applyHeaderState(miArgForce = false) {
      var headerYPos;
      if (this.isHeaderClosed) {
        headerYPos = -this.getElementHeight(this.uiHeader);
      } else {
        if (this.isHeaderHidden || this.isHeaderAnimating) {
          headerYPos = -this.getElementHeight(this.uiHeader);
        }
        if (!this.isHeaderHidden || !!this.isHeaderVisible) {
          headerYPos = 0;
        }
      }
      return this.animateHeader(this.uiContainer, headerYPos, miArgForce);
    }
    Ki(gaExtraConfig = {}) {
      var gaSampleNum;
      if (proxyUi.analyticsUid && proxyUi.analyticsTrackingId) {
        if (!(gaSampleNum = +proxyUi.Cookie.getCookieValue(windowUi.document.__cpOriginalCookie, this.gaCookieName, 0))) {
          this.sendGoogleAnalyticsHit(proxyUi.analyticsTrackingId, proxyUi.analyticsUid, "page_view", proxyUi.proxyLocationRef.hostname, proxyUi.proxyLocationRef.href, gaExtraConfig);
        }
        gaSampleNum = gaSampleNum >= this.maxGaSamples - 1 ? 0 : 1 + gaSampleNum;
        (gaExtraConfig = new Date()).setTime(new Date().getTime() + 21600000);
        windowUi.document.__cpOriginalCookie = proxyUi.Cookie.buildCookieString({
          name: this.gaCookieName,
          value: gaSampleNum,
          domain: windowUi.location.host,
          path: "/",
          secure: true,
          samesite: "none",
          expires: gaExtraConfig.toUTCString(),
          priority: "high",
          partitioned: true
        });
      }
      return this;
    }
    trackAdImpression(impressionHost, impressionCb) {
      if (proxyUi.analyticsUid && proxyUi.analyticsTrackingId) {
        return this.sendGoogleAnalyticsHit("G-0GESC8GM3Q", proxyUi.analyticsUid, "pop_impression_" + impressionHost.replace(".", "_"), proxyUi.proxyLocationRef.hostname, proxyUi.proxyLocationRef.href, {
          "ep.direct_link_host": impressionHost
        }, impressionCb);
      } else {
        impressionCb();
        return this;
      }
    }
    checkAdblockStatus(jiCallback) {
      var jiUnusedVar;
      if (this.adblockStatusCache === false || this.adblockStatusCache === true) {
        jiCallback(this.adblockStatusCache);
      }
      return this;
    }
  };
  this.ExtensionUi = class extends this.Ui {
    static create() {
      return new this();
    }
    constructor() {
      super();
      this.storageUidKey = "uniqId";
      this.storagePopTimeKey = "popShowTime";
      this.storagePopCountKey = "popCount";
      this.storageHeaderKey = "headerClosed";
    }
    injectUi() {
      super.renderUiHtml(false);
      var extCurrentUrl = windowUi.location.href;
      windowUi.setInterval(() => {
        if (extCurrentUrl !== windowUi.location.href) {
          extCurrentUrl = windowUi.location.href;
          this.sendExtGaHit({
            "ep.navigation_type": "hash"
          });
        }
      }, 200);
      this.sendExtGaHit({
        "ep.navigation_type": "location"
      });
      windowUi.chrome.storage.sync.get(this.storagePopTimeKey, extShowTimeData => {
        windowUi.chrome.storage.sync.get(this.storagePopCountKey, extPopCountData => {
          this.handleAdPopup(false, () => {
            if (this.storagePopTimeKey in extShowTimeData) {
              var extPopCount = (extPopCount = extPopCountData[this.storagePopCountKey]) ? +extPopCount : 0;
              var extDateNow = Date.now();
              var extShowTime = extShowTimeData[this.storagePopTimeKey];
              if (extDateNow < extShowTime && extShowTime <= extDateNow + this.sessionDuration + extPopCount * this.sessionExtension) {
                return true;
              }
            }
            return false;
          }, () => {
            var extPopCountSet = (extPopCountSet = extPopCountData[this.storagePopCountKey]) ? +extPopCountSet : 0;
            var extNewShowTime = {
              [this.storagePopTimeKey]: Date.now() + this.sessionDuration + extPopCountSet * this.sessionExtension
            };
            windowUi.chrome.storage.sync.set(extNewShowTime);
          }, () => {
            var extNewPopCount = extPopCountData[this.storagePopCountKey];
            extPopCountData[this.storagePopCountKey] = (extNewPopCount = extNewPopCount ? +extNewPopCount : 0) >= this.maxPopups - 1 ? 0 : 1 + extNewPopCount;
            windowUi.chrome.storage.sync.set(extPopCountData);
            return extNewPopCount;
          }, true);
        });
      });
      return this;
    }
    bindUiEvents(extAdblockStat) {
      windowUi.chrome.storage.sync.get(this.storageHeaderKey, extHeaderData => {
        super.bindUiEvents(extAdblockStat);
        if (extHeaderData[this.storageHeaderKey]) {
          this.toggleHeaderState("close", false);
        }
        if (this.uiCloseBtn) {
          this.uiCloseBtn.addEventListener("click", extHeaderClick => {
            var extHeaderSet;
            if (this.isHeaderHidden && !this.isHeaderClosed) {
              this.showHeader();
            } else {
              this.toggleHeaderState(this.isHeaderClosed ? "open" : "close");
              (extHeaderSet = new windowUi.Object())[this.storageHeaderKey] = this.isHeaderClosed;
              windowUi.chrome.storage.sync.set(extHeaderSet);
            }
            extHeaderClick.stopImmediatePropagation();
          }, true);
        }
      });
    }
    toggleHeaderState(extHiType, extHiForce = true) {
      switch (extHiType) {
        case "open":
          if (!this.isHeaderClosed) {
            return this;
          }
          this.resetHeaderTimeout();
          this.isHeaderClosed = false;
          this.isHeaderHidden = false;
          this.isHeaderVisible = true;
          this.isHeaderAnimating = false;
          break;
        case "close":
          if (this.isHeaderClosed) {
            return this;
          }
          this.isHeaderClosed = true;
          this.isHeaderHidden = true;
          this.isHeaderVisible = false;
          this.isHeaderAnimating = false;
          if (!extHiForce) {}
          break;
        case "show":
          if (!this.isHeaderHidden || this.isHeaderClosed || this.isHeaderAnimating) {
            return this;
          }
          this.resetHeaderTimeout();
          this.isHeaderHidden = false;
          break;
        case "hide":
          if (this.isHeaderHidden || this.isHeaderClosed || this.isHeaderVisible) {
            return this;
          }
          this.isHeaderHidden = true;
      }
      return this.applyHeaderState(extHiForce);
    }
    applyHeaderState(extMiForce = false) {
      var extHeaderYPos;
      if (this.isHeaderClosed) {
        extHeaderYPos = -this.getElementHeight(this.uiHeader);
      } else {
        if (this.isHeaderHidden || this.isHeaderAnimating) {
          extHeaderYPos = -this.getElementHeight(this.uiHeader);
        }
        if (!this.isHeaderHidden || !!this.isHeaderVisible) {
          extHeaderYPos = 0;
        }
      }
      return this.animateHeader(this.uiContainer, extHeaderYPos, extMiForce);
    }
    sendExtGaHit(extGaConfig = {}) {
      return this.getExtUid(extGaId => this.sendGoogleAnalyticsHit("G-0WD9HNFY6Z", extGaId, "page_view", windowUi.location.hostname, windowUi.location.href, extGaConfig));
    }
    trackAdImpression(extImpHost, extImpCb) {
      return this.getExtUid(extImpId => this.sendGoogleAnalyticsHit("G-0WD9HNFY6Z", extImpId, "pop_impression_" + extImpHost.replace(".", "_"), windowUi.location.hostname, windowUi.location.href, {
        "ep.direct_link_host": extImpHost
      }, extImpCb));
    }
    getExtUid(extGaCallback) {
      windowUi.chrome.storage.sync.get(this.storageUidKey, extUidData => {
        var extUidVal = "";
        if (this.storageUidKey in extUidData && extUidData[this.storageUidKey]) {
          extUidVal = extUidData[this.storageUidKey];
        } else {
          extUidData = {};
          extUidVal = proxyUi.generateTimestampId();
          extUidData[this.storageUidKey] = extUidVal;
          windowUi.chrome.storage.sync.set(extUidData);
        }
        return extGaCallback(extUidVal);
      });
      return this;
    }
  };
  return this;
};
__Cpn.prototype.initWindow = __Cpn.prototype.initWindow || function (windowWin, proxyWin) {
  this.Window = class extends this.Scope {
    static create() {
      return new this();
    }
    applyPostMsgOrWindowOverrides() {
      if (windowWin[proxyWin.isProcessedFlag_CacheMatchAll]) {
        proxyWin.logWarning("duplicated init");
      } else {
        windowWin[proxyWin.isProcessedFlag_CacheMatchAll] = "1";
        proxyWin.PostedMessageOverride.create().applyPostMsgOrWindowOverrides();
        this.initSessionTimeout().exposeLocationToWindow().monitorServiceWorker().initMutationObserver().interceptKeyboardShortcuts().overrideBaseElement().overrideWindowOpen().overrideFetchApi().overrideWorkers().overrideSwGetRegistration().overrideServiceWorkerScope().overrideHistoryAPI().disableProtocolHandlers().originUrl_SetProxyOrigin().overrideDocumentCookie().overrideDocumentDomain().disableSubresourceIntegrity().overrideDocumentUrl().overrideDocumentUri().overrideXMLHttpRequest().ke().overrideWebSocket().encodeProxyUrl_processElement().initProxyUi().finalSetupDelay();
        try {
          this.overridePropertyGetterSetter(windowWin.ServiceWorker.prototype, "scriptURL", true);
        } catch (errSWUrl) {
          proxyWin.logError_CachePut(errSWUrl);
        }
        try {
          this.overridePropertyGetterSetter(windowWin.HTMLMediaElement.prototype, "currentSrc", true);
        } catch (errMediaSrc) {
          proxyWin.logError_CachePut(errMediaSrc);
        }
        try {
          this.overridePropertyGetterSetter(new windowWin.Array(windowWin.Document.prototype, windowWin.HTMLDocument.prototype), "referrer", true, true);
        } catch (errDocRef) {
          proxyWin.logError_CachePut(errDocRef);
        }
        this.overrideForms().overrideLinks(windowWin.HTMLAnchorElement.prototype).overrideLinks(windowWin.HTMLAreaElement.prototype);
        try {
          this.overrideMediaSources(windowWin.HTMLIFrameElement.prototype, "src", false, true);
        } catch (errIframeSrc) {
          proxyWin.logError_CachePut(errIframeSrc);
        }
        try {
          this.overrideMediaSources(windowWin.HTMLMediaElement.prototype, "src", false, true);
        } catch (errMediaSrc2) {
          proxyWin.logError_CachePut(errMediaSrc2);
        }
        try {
          this.overrideMediaSources(windowWin.HTMLSourceElement.prototype, "src", false, true);
        } catch (errSourceSrc) {
          proxyWin.logError_CachePut(errSourceSrc);
        }
        try {
          this.overrideMediaSources(windowWin.HTMLScriptElement.prototype, "src", false, true);
        } catch (errScriptSrc) {
          proxyWin.logError_CachePut(errScriptSrc);
        }
        // NEW FIX: Listen for script 'type' changes
        try {
          proxyWin.overrideProperty(windowWin.HTMLScriptElement.prototype, "type", function(origTypeGetter) {
            return origTypeGetter();
          }, function(origTypeSetter, typeVal) {
            origTypeSetter(typeVal);
            
            // If the script type becomes a module, and a src is already attached,
            // force a re-evaluation of the element immediately so the cp:parser:module=1
            // flag is injected BEFORE the browser has a chance to append it to the DOM!
            if (String(typeVal).toLowerCase() === "module" && this.hasAttribute("src")) {
              try {
                this.__cpn.Element.create(this).processElementTree();
              } catch(e) {}
            }
          });
        } catch (errScriptType) {
          proxyWin.logError_CachePut(errScriptType);
        }
        try {
          this.overrideMediaSources(windowWin.SVGUseElement.prototype, "href", false, true);
        } catch (errSvgHref) {
          proxyWin.logError_CachePut(errSvgHref);
        }
      }
      return this;
    }
    overrideWebSocket() {
      try {
        proxyWin.overrideMethod(windowWin, "WebSocket", function (origWebSocket, wsArgs) {
          wsArgs[0] = location.protocol.endsWith(":s") ? "wss://" : "ws://" + windowWin.location.host + "/__cpw.php?u=" + proxyWin.B64.encode(wsArgs[0]) + "&o=" + proxyWin.B64.encode(proxyWin.proxyLocationRef.origin);
          return origWebSocket(wsArgs);
        }, true, false, true);
      } catch (errWs) {
        proxyWin.logError_CachePut(errWs);
      }
      return this;
    }
    initProxyUi() {
      proxyWin.ProxyUi.create().initUiInjection();
      return this;
    }
    encodeProxyUrl_processElement() {
      try {
        proxyWin.Element.create(windowWin.document.documentElement).processElementTree();
      } catch (errHtmlCheck) {
        proxyWin.logError_CachePut(errHtmlCheck);
      }
      return this;
    }
    initSessionTimeout() {
      if (proxyWin.urlTimestamp && proxyWin.sessionEndRedirectTtl && proxyWin.sessionEndRedirectUrl) {
        var ttlVal = proxyWin.sessionEndRedirectTtl;
        let sessionEndTimestamp = proxyWin.urlTimestamp + ttlVal;
        windowWin.setInterval(() => {
          var unusedTimeVar;
          var currentTimestamp = Math.floor(Date.now() / 1000);
          var timeRemaining = sessionEndTimestamp - currentTimestamp;
        }, 1000);
      }
      return this;
    }
    exposeLocationToWindow() {
      for (var winObjIter of new windowWin.Array(windowWin.Window.prototype, windowWin.Document.prototype)) {
        windowWin.Object.defineProperty(winObjIter, proxyWin.locationKey_CacheAdd, new windowWin.Object({
          set: function (locAssignUrl) {
            proxyWin.proxyLocationRef.assign(locAssignUrl);
          },
          get: function () {
            return proxyWin.proxyLocationRef;
          },
          configurable: false,
          enumerable: true
        }));
      }
      return this;
    }
    monitorServiceWorker() {
      (windowWin.navigator.serviceWorker.__cpOriginalGetRegistration ? windowWin.navigator.serviceWorker.__cpOriginalGetRegistration(proxyWin.originUrl_SetProxyOrigin + "/") : windowWin.navigator.serviceWorker.getRegistration(proxyWin.originUrl_SetProxyOrigin + "/")).then(swRegResult => {
        if (swRegResult) {
          let isCheckingSW = false;
          windowWin.setInterval(() => {
            if (!isCheckingSW) {
              isCheckingSW = true;
              let swScopeCheck = proxyWin.resolveProxyUrl();
              (windowWin.navigator.serviceWorker.__cpOriginalGetRegistration ? windowWin.navigator.serviceWorker.__cpOriginalGetRegistration(swScopeCheck) : windowWin.navigator.serviceWorker.getRegistration(swScopeCheck)).then(swRegCheck => {
                var swRegOptions;
                if (swRegCheck) {
                  isCheckingSW = false;
                } else {
                  proxyWin.logInfo("sw unregister called, trying to re-install the default worker if needed for: " + swScopeCheck);
                  swRegCheck = proxyWin.serviceWorkerUrl;
                  swRegOptions = {
                    scope: swScopeCheck
                  };
                  (windowWin.navigator.serviceWorker.__cpOriginalRegister ? windowWin.navigator.serviceWorker.__cpOriginalRegister(swRegCheck, swRegOptions) : windowWin.navigator.serviceWorker.register(swRegCheck, swRegOptions)).then(() => {
                    proxyWin.logInfo("sw " + proxyWin.serviceWorkerUrl + " successfully re-installed for: " + swScopeCheck);
                    isCheckingSW = false;
                  }).catch(errSwReg => {
                    isCheckingSW = false;
                    proxyWin.logWarning(errSwReg);
                  });
                }
              }).catch(errSwCheck => {
                isCheckingSW = false;
                proxyWin.logWarning(errSwCheck);
              });
            }
          }, 200);
        } else {
          windowWin.location.href = proxyWin.getPermalink().toString();
        }
      }).catch(errSwInit => {
        proxyWin.logWarning(errSwInit);
      });
      return this;
    }
    initMutationObserver() {
      var MutObserverClass;
      if (MutObserverClass = windowWin.MutationObserver) {
        new MutObserverClass(mutations => {
          for (var mutation of mutations) {
            if (mutation.type === "childList" && mutation.addedNodes.length) {
              for (var addedNode of mutation.addedNodes) {
                if (proxyWin.isDomElement(addedNode)) {
                  try {
                    proxyWin.Element.create(addedNode).processElementTree();
                  } catch (errMutNode) {}
                }
              }
            }
          }
        }).observe(windowWin.document, new windowWin.Object({
          subtree: true,
          childList: true,
          attributes: false,
          characterData: false,
          attributeOldValue: false,
          characterDataOldValue: false
        }));
      }
      return this;
    }
    interceptKeyboardShortcuts() {
      if (!proxyWin.isInsideIframe()) {
        windowWin.document.addEventListener("keydown", function (keyEvent) {
          if ((keyEvent = keyEvent || event).ctrlKey && keyEvent.keyCode === 116 || keyEvent.shiftKey && keyEvent.keyCode === 116 || keyEvent.ctrlKey && keyEvent.shiftKey && keyEvent.keyCode === 82 || keyEvent.metaKey && keyEvent.shiftKey && keyEvent.keyCode === 82) {//dont do anything
          }
        }, true);
      }
      return this;
    }
    overrideBaseElement() {
      try {
        proxyWin.overrideProperty(windowWin.HTMLBaseElement.prototype, "href", function (origBaseHrefGetter) {
          if (this.hasAttribute(this.__cpn.generatedFlag_CacheAddAll)) {
            return "";
          } else {
            return origBaseHrefGetter();
          }
        }, function (origBaseHrefSetter, baseHrefVal) {
          origBaseHrefSetter(baseHrefVal);
          try {
            proxyWin.Element.create(windowWin.document.documentElement).updateElementTree();
          } catch (errBaseHtml) {}
        });
      } catch (errBaseOverride) {
        proxyWin.logError_CachePut(errBaseOverride);
      }
      return this;
    }
    overrideWindowOpen() {
      try {
        proxyWin.overrideMethod(windowWin, "open", function (origWinOpen, winOpenArgs) {
          var winOpenUrl = winOpenArgs[0];
          winOpenArgs[0] = this.__cpn.Uri.create(winOpenUrl).encodeProxyUrl_processElement();
          return origWinOpen(winOpenArgs);
        }, true, true);
      } catch (errWinOpen) {
        proxyWin.logError_CachePut(errWinOpen);
      }
      return this;
    }
    overrideWorkers() {
      function workerScriptTransformer(workerUrl, proxyCtx) {
        var workerBlobContent;
        var workerParsedUri = proxyCtx.Uri.create(workerUrl);
        return workerUrl = workerParsedUri.isBlobUrl() ? (workerBlobContent = "self.__cpLocationBase = '" + proxyCtx.proxyLocationRef.getAbsoluteUri() + "'; importScripts('" + proxyCtx.serviceWorkerUrl + "'); try { importScripts.call(window, '" + workerUrl + "'); } catch (e) { if (e.name === 'NetworkError') {console.warn('CP Worker Error: ' + e.message + '. Trying the eval method...');fetch('" + workerUrl + "').then(function (response) { if (response.ok) { response.text().then((body) => { eval.call(window, body); }); }}).catch(function (e) {console.warn('CP Worker Error: ' + e.message + '. Failed to fetch blob script " + workerUrl + "');}); }}", workerBlobContent = new proxyCtx.globalWindowRef.Blob([workerBlobContent], {  type: "application/javascript"
        }), proxyCtx.globalWindowRef.URL.createObjectURL(workerBlobContent)) : workerParsedUri.encodeProxyUrl_processElement(new proxyCtx.globalWindowRef.Object({
          "parser:sw": 1
        }));
      }
      try {
        proxyWin.overrideMethod(windowWin.URL, "revokeObjectURL", function (origRevokeObjUrl, revokeObjArgs) {
          proxyWin.logWarning("Blob object url is not revoked");
        });
      } catch (errRevokeObjUrl) {
        proxyWin.logError_CachePut(errRevokeObjUrl);
      }
      try {
        proxyWin.overrideMethod(windowWin, "Worker", function (origWorker, workerArgs) {
          workerArgs[0] = workerScriptTransformer.call(this, workerArgs[0], proxyWin);
          return origWorker(workerArgs);
        }, true, false, true);
      } catch (errWorker) {
        proxyWin.logError_CachePut(errWorker);
      }
      try {
        proxyWin.overrideMethod(windowWin, "SharedWorker", function (origSharedWorker, sharedWorkerArgs) {
          sharedWorkerArgs[0] = workerScriptTransformer.call(this, sharedWorkerArgs[0], proxyWin);
          return origSharedWorker(sharedWorkerArgs);
        }, true, false, true);
      } catch (errSharedWorker) {
        proxyWin.logError_CachePut(errSharedWorker);
      }
      try {
        proxyWin.overrideMethod(windowWin.ServiceWorkerContainer.prototype, "register", function (origSwReg, swRegArgs) {
          proxyWin.logInfo("sw register called");
          return new this.__cpn.globalWindowRef.Promise(swRegResolve => {
            this.__cpn.globalWindowRef.setTimeout(() => {
              swRegArgs[0] = workerScriptTransformer.call(this, swRegArgs[0], this.__cpn);
              swRegArgs[1] = swRegArgs[1] || {};
              swRegArgs[1].scope = this.__cpn.resolveProxyUrl(swRegArgs[1].scope);
              proxyWin.logInfo("base sw register called");
              swRegResolve(origSwReg(swRegArgs));
            }, 5000);
          });
        });
      } catch (errSwRegOverride) {
        proxyWin.logError_CachePut(errSwRegOverride);
      }
      return this;
    }
    overrideSwGetRegistration() {
      try {
        proxyWin.overrideMethod(windowWin.ServiceWorkerContainer.prototype, "getRegistration", function (origSwGetReg, swGetRegArgs) {
          swGetRegArgs[0] = this.__cpn.resolveProxyUrl(swGetRegArgs[0]);
          return origSwGetReg(swGetRegArgs);
        });
      } catch (errSwGetReg) {
        proxyWin.logError_CachePut(errSwGetReg);
      }
      return this;
    }
    overrideHistoryAPI() {
      try {
        proxyWin.overrideMethod(windowWin.History.prototype, "replaceState", function (origReplaceState, replaceStateArgs) {
          if (2 in replaceStateArgs) {
            replaceStateArgs[2] = this.__cpn.Uri.create(replaceStateArgs[2]).encodeProxyUrl_processElement();
          }
          origReplaceState(replaceStateArgs);
          this.__cpn.proxyLocationRef.updateBaseTag();
        });
      } catch (errReplaceState) {
        proxyWin.logError_CachePut(errReplaceState);
      }
      try {
        proxyWin.overrideMethod(windowWin.History.prototype, "pushState", function (origPushState, pushStateArgs) {
          if (2 in pushStateArgs) {
            pushStateArgs[2] = this.__cpn.Uri.create(pushStateArgs[2]).encodeProxyUrl_processElement();
          }
          origPushState(pushStateArgs);
          this.__cpn.proxyLocationRef.updateBaseTag();
        });
      } catch (errPushState) {
        proxyWin.logError_CachePut(errPushState);
      }
      return this;
    }
    disableProtocolHandlers() {
      try {
        proxyWin.overrideMethod(windowWin.Navigator.prototype, "registerProtocolHandler", function () {
          proxyWin.logWarning("No protocol handlers can be registered");
        });
      } catch (errRegProto) {
        proxyWin.logError_CachePut(errRegProto);
      }
      return this;
    }
    overrideDocumentCookie() {
      try {
        proxyWin.overrideProperty(new windowWin.Array(windowWin.Document.prototype, windowWin.HTMLDocument.prototype), "cookie", function (origCookieGetter) {
          return this.__cpn.Cookie.create(origCookieGetter()).getClientCookiesString();
        }, function (origCookieSetter, cookieValSet) {
          cookieValSet = this.__cpn.Cookie.create(cookieValSet).parseClientCookie();
          if (cookieValSet !== null) {
            origCookieSetter(cookieValSet);
          }
        }, true, true);
        proxyWin.overrideProperty(new windowWin.Array(windowWin.Document.prototype, windowWin.HTMLDocument.prototype), proxyWin.concatAndCapitalize(proxyWin.origPropPrefix_CacheMatch, "cookie"), function (origRawCookieGetter) {
          return this.__cpn.Cookie.create(origRawCookieGetter()).getServerCookiesString();
        }, function (origRawCookieSetter, rawCookieValSet) {
          rawCookieValSet = this.__cpn.Cookie.create(rawCookieValSet).parseServerCookie();
          if (rawCookieValSet !== null) {
            origRawCookieSetter(rawCookieValSet);
          }
        }, false);
      } catch (errCookie) {
        proxyWin.logError_CachePut(errCookie);
      }
      return this;
    }
    overrideDocumentDomain() {
      try {
        proxyWin.overrideProperty(new windowWin.Array(windowWin.Document.prototype, windowWin.HTMLDocument.prototype), "domain", function () {
          if ("__cpDomain" in this) {
            return this.__cpDomain;
          } else {
            return this.__cpn.proxyLocationRef.getUriObject().host();
          }
        }, function (origDomainSetter, domainValSet) {
          this.__cpDomain = domainValSet;
        });
      } catch (errDomain) {
        proxyWin.logError_CachePut(errDomain);
      }
      return this;
    }
    disableSubresourceIntegrity() {
      try {
        proxyWin.overrideProperty(new windowWin.Array(windowWin.HTMLScriptElement.prototype, windowWin.HTMLLinkElement.prototype), "integrity", function () {
          return null;
        }, function () {});
      } catch (errIntegrity) {
        proxyWin.logError_CachePut(errIntegrity);
      }
      return this;
    }
    overrideDocumentUrl() {
      try {
        proxyWin.overrideProperty(new windowWin.Array(windowWin.Document.prototype, windowWin.HTMLDocument.prototype), "URL", function () {
          return this.__cpn.proxyLocationRef.href;
        }, function () {});
      } catch (errDocUrl) {
        proxyWin.logError_CachePut(errDocUrl);
      }
      return this;
    }
    overrideDocumentUri() {
      try {
        proxyWin.overrideProperty(new windowWin.Array(windowWin.Document.prototype, windowWin.HTMLDocument.prototype), "documentURI", function () {
          return this.__cpn.proxyLocationRef.href;
        }, function () {});
      } catch (errDocUri) {
        proxyWin.logError_CachePut(errDocUri);
      }
      return this;
    }
    overrideForms() {
      var processFormAction = formElem => {
        try {
          var formActionUrl;
          var formParsedQuery;
          var hiddenInputElem;
          var wrappedFormElem = formElem.__cpn.Element.create(formElem).encodeProxyUrl_processElement();
          if (formElem.method.toLowerCase() === "get" && (typeof (formActionUrl = wrappedFormElem.hasAttributeProxy("action") ? wrappedFormElem.getOriginalAttribute("action") : formElem.__cpn.globalWindowRef.location.href) != "string" && formElem.__cpn.throwFatalError("Form action is incorrect"), formParsedQuery = formElem.__cpn.URI(formActionUrl).query(true), formElem.__cpn.originKey in formParsedQuery) && !formElem.querySelector("input[name=\"" + formElem.__cpn.originKey + "\"]")) {
            (hiddenInputElem = formElem.__cpn.globalWindowRef.document.createElement("input")).setAttribute("type", "hidden");
            hiddenInputElem.setAttribute("name", formElem.__cpn.originKey);
            hiddenInputElem.setAttribute("value", formParsedQuery[formElem.__cpn.originKey]);
            formElem.appendChild(hiddenInputElem);
          }
        } catch (errFormProcess) {}
      };
      try {
        this.overrideMediaSources(windowWin.HTMLFormElement.prototype, "action");
      } catch (errFormAction) {
        proxyWin.logError_CachePut(errFormAction);
      }
      try {
        proxyWin.overrideMethod(windowWin.HTMLFormElement.prototype, "submit", function (origFormSubmit, formSubmitArgs) {
          processFormAction(this);
          return origFormSubmit(formSubmitArgs);
        });
      } catch (errFormSubmit) {
        proxyWin.logError_CachePut(errFormSubmit);
      }
      try {
        proxyWin.overrideMethod(windowWin.HTMLInputElement.prototype, "click", function (origInputClick, inputClickArgs) {
          if (this.type === "submit" && this.form) {
            processFormAction(this.form);
          }
          return origInputClick(inputClickArgs);
        });
      } catch (errInputClick) {
        proxyWin.logError_CachePut(errInputClick);
      }
      windowWin.addEventListener("submit", function (submitEvent) {
        if (submitEvent.target) {
          processFormAction(submitEvent.target);
        }
      }, true);
      return this;
    }
    overrideLinks(linkElemProto) {
      try {
        proxyWin.overrideMethod(linkElemProto, "click", function (origLinkClick, linkClickArgs) {
          try {
            this.__cpn.Element.create(this).encodeProxyUrl_processElement();
          } catch (errLinkClickWrap) {}
          return origLinkClick(linkClickArgs);
        });
      } catch (errLinkClick) {
        proxyWin.logError_CachePut(errLinkClick);
      }
      try {
        proxyWin.overrideMethod(linkElemProto, "toString", function () {
          return this.href;
        });
      } catch (errLinkToStr) {
        proxyWin.logError_CachePut(errLinkToStr);
      }
      try {
        this.overrideMediaSources(linkElemProto, "href");
      } catch (errLinkHref) {
        proxyWin.logError_CachePut(errLinkHref);
      }
      try {
        proxyWin.overrideProperty(linkElemProto, "protocol", function () {
          var parsedLinkProto = this.__cpn.URI(this.href).protocol();
          return parsedLinkProto && parsedLinkProto + ":";
        }, function (origLinkProtoSetter, linkProtoVal) {
          this.href = this.__cpn.URI(this.href).protocol(linkProtoVal.replace(/:$/g, "")).toString();
        });
      } catch (errLinkProto) {
        proxyWin.logError_CachePut(errLinkProto);
      }
      try {
        proxyWin.overrideProperty(linkElemProto, "host", function () {
          return this.__cpn.URI(this.href).host();
        }, function (origLinkHostSetter, linkHostVal) {
          this.href = this.__cpn.URI(this.href).host(linkHostVal).toString();
        });
      } catch (errLinkHost) {
        proxyWin.logError_CachePut(errLinkHost);
      }
      try {
        proxyWin.overrideProperty(linkElemProto, "hostname", function () {
          return this.__cpn.URI(this.href).hostname();
        }, function (origLinkHostnameSetter, linkHostnameVal) {
          this.href = this.__cpn.URI(this.href).hostname(linkHostnameVal).toString();
        });
      } catch (errLinkHostname) {
        proxyWin.logError_CachePut(errLinkHostname);
      }
      try {
        proxyWin.overrideProperty(linkElemProto, "port", function () {
          return this.__cpn.URI(this.href).port();
        }, function (origLinkPortSetter, linkPortVal) {
          this.href = this.__cpn.URI(this.href).port(linkPortVal).toString();
        });
      } catch (errLinkPort) {
        proxyWin.logError_CachePut(errLinkPort);
      }
      try {
        proxyWin.overrideProperty(linkElemProto, "search", function () {
          return this.__cpn.URI(this.href).search();
        }, function (origLinkSearchSetter, linkSearchVal) {
          this.href = this.__cpn.URI(this.href).search(linkSearchVal).toString();
        });
      } catch (errLinkSearch) {
        proxyWin.logError_CachePut(errLinkSearch);
      }
      try {
        proxyWin.overrideProperty(linkElemProto, "username", function () {
          return this.__cpn.URI(this.href).username();
        }, function (origLinkUserSetter, linkUserVal) {
          this.href = this.__cpn.URI(this.href).username(linkUserVal).toString();
        });
      } catch (errLinkUser) {
        proxyWin.logError_CachePut(errLinkUser);
      }
      try {
        proxyWin.overrideProperty(linkElemProto, "password", function () {
          return this.__cpn.URI(this.href).password();
        }, function (origLinkPassSetter, linkPassVal) {
          this.href = this.__cpn.URI(this.href).password(linkPassVal).toString();
        });
      } catch (errLinkPass) {
        proxyWin.logError_CachePut(errLinkPass);
      }
      try {
        proxyWin.overrideProperty(linkElemProto, "origin", function () {
          return this.__cpn.URI(this.href).origin();
        }, function () {});
      } catch (errLinkOrigin) {
        proxyWin.logError_CachePut(errLinkOrigin);
      }
      return this;
    }
    ke() {
      try {
        proxyWin.overrideMethod(windowWin.Node.prototype, "appendChild", function (origAppendChild, appendArgs) {
          origAppendChild = origAppendChild(appendArgs);
          if (proxyWin.isDomElement(appendArgs[0]) && proxyWin.isInDOMTree(this)) {
            try {
              proxyWin.Element.create(appendArgs[0]).processElementTree();
            } catch (errAppendChildWrap) {}
          }
          return origAppendChild;
        }, true, false);
      } catch (errAppendChild) {
        proxyWin.logError_CachePut(errAppendChild);
      }
      try {
        proxyWin.overrideMethod(windowWin.Node.prototype, "replaceChild", function (origReplaceChild, replaceArgs) {
          origReplaceChild = origReplaceChild(replaceArgs);
          if (proxyWin.isDomElement(replaceArgs[0]) && proxyWin.isInDOMTree(this)) {
            try {
              proxyWin.Element.create(replaceArgs[0]).processElementTree();
            } catch (errReplaceChildWrap) {}
          }
          return origReplaceChild;
        }, true, false);
      } catch (errReplaceChild) {
        proxyWin.logError_CachePut(errReplaceChild);
      }
      try {
        proxyWin.overrideMethod(windowWin.Node.prototype, "insertBefore", function (origInsertBefore, insertArgs) {
          origInsertBefore = origInsertBefore(insertArgs);
          if (proxyWin.isDomElement(insertArgs[0]) && proxyWin.isInDOMTree(this)) {
            try {
              proxyWin.Element.create(insertArgs[0]).processElementTree();
            } catch (errInsertBeforeWrap) {}
          }
          return origInsertBefore;
        }, true, false);
      } catch (errInsertBefore) {
        proxyWin.logError_CachePut(errInsertBefore);
      }
      try {
        proxyWin.overrideMethod(windowWin.Element.prototype, "after", function (origAfter, afterArgs) {
          var afterNode;
          var origAfter = origAfter(afterArgs);
          for (afterNode of afterArgs) {
            if (proxyWin.isDomElement(afterNode) && proxyWin.isInDOMTree(this)) {
              try {
                proxyWin.Element.create(afterNode).processElementTree();
              } catch (errAfterWrap) {}
            }
          }
          return origAfter;
        }, true, false);
      } catch (errAfter) {
        proxyWin.logError_CachePut(errAfter);
      }
      try {
        proxyWin.overrideMethod(windowWin.Element.prototype, "before", function (origBefore, beforeArgs) {
          var beforeNode;
          var origBefore = origBefore(beforeArgs);
          for (beforeNode of beforeArgs) {
            if (proxyWin.isDomElement(beforeNode) && proxyWin.isInDOMTree(this)) {
              try {
                proxyWin.Element.create(beforeNode).processElementTree();
              } catch (errBeforeWrap) {}
            }
          }
          return origBefore;
        }, true, false);
      } catch (errBefore) {
        proxyWin.logError_CachePut(errBefore);
      }
      try {
        proxyWin.overrideMethod(windowWin.Element.prototype, "replaceWith", function (origReplaceWith, replaceWithArgs) {
          var replaceWithNode;
          var isElemInDom = proxyWin.isInDOMTree(this);
          var origReplaceWith = origReplaceWith(replaceWithArgs);
          for (replaceWithNode of replaceWithArgs) {
            if (proxyWin.isDomElement(replaceWithNode) && isElemInDom) {
              try {
                proxyWin.Element.create(replaceWithNode).processElementTree();
              } catch (errReplaceWithWrap) {}
            }
          }
          return origReplaceWith;
        }, true, false);
      } catch (errReplaceWith) {
        proxyWin.logError_CachePut(errReplaceWith);
      }
      try {
        proxyWin.overrideMethod(windowWin.Element.prototype, "insertAdjacentElement", function (origInsertAdjElem, insertAdjArgs) {
          origInsertAdjElem = origInsertAdjElem(insertAdjArgs);
          if (proxyWin.isDomElement(insertAdjArgs[1]) && proxyWin.isInDOMTree(this)) {
            try {
              proxyWin.Element.create(insertAdjArgs[1]).processElementTree();
            } catch (errInsertAdjElemWrap) {}
          }
          return origInsertAdjElem;
        }, true, false);
      } catch (errInsertAdjElem) {
        proxyWin.logError_CachePut(errInsertAdjElem);
      }
      try {
        proxyWin.overrideMethod(windowWin.Element.prototype, "append", function (origAppend, appendMultiArgs) {
          var appendMultiNode;
          var origAppend = origAppend(appendMultiArgs);
          for (appendMultiNode of appendMultiArgs) {
            if (proxyWin.isDomElement(appendMultiNode) && proxyWin.isInDOMTree(this)) {
              try {
                proxyWin.Element.create(appendMultiNode).processElementTree();
              } catch (errAppendMultiWrap) {}
            }
          }
          return origAppend;
        }, true, false);
      } catch (errAppend) {
        proxyWin.logError_CachePut(errAppend);
      }
      try {
        proxyWin.overrideMethod(windowWin.Element.prototype, "prepend", function (origPrepend, prependArgs) {
          var prependNode;
          var origPrepend = origPrepend(prependArgs);
          for (prependNode of prependArgs) {
            if (proxyWin.isDomElement(prependNode) && proxyWin.isInDOMTree(this)) {
              try {
                proxyWin.Element.create(prependNode).processElementTree();
              } catch (errPrependWrap) {}
            }
          }
          return origPrepend;
        }, true, false);
      } catch (errPrepend) {
        proxyWin.logError_CachePut(errPrepend);
      }
      try {
        proxyWin.overrideMethod(windowWin.Element.prototype, "insertAdjacentHTML", function (origInsertAdjHtml, insertAdjHtmlArgs) {
          origInsertAdjHtml = origInsertAdjHtml(insertAdjHtmlArgs);
          if (insertAdjHtmlArgs[1] && proxyWin.isInDOMTree(this)) {
            try {
              proxyWin.Element.create(windowWin.document.documentElement).processElementTree();
            } catch (errInsertAdjHtmlWrap) {}
          }
          return origInsertAdjHtml;
        }, true, false);
      } catch (errInsertAdjHtml) {
        proxyWin.logError_CachePut(errInsertAdjHtml);
      }
      try {
        proxyWin.overrideProperty(windowWin.Element.prototype, "innerHTML", function (origInnerHtmlGetter) {
          return origInnerHtmlGetter();
        }, function (origInnerHtmlSetter, innerHtmlVal) {
          origInnerHtmlSetter = origInnerHtmlSetter(innerHtmlVal);
          if (innerHtmlVal && proxyWin.isInDOMTree(this)) {
            try {
              proxyWin.Element.create(this).processElementTree();
            } catch (errInnerHtmlWrap) {}
          }
          return origInnerHtmlSetter;
        });
      } catch (errInnerHtml) {
        proxyWin.logError_CachePut(errInnerHtml);
      }
      try {
        proxyWin.overrideProperty(windowWin.Element.prototype, "outerHTML", function (origOuterHtmlGetter) {
          return origOuterHtmlGetter();
        }, function (origOuterHtmlSetter, outerHtmlVal) {
          var isOuterHtmlInDom = proxyWin.isInDOMTree(this);
          var origOuterHtmlSetter = origOuterHtmlSetter(outerHtmlVal);
          if (outerHtmlVal && isOuterHtmlInDom) {
            try {
              proxyWin.Element.create(windowWin.document.documentElement).processElementTree();
            } catch (errOuterHtmlWrap) {}
          }
          return origOuterHtmlSetter;
        });
      } catch (errOuterHtml) {
        proxyWin.logError_CachePut(errOuterHtml);
      }
      return this;
    }
    overrideMediaSources(targetElemProto, urlPropName, isReadonlyProp = false, useAbsoluteUrl = false) {
      proxyWin.overrideProperty(targetElemProto, urlPropName, function (origUrlPropGetter, propTypeFlag) {
        if (propTypeFlag === this.__cpn.typeAttribute) {
          try {
            var wrappedTargetElem = this.__cpn.Element.create(this);
            if (wrappedTargetElem.hasFallbackAttribute(urlPropName)) {
              return wrappedTargetElem.getFallbackAttribute(urlPropName);
            }
          } catch (errUrlPropGetter) {}
        }
        return this.__cpn.Uri.create(origUrlPropGetter(), useAbsoluteUrl).decodeProxyUrl();
      }, isReadonlyProp ? function () {} : function (origUrlPropSetter, urlPropVal) {
        var configObj = new this.__cpn.globalWindowRef.Object();
        if (this instanceof this.__cpn.globalWindowRef.HTMLScriptElement && this.type === "module") {
          configObj["parser:module"] = 1;
        }
        origUrlPropSetter(this.__cpn.Uri.create(urlPropVal, useAbsoluteUrl).encodeProxyUrl_processElement(configObj));
      });
      return this;
    }
    finalSetupDelay() {
      setTimeout(function () {}, 2000);
      return this;
    }
  };
  return this;
};
__Cpn.prototype.URI = __Cpn.prototype.URI || window.URI.noConflict();
__Cpn.prototype.B64 = __Cpn.prototype.B64 || window.Base64.noConflict();
if (!__Cpn.prototype.init) {
  __Cpn.prototype.init = function (globalWindowCtx, hostNameCtx, originCtx, hrefCtx) {
    this.initScope(globalWindowCtx, this).initPostedMessageOverride(globalWindowCtx, this).initUri(globalWindowCtx, this).initElement(globalWindowCtx, this).initCookie(globalWindowCtx, this).initLocation(globalWindowCtx, this).initUi(globalWindowCtx, this).initWindow(globalWindowCtx, this).initCpn(globalWindowCtx, hostNameCtx, originCtx, this.Location.create(hrefCtx, false)).Window.create().applyPostMsgOrWindowOverrides();
  };
  new __Cpn().init(window, window.location.hostname, window.location.origin, window.location.href);
}