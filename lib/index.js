class AjaxClient {
    constructor(api_base_url, time_limit = 0) {
        if (!time_limit) {
            time_limit = 20
        }
        this.api_server_url = api_base_url || ""
        this.fetch_timeout = time_limit
    }
    on_api_init () { }
    on_api_success () { }
    on_api_error () { }
    on_api_failed () { }
    on_api_complete () {}

    async set_headers(){

    }

    async fetch_request(
        endpoint,
        method,
        req_data,
        headers = {},
        time_limit = 0
    ) {
        let obj_this = this;
        let api_base_url = this.api_server_url
        let server_endpoint = api_base_url + endpoint
        let raw_result = {
            status: "failed",
            code: 512,
            message: "No result",
            server_endpoint: server_endpoint,
            endpoint: obj_this.refined_end_point(endpoint)
        }
        const abort_controller = new AbortController()
        let max_request_wait = (time_limit ? time_limit : obj_this.fetch_timeout) * 1000;
        const timeoutId = setTimeout(() => abort_controller.abort(),max_request_wait);
        this.on_api_init(endpoint, max_request_wait);
        method = method.toLowerCase();
        if(!method){
            method = 'get';
        }
        let fetch_options = {
            headers: {},
            method: "get",
            signal: abort_controller.signal
        }
        if (method == "ping") {
            server_endpoint = endpoint
            method = "get"
        }
        if (method == "get") {
            if(req_data && Object.keys(req_data).length > 0) {
                server_endpoint += "?data=" + JSON.stringify(req_data);
            }
        } else {
            if(method == "post"){
                fetch_options.method = "POST";
                fetch_options.body = req_data;
                fetch_options.mode = 'same-origin';
            }
            else{
                raw_result.message = 'Invalid request method '+method;
                this.on_api_response(0, "failed", endpoint, raw_result.message);
                this.on_api_complete();
                return raw_result;
            }
        }
        if(Object.keys(headers).length)
        {
            fetch_options.headers = headers;
        }
        await this.set_headers(fetch_options, headers);
        //console.log(fetch_options);
        return fetch(server_endpoint, fetch_options).then(api_response => {
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
            if (api_response.status == 200) {
                if (method == "ping") {
                    return { status: "ok" }
                }
                return api_response.json().then(json_result => json_result)
            } else {
                return {
                    status: "failed",
                    message: "Error thrown " + api_response.status + " by api"
                }
            }
        }).then(api_result => {
            clearTimeout(timeoutId)
            for (let key in api_result) {
                raw_result[key] = api_result[key]
            }
            let processed_result = obj_this.format_result(endpoint, raw_result)
            if (
                processed_result.status == "ok" ||
                processed_result.status == "success"
            ) {
                this.on_api_success(processed_result);
            } else {
                this.on_api_response(processed_result, "error", endpoint, processed_result.message)
            }
            this.on_api_complete();
            return processed_result;
        }).catch(er_not_accessible => {
            raw_result.status = "failed"
            er_not_accessible = "" + er_not_accessible
            raw_result.message = "\nDetail: Failed to fetch => " + er_not_accessible
            clearTimeout(timeoutId)
            if (er_not_accessible.indexOf("AbortError") > -1) {
                raw_result.message =
                    "Timed out after " + obj_this.fetch_timeout + " seconds"
                raw_result.code = 513
            } else if (er_not_accessible.indexOf("Network request failed") > -1) {
                raw_result.message = "Network request failed to reach"
            } else if (er_not_accessible.indexOf("JSON Parse error") > -1) {
                raw_result.message = "Api response is not a valid json"
                if (!raw_result.code) {
                    raw_result.code = 500
                }
            }
            this.on_api_response(0, "failed", endpoint, raw_result.message);
            this.on_api_complete();
            return raw_result;
        }).catch(on_error => {
            raw_result.message = "Error 1 in catch => " + on_error
            this.on_api_response(0, "failed", endpoint, raw_result.message)
            this.on_api_complete();
            return { status: "failed", message: raw_result.message }
        }).catch(er_catch => {
            raw_result.message = "Error 2 in catch => " + er_catch;
            this.on_api_complete();
            return { status: "failed", message: raw_result.message }
        })
    }

    on_api_response(processed_result, res_type, endpoint, message = "") {
        console.log(
            "Api response => " + res_type,
            this.api_server_url + endpoint,
            message
        )
        if (res_type == "error") {
            this.on_api_error(endpoint, message, processed_result);
        }
        if (res_type == "failed") {
            this.on_api_failed(endpoint, message);
        }
    }

    format_result(endpoint, processed_result) {
        if (processed_result.status == "success") {
            processed_result.status = "ok"
        }
        if (processed_result.status != "ok") {
            processed_result.status = "failed";
            if (!processed_result.message && processed_result.error) {
                processed_result.message = processed_result.error;
            }
            if (!processed_result.message && processed_result.data) {
                processed_result.message = processed_result.data;
            }
            if (!processed_result.message) {
                processed_result.message = "Invalid response"
            }
            processed_result.message += " in => " + this.refined_end_point(endpoint);
            processed_result.status = "error";
        } else {
            if (processed_result.message == "No result") {
                processed_result.message = "Success at " + this.refined_end_point(endpoint);
            }
        }
        return processed_result;
    }

    refined_end_point(endpoint) {
        endpoint = endpoint ? endpoint : "";
        endpoint = endpoint.startsWith("/") ? endpoint.substr(1): endpoint;
        return endpoint;
    }

    set_server_url(server_url) {
        this.api_server_url = server_url;
    }

    async ping(url, max_time = 0) {
        return await this.fetch_request(url, "ping", {}, max_time);
    }

    async get_data_awaitable(endpoint, req_data = {}, headers = {}, max_time = 0) {
        return await this.fetch_request(endpoint, "GET", req_data, headers, max_time);
    }

    get_data(endpoint, req_data = {}, headers = {}, max_time = 0) {
        this.fetch_request(endpoint, "GET", req_data, headers, max_time);
    }

    prepare_form_data(formdata, headers, csrf=''){
        if(!(formdata instanceof FormData)){
            let json_data = formdata || {};
            formdata = new FormData();
            for(ik in json_data){
                let new_key = ik;
                if(Array.isArray(json_data[ik])){
                    if(!ik.endsWith("[]")){
                        new_key += '[]';
                    }
                }
                formdata.append(new_key, json_data[ik]);
            }
        }
        headers['Accept'] = 'application/json';
        headers['X-Requested-With'] = 'XMLHttpRequest';
        headers['Content-Type'] = 'multipart/form-data';
        // headers['X-Requested-With'] = 'XMLHttpRequest';
        if(csrf) {
            headers['X-CSRFToken'] = csrf;
        }
        return formdata;
    }

    async post_form_awaitable(endpoint, formdata, csrf='', headers={}, max_time=120){
        formdata = this.prepare_form_data(formdata, headers, csrf);
        return await this.fetch_request(endpoint, "POST", formdata, headers, max_time);
    }

    async post_data_awaitable(
        endpoint,
        reqdata,
        headers={},
        max_time = 0
    ) {
        return await this.post_form_awaitable('', endpoint, reqdata, headers,max_time);
    }

    post_form(csrf='', endpoint, formdata, headers={}, max_time=120){
        formdata = this.prepare_form_data(formdata, headers, csrf);
        this.fetch_request(endpoint, "POST", formdata, headers, max_time);
    }
    post_data(
        endpoint,
        reqdata,
        headers={},
        max_time = 0
    ) {
        this.post_form('', endpoint, reqdata, headers,max_time);
    }
}

export {AjaxClient}