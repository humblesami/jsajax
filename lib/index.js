class AjaxClient {
    constructor(options={}) {
        let time_limit = options.time_limit || 20;
        this.api_server_url = options.api_base_url || "";
        if(!this.api_server_url && options.client_type == 'web'){
            this.api_server_url = window.location.origin +'';
        }
        this.fetch_timeout = time_limit;
        this.header_tokens = options.header_tokens;
        //console.log(453222, this.header_tokens);
    }

    just_before_api_request(endpoint, max_request_wait, fetch_options) {}
    on_api_success(api_result) { }
    on_api_failed(api_result) {
        console.log('\nError: Default handler: '+api_result.error_message);
        console.log('\nError: Full result', api_result);
    }
    on_api_complete(endpoint) { }

    set_cross_token(updated_headers, decided_token) {
        let token_value = decided_token.value || this.header_tokens.csrf.value;
        if (token_value) {
            let token_key = decided_token.key || this.header_tokens.csrf.key;
            updated_headers[token_key] = token_value;
            delete updated_headers['Content-Type'];
        }
    }

    set_authtoken(updated_headers, decided_token) {
        //console.log(555, this.header_tokens);
        let token_value = decided_token.value || this.header_tokens.auth_token.value;
        if(token_value){
            let token_key = decided_token.key || this.header_tokens.auth_token.key;
            updated_headers[token_key] = this.header_tokens.auth_token.prefix + token_value;
        }
        updated_headers['Content-Type'] = 'multipart/form-data';
        //console.log(updated_headers);
    }

    set_headers_tokens(updated_headers = {}, token_attrs = {}) {
        updated_headers['Content-Type'] = '';
        if (this.header_tokens.token_type == 'auth') {
            this.set_authtoken(updated_headers, token_attrs);
        }
        else if (this.header_tokens.token_type == 'csrf') {
            this.set_cross_token(updated_headers, token_attrs);
        }
        return updated_headers;
    }

    async fetch_request(
        endpoint,
        method,
        req_data,
        headers = {},
        time_limit = 0
    ) {
        let raw_result = {
            status: "failed",
            code: 512,
            message: "No result",
            endpoint: '',
            server_endpoint: '',
        }
        try {
            let obj_this = this;
            if (!method) {
                method = 'get';
            }
            if(!endpoint || typeof endpoint !== "string") {
                raw_result.message = 'Invalid api point provided';
                this.after_request_handling(512, {}, 'start-1', server_endpoint);
                return raw_result;
            }
            method = "" + method;
            method = method.toLowerCase();
            let api_base_url = this.api_server_url;
            let server_endpoint = api_base_url + endpoint;
            raw_result.server_endpoint = server_endpoint;
            raw_result.endpoint = obj_this.refined_end_point(endpoint);
            const abort_controller = new AbortController()
            let max_request_wait = (time_limit ? time_limit : obj_this.fetch_timeout) * 1000;
            const timeoutId = setTimeout(() => abort_controller.abort(), max_request_wait);
            let fetch_options = {
                headers: {},
                method: "get",
                signal: abort_controller.signal
            }
            if (method == "ping") {
                method = "get";
            }
            if (method == "get") {
                if (req_data && Object.keys(req_data).length > 0) {
                    server_endpoint += "?data=" + JSON.stringify(req_data);
                }
            } else {
                if (method == "post") {
                    fetch_options.method = "POST";
                    fetch_options.body = req_data;
                    //fetch_options.mode = 'same-origin';
                }
                else {
                    raw_result.message = 'Invalid request method ' + method;
                    this.after_request_handling(513, {}, 'start-2', server_endpoint);
                    return raw_result;
                }
            }
            if (Object.keys(headers).length) {
                fetch_options.headers = headers;
            }
            fetch_options.headers = this.set_headers_tokens();
            this.just_before_api_request(server_endpoint, max_request_wait, fetch_options);
            return fetch(server_endpoint, fetch_options).then(api_response => {
                //console.log(4444, api_response);
                if (!api_response.status) {
                    if (api_response.detail) {
                        raw_result.message = "Failed because => " + api_response.detail
                    } else {
                        if (!api_response.message) {
                            raw_result.message = "Invalid access "
                        }
                    }
                    return raw_result
                }
                raw_result.code = api_response.status;
                if (api_response.status != 200) {
                    return {
                        status: "failed",
                        error_code: api_response.status,
                        message: "Error thrown " + api_response.status + " by api"
                    }
                }
                if (method == "ping") {
                    return { status: "ok" }
                }
                return api_response.json().then(json_result => json_result);
            }).then(api_result => {
                let processed_result = api_result;
                try{
                    clearTimeout(timeoutId);
                    for (let key in api_result) {
                        raw_result[key] = api_result[key]
                    }
                    if(processed_result.status == 'success' || processed_result.status == 'ok'){
                        processed_result.success = 1;
                        processed_result.done = 1;
                        processed_result.ok = 1;
                    }
                }
                catch(er1){
                    console.log('\nError: Failed to process response => '+ er1);
                }
                let status_code = api_result.error_code || 200;
                this.after_request_handling(status_code, processed_result, 'accessing api', server_endpoint);
                return processed_result;
            }).catch(er_not_accessible => {
                try{
                    if(raw_result.code == 512)
                    {
                        raw_result.code = 514;
                    }
                    raw_result.status = "failed"
                    er_not_accessible = "" + er_not_accessible
                    raw_result.message = "\nDetail: Failed to fetch => " + er_not_accessible
                    clearTimeout(timeoutId)
                    if (er_not_accessible.indexOf("AbortError") > -1) {
                        raw_result.message ="Timed out after " + obj_this.fetch_timeout + " seconds";
                        raw_result.code = 515;
                    } else if (er_not_accessible.indexOf("Network request failed") > -1) {
                        raw_result.message = "Network request failed to reach "+server_endpoint;
                    } else if (er_not_accessible.indexOf("JSON Parse error") > -1) {
                        raw_result.message = "Api response is not a valid json"
                        if (!raw_result.code) {
                            raw_result.code = 500
                        }
                    }
                    raw_result.details = '' + er_not_accessible;
                }
                catch(er2){
                    raw_result.code = 515;
                    console.log('\nError: Failed to process error => '+ er2, er_not_accessible);
                }
                this.after_request_handling(raw_result.code, raw_result, 'fetch', server_endpoint, raw_result.message);
                return raw_result;
            });
        }
        catch (ert) {
            raw_result.code = 516;
            raw_result.message = 'Error before request => '+ert;
            raw_result.details = '' + ert;
            this.after_request_handling(516, raw_result, 'outer-catch', endpoint, raw_result.message);
            return raw_result;
        }
    }

    process_error_log(api_result, failure_type=''){
        let message = api_result.error_message || 'Unprocessed Error ain api';
        let stage = api_result.stage;
        let endpoint = api_result.endpoint;
        api_result.error_message = failure_type + ' ' + (message || 'Unhandled error-3') + ' in ' +endpoint+' at stage '+stage;
    }

    after_request_handling(status_code, api_result, from_point, endpoint, message=''){
        try{
            if(status_code == 200){
                if((!api_result.status || api_result.status == 'error') && !api_result.ok){
                    api_result.error_message = (api_result.message || (message || 'Unhandled error-1')) + ' at point '+from_point;
                    api_result.stage = from_point;
                    api_result.endpoint = endpoint;
                    this.process_error_log(api_result, 'Failure');
                    this.on_api_failed(api_result);
                }
                else{
                    api_result.sucess = 1;
                    this.on_api_success(api_result);
                }
            }
            else{
                console.log(message, api_result.message, from_point);
                api_result.error_message = (api_result.message || (message || 'Unhandled error-2')) + ' at point '+from_point;
                api_result.stage = from_point;
                api_result.endpoint = endpoint;
                this.process_error_log(api_result, 'Error');
                this.on_api_failed(api_result);
            }
        }
        catch(er1){
            if(from_point == 200){
                console.log('\nError: Full result', api_result);
                console.log('\nError: Failed to proceed '+endpoint+ ' after reaching api => '+er1);
            }
            else{
                console.log('\nError: Full result', api_result);
                console.log('\nError: Failed to proceed '+endpoint+ ' after error => '+er1);
            }
        }
        try{
            this.on_api_complete(endpoint);
        }
        catch(er1){
            console.log('\nError: Failed to proceed '+endpoint+ ' on complete => '+er1);
        }
    }

    refined_end_point(endpoint) {
        endpoint = endpoint ? endpoint : "";
        endpoint = endpoint.startsWith("/") ? endpoint.substr(1) : endpoint;
        return endpoint;
    }

    set_server_url(server_url) {
        this.api_server_url = server_url;
    }

    async ping_awaitable(url, max_time = 0) {
        return await this.fetch_request(url, "ping", {}, max_time);
    }

    ping(url, max_time = 0) {
        return this.fetch_request(url, "ping", {}, max_time);
    }

    async get_data_awaitable(endpoint, req_data = {}, headers = {}, max_time = 0) {
        return await this.fetch_request(endpoint, "GET", req_data, headers, max_time);
    }

    get_data(endpoint, req_data = {}, headers = {}, max_time = 0) {
        this.fetch_request(endpoint, "GET", req_data, headers, max_time);
    }

    prepare_form_data(formdata) {
        if (!(formdata instanceof FormData)) {
            let json_data = formdata || {};
            formdata = new FormData();
            for (let ik in json_data) {
                let new_key = ik;
                //console.log(json_data[ik]);
                formdata.append(new_key, json_data[ik]);
            }
        }
        return formdata;
    }

    async post_data_awaitable(
        endpoint,
        reqdata,
        headers = {},
        max_time = 0
    ) {
        let formdata = this.prepare_form_data(reqdata, headers);
        return await this.fetch_request(endpoint, "POST", formdata, headers, max_time);
    }

    post_data(
        endpoint,
        reqdata,
        headers = {},
        max_time = 0
    ) {
        let formdata = this.prepare_form_data(reqdata, headers);
        this.fetch_request(endpoint, "POST", formdata, headers, max_time);
    }
}

export { AjaxClient }