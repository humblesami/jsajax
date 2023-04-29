## In test mode:
Totally free, totally open, no conditions applied, no guarantees for anything yet
### Installation
`npm install json-http-client`

or

`yarn add json-http-client`
### Usage

```js
import AjaxClient from '@samiciit/json-http-client'

function my_api_call(){
    let ajax_client = new AjaxClient({
        token_type: 'csrf',
        token_value: 123,
        api_base_url: 'http://localhost',
    });

    //Optionally yo can set the server url
    ajax_client.set_server_url('http://localhost:8000');
    //endpoint can be a path like
    '/api/route1'
    //or full url like
    'http://somehost/api/route1'


    // you can update/change the default empty function `set_headers`
    // it is the last thing executed just before sending request to server

    function fun1(){}
    //you have 4 events, you can implement any or all of them
    ajax_client.before_api_request = fun1;
    ajax_client.on_api_success = function (reponse_data) { }
    ajax_client.on_api_failed = function (endpoint, message, full_result) { }
    ajax_client.on_api_complete = function () { }

    //You have 3 types of api calls 1.ping, 2.get_data, 3.post_data 4, post_form

    my_api_call.ping(endpoint,reqdata,headers,max_time);
    my_api_call.get_data_awaitable(endpoint, req_data, headers, max_time);
    my_api_call.post_data(endpoint,reqdata,headers,max_time);
}

//You have 3 types of awaitable api calls same as above => 1.ping, 2.get_data, 3.post_data
function async_my_api_call(){
    let ajax_client = new AjaxClient();
    resp = await my_api_call.ping_awaitable(endpoint,reqdata,headers,max_time);
    resp = await my_api_call.get_data_awaitable(endpoint,reqdata,headers,max_time);
    resp = await my_api_call.post_data_awaitable(endpoint,reqdata,headers,max_time);
    //will handle and show status => failed if your network connection failed
    console.log(resp.status);
}

To publish your own package
npm publish --access public

```