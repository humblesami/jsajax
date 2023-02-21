class AjaxClient{
    fetch_timeout = 0;
    api_server_url = '';
    composer = undefined;;
    constructor(api_base_url, time_limit=0, composer){
        if(!time_limit){
            time_limit = 20;
        }
        this.api_server_url = api_base_url;
        this.fetch_timeout = time_limit;
        let composer_template = {
            on_api_request_init: function(){},
            on_api_success: function(){},
            on_api_error: function(){},
            on_api_failed: function(){},
        }
        if(!composer){
            composer = composer_template;
        }
        else{
            if(!composer.on_api_request_init){ composer.on_api_request_init = composer_template.on_api_request_init }
            if(!composer.on_api_success){ composer.on_api_success = composer_template.on_api_success }
            if(!composer.on_api_error){ composer.on_api_error = composer_template.on_api_error }
            if(!composer.on_api_failed){ composer.on_api_failed = composer_template.on_api_failed }
        }
        this.composer = composer;
    }

    async set_headers(fetch_options, headers){
        fetch_options.headers = headers;
    }

    async fetch_request(endpoint, method, req_data, headers={}, time_limit=0) {
        let obj_this = this;
        let api_base_url = this.api_server_url;
        let server_endpoint = api_base_url + endpoint;
        let raw_result = {
            status: 'failed', code: 512, message: 'No result',
            server_endpoint: server_endpoint, endpoint: endpoint.substr(1)
        }
        const abort_controller = new AbortController();
        let max_request_wait = (time_limit ? time_limit : obj_this.fetch_timeout) * 1000;
        const timeoutId = setTimeout(() => abort_controller.abort(), max_request_wait);
        this.composer.on_api_request_init(endpoint, max_request_wait);
        method = method.toLowerCase();
        let fetch_options = {
            headers: {},
            method: 'get',
            body: undefined,
            signal: abort_controller.signal
        };
        if(Object.keys(headers).length){
            fetch_options.headers = headers;
        }
        if(method == 'ping'){
            server_endpoint = endpoint;
            method = 'get';
        }
        else
        {
            await this.set_headers(fetch_options, headers);
        }
        if(method == 'get'){
            server_endpoint += '?data='+JSON.stringify(req_data);
            delete fetch_options['body'];
        }
        else{
            fetch_options.method = 'post';
            fetch_options.body = JSON.stringify(req_data);
        }

        return fetch(server_endpoint, fetch_options).then((api_response)=>{
            if(!api_response.status){
                if(api_response.detail)
                {
                    raw_result.message = 'Failed becaused => ' + api_response.detail;
                }
                else{
                    if(!api_response.message)
                    {
                        raw_result.message = 'Invalid access ';
                    }
                }
                return raw_result;
            }
            console.log()
            if(api_response.status == 200){
                if(method == 'ping'){
                    return {status: 'ok'}
                }
                return api_response.json().then(json_result=> json_result);
            }
            else{
                return {status: 'failed', message: 'Error thrown '+api_response.status+' by api'}
            }
        }).then(api_result=>{
            clearTimeout(timeoutId);
            for(let key in api_result){
                raw_result[key] = api_result[key];
            }
            let processed_result = obj_this.format_result(endpoint, raw_result);
            if(processed_result.status == 'ok' || processed_result.status == 'success'){
                this.on_api_response('success', endpoint);
            }
            else{
                this.on_api_response('error', endpoint, processed_result.message);
            }
            return processed_result;
        }).catch(er_not_accessible => {
            raw_result.status = 'failed';
            er_not_accessible = '' + er_not_accessible;
            raw_result.message = '\nDetail: Failed to fetch => ' +er_not_accessible;
            clearTimeout(timeoutId);
            if(er_not_accessible.indexOf('AbortError') > -1){
                raw_result.message = ('Timed out after '+ (obj_this.fetch_timeout)+ ' seconds');
                raw_result.code = 513;
            }
            else if(er_not_accessible.indexOf('Network request failed') > -1)
            {
                raw_result.message = 'Network request failed to reach';
            }
            else if(er_not_accessible.indexOf('JSON Parse error')> -1){
                raw_result.message = ('Api response is not a valid json');
                if(!raw_result.code)
                {
                    raw_result.code = 500;
                }
            }
            this.on_api_response('failed', endpoint, raw_result.message);
            return raw_result;
        }).catch(on_error=>{
            raw_result.message = 'Error 1 in catch => ' +on_error
            this.on_api_response('failed', endpoint, raw_result.message);
            return {status: 'failed', message: raw_result.message};
        }).catch(er_catch=>{
            raw_result.message = 'Error 2 in catch => ' +er_catch
            return {status: 'failed', message: raw_result.message};
        });
    }

    on_api_response(res_type, endpoint, message=''){
        console.log('Api response => '+ res_type, this.api_server_url+ endpoint, message);
        if(res_type == 'success'){
            this.composer.on_api_success(endpoint, message);
        }
        else if(res_type == 'error'){
            this.composer.on_api_error(endpoint, message);
        }
        if(res_type == 'failed'){
            this.composer.on_api_failed(endpoint, message);
        }
    }

    format_result(endpoint, processed_result){
        if(processed_result.status == 'success'){
            processed_result.status = 'ok';
        }
        if(processed_result.status != 'ok'){
            processed_result.status = 'failed';
            if(!processed_result.message && processed_result.error){
                processed_result.message = processed_result.error;
            }
            if(!processed_result.message && processed_result.data){
                processed_result.message = processed_result.data;
            }
            if(!processed_result.message){
                processed_result.message = 'Invalid response';
            }
            processed_result.message += ' in => '+ endpoint.substr(1);
            processed_result.status = 'error';
        }
        else{
            if(processed_result.message == 'No result'){
                processed_result.message = "Success at " + endpoint.substr(1);
            }
        }
        return processed_result;
    }

    set_server_url(server_url){
        this.api_server_url = server_url;
    }

    async ping(url, max_time=0){
        return this.fetch_request(url, 'ping', {}, max_time);
    }

    async get_data(endpoint, req_data={}, headers={}, max_time=0){
        return this.fetch_request(endpoint, 'GET', req_data, headers, max_time);
    }

    async post_data(endpoint, req_data={files:[]}, headers={}, max_time=0){
        try{
            if(req_data && req_data.files){
                let form_data = new FormData();
                for (let key in form_data) {
                    form_data.append(key, req_data[key]);
                }
                req_data.files.forEach((file) => {
                    form_data.append('files', file);
                });
            }
            return this.fetch_request(endpoint, 'POST', req_data, headers, max_time);
        }
        catch(post_er){
            return new Promise(function (resolve, reject) {
                resolve({status: 'failed', message: post_er});
            });
        }
    }
}
export {AjaxClient}