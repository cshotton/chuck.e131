"use strict";
const MODULE_NAME = "workflow:chuck.e131/manager/test_draw_frame";
const debug = require('debug')(MODULE_NAME);
debug.log = console.info.bind(console);
const Promise = require("bluebird");

function preflight(authData, wfProxy) {
    const args = {
        frame: [
            [0xff0000, 0, 0, 0, 0, 0, 0, 0],
            [0, 0xff0000, 0, 0, 0, 0, 0, 0],
            [0, 0, 0xff0000, 0, 0, 0, 0, 0],
            [0, 0, 0, 0xff0000, 0, 0, 0, 0],
            [0, 0, 0, 0, 0xff0000, 0, 0, 0],
            [0, 0, 0, 0, 0, 0xff0000, 0, 0],
            [0, 0, 0, 0, 0, 0, 0xff0000, 0],
            [0, 0, 0, 0, 0, 0, 0, 0xff0000]
        ],
        wf_webhook_args: { host: "http://localhost:3131" }
    };

    return wfProxy.CallServerBlock(authData, "trigger_pd", {
        pd_id: "chuck.e131.webhooks",
        trigger_name: "e131_draw_frame",
        sync: true,
        copyOutputs: false,
        args: JSON.stringify(args)
    })
    .then(() => Promise.resolve({ success: true }))
    .catch((err) => {
        debug("test_draw_frame error: %s", JSON.stringify(err));
        return Promise.resolve({ success: true });
    });
}

function begin(authData, wfProxy, step, theForm) {
    return Promise.resolve({ success: true, args: { form: theForm, formValues: wfProxy.getGlobalValue("formData"), formErrors: wfProxy.getGlobalValue("formErrors") } });
}

function end(authData, wfProxy, step, formData) { return Promise.resolve({ success: true, path: wfProxy.PATH_SUCCESS, args: formData }); }
function postflight(authData, wfProxy) { return Promise.resolve({ success: true }); }
function terminate(authData, wfProxy) { return Promise.resolve({ success: true }); }

module.exports = { preflight, postflight, begin, end, terminate };
