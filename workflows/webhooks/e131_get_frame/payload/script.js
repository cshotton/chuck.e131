"use strict";
const MODULE_NAME = "workflow:chuck.e131/webhooks/e131_get_frame";
const debug = require('debug')(MODULE_NAME);
debug.log = console.info.bind(console);

const Promise = require("bluebird");

const DEFAULT_HOST = "http://localhost:3131";
const COMMAND = "e131_get_frame";

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

function _asPlainText(val) {
    if (typeof val === "string") return val;
    if (typeof val === "undefined" || val === null) return "";
    try { return JSON.stringify(val); } catch (err) { return String(val); }
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
        from: tAgentName || "e131_get_frame",
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
    const url = `${host}/led/getframe`;

    try {
        const { blockRes, upstream } = await _invokeHttp(wfProxy, authData, "GET", url, "", null);
        const ok = !!(blockRes && !blockRes.runtime_err && blockRes.path !== wfProxy.PATH_FAILURE);
        const resp = _makeResp(tAgentName, tUserName, tid, ok ? _asPlainText(upstream) : "ERR");
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
