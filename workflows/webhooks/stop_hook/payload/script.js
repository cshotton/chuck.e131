"use strict";
const MODULE_NAME = "workflow:chuck.e131/webhooks/stop_hook";
const debug = require('debug')(MODULE_NAME);
debug.log = console.info.bind(console);
const Promise = require("bluebird");

function preflight(authData, wfProxy) { return Promise.resolve({ success: true }); }
function begin(authData, wfProxy, step, theForm) {
    return Promise.resolve({ success: true, args: { form: theForm, formValues: wfProxy.getGlobalValue("formData"), formErrors: wfProxy.getGlobalValue("formErrors") } });
}
function end(authData, wfProxy, step, formData) { return Promise.resolve({ success: true, path: wfProxy.PATH_SUCCESS, args: formData }); }
function postflight(authData, wfProxy) { return Promise.resolve({ success: true }); }
function terminate(authData, wfProxy) { return Promise.resolve({ success: true }); }

module.exports = { preflight, postflight, begin, end, terminate };
