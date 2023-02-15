Totally free

Totally Open

No conditions applied


#Installation

npm install @samiciit/ajax-json-http-clinet

or

yarn add @samiciit/ajax-json-http-clinet


#Usage

import AjaxClient from '@samiciit/ajax-json-http-clinet'

async my_async_method(){
    let ajax_client = new AjaxClient();
    let resp = await ajax_client.ping('https://google.com');
    //will handle and show status => failed if your network connection failed
    console.log(resp.status);
}

