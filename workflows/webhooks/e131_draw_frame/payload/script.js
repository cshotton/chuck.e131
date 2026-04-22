"use strict";
const MODULE_NAME = "workflow:chuck.e131/webhooks/e131_draw_frame";
const debug = require('debug')(MODULE_NAME);
debug.log = console.info.bind(console);

const Promise = require("bluebird");

const DEFAULT_HOST = "http://localhost:3131";
const COMMAND = "e131_draw_frame";

function _parseJsonSafe(val, fallback) {
    if (val === null || typeof val === "undefined") return fallback;
    if (typeof val === "object") return val;
    if (typeof val !== "string") return fallback;
    try { return JSON.parse(val); } catch (err) { return fallback; }
}

function _normalizeHost(...vals) {
    for (const v of vals) {
        if (typeof v === "string" && v.trim().length > 0) {
            return v.trim().replace(/\/+$/, "");
        }
    }
    return DEFAULT_HOST;
}

function _defaultFrame() {
    const frame = [];
    for (let x = 0; x < 8; x++) {
        frame[x] = [];
        for (let y = 0; y < 8; y++) {
            frame[x][y] = 0;
        }
    }
    return frame;
}

function _normalizeFrameCell(val) {
    if (typeof val === "number" && Number.isFinite(val)) {
        return Math.trunc(val) & 0xffffff;
    }
    if (typeof val === "string") {
        const t = val.trim();
        const hex = t.replace(/^#/, "").replace(/^0x/i, "");
        if (/^[0-9a-fA-F]{6}$/.test(hex)) {
            return parseInt(hex, 16) & 0xffffff;
        }
        const n = Number(t);
        if (Number.isFinite(n)) return Math.trunc(n) & 0xffffff;
    }
    return 0;
}

function _normalizeFrame(frame) {
    const fallback = _defaultFrame();
    if (!Array.isArray(frame)) return fallback;
    if (frame.length !== 8) return fallback;
    for (let x = 0; x < 8; x++) {
        if (!Array.isArray(frame[x]) || frame[x].length !== 8) return fallback;
    }
    const out = _defaultFrame();
    for (let x = 0; x < 8; x++) {
        for (let y = 0; y < 8; y++) {
            out[x][y] = _normalizeFrameCell(frame[x][y]);
        }
    }
    return out;
}

function _extractFrameFromText(txt) {
    if (typeof txt !== "string") return null;
    const parsed = _parseJsonSafe(txt, null);
    if (parsed && parsed.frame) return parsed.frame;
    return null;
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
        from: tAgentName || "e131_draw_frame",
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

    const host = _normalizeHost(wha.host, targs.host, textObj.host);
    const sourceFrame = wha.frame || targs.frame || textObj.frame || _extractFrameFromText(messageText);
    const frame = _normalizeFrame(sourceFrame);

    const url = `${host}/led/drawframe`;

    try {
        const { blockRes, upstream } = await _invokeHttp(wfProxy, authData, "POST", url, "application/json", { frame });
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
