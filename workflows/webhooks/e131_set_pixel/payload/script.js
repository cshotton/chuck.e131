"use strict";
const MODULE_NAME = "workflow:chuck.e131/webhooks/e131_set_pixel";
const debug = require('debug')(MODULE_NAME);
debug.log = console.info.bind(console);

const Promise = require("bluebird");

const DEFAULT_HOST = "http://localhost:3131";
const COMMAND = "e131_set_pixel";

function _normalizeSmartQuotes(val) {
    if (typeof val !== "string") return val;
    return val.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");
}

function _parseJsonSafe(val, fallback) {
    if (val === null || typeof val === "undefined") return fallback;
    if (typeof val === "object") return val;
    if (typeof val !== "string") return fallback;
    try { return JSON.parse(_normalizeSmartQuotes(val)); } catch (err) { return fallback; }
}

function _normalizeHost(...vals) {
    for (const v of vals) {
        if (typeof v === "string" && v.trim().length > 0) {
            return v.trim().replace(/\/+$/, "");
        }
    }
    return DEFAULT_HOST;
}

function _toInt(val, fallback) {
    const n = Number(val);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function _clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

function _normalizeColor(val, fallback) {
    if (typeof val === "number" && Number.isFinite(val)) {
        return (val & 0xffffff).toString(16).padStart(6, "0");
    }
    if (typeof val === "string") {
        const c = val.trim().replace(/^#/, "").replace(/^0x/i, "");
        if (/^[0-9a-fA-F]{6}$/.test(c)) return c.toLowerCase();
    }
    return fallback;
}

function _parseTextHints(txt) {
    if (typeof txt !== "string") return {};
    const out = {};
    const pairRe = /\b(host|x|y|color)\s*[:=]\s*([^,\s]+)/gi;
    let m;
    while ((m = pairRe.exec(txt)) !== null) {
        out[m[1].toLowerCase()] = m[2];
    }
    if (!out.color) {
        const cm = txt.match(/\b([0-9a-fA-F]{6})\b/);
        if (cm) out.color = cm[1];
    }
    return out;
}

function _parsePositional(txt, keys) {
    if (typeof txt !== "string") return {};
    const t = txt.trim();
    if (t.startsWith("{") || t.startsWith("[")) return {};
    const parts = t.split(",").map(s => s.trim()).filter(Boolean);
    const out = {};
    keys.forEach((k, i) => { if (parts[i] !== undefined) out[k] = parts[i]; });
    return out;
}

function _matchesCommand(txt) {
    if (typeof txt !== "string") return true;
    const trimmed = txt.trim();
    if (!trimmed.startsWith("/")) return true;
    const match = trimmed.match(/^\/([^\s]+)\b/);
    return !!(match && match[1] === COMMAND);
}

function _stripCommand(txt) {
    if (typeof txt !== "string") return "";
    return txt.trim().replace(/^\/[^\s]+\s*/, "");
}

async function _invokeHttp(wfProxy, authData, method, url, mimeType, payload) {
    const blockRes = await wfProxy.CallServerBlock(authData, "call_web_service", {
        method: method,
        url: url,
        mime_type: mimeType,
        headers: "{}",
        payload: payload
    });
    const upstream = wfProxy.getGlobalValue("__results__");
    return { blockRes, upstream };
}

function _makeResp(tAgentName, tUserName, tid, text) {
    return {
        from: tAgentName || "e131_set_pixel",
        id: tid || "",
        args: [{
            username: tUserName || "system",
            text: text,
            timestamp: Date.now(),
            type: "text/plain"
        }]
    };
}

async function preflight(authData, wfProxy) {
    const wha = wfProxy.getGlobalValue("webhook_args") || {};
    const tAgentName = wha.tagentname;
    const tUserName = wha.tusername;
    const tid = wha.tid;
    const tPublish = wha.tpublish === true || wha.tpublish === "true";
    const rawText = wha.args && wha.args[0] ? wha.args[0].text : "";

    if (!_matchesCommand(rawText)) {
        wfProxy.setGlobalValue("tpublish", false);
        return Promise.resolve({ success: true });
    }

    const messageText = _stripCommand(rawText);

    const targs = _parseJsonSafe(wha.targs, {});
    const textObj = _parseJsonSafe(messageText, {});
    const positional = _parsePositional(messageText, ["x", "y", "color"]);
    const hints = _parseTextHints(messageText);

    const host = _normalizeHost(wha.host, targs.host, textObj.host, hints.host);
    const x = _clamp(_toInt(wha.x ?? targs.x ?? textObj.x ?? positional.x ?? hints.x, 0), 0, 7);
    const y = _clamp(_toInt(wha.y ?? targs.y ?? textObj.y ?? positional.y ?? hints.y, 0), 0, 7);
    const color = _normalizeColor(wha.color ?? targs.color ?? textObj.color ?? positional.color ?? hints.color, "ff0000");

    const url = `${host}/led/set/${x}/${y}/${color}`;

    try {
        const { blockRes, upstream } = await _invokeHttp(wfProxy, authData, "GET", url, "", null);
        const ok = !!(blockRes && !blockRes.runtime_err && blockRes.path !== wfProxy.PATH_FAILURE);
        const resp = _makeResp(tAgentName, tUserName, tid, ok ? "OK" : "ERR");
        wfProxy.setGlobalValue("resp", resp);
        wfProxy.setGlobalValue("tpublish", tPublish);
        return Promise.resolve({ success: true });
    } catch (err) {
        debug(`preflight error: ${err.message}`);
        const resp = _makeResp(tAgentName, tUserName, tid, "ERR");
        wfProxy.setGlobalValue("resp", resp);
        wfProxy.setGlobalValue("tpublish", tPublish);
        return Promise.resolve({ success: true });
    }
}

function begin(authData, wfProxy, step, theForm) {
    return Promise.resolve({ success: true, args: { form: theForm, formValues: wfProxy.getGlobalValue("formData"), formErrors: wfProxy.getGlobalValue("formErrors") } });
}
function end(authData, wfProxy, step, formData) {
    return Promise.resolve({ success: true, path: wfProxy.PATH_SUCCESS, args: formData });
}
function postflight(authData, wfProxy) { return Promise.resolve({ success: true }); }
function terminate(authData, wfProxy) { return Promise.resolve({ success: true }); }

module.exports = { preflight, postflight, begin, end, terminate };
